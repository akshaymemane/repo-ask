"""Verify real service composition, durable background execution and stop ownership."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event
import time
from unittest import TestCase
from repoask.platform import Platform
from repoask.services import ApplicationServices


class ApplicationServiceTests(TestCase):
    def test_profile_http_adapter_persists_versions_and_roles_across_restart(self):
        with TemporaryDirectory() as directory:
            platform = Platform.open(Path(directory))
            services = ApplicationServices(platform)
            profile = services.api.dispatch('POST', '/api/provider-profiles', body={
                'name': 'Local chat', 'adapter': 'ollama', 'endpoint': 'http://127.0.0.1:11434',
                'model': 'synthetic', 'config': {'capabilities': ['chat']}}).body
            roles = services.api.dispatch('PATCH', '/api/settings/model-roles', body={
                'assignments': {'ask': profile['id']}}).body
            self.assertEqual(roles['roles']['ask']['status'], 'untested')
            platform.close()
            platform = Platform.open(Path(directory))
            try:
                services = ApplicationServices(platform)
                saved = services.api.dispatch('GET', '/api/provider-profiles').body['profiles']
                self.assertEqual(saved[0]['active_version_id'], profile['active_version_id'])
                self.assertEqual(services.providers.roles()['ask']['profile_id'], profile['id'])
                self.assertEqual(services.github.connections(), [])
            finally:
                platform.close()

    def test_background_worker_executes_durable_handler_and_joins_before_store_close(self):
        platform = Platform.open(None)
        self.addCleanup(platform.close)
        services = ApplicationServices(platform)
        seen = Event()
        services.github.register_purge_hook('test-context', lambda repository_id: seen.set())
        with platform.store.transaction() as conn:
            conn.execute("INSERT INTO repositories(id,github_id,owner,name,full_name,default_branch,visibility,clone_url,created_at,updated_at) VALUES('gh:123',123,'test','repo','test/repo','main','private','https://github.com/test/repo.git',1,1)")
        job = platform.jobs.enqueue('github.purge', {'repository_id': 'gh:123'})
        services.start()
        try:
            self.assertTrue(seen.wait(3), 'background handler did not execute')
            deadline = time.monotonic() + 3
            while platform.jobs.get(job.id).state != 'succeeded' and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertEqual(platform.jobs.get(job.id).state, 'succeeded')
        finally:
            services.close()
        self.assertFalse(services.running)
        self.assertFalse(services.thread.is_alive())
        self.assertEqual(services.error_code, None)

    def test_github_validation_maps_to_safe_http_status(self):
        from repoask.api import error_status
        self.assertEqual(error_status('validation'), 400)
        self.assertEqual(error_status('auth'), 409)
