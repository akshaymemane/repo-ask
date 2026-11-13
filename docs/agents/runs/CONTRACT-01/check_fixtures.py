"""CONTRACT-01 fixture consistency check (standard library only).

Run from the repository root:  python3 -I docs/agents/runs/CONTRACT-01/check_fixtures.py
Checks fixtures against docs/contracts/README.md rules and the current legacy code shapes.
It validates documents only; it does not prove any runtime behavior.
"""

import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
from repoask.answer import respond  # noqa: E402
from repoask.index import CodeIndex, load_demos  # noqa: E402

fixtures = json.loads((ROOT / "docs/contracts/m0-fixtures.json").read_text())
readme = (ROOT / "docs/contracts/README.md").read_text()
errors = []


def check(condition, message):
    if not condition:
        errors.append(message)


TS = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$")
JOB_ID = re.compile(r"^job_[0-9a-f]{24}$")
STATES = ["queued", "leased", "succeeded", "failed", "cancelled", "needs_reconciliation"]
NAV = [("ask", "available"), ("repositories", "read_only"), ("settings", "read_only")]

check(fixtures["contract"] == "opendevin.m0/1", "packet contract id")
check("opendevin.m0/1" in readme, "README contract id")

# Legacy shapes must equal what the current code produces.
index = CodeIndex(load_demos(ROOT / "repoask/examples"))
live_repos = index.list_repos()
fixture_repos = fixtures["legacy"]["repos_demo"]["repos"]
check(set(fixtures["legacy"]["repos_demo"]) == {"repos", "model"}, "legacy repos top-level keys")
check([r["name"] for r in fixture_repos] == [r["name"] for r in live_repos], "legacy repo names/order")
for fixture_repo, live in zip(fixture_repos, live_repos):
    check(set(fixture_repo) == set(live), f"legacy repo keys {fixture_repo['name']}")
    for key in ("revision", "files", "demo", "limited"):
        check(fixture_repo[key] == live[key], f"legacy repo {fixture_repo['name']}.{key}")
live_ask = respond(index, None, ["orders-db"], "Where is the orders table defined?", "")
check(fixtures["legacy"]["ask_search_demo"] == live_ask, "legacy ask search shape/value")

# Workspace summaries.
WS_KEYS = {"contract", "generated_at", "product", "mode", "catalog", "providers", "execution",
           "storage", "secrets", "navigation"}
for name, ws in fixtures["workspace"].items():
    where = f"workspace.{name}"
    check(set(ws) == WS_KEYS, f"{where} keys")
    check(ws["contract"] == "opendevin.workspace/m0.1", f"{where} contract")
    check(TS.match(ws["generated_at"]) is not None, f"{where} generated_at")
    check(ws["product"] == "OpenDevin", f"{where} product")
    check(ws["mode"] in {"demo", "local"}, f"{where} mode (connected never emitted in M0)")
    cat = ws["catalog"]
    check(set(cat) == {"source", "repository_count", "limited_count", "repos_endpoint", "github"}, f"{where} catalog keys")
    check(cat["source"] == {"demo": "demo_fixtures", "local": "local_checkouts"}[ws["mode"]], f"{where} source/mode")
    check(cat["repos_endpoint"] == "/api/repos", f"{where} repos_endpoint")
    check(cat["github"]["status"] == "not_available", f"{where} github")
    ans = ws["providers"]["answer"]
    check(set(ans) == {"status", "adapter", "model", "destination"}, f"{where} answer keys")
    if ans["status"] == "configured":
        check(ans["adapter"] == "ollama" and ans["destination"] == "loopback" and ans["model"], f"{where} configured answer")
    else:
        check(ans == {"status": "not_configured", "adapter": None, "model": None, "destination": None}, f"{where} unconfigured answer")
    check(ws["providers"]["profiles"]["status"] == "not_available", f"{where} profiles")
    check(ws["execution"]["status"] == "not_available", f"{where} execution")
    st = ws["storage"]
    check(set(st) == {"persistent", "schema_version", "status"}, f"{where} storage keys")
    check((st["status"] == "disabled") == (st["schema_version"] is None), f"{where} storage disabled<->null")
    check(set(ws["secrets"]) == {"backend", "available", "reason"}, f"{where} secrets keys")
    check(ws["secrets"]["backend"] == "unavailable" and ws["secrets"]["available"] is False, f"{where} secrets fail closed")
    check([(n["id"], n["status"]) for n in ws["navigation"]] == NAV, f"{where} navigation ids/status")
    for item in ws["navigation"]:
        check(set(item) == {"id", "label", "href", "status"} and item["href"] == f"#/{item['id']}", f"{where} nav item")

# Health.
H_KEYS = {"contract", "status", "checked_at", "components", "recent_failures"}
C_KEYS = {"api", "index", "storage", "jobs", "secrets", "model"}
for name, health in fixtures["health"].items():
    where = f"health.{name}"
    check(set(health) == H_KEYS, f"{where} keys")
    check(health["contract"] == "opendevin.health/m0.1", f"{where} contract")
    check(TS.match(health["checked_at"]) is not None, f"{where} checked_at")
    comps = health["components"]
    check(set(comps) == C_KEYS, f"{where} component keys")
    check(set(comps["storage"]) == {"status", "persistent", "schema_version", "expected_schema_version", "size_bytes"}, f"{where} storage keys")
    jobs = comps["jobs"]
    check(set(jobs) == {"status", "counts", "expired_leases", "oldest_queued_age_ms", "workers_running"}, f"{where} jobs keys")
    check(list(jobs["counts"]) == STATES, f"{where} six job states in order")
    check(jobs["workers_running"] == 0, f"{where} no worker in M0")
    degraded = jobs["counts"]["needs_reconciliation"] > 0 or jobs["expired_leases"] > 0
    check(health["status"] == ("degraded" if degraded else "ok"), f"{where} overall status rule")
    if comps["storage"]["status"] == "disabled":
        check(jobs["status"] == "disabled", f"{where} jobs disabled with storage")
    else:
        check(jobs["status"] == ("degraded" if degraded else "ok"), f"{where} jobs status rule")
    check(comps["secrets"] == {"status": "unavailable", "backend": "unavailable", "code": "secret_store_unavailable"}, f"{where} secrets")
    check(comps["model"]["probed"] is False, f"{where} model never probed")
    check(len(health["recent_failures"]) <= 5, f"{where} failure bound")
    for failure in health["recent_failures"]:
        check(set(failure) == {"job_id", "kind", "code", "at"}, f"{where} failure keys (no messages)")
        check(JOB_ID.match(failure["job_id"]) is not None and TS.match(failure["at"]) is not None, f"{where} failure id/ts")

# Errors: new shape has both keys, codes documented in README table.
for name, err in fixtures["errors"].items():
    if name.startswith("_"):
        continue
    check(set(err["body"]) == {"error", "code"}, f"errors.{name} body keys")
    check(f"`{err['body']['code']}`" in readme, f"errors.{name} code documented")

# Safety: no absolute paths or secret-looking material anywhere in fixtures.
text = json.dumps(fixtures)
check(not re.search(r"/Users/|/home/|[A-Za-z]:\\\\", text), "no absolute paths in fixtures")
check(not re.search(r"(sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|BEGIN [A-Z ]*PRIVATE KEY)", text), "no secret-like values")

if errors:
    print("FAIL")
    for message in errors:
        print(" -", message)
    sys.exit(1)
print(f"OK: {len(fixtures['workspace'])} workspace, {len(fixtures['health'])} health, "
      f"{len([k for k in fixtures['errors'] if not k.startswith('_')])} error fixtures consistent")
