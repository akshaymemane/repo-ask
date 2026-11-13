"""Run the local Repo Ask web app."""

from argparse import ArgumentParser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import signal
from subprocess import SubprocessError
from urllib.parse import parse_qs, urlsplit

from .answer import Ollama, respond
from .index import CodeIndex, MAX_REPOS, load_demos, load_git
from .platform import Platform
from .platform.clock import now_ms
from .platform.errors import PlatformError
from .platform.workspace import build_workspace_summary, build_health


ROOT = Path(__file__).resolve().parent
ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
}


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "RepoAsk"
    sys_version = ""

    def setup(self):
        self.request.settimeout(15)
        super().setup()

    def log_message(self, format, *args):
        # Source filenames and question text stay out of request logs.
        return

    def allowed_host(self):
        port = self.server.server_port
        return self.headers.get("Host") in {f"127.0.0.1:{port}", f"localhost:{port}"}

    def send_data(self, status, content, body):
        self.send_response(status)
        self.send_header("Content-Type", content)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; script-src 'self'; style-src 'self'; "
            "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        )
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_json(self, status, value):
        self.send_data(status, "application/json; charset=utf-8", json.dumps(value).encode("utf-8"))

    def do_GET(self):
        if not self.allowed_host():
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "Use the local URL printed by Repo Ask."})
            return
        url = urlsplit(self.path)
        if url.path in ASSETS:
            filename, mime = ASSETS[url.path]
            self.send_data(HTTPStatus.OK, mime, (ROOT / "web" / filename).read_bytes())
        elif url.path == "/api/repos":
            self.send_json(HTTPStatus.OK, {
                "repos": self.server.index.list_repos(),
                "model": self.server.model.model if self.server.model else None,
            })
        elif url.path in {"/api/workspace", "/api/health"}:
            if url.query:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": "This status route takes no query parameters.", "code": "bad_request"})
                return
            builder = build_workspace_summary if url.path == "/api/workspace" else build_health
            try:
                result = builder(self.server.index, self.server.model,
                                 getattr(self.server, "platform", None), now=now_ms())
            except PlatformError as error:
                self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Workspace status is temporarily unavailable.", "code": error.code})
            except Exception:
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Workspace status is unavailable.", "code": "internal"})
            else:
                self.send_json(HTTPStatus.OK, result)
        elif url.path == "/api/source":
            self.send_source(url.query)
        else:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Page not found."})

    def send_source(self, query):
        try:
            params = parse_qs(query, max_num_fields=5, strict_parsing=True)
            names = ("repo", "revision", "path", "start", "end")
            if set(params) != set(names) or any(len(params[name]) != 1 for name in names):
                raise ValueError
            repo, revision, path, start, end = (params[name][0] for name in names)
            start, end = int(start), int(end)
        except ValueError:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid source request."})
            return
        try:
            source = self.server.index.source(repo, revision, path, start, end)
        except KeyError:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "This file is unavailable in the current index."})
        except ValueError as error:
            self.send_json(HTTPStatus.CONFLICT, {"error": str(error)})
        else:
            self.send_json(HTTPStatus.OK, source)

    def do_POST(self):
        origin = self.headers.get("Origin")
        if not self.allowed_host() or (origin and origin != f"http://{self.headers['Host']}"):
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "This request must come from Repo Ask."})
            return
        if self.path != "/api/ask":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Page not found."})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {"error": "Send an application/json request."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 1 <= length <= 32 * 1024:
                raise ValueError
            request = json.loads(self.rfile.read(length))
            question, previous, repos = self.validate_question(request)
        except (TimeoutError, ValueError, TypeError, KeyError, RecursionError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Enter a question and select valid repositories."})
            return
        response = respond(self.server.index, self.server.model, repos, question, previous)
        self.send_json(HTTPStatus.OK, response)

    def validate_question(self, request):
        question = request["question"]
        previous = request.get("previous", "")
        repos = request["repos"]
        if not isinstance(question, str) or not 1 <= len(question.strip()) <= 2000:
            raise ValueError
        if not isinstance(previous, str) or len(previous) > 2000:
            raise ValueError
        if not isinstance(repos, list) or not 1 <= len(repos) <= MAX_REPOS:
            raise ValueError
        if any(not isinstance(repo, str) or repo not in self.server.index.snapshots for repo in repos):
            raise ValueError
        return question.strip(), previous.strip(), list(dict.fromkeys(repos))


def main():
    parser = ArgumentParser(description="Explore local Git repositories with clickable source citations.")
    parser.add_argument("--repo", metavar="NAME=PATH", action="append", default=[],
                        help="Index HEAD of a local Git checkout. Repeat to add repositories.")
    parser.add_argument("--model", metavar="NAME", help="Generate answers with this local Ollama model.")
    parser.add_argument("--ollama-port", type=int, default=11434, help="Loopback port for Ollama.")
    parser.add_argument("--data-dir", type=Path, help="Persist workspace metadata in this directory; omitted uses memory.")
    parser.add_argument("--port", type=int, default=8765, help="Loopback port for the web app.")
    args = parser.parse_args()
    if len(args.repo) > MAX_REPOS:
        parser.error(f"Up to {MAX_REPOS} repositories are supported.")
    if not (1 <= args.port <= 65535 and 1 <= args.ollama_port <= 65535):
        parser.error("Ports must be between 1 and 65535.")

    snapshots = []
    names = set()
    for spec in args.repo:
        name, separator, directory = spec.partition("=")
        if not separator or not directory or not re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", name):
            parser.error("Use --repo NAME=PATH with letters, numbers, dots, underscores, or hyphens in NAME.")
        if name in names:
            parser.error(f"Repository name {name} is already in use.")
        try:
            snapshot = load_git(name, Path(directory))
        except (OSError, ValueError, SubprocessError) as error:
            detail = str(error) if isinstance(error, ValueError) else "Check the path, Git installation, and committed HEAD."
            parser.error(f"Could not index {name}. {detail}")
        snapshots.append(snapshot)
        names.add(name)
    if not snapshots:
        snapshots = load_demos(ROOT / "examples")

    index = CodeIndex(snapshots)
    model = Ollama(args.model, args.ollama_port) if args.model else None
    try:
        platform = Platform.open(args.data_dir.expanduser() if args.data_dir else None)
    except PlatformError:
        index.db.close()
        parser.exit(1, "Could not open workspace storage. Check the directory and database compatibility.\n")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), RequestHandler)
    except OSError as error:
        platform.close()
        index.db.close()
        parser.exit(1, f"Could not start Repo Ask on port {args.port}. {error.strerror}\n")
    try:
        with server:
            server.index = index
            server.platform = platform
            server.model = model
            print(f"Indexed {len(snapshots)} repositories. Open http://127.0.0.1:{args.port}", flush=True)
            def stop_server(_signum, _frame):
                raise KeyboardInterrupt
            signal.signal(signal.SIGTERM, stop_server)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
    finally:
        platform.close()
        index.db.close()

if __name__ == "__main__":
    main()
