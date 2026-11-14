"""Real composed APIs persist saved conversations with context workers enabled."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from repoask.platform import Platform
from repoask.services import ApplicationServices
from repoask.indexing import IndexService
from repoask.ask import RoutingService,PlanService,ConversationService
from repoask.__main__ import ASSETS

class AskCompositionTests(TestCase):
    def test_public_saved_ask_survives_application_restart(self):
        self.assertEqual(ASSETS['/ask.js'][0],'ask.js')
        with TemporaryDirectory() as directory:
            conversation_id=None
            for restart in (False,True):
                platform=Platform.open(Path(directory));services=ApplicationServices(platform)
                try:
                    index=IndexService(platform.store,platform.jobs,services.github,services.providers)
                    services.enable_context(index)
                    routing=RoutingService(platform.store,index)
                    plans=PlanService(platform.store,index,services.providers)
                    conversations=ConversationService(platform.store,platform.jobs,index,services.providers,routing,plans)
                    services.enable_ask(routing,plans,conversations)
                    self.assertIn('index.run',services.handlers)
                    self.assertIn('ask.answer',services.handlers)
                    if not restart:
                        result=services.api.dispatch('POST','/api/conversations',body={'title':'Saved end-to-end setup'})
                        self.assertEqual(result.status,201);conversation_id=result.body['id']
                    else:
                        saved=services.api.dispatch('GET','/api/conversations/'+conversation_id).body
                        self.assertEqual(saved['title'],'Saved end-to-end setup')
                        self.assertEqual(saved['messages'],[])
                finally:
                    services.close();platform.close()


    def test_cli_model_seeds_missing_roles_without_inference_or_overwriting_saved_choices(self):
        import json,socket,subprocess,sys,time,urllib.request
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with TemporaryDirectory() as directory:
            for model in ('first-cli-model','replacement-cli-model'):
                with socket.socket() as listener:
                    listener.bind(('127.0.0.1',0));port=listener.getsockname()[1]
                process=subprocess.Popen([sys.executable,'-m','repoask','--data-dir',directory,'--port',str(port),'--model',model],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                try:
                    deadline=time.monotonic()+15
                    while True:
                        try:
                            with opener.open(f'http://127.0.0.1:{port}/api/settings/model-roles',timeout=1) as response:
                                roles=json.load(response)['roles']
                            break
                        except OSError:
                            if process.poll() is not None or time.monotonic()>deadline:
                                self.fail('CLI did not serve saved Ask')
                            time.sleep(.05)
                    self.assertEqual(roles['ask']['model'],'first-cli-model')
                    self.assertEqual(roles['planning']['model'],'first-cli-model')
                    self.assertEqual(roles['ask']['profile_id'],roles['planning']['profile_id'])
                    with opener.open(f'http://127.0.0.1:{port}/ask.js',timeout=1) as response:
                        self.assertIn(b'createAskPanel',response.read())
                finally:
                    process.terminate()
                    try:process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill();process.wait();self.fail('CLI did not stop')
