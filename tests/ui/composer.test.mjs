// Composer: send/cancel, repository chips via + picker and @ mentions, drafts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBrowser, input, install, keydown, settle, visibleText } from "./dom.mjs";

const url = pathToFileURL(fileURLToPath(new URL("../../repoask/web/composer.js", import.meta.url))).href;
let loads = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ctx = (i, name) => ({ repository_id: `gh:${i}`, name: `akshaymemane/${name}`, kind: "github", eligible: true, status: "ready", active_snapshot: { mode: "lexical_only" }, active_run: null });

async function setup(options = {}) {
  const b = createBrowser("<!doctype html><html><body><main id=host></main></body></html>", { respond: () => ({ status: 404, body: {} }) });
  install(b);
  const session = new Map();
  globalThis.sessionStorage = { getItem: (k) => session.get(k) ?? null, setItem: (k, v) => session.set(k, v), removeItem: (k) => session.delete(k) };
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  loads += 1;
  const { createComposer } = await import(`${url}?c=${loads}`);
  const log = { sent: [], scopes: [], cancels: 0 };
  const all = [ctx(1, "rcnl-app"), ctx(2, "central-deploy-manager"), ctx(5, "cube-workbench")];
  const request = async (path) => {
    if (!path.startsWith("/api/context")) return { items: [] };
    const query = new URL(path, "http://x").searchParams.get("query") ?? "";
    return { items: all.filter((item) => item.name.includes(query)), next_cursor: null };
  };
  const make = (extra = {}) => {
    const composer = createComposer({
      request, draftKey: "draft:c1",
      onSend: async (payload) => { log.sent.push(payload); },
      onScopeChange: async (ids) => { log.scopes.push(ids); },
      onCancel: async () => { log.cancels += 1; },
      ...options, ...extra,
    });
    b.document.getElementById("host").append(composer.root);
    return composer;
  };
  return { b, make, log, session };
}

const textarea = (c) => c.root.querySelector("textarea");
const byLabel = (root, label) => root.querySelectorAll("button").find((x) => x.getAttribute("aria-label") === label) ?? null;
const chipNames = (c) => c.root.querySelectorAll(".chip-repo").map((x) => x.querySelector(".chip-label").textContent);

test("Enter sends with chosen repositories, Shift+Enter does not, empty does nothing", async () => {
  const { make, log } = await setup();
  const c = make();
  assert.equal(textarea(c).getAttribute("placeholder"), "Ask about your code, or describe a change…");
  c.setChips([{ id: "gh:1", name: "rcnl-app" }]);
  input(textarea(c), "   ");
  keydown(textarea(c), "Enter");
  await settle();
  assert.equal(log.sent.length, 0);
  input(textarea(c), "What does rcnl-app do?");
  assert.equal(keydown(textarea(c), "Enter", { shiftKey: true }).defaultPrevented, false);
  assert.equal(log.sent.length, 0);
  keydown(textarea(c), "Enter");
  await settle();
  assert.deepEqual(log.sent, [{ text: "What does rcnl-app do?", repositoryIds: ["gh:1"] }]);
  assert.equal(textarea(c).value, "");
});

test("Enter already handled by the @ menu is ignored", async () => {
  const { make, log } = await setup();
  const c = make();
  input(textarea(c), "hi");
  keydown(textarea(c), "Enter", { defaultPrevented: true });
  await settle();
  assert.equal(log.sent.length, 0);
});

test("busy state shows Cancel and calls onCancel", async () => {
  const { make, log } = await setup();
  const c = make();
  c.setBusy(true);
  const send = c.root.querySelector(".composer-send");
  assert.equal(send.textContent, "Cancel");
  input(textarea(c), "next question");
  keydown(textarea(c), "Enter");
  send.click();
  await settle();
  assert.equal(log.sent.length, 0, "no send while busy");
  assert.equal(log.cancels, 1);
  c.setBusy(false);
  assert.equal(send.getAttribute("aria-label"), "Send");
});

test("removing a chip calls onScopeChange; a rejected change restores it with an error", async () => {
  const { make, log } = await setup();
  const c = make();
  c.setChips([{ id: "gh:1", name: "rcnl-app" }, { id: "gh:2", name: "central-deploy-manager" }]);
  byLabel(c.root, "Remove rcnl-app").click();
  await settle();
  assert.deepEqual(log.scopes, [["gh:2"]]);
  assert.deepEqual(chipNames(c), ["central-deploy-manager"]);
  const failing = make({ onScopeChange: async () => { throw new Error("Someone changed this conversation's repositories."); } });
  failing.setChips([{ id: "gh:1", name: "rcnl-app" }]);
  byLabel(failing.root, "Remove rcnl-app").click();
  await settle();
  assert.deepEqual(chipNames(failing), ["rcnl-app"]);
  assert.match(visibleText(failing.root), /Someone changed this conversation's repositories\./);
});

test("+ opens the picker and adds the chosen repositories", async () => {
  const { b, make, log } = await setup();
  const c = make();
  c.setChips([{ id: "gh:1", name: "rcnl-app" }]);
  const plus = byLabel(c.root, "Add repositories");
  plus.click();
  await settle();
  const row = b.document.querySelectorAll(".picker-row").find((r) => visibleText(r).includes("cube-workbench"));
  row.querySelector("input").click();
  b.document.querySelectorAll("dialog button").find((x) => x.textContent.startsWith("Add")).click();
  await settle();
  assert.deepEqual(log.scopes, [["gh:1", "gh:5"]]);
  assert.deepEqual(chipNames(c), ["rcnl-app", "cube-workbench"]);
});

test("@ mention adds a chip without leaving @ text behind", async () => {
  const { b, make, log } = await setup();
  const c = make();
  input(textarea(c), "Compare with @cube");
  await wait(190); await settle();
  keydown(textarea(c), "Enter");
  await settle();
  assert.deepEqual(log.scopes, [["gh:5"]]);
  assert.deepEqual(chipNames(c), ["cube-workbench"]);
  assert.equal(textarea(c).value, "Compare with ");
  assert.equal(log.sent.length, 0, "picking a mention does not send");
  assert.ok(b.document.querySelector('[role="listbox"]').hidden);
});

test("draft text survives re-creating the composer and clears after send", async () => {
  const { make, session } = await setup();
  const first = make();
  input(textarea(first), "half-written question");
  first.root.remove();
  const second = make();
  assert.equal(textarea(second).value, "half-written question");
  keydown(textarea(second), "Enter");
  await settle();
  assert.equal(session.has("draft:c1"), false);
});

test("chips:false hides repository controls", async () => {
  const { make } = await setup();
  const c = make({ chips: false, placeholder: "Guide the agent while it works…" });
  assert.equal(byLabel(c.root, "Add repositories"), null);
  assert.equal(textarea(c).getAttribute("placeholder"), "Guide the agent while it works…");
});
