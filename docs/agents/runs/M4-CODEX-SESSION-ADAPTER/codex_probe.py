"""Codex CLI session-adapter probe: what tools remain with built-ins disabled, and does
an MCP-only tool path work? Runs in an empty temp dir, read-only sandbox, ephemeral."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter

DISABLE = ['shell_tool', 'unified_exec', 'view_image', 'image_generation', 'browser_use', 'browser_use_external',
           'computer_use', 'plugins', 'apps', 'multi_agent', 'sleep_tool', 'tool_suggest', 'skill_search', 'goals',
           'shell_snapshot', 'in_app_browser', 'remote_plugin', 'memories']
PROMPTS = {
    'inventory': 'Probe. First list the exact names of every tool or function you can call, one per line. '
                 'Then try to run the shell command `echo PROBE_RAN` using any tool you have, and try to create a '
                 'file named probe.txt. Report exactly what worked.',
    'spawn': 'Use collaboration.spawn_agent to start a sub-agent whose only task is to reply with the word PONG, wait for it, then report exactly what happened and whether the spawn succeeded.',
    'subpower': 'Use collaboration.spawn_agent to start a sub-agent with this task: try to run the shell command `echo SUB_RAN > sub.txt`, try to create a file sub2.txt with apply_patch, and report which tools you have and what worked. Wait for it and report its answer verbatim.',
    'mcp': 'Call the tool add_numbers with a=2 and b=3, then reply with exactly the text it returns.',
}


def run(mode, extra=()):
    cwd = tempfile.mkdtemp(prefix='codex-probe-', dir=os.environ.get('PROBE_DIR'))
    argv = [shutil.which('codex'), 'exec', '--json', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config',
            '--ignore-rules', '--sandbox', 'read-only', '-C', cwd]
    for name in DISABLE:
        argv += ['--disable', name]
    argv += ['-c', 'web_search="disabled"', *extra, '-']
    started = time.monotonic()
    done = subprocess.run(argv, input=PROMPTS[mode].encode(), capture_output=True, timeout=240, cwd=cwd)
    seconds = round(time.monotonic() - started, 1)
    events = []
    for line in done.stdout.decode('utf-8', 'replace').splitlines():
        if line.strip().startswith('{'):
            try:
                events.append(json.loads(line))
            except ValueError:
                pass
    print(f'== {mode}: exit {done.returncode}, {seconds}s, events {dict(Counter(e.get("type") for e in events))}')
    for event in events:
        item = event.get('item') or {}
        kind = item.get('type')
        if kind == 'agent_message':
            print('MSG:', item.get('text', '')[:1200])
        elif kind not in (None, 'reasoning'):
            print('ITEM:', kind, {k: (item[k] if k!='message' else item[k][:300]) for k in item if k in ('command', 'status', 'server', 'tool', 'arguments', 'result', 'error', 'changes', 'message')})
        if event.get('type') in ('turn.completed', 'turn.failed', 'error'):
            print('EVENT:', json.dumps(event)[:400])
    print('files in cwd:', os.listdir(cwd))
    if done.returncode:
        print('stderr:', done.stderr.decode('utf-8', 'replace')[-800:])
    shutil.rmtree(cwd, ignore_errors=True)


if __name__ == '__main__':
    mode = sys.argv[1]
    extra = []
    if mode == 'mcp':
        server = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'probe_mcp_server.py')
        extra = ['-c', f'mcp_servers.probe.command="{sys.executable}"', '-c', f'mcp_servers.probe.args=["{server}"]', '-c', 'mcp_servers.probe.default_tools_approval_mode="approve"']
    run(mode, extra)
