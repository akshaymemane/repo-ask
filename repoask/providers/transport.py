"""Bounded HTTP transport for model providers.

The production transport ignores proxy environment variables, keeps default TLS
verification, follows no redirects (a 3xx is returned as a response so the service can
reject it) and enforces a response-body byte limit plus an overall deadline. Tests inject
any object with ``send(request, *, cancel_event=None) -> TransportResponse``.
"""
from dataclasses import dataclass, field
import http.client
import socket
import ssl
import time
from urllib.error import HTTPError, URLError
from urllib.request import (HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request,
                            build_opener)


@dataclass(frozen=True)
class TransportRequest:
    method: str
    url: str
    # Headers can carry Authorization; keep them out of repr/logs.
    headers: dict = field(repr=False)
    body: bytes | None = field(default=None, repr=False)
    timeout: float = 60.0
    max_response_bytes: int = 4 * 1024 * 1024


@dataclass(frozen=True)
class TransportResponse:
    status: int
    headers: dict
    body: bytes = field(repr=False)


class TransportFailure(Exception):
    """Base for transport failures. Messages are fixed strings without request data."""


class TransportTimeout(TransportFailure):
    pass


class TransportUnavailable(TransportFailure):
    pass


class ResponseTooLarge(TransportFailure):
    pass


class TransportCancelled(TransportFailure):
    pass


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


_CHUNK = 64 * 1024


def _read_bounded(stream, limit, deadline, cancel_event):
    parts, total = [], 0
    while True:
        if cancel_event is not None and cancel_event.is_set():
            raise TransportCancelled('cancelled')
        if time.monotonic() > deadline:
            raise TransportTimeout('timeout')
        # Tighten the socket deadline after connect and after every partial read.
        raw = getattr(getattr(stream, 'fp', None), 'raw', None)
        sock = getattr(raw, '_sock', None)
        if sock is not None:
            sock.settimeout(max(0.001, deadline - time.monotonic()))
        # read1 avoids waiting to fill a whole chunk while a peer trickles bytes.
        read = getattr(stream, 'read1', stream.read)
        chunk = read(min(_CHUNK, limit + 1 - total))
        if time.monotonic() > deadline:
            raise TransportTimeout('timeout')
        if not chunk:
            return b''.join(parts)
        parts.append(chunk)
        total += len(chunk)
        if total > limit:
            raise ResponseTooLarge('too large')


class UrllibTransport:
    """Production transport. Never reads proxy settings and never follows redirects."""

    def __init__(self, *, ssl_context=None):
        self._opener = build_opener(ProxyHandler({}), _NoRedirect(),
                                    HTTPSHandler(context=ssl_context or ssl.create_default_context()))

    def send(self, request, *, cancel_event=None):
        deadline = time.monotonic() + request.timeout
        outcome = None
        try:
            prepared = Request(request.url, data=request.body, method=request.method,
                               headers=dict(request.headers))
            try:
                response = self._opener.open(prepared, timeout=request.timeout)
            except HTTPError as error:
                response = error
            try:
                status = response.status if hasattr(response, 'status') and response.status else response.code
                headers = {k.lower(): v for k, v in response.headers.items()} if response.headers else {}
                body = _read_bounded(response, request.max_response_bytes, deadline, cancel_event)
            finally:
                response.close()
            return TransportResponse(int(status), headers, body)
        except TransportFailure as failure:
            outcome = type(failure)
        except (socket.timeout, TimeoutError):
            outcome = TransportTimeout
        except URLError as error:
            outcome = TransportTimeout if isinstance(error.reason, (socket.timeout, TimeoutError)) else TransportUnavailable
        except (OSError, http.client.HTTPException, ValueError):
            outcome = TransportUnavailable
        # Raised outside the except suites so no request/response detail is chained.
        raise outcome('transport failure')
