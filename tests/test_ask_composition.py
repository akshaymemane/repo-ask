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
