// Chat-style Ask: landing composer creates a titled conversation, mid-conversation scope, recent titles.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createBrowser, input, install, keydown, settle, visibleText } from "./dom.mjs";
import { createAskPanel, titleFrom } from "../../repoask/web/ask.js";
import { declaredStyle } from "./css.mjs";

const html = readFileSync(new URL("../../repoask/web/index.html", import.meta.url), "utf8");
const storage = () => { const map = new Map(); return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) }; };
const ctx = (id, name) => ({ repository_id: id, name: `akshaymemane/${name}`, kind: "github", eligible: true, status: "ready", active_snapshot: { mode: "lexical_only", coverage: { files: 3 } }, active_run: null });
const REPOS = { "gh:1": ctx("gh:1", "rcnl-app"), "gh:2": ctx("gh:2", "central-deploy-manager"), "gh:3": ctx("gh:3", "cube-workbench"), "gh:4": ctx("gh:4", "edgemesh"), "gh:5": ctx("gh:5", "mysociety") };

async function boot(respond, { hash = "#/ask" } = {}) {
  const b = createBrowser(html, { hash, respond });
  b.window.sessionStorage = storage();
  b.window.confirm = () => true;
  install(b);
  globalThis.sessionStorage = b.window.sessionStorage;
  globalThis.localStorage = storage();
  const recent = [];
  const headers = [];
  const shell = { setRecent: (items) => recent.splice(0, recent.length, ...items), setHeader: (h) => headers.push(h) };
  const ui = await createAskPanel({ host: b.document.getElementById("view-ask"), shell });
  await settle();
  return { ...b, ui, recent, headers, button: (t) => ui.panel.querySelectorAll("button").find((n) => n.textContent === t) };
}

test("titleFrom trims to 60 characters at a word boundary", () => {
  assert.equal(titleFrom("What does rcnl-app do and how is it structured?"), "What does rcnl-app do and how is it structured?");
  assert.equal(titleFrom("Explain how the deploy manager schedules rollouts across every edge region we run"), "Explain how the deploy manager schedules rollouts across…");
});

test("first send from the landing page creates a titled conversation with chosen repos, navigates and sends", async () => {
  const posts = [];
  let conversation = null;
  const b = await boot((m, u, o) => {
    if (u === "/api/conversations" && m === "GET") return { items: conversation ? [conversation] : [] };
    if (u === "/api/conversations" && m === "POST") { posts.push(JSON.parse(o.body)); conversation = { id: "conv_new", title: posts[0].title, scope_revision: 1, repository_ids: posts[0].repository_ids, messages: [], runs: [], plans: [] }; return conversation; }
    if (u === "/api/conversations/conv_new") return conversation;
    if (u === "/api/conversations/conv_new/messages") { posts.push(JSON.parse(o.body)); return { id: "run", state: "queued" }; }
    if (u.startsWith("/api/context/repositories")) return { items: Object.values(REPOS), next_cursor: null };
    const m2 = /^\/api\/repositories\/(.+)\/context$/.exec(u);
    if (m2) return REPOS[decodeURIComponent(m2[1])];
    return { status: 404, body: { code: "not_found" } };
  });
  assert.match(visibleText(b.ui.panel), /What are we working on\?/);
  b.ui.panel.querySelectorAll("button").find((n) => n.getAttribute("aria-label") === "Add repositories").click();
  await settle(30);
  b.document.querySelectorAll(".picker-row").find((r) => visibleText(r).includes("rcnl-app")).querySelector("input").click();
  b.document.querySelectorAll("dialog.modal button").find((n) => n.textContent.startsWith("Add")).click();
  await settle();
  const box = b.ui.panel.querySelector("textarea");
  input(box, "What does rcnl-app do and how is it structured?");
  keydown(box, "Enter");
  await settle(40);
  assert.deepEqual(posts[0], { title: "What does rcnl-app do and how is it structured?", repository_ids: ["gh:1"] });
  assert.equal(b.window.location.hash, "#/ask/conv_new");
  assert.equal(posts[1].content, "What does rcnl-app do and how is it structured?");
  assert.equal(posts[1].intent, "answer");
  assert.deepEqual(b.recent.map((r) => r.title), ["What does rcnl-app do and how is it structured?"]);
});

test("adding a 5th repository mid-conversation patches scope, logs it and marks the plan stale", async () => {
  let c = { id: "c", title: "Deploy flow", scope_revision: 4, repository_ids: ["gh:1", "gh:2", "gh:3", "gh:4"], runs: [],
    messages: [{ id: "m1", role: "user", content: "Plan it", state: "complete", created_at: 1 }], plans: [{ id: "plan_1", title: "Deploy plan", latest_version_id: "v1", created_at: 2 }] };
  const patches = [];
  const b = await boot((m, u, o) => {
    if (u === "/api/conversations") return { items: [c] };
    if (u === "/api/conversations/c") { if (m === "PATCH") { patches.push(JSON.parse(o.body)); c = { ...c, repository_ids: patches.at(-1).repository_ids, scope_revision: 5 }; } return c; }
    if (u === "/api/plans/plan_1") return { id: "plan_1", latest_version_id: "v1", version: { version: 1, content: { steps: [{}, {}] }, readiness: { state: "ready", blocking_reasons: [] } } };
    if (u.startsWith("/api/context/repositories")) { const q = new URL(u, "http://x").searchParams.get("query") ?? ""; return { items: Object.values(REPOS).filter((r) => r.name.includes(q)), next_cursor: null }; }
    const m2 = /^\/api\/repositories\/(.+)\/context$/.exec(u);
    if (m2) return REPOS[decodeURIComponent(m2[1])];
    return { status: 404, body: { code: "not_found" } };
  }, { hash: "#/ask/c" });
  await settle(20);
  const box = b.ui.panel.querySelector("textarea");
  input(box, "Also check @mysoc");
  await new Promise((resolve) => setTimeout(resolve, 200));
  await settle();
  keydown(box, "Enter");
  await settle(40);
  assert.deepEqual(patches, [{ repository_ids: ["gh:1", "gh:2", "gh:3", "gh:4", "gh:5"], expected_revision: 4 }]);
  const text = visibleText(b.ui.panel);
  assert.match(text, /Added mysociety/);
  assert.match(text, /Made before mysociety was added · Regenerate/);
  assert.deepEqual(b.ui.panel.querySelectorAll(".chip-repo .chip-label").map((n) => n.textContent), ["rcnl-app", "central-deploy-manager", "cube-workbench", "edgemesh", "mysociety"]);
  assert.deepEqual(b.headers.at(-1).pills.slice(0, 5).map((p) => p.text), ["rcnl-app", "central-deploy-manager", "cube-workbench", "edgemesh", "mysociety"]);
});

test("recent list shows titles and falls back to Untitled, never ids", async () => {
  const b = await boot((m, u) => {
    if (u === "/api/conversations") return { items: [{ id: "conv_1", title: "Deploy flow", updated_at: Date.now() - 120000 }, { id: "conv_2", title: "", updated_at: Date.now() - 7200000 }] };
    return { status: 404, body: { code: "not_found" } };
  });
  assert.deepEqual(b.recent.map((r) => r.title), ["Deploy flow", "Untitled · 2 h ago"]);
  assert.deepEqual(b.recent.map((r) => r.href), ["#/ask/conv_1", "#/ask/conv_2"]);
});

test("unassigned model roles disable Ask and Generate plan before sending, on the landing page and in a conversation", async () => {
  const conversation = { id: "conv_1", title: "Deploy flow", scope_revision: 1, repository_ids: [], messages: [], runs: [], plans: [] };
  const roles = { settings: { local_only: true }, roles: { ask: { status: "unassigned" }, planning: { status: "ready", model: "sonnet", destination: { kind: "local" } } } };
  const respond = (m, u) => {
    if (u === "/api/conversations") return { items: [conversation] };
    if (u === "/api/conversations/conv_1") return conversation;
    if (u === "/api/settings/model-roles") return roles;
    return { status: 404, body: { code: "not_found" } };
  };
  for (const hash of ["#/ask", "#/ask/conv_1"]) {
    const b = await boot(respond, { hash });
    await settle(10);
    assert.equal(b.button("Ask").disabled, true, hash);
    assert.equal(b.button("Generate plan").disabled, false, hash);
    assert.match(visibleText(b.ui.panel), /No model is set for answering questions\. Choose a model in Settings/, hash);
  }
  roles.roles.planning = { status: "unassigned" };
  const b = await boot(respond, { hash: "#/ask/conv_1" });
  await settle(10);
  assert.equal(b.button("Generate plan").disabled, true);
  assert.match(visibleText(b.ui.panel), /No model is set for answering questions or planning\./);
});

test("citations open in the side panel when Ask has one", async () => {
  const cite = { repository_id: "gh:1", snapshot_id: "s", revision: "d8f5918f985503cd5a2fd0c0956abd32b4800f3c", path: "src/lib/api.ts", start_line: 2, end_line: 2 };
  const c = { id: "c", title: "T", scope_revision: 1, repository_ids: ["gh:1"], runs: [], plans: [], messages: [{ id: "m", role: "assistant", state: "complete", content: "See", citations: [cite], created_at: 1 }] };
  const b = createBrowser(html, { hash: "#/ask/c", respond: (m, u) => {
    if (u === "/api/conversations") return { items: [c] };
    if (u === "/api/conversations/c") return c;
    if (u === "/api/repositories/gh%3A1/context") return { ...REPOS["gh:1"], active_snapshot: { mode: "lexical_only", branch: "main" } };
    if (u.startsWith("/api/context/source")) return { revision: cite.revision, path: cite.path, first_line: 1, lines: ["a", "b", "c"], total_lines: 3 };
    return { status: 404, body: {} };
  } });
  b.window.sessionStorage = storage();
  install(b);
  const { createSidePanel } = await import("../../repoask/web/panel.js");
  const sidePanel = createSidePanel(b.document.getElementById("side-panel"));
  const ui = await createAskPanel({ host: b.document.getElementById("view-ask"), sidePanel });
  await settle();
  ui.panel.querySelector("button.cite").click();
  await settle();
  const side = b.document.getElementById("side-panel");
  assert.equal(side.hidden, false);
  assert.match(visibleText(side), /akshaymemane\/rcnl-app · main @ d8f5918/);
  assert.equal(side.querySelectorAll(".code-line.hl").length, 1);
});

test("choosing repositories after no match clears the routing notice and sends the waiting question", async () => {
  const posts = [];
  let conversation = null;
  const b = await boot((m, u, o) => {
    if (u === "/api/conversations" && m === "GET") return { items: conversation ? [conversation] : [] };
    if (u === "/api/conversations" && m === "POST") { conversation = { id: "conv_nm", title: JSON.parse(o.body).title, scope_revision: 1, repository_ids: [], messages: [], runs: [], plans: [] }; return conversation; }
    if (u === "/api/conversations/conv_nm") { if (m === "PATCH") conversation = { ...conversation, repository_ids: JSON.parse(o.body).repository_ids, scope_revision: 2 }; return conversation; }
    if (u === "/api/route") return { status: "no_match", candidates: [], selected_repository_ids: [] };
    if (u === "/api/conversations/conv_nm/messages") { posts.push(JSON.parse(o.body)); return { id: "run", state: "queued" }; }
    if (u.startsWith("/api/context/repositories")) return { items: Object.values(REPOS), next_cursor: null };
    const m2 = /^\/api\/repositories\/(.+)\/context$/.exec(u);
    if (m2) return REPOS[decodeURIComponent(m2[1])];
    return { status: 404, body: { code: "not_found" } };
  });
  const box = b.ui.panel.querySelector("textarea");
  input(box, "How does checkout create an order?");
  keydown(box, "Enter");
  await settle(60);
  assert.equal(b.window.location.hash, "#/ask/conv_nm");
  const text = visibleText(b.ui.panel);
  assert.match(text, /No repository matched this question\./);
  assert.equal(text.match(/No repository matched/g).length, 1, "routing notice is shown once, not repeated as a status line");
  b.button("Choose…").click();
  await settle(30);
  b.document.querySelectorAll(".picker-row").find((r) => visibleText(r).includes("rcnl-app")).querySelector("input").click();
  b.document.querySelectorAll("dialog.modal button").find((n) => n.textContent.startsWith("Add")).click();
  await settle(60);
  assert.doesNotMatch(visibleText(b.ui.panel), /No repository matched/);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].content, "How does checkout create an order?");
  assert.equal(posts[0].intent, "answer");
});

test("focusing the Ask heading overlays it instead of shifting the page (a shift swallowed the next click)", async () => {
  const css = readFileSync(new URL("../../repoask/web/styles.css", import.meta.url), "utf8");
  const b = await boot((m, u) => u === "/api/conversations" ? { items: [] } : { status: 404, body: { code: "not_found" } });
  const title = b.ui.panel.querySelector("#persistent-ask-title");
  const focused = declaredStyle(title, css, { focused: true });
  assert.equal(focused.position, "absolute", "focused heading stays out of the layout flow");
  assert.match(focused.outline || "", /solid/);
});
