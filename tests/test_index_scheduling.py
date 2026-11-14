"""Real queue/SQLite scheduling markers bound background work across restarts."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from repoask.platform import Platform,Worker
from repoask.platform.errors import PlatformError
from repoask.scheduling import IndexScheduler


class Catalog:
    def __init__(self,count):
        self.repos=[{'id':f'gh:{n+1}','full_name':f'team/repo{n+1}','pushed_at':'one','default_branch':'main'} for n in range(count)]
        self.listeners=[]
    def register_eligibility_listener(self,fn):self.listeners.append(fn)
    def list_repositories(self,*,cursor=None,limit=100,index_enabled=True):
        offset=int(cursor or 0);items=self.repos[offset:offset+limit]
        return {'items':items,'next_cursor':str(offset+limit) if offset+limit<len(self.repos) else None}


class Providers:
    version='v1';status='ready'
    def roles(self):return {'embedding':{'version_id':self.version,'status':self.status}}


class QueueIndex:
    """Test double for the public domain API; real FK/run/job records below it."""
    def __init__(self,platform,catalog):self.platform=platform;self.catalog=catalog;self.fail=None
    def get_state(self,repository_id):
        with self.platform.store.transaction() as c:
            c.execute("INSERT OR IGNORE INTO index_sources(id,kind,github_repository_id,name,created_at,updated_at) VALUES(?,'github',?,?,1,1)",(repository_id,repository_id,repository_id))
            run=c.execute("SELECT id FROM index_runs WHERE repository_id=? AND state IN ('queued','running','waiting','paused')",(repository_id,)).fetchone()
        return {'eligible':True,'active_run':{'id':run[0]} if run else None}
    def request_index(self,repository_id,priority=0,embedding_version_id=None):
        if repository_id==self.fail:raise PlatformError('Synthetic domain failure.')
        with self.platform.store.transaction() as c:
            job=self.platform.jobs.enqueue_in_transaction(c,'index.run',{'repository_id':repository_id},priority=priority)
            ident='run:'+job.id
            c.execute("INSERT INTO index_runs(id,repository_id,job_id,state,profile_version_id,created_at,updated_at) VALUES(?,?,?,'queued',?,1,1)",(ident,repository_id,job.id,embedding_version_id))
        return {'id':ident,'state':'queued'}
    def finish(self):
        def handle(job,context):
            with self.platform.store.transaction() as c:c.execute("UPDATE index_runs SET state='completed' WHERE job_id=?",(job.id,))
            return {}
        worker=Worker(self.platform.jobs,{'index.run':handle},worker_id='scheduler-fixture')
        while worker.run_once():pass


class IndexSchedulingTests(TestCase):
    def setup_platform(self,directory,count):
        p=Platform.open(directory);catalog=Catalog(count)
        with p.store.transaction() as c:
            c.execute("INSERT OR IGNORE INTO provider_profiles VALUES('p','embeddings','v1',NULL,1,1)")
            for n in (1,2):c.execute("INSERT OR IGNORE INTO provider_profile_versions VALUES(?,'p',?,'ollama','http://127.0.0.1:11434','nomic',NULL,'{}',1)",(f'v{n}',n))
            for n in range(count):
                c.execute("INSERT OR IGNORE INTO repositories(id,github_id,owner,name,full_name,default_branch,visibility,clone_url,created_at,updated_at) VALUES(?,?,'team',?,?,'main','private','https://github.com/team/test.git',1,1)",(f'gh:{n+1}',n+1,f'repo{n+1}',f'team/repo{n+1}'))
        index=QueueIndex(p,catalog);providers=Providers()
        return p,catalog,index,providers

    def test_backpressure_signatures_and_restart_do_not_requeue_finished_unchanged_work(self):
        with TemporaryDirectory() as directory:
            p,catalog,index,providers=self.setup_platform(Path(directory),7)
            scheduler=IndexScheduler(p,index,catalog,providers,queue_limit=3)
            self.assertEqual(scheduler.run_once(),3);self.assertEqual(scheduler.run_once(),0)
            index.finish();self.assertEqual(scheduler.run_once(),3)
            index.finish();self.assertEqual(scheduler.run_once(),1)
            index.finish();self.assertEqual(scheduler.run_once(),0)
            with p.store.read() as c:self.assertEqual(set(r[0] for r in c.execute('SELECT priority FROM jobs')),{-10})
            p.close()
            p,catalog,index,providers=self.setup_platform(Path(directory),7)
            try:self.assertEqual(IndexScheduler(p,index,catalog,providers,queue_limit=3).run_once(),0)
            finally:p.close()

    def test_catalog_or_profile_change_and_explicit_reselection_create_new_intents(self):
        p,catalog,index,providers=self.setup_platform(None,1);self.addCleanup(p.close)
        scheduler=IndexScheduler(p,index,catalog,providers,clock=lambda:1)
        self.assertEqual(scheduler.run_once(),1);index.finish()
        catalog.repos[0]['pushed_at']='two';self.assertEqual(scheduler.run_once(),1);index.finish()
        providers.version='v2';self.assertEqual(scheduler.run_once(),1);index.finish()
        self.assertEqual(scheduler.run_once(),0)
        for listener in catalog.listeners:listener('gh:1',True)
        self.assertEqual(scheduler.run_once(),1)

    def test_unverified_role_blocks_background_source_work_and_one_error_does_not_block_others(self):
        p,catalog,index,providers=self.setup_platform(None,3);self.addCleanup(p.close)
        scheduler=IndexScheduler(p,index,catalog,providers)
        providers.status='untested';self.assertEqual(scheduler.run_once(),0)
        self.assertEqual(scheduler.error_code,'embedding_not_verified')
        providers.status='ready';index.fail='gh:1'
        self.assertEqual(scheduler.run_once(),2)
        self.assertEqual(scheduler.error_code,'index_schedule_unavailable')
