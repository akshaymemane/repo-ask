import json, os, shutil, sys, tempfile, threading, time
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[4]))
from repoask.execution.adapter_process import run_stream
here = os.path.dirname(os.path.abspath(__file__))
server = os.path.join(here, 'probe_mcp_server.py')
log = os.path.join(here, 'probe_mcp_calls.jsonl')
if os.path.exists(log): os.remove(log)
cwd = tempfile.mkdtemp(prefix='codex-stop-', dir=here)
argv = [shutil.which('codex'), 'exec', '--json', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules',
        '--sandbox', 'read-only', '-C', cwd, '--disable', 'shell_tool', '--disable', 'unified_exec',
        '-c', f'mcp_servers.probe.command="{sys.executable}"', '-c', f'mcp_servers.probe.args=["{server}"]',
        '-c', 'mcp_servers.probe.default_tools_approval_mode="approve"', '-']
stdin = tempfile.TemporaryFile(); stdin.write(b'Call add_numbers 20 times with a=1..20 and b=1, one call at a time, then write a 2000-word essay about each result.'); stdin.flush(); stdin.seek(0)
stop = threading.Event()
lines = []
started = time.monotonic()
def fire():
    # wait until the MCP server is up, then stop
    end = time.monotonic() + 60
    while time.monotonic() < end and not (os.path.exists(log) and 'tools/call' in open(log).read()):
        time.sleep(0.2)
    stop.set()
threading.Thread(target=fire, daemon=True).start()
env = {k: os.environ[k] for k in ('PATH', 'HOME', 'USER', 'TMPDIR', 'LANG') if k in os.environ}
out = run_stream(argv, cwd=cwd, env=env, on_line=lines.append, timeout_seconds=120, max_output_bytes=4_000_000, stop_event=stop, stdin_file=stdin)
print('outcome', out.reason, 'stop_confirmed', out.stop_confirmed, 'after', round(time.monotonic() - started, 1), 's')
pids = {(json.loads(l)['pid'], json.loads(l)['pgid']) for l in open(log)}
time.sleep(0.5)
for pid, pgid in pids:
    try:
        os.kill(pid, 0); alive = True
    except ProcessLookupError:
        alive = False
    print('mcp server pid', pid, 'pgid', pgid, 'alive' if alive else 'gone')
print('calls seen', sum('tools/call' in l for l in open(log)))
shutil.rmtree(cwd, ignore_errors=True)
