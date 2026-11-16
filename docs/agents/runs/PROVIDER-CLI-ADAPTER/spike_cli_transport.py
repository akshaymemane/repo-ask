"""Spike: answer the provider service's OpenAI-compatible chat requests with the
Claude Code CLI on the user's own login, then run the M1 plan evaluation through
the real Ask stack. Synthetic bundled examples only.

    PYTHONPATH=.:tests .venv/bin/python docs/agents/runs/PROVIDER-CLI-ADAPTER/spike_cli_transport.py

Not product code. The flags mirror the session adapter's restricted invocation,
with no tools and no MCP servers: the CLI can only return text.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

import plan_evaluation
from repoask.providers import TransportResponse

HERE = Path(__file__).resolve().parent
ENV_NAMES = ('PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL')
SETTINGS = {'disableAllHooks': True, 'autoMemoryEnabled': False, 'claudeMdExcludes': ['**'],
            'syncClaudeAiSkills': False, 'syncClaudeAiPlugins': False}


class ClaudeCliTransport:
    """Duck-typed provider transport: OpenAI chat body in, OpenAI chat response out."""

    def __init__(self, binary=None, model=None):
        self.binary = binary or shutil.which('claude')
        self.model = model
        self.calls = []

    def send(self, request, *, cancel_event=None):
        body = json.loads(request.body)
        messages = body['messages']
        system = '\n\n'.join(m['content'] for m in messages if m['role'] == 'system')
        # The conversation (evidence, request, any repair turn) goes on stdin, never argv.
        turns = [m for m in messages if m['role'] != 'system']
        stdin = turns[0]['content'] if len(turns) == 1 else '\n\n'.join(
            f"[{m['role']}]\n{m['content']}" for m in turns)
        schema = ((body.get('response_format') or {}).get('json_schema') or {}).get('schema')
        argv = [self.binary, '--print', '--output-format', 'json', '--restricted', '--tools', '',
                '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--disable-slash-commands',
                '--setting-sources', '', '--settings', json.dumps(SETTINGS), '--no-session-persistence',
                '--no-chrome', '--permission-mode', 'dontAsk', '--system-prompt', system]
        if schema is not None:
            argv += ['--json-schema', json.dumps(schema)]
        if self.model:
            argv += ['--model', self.model]
        env = {k: os.environ[k] for k in ENV_NAMES if k in os.environ}
        env.update(DISABLE_AUTOUPDATER='1', DISABLE_TELEMETRY='1', DISABLE_ERROR_REPORTING='1',
                   CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1', CLAUDE_CODE_DISABLE_AUTO_MEMORY='1')
        started = time.monotonic()
        with tempfile.TemporaryDirectory(prefix='opendevin-cli-spike-') as cwd:
            try:
                done = subprocess.run(argv, input=stdin.encode(), capture_output=True, cwd=cwd, env=env,
                                      timeout=request.timeout, start_new_session=True)
            except subprocess.TimeoutExpired:
                self.calls.append({'status': 'timeout', 'seconds': round(time.monotonic() - started, 2)})
                return TransportResponse(504, {}, b'{"error":{"code":"timeout"}}')
        seconds = round(time.monotonic() - started, 2)
        try:
            result = json.loads(done.stdout)
        except ValueError:
            self.calls.append({'status': 'unparsable', 'exit': done.returncode, 'seconds': seconds})
            return TransportResponse(502, {}, b'{"error":{"code":"cli_output"}}')
        usage = result.get('usage') or {}
        record = {'status': result.get('subtype'), 'exit': done.returncode, 'seconds': seconds,
                  'turns': result.get('num_turns'), 'reported_cost_usd': result.get('total_cost_usd'),
                  'models': sorted((result.get('modelUsage') or {}).keys()),
                  'structured': result.get('structured_output') is not None,
                  'permission_denials': len(result.get('permission_denials') or [])}
        self.calls.append(record)
        if result.get('is_error') or result.get('subtype') != 'success':
            return TransportResponse(502, {}, b'{"error":{"code":"cli_error"}}')
        content = json.dumps(result['structured_output']) if result.get('structured_output') is not None else result.get('result', '')
        payload = {'choices': [{'message': {'content': content}, 'finish_reason': 'stop'}],
                   'usage': {'prompt_tokens': (usage.get('input_tokens') or 0) + (usage.get('cache_read_input_tokens') or 0)
                             + (usage.get('cache_creation_input_tokens') or 0),
                             'completion_tokens': usage.get('output_tokens')}}
        return TransportResponse(200, {}, json.dumps(payload).encode())


def main():
    transport = ClaudeCliTransport(model=os.environ.get('SPIKE_MODEL'))
    spec = {'name': 'Claude CLI spike', 'adapter': 'openai_compatible', 'endpoint': 'https://claude-cli.invalid/v1',
            'model': 'claude-cli', 'config': {'capabilities': ['chat', 'structured_output'], 'context_limit': 32768,
                                              'max_output_tokens': 8192, 'timeout_seconds': 180,
                                              'allow_external_source': True}}

    def log(r):
        failed = [k for k, v in r['checks'].items() if not v]
        print(f"{'PASS' if r['passed'] else 'FAIL'} {r['id']:<16} {r['run_state']:<9} "
              f"{r['error_code'] or '':<18} {r['seconds']:>6}s {' '.join(failed)}", flush=True)

    report = plan_evaluation.evaluate(spec, None, provider_transport=transport, log=log, task_timeout=600)
    report['cli_calls'] = transport.calls
    report['cli'] = subprocess.run([transport.binary, '--version'], capture_output=True, text=True).stdout.strip()
    out = HERE / f"claude-cli-{os.environ.get('SPIKE_MODEL') or 'opus'}-plan-eval.json"
    out.write_text(json.dumps(report, indent=1, sort_keys=True) + '\n')
    secs = [c['seconds'] for c in transport.calls]
    print(f"passed {report['passed']}/{report['total']}, valid {report['valid_output']}/{report['total']}, "
          f"gate {'PASSED' if report['gate_passed'] else 'FAILED'}; {len(secs)} CLI calls, "
          f"median {sorted(secs)[len(secs)//2]}s, max {max(secs)}s")
    return 0 if report['gate_passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
