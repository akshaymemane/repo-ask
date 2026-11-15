// Repositories page: one merged list, switches that save immediately, filters, detail panel.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBrowser, input, install, settle, visibleText } from "./dom.mjs";

const pageUrl = pathToFileURL(fileURLToPath(new URL("../../repoask/web/repositories.js", import.meta.url))).href;
const panelUrl = pathToFileURL(fileURLToPath(new URL("../../repoask/web/panel.js", import.meta.url))).href;
let loads = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const HASH = "c5bd264359aaf9f03b77644838ae7575855b6c53";
const catalogItem = (id, name, over = {}) => ({ id, owner: "akshaymemane", name, full_name: `akshaymemane/${name}`, language: "TypeScript", pushed_at: "2026-11-03T16:45:50Z",
  index_enabled: true, implementation_enabled: false, access_state: "accessible", default_branch: "main", visibility: "private", ...over });
const contextItem = (id, name, over = {}) => ({ repository_id: id, name: `akshaymemane/${name}`, kind: "github", eligible: true, status: "ready", implementation_enabled: false,
  active_snapshot: { id: "snap", revision: HASH, mode: "lexical_only", branch: "main", coverage: { mode: "lexical_only", files: 59, chunks: 219, skipped: { generated: 28, sensitive: 5, binary_or_sensitive: 2 } } }, active_run: null, ...over });

async function setup(overrides = {}) {
  const b = createBrowser("<!doctype html><html><body><main id=host></main><aside id=side hidden></aside></body></html>", { respond: () => ({ status: 404, body: {} }) });
  install(b);
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  loads += 1;
  const { createRepositoriesPage } = await import(`${pageUrl}?r=${loads}`);
  const { createSidePanel } = await import(`${panelUrl}?r=${loads}`);
  let catalog = [catalogItem("gh:1", "rcnl-app"), catalogItem("gh:2", "central-deploy-manager"), catalogItem("gh:3", "cube-workbench", { access_state: "inaccessible" })];
  const contexts = [contextItem("gh:1", "rcnl-app"), contextItem("gh:2", "central-deploy-manager", { status: "failed", active_snapshot: null }), contextItem("gh:3", "cube-workbench")];
  const calls = [];
  const request = async (path, method = "GET", body) => {
    calls.push([method, path, body]);
    if (overrides[`${method} ${path.split("?")[0]}`]) return overrides[`${method} ${path.split("?")[0]}`]({ path, body, catalog });
    if (path.startsWith("/api/repositories?")) return { items: catalog, next_cursor: null };
    if (path.startsWith("/api/context/repositories?")) return { items: contexts, next_cursor: null };
    if (path === "/api/settings/model-roles") return { roles: { embedding: { status: "unassigned" } }, settings: { local_only: true } };
    if (path === "/api/github/connections") return { connections: [{ id: "ghc", status: "connected", last_refresh_at: Date.now() - 300000 }] };
    if (method === "PATCH" && path.startsWith("/api/repositories/")) {
      const id = decodeURIComponent(path.split("/")[3]);
      catalog = catalog.map((item) => item.id === id ? { ...item, ...body } : item);
      return catalog.find((item) => item.id === id);
    }
    const one = /^\/api\/repositories\/(.+)\/context$/.exec(path);
    if (one) return contexts.find((c) => c.repository_id === decodeURIComponent(one[1]));
    if (path.endsWith("/exclusions")) return { exclusions: ["dist/**"] };
    return {};
  };
  const panel = createSidePanel(b.document.getElementById("side"));
  const page = createRepositoriesPage({ host: b.document.getElementById("host"), request, panel, shell: { setHeader() {} } });
  await page.refresh();
  await settle();
  return { b, page, calls, host: b.document.getElementById("host"), side: b.document.getElementById("side") };
}

const row = (host, name) => host.querySelectorAll("tr").find((tr) => visibleText(tr).includes(name));
const switchIn = (tr, label) => tr.querySelectorAll('[role="switch"]').find((s) => s.getAttribute("aria-label").startsWith(label));

test("one merged table with plain status, no hashes, and a keyword-only banner", async () => {
  const { host } = await setup();
  const text = visibleText(host);
  assert.deepEqual(host.querySelectorAll("tbody tr").map((tr) => tr.querySelector("th").textContent.split("TypeScript")[0]), ["rcnl-app", "central-deploy-manager", "cube-workbench"]);
  assert.match(visibleText(row(host, "rcnl-app")), /Indexed · keyword only/);
  assert.match(visibleText(row(host, "central-deploy-manager")), /Failed/);
  assert.match(visibleText(row(host, "cube-workbench")), /No access/);
  assert.doesNotMatch(text, /[0-9a-f]{40}/);
  assert.match(text, /Answers use keyword search only\. Turn on smarter search/);
  assert.ok(host.querySelectorAll("a").find((a) => a.getAttribute("href") === "#/settings/models"));
  assert.match(text, /synced 5 min ago/);
});

test("Use in Ask saves immediately with both selection fields", async () => {
  const { host, calls } = await setup();
  switchIn(row(host, "rcnl-app"), "Use in Ask").click();
  await settle();
  assert.deepEqual(calls.find(([m]) => m === "PATCH"), ["PATCH", "/api/repositories/gh%3A1", { index_enabled: false, implementation_enabled: false }]);
  assert.equal(switchIn(row(host, "rcnl-app"), "Use in Ask").getAttribute("aria-checked"), "false");
});

test("a failed save reverts the switch and ignores a second click while saving", async () => {
  let patches = 0;
  const { host } = await setup({ "PATCH /api/repositories/gh%3A1": async () => { patches += 1; await wait(20); throw Object.assign(new Error("Network down"), { status: 503 }); } });
  const control = switchIn(row(host, "rcnl-app"), "Use in Ask");
  control.click();
  control.click();
  await wait(40); await settle();
  assert.equal(patches, 1);
  assert.equal(control.getAttribute("aria-checked"), "true");
  assert.match(visibleText(row(host, "rcnl-app")), /Network down/);
});

test("Allow changes asks for confirmation only the first time per repository", async () => {
  const { b, host, calls } = await setup();
  switchIn(row(host, "rcnl-app"), "Allow changes").click();
  await settle();
  const dialog = b.document.querySelector("dialog.modal");
  assert.match(visibleText(dialog), /Allow OpenDevin to push branches and open PRs in rcnl-app\? You can turn this off any time\./);
  dialog.querySelectorAll("button").find((x) => x.textContent === "Allow").click();
  await settle();
  assert.deepEqual(calls.filter(([m]) => m === "PATCH").at(-1)[2], { index_enabled: true, implementation_enabled: true });
  switchIn(row(host, "rcnl-app"), "Allow changes").click();
  await settle();
  switchIn(row(host, "rcnl-app"), "Allow changes").click();
  await settle();
  assert.equal(b.document.querySelector("dialog.modal"), null, "no second confirmation");
  assert.equal(calls.filter(([m]) => m === "PATCH").length, 3);
});

test("cancelling the Allow changes confirmation keeps it off", async () => {
  const { b, host, calls } = await setup();
  const control = switchIn(row(host, "rcnl-app"), "Allow changes");
  control.click();
  await settle();
  b.document.querySelector("dialog.modal").querySelectorAll("button").find((x) => x.textContent === "Cancel").click();
  await settle();
  assert.equal(calls.filter(([m]) => m === "PATCH").length, 0);
  assert.equal(control.getAttribute("aria-checked"), "false");
});

test("Problems filter shows failed and inaccessible repositories; search queries the server", async () => {
  const { host, calls } = await setup();
  host.querySelectorAll("button").find((x) => x.textContent === "Problems").click();
  await settle();
  assert.deepEqual(host.querySelectorAll("tbody tr").map((tr) => tr.querySelector("th").textContent.split("TypeScript")[0]), ["central-deploy-manager", "cube-workbench"]);
  input(host.querySelector('input[type="search"]'), "rcnl");
  await wait(260); await settle();
  assert.ok(calls.some(([, path]) => path.startsWith("/api/repositories?") && path.includes("query=rcnl")));
});

test("clicking a repository opens details with plain skipped reasons and its index controls", async () => {
  const { host, side } = await setup();
  row(host, "rcnl-app").querySelector("th button").click();
  await settle(20);
  assert.equal(side.hidden, false);
  const text = visibleText(side);
  assert.match(text, /akshaymemane\/rcnl-app · private · main @ c5bd264/);
  assert.match(text, /59 files indexed · 35 skipped/);
  assert.match(text, /28 generated files, 5 files that look like secrets, 2 binary or secret-like files/);
  assert.ok(side.querySelectorAll("button").find((x) => x.textContent === "Reindex akshaymemane/rcnl-app"));
  assert.ok(side.querySelectorAll("a").find((a) => a.getAttribute("href") === "https://github.com/akshaymemane/rcnl-app"));
});

test("Sync starts a catalog refresh for the connection", async () => {
  const { host, calls } = await setup();
  host.querySelectorAll("button").find((x) => x.textContent === "↻ Sync").click();
  await settle();
  assert.deepEqual(calls.find(([m, p]) => m === "POST" && p === "/api/github/refresh"), ["POST", "/api/github/refresh", { connection_id: "ghc" }]);
});

test("the saved server response wins and reloads wait for a pending save", async () => {
  let release;
  const { host, calls, page } = await setup({ "PATCH /api/repositories/gh%3A1": () => new Promise((resolve) => { release = resolve; }) });
  switchIn(row(host, "rcnl-app"), "Use in Ask").click();
  await settle();
  const reads = calls.filter(([, p]) => p.startsWith("/api/repositories?")).length;
  await page.refresh();
  assert.equal(calls.filter(([, p]) => p.startsWith("/api/repositories?")).length, reads, "no reload while saving");
  release({ ...catalogItem("gh:1", "rcnl-app"), index_enabled: true, implementation_enabled: false });
  await settle();
  assert.equal(switchIn(row(host, "rcnl-app"), "Use in Ask").getAttribute("aria-checked"), "true", "server kept it on");
});

test("a lost connection reports an unknown outcome, never retries and reloads saved state", async () => {
  let patches = 0;
  const { host, calls } = await setup({ "PATCH /api/repositories/gh%3A1": () => { patches += 1; throw new Error("Connection lost; the outcome is unknown. Refresh and inspect saved state before submitting again."); } });
  const reads = calls.filter(([, p]) => p.startsWith("/api/repositories?")).length;
  switchIn(row(host, "rcnl-app"), "Use in Ask").click();
  await settle(20);
  assert.equal(patches, 1);
  assert.match(visibleText(host), /the outcome is unknown/);
  assert.ok(calls.filter(([, p]) => p.startsWith("/api/repositories?")).length > reads, "saved state is reloaded");
});

test("large catalogs say only the first 100 are shown", async () => {
  const { host } = await setup({ "GET /api/repositories": ({ catalog }) => ({ items: catalog, next_cursor: "more" }) });
  assert.match(visibleText(host), /Showing the first 100 repositories\. Search to find others\./);
});
