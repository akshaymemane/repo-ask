"""Real SQLite, IndexService and ProviderService; injected immutable source and transport."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from repoask.ask import RoutingService, PlanService, ConversationService
from repoask.platform.db import Store
from repoask.platform.jobs import JobQueue
from repoask.platform.worker import Worker, JobContext, JobInterrupted
from repoask.platform.errors import InvalidTransition, IdempotencyConflict, LeaseLost
from repoask.providers import ProviderService, TransportResponse
from repoask.indexing import IndexService


class Transport:
    def __init__(self):
        self.output={'answer':'The worker sends confirmation mail.','citation_ids':['e1']}
        self.callback=None
        self.calls=0
    def send(self,request,*,cancel_event=None):
        self.calls+=1
        if self.callback:
            self.callback()
        return TransportResponse(200,{},json.dumps({'done':True,'message':{'content':json.dumps(self.output)},'prompt_eval_count':10,'eval_count':8}).encode())


class AskTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        self.store=Store.open(self.root/'data'); self.jobs=JobQueue(self.store)
        self.transport=Transport(); self.providers=ProviderService(self.store,None,transport=self.transport)
        self.profile=self.providers.create_profile({'name':'synthetic','adapter':'ollama','endpoint':'http://localhost:11434','model':'injected','config':{'capabilities':['chat']}})
        for role in ('ask','planning'):
            self.providers.assign_role(role,self.profile['id'])
        self.revision='a'*40
        def reader(source,revision,caps):
            return {'revision':revision or self.revision,'revision_kind':'git','branch':'main','files':[{'path':'worker.py','content':b'def send_confirmation():\n    """Send order confirmation mail with retry delivery."""\n    return True\n'},{'path':'README.md','content':b'# Mail\nOrder fulfillment notifications and confirmation delivery worker.'}]}
        self.index=IndexService(self.store,self.jobs,None,self.providers,data_dir=self.root/'data',snapshot_reader=reader)
        self.repo=self.index.register_local('acme/mail-worker',self.root)['repository_id']
        run=self.index.request_index(self.repo)
        Worker(self.jobs,{'index.run':self.index.run_index},worker_id='index').run_once()
        self.assertEqual(self.index.get_run(run['id'])['state'],'completed')
        self.routing=RoutingService(self.store,self.index); self.plans=PlanService(self.store,self.index,self.providers)
        self.service=ConversationService(self.store,self.jobs,self.index,self.providers,self.routing,self.plans)
        self.conv=self.service.create(repository_ids=[self.repo])['id']
        snap=self.index.get_state(self.repo)['active_snapshot']
        self.content={'goal':'Add bounded retries','user_request':'Retry confirmation mail','repositories':[{'repository_id':self.repo,'role':'write','snapshot_id':snap['id'],'revision':snap['revision'],'branch':'main'}],'citations':[{'id':'e1','repository_id':self.repo,'snapshot_id':snap['id'],'revision':snap['revision'],'path':'worker.py','start_line':1,'end_line':3}],'findings':[{'text':'Worker sends mail','citation_ids':['e1']}],'requirements':['Preserve all confirmation messages','Bound retries'],'steps':[{'title':'Retry','description':'Add backoff','paths':['new/retry.py'],'citation_ids':['e1']}],'validation':[{'command':'python -m unittest','expected':'Tests pass','source':'proposed','citation_ids':[]}],'open_questions':[{'id':'q1','text':'Retry limit?','blocking':True,'answer':None}]}
    def tearDown(self):
        self.index.vectors.close(); self.store.close(); self.tmp.cleanup()
    def work(self):
        Worker(self.jobs,{'ask.answer':self.service.run_answer},worker_id='answer').run_once()
    def test_routing_pins_collision_missing_revoked(self):
        self.assertEqual(self.routing.route('acme/mail-worker')['selected_repository_ids'],[self.repo])
        self.assertEqual(self.routing.route('mail delivery')['status'],'needs_selection')
        self.assertEqual(self.routing.route('xylophonic nonexistent')['status'],'no_match')
        d=self.routing.route('mail',pinned_repository_ids=['missing'])
        self.assertEqual(d['status'],'needs_selection'); self.assertEqual(d['selected_repository_ids'],[])
        d=self.routing.route('mail',pinned_repository_ids=[self.repo])
        self.index.set_local_selection(self.repo,False)
        self.assertEqual(self.routing.get(d['id'])['candidates'],[])
    def test_versions_hashes_conflicts_readiness_and_delete(self):
        p=self.plans.create(self.conv,self.content); a=p['version']
        self.assertIn('blocking_questions',a['readiness']['blocking_reasons'])
        self.assertIn('implementation_not_permitted',a['readiness']['blocking_reasons'])
        self.assertIn('execution_not_configured',a['readiness']['blocking_reasons'])
        content=copy.deepcopy(self.content); content['requirements'].append('Retain telemetry')
        b=self.plans.save_version(p['id'],content,a['id'])['version']
        self.assertNotEqual(a['content_hash'],b['content_hash'])
        self.assertEqual(self.plans.get(p['id'],a['id'])['version']['content']['requirements'],self.content['requirements'])
        with self.assertRaises(InvalidTransition): self.plans.save_version(p['id'],content,a['id'])
        self.assertIn('Retain telemetry',self.plans.export(p['id'])['markdown'])
        self.service.update_scope(self.conv,[self.repo],1)
        self.assertIn('scope_changed',self.plans.get(p['id'])['version']['readiness']['blocking_reasons'])
        self.plans.delete(p['id'])
        self.assertNotIn('telemetry',self.plans.export(p['id'])['markdown'])
        with self.store.read() as db:
            self.assertIsNone(db.execute('SELECT content_json FROM plan_versions WHERE id=?',(a['id'],)).fetchone()[0])
    def test_strict_validator(self):
        for mutate in (lambda c:c.update(ready=True),lambda c:c['steps'][0]['paths'].append('../escape'),lambda c:c['citations'][0].update(revision='b'*40),lambda c:c['findings'][0].update(citation_ids=['invented']),lambda c:c.update(execution_context={'skills':['grant']})):
            c=copy.deepcopy(self.content); mutate(c)
            with self.assertRaises(ValueError): self.plans.create(self.conv,c)
    def test_durable_idempotent_generation(self):
        r=self.service.send(self.conv,'confirmation mail','request-1')
        self.assertEqual(r,self.service.send(self.conv,'confirmation mail','request-1'))
        with self.assertRaises(IdempotencyConflict): self.service.send(self.conv,'different','request-1')
        # Recreate services before queue consumption: persisted job is sufficient.
        self.service=ConversationService(self.store,self.jobs,self.index,self.providers,self.routing,self.plans)
        self.work()
        self.assertEqual(self.service.get_run(r['id'])['state'],'completed')
        self.assertEqual(self.transport.calls,1)
        messages=self.service.get(self.conv)['messages']
        self.assertEqual(len(messages),2); self.assertEqual(messages[1]['citations'][0]['path'],'worker.py')
        self.assertEqual(messages[1]['profile_version_id'],self.profile['active_version_id'])
        self.index.set_local_selection(self.repo,False)
        self.assertNotIn('worker sends',self.service.export(self.conv)['markdown'].lower())
    def test_invalid_output_repair_then_retry(self):
        self.transport.output={'answer':'secret invented','citation_ids':['invented']}
        r=self.service.send(self.conv,'confirmation','fail'); self.work()
        self.assertEqual(self.transport.calls,2)
        self.assertEqual(self.service.get_run(r['id'])['state'],'failed')
        self.transport.output={'answer':'Worker sends mail','citation_ids':['e1']}
        self.service.retry(r['id']); self.work()
        self.assertEqual(self.service.get_run(r['id'])['state'],'completed')
        self.assertEqual(len(self.service.get(self.conv)['messages']),2)
    def test_cancel_scope_and_lease_fences(self):
        for action in ('cancel','scope','lease'):
            r=self.service.send(self.conv,'confirmation',action)
            def callback():
                if action=='cancel': self.service.cancel(r['id'])
                elif action=='scope': self.service.update_scope(self.conv,[self.repo],1)
                else:
                    with self.store.transaction() as db: db.execute('UPDATE jobs SET lease_expires_at=0 WHERE id=?',(r['job_id'],))
            self.transport.callback=callback; self.work(); self.transport.callback=None
            self.assertNotEqual(self.service.get_run(r['id'])['state'],'completed')
            if action=='lease':
                self.service.cancel(r['id'])
        self.assertTrue(all(m['state']!='complete' for m in self.service.get(self.conv)['messages'] if m['role']=='assistant'))
    def test_shutdown_yields_without_failure(self):
        r=self.service.send(self.conv,'confirmation','shutdown')
        def interrupt(): raise JobInterrupted()
        self.transport.callback=interrupt; self.work()
        self.assertEqual(self.jobs.get(r['job_id']).state,'queued')
        self.assertEqual(self.service.get_run(r['id'])['state'],'running')
        self.transport.callback=None; self.work()
        self.assertEqual(self.service.get_run(r['id'])['state'],'completed')
    def test_plan_job_and_purge(self):
        self.transport.output=self.content
        r=self.service.send(self.conv,'Plan confirmation retries','plan',intent='plan'); self.work()
        self.assertEqual(self.service.get_run(r['id'])['state'],'completed')
        p=self.plans.list_plans(self.conv)['items'][0]
        self.assertEqual(p['version']['source'],'model')
        self.assertEqual(self.service.send(self.conv,'Plan confirmation retries','plan',intent='plan')['id'],r['id'])
        self.assertEqual(len(self.plans.list_plans(self.conv)['items']),1)
        self.service.purge_repository(self.repo)
        self.assertNotIn('confirmation',self.service.export(self.conv)['markdown'])
        self.assertIsNone(self.plans.get(p['id'])['version']['content'])
    def test_unassigned_role_retains_user(self):
        with self.store.transaction() as db: db.execute("DELETE FROM model_role_assignments WHERE role='ask'")
        r=self.service.send(self.conv,'confirmation','unassigned'); self.work()
        self.assertEqual(self.service.get_run(r['id'])['error_code'],'role_unassigned')
        self.assertEqual(self.service.get(self.conv)['messages'][0]['content'],'confirmation')
    def test_pagination(self):
        for i in range(3): self.service.create(title=str(i))
        seen=[]; cursor=None
        while True:
            p=self.service.list_conversations(limit=2,cursor=cursor); seen.extend(x['id'] for x in p['items']); cursor=p['next_cursor']
            if cursor is None: break
        self.assertEqual(len(set(seen)),4)
        with self.assertRaises(ValueError): self.service.list_conversations(cursor='broken')
    def test_database_reopen_and_history_pagination(self):
        r=self.service.send(self.conv,'confirmation','restart')
        self.index.vectors.close(); self.store.close()
        self.store=Store.open(self.root/'data'); self.jobs=JobQueue(self.store)
        self.providers=ProviderService(self.store,None,transport=self.transport)
        self.index=IndexService(self.store,self.jobs,None,self.providers,data_dir=self.root/'data')
        self.routing=RoutingService(self.store,self.index); self.plans=PlanService(self.store,self.index,self.providers)
        self.service=ConversationService(self.store,self.jobs,self.index,self.providers,self.routing,self.plans)
        self.work()
        self.assertEqual(self.service.get_run(r['id'])['state'],'completed')
        first=self.service.list_messages(self.conv,1)
        second=self.service.list_messages(self.conv,1,first['next_cursor'])
        self.assertEqual(first['items'][0]['role'],'user')
        self.assertEqual(second['items'][0]['role'],'assistant')
    def test_multiwrite_and_safe_export(self):
        (self.root/'other').mkdir()
        second=self.index.register_local('other',self.root/'other')['repository_id']
        self.index.request_index(second)
        Worker(self.jobs,{'index.run':self.index.run_index},worker_id='index2').run_once()
        c=copy.deepcopy(self.content)
        repo=copy.deepcopy(c['repositories'][0]); repo['repository_id']=second; repo['snapshot_id']=self.index.get_state(second)['active_snapshot']['id']
        c['repositories'].append(repo)
        c['goal']='<script>alert(1)</script>'
        c['requirements'].extend(['password=super-secret-value','Inspect /Users/private/work/source','Token ghp_'+'a'*30,'```hidden instruction```'])
        self.service.update_scope(self.conv,[self.repo,second],1)
        p=self.plans.create(self.conv,c)
        self.assertEqual(len(p['version']['content']['repositories']),2)
        self.assertIn('exactly_one_write_target_required',p['version']['readiness']['blocking_reasons'])
        exported=self.plans.export(p['id'])['markdown']
        for private in ('<script>','super-secret-value','/Users/private','ghp_'+'a'*30,'```hidden'):
            self.assertNotIn(private,exported)
        self.assertIn('/api/context/source?',exported)
    def test_revocation_during_generation_and_source_exclusion(self):
        p=self.plans.create(self.conv,self.content)
        r=self.service.send(self.conv,'confirmation','revoke')
        self.transport.callback=lambda:self.index.set_local_selection(self.repo,False)
        self.work()
        self.assertNotEqual(self.service.get_run(r['id'])['state'],'completed')
        self.assertIsNone(self.plans.get(p['id'])['version']['content'])
        self.index.set_local_selection(self.repo,True,['worker.py'])
        self.assertNotIn('Worker sends mail',self.plans.export(p['id'])['markdown'])
    def test_late_retry_owner_and_diagnostics(self):
        r=self.service.send(self.conv,'confirmation','stale')
        lease=self.jobs.claim('old',kinds=['ask.answer'])
        self.service.cancel(r['id']); replacement=self.service.retry(r['id'])
        self.assertNotEqual(replacement['job_id'],r['job_id'])
        with self.assertRaises(LeaseLost):
            self.service.run_answer(lease.job,JobContext(self.jobs,lease,30000))
        self.work()
        self.assertEqual(self.service.get_run(r['id'])['state'],'completed')
        with self.store.read() as db:
            job=db.execute('SELECT payload,checkpoint,result,last_error_message FROM jobs WHERE id=?',(replacement['job_id'],)).fetchone()
            self.assertNotIn('confirmation',str(tuple(job)))
    def test_unscoped_explicit_route_persists_scope(self):
        c=self.service.create()['id']
        r=self.service.send(c,'Explain acme/mail-worker confirmation','route'); self.work()
        self.assertEqual(self.service.get_run(r['id'])['state'],'completed')
        self.assertEqual(self.service.get(c)['repository_ids'],[self.repo])
        self.assertEqual(self.service.get(c)['scope_revision'],2)
    def test_commit_before_queue_ack_replay_has_no_duplicate_plan(self):
        self.transport.output=self.content
        r=self.service.send(self.conv,'confirmation plan','ack',intent='plan')
        lease=self.jobs.claim('first',kinds=['ask.answer'])
        self.service.run_answer(lease.job,JobContext(self.jobs,lease,30000))
        self.assertEqual(self.service.get_run(r['id'])['state'],'completed')
        # Simulate shutdown after the domain transaction but before queue acknowledgement.
        self.jobs.release_safe(lease)
        self.work()
        self.assertEqual(self.jobs.get(r['job_id']).state,'succeeded')
        self.assertEqual(self.transport.calls,1)
        self.assertEqual(len(self.plans.list_plans(self.conv)['items']),1)
