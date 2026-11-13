"""Application-owned services and a bounded, observable background job lifecycle."""
from threading import Event, Thread
import time

from .api import FeatureAPI
from .github import GitHubService
from .providers import ProviderService
from .platform import Worker
from .platform.worker import JobInterrupted
from .platform.clock import new_id
from .platform.errors import LeaseLost, PlatformError


class ShutdownContext:
    def __init__(self, context, stop_event):
        self.context, self.stop_event = context, stop_event
        self.queue, self.lease, self.lease_ms = context.queue, context.lease, context.lease_ms

    def checkpoint(self, data):
        self.context.checkpoint(data)
        if self.stop_event.is_set():
            raise JobInterrupted()

    @property
    def cancel_requested(self):
        if self.stop_event.is_set():
            raise JobInterrupted()
        return self.context.cancel_requested


class ApplicationServices:
    def __init__(self, platform, *, github_transport=None, provider_transport=None):
        self.platform = platform
        self.github = GitHubService(platform.store, platform.jobs, platform.secrets, transport=github_transport)
        self.providers = ProviderService(platform.store, platform.secrets, transport=provider_transport)
        self.api = FeatureAPI(platform, self.github, self.providers)
        self.stop_event = Event()
        self.thread = None
        self.error_code = None
        self.handlers = {'github.refresh': self.github.run_refresh, 'github.purge': self.github.run_purge}

    def _maintained(self, handler):
        def execute(job, context):
            finished = Event()
            def maintain():
                while not finished.wait(5):
                    try:
                        context.queue.heartbeat(context.lease, lease_ms=context.lease_ms)
                    except (LeaseLost, PlatformError):
                        return
            heartbeat = Thread(target=maintain, name='opendevin-job-heartbeat')
            heartbeat.start()
            try:
                if self.stop_event.is_set():
                    raise JobInterrupted()
                return handler(job, ShutdownContext(context, self.stop_event))
            finally:
                finished.set()
                heartbeat.join()
        return execute

    def start(self):
        if self.thread is not None:
            raise RuntimeError('Services already started.')
        self.worker = Worker(self.platform.jobs, {kind: self._maintained(fn) for kind, fn in self.handlers.items()},
                             worker_id=new_id('worker'), lease_ms=120000)
        self.thread = Thread(target=self._run, name='opendevin-background-jobs')
        self.thread.start()

    def _run(self):
        next_poll = 0
        while not self.stop_event.is_set():
            try:
                if time.monotonic() >= next_poll:
                    self.github.schedule_due()
                    next_poll = time.monotonic() + 5
                worked = self.worker.run_once()
                self.error_code = None
            except Exception:
                # Network/source/credential messages must never enter diagnostics.
                self.error_code = 'background_unavailable'
                worked = False
            if not worked:
                self.stop_event.wait(0.25)

    @property
    def running(self):
        return self.thread is not None and self.thread.is_alive() and not self.stop_event.is_set()

    def close(self):
        self.stop_event.set()
        if self.thread is not None:
            # Current bounded handler settles before its Store is closed. Interrupted
            # processes recover their durable lease on the next application start.
            self.thread.join()
