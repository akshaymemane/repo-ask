"""F04 AC6: live launch freshness decisions and durable retries."""
import threading
import time
from unittest.mock import patch

from repoask.session_api import ExecutionAPI
from repoask.sessions import SessionError
from test_sessions_fixture import SessionCase


class LaunchFreshnessTests(SessionCase):
    def launch(self, version, key='freshness', **kwargs):
        return self.sessions.launch(version['id'], version['content_hash'], key, **kwargs)

    def test_equal_head_proceeds_and_pins(self):
        _, version = self.ready_plan()
        with patch.object(self.github.client, 'default_branch_sha', return_value='c' * 40):
            result = self.launch(version)
        session = self.sessions.get(result['session_id'])
        self.assertEqual(session['repositories'][0]['base_sha'], 'c' * 40)
        self.assertEqual(session['instructions']['base_observation']['status'], 'current')
        self.assertEqual(session['instructions']['acknowledged_base'], {})

    def test_advanced_rejection_survives_new_head_and_service_restart(self):
        _, version = self.ready_plan()
        with patch.object(self.github.client, 'default_branch_sha', return_value='d' * 40):
            with self.assertRaises(SessionError) as caught:
                self.launch(version)
        error = caught.exception
        self.assertEqual(error.code, 'base_advanced')
        self.assertEqual(error.details[0]['current_head'], 'd' * 40)
        with self.store.read() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM sessions').fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT count(*) FROM jobs WHERE kind='session.run'").fetchone()[0], 0)
        other = self.make_service()
        with patch.object(self.github.client, 'default_branch_sha', side_effect=AssertionError('must not observe twice')):
            with self.assertRaises(SessionError) as repeated:
                other.launch(version['id'], version['content_hash'], 'freshness')
        self.assertEqual(repeated.exception.details, error.details)
        ack = {self.repo: 'c' * 40}
        result = self.launch(version, acknowledged_base=ack)
        self.assertEqual(self.sessions.get(result['session_id'])['instructions']['acknowledged_base'], ack)
        self.assertEqual(self.launch(version, acknowledged_base=ack), result)
        with self.assertRaises(SessionError) as original:
            self.launch(version)
        self.assertEqual(original.exception.details, error.details)

    def test_unobservable_head_proceeds_and_records(self):
        _, version = self.ready_plan()
        with patch.object(self.github.client, 'default_branch_sha', side_effect=TimeoutError):
            result = self.launch(version)
        instructions = self.sessions.get(result['session_id'])['instructions']
        self.assertEqual(instructions['base_observation']['status'], 'unavailable')
        self.assertIsNone(instructions['base_observation']['current_head'])
        with patch.object(self.github.client, 'default_branch_sha', return_value='e' * 40) as lookup:
            self.assertEqual(self.launch(version), result)
            lookup.assert_not_called()

    def test_slow_observation_is_bounded(self):
        _, version = self.ready_plan()
        release = threading.Event()
        def slow(*args):
            release.wait(5)
            return 'd' * 40
        try:
            with patch.object(self.github.client, 'default_branch_sha', side_effect=slow):
                started = time.monotonic()
                result = self.launch(version)
                self.assertLess(time.monotonic() - started, 3)
                self.assertEqual(self.sessions.get(result['session_id'])['instructions']['base_observation']['status'], 'unavailable')
        finally:
            release.set()

    def test_api_409_shape_and_acknowledged_creation(self):
        _, version = self.ready_plan()
        api = ExecutionAPI(sessions=self.sessions)
        body = dict(plan_version_id=version['id'], content_hash=version['content_hash'], idempotency_key='api-fresh')
        with patch.object(self.github.client, 'default_branch_sha', return_value='d' * 40):
            response = api.dispatch('POST', '/api/sessions', body=body)
        self.assertEqual(response.status, 409)
        self.assertEqual(response.body['code'], 'base_advanced')
        self.assertEqual(response.body['details'][0], dict(repository_id=self.repo, pinned_revision='c' * 40, current_head='d' * 40, status='advanced'))
        response = api.dispatch('POST', '/api/sessions', body=dict(body, acknowledged_base={self.repo: 'c' * 40}))
        self.assertEqual(response.status, 202)

    def test_wrong_ack_does_not_authorize_another_base(self):
        _, version = self.ready_plan()
        with self.assertRaises(SessionError) as caught:
            self.launch(version, acknowledged_base={self.repo: 'd' * 40})
        self.assertEqual(caught.exception.code, 'validation')
