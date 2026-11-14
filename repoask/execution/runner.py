"""Isolated Docker session runner (M2 spike).

Every container operation goes through a discovered trusted Docker CLI using
argument arrays, bounded output and deadlines. Containers run with no network,
no bind mounts or volumes, read-only root, all capabilities dropped,
no-new-privileges, an unprivileged UID and separate byte-capped tmpfs mounts for
/workspace and /tmp. Workspace snapshots are parsed from an in-memory tar stream;
nothing is ever extracted on the host. There is no host shell fallback.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import io
import json
import math
import os
import re
import secrets
import signal
import stat
import subprocess
import tarfile
import threading
import time

__all__ = [
    'DEFAULT_LIMITS', 'LIMIT_BOUNDS', 'DockerRunner', 'RunnerError', 'RunnerHandle',
    'compare_snapshots', 'validate_relative_path', 'validate_limits', 'run_bounded',
    'parse_workspace_tar', 'discover_docker_binary',
]

DEFAULT_LIMITS = {
    'memory_mib': 512, 'workspace_mib': 64, 'tmp_mib': 16, 'cpus': 1, 'pids': 64,
    'wall_seconds': 600, 'max_files': 2000, 'max_file_bytes': 262144,
    'max_output_bytes': 65536,
}
# Inclusive hard bounds. Callers may tighten or modestly relax defaults inside these,
# never pass Docker options.
LIMIT_BOUNDS = {
    'memory_mib': (128, 4096), 'workspace_mib': (1, 1024), 'tmp_mib': (1, 256),
    'cpus': (1, 4), 'pids': (16, 512), 'wall_seconds': (10, 3600),
    'max_files': (1, 20000), 'max_file_bytes': (1, 16 * 1024 * 1024),
    'max_output_bytes': (1024, 1024 * 1024),
}
SANDBOX_UID = 65534
WORKSPACE = '/workspace'
LABEL_PREFIX = 'org.opendevin.'
LABEL_MANAGED = LABEL_PREFIX + 'managed'
LABEL_INSTANCE = LABEL_PREFIX + 'instance'
LABEL_SESSION = LABEL_PREFIX + 'session'
LABEL_ATTEMPT = LABEL_PREFIX + 'attempt'
LABEL_LIMITS = LABEL_PREFIX + 'limits'
CONTROL_TIMEOUT = 30
STOP_CONFIRM_SECONDS = 10
MAX_COMMAND_TIMEOUT = 600
MAX_ARGV_ITEMS = 256
MAX_ARG_BYTES = 8192
MAX_PATH_BYTES = 1024
REQUIRED_TOOLS = ('sh', 'tar', 'find', 'grep', 'timeout', 'mktemp', 'mv', 'rm', 'mkdir', 'cat', 'sleep')

_ID_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$')
_CONTAINER_RE = re.compile(r'^[0-9a-f]{64}$')
_IMAGE_ID_RE = re.compile(r'^sha256:[0-9a-f]{64}$')
_IMAGE_REF_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._/:@+-]{0,254}$')
_CONTROL_RE = re.compile(r'[\x00-\x1f\x7f]')
_TRUSTED_DOCKER_PATHS = (
    '/usr/local/bin/docker', '/opt/homebrew/bin/docker', '/usr/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
)
_DOCKER_ENV_PASSTHROUGH = (
    'HOME', 'USER', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'DOCKER_CERT_PATH',
    'DOCKER_TLS_VERIFY', 'DOCKER_API_VERSION', 'XDG_RUNTIME_DIR',
)


class RunnerError(Exception):
    """Stable, content-free runner failure. ``code`` is safe to persist."""

    def __init__(self, code: str, message: str = ''):
        super().__init__(message or code)
        self.code = code
        self.message = message or code


@dataclass(frozen=True)
class RunnerHandle:
    instance_id: str
    session_id: str
    container_id: str = field(repr=False)
    image_id: str


# ---------------------------------------------------------------- validation

def _validate_id(value, kind: str) -> str:
    if not isinstance(value, str) or not _ID_RE.match(value):
        raise RunnerError('invalid_argument', f'invalid {kind}')
    return value


def validate_relative_path(path) -> str:
    """Return a normalized safe workspace-relative path or raise ``unsafe_path``."""
    if not isinstance(path, str) or not path:
        raise RunnerError('unsafe_path', 'path must be a non-empty string')
    if len(path.encode('utf-8', 'surrogatepass')) > MAX_PATH_BYTES or _CONTROL_RE.search(path):
        raise RunnerError('unsafe_path', 'path too long or contains control characters')
    if path.startswith('/') or '\\' in path:
        raise RunnerError('unsafe_path', 'path must be relative')
    while path.startswith('./'):
        path = path[2:]
    parts = path.split('/')
    if not parts or any(p in ('', '.', '..') for p in parts):
        raise RunnerError('unsafe_path', 'path contains empty, dot or parent components')
    if any(len(p.encode('utf-8', 'surrogatepass')) > 255 for p in parts):
        raise RunnerError('unsafe_path', 'path component too long')
    try:
        path.encode('utf-8')
    except UnicodeEncodeError:
        raise RunnerError('unsafe_path', 'path is not valid UTF-8') from None
    return '/'.join(parts)


def validate_limits(limits=None) -> dict:
    if limits is None:
        limits = {}
    if not isinstance(limits, dict):
        raise RunnerError('invalid_argument', 'limits must be an object')
    unknown = set(limits) - set(DEFAULT_LIMITS)
    if unknown:
        raise RunnerError('invalid_argument', 'unknown limit keys')
    merged = dict(DEFAULT_LIMITS)
    for key, value in limits.items():
        if isinstance(value, bool) or not isinstance(value, int):
            if isinstance(value, float) and math.isfinite(value) and value.is_integer():
                value = int(value)
            else:
                raise RunnerError('invalid_argument', f'limit {key} must be a finite integer')
        low, high = LIMIT_BOUNDS[key]
        if not low <= value <= high:
            raise RunnerError('invalid_argument', f'limit {key} outside [{low}, {high}]')
        merged[key] = value
    # tmpfs pages are charged to the container memory cgroup; keep headroom.
    if merged['memory_mib'] < merged['workspace_mib'] + merged['tmp_mib'] + 64:
        raise RunnerError('invalid_argument', 'memory_mib must exceed tmpfs sizes plus 64 MiB')
    if merged['max_file_bytes'] > merged['workspace_mib'] * 1024 * 1024:
        raise RunnerError('invalid_argument', 'max_file_bytes exceeds workspace size')
    return merged


def _validate_files(files, limits) -> dict:
    if not isinstance(files, dict):
        raise RunnerError('invalid_argument', 'files must be a mapping')
    if len(files) > limits['max_files']:
        raise RunnerError('limit_exceeded', 'too many files')
    out, total = {}, 0
    for raw, content in files.items():
        path = validate_relative_path(raw)
        if not isinstance(content, (bytes, bytearray)):
            raise RunnerError('invalid_argument', 'file content must be bytes')
        if len(content) > limits['max_file_bytes']:
            raise RunnerError('limit_exceeded', 'file exceeds max_file_bytes')
        if path in out:
            raise RunnerError('invalid_argument', 'duplicate path')
        total += len(content)
        out[path] = bytes(content)
    for path in out:  # a file cannot also be a directory prefix of another file
        parts = path.split('/')
        for i in range(1, len(parts)):
            if '/'.join(parts[:i]) in out:
                raise RunnerError('invalid_argument', 'file path conflicts with directory')
    if total > limits['workspace_mib'] * 1024 * 1024:
        raise RunnerError('limit_exceeded', 'files exceed workspace size')
    return out


# ------------------------------------------------------- bounded subprocesses

@dataclass(frozen=True)
class BoundedResult:
    returncode: int
    stdout: bytes
    stderr: bytes
    timed_out: bool
    stdout_truncated: bool
    stderr_truncated: bool


class _Collector:
    def __init__(self, stream, cap: int):
        self.stream, self.cap = stream, cap
        self.chunks, self.size, self.truncated = [], 0, False

    def run(self):
        fd = self.stream.fileno()
        try:
            while True:
                chunk = os.read(fd, 65536)
                if not chunk:
                    break
                room = self.cap - self.size
                if room > 0:
                    keep = chunk[:room]
                    self.chunks.append(keep)
                    self.size += len(keep)
                if len(chunk) > max(room, 0):
                    self.truncated = True  # drain and discard beyond the cap
        except OSError:
            pass
        finally:
            try:
                self.stream.close()
            except OSError:
                pass

    @property
    def data(self) -> bytes:
        return b''.join(self.chunks)


def _kill_group(pid: int) -> None:
    try:
        os.killpg(pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def _exited_unreaped(proc) -> bool:
    waitid = getattr(os, 'waitid', None)
    if waitid is None or proc.returncode is not None:
        return False
    try:
        info = waitid(os.P_PID, proc.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
    except ChildProcessError:
        return False
    except OSError:
        return False
    return info is not None and info.si_pid == proc.pid


def run_bounded(argv, *, timeout: float, max_stdout: int, max_stderr: int = 16384,
                stdin: bytes | None = None, env=None, cancel: threading.Event | None = None) -> BoundedResult:
    """Run argv (no shell) in its own process group with byte caps and a deadline.

    Output beyond the cap is drained and discarded, never buffered. On deadline or
    cancellation the whole process group is killed; leftover group members are
    killed after a normal exit too, so no descendant outlives the call.
    """
    if not isinstance(argv, (list, tuple)) or not argv or not all(isinstance(a, str) for a in argv):
        raise RunnerError('invalid_argument', 'argv must be a list of strings')
    proc = subprocess.Popen(
        list(argv), stdin=subprocess.PIPE if stdin is not None else subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, close_fds=True,
        start_new_session=True,
    )
    out, err = _Collector(proc.stdout, max_stdout), _Collector(proc.stderr, max_stderr)
    threads = [threading.Thread(target=out.run, daemon=True), threading.Thread(target=err.run, daemon=True)]
    if stdin is not None:
        def feed():
            try:
                proc.stdin.write(stdin)
            except (BrokenPipeError, OSError):
                pass
            finally:
                try:
                    proc.stdin.close()
                except OSError:
                    pass
        threads.append(threading.Thread(target=feed, daemon=True))
    for t in threads:
        t.start()
    deadline = time.monotonic() + timeout
    timed_out = False
    while True:
        if _exited_unreaped(proc):
            # Leader is a zombie, so its pid/pgid cannot be reused yet: killing the
            # group now only reaches our own leftover descendants.
            _kill_group(proc.pid)
            proc.wait()
            break
        if proc.poll() is not None:
            # waitid(WNOWAIT) unavailable/unreliable (e.g. macOS). If descendants still
            # hold our pipes, they keep the process group alive, and POSIX forbids
            # reusing a pid while its process group exists, so the kill stays ours.
            for t in threads[:2]:
                t.join(timeout=0.2)
            if any(t.is_alive() for t in threads[:2]):
                _kill_group(proc.pid)
            break
        if time.monotonic() >= deadline or (cancel is not None and cancel.is_set()):
            timed_out = True
            _kill_group(proc.pid)
            proc.wait()
            break
        time.sleep(0.02)
    for t in threads:
        t.join(timeout=5)
    return BoundedResult(proc.returncode, out.data, err.data, timed_out, out.truncated, err.truncated)


# ------------------------------------------------------------ docker binary

def _trusted_file(path: str) -> bool:
    try:
        real = os.path.realpath(path)
        st = os.stat(real)
        parent = os.stat(os.path.dirname(real))
    except OSError:
        return False
    uid = os.getuid()
    if not stat.S_ISREG(st.st_mode) or not os.access(real, os.X_OK):
        return False
    if st.st_uid not in (0, uid) or st.st_mode & 0o022:
        return False
    if parent.st_uid not in (0, uid) or parent.st_mode & 0o022:
        return False
    return True


def discover_docker_binary(docker_binary=None) -> str:
    """Return a trusted Docker CLI path. Never consults PATH or the working directory."""
    if docker_binary is not None:
        if not isinstance(docker_binary, str) or not os.path.isabs(docker_binary):
            raise RunnerError('docker_untrusted', 'docker_binary must be an absolute path')
        if not _trusted_file(docker_binary):
            raise RunnerError('docker_untrusted', 'docker_binary is not a trusted executable')
        return os.path.realpath(docker_binary)
    candidates = list(_TRUSTED_DOCKER_PATHS)
    home = os.path.expanduser('~')
    if os.path.isabs(home):
        candidates.append(os.path.join(home, '.docker', 'bin', 'docker'))
    for candidate in candidates:
        if os.path.lexists(candidate) and _trusted_file(candidate):
            return os.path.realpath(candidate)
    raise RunnerError('docker_unavailable', 'no trusted Docker CLI found')


# ------------------------------------------------------------ tar parsing

def parse_workspace_tar(data: bytes, limits: dict) -> dict[str, bytes]:
    """Parse a tar stream in memory. Regular files only; never touches the host FS."""
    files, total = {}, 0
    try:
        archive = tarfile.open(fileobj=io.BytesIO(data), mode='r:')
    except tarfile.TarError:
        raise RunnerError('snapshot_rejected', 'unreadable archive') from None
    with archive:
        while True:
            try:
                member = archive.next()
            except tarfile.TarError:
                raise RunnerError('snapshot_rejected', 'malformed archive') from None
            if member is None:
                break
            name = member.name
            if name in ('.', './', ''):
                if not member.isdir():
                    raise RunnerError('snapshot_rejected', 'unexpected root entry')
                continue
            path = validate_relative_path(name.rstrip('/') if member.isdir() else name)
            if member.isdir():
                continue
            if member.issym() or member.islnk():
                raise RunnerError('snapshot_rejected', f'link entry rejected: {path}')
            if member.issparse() or not member.isreg():
                raise RunnerError('snapshot_rejected', f'non-regular entry rejected: {path}')
            if member.size > limits['max_file_bytes']:
                raise RunnerError('limit_exceeded', f'file exceeds max_file_bytes: {path}')
            total += member.size
            if total > limits['workspace_mib'] * 1024 * 1024:
                raise RunnerError('limit_exceeded', 'snapshot exceeds workspace size')
            if path in files:
                raise RunnerError('snapshot_rejected', 'duplicate entry')
            if len(files) >= limits['max_files']:
                raise RunnerError('limit_exceeded', 'snapshot exceeds max_files')
            stream = archive.extractfile(member)  # in-memory file object, not extraction
            content = stream.read(member.size + 1) if stream else b''
            if len(content) != member.size:
                raise RunnerError('snapshot_rejected', 'truncated entry')
            files[path] = content
    return files


def compare_snapshots(base: dict, current: dict) -> dict:
    """Manifest comparison: added, modified and deleted relative paths (sorted)."""
    def digest(b):
        return hashlib.sha256(b).hexdigest()
    added = sorted(set(current) - set(base))
    deleted = sorted(set(base) - set(current))
    modified = sorted(p for p in set(base) & set(current) if digest(base[p]) != digest(current[p]))
    return {'added': added, 'modified': modified, 'deleted': deleted}


def _tar_files(files: dict) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w', format=tarfile.PAX_FORMAT) as archive:
        for path in sorted(files):
            info = tarfile.TarInfo(path)
            info.size = len(files[path])
            info.mode = 0o644
            info.uid = info.gid = SANDBOX_UID
            info.mtime = 0
            info.type = tarfile.REGTYPE
            archive.addfile(info, io.BytesIO(files[path]))
    return buf.getvalue()


# ------------------------------------------------------ in-container scripts
# Fixed POSIX sh programs. User-controlled values are positional arguments only.
_CHECK_PARENTS = r'''
set -eu
set -f
p=$1
cur=/workspace
IFS=/
set -- $p
unset IFS
n=$#
i=0
for c in "$@"; do
  i=$((i + 1))
  cur=$cur/$c
  if [ "$i" -lt "$n" ]; then
    if [ -L "$cur" ]; then echo unsafe_symlink >&2; exit 90; fi
    if [ -e "$cur" ] && [ ! -d "$cur" ]; then echo not_a_directory >&2; exit 91; fi
  fi
done
'''
_READ_SCRIPT = _CHECK_PARENTS + r'''
if [ -L "$cur" ]; then echo unsafe_symlink >&2; exit 90; fi
if [ ! -e "$cur" ]; then echo not_found >&2; exit 92; fi
if [ ! -f "$cur" ]; then echo not_a_file >&2; exit 94; fi
exec cat -- "$cur"
'''
_WRITE_SCRIPT = _CHECK_PARENTS + r'''
if [ -L "$cur" ]; then echo unsafe_symlink >&2; exit 90; fi
if [ -e "$cur" ] && [ ! -f "$cur" ]; then echo not_a_file >&2; exit 94; fi
dir=${cur%/*}
mkdir -p -- "$dir" || exit 93
tmp=$(mktemp "$dir/.opendevin-write.XXXXXX") || exit 93
if ! cat > "$tmp"; then rm -f -- "$tmp"; exit 93; fi
mv -f -- "$tmp" "$cur" || { rm -f -- "$tmp"; exit 93; }
'''
_DELETE_SCRIPT = _CHECK_PARENTS + r'''
if [ -L "$cur" ] || [ -f "$cur" ]; then exec rm -f -- "$cur"; fi
if [ ! -e "$cur" ]; then echo not_found >&2; exit 92; fi
echo not_a_file >&2; exit 94
'''
_TOOLS_SCRIPT = r'''
for b in "$@"; do command -v "$b" >/dev/null 2>&1 || { echo "$b" >&2; exit 95; }; done
'''
_SCRIPT_CODES = {90: 'unsafe_path', 91: 'unsafe_path', 92: 'not_found', 93: 'workspace_full', 94: 'not_a_file'}


# ---------------------------------------------------------------- runner

class DockerRunner:
    """Owns containers labelled with this OpenDevin instance id only."""

    def __init__(self, instance_id: str, *, docker_binary=None):
        self.instance_id = _validate_id(instance_id, 'instance_id')
        self._docker = discover_docker_binary(docker_binary)
        env = {'PATH': os.pathsep.join([os.path.dirname(self._docker), '/usr/bin', '/bin', '/usr/sbin', '/sbin']),
               'LANG': 'C', 'LC_ALL': 'C'}
        for key in _DOCKER_ENV_PASSTHROUGH:
            if os.environ.get(key):
                env[key] = os.environ[key]
        self._env = env
        self._limits: dict[str, dict] = {}
        self._lock = threading.Lock()

    # -- docker plumbing
    def _cli(self, args, *, timeout=CONTROL_TIMEOUT, max_stdout=1024 * 1024, stdin=None) -> BoundedResult:
        try:
            return run_bounded([self._docker, *args], timeout=timeout, max_stdout=max_stdout,
                               stdin=stdin, env=self._env)
        except OSError:
            raise RunnerError('docker_unavailable', 'docker CLI could not be executed') from None

    def _cli_ok(self, args, code='container_failure', **kw) -> BoundedResult:
        res = self._cli(args, **kw)
        if res.timed_out:
            raise RunnerError('timeout', 'docker control operation timed out')
        if res.returncode != 0:
            raise RunnerError(code, 'docker operation failed')
        return res

    def _inspect_container(self, container_id: str):
        res = self._cli(['container', 'inspect', '--format', '{{json .}}', '--', container_id])
        if res.timed_out:
            raise RunnerError('timeout', 'docker inspect timed out')
        if res.returncode != 0:
            return None
        try:
            return json.loads(res.stdout.decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            raise RunnerError('container_failure', 'unparseable inspect output') from None

    def _owned_labels(self, info) -> dict | None:
        labels = ((info or {}).get('Config') or {}).get('Labels') or {}
        if labels.get(LABEL_MANAGED) != '1' or labels.get(LABEL_INSTANCE) != self.instance_id:
            return None
        if not _ID_RE.match(labels.get(LABEL_SESSION, '')) or not _ID_RE.match(labels.get(LABEL_ATTEMPT, '')):
            return None
        return labels

    def _verify_handle(self, handle: RunnerHandle, info=None):
        if not isinstance(handle, RunnerHandle) or handle.instance_id != self.instance_id:
            raise RunnerError('ownership_unverified', 'handle not owned by this runner')
        if not _CONTAINER_RE.match(handle.container_id):
            raise RunnerError('ownership_unverified', 'invalid handle')
        info = info if info is not None else self._inspect_container(handle.container_id)
        if info is None:
            return None
        labels = self._owned_labels(info)
        if (labels is None or labels.get(LABEL_SESSION) != handle.session_id
                or info.get('Image') != handle.image_id or info.get('Id') != handle.container_id):
            raise RunnerError('ownership_unverified', 'container labels do not match handle')
        return info

    def _handle_limits(self, handle: RunnerHandle) -> dict:
        if not isinstance(handle, RunnerHandle) or handle.instance_id != self.instance_id:
            raise RunnerError('ownership_unverified', 'handle not owned by this runner')
        with self._lock:
            limits = self._limits.get(handle.container_id)
        if limits is None:
            info = self._verify_handle(handle)
            if info is None:
                raise RunnerError('not_found', 'container not found')
            limits = self._limits_from_labels(info['Config']['Labels'])
            with self._lock:
                self._limits[handle.container_id] = limits
        return limits

    @staticmethod
    def _limits_from_labels(labels) -> dict:
        try:
            raw = json.loads(labels.get(LABEL_LIMITS, ''))
        except ValueError:
            raise RunnerError('ownership_unverified', 'invalid limits label') from None
        if not isinstance(raw, dict) or set(raw) != set(DEFAULT_LIMITS):
            raise RunnerError('ownership_unverified', 'invalid limits label')
        return validate_limits(raw)

    def _exec(self, handle, argv, *, timeout, max_stdout, stdin=None) -> BoundedResult:
        args = ['exec']
        if stdin is not None:
            args.append('-i')
        args += ['-u', f'{SANDBOX_UID}:{SANDBOX_UID}', '-w', WORKSPACE, '-e', 'HOME=/tmp',
                 '-e', 'TMPDIR=/tmp', handle.container_id, *argv]
        res = self._cli(args, timeout=timeout, max_stdout=max_stdout, stdin=stdin)
        head = res.stderr[:400]
        if (res.returncode != 0 and not res.timed_out and head.startswith(b'Error response from daemon')
                and b'is not running' in head):
            raise RunnerError('not_running', 'session container is not running')
        return res

    def _script(self, handle, script, path, *, max_stdout=4096, stdin=None, timeout=CONTROL_TIMEOUT):
        res = self._exec(handle, ['sh', '-c', script, 'opendevin', path], timeout=timeout,
                         max_stdout=max_stdout, stdin=stdin)
        if res.timed_out:
            raise RunnerError('timeout', 'file operation timed out')
        if res.returncode != 0:
            raise RunnerError(_SCRIPT_CODES.get(res.returncode, 'container_failure'), 'file operation failed')
        return res

    @staticmethod
    def _create_args(*, image_id, instance_id, session_id, attempt_id, limits) -> list[str]:
        """Exact docker create argument array. No caller-provided Docker options."""
        ws = limits['workspace_mib'] * 1024 * 1024
        tmp = limits['tmp_mib'] * 1024 * 1024
        inodes = limits['max_files'] * 2 + 64
        mem = f"{limits['memory_mib']}m"
        labels = {
            LABEL_MANAGED: '1', LABEL_INSTANCE: instance_id, LABEL_SESSION: session_id,
            LABEL_ATTEMPT: attempt_id, LABEL_LIMITS: json.dumps(limits, sort_keys=True, separators=(',', ':')),
        }
        args = [
            'create', '--pull', 'never', '--name', f'opendevin-{instance_id}-{session_id}-{attempt_id}',
            '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges=true',
            '--user', f'{SANDBOX_UID}:{SANDBOX_UID}', '--read-only', '--init',
            '--tmpfs', f'{WORKSPACE}:rw,nosuid,nodev,exec,size={ws},nr_inodes={inodes},mode=0700,uid={SANDBOX_UID},gid={SANDBOX_UID}',
            '--tmpfs', f'/tmp:rw,nosuid,nodev,noexec,size={tmp},mode=1777',
            '--memory', mem, '--memory-swap', mem, '--cpus', str(limits['cpus']),
            '--pids-limit', str(limits['pids']), '--ulimit', 'nofile=256:256', '--ulimit', 'core=0:0',
            '--log-driver', 'none', '--workdir', WORKSPACE, '--env', 'HOME=/tmp', '--env', 'TMPDIR=/tmp',
            '--hostname', 'opendevin-session', '--stop-timeout', '1',
        ]
        for key, value in labels.items():
            args += ['--label', f'{key}={value}']
        # PID 1 (tini) runs a bounded sleep: the container ends itself at the wall limit.
        args += ['--entrypoint', 'sleep', image_id, str(limits['wall_seconds'])]
        return args

    @staticmethod
    def _verify_hostconfig(info, limits) -> None:
        hc = info.get('HostConfig') or {}
        problems = []
        if hc.get('Binds'):
            problems.append('binds')
        if hc.get('Mounts'):
            problems.append('mounts')
        if any((m or {}).get('Type') != 'tmpfs' for m in info.get('Mounts') or []):
            problems.append('volumes')
        if hc.get('NetworkMode') != 'none':
            problems.append('network')
        if hc.get('Privileged') or not hc.get('ReadonlyRootfs'):
            problems.append('privilege')
        if 'ALL' not in (hc.get('CapDrop') or []) or hc.get('CapAdd'):
            problems.append('capabilities')
        if not any(str(o).startswith('no-new-privileges') for o in hc.get('SecurityOpt') or []):
            problems.append('no_new_privileges')
        if hc.get('Devices') or hc.get('VolumesFrom') or hc.get('PidMode') or hc.get('IpcMode') == 'host':
            problems.append('namespaces')
        if set((hc.get('Tmpfs') or {})) != {WORKSPACE, '/tmp'}:
            problems.append('tmpfs')
        if hc.get('PidsLimit') != limits['pids'] or hc.get('Memory') != limits['memory_mib'] * 1024 * 1024:
            problems.append('resources')
        if (info.get('Config') or {}).get('User') != f'{SANDBOX_UID}:{SANDBOX_UID}':
            problems.append('user')
        if problems:
            raise RunnerError('isolation_unverified', 'container isolation check failed: ' + ','.join(problems))

    # -- public API
    def preflight(self, image: str) -> dict:
        reasons = []
        result = {
            'available': False, 'image_id': None, 'architecture': None, 'os': None,
            'engine_version': None, 'supported_limits': {
                k: {'default': DEFAULT_LIMITS[k], 'min': LIMIT_BOUNDS[k][0], 'max': LIMIT_BOUNDS[k][1]}
                for k in DEFAULT_LIMITS},
            'blocking_reasons': reasons,
        }
        if not isinstance(image, str) or not _IMAGE_REF_RE.match(image):
            reasons.append('invalid_image_reference')
            return result
        try:
            ver = self._cli(['version', '--format', '{{json .Server}}'], timeout=15)
        except RunnerError:
            reasons.append('docker_unavailable')
            return result
        server = None
        if ver.returncode == 0 and not ver.timed_out:
            try:
                server = json.loads(ver.stdout.decode('utf-8'))
            except (ValueError, UnicodeDecodeError):
                server = None
        if not isinstance(server, dict):
            reasons.append('docker_unavailable')
            return result
        result['engine_version'] = str(server.get('Version', ''))[:64] or None
        if str(server.get('Os', '')).lower() != 'linux':
            reasons.append('engine_not_linux')
        img = self._cli(['image', 'inspect', '--format', '{{json .}}', '--', image], timeout=15)
        info = None
        if img.returncode == 0 and not img.timed_out:
            try:
                info = json.loads(img.stdout.decode('utf-8').splitlines()[0])
            except (ValueError, UnicodeDecodeError, IndexError):
                info = None
        if not isinstance(info, dict) or not _IMAGE_ID_RE.match(str(info.get('Id', ''))):
            reasons.append('image_not_present')  # never pulled automatically
        else:
            result['image_id'] = info['Id']
            result['architecture'] = str(info.get('Architecture', ''))[:32] or None
            result['os'] = str(info.get('Os', ''))[:32] or None
            if result['os'] != 'linux':
                reasons.append('image_not_linux')
            if (info.get('Config') or {}).get('Volumes'):
                reasons.append('image_declares_volumes')
        result['available'] = not reasons
        return result

    def provision(self, session_id: str, files: dict, *, image: str, limits: dict) -> RunnerHandle:
        session_id = _validate_id(session_id, 'session_id')
        limits = validate_limits(limits)
        files = _validate_files(files, limits)
        pre = self.preflight(image)
        if pre['blocking_reasons']:
            raise RunnerError('preflight_failed', ','.join(pre['blocking_reasons']))
        image_id = pre['image_id']
        if any(h.session_id == session_id for h in self.list_owned()):
            raise RunnerError('session_exists', 'an owned container already exists for this session')
        attempt_id = secrets.token_hex(6)
        res = self._cli_ok(self._create_args(image_id=image_id, instance_id=self.instance_id,
                                             session_id=session_id, attempt_id=attempt_id, limits=limits),
                           code='provision_failed', timeout=60)
        container_id = res.stdout.decode('ascii', 'replace').strip()
        if not _CONTAINER_RE.match(container_id):
            raise RunnerError('provision_failed', 'unexpected container id')
        handle = RunnerHandle(self.instance_id, session_id, container_id, image_id)
        try:
            info = self._verify_handle(handle)
            if info is None:
                raise RunnerError('provision_failed', 'created container disappeared')
            self._verify_hostconfig(info, limits)
            self._cli_ok(['start', '--', container_id], code='provision_failed', timeout=60)
            with self._lock:
                self._limits[container_id] = limits
            check = self._exec(handle, ['sh', '-c', _TOOLS_SCRIPT, 'opendevin', *REQUIRED_TOOLS],
                               timeout=CONTROL_TIMEOUT, max_stdout=4096)
            if check.returncode != 0:
                raise RunnerError('image_unsupported', 'image lacks required POSIX tools')
            if files:
                up = self._exec(handle, ['tar', '-x', '-f', '-', '-C', WORKSPACE, '--no-same-owner',
                                         '--no-same-permissions'],
                                timeout=120, max_stdout=4096, stdin=_tar_files(files))
                if up.timed_out or up.returncode != 0:
                    raise RunnerError('workspace_full' if b'No space' in up.stderr else 'provision_failed',
                                      'workspace upload failed')
        except BaseException:
            try:
                self._force_remove(container_id)
            except RunnerError:
                pass  # surfaced by list_owned()/orphan recovery
            with self._lock:
                self._limits.pop(container_id, None)
            raise
        return handle

    def _force_remove(self, container_id: str) -> None:
        # Only called for a container this call just created and verified by id.
        self._cli(['kill', '--signal', 'KILL', '--', container_id], timeout=15)
        self._cli(['rm', '--', container_id], timeout=15)

    def list_files(self, handle) -> list[str]:
        limits = self._handle_limits(handle)
        cap = limits['max_files'] * (MAX_PATH_BYTES + 3) + 1
        res = self._exec(handle, ['find', '.', '-xdev', '-type', 'f', '-print0'], timeout=CONTROL_TIMEOUT,
                         max_stdout=cap)
        if res.timed_out or res.returncode != 0:
            raise RunnerError('container_failure', 'listing failed')
        names = [n for n in res.stdout.decode('utf-8', 'surrogateescape').split('\0') if n]
        if res.stdout_truncated or len(names) > limits['max_files']:
            raise RunnerError('limit_exceeded', 'workspace exceeds max_files')
        out = []
        for name in names:
            try:
                out.append(validate_relative_path(name))
            except RunnerError:
                continue  # unrepresentable names are not exposed
        return sorted(out)

    def read_file(self, handle, path: str) -> bytes:
        limits = self._handle_limits(handle)
        path = validate_relative_path(path)
        res = self._script(handle, _READ_SCRIPT, path, max_stdout=limits['max_file_bytes'])
        if res.stdout_truncated:
            raise RunnerError('limit_exceeded', 'file exceeds max_file_bytes')
        return res.stdout

    def write_file(self, handle, path: str, content: bytes) -> None:
        limits = self._handle_limits(handle)
        path = validate_relative_path(path)
        if not isinstance(content, (bytes, bytearray)):
            raise RunnerError('invalid_argument', 'content must be bytes')
        if len(content) > limits['max_file_bytes']:
            raise RunnerError('limit_exceeded', 'content exceeds max_file_bytes')
        self._script(handle, _WRITE_SCRIPT, path, stdin=bytes(content))

    def delete_file(self, handle, path: str) -> None:
        self._handle_limits(handle)
        self._script(handle, _DELETE_SCRIPT, validate_relative_path(path))

    def run_command(self, handle, argv: list[str], *, timeout_seconds: int = 30) -> dict:
        limits = self._handle_limits(handle)
        if not isinstance(argv, list) or not argv or len(argv) > MAX_ARGV_ITEMS:
            raise RunnerError('invalid_argument', 'argv must be a non-empty list')
        for arg in argv:
            if not isinstance(arg, str) or '\0' in arg or len(arg.encode('utf-8', 'surrogatepass')) > MAX_ARG_BYTES:
                raise RunnerError('invalid_argument', 'invalid argv element')
        if isinstance(timeout_seconds, bool) or not isinstance(timeout_seconds, int) or not 1 <= timeout_seconds <= MAX_COMMAND_TIMEOUT:
            raise RunnerError('invalid_argument', 'timeout_seconds must be an integer in [1, 600]')
        timeout_seconds = min(timeout_seconds, limits['wall_seconds'])
        cap = limits['max_output_bytes']
        started = time.monotonic()
        # In-container coreutils timeout terminates the command tree inside the
        # container; the host deadline only bounds the docker client.
        res = self._exec(handle, ['timeout', '-k', '2', str(timeout_seconds), *argv],
                         timeout=timeout_seconds + 10, max_stdout=cap)
        elapsed = time.monotonic() - started
        timed_out = res.timed_out or (res.returncode in (124, 137) and elapsed >= timeout_seconds - 0.5)
        stderr = res.stderr[:cap]
        return {
            'exit_code': None if res.timed_out else res.returncode,
            'stdout': res.stdout.decode('utf-8', 'replace'),
            'stderr': stderr.decode('utf-8', 'replace'),
            'timed_out': timed_out,
            'truncated': res.stdout_truncated or res.stderr_truncated or len(res.stderr) > cap,
        }

    def snapshot(self, handle) -> dict[str, bytes]:
        limits = self._handle_limits(handle)
        cap = limits['workspace_mib'] * 1024 * 1024 + (limits['max_files'] * 2 + 64) * 2048 + 20480
        res = self._exec(handle, ['tar', '-C', WORKSPACE, '--numeric-owner', '-cf', '-', '.'],
                         timeout=120, max_stdout=cap)
        if res.stdout_truncated:
            raise RunnerError('limit_exceeded', 'snapshot archive exceeds limit')
        if res.timed_out or res.returncode != 0:
            raise RunnerError('snapshot_failed', 'workspace archive failed')
        return parse_workspace_tar(res.stdout, limits)

    def stop(self, handle) -> dict:
        info = self._verify_handle(handle)
        if info is None:
            return {'confirmed': True, 'code': 'absent'}
        if not (info.get('State') or {}).get('Running'):
            return {'confirmed': True, 'code': 'already_stopped'}
        self._cli(['kill', '--signal', 'KILL', '--', handle.container_id], timeout=STOP_CONFIRM_SECONDS)
        deadline = time.monotonic() + STOP_CONFIRM_SECONDS
        while time.monotonic() < deadline:
            info = self._inspect_container(handle.container_id)
            if info is None:
                return {'confirmed': True, 'code': 'absent'}
            if not (info.get('State') or {}).get('Running'):
                return {'confirmed': True, 'code': 'stopped'}
            time.sleep(0.1)
        return {'confirmed': False, 'code': 'containment_unverified'}

    def discard(self, handle) -> None:
        info = self._verify_handle(handle)
        if info is None:
            with self._lock:
                self._limits.pop(handle.container_id, None)
            return
        if (info.get('State') or {}).get('Running'):
            raise RunnerError('not_stopped', 'stop the session container before discarding')
        self._cli_ok(['rm', '--', handle.container_id], code='discard_failed')
        with self._lock:
            self._limits.pop(handle.container_id, None)

    def list_owned(self) -> list[RunnerHandle]:
        res = self._cli_ok(['ps', '-a', '--no-trunc', '--format', '{{.ID}}',
                            '--filter', f'label={LABEL_MANAGED}=1',
                            '--filter', f'label={LABEL_INSTANCE}={self.instance_id}'], code='docker_unavailable')
        handles = []
        for line in res.stdout.decode('ascii', 'replace').split():
            if not _CONTAINER_RE.match(line):
                continue
            info = self._inspect_container(line)
            labels = self._owned_labels(info)
            if labels is None or info.get('Id') != line or not _IMAGE_ID_RE.match(str(info.get('Image', ''))):
                continue
            try:
                self._limits_from_labels(labels)
            except RunnerError:
                continue
            handles.append(RunnerHandle(self.instance_id, labels[LABEL_SESSION], line, info['Image']))
        return handles
