// Models section: discovered Ollama models, one dropdown per job, CPU warning, short provider form.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBrowser, input, install, settle, visibleText } from "./dom.mjs";

const url = pathToFileURL(fileURLToPath(new URL("../../repoask/web/settings-models.js", import.meta.url))).href;
let loads = 0;
const DISCOVERED = { reachable: true, error_code: null, models: [
  { name: "llama3.2:latest", embedding: false, gpu: false, loaded: true, context_length: 8192 },
  { name: "qwen2.5:14b", embedding: false, gpu: null, loaded: false, context_length: null },
  { name: "nomic-embed-text:latest", embedding: true, gpu: null, loaded: false, context_length: null }] };
const PROFILE = { id: "prof_1", name: "CLI local Ollama", version: { adapter: "ollama", endpoint: "http://127.0.0.1:11434", model: "llama3.2:latest", config: { capabilities: ["chat", "structured_output"] } } };

async function setup({ discover = DISCOVERED, failRole = false } = {}) {
  const b = createBrowser("<!doctype html><html><body><main id=host></main></body></html>", { respond: () => ({ status: 404, body: {} }) });
  install(b);
  loads += 1;
  const mod = await import(`${url}?m=${loads}`);
  const calls = [];
  let profiles = [PROFILE];
  const roles = { ask: { status: "untested", profile_id: "prof_1", model: "llama3.2:latest" }, planning: { status: "unassigned", profile_id: null }, summary: { status: "unassigned", profile_id: null }, embedding: { status: "unassigned", profile_id: null } };
  const request = async (path, method = "GET", body) => {
    calls.push([method, path, body]);
    if (path.startsWith("/api/provider-profiles/discover/dimensions")) return { dimensions: 768 };
    if (path.startsWith("/api/provider-profiles/discover")) return discover;
    if (path === "/api/provider-profiles" && method === "GET") return { profiles };
    if (path === "/api/provider-profiles" && method === "POST") { const p = { id: `prof_${profiles.length + 1}`, name: body.name, version: { adapter: body.adapter, endpoint: body.endpoint, model: body.model, config: body.config } }; profiles = [...profiles, p]; return p; }
    if (path === "/api/settings/model-roles" && method === "GET") return { roles, settings: { local_only: true } };
    if (path === "/api/settings/model-roles" && method === "PATCH") { if (failRole) throw Object.assign(new Error("role_unavailable. Check configuration."), { status: 409 }); return { roles }; }
    return {};
  };
  const host = b.document.getElementById("host");
  await mod.mountModels(host, { request });
  await settle();
  return { b, mod, host, calls };
}

const select = (host, label) => host.querySelectorAll("select").find((s) => s.getAttribute("aria-label") === label);
const optionTexts = (sel) => sel.querySelectorAll("option").map((o) => o.textContent);
const change = (sel, value) => { sel.value = value; sel.dispatchEvent(new (sel.ownerDocument.defaultView.Event ?? class { constructor(t) { this.type = t; this.bubbles = true; } })("change")); };

test("Ollama card shows discovered models and each job has one dropdown", async () => {
  const { host } = await setup();
  assert.match(visibleText(host), /Ollama · this computer/);
  assert.match(visibleText(host), /● connected · 3 models found/);
  assert.deepEqual(host.querySelectorAll("select").map((s) => s.getAttribute("aria-label")), ["Answering questions", "Writing plans", "Smarter code search", "Repository summaries"]);
  assert.deepEqual(optionTexts(select(host, "Smarter code search")), ["Off", "nomic-embed-text:latest"]);
  assert.ok(!optionTexts(select(host, "Answering questions")).includes("nomic-embed-text:latest"));
  assert.equal(select(host, "Answering questions").value, "p:prof_1");
  assert.equal(host.querySelectorAll("button").filter((x) => /^Save/.test(x.textContent)).length, 0, "no save buttons");
});

test("choosing a discovered embedding model creates a profile with probed dimensions, then assigns the role", async () => {
  const { host, calls } = await setup();
  const sel = select(host, "Smarter code search");
  sel.value = "m:nomic-embed-text:latest";
  sel.dispatchEvent({ type: "change", bubbles: true });
  await settle(20);
  const post = calls.find(([m, p]) => m === "POST" && p === "/api/provider-profiles");
  assert.deepEqual(post[2], { name: "nomic-embed-text:latest", adapter: "ollama", endpoint: "http://127.0.0.1:11434", model: "nomic-embed-text:latest",
    config: { capabilities: ["embeddings"], embedding_dimensions: 768, timeout_seconds: 180 } });
  assert.deepEqual(calls.filter(([m]) => m === "PATCH").at(-1), ["PATCH", "/api/settings/model-roles", { assignments: { embedding: "prof_2" } }]);
});

test("choosing a discovered chat model uses 180s timeout, context length and 1024 output tokens", async () => {
  const { host, calls } = await setup();
  const sel = select(host, "Writing plans");
  sel.value = "m:qwen2.5:14b";
  sel.dispatchEvent({ type: "change", bubbles: true });
  await settle(20);
  const post = calls.find(([m, p]) => m === "POST" && p === "/api/provider-profiles");
  assert.deepEqual(post[2].config, { capabilities: ["chat", "structured_output"], timeout_seconds: 180, context_limit: 8192, max_output_tokens: 1024 });
});

test("a failed role save reverts the dropdown and explains why", async () => {
  const { host } = await setup({ failRole: true });
  const sel = select(host, "Answering questions");
  sel.value = "";
  sel.dispatchEvent({ type: "change", bubbles: true });
  await settle(20);
  assert.equal(sel.value, "p:prof_1");
  assert.match(visibleText(host), /role_unavailable/);
});

test("CPU-only models get a warning", async () => {
  const { host } = await setup();
  assert.match(visibleText(host), /llama3\.2:latest runs on the CPU here; long answers can take over a minute\./);
});

test("unreachable Ollama says how to fix it", async () => {
  const { host } = await setup({ discover: { reachable: false, models: [], error_code: "provider_unreachable" } });
  assert.match(visibleText(host), /Not running\. Start Ollama, then Retry\./);
  assert.ok(host.querySelectorAll("button").find((x) => x.textContent === "Retry"));
});

test("Add OpenAI-compatible provider keeps advanced fields folded and posts the short form", async () => {
  const { b, host, calls } = await setup();
  host.querySelectorAll("button").find((x) => x.textContent === "＋ Add OpenAI-compatible provider").click();
  await settle();
  const dialog = b.document.querySelector("dialog.modal");
  const field = (label) => dialog.querySelectorAll("input").find((i) => i.getAttribute("aria-label") === label);
  assert.ok(dialog.querySelector("details"), "advanced settings are folded");
  field("Name").value = "LM Studio";
  input(field("Base URL"), "http://127.0.0.1:1234/v1");
  field("Model").value = "qwen-coder";
  assert.ok(field("Send repository source to this provider").closest(".modal-remote").hidden, "no source opt-in for loopback");
  dialog.querySelectorAll("button").find((x) => x.textContent === "Add provider").click();
  await settle();
  const post = calls.find(([m, p]) => m === "POST" && p === "/api/provider-profiles");
  assert.deepEqual(post[2], { name: "LM Studio", adapter: "openai_compatible", endpoint: "http://127.0.0.1:1234/v1", model: "qwen-coder",
    config: { capabilities: ["chat", "structured_output"], timeout_seconds: 180, context_limit: 8192, max_output_tokens: 1024 } });
});

test("a remote provider offers the source-sharing opt-in and sends it with structured output", async () => {
  const { b, host, calls } = await setup();
  host.querySelectorAll("button").find((x) => x.textContent === "＋ Add OpenAI-compatible provider").click();
  await settle();
  const dialog = b.document.querySelector("dialog.modal");
  const field = (label) => dialog.querySelectorAll("input").find((i) => i.getAttribute("aria-label") === label);
  field("Name").value = "Groq";
  input(field("Base URL"), "https://api.groq.com/openai/v1");
  field("Model").value = "openai/gpt-oss-120b";
  const share = field("Send repository source to this provider");
  assert.equal(share.closest(".modal-remote").hidden, false);
  assert.equal(share.checked, false, "sharing is never on by default");
  assert.match(visibleText(dialog), /Local-only mode in Settings → Privacy must also be off\./);
  share.click();
  dialog.querySelectorAll("button").find((x) => x.textContent === "Add provider").click();
  await settle();
  const post = calls.find(([m, p]) => m === "POST" && p === "/api/provider-profiles");
  assert.deepEqual(post[2].config, { capabilities: ["chat", "structured_output"], timeout_seconds: 180, context_limit: 8192,
    max_output_tokens: 1024, allow_external_source: true });
});

test("unchecking structured output keeps a chat-only profile", async () => {
  const { b, host, calls } = await setup();
  host.querySelectorAll("button").find((x) => x.textContent === "＋ Add OpenAI-compatible provider").click();
  await settle();
  const dialog = b.document.querySelector("dialog.modal");
  const field = (label) => dialog.querySelectorAll("input").find((i) => i.getAttribute("aria-label") === label);
  field("Name").value = "Old server";
  input(field("Base URL"), "https://llm.example.com/v1");
  field("Model").value = "m";
  field("Supports structured output (JSON schema)").click();
  dialog.querySelectorAll("button").find((x) => x.textContent === "Add provider").click();
  await settle();
  const post = calls.find(([m, p]) => m === "POST" && p === "/api/provider-profiles");
  assert.deepEqual(post[2].config.capabilities, ["chat"]);
  assert.equal(post[2].config.allow_external_source, false);
});
