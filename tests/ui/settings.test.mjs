// Settings: section navigation, one-click GitHub setup via the App Manifest flow, privacy switch.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBrowser, install, settle, visibleText } from "./dom.mjs";

const url = pathToFileURL(fileURLToPath(new URL("../../repoask/web/settings.js", import.meta.url))).href;
let loads = 0;

async function setup({ connections = [], localOnly = true, failLocal = false } = {}) {
  const b = createBrowser("<!doctype html><html><body><main id=host></main></body></html>", { respond: () => ({ status: 404, body: {} }) });
  install(b);
  loads += 1;
  const mod = await import(`${url}?s=${loads}`);
  const calls = [];
  const request = async (path, method = "GET", body) => {
    calls.push([method, path, body]);
    if (path === "/api/github/connections") return { connections, summary: { status: connections.length ? "connected" : "disconnected" } };
    if (path === "/api/github/manifest/start") return { action: body.organization ? `https://github.com/organizations/${body.organization}/settings/apps/new` : "https://github.com/settings/apps/new",
      state: "STATE123", expires_at: 1, manifest: { name: "opendevin-abc123", setup_url: "http://127.0.0.1:8765/api/github/callback" } };
    if (path === "/api/settings/model-roles" && method === "GET") return { roles: {}, settings: { local_only: localOnly } };
    if (path === "/api/settings/model-roles" && method === "PATCH") { if (failLocal) throw Object.assign(new Error("http_500. Check configuration."), { status: 500 }); return { settings: body }; }
    return {};
  };
  const sections = { github: b.document.createElement("section"), models: b.document.createElement("section"), agent: null, health: b.document.createElement("section") };
  sections.github.append("Existing GitHub controls");
  sections.health.append("Health cards");
  const submitted = [];
  const page = mod.createSettingsPage({ host: b.document.getElementById("host"), request, sections, submitForm: (form) => submitted.push(form) });
  return { b, mod, page, calls, submitted, host: b.document.getElementById("host") };
}

test("section navigation shows one section at a time", async () => {
  const { page, host } = await setup();
  const nav = host.querySelector("nav");
  assert.deepEqual(nav.querySelectorAll("a").map((a) => [a.textContent, a.getAttribute("href")]),
    [["GitHub", "#/settings/github"], ["Models", "#/settings/models"], ["Coding agent", "#/settings/agent"], ["Privacy", "#/settings/privacy"], ["System health", "#/settings/health"]]);
  await page.show("health");
  assert.equal(nav.querySelector('a[aria-current="page"]').textContent, "System health");
  assert.match(visibleText(host), /Health cards/);
  assert.doesNotMatch(visibleText(host), /Existing GitHub controls/);
  await page.show("agent");
  assert.match(visibleText(host), /The coding agent isn't available in this build\./);
});

test("Connect GitHub posts the manifest form to GitHub with the state", async () => {
  const { page, host, submitted, calls } = await setup();
  await page.show("github");
  await settle();
  assert.match(visibleText(host), /Existing GitHub controls/);
  host.querySelectorAll("button").find((x) => x.textContent === "Connect GitHub").click();
  await settle();
  assert.deepEqual(calls.find(([, p]) => p === "/api/github/manifest/start"), ["POST", "/api/github/manifest/start", {}]);
  const form = submitted[0];
  assert.equal(form.getAttribute("method"), "post");
  assert.equal(form.getAttribute("action"), "https://github.com/settings/apps/new?state=STATE123");
  const field = form.querySelector('input[name="manifest"]');
  assert.equal(field.type, "hidden");
  assert.equal(JSON.parse(field.value).setup_url, "http://127.0.0.1:8765/api/github/callback");
});

test("Create under an organization sends the organization name", async () => {
  const { page, host, submitted, calls } = await setup();
  await page.show("github");
  await settle();
  host.querySelectorAll("button").find((x) => x.textContent === "Create under an organization").click();
  const org = host.querySelectorAll("input").find((x) => x.getAttribute("aria-label") === "Organization name");
  org.value = "acme-co";
  host.querySelectorAll("button").find((x) => x.textContent === "Connect GitHub").click();
  await settle();
  assert.deepEqual(calls.find(([, p]) => p === "/api/github/manifest/start")[2], { organization: "acme-co" });
  assert.equal(submitted[0].getAttribute("action"), "https://github.com/organizations/acme-co/settings/apps/new?state=STATE123");
});

test("a connected account hides Connect GitHub", async () => {
  const { page, host } = await setup({ connections: [{ id: "ghc", status: "connected", slug: "opendevin-akshay-local" }] });
  await page.show("github");
  await settle();
  assert.equal(host.querySelectorAll("button").find((x) => x.textContent === "Connect GitHub"), undefined);
});

test("setup result codes become plain status lines", async () => {
  const { mod } = await setup();
  assert.equal(mod.githubStatusText("connected"), "GitHub connected.");
  assert.equal(mod.githubStatusText("manifest_created"), "App created. Now install it on your repositories.");
  assert.equal(mod.githubStatusText("manifest_state_invalid"), "GitHub setup failed: manifest state invalid. Try again.");
  assert.equal(mod.githubStatusText(""), null);
});

test("the privacy switch saves local-only immediately and reverts on failure", async () => {
  const ok = await setup();
  await ok.page.show("privacy");
  await settle();
  const control = ok.host.querySelector('[role="switch"]');
  assert.equal(control.getAttribute("aria-checked"), "true");
  control.click();
  await settle();
  assert.deepEqual(ok.calls.find(([m]) => m === "PATCH"), ["PATCH", "/api/settings/model-roles", { local_only: false }]);
  const bad = await setup({ failLocal: true });
  await bad.page.show("privacy");
  await settle();
  const failing = bad.host.querySelector('[role="switch"]');
  failing.click();
  await settle();
  assert.equal(failing.getAttribute("aria-checked"), "true");
  assert.match(visibleText(bad.host), /http_500/);
});
