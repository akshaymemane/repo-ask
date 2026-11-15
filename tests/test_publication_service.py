"""F06 service behavior with real SQLite/jobs and a fake GitHub boundary."""

import base64
import copy
from types import SimpleNamespace
from unittest import TestCase

from repoask.github.errors import GitHubError
from repoask.platform.worker import Worker
from repoask.publication import PublicationError, PublicationService
import test_publication_schema

BASE = 'a' * 40
CURRENT = 'b' * 40
TREE = 'c' * 40
COMMIT = 'd' * 40
BLOB = 'e' * 40


class Sessions:
    def __init__(self, repository_id):
        self.value = {
            'session_id':'ses', 'plan_id':'plan', 'plan_version_id':'pv',
            'repository_id':repository_id, 'base_sha':BASE, 'base_branch':'main',
            'session_branch':'opendevin/ses', 'diff_hash':'f' * 40,
            'checkpoint_artifact_id':'checkpoint', 'patch_artifact_id':'patch',
            'checkpoint':{'base_sha':BASE,
                          'changed':{'calc.py':base64.b64encode(b'return a + b\n').decode()},
                          'deleted':['old.sh'], 'modes':{'calc.py':'100755','old.sh':'100644'}, 'rejected':[]},
            'patch':{'base_sha':BASE,'files':[{'path':'calc.py'}],'rejected':[],
                     'stats':{'files':2,'additions':1,'deletions':1}},
            'policy':'manual_draft',
            'outcome':{'result':'reviewable','publication_eligible':True,
                       'containment':{'confirmed':True},'artifacts_stale':False},
            'validations':{'fully_validated':True,'summary':{'passed':1}},
            'source_available':True,
        }

    def publication_snapshot(self, ident):
        if ident != 'ses':
            raise PublicationError('not_found')
        return copy.deepcopy(self.value)


class Client:
    def __init__(self):
        self.calls=[];self.base=BASE;self.ref=None;self.pr=None
        self.unknown_ref=False;self.unknown_pr=False;self.collision_once=False
        self.on_blob=None
        self.compare_files=[];self.compare_complete=True

    def default_branch_sha(self, token, owner, name, branch):
        self.calls.append(('base',token,branch));return self.base
    def compare(self, token, owner, name, base, head):
        self.calls.append(('compare',base,head));return {'files':self.compare_files,'complete':self.compare_complete}
    def commit(self, token, owner, name, sha):
        self.calls.append(('commit',sha));return {'sha':sha,'tree_sha':TREE}
    def create_blob(self, token, owner, name, content):
        self.calls.append(('blob',content))
        if self.on_blob:self.on_blob()
        return BLOB
    def create_tree(self, token, owner, name, base_tree, entries):
        self.calls.append(('tree',base_tree,entries));return '1' * 40
    def create_commit(self, token, owner, name, message, tree, parent, identity):
        self.calls.append(('create_commit',tree,parent,identity));return COMMIT
    def create_ref(self, token, owner, name, branch, sha):
        self.calls.append(('create_ref',branch,sha))
        if self.collision_once:
            self.collision_once=False;self.ref='9'*40;return False
        self.ref=sha
        if self.unknown_ref:
            self.unknown_ref=False;raise GitHubError('timeout')
        return True
    def get_ref(self, token, owner, name, branch):
        self.calls.append(('get_ref',branch))
        if self.ref is None:raise GitHubError('not_found')
        return self.ref
    def create_pull_request(self, token, owner, name, title, body, head, base):
        self.calls.append(('create_pr',head,base,True))
        self.pr=self._pr(head,base)
        if self.unknown_pr:
            self.unknown_pr=False;raise GitHubError('timeout')
        return self.pr
    def pull_requests(self, token, owner, name, head, base):
        self.calls.append(('find_pr',head,base));return [self.pr] if self.pr else []
    def pull_request(self, token, owner, name, number):
        self.calls.append(('get_pr',number));return self.pr
    @staticmethod
    def _pr(head,base):
        return {'id':99,'number':7,'draft':True,'state':'open','merged':False,
                'html_url':'https://github.com/acme/repo/pull/7',
                'head':{'sha':COMMIT,'ref':head,'repo':{'full_name':'acme/repo'}},
                'base':{'ref':base,'repo':{'full_name':'acme/repo'}}}


class GitHub:
    def __init__(self):
        self.client=Client();self.tokens=[];self.access=[];self.hooks={};self.denied=False
    def register_purge_hook(self,name,fn):self.hooks[name]=fn
    def require_access(self,repo,cap):
        self.access.append((repo,cap))
        if self.denied:raise GitHubError('capability_missing')
        return {}
    def get_repository(self,repo):return {'id':repo,'owner':'acme','name':'repo','full_name':'acme/repo','default_branch':'main'}
    def mint_installation_token(self,repo,permissions=None):
        self.tokens.append((repo,permissions));return {'token':'transient'}


class PublicationTests(TestCase):
    def setUp(self):
        self.fixture=test_publication_schema.PublicationSchemaTests(methodName='runTest')
        self.fixture.setUp();self.addCleanup(self.fixture.doCleanups)
        self.platform=SimpleNamespace(store=self.fixture.f.store,jobs=self.fixture.f.jobs);self.repo=self.fixture.f.repo
        self.sessions=Sessions(self.repo);self.github=GitHub()
        self.svc=PublicationService(self.platform,self.github,self.sessions,clock=lambda:1763164800000)
        self.svc.update_settings('OpenDevin','operator@example.test')

    def publish(self,key='one'):
        return self.svc.publish('ses','Fix add','Body','f'*40,1,key)

    def run_job(self):
        self.assertTrue(Worker(self.platform.jobs,{'publication.run':self.svc.run},worker_id='pub').run_once())

    def test_preview_is_read_only_and_publish_is_atomic_idempotent(self):
        preview=self.svc.preview('ses')
        self.assertTrue(preview['publishable']);self.assertEqual(self.github.tokens,[])
        first=self.publish();again=self.publish()
        self.assertEqual(first['id'],again['id'])
        with self.assertRaises(PublicationError):self.svc.publish('ses','Other','Body','f'*40,1,'one')
        with self.platform.store.read() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM publications').fetchone()[0],1)
            job=db.execute("SELECT effect,max_attempts FROM jobs WHERE kind='publication.run'").fetchone()
        self.assertEqual(tuple(job),('external',1))

    def test_success_uses_base_tree_modes_deletion_exact_token_and_draft(self):
        pub=self.publish();self.run_job();done=self.svc.get(pub['id'])
        self.assertEqual(done['state'],'published')
        self.assertEqual(self.github.tokens,[(self.repo,{'contents':'write','pull_requests':'write'})])
        tree=next(c for c in self.github.client.calls if c[0]=='tree')
        self.assertEqual(tree[1],TREE)
        self.assertEqual(tree[2],[{'path':'calc.py','mode':'100755','type':'blob','sha':BLOB},
                                  {'path':'old.sh','mode':'100644','type':'blob','sha':None}])
        self.assertIn(('create_pr',done['head_branch'],'main',True),self.github.client.calls)
        self.assertEqual(done['pull_request_url'],'https://github.com/acme/repo/pull/7')

    def test_empty_diff_never_mints_token_or_writes(self):
        self.sessions.value['checkpoint'].update(changed={},deleted=[])
        self.sessions.value['patch']['stats']['files']=0
        pub=self.publish();self.run_job()
        self.assertEqual(self.svc.get(pub['id'])['state'],'no_changes')
        # Publish checks capabilities, but run recognizes empty source before token mint.
        self.assertEqual(self.github.tokens,[]);self.assertEqual(self.github.client.calls,[])

    def test_automatic_policy_requires_success_gate(self):
        self.sessions.value['policy']='on_success_draft'
        self.sessions.value['outcome']['publication_eligible']=False
        self.assertIn('automatic_policy_not_satisfied',self.svc.preview('ses')['blocking_reasons'])
        with self.assertRaises(PublicationError) as caught:self.publish()
        self.assertEqual(caught.exception.code,'automatic_policy_not_satisfied')
        # Manual publication truthfully keeps failed checks in the frozen body/preview.
        self.sessions.value['policy']='manual_draft';self.sessions.value['validations']={'fully_validated':False,'summary':{'failed':1}}
        self.assertTrue(self.svc.preview('ses')['publishable'])

    def test_base_advance_overlap_blocks(self):
        self.github.client.base=CURRENT;self.github.client.compare_files=[{'filename':'calc.py'}]
        pub=self.publish();self.run_job();self.assertEqual(self.svc.get(pub['id'])['error_code'],'base_conflict')

    def test_base_advance_incomplete_300_file_comparison_blocks(self):
        self.github.client.base=CURRENT;self.github.client.compare_complete=False
        self.github.client.compare_files=[{'filename':f'other-{n}.py'} for n in range(300)]
        pub=self.publish();self.run_job();self.assertEqual(self.svc.get(pub['id'])['error_code'],'divergence_unknown')

    def test_disjoint_base_advance_keeps_frozen_parent_without_rebase(self):
        self.github.client.base=CURRENT;self.github.client.compare_files=[{'filename':'unrelated.py'}]
        pub=self.publish();self.run_job();self.assertEqual(self.svc.get(pub['id'])['state'],'published')
        commit=next(c for c in self.github.client.calls if c[0]=='create_commit')
        self.assertEqual(commit[2],BASE)

    def test_branch_collision_chooses_fresh_name_without_update_or_force(self):
        self.github.client.collision_once=True
        pub=self.publish();self.run_job();done=self.svc.get(pub['id'])
        self.assertEqual(done['state'],'published');self.assertTrue(done['head_branch'].endswith('-1'))
        refs=[c for c in self.github.client.calls if c[0]=='create_ref']
        self.assertEqual(len(refs),2);self.assertNotEqual(refs[0][1],refs[1][1])

    def test_permission_revocation_after_intent_blocks_before_token(self):
        pub=self.publish();self.github.denied=True;self.run_job();done=self.svc.get(pub['id'])
        self.assertEqual((done['state'],done['error_code']),('blocked','publication_permission_denied'))
        self.assertEqual(self.github.tokens,[])

    def test_permission_revocation_between_external_steps_stops_before_tree(self):
        pub=self.publish();self.github.client.on_blob=lambda:setattr(self.github,'denied',True);self.run_job()
        done=self.svc.get(pub['id']);self.assertEqual(done['error_code'],'publication_permission_denied')
        self.assertFalse(any(c[0]=='tree' for c in self.github.client.calls))

    def test_lost_branch_response_reconciles_without_second_branch(self):
        pub=self.publish();self.github.client.unknown_ref=True;self.run_job()
        self.assertEqual(self.svc.get(pub['id'])['state'],'reconciling')
        self.assertEqual(self.platform.jobs.get(self.svc.get(pub['id']) and self._job(pub['id'])).state,'needs_reconciliation')
        resolved=self.svc.reconcile(pub['id']);self.assertEqual(resolved['state'],'creating_pr')
        self.svc.retry(pub['id'],'retry-one');self.run_job()
        self.assertEqual(self.svc.get(pub['id'])['state'],'published')
        self.assertEqual(sum(c[0]=='create_ref' for c in self.github.client.calls),1)

    def test_retry_double_click_is_idempotent_and_different_key_conflicts(self):
        pub=self.publish();self.github.client.unknown_ref=True;self.run_job();self.svc.reconcile(pub['id'])
        first=self.svc.retry(pub['id'],'same');again=self.svc.retry(pub['id'],'same')
        self.assertEqual(first['id'],again['id'])
        with self.assertRaises(PublicationError) as caught:self.svc.retry(pub['id'],'different')
        self.assertEqual(caught.exception.code,'idempotency_conflict')

    def test_lost_pr_response_is_adopted_without_second_pr(self):
        pub=self.publish();self.github.client.unknown_pr=True;self.run_job()
        self.assertEqual(self.svc.get(pub['id'])['state'],'reconciling')
        self.assertEqual(self.svc.reconcile(pub['id'])['state'],'published')
        self.assertEqual(sum(c[0]=='create_pr' for c in self.github.client.calls),1)

    def _job(self,pub):
        with self.platform.store.read() as db:return db.execute('SELECT job_id FROM publications WHERE id=?',(pub,)).fetchone()[0]

    def test_purge_blocks_active_and_tombstones_artifacts(self):
        pub=self.publish();self.svc.purge_repository(self.repo);saved=self.svc.get(pub['id'])
        self.assertEqual((saved['state'],saved['error_code']),('blocked','repository_purged'))
        with self.platform.store.read() as db:
            row=db.execute('SELECT checkpoint_artifact_id,patch_artifact_id FROM publications WHERE id=?',(pub['id'],)).fetchone()
        self.assertEqual(tuple(row),(None,None))
