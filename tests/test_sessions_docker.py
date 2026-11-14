"""Opt-in real Docker session checks: OPENDEVIN_SESSION_DOCKER=1 and a local cached image.

Uses the real DockerRunner (no pulls), real broker and the scripted agent (no model).
Proves container provisioning from pinned GitHub-API source, in-container validation,
real stop/containment timing and owned-container cleanup on this host only.
"""
import os
import secrets
import time
import unittest

from repoask.execution.runner import DockerRunner, RunnerError
from test_sessions_fixture import SessionCase

IMAGE = os.environ.get('OPENDEVIN_SESSION_DOCKER_IMAGE', 'python:3.12-slim')


@unittest.skipUnless(os.environ.get('OPENDEVIN_SESSION_DOCKER') == '1', 'set OPENDEVIN_SESSION_DOCKER=1 to run real Docker checks')
class DockerSessionTests(SessionCase):
    def setUp(self):
        super().setUp()
        try:
            probe = DockerRunner('sessions-probe-' + secrets.token_hex(3)).preflight(IMAGE)
        except RunnerError as exc:
            self.skipTest('docker unavailable: ' + exc.code)
        if probe['blocking_reasons']:
            self.skipTest('docker image unavailable: ' + ','.join(probe['blocking_reasons']))
        self.image_id = probe['image_id']
        self.profiles.version['config']['image'] = IMAGE
        self.profiles.version['check']['image_id'] = self.image_id
        from repoask.sessions import SessionService
        from test_sessions_fixture import ScriptedAgent
        self.runners = []

        def factory(instance_id):
            runner = DockerRunner(instance_id)
            self.runners.append(runner)
            return runner
        self.sessions = SessionService(self.platform, self.index, self.github, self.providers, self.plans, self.profiles,
                                       runner_factory=factory, adapter_factory=lambda: ScriptedAgent(self.world),
                                       lease_ms=10000, poll_interval=0.05)
        self.addCleanup(self.sessions.close)
        self.plans.execution_preflight = self.sessions.preflight
        self.addCleanup(self.assert_no_owned)

    def assert_no_owned(self):
        runner = DockerRunner(self.sessions.instance_id())
        leftover = runner.list_owned()
        for handle in leftover:
            runner.stop(handle)
            runner.discard(handle)
        self.assertEqual(leftover, [])

    def test_real_container_session_validation_and_diff(self):
        self.world.script = [('read_file', {'path': 'calc.py'}),
                             ('write_file', {'path': 'calc.py', 'content': 'def add(a, b):\n    return a + b\n'}),
                             ('run_command', {'argv': ['python', 'test_calc.py']})]
        _, version = self.ready_plan(validation=[
            {'command': 'python test_calc.py', 'expected': 'passes', 'source': 'proposed', 'citation_ids': []},
            {'command': 'curl https://example.com', 'expected': 'n/a', 'source': 'proposed', 'citation_ids': []}])
        self.sessions.start()
        sid = self.sessions.launch(version['id'], version['content_hash'], 'k-docker')['session_id']
        final = self.wait_state(sid, timeout=180)
        self.assertEqual(final['state'], 'completed', final)
        statuses = [v['status'] for v in self.sessions.validations(sid)['items']]
        self.assertEqual(statuses, ['passed', 'unavailable'])
        self.assertIn('+    return a + b', self.sessions.diff(sid)['files'][0]['diff'])
        self.assertTrue(final['outcome']['containment']['confirmed'])

    def test_real_container_stop_timing(self):
        self.world.script = ['hang']
        _, version = self.ready_plan()
        self.sessions.start()
        sid = self.sessions.launch(version['id'], version['content_hash'], 'k-docker-stop')['session_id']
        self.wait(lambda: self.world.runs, timeout=120, message='agent start')
        started = time.monotonic()
        self.assertEqual(self.sessions.stop(sid)['state'], 'stopping')
        ack = time.monotonic() - started
        final = self.wait_state(sid, timeout=30)
        total = time.monotonic() - started
        self.assertLess(ack, 2.0)
        self.assertLess(total, 10.0)
        self.assertEqual((final['state'], final['runner']['containment']), ('cancelled', 'confirmed'))
        print('docker stop ack_s=%.3f contained_s=%.3f container_ms=%s' % (
            ack, total, final['outcome']['containment']['container_elapsed_ms']))


if __name__ == '__main__':
    unittest.main()
