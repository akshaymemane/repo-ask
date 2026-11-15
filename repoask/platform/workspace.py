"""Read-only status builders. No model probes, workers or recovery side effects."""
from dataclasses import asdict
from .clock import format_ts
from .jobs import STATES
from .migrations import LATEST_VERSION
from .secrets import UnavailableSecretStore


def build_workspace_summary(index, model, platform, *, now):
    snapshots = list(index.snapshots.values())
    demo = all(snapshot.demo for snapshot in snapshots)
    status = platform.secrets.status() if platform else UnavailableSecretStore().status()
    return {
        'contract': 'opendevin.workspace/m0.1', 'generated_at': format_ts(now), 'product': 'OpenDevin',
        'mode': 'demo' if demo else 'local',
        'catalog': {'source': 'demo_fixtures' if demo else 'local_checkouts', 'repository_count': len(snapshots),
                    'limited_count': sum(bool(s.limited) for s in snapshots), 'repos_endpoint': '/api/repos',
                    'github': {'status': 'not_available', 'reason': 'GitHub connection is not available in this version. Only bundled samples or explicit local checkouts are indexed.'}},
        'providers': {'answer': {'status': 'configured' if model else 'not_configured', 'adapter': 'ollama' if model else None,
                                 'model': model.model if model else None, 'destination': 'loopback' if model else None},
                      'profiles': {'status': 'not_available', 'reason': 'Provider profiles are not available in this version. Start with --model NAME to use a local Ollama model.'}},
        'execution': {'status': 'not_available', 'reason': 'Implementation sessions are not available in this version. OpenDevin is read-only.'},
        'storage': {'persistent': platform.store.persistent if platform else False, 'schema_version': platform.store.schema_version() if platform else None, 'status': 'ok' if platform else 'disabled'},
        'secrets': asdict(status),
        'navigation': [dict(id=name, label=label, href='#/' + name, status=state) for name, label, state in
                       [('ask', 'Ask', 'available'), ('repositories', 'Repositories', 'read_only'), ('settings', 'Settings', 'read_only')]]}


def apply_github_status(result, github):
    """Attach the GitHub catalog summary; a connected catalog is the workspace source."""
    result['catalog']['github'] = github
    if github.get('status') == 'connected':
        result['mode'] = 'connected'
        result['catalog']['source'] = 'github'
    return result


def build_health(index, model, platform, *, now):
    counts, expired, oldest, failures = dict.fromkeys(STATES, 0), 0, None, []
    if platform:
        with platform.store.read() as conn:
            counts.update(dict(conn.execute('SELECT state,count(*) FROM jobs GROUP BY state')))
            expired = conn.execute("SELECT count(*) FROM jobs WHERE state='leased' AND lease_expires_at<?", (now,)).fetchone()[0]
            first = conn.execute("SELECT min(created_at) FROM jobs WHERE state='queued'").fetchone()[0]
            oldest = max(0, now - first) if first is not None else None
            failures = platform.jobs.recent_failures()
    degraded = bool(expired or counts['needs_reconciliation'])
    secret_status = platform.secrets.status() if platform else UnavailableSecretStore().status()
    return {'contract': 'opendevin.health/m0.1', 'status': 'degraded' if degraded else 'ok', 'checked_at': format_ts(now),
            'components': {
                'api': {'status': 'ok'},
                'index': {'status': 'ok', 'repository_count': len(index.snapshots), 'persistent': False},
                'storage': {'status': 'ok' if platform else 'disabled', 'persistent': platform.store.persistent if platform else False,
                            'schema_version': platform.store.schema_version() if platform else None,
                            'expected_schema_version': LATEST_VERSION if platform else None, 'size_bytes': platform.store.size_bytes() if platform else None},
                'jobs': {'status': ('degraded' if degraded else 'ok') if platform else 'disabled', 'counts': counts,
                         'expired_leases': expired, 'oldest_queued_age_ms': oldest, 'workers_running': 0},
                'secrets': {'status': 'available' if secret_status.available else 'unavailable', 'backend': secret_status.backend,
                            'code': None if secret_status.available else 'secret_store_unavailable'},
                'model': {'status': 'configured' if model else 'not_configured', 'adapter': 'ollama' if model else None,
                          'destination': 'loopback' if model else None, 'probed': False}}, 'recent_failures': failures}
