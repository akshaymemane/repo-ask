// Shell: left rail, header, honest workspace pill and the slide-in side panel.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBrowser, install, keydown, settle, visibleText } from "./dom.mjs";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("repoask/web/index.html", root), "utf8");
const appUrl = pathToFileURL(fileURLToPath(new URL("repoask/web/app.js", root))).href;
const panelUrl = pathToFileURL(fileURLToPath(new URL("repoask/web/panel.js", root))).href;
const shellUrl = pathToFileURL(fileURLToPath(new URL("repoask/web/shell.js", root))).href;
const fixtures = JSON.parse(readFileSync(new URL("docs/contracts/m0-fixtures.json", root), "utf8"));
let loads = 0;

async function boot({ hash = "", api = {} } = {}) {
  const respond = (method, url) => {
    const value = api[`${method} ${url.split("?")[0]}`];
    return (typeof value === "function" ? value(url) : value) ?? { status: 404, body: { error: "Page not found." } };
  };
  const browser = createBrowser(html, { hash, respond });
  install(browser);
  loads += 1;
  await import(`${appUrl}?shell=${loads}`);
  await settle();
  return browser;
}

const legacyApi = () => ({
  "GET /api/repos": fixtures.legacy.repos_demo,
  "GET /api/workspace": fixtures.ui.legacy_fallback.workspace_response,
  "GET /api/health": fixtures.ui.legacy_fallback.workspace_response,
});

test("rail holds brand, new conversation, nav and a bottom-pinned Settings link", async () => {
  const b = await boot({ hash: "#/repositories", api: legacyApi() });
  const rail = b.document.getElementById("rail");
  assert.ok(rail, "rail exists");
  assert.match(visibleText(rail.querySelector(".brand")), /OpenDevin/);
  assert.equal(b.document.getElementById("rail-new").getAttribute("href"), "#/ask");
  const nav = b.document.getElementById("rail-nav");
  assert.ok(rail.querySelectorAll("nav").includes(nav));
  const settings = nav.querySelector('a[href="#/settings"]');
  assert.ok(settings.closest("li").classList.contains("rail-bottom"));
  assert.equal(nav.querySelector('a[aria-current="page"]').textContent, "Repositories");
  assert.equal(b.document.getElementById("page-header").tagName, "HEADER");
});

test("Sessions link is inserted after Ask when sessions become available", async () => {
  const api = { ...legacyApi(), "GET /api/sessions": { status: 200, body: { items: [], next_cursor: null } },
    "GET /api/execution-profiles": { status: 200, body: { items: [], next_cursor: null } }, "GET /api/settings/execution": { status: 200, body: { max_active_sessions: 1 } } };
  const b = await boot({ api });
  const labels = b.document.getElementById("rail-nav").querySelectorAll("li").filter((li) => !li.hidden).map((li) => li.textContent.trim());
  assert.deepEqual(labels, ["Ask", "Sessions", "Repositories", "Settings"]);
});

test("workspace pill is hidden in connected mode", async () => {
  const workspace = structuredClone(fixtures.workspace.demo_memory);
  workspace.mode = "connected";
  const b = await boot({ api: { ...legacyApi(), "GET /api/workspace": { status: 200, body: workspace } } });
  assert.equal(b.document.getElementById("workspace-mode").hidden, true);
});

test("app shell still loads when saved services are missing", async () => {
  const b = await boot({ api: legacyApi() });
  assert.equal(b.document.getElementById("view-ask").hidden, false);
  assert.ok(b.document.getElementById("rail"));
  assert.equal(b.document.getElementById("side-panel").hidden, true);
});

test("createShell sets recent items, header title and pills", async () => {
  const b = await boot({ api: legacyApi() });
  const { createShell } = await import(`${shellUrl}?s=${loads}`);
  const shell = createShell({ document: b.document });
  shell.setRecent([{ href: "#/ask/c1", title: "How is rcnl-app structured?", meta: "2 min ago · rcnl-app", attention: true }], { heading: "Recent" });
  const recent = b.document.getElementById("recent");
  assert.equal(recent.hidden, false);
  assert.match(visibleText(recent), /Recent/);
  const item = recent.querySelector('a[href="#/ask/c1"]');
  assert.match(visibleText(item), /How is rcnl-app structured\?.*2 min ago · rcnl-app/s);
  assert.ok(item.querySelector(".attention"));
  shell.setRecent([], { heading: "Recent" });
  assert.equal(recent.hidden, true);
  shell.setHeader({ title: "Ask", pills: [{ text: "rcnl-app" }, { text: "llama3.2 · local", tone: "ok" }] });
  const header = b.document.getElementById("page-header");
  assert.match(visibleText(header), /Ask/);
  assert.deepEqual(header.querySelectorAll(".pill").map((p) => p.textContent), ["rcnl-app", "llama3.2 · local"]);
});

test("side panel opens tabs, closes on Escape and restores focus", async () => {
  const b = await boot({ api: legacyApi() });
  const { createSidePanel } = await import(`${panelUrl}?p=${loads}`);
  const opener = b.document.createElement("button");
  b.document.body.append(opener);
  opener.focus();
  const host = b.document.getElementById("side-panel");
  const panel = createSidePanel(host);
  panel.openTab({ id: "f1", title: "api.ts", render: (body) => body.append("first file") });
  panel.openTab({ id: "f2", title: "routes.ts", render: (body) => body.append("second file") });
  assert.equal(panel.isOpen(), true);
  assert.equal(host.hidden, false);
  assert.deepEqual(host.querySelectorAll('[role="tab"]').map((t) => t.textContent.replace("×", "").trim()), ["api.ts", "routes.ts"]);
  assert.match(visibleText(host), /second file/);
  host.querySelectorAll('[role="tab"]')[0].click();
  assert.match(visibleText(host), /first file/);
  panel.openTab({ id: "f1", title: "api.ts", render: (body) => body.append("first file") });
  assert.equal(host.querySelectorAll('[role="tab"]').length, 2, "reopening an existing tab reuses it");
  panel.closeTab("f2");
  assert.equal(host.querySelectorAll('[role="tab"]').length, 1);
  keydown(host, "Escape");
  assert.equal(panel.isOpen(), false);
  assert.equal(host.hidden, true);
  assert.equal(b.document.activeElement, opener);
});

test("the page header follows the route, not the Ask module", async () => {
  const b = await boot({ hash: "#/repositories", api: legacyApi() });
  assert.equal(b.document.getElementById("page-header-title").textContent, "Repositories");
  b.window.location.hash = "#/settings";
  await settle();
  assert.equal(b.document.getElementById("page-header-title").textContent, "Settings");
});
