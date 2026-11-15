"""Adapter boundary tests use real subprocesses, without model inference."""
import json
import os
from pathlib import Path
import socket
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from repoask.execution.adapter_process import run_stream
from repoask.execution.claude import AdapterError, ClaudeAdapter, TRUSTED_TOOLS


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        os.chmod(self.root, 0o700)
        self.sock = socket.socket(socket.AF_UNIX)
        self.sock.bind(str(self.root / 'broker.sock'))
        os.chmod(self.root / 'broker.sock', 0o600)
        self.addCleanup(self.sock.close)
        token = self.root / 'token'
        token.write_text('test-token')
        token.chmod(0o600)
        self.endpoint = {'socket_path': str(self.root / 'broker.sock'), 'token_file': str(token)}
        self.events = []
        self.ready = False

    def script(self, body):
        path = self.root / 'fake-cli'
        path.write_text('#!' + sys.executable + '\nimport sys, os, stat\n'
            'if "--print" in sys.argv or sys.argv[1:3] == ["--setting-sources", ""]:\n'
            ' assert os.listdir(".") == []\n'
            ' assert stat.S_IMODE(os.stat(".").st_mode) == 0o700\n'
            'metadata_args=sys.argv[1:]\n'
            'if metadata_args[:2] == ["--setting-sources", ""]: metadata_args=metadata_args[2:]\n'
            'if metadata_args == ["auth", "status"]:\n'
            ' print(\'{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty","subscriptionType":"pro"}\')\n'
            ' sys.exit(0)\n'
            'if metadata_args == ["plugin", "list", "--json"]:\n print("[]");sys.exit(0)\n'
            'if metadata_args == ["--version"]:\n print("2.1.311 (fixture)");sys.exit(0)\n' + body)
        path.chmod(0o700)
        return str(path)

    def init(self, tools=None):
        return {'type': 'system', 'subtype': 'init', 'tools': sorted(TRUSTED_TOOLS) if tools is None else tools,
                'mcp_servers': [{'name': 'opendevin', 'status': 'connected'}], 'model': 'inherited'}

    def mark_ready(self):
        self.ready = True

    def run_events(self, events, extra='', **kwargs):
        binary = self.script('import json, os, sys, time\n' +
                             '\n'.join('print(' + repr(json.dumps(e)) + ', flush=True)' for e in events) + '\n' + extra)
        kwargs.setdefault('stop_event', threading.Event())
        return ClaudeAdapter(claude_binary=binary).run(
            self.endpoint, 'Synthetic fixture task', auth_mode='cli_login', synthetic=True,
            emit=lambda k, v: self.events.append((k, v)), on_inventory_verified=self.mark_ready,
            **kwargs)

    def test_inventory_gates_readiness_and_thinking_is_discarded(self):
        result = self.run_events([self.init(), {'type': 'assistant', 'message': {'content': [
            {'type': 'thinking', 'thinking': 'PRIVATE REASONING'},
            {'type': 'text', 'text': 'Changed fixture'},
            {'type': 'tool_use', 'name': 'mcp__opendevin__write_file', 'input': {'content': 'PRIVATE SOURCE'}}]}},
            {'type': 'result', 'subtype': 'success', 'result': 'Ready'}])
        self.assertTrue(self.ready)
        self.assertEqual(result['status'], 'completed')
        self.assertTrue(result['stop_confirmed'])
        self.assertIsNone(result['usage'])
        self.assertIsNone(result['reported_cost_usd'])
        persisted = json.dumps(self.events)
        self.assertNotIn('PRIVATE', persisted)
        self.assertFalse(result['capabilities']['resume'])
        self.assertFalse(result['capabilities']['follow_up'])
        self.assertTrue(result['capabilities']['ask_user'])
        self.assertTrue(result['capabilities']['ask_user_requires_callback'])

    def test_additive_server_metadata_does_not_change_trusted_inventory(self):
        event = self.init()
        event['mcp_servers'][0]['scope'] = 'dynamic'
        result = self.run_events([event, {'type': 'result', 'subtype': 'success'}])
        self.assertEqual(result['status'], 'completed')
        self.assertTrue(self.ready)

    def test_extra_mcp_server_never_opens_gate(self):
        event = self.init()
        event['mcp_servers'].append({'name': 'untrusted', 'status': 'connected'})
        with self.assertRaisesRegex(AdapterError, 'unexpected_tool_inventory'):
            self.run_events([event])
        self.assertFalse(self.ready)

    def test_unexpected_inventory_never_opens_gate(self):
        with self.assertRaisesRegex(AdapterError, 'unexpected_tool_inventory'):
            self.run_events([self.init(sorted(TRUSTED_TOOLS) + ['Bash'])])
        self.assertFalse(self.ready)
        self.assertEqual([kind for kind, _ in self.events], ['adapter_inventory'])

    def test_result_before_init_rejected(self):
        with self.assertRaisesRegex(AdapterError, 'missing_initialization'):
            self.run_events([{'type': 'result', 'subtype': 'success'}])
        self.assertFalse(self.ready)

    def test_nonzero_exit_overrules_success_record(self):
        result = self.run_events([self.init(), {'type': 'result', 'subtype': 'success'}], 'sys.exit(3)')
        self.assertEqual(result['code'], 'cli_exit')
        self.assertEqual(result['exit_code'], 3)

    def test_budget_and_usage_are_reported_without_inventing_zero(self):
        result = self.run_events([self.init(), {'type': 'result', 'subtype': 'error_max_budget_usd',
            'is_error': True, 'usage': {'input_tokens': 5, 'output_tokens': -1}, 'total_cost_usd': 0.2}])
        self.assertEqual(result['code'], 'budget_exhausted')
        self.assertEqual(result['usage']['input_tokens'], 5)
        self.assertIsNone(result['usage']['output_tokens'])
        self.assertEqual(result['reported_cost_usd'], 0.2)

    def test_rate_limit_classification_discards_raw_error(self):
        result = self.run_events([self.init(), {'type': 'result', 'subtype': 'error_during_execution',
            'is_error': True, 'errors': ['Rate limit reached PRIVATE DIAGNOSTIC']}])
        self.assertEqual(result['code'], 'rate_limit')
        self.assertNotIn('PRIVATE', json.dumps(self.events))

    def test_launch_has_empty_trusted_cwd_and_no_host_credential_environment(self):
        check = '''
assert os.listdir('.') == []
assert os.environ.get('ANTHROPIC_API_KEY') is None
assert os.environ.get('NODE_OPTIONS') is None
assert '--tools' in sys.argv and sys.argv[sys.argv.index('--tools') + 1] == ''
for flag in ['--restricted', '--strict-mcp-config', '--no-session-persistence', '--disable-slash-commands']:
    assert flag in sys.argv
assert '--model' not in sys.argv and '--effort' not in sys.argv
assert sys.argv[sys.argv.index('--permission-prompts') + 1] == 'none'
'''
        # Assertions must precede the synthetic result so failures cannot be hidden.
        binary = self.script('import os, sys\n' + check + '\nprint(' + repr(json.dumps(self.init())) + ')\nprint(' +
                             repr(json.dumps({'type': 'result', 'subtype': 'success'})) + ')\n')
        with patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'do-not-copy', 'NODE_OPTIONS': 'do-not-run'}):
            result = ClaudeAdapter(claude_binary=binary).run(self.endpoint, 'fixture', auth_mode='cli_login', synthetic=True,
                on_inventory_verified=self.mark_ready, emit=lambda *_: None, stop_event=threading.Event())
        self.assertEqual(result['status'], 'completed')

    def test_real_source_requires_consent_and_local_only_off_before_spawn(self):
        adapter = ClaudeAdapter(claude_binary=sys.executable)
        for kwargs in ({}, {'local_only': False}, {'external_source_consent': True}):
            with self.assertRaisesRegex(AdapterError, 'external_source_denied'):
                adapter.run({}, 'source', auth_mode='cli_login', on_inventory_verified=lambda: None,
                            emit=lambda *_: None, stop_event=threading.Event(), **kwargs)

    def test_managed_policy_rejected_before_process_start(self):
        with patch('repoask.execution.claude.os.path.lexists', return_value=True):
            with self.assertRaisesRegex(AdapterError, 'unsupported_managed_policy'):
                self.run_events([])

    def test_managed_auth_profile_rejected(self):
        binary = self.script('')
        adapter = ClaudeAdapter(claude_binary=binary)
        from repoask.execution.adapter_process import ProcessOutcome
        def status(*args, **kwargs):
            kwargs['on_line'](b'{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty","subscriptionType":"enterprise"}')
            return ProcessOutcome(0, 'exited', True, 120)
        with patch('repoask.execution.claude.run_stream', side_effect=status):
            with self.assertRaisesRegex(AdapterError, 'unsupported_auth_profile'):
                adapter._check_auth_profile()

    def test_customization_inventory_rejected(self):
        event = self.init()
        event['plugins'] = [{'name': 'untrusted'}]
        with self.assertRaisesRegex(AdapterError, 'unexpected_customization'):
            self.run_events([event])
        self.assertFalse(self.ready)

    def test_unsafe_broker_endpoint_rejected(self):
        Path(self.endpoint['token_file']).chmod(0o644)
        with self.assertRaisesRegex(AdapterError, 'invalid_broker_endpoint'):
            self.run_events([])

    def test_timeout_and_cancel_stop_real_process(self):
        result = self.run_events([self.init()], 'time.sleep(10)', timeout_seconds=0.15)
        self.assertEqual(result['code'], 'timeout')
        self.assertTrue(result['stop_confirmed'])
        stop = threading.Event()
        timer = threading.Timer(0.15, stop.set)
        timer.start()
        self.addCleanup(timer.cancel)
        start = time.monotonic()
        result = self.run_events([self.init()], 'time.sleep(10)', stop_event=stop)
        self.assertEqual(result['status'], 'cancelled')
        self.assertTrue(result['stop_confirmed'])
        self.assertLess(time.monotonic() - start, 2)

    def test_output_cap_includes_stderr_without_unbounded_buffer(self):
        result = self.run_events([self.init()], "sys.stderr.write('x' * 100000);sys.stderr.flush();time.sleep(10)", max_output_bytes=1024)
        self.assertEqual(result['code'], 'output_limit')
        self.assertTrue(result['stop_confirmed'])

    def test_callback_failure_kills_real_descendant_before_raising(self):
        pidfile = self.root / 'child.pid'
        body = ('import subprocess, sys, time\n'
                'p = subprocess.Popen([sys.executable, "-c", "import time;time.sleep(30)"])\n'
                'open(' + repr(str(pidfile)) + ', "w").write(str(p.pid))\n'
                'print("bad output", flush=True)\ntime.sleep(30)\n')
        binary = self.script(body)
        def reject(_):
            raise ValueError('reject')
        with self.assertRaisesRegex(ValueError, 'reject'):
            run_stream([binary], cwd=str(self.root), env={'PATH': os.environ['PATH']},
                on_line=reject, timeout_seconds=5, max_output_bytes=1024)
        pid = int(pidfile.read_text())
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)


    def test_supervision_setup_failure_contains_started_process(self):
        import subprocess
        from repoask.execution.adapter_process import ProcessContainmentError
        original = subprocess.Popen
        started = []
        def spawn(*args, **kwargs):
            process = original(*args, **kwargs)
            started.append(process)
            return process
        stop = threading.Event()
        with patch('repoask.execution.adapter_process.subprocess.Popen', side_effect=spawn), patch(
                'repoask.execution.adapter_process._LeaderExit', side_effect=OSError('no supervision')):
            with self.assertRaisesRegex(ProcessContainmentError, 'supervision_unavailable'):
                run_stream([sys.executable, '-c', 'import time;time.sleep(10)'], cwd=str(self.root),
                           env={}, on_line=lambda _: None, timeout_seconds=5, max_output_bytes=1024,
                           stop_event=stop)
        self.assertTrue(stop.is_set())
        self.assertIsNotNone(started[0].returncode)
        with self.assertRaises(ProcessLookupError):
            os.kill(started[0].pid, 0)

    def test_shared_stop_gate_closes_on_internal_timeout(self):
        stop = threading.Event()
        result = self.run_events([self.init()], 'time.sleep(10)', timeout_seconds=0.1, stop_event=stop)
        self.assertEqual(result['code'], 'timeout')
        self.assertTrue(stop.is_set())

    def test_redirected_descendant_is_stopped_after_leader_exit(self):
        pidfile = self.root / 'redirected.pid'
        binary = self.script('import subprocess, sys\n'
            'p=subprocess.Popen([sys.executable,"-c","import time;time.sleep(30)"], '
            'stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)\n'
            'open(' + repr(str(pidfile)) + ',"w").write(str(p.pid))\n')
        outcome = run_stream([binary], cwd=str(self.root), env={'PATH': os.environ['PATH']},
                            on_line=lambda _: None, timeout_seconds=5, max_output_bytes=1024)
        self.assertTrue(outcome.stop_confirmed)
        with self.assertRaises(ProcessLookupError):
            os.kill(int(pidfile.read_text()), 0)

    def test_stop_before_launch_does_not_start_process(self):
        stop = threading.Event()
        stop.set()
        outcome = run_stream(['/does/not/exist'], cwd=str(self.root), env={}, on_line=lambda _: None,
                            timeout_seconds=5, max_output_bytes=1024, stop_event=stop)
        self.assertEqual(outcome.reason, 'cancelled')
        self.assertIsNone(outcome.exit_code)

    def test_no_completed_event_emitted_for_nonzero_cli_exit(self):
        self.run_events([self.init(), {'type': 'result', 'subtype': 'success'}], 'sys.exit(3)')
        results = [payload for kind, payload in self.events if kind == 'adapter_result']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['status'], 'failed')



    def test_success_sets_shared_event(self):
        stop = threading.Event()
        result = self.run_events([self.init(), {'type': 'result', 'subtype': 'success'}], stop_event=stop)
        self.assertEqual(result['status'], 'completed')
        self.assertTrue(stop.is_set())

    def test_invalid_or_missing_stop_event_is_stable_error(self):
        adapter = ClaudeAdapter(claude_binary=sys.executable)
        for value in (None, object(), False):
            with self.subTest(value=type(value).__name__):
                with self.assertRaisesRegex(AdapterError, 'invalid_stop_event'):
                    adapter.run({}, 'fixture', auth_mode='cli_login', synthetic=True,
                                on_inventory_verified=lambda: None, emit=lambda *_: None, stop_event=value)

    def test_prelaunch_policy_and_argument_errors_close_event_without_spawning(self):
        adapter = ClaudeAdapter(claude_binary=sys.executable)
        cases = [
            ({'auth_mode': 'api_key'}, 'unsupported_auth_mode'),
            ({'synthetic': 'false'}, 'invalid_source_policy'),
            ({'synthetic': False}, 'external_source_denied'),
            ({'prompt': ''}, 'invalid_prompt'),
            ({'prompt': '\ud800'}, 'invalid_prompt'),
            ({'max_turns': 0}, 'invalid_limits'),
            ({'max_budget_usd': float('nan')}, 'invalid_limits'),
            ({'timeout_seconds': 0}, 'invalid_limits'),
            ({'max_output_bytes': 1}, 'invalid_limits'),
        ]
        for changes, code in cases:
            with self.subTest(code=code, changed=next(iter(changes))):
                stop = threading.Event()
                kwargs = dict(endpoint={}, prompt='fixture', auth_mode='cli_login', synthetic=True,
                              on_inventory_verified=lambda: None, emit=lambda *_: None, stop_event=stop)
                kwargs.update(changes)
                with patch('repoask.execution.claude.run_stream') as process:
                    with self.assertRaisesRegex(AdapterError, code):
                        adapter.run(**kwargs)
                    process.assert_not_called()
                self.assertTrue(stop.is_set())

    def test_prelaunch_dependency_errors_close_event(self):
        adapter = ClaudeAdapter(claude_binary=self.script(''))
        cases = [('_check_policy', 'unsupported_managed_policy'),
                 ('_check_auth_profile', 'authentication_required'),
                 ('_check_auth_profile', 'authentication_unverified'),
                 ('_check_auth_profile', 'unsupported_auth_profile'),
                 ('_disabled_plugins', 'customization_unverified'),
                 ('_endpoint', 'invalid_broker_endpoint')]
        for method, code in cases:
            with self.subTest(code=code):
                stop = threading.Event()
                with patch.object(adapter, method, side_effect=AdapterError(code)):
                    with self.assertRaisesRegex(AdapterError, code):
                        adapter.run(self.endpoint, 'fixture', auth_mode='cli_login', synthetic=True,
                                    on_inventory_verified=lambda: None, emit=lambda *_: None, stop_event=stop)
                self.assertTrue(stop.is_set())

    def test_spawn_and_helper_limit_errors_are_stable_and_close_event(self):
        adapter = ClaudeAdapter(claude_binary=self.script(''))
        for error, code in ((OSError('private diagnostic'), 'cli_unavailable'),
                            (ValueError('private diagnostic'), 'invalid_limits')):
            with self.subTest(code=code):
                stop = threading.Event()
                with patch.object(adapter, '_check_auth_profile'), patch.object(adapter, '_disabled_plugins', return_value={}), patch(
                        'repoask.execution.claude.run_stream', side_effect=error):
                    with self.assertRaisesRegex(AdapterError, code):
                        adapter.run(self.endpoint, 'fixture', auth_mode='cli_login', synthetic=True,
                                    on_inventory_verified=lambda: None, emit=lambda *_: None, stop_event=stop)
                self.assertTrue(stop.is_set())

    def test_actual_popen_failure_is_stable_and_closes_event(self):
        adapter = ClaudeAdapter(claude_binary=self.script(''))
        stop = threading.Event()
        with patch.object(adapter, '_check_auth_profile'), patch.object(adapter, '_disabled_plugins', return_value={}), patch(
                'repoask.execution.adapter_process.subprocess.Popen', side_effect=FileNotFoundError('private diagnostic')):
            with self.assertRaisesRegex(AdapterError, 'cli_unavailable'):
                adapter.run(self.endpoint, 'fixture', auth_mode='cli_login', synthetic=True,
                            on_inventory_verified=lambda: None, emit=lambda *_: None, stop_event=stop)
        self.assertTrue(stop.is_set())

    def test_prompt_is_private_finite_stdin_not_argv_or_environment(self):
        prompt = 'PRIVATE_SOURCE_MARKER_' + 'x' * 12000
        body = ('import json, os, sys, stat\n'
                'assert "PRIVATE_SOURCE_MARKER_" not in " ".join(sys.argv)\n'
                'assert "PRIVATE_SOURCE_MARKER_" not in " ".join(os.environ.values())\n'
                'assert stat.S_ISREG(os.fstat(0).st_mode)\n'
                'assert stat.S_IMODE(os.fstat(0).st_mode) == 0o600\n'
                'assert sys.stdin.read() == ' + repr(prompt) + '\n'
                'print(' + repr(json.dumps(self.init())) + ')\n'
                'print(' + repr(json.dumps({'type': 'result', 'subtype': 'success'})) + ')\n')
        stop = threading.Event()
        result = ClaudeAdapter(claude_binary=self.script(body)).run(self.endpoint, prompt,
            auth_mode='cli_login', synthetic=True, on_inventory_verified=self.mark_ready,
            emit=lambda *_: None, stop_event=stop)
        self.assertEqual(result['status'], 'completed')
        self.assertTrue(stop.is_set())

    def test_metadata_queries_use_fresh_private_empty_directories(self):
        # The fixture asserts empty cwd/mode before answering every command.
        adapter = ClaudeAdapter(claude_binary=self.script('raise AssertionError("unexpected inference")'))
        actual = __import__('repoask.execution.claude', fromlist=['run_stream']).run_stream
        directories = []
        def observe(*args, **kwargs):
            directories.append(kwargs['cwd'])
            self.assertNotEqual(kwargs['cwd'], tempfile.gettempdir())
            return actual(*args, **kwargs)
        with patch('repoask.execution.claude.run_stream', side_effect=observe):
            result = adapter.preflight()
        self.assertTrue(result['available'])
        self.assertEqual(len(directories), 3)
        self.assertEqual(len(set(directories)), 3)
        self.assertTrue(all(not Path(path).exists() for path in directories))

    def test_unexpected_init_influence_fields_do_not_open_gate(self):
        for field, value in [('skills', ['custom']), ('agents', ['custom']), ('output_style', 'explanatory')]:
            with self.subTest(field=field):
                event = self.init()
                event[field] = value
                self.ready = False
                with self.assertRaisesRegex(AdapterError, 'unexpected_customization'):
                    self.run_events([event])
                self.assertFalse(self.ready)


if __name__ == '__main__':
    unittest.main()
