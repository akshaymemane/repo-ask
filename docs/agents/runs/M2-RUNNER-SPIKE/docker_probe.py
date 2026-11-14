"""Real Docker boundary probe for M2-RUNNER-SPIKE (run by root; never pulls).

Usage (from the worktree root):
    python3 docs/agents/runs/M2-RUNNER-SPIKE/docker_probe.py [IMAGE ...]
Default images: debian:stable-slim python:3.12-slim (absent images are reported, not pulled).
Touches only containers labelled with a fresh random OpenDevin instance id and removes them.
Prints one JSON evidence document on stdout; contains no host paths or secrets.
"""
import json
import os
import secrets
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

from repoask.execution import DockerRunner, RunnerError, compare_snapshots  # noqa: E402


def sh(runner, handle, script, timeout=30):
    return runner.run_command(handle, ['sh', '-c', script], timeout_seconds=timeout)


def probe(runner, image):
    ev = {'image': image, 'preflight': runner.preflight(image)}
    if ev['preflight']['blocking_reasons']:
        return ev
    a = runner.provision('probea', {'a.txt': b'secret-A'}, image=image, limits={})
    b = runner.provision('probeb', {'b.txt': b'secret-B'}, image=image, limits={'workspace_mib': 1})
    try:
        ev['ids'] = sh(runner, a, 'id -u; id -g')['stdout'].split()
        ev['status'] = sh(runner, a, 'grep -E "^(CapEff|CapBnd|NoNewPrivs)" /proc/self/status')['stdout'].split('\n')
        ev['net_operstate'] = sh(runner, a, 'for d in /sys/class/net/*; do [ -d "$d" ] || continue; echo "${d##*/}=$(cat $d/operstate)"; done')['stdout'].split()
        ev['routes'] = sh(runner, a, 'tail -n +2 /proc/net/route; grep -v " lo$" /proc/net/ipv6_route; true')['stdout'].strip()
        ev['mounts'] = [l for l in sh(runner, a, 'cat /proc/mounts')['stdout'].splitlines()
                        if ' / ' in l or '/workspace' in l or ' /tmp ' in l]
        mounts = sh(runner, a, 'cat /proc/mounts')['stdout']
        ev['host_markers_in_mounts'] = [m for m in ['/Users', '/home', 'docker.sock', '/host_mnt', 'virtiofs',
                                                    'grpcfuse', 'osxfs'] if m in mounts]
        ev['docker_socket_present'] = sh(runner, a, 'test -e /var/run/docker.sock || test -e /run/docker.sock')['exit_code'] == 0
        cross = sh(runner, a, 'find / -xdev -name b.txt 2>/dev/null; grep -rl "secret-[B]" /workspace /tmp; true')
        ev['cross_session_visible'] = {'stdout': cross['stdout'].strip(), 'timed_out': cross['timed_out']}
        ev['root_write_exit'] = sh(runner, a, 'touch /etc/x')['exit_code']
        ev['tmp_exec_exit'] = sh(runner, a, 'printf "#!/bin/sh\\necho r\\n" >/tmp/x; chmod +x /tmp/x; /tmp/x')['exit_code']
        ev['pids_max'] = sh(runner, a, 'cat /sys/fs/cgroup/pids.max 2>/dev/null')['stdout'].strip()
        ev['memory_max'] = sh(runner, a, 'cat /sys/fs/cgroup/memory.max 2>/dev/null')['stdout'].strip()
        ev['outbound'] = sh(runner, a, 'getent hosts example.com || echo no-resolve')['stdout'].strip()
        cap = sh(runner, b, 'head -c 3000000 /dev/zero > big; echo rc=$?; wc -c < big; rm -f big')
        ev['workspace_cap'] = cap['stdout'].split()
        out = sh(runner, a, 'head -c 300000 /dev/zero | tr "\\0" a')
        ev['output_bound'] = {'truncated': out['truncated'], 'stdout_chars': len(out['stdout'])}
        t = time.monotonic()
        res = runner.run_command(a, ['sleep', '60'], timeout_seconds=2)
        ev['timeout'] = {'timed_out': res['timed_out'], 'seconds': round(time.monotonic() - t, 2)}
        sh(runner, a, 'ln -s /etc/passwd link')
        try:
            runner.read_file(a, 'link')
            ev['symlink_read'] = 'ALLOWED (FAIL)'
        except RunnerError as exc:
            ev['symlink_read'] = exc.code
        try:
            runner.snapshot(a)
            ev['symlink_snapshot'] = 'ALLOWED (FAIL)'
        except RunnerError as exc:
            ev['symlink_snapshot'] = exc.code
        runner.delete_file(a, 'link')
        runner.write_file(a, 'new.txt', b'n')
        ev['manifest'] = compare_snapshots({'a.txt': b'secret-A'}, runner.snapshot(a))
        sh(runner, a, 'sleep 300 >/dev/null 2>&1 &')
        t = time.monotonic()
        ev['stop'] = runner.stop(a)
        ev['stop_seconds'] = round(time.monotonic() - t, 3)
        ev['stop_again'] = runner.stop(a)
        ev['owned_before_cleanup'] = sorted(h.session_id for h in runner.list_owned())
    finally:
        for h in (a, b):
            runner.stop(h)
            runner.discard(h)
    ev['owned_after_cleanup'] = [h.session_id for h in runner.list_owned()]
    ev['stop_after_discard'] = runner.stop(a)  # must be verified absent, not inferred
    return ev


def main(images):
    runner = DockerRunner('probe' + secrets.token_hex(4))
    report = []
    for image in images or ['debian:stable-slim', 'python:3.12-slim']:
        try:
            report.append(probe(runner, image))
        except RunnerError as exc:
            report.append({'image': image, 'error': exc.code, 'message': exc.message})
    json.dump(report, sys.stdout, indent=2)
    print()
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
