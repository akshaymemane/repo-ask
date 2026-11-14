"""Durable implementation sessions (F05) and the dedicated runtime worker.

Public interface (docs/contracts/m2-sessions.md):
``SessionService(platform, index, github, providers, plans, execution_profiles, *,
runner_factory=None, adapter_factory=None, clock=now_ms)`` with preflight, launch, get,
list_sessions, events, artifacts, diff, validations, send_message, stop, retry,
run_session, start, close, recover and purge_repository. Root owns HTTP/main wiring.
No module-level launches; no publication (F06) is performed here.
"""
from .errors import SessionError
from .service import SessionService, ACTIVE, TERMINAL

__all__ = ['SessionService', 'SessionError', 'ACTIVE', 'TERMINAL']
