// Models section: local Ollama discovery and one dropdown per job. Choosing a discovered model
// creates its profile with sensible local defaults, so most people never see the profile form.
import { button, createModal, el } from "./ui.js";

const OLLAMA = "http://127.0.0.1:11434";
const JOBS = [["ask", "Answering questions", "Ask conversations"], ["planning", "Writing plans", null],
  ["embedding", "Smarter code search", "embeddings · recommended"], ["summary", "Repository summaries", null]];
const CHAT_CAPS = ["chat", "structured_output"];

const wantsEmbedding = (role) => role === "embedding";
const capabilities = (profile) => profile.version?.config?.capabilities ?? [];
// Mirrors the server's loopback rule (localhost, 127.0.0.0/8, ::1); anything else is remote.
const isRemote = (value) => {
  let host;
  try { host = new URL(value).hostname; } catch { return false; }
  return !(host === "localhost" || host === "[::1]" || /^127(\.\d{1,3}){3}$/.test(host));
};

// Creates (or reuses) a local Ollama profile for a discovered model and assigns it to a role.
export async function useDiscoveredModel(request, role, model) {
  const listed = await request("/api/provider-profiles");
  let profile = (listed.profiles || []).find((p) => p.version?.adapter === "ollama" && p.version?.model === model.name && p.version?.endpoint === OLLAMA);
  if (!profile) {
    let config;
    if (wantsEmbedding(role)) {
      const probe = await request("/api/provider-profiles/discover/dimensions", "POST", { model: model.name });
      config = { capabilities: ["embeddings"], embedding_dimensions: probe.dimensions, timeout_seconds: 180 };
    } else {
      config = { capabilities: CHAT_CAPS, timeout_seconds: 180, context_limit: model.context_length ?? 8192, max_output_tokens: 1024 };
    }
    profile = await request("/api/provider-profiles", "POST", { name: model.name, adapter: "ollama", endpoint: OLLAMA, model: model.name, config });
  }
  await request("/api/settings/model-roles", "PATCH", { assignments: { [role]: profile.id } });
  return profile;
}

function addProviderForm(request, onDone, trigger) {
  const modal = createModal({ title: "Add OpenAI-compatible provider" });
  const field = (label, placeholder = "", type = "text") => {
    const wrap = el("label", label, "modal-field");
    const input = el("input");
    input.type = type;
    input.placeholder = placeholder;
    input.setAttribute("aria-label", label);
    wrap.append(input);
    return { wrap, input };
  };
  const check = (label, checked) => {
    const wrap = el("label", undefined, "modal-check");
    const input = el("input");
    input.type = "checkbox";
    input.checked = checked;
    input.setAttribute("aria-label", label);
    wrap.append(input, el("span", label));
    return { wrap, input };
  };
  const name = field("Name", "LM Studio");
  const base = field("Base URL", "http://127.0.0.1:1234/v1");
  const model = field("Model", "model id");
  const credential = field("Credential", "optional", "password");
  // Plans use the JSON-schema path only when the profile declares it; Test connection verifies it.
  const structured = check("Supports structured output (JSON schema)", true);
  // A remote destination receives no repository source without this per-profile opt-in.
  const remote = el("div", undefined, "modal-remote");
  const share = check("Send repository source to this provider", false);
  remote.append(share.wrap, el("p", "Ask and plans send retrieved code snippets to this provider. "
    + "Local-only mode in Settings → Privacy must also be off.", "modal-note"));
  const showRemote = () => { remote.hidden = !isRemote(base.input.value.trim()); };
  base.input.addEventListener("input", showRemote);
  showRemote();
  const advanced = el("details");
  const timeout = field("Timeout seconds", "180", "number");
  const context = field("Context token limit", "8192", "number");
  const output = field("Maximum output tokens", "1024", "number");
  advanced.append(el("summary", "Advanced: timeouts and token limits"), timeout.wrap, context.wrap, output.wrap);
  const error = el("p", "", "composer-error");
  modal.body.append(name.wrap, base.wrap, model.wrap, credential.wrap, structured.wrap, remote, advanced, error);
  button(modal.footer, "Cancel", () => modal.close(null));
  button(modal.footer, "Add provider", async (event, control) => {
    control.disabled = true;
    error.textContent = "";
    const number = (input, fallback) => (input.value.trim() ? Number(input.value) : fallback);
    const endpoint = base.input.value.trim();
    const payload = { name: name.input.value.trim(), adapter: "openai_compatible", endpoint, model: model.input.value.trim(),
      config: { capabilities: structured.input.checked ? CHAT_CAPS : ["chat"], timeout_seconds: number(timeout.input, 180), context_limit: number(context.input, 8192), max_output_tokens: number(output.input, 1024) } };
    if (isRemote(endpoint)) payload.config.allow_external_source = share.input.checked;
    if (credential.input.value) payload.secret_value = credential.input.value;
    try {
      await request("/api/provider-profiles", "POST", payload);
      credential.input.value = "";
      modal.close(true);
      onDone();
    } catch (failure) {
      credential.input.value = "";
      error.textContent = failure.message;
    } finally {
      control.disabled = false;
    }
  }, { variant: "primary" });
  modal.open(trigger);
}

export async function mountModels(host, { request }) {
  host.replaceChildren(el("p", "Loading models…", "detail-muted"));
  let discovered, listed, roleData;
  try {
    [discovered, listed, roleData] = await Promise.all([
      request("/api/provider-profiles/discover").catch(() => ({ reachable: false, models: [], error_code: "provider_unreachable" })),
      request("/api/provider-profiles"),
      request("/api/settings/model-roles"),
    ]);
  } catch (error) {
    host.replaceChildren(el("p", `Model settings unavailable: ${error.message}`));
    return;
  }
  const profiles = listed.profiles || [];
  const roles = roleData.roles || {};
  const models = discovered.models || [];

  const card = el("section", undefined, "setting-card");
  const cardRow = el("div", undefined, "setting-row");
  const title = el("div");
  title.append(el("strong", "Ollama · this computer"));
  if (discovered.reachable) title.append(el("span", ` ● connected · ${models.length} models found`, "model-ok"));
  else title.append(el("p", "Not running. Start Ollama, then Retry.", "detail-muted"));
  cardRow.append(title);
  button(cardRow, discovered.reachable ? "Refresh" : "Retry", () => mountModels(host, { request }));
  card.append(cardRow);

  const jobs = el("section", undefined, "setting-card");
  jobs.append(el("h2", "Which model does what"));
  const warnings = el("div");
  for (const [role, label, hint] of JOBS) {
    const row = el("div", undefined, "setting-row");
    const text = el("div");
    text.append(el("span", label));
    if (hint) text.append(el("small", hint, "detail-muted model-hint"));
    const select = el("select");
    select.setAttribute("aria-label", label);
    const option = (value, textValue) => { const o = el("option", textValue); o.value = value; select.append(o); };
    option("", "Off");
    const seen = new Set();
    for (const profile of profiles) {
      const caps = capabilities(profile);
      if (wantsEmbedding(role) ? !caps.includes("embeddings") : !caps.includes("chat")) continue;
      option(`p:${profile.id}`, profile.name === profile.version?.model ? profile.name : `${profile.name} · ${profile.version?.model}`);
      if (profile.version?.adapter === "ollama") seen.add(profile.version.model);
    }
    for (const model of models) {
      if (seen.has(model.name) || model.embedding !== wantsEmbedding(role)) continue;
      option(`m:${model.name}`, model.name);
    }
    const current = roles[role]?.profile_id ? `p:${roles[role].profile_id}` : "";
    select.value = current;
    let saved = current;
    const error = el("p", "", "composer-error");
    select.addEventListener("change", async () => {
      const value = select.value;
      select.disabled = true;
      error.textContent = "";
      try {
        if (value.startsWith("m:")) await useDiscoveredModel(request, role, models.find((m) => m.name === value.slice(2)));
        else await request("/api/settings/model-roles", "PATCH", { assignments: { [role]: value ? value.slice(2) : null } });
        saved = value;
        if (value.startsWith("m:")) mountModels(host, { request });
      } catch (failure) {
        select.value = saved;
        error.textContent = failure.message;
      } finally {
        select.disabled = false;
      }
    });
    row.append(text, select);
    jobs.append(row, error);
    const model = models.find((m) => m.name === roles[role]?.model);
    if (model && model.gpu === false && !warnings.textContent.includes(model.name)) {
      warnings.append(el("p", `⚠ ${model.name} runs on the CPU here; long answers can take over a minute.`, "model-warning"));
    }
  }
  jobs.append(warnings);

  const extra = el("div", undefined, "setting-row");
  const add = button(extra, "＋ Add OpenAI-compatible provider", () => addProviderForm(request, () => mountModels(host, { request }), add));
  host.replaceChildren(card, jobs, extra);
}
