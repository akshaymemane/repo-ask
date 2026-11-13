const byId = (id) => document.getElementById(id);

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

const question = byId("question");
const thread = byId("thread");
const messages = byId("messages");
const dialog = byId("repo-dialog");
const repoFilter = byId("repo-filter");
const state = {
  repos: [],
  conversations: [],
  current: null,
  pending: false,
  picker: new Set(),
  sourceRequest: null,
  sourceTrigger: null,
  reposLoaded: false,
  reposError: null,
  route: "ask",
  // Workspace and health come from /api/workspace and /api/health. Each is
  // {kind: "loading" | "ok" | "legacy" | "error", data?, message?}.
  status: { workspace: { kind: "loading" }, health: { kind: "loading" }, loading: false, sequence: 0 },
};

async function api(path, options) {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The request failed.");
  return result;
}

function repoLabel(count) {
  return count === 1 ? "1 repository" : `${count} repositories`;
}

function syncControls() {
  const ready = Boolean(state.current) && !state.pending;
  byId("show-repos").disabled = !ready;
  byId("new-chat").disabled = !ready;
  question.disabled = !ready;
  byId("ask-button").disabled = !ready || !question.value.trim();
  if (state.current) {
    byId("scope-label").textContent = repoLabel(state.current.repos.length);
  }
  if (ready) {
    byId("composer-status").textContent = state.model ? "Local model" : "Search only · Add Ollama for generated answers";
  }
}

function newConversation(repos) {
  return { repos: [...repos], turns: [] };
}

function switchConversation(conversation, draft = "") {
  state.current = conversation;
  question.value = draft;
  closeSource();
  toggleHistory(false);
  renderThread();
  syncControls();
  question.focus();
}

function renderHistory() {
  const list = byId("history");
  byId("history-empty").hidden = state.conversations.length > 0;
  list.replaceChildren();
  for (const conversation of state.conversations) {
    const label = conversation.turns[0].question;
    const button = node("button", label, "history-item");
    button.type = "button";
    button.title = label;
    button.disabled = state.pending;
    if (conversation === state.current) button.setAttribute("aria-current", "true");
    button.addEventListener("click", () => switchConversation(conversation));
    list.append(button);
  }
}

function addInlineCode(element, text) {
  for (const part of text.split(/(`[^`\n]+`)/)) {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      element.append(node("code", part.slice(1, -1)));
    } else {
      element.append(document.createTextNode(part));
    }
  }
}

function citationButton(source, inList = false) {
  const name = source.path.split("/").at(-1);
  const lines = source.start === source.end ? `L${source.start}` : `L${source.start}–${source.end}`;
  const button = node("button", undefined, inList ? "citation source-result" : "citation");
  button.type = "button";
  button.title = `${source.repo}/${source.path} · ${lines}`;
  button.setAttribute("aria-controls", "inspector");
  if (inList) button.append(node("span", "›", "result-icon"));
  const file = node("span", name, "citation-name");
  if (inList) {
    const label = node("span", undefined, "result-label");
    label.append(file, node("small", source.repo));
    button.append(label);
  } else {
    button.append(file);
  }
  button.append(node("span", lines, "citation-lines"));
  button.addEventListener("click", () => showSource(source, button));
  return button;
}

function renderAnswer(result) {
  const answer = node("article", undefined, "answer");
  const bySourceId = new Map(result.sources.map((source) => [source.id, source]));
  answer.append(node("h2", result.mode === "answer" ? "Answer" : "Matching source excerpts", "answer-heading"));
  for (const section of result.sections) {
    const block = node("section", undefined, "answer-section");
    const paragraph = node("p");
    addInlineCode(paragraph, section.text);
    block.append(node("h3", section.heading), paragraph);
    const references = node("div", undefined, "citations");
    for (const id of new Set(section.sources)) references.append(citationButton(bySourceId.get(id)));
    block.append(references);
    answer.append(block);
  }
  if (result.note) answer.append(node("p", result.note, "answer-note"));
  if (result.matches.length) {
    const matches = node("section", undefined, "cross-references");
    matches.append(node("h3", "Cross-repository matches"));
    for (const match of result.matches) {
      const row = node("div", undefined, "cross-reference");
      const label = node("p");
      label.append(document.createTextNode(`${match.label} `), node("code", match.literal));
      const refs = node("div", undefined, "citations");
      for (const id of match.sources) refs.append(citationButton(bySourceId.get(id)));
      row.append(label, refs);
      matches.append(row);
    }
    answer.append(matches);
  }
  if (result.mode === "search" && result.sources.length) {
    const sources = node("div", undefined, "search-results");
    for (const source of result.sources) sources.append(citationButton(source, true));
    answer.append(sources);
  }
  return answer;
}

function renderThread(announce = false) {
  const turns = state.current.turns;
  byId("intro").hidden = turns.length > 0;
  messages.hidden = turns.length === 0;
  messages.replaceChildren();
  for (const turn of turns) {
    const item = node("div", undefined, "turn");
    const prompt = node("div", undefined, "prompt");
    prompt.append(node("span", "You", "small-heading"), node("p", turn.question));
    item.append(prompt);
    if (turn.result) item.append(renderAnswer(turn.result));
    else if (turn.error) item.append(node("p", turn.error, "error"));
    else item.append(node("p", state.model ? "Searching and drafting an answer…" : "Searching the selected repositories…", "pending"));
    messages.append(item);
  }
  thread.setAttribute("aria-busy", String(state.pending));
  renderHistory();
  if (announce && messages.lastElementChild) {
    requestAnimationFrame(() => {
      messages.lastElementChild?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  } else {
    thread.scrollTop = 0;
  }
}

byId("ask-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = question.value.trim();
  if (!text || !state.current || state.pending) return;
  const conversation = state.current;
  const previous = conversation.turns.at(-1)?.question ?? "";
  const turn = { question: text };
  if (!conversation.turns.length) state.conversations.unshift(conversation);
  conversation.turns.push(turn);
  state.pending = true;
  question.value = "";
  byId("composer-status").textContent = "Working…";
  syncControls();
  renderThread(true);
  try {
    turn.result = await api("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, previous, repos: conversation.repos }),
    });
  } catch (error) {
    turn.error = error.message;
    question.value = text;
  } finally {
    state.pending = false;
    renderThread(true);
    syncControls();
  }
});

question.addEventListener("input", syncControls);
question.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    byId("ask-form").requestSubmit();
  }
});
byId("new-chat").addEventListener("click", () => switchConversation(newConversation(state.current.repos)));
for (const button of document.querySelectorAll(".example")) {
  button.addEventListener("click", () => {
    question.value = button.dataset.question;
    syncControls();
    question.focus();
  });
}

function updatePickerCount() {
  byId("repo-count").textContent = `${state.picker.size} selected`;
  byId("apply-repos").disabled = !state.picker.size;
}

function renderPicker() {
  const list = byId("repo-options");
  const filter = repoFilter.value.trim().toLowerCase();
  list.replaceChildren();
  for (const repo of state.repos.filter(({ name }) => name.toLowerCase().includes(filter))) {
    const option = node("label", undefined, "repo-option");
    const checkbox = node("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.picker.has(repo.name);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.picker.add(repo.name);
      else state.picker.delete(repo.name);
      updatePickerCount();
    });
    const label = node("span", undefined, "repo-option-label");
    const fileCount = repo.files === 1 ? "1 file" : `${repo.files} files`;
    label.append(node("strong", repo.name), node("small", `${fileCount}${repo.limited ? " · Index limit reached" : ""}`));
    const revision = node("span", repo.demo ? "Sample" : repo.revision.slice(0, 7), "repo-revision");
    revision.title = `Indexed ${new Date(repo.indexed_at).toLocaleString()}`;
    option.append(checkbox, label, revision);
    list.append(option);
  }
  if (!list.childElementCount) list.append(node("p", "No matching repositories.", "no-repos"));
  updatePickerCount();
}

byId("show-repos").addEventListener("click", () => {
  state.picker = new Set(state.current.repos);
  byId("repo-dialog-help").textContent = state.current.turns.length
    ? "Changing the repository selection starts a new conversation."
    : "Search and answers use the repositories you select.";
  repoFilter.value = "";
  renderPicker();
  dialog.showModal();
  repoFilter.focus();
});
repoFilter.addEventListener("input", renderPicker);
byId("close-repos").addEventListener("click", () => dialog.close());
byId("cancel-repos").addEventListener("click", () => dialog.close());
byId("repo-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.picker.size) return;
  const repos = state.repos.map(({ name }) => name).filter((name) => state.picker.has(name));
  dialog.close();
  const old = state.current.repos;
  if (repos.length !== old.length || repos.some((name) => !old.includes(name))) {
    if (state.current.turns.length) switchConversation(newConversation(repos), question.value);
    else {
      state.current.repos = repos;
      syncControls();
    }
  }
});

function toggleHistory(open) {
  byId("sidebar").classList.toggle("is-open", open);
  byId("history-toggle").setAttribute("aria-expanded", String(open));
}
byId("history-toggle").addEventListener("click", () => {
  toggleHistory(!byId("sidebar").classList.contains("is-open"));
});

function closeSource(restoreFocus = false) {
  state.sourceRequest?.abort();
  state.sourceRequest = null;
  byId("inspector").classList.remove("has-source");
  byId("source-panel").hidden = true;
  byId("source-panel").replaceChildren();
  byId("inspector-empty").hidden = false;
  byId("close-source").hidden = true;
  if (restoreFocus && state.sourceTrigger?.isConnected) state.sourceTrigger.focus();
  state.sourceTrigger = null;
}

const tokenPattern = /("[^"\n]*"|'[^'\n]*'|\/\/.*$|--\s.*$|\b(?:import|package|export|async|await|const|var|let|type|return|if|throw|new|public|private|class|void|final|for|in|def|from|CREATE|TABLE|PRIMARY|KEY|VARCHAR|TEXT|TIMESTAMP|REFERENCES|INSERT|INTO|VALUES|NULL)\b|@[A-Za-z]+|\b\d+\b)/g;

function highlight(code, line) {
  for (const [index, part] of line.split(tokenPattern).entries()) {
    if (index % 2) {
      const category = /^["']/.test(part) ? "string" : /^(\/\/|--)/.test(part) ? "comment" : "keyword";
      code.append(node("span", part, `token-${category}`));
    } else {
      code.append(document.createTextNode(part));
    }
  }
}

async function showSource(citation, trigger) {
  state.sourceRequest?.abort();
  const request = new AbortController();
  state.sourceRequest = request;
  state.sourceTrigger = trigger;
  toggleHistory(false);
  const inspector = byId("inspector");
  const panel = byId("source-panel");
  const close = byId("close-source");
  inspector.classList.add("has-source");
  byId("inspector-empty").hidden = true;
  close.hidden = false;
  panel.hidden = false;
  panel.replaceChildren(node("p", "Loading source…", "source-status"));
  if (matchMedia("(max-width: 1000px)").matches) close.focus();

  const { repo, revision, path, start, end } = citation;
  const params = new URLSearchParams({ repo, revision, path, start, end });
  try {
    const source = await api(`/api/source?${params}`, { signal: request.signal });
    if (state.sourceRequest !== request) return;
    const header = node("div", undefined, "source-header");
    const revisionLabel = node("span", revision.slice(0, 10), "source-revision");
    revisionLabel.title = revision;
    const identity = node("div", undefined, "source-identity");
    identity.append(node("span", repo), revisionLabel);
    header.append(identity, node("p", path, "source-path"));
    const viewer = node("div", undefined, "code-viewer");
    viewer.setAttribute("tabindex", "0");
    viewer.setAttribute("aria-label", `${path}, cited lines ${start} to ${end}`);
    for (const [offset, line] of source.lines.entries()) {
      const number = source.first + offset;
      const row = node("div", undefined, "code-row");
      if (start <= number && number <= end) row.classList.add("highlighted");
      const gutter = node("span", number, "gutter");
      gutter.setAttribute("aria-hidden", "true");
      const code = node("code");
      highlight(code, line);
      row.append(gutter, code);
      viewer.append(row);
    }
    panel.replaceChildren(header, viewer);
  } catch (error) {
    if (state.sourceRequest === request) panel.replaceChildren(node("p", error.message, "error"));
  }
}

byId("close-source").addEventListener("click", () => closeSource(true));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dialog.open && state.route === "ask") {
    if (!byId("source-panel").hidden) closeSource(true);
    else toggleHistory(false);
  }
});

// ---------------------------------------------------------------------------
// Navigation (hash routes, contract opendevin.m0/1 §7)

const ROUTES = {
  ask: { view: "view-ask", title: "ask-title", label: "Ask" },
  repositories: { view: "view-repositories", title: "repositories-title", label: "Repositories" },
  settings: { view: "view-settings", title: "settings-title", label: "Settings" },
};

function announce(text) {
  const region = byId("app-status");
  region.textContent = "";
  // Clearing first makes repeated messages announce again.
  setTimeout(() => { region.textContent = text; }, 50);
}

function routeFromHash() {
  const hash = location.hash;
  if (hash === "" || hash === "#" || hash === "#/") return "ask";
  const match = /^#\/([a-z]+)(?:\?github=[a-z_]{1,64})?$/.exec(hash);
  return match && Object.hasOwn(ROUTES, match[1]) ? match[1] : null;
}

function showRoute(moveFocus) {
  let route = routeFromHash();
  if (route === null) {
    route = "ask";
    history.replaceState(null, "", "#/ask");
    announce("That page is not available in this version. Showing Ask.");
  }
  const previous = state.route;
  state.route = route;
  for (const [id, info] of Object.entries(ROUTES)) byId(info.view).hidden = id !== route;
  for (const link of document.querySelectorAll(".primary-nav a")) {
    if (link.dataset.route === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  // Ask-only controls act on the current conversation.
  const onAsk = route === "ask";
  byId("show-repos").hidden = !onAsk;
  byId("history-toggle").hidden = !onAsk;
  if (!onAsk) {
    toggleHistory(false);
    if (dialog.open) dialog.close();
  }
  document.title = `${ROUTES[route].label} · OpenDevin`;
  if (route === "repositories") renderRepositories();
  if (route === "settings") {
    renderSettings();
    if (moveFocus && previous !== "settings") refreshStatus();
  }
  if (moveFocus) byId(ROUTES[route].title).focus();
}

window.addEventListener("hashchange", () => showRoute(true));

// ---------------------------------------------------------------------------
// Workspace status (/api/workspace, /api/health)

async function fetchStatus(path, contractPrefix) {
  let response;
  try {
    response = await fetch(path, { headers: { Accept: "application/json" } });
  } catch {
    return { kind: "error", message: "Could not reach the OpenDevin server. Check that it is still running." };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const isObject = body !== null && typeof body === "object" && !Array.isArray(body);
  // Builds without the M0 routes answer with the legacy 404 body, which has no `code`.
  if (response.status === 404 && isObject && typeof body.error === "string" && !("code" in body)) {
    return { kind: "legacy" };
  }
  if (!response.ok || !isObject) {
    const detail = isObject && typeof body.error === "string" ? body.error : `The server returned HTTP ${response.status}.`;
    return { kind: "error", message: detail };
  }
  if (typeof body.contract !== "string" || !(body.contract.startsWith(contractPrefix) || body.contract.startsWith(contractPrefix.replace("/m0.", "/m1.")))) {
    return { kind: "error", message: "The server reported status in a format this page does not support." };
  }
  return { kind: "ok", data: body };
}

async function refreshStatus(userRequested = false) {
  const sequence = ++state.status.sequence;
  state.status.loading = true;
  renderRefreshButton();
  const [workspace, health] = await Promise.all([
    fetchStatus("/api/workspace", "opendevin.workspace/m0."),
    fetchStatus("/api/health", "opendevin.health/m0."),
  ]);
  if (sequence !== state.status.sequence) return;
  Object.assign(state.status, { workspace, health, loading: false });
  renderRefreshButton();
  applyNavigation();
  renderWorkspaceMode();
  if (state.route === "settings") renderSettings();
  if (state.route === "repositories") renderRepositories();
  if (userRequested) {
    const failed = workspace.kind === "error" || health.kind === "error";
    announce(failed ? "Could not load all workspace status." : "Status updated.");
  }
}

function renderRefreshButton() {
  const button = byId("refresh-status");
  button.textContent = state.status.loading ? "Checking…" : "Refresh status";
  button.setAttribute("aria-disabled", String(state.status.loading));
}

byId("refresh-status").addEventListener("click", () => {
  if (!state.status.loading) refreshStatus(true);
});

function applyNavigation() {
  const { workspace } = state.status;
  if (workspace.kind !== "ok" || !Array.isArray(workspace.data.navigation)) return;
  const ids = workspace.data.navigation.map((entry) => entry && entry.id);
  for (const link of document.querySelectorAll(".primary-nav a")) {
    // Ask always stays reachable; other areas follow the server's list.
    link.parentNode.hidden = link.dataset.route !== "ask" && !ids.includes(link.dataset.route);
  }
}

function workspaceMode() {
  const { workspace } = state.status;
  if (workspace.kind === "ok") return workspace.data.mode;
  if (state.reposLoaded) return state.repos.every((repo) => repo.demo) ? "demo" : "local";
  return null;
}

function renderWorkspaceMode() {
  const mode = workspaceMode();
  let label = "Loading workspace…";
  let detail = "";
  if (mode === "demo") [label, detail] = ["Sample workspace", "bundled example repositories"];
  else if (mode === "local") [label, detail] = ["Local workspace", "local Git checkouts"];
  else if (mode !== null) label = "Workspace mode unknown";
  else if (state.reposError) label = "Workspace unavailable";
  byId("workspace-mode-label").textContent = label;
  byId("workspace-mode-detail").textContent = detail ? ` — ${detail}` : "";
  byId("workspace-mode").dataset.mode = mode === "demo" || mode === "local" ? mode : "unknown";
}

// Status vocabulary. Every state has text and an icon so color is never the
// only signal. Values outside a field's known set render as neutral Unknown.
const STATUS_LABELS = {
  ok: ["good", "✓", "OK"],
  available: ["good", "✓", "Available"],
  configured: ["good", "✓", "Configured"],
  not_configured: ["attention", "○", "Not configured"],
  not_available: ["neutral", "—", "Not available in this version"],
  unavailable: ["attention", "⊘", "Unavailable"],
  disabled: ["neutral", "○", "Disabled"],
  degraded: ["warning", "!", "Degraded"],
};
const UNKNOWN_STATUS = ["neutral", "?", "Unknown"];

function statusOf(value, allowed) {
  return allowed.includes(value) && Object.hasOwn(STATUS_LABELS, value) ? STATUS_LABELS[value] : UNKNOWN_STATUS;
}

function chip([tone, icon, text]) {
  const element = node("span", undefined, `chip chip-${tone}`);
  const glyph = node("span", icon, "chip-icon");
  glyph.setAttribute("aria-hidden", "true");
  element.append(glyph, node("span", text));
  return element;
}

function field(object, ...path) {
  let value = object;
  for (const key of path) {
    if (value === null || typeof value !== "object") return undefined;
    value = value[key];
  }
  return value;
}

function count(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function plural(n, word, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

function card(title, status, ...lines) {
  const section = node("section", undefined, "status-card");
  const header = node("div", undefined, "status-card-header");
  header.append(node("h2", title), chip(status));
  section.append(header);
  for (const line of lines) if (line) section.append(typeof line === "string" ? node("p", line) : line);
  return section;
}

// Paragraph with inline `code` spans, e.g. command-line flags.
function hint(text, className = "next-action") {
  const paragraph = node("p", undefined, className);
  addInlineCode(paragraph, text);
  return paragraph;
}

function errorBlock(message, next) {
  // Not a live region: refreshes announce through the single polite #app-status.
  const block = node("div", undefined, "status-error");
  block.append(node("p", message, "error"));
  if (next) block.append(hint(next));
  return block;
}

function formatTime(value) {
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "an unknown time";
}

function workspaceCard(data) {
  const mode = data.mode;
  const modeStatus = mode === "demo" ? ["neutral", "◇", "Sample workspace"]
    : mode === "local" ? ["neutral", "◇", "Local workspace"] : UNKNOWN_STATUS;
  const source = field(data, "catalog", "source");
  const sourceText = source === "demo_fixtures" ? "Bundled example repositories. No GitHub or private repositories are indexed."
    : source === "local_checkouts" ? "Local Git checkouts, indexed from their committed HEAD when OpenDevin started."
    : "Repository source unknown.";
  const total = count(field(data, "catalog", "repository_count"));
  const limited = count(field(data, "catalog", "limited_count"));
  const totals = total === null ? "Repository count unknown." : `${plural(total, "repository", "repositories")} indexed.`;
  const limits = limited === null ? null
    : limited ? `${plural(limited, "repository", "repositories")} hit the index limit; some files were not indexed.`
    : "No repository hit the index limit.";
  return card("Workspace", modeStatus, sourceText, totals, limits);
}

function modelCard(data, health) {
  const answer = field(data, "providers", "answer") || {};
  const status = statusOf(answer.status, ["configured", "not_configured"]);
  if (answer.status === "not_configured") {
    return card("Answer model", status,
      "Search only: answers show matching source excerpts without generated text.",
      hint("To generate answers, restart OpenDevin with `--model NAME` to use a local Ollama model."));
  }
  if (answer.status !== "configured") return card("Answer model", status, "Model status unknown.");
  const adapter = answer.adapter === "ollama" ? "Ollama" : "Unknown adapter";
  const model = typeof answer.model === "string" ? answer.model : "unknown model";
  const destination = answer.destination === "loopback"
    ? "Destination: loopback — prompts go to Ollama on this computer."
    : "Destination unknown.";
  const probed = field(health, "components", "model", "probed") === false
    ? "Not checked yet: OpenDevin does not contact the model until you ask a question." : null;
  return card("Answer model", status, `${adapter} model ${model}.`, destination, probed);
}

function notAvailableCard(title, value) {
  const status = statusOf(field(value, "status"), ["not_available"]);
  const reason = typeof field(value, "reason") === "string" ? value.reason : null;
  return card(title, status, reason ? hint(reason, "") : "Status unknown.");
}

function storageCard(data, health) {
  const storage = field(data, "storage") || {};
  const status = statusOf(storage.status, ["ok", "disabled"]);
  if (storage.status === "disabled") return card("Storage", status, "Storage is disabled in this build. Nothing is saved.");
  if (storage.status !== "ok") return card("Storage", status, "Storage status unknown.");
  const schema = count(storage.schema_version);
  const expected = count(field(health, "components", "storage", "expected_schema_version"));
  const size = count(field(health, "components", "storage", "size_bytes"));
  const schemaText = schema === null ? "Schema version unknown." : `Schema ${schema}.`;
  const mismatch = schema !== null && expected !== null && schema !== expected
    ? node("p", `! Schema ${schema} does not match the expected schema ${expected}.`, "warning-text") : null;
  if (storage.persistent === true) {
    const sizeText = size === null ? null : `Database size ${(size / 1024).toFixed(1)} KiB.`;
    return card("Storage", status, `Persistent local database. ${schemaText}`, mismatch, sizeText);
  }
  if (storage.persistent === false) {
    return card("Storage", status, "Not persistent: kept in memory and discarded when OpenDevin stops.", mismatch);
  }
  return card("Storage", status, "Persistence unknown.", mismatch);
}

function secretsCard(data) {
  const secrets = field(data, "secrets") || {};
  const value = secrets.available === true ? "available" : secrets.available === false ? "unavailable" : null;
  const status = statusOf(value, ["available", "unavailable"]);
  const reason = typeof secrets.reason === "string" ? secrets.reason : null;
  if (value === "unavailable") {
    return card("Credentials", status, reason || "Credential setup is disabled.",
      "Unlock or configure the secure credential store before saving App keys or provider credentials.");
  }
  if (value === "available") return card("Credentials", status, "A secure credential store is available.");
  return card("Credentials", status, "Credential store status unknown.");
}

function healthCard(data) {
  const status = statusOf(data.status, ["ok", "degraded"]);
  const jobs = field(data, "components", "jobs") || {};
  const lines = [`Checked ${formatTime(data.checked_at)}.`];
  const list = node("dl", undefined, "health-list");
  const row = (name, value, allowed, text) => {
    const term = node("dt", name);
    const description = node("dd");
    description.append(chip(statusOf(value, allowed)));
    if (text) description.append(node("span", text, "health-detail"));
    list.append(term, description);
  };
  const indexCount = count(field(data, "components", "index", "repository_count"));
  row("Index", field(data, "components", "index", "status"), ["ok"],
    indexCount === null ? "" : `${plural(indexCount, "repository", "repositories")}, rebuilt at startup`);
  row("Storage", field(data, "components", "storage", "status"), ["ok", "disabled"], "");
  row("Background jobs", jobs.status, ["ok", "degraded", "disabled"], "");
  row("Credentials", field(data, "components", "secrets", "status"), ["available", "unavailable"], "");
  row("Answer model", field(data, "components", "model", "status"), ["configured", "not_configured"], "");
  lines.push(list);

  if (jobs.status === "disabled") {
    lines.push("Background jobs are disabled in this build.");
  } else if (jobs.counts && typeof jobs.counts === "object") {
    const names = [["queued", "Queued"], ["leased", "Leased"], ["succeeded", "Succeeded"], ["failed", "Failed"],
      ["cancelled", "Cancelled"], ["needs_reconciliation", "Needs reconciliation"]];
    lines.push(`Jobs: ${names.map(([key, label]) => `${label} ${count(jobs.counts[key]) ?? "unknown"}`).join(" · ")}.`);
  }
  const reconcile = count(field(jobs, "counts", "needs_reconciliation"));
  if (reconcile) {
    lines.push(node("p", `! ${plural(reconcile, "job needs", "jobs need")} reconciliation: the outcome is unknown, so ${reconcile === 1 ? "it is" : "they are"} not retried automatically.`, "warning-text"));
  }
  const expired = count(jobs.expired_leases);
  if (expired) lines.push(node("p", `! ${plural(expired, "expired lease")}.`, "warning-text"));
  if (reconcile || expired) lines.push("Tools to resolve jobs are not available in this version.");
  if (jobs.workers_running === 0 && jobs.status !== "disabled") lines.push("No background worker runs in this version.");

  const failures = Array.isArray(data.recent_failures) ? data.recent_failures : [];
  if (failures.length) {
    const failureList = node("ul", undefined, "failure-list");
    for (const failure of failures.slice(0, 5)) {
      const kind = typeof failure?.kind === "string" ? failure.kind : "unknown kind";
      const code = typeof failure?.code === "string" ? failure.code : "unknown";
      failureList.append(node("li", `${kind} failed (${code}) at ${formatTime(failure?.at)}`));
    }
    const heading = node("h3", "Recent job failures");
    lines.push(heading, failureList);
  }
  return card("Health", status, ...lines);
}

function renderLegacySettings() {
  const root = byId("settings-content");
  const { workspace, health } = state.status;
  const parts = [];
  if (workspace.kind === "loading") {
    root.replaceChildren(node("p", "Loading status…", "page-status"));
    return;
  }
  if (workspace.kind === "legacy") {
    parts.push(node("p", "Status unavailable in this build.", "page-status"));
    parts.push(node("p", "Ask and Repositories still work.", "page-note"));
  } else if (workspace.kind === "error") {
    parts.push(errorBlock(`Could not load workspace status. ${workspace.message}`, "Choose Refresh status to try again."));
  } else {
    const data = workspace.data;
    const healthData = health.kind === "ok" ? health.data : null;
    const grid = node("div", undefined, "status-grid");
    grid.append(
      workspaceCard(data),
      modelCard(data, healthData),
      ...(connectedUI.providersReady ? [] : [notAvailableCard("Provider profiles", field(data, "providers", "profiles"))]),
      ...(connectedUI.githubReady ? [] : [notAvailableCard("GitHub", field(data, "catalog", "github"))]),
      notAvailableCard("Implementation sessions", field(data, "execution")),
      storageCard(data, healthData),
      secretsCard(data),
    );
    parts.push(grid);
  }
  if (health.kind === "ok") parts.push(healthCard(health.data));
  else if (health.kind === "error") {
    parts.push(errorBlock(`Could not load health status. ${health.message}`, "Choose Refresh status to try again."));
  } else if (health.kind === "legacy" && workspace.kind !== "legacy") {
    parts.push(node("p", "Health status unavailable in this build.", "page-status"));
  }
  root.replaceChildren(...parts);
}

function renderLegacyRepositories() {
  const root = byId("repositories-content");
  if (state.reposError) {
    root.replaceChildren(errorBlock(`Could not load repositories. ${state.reposError}`, "Reload the page to try again."));
    return;
  }
  if (!state.reposLoaded) {
    root.replaceChildren(node("p", "Loading repositories…", "page-status"));
    return;
  }
  if (!state.repos.length) {
    root.replaceChildren(node("p", "No repositories are indexed.", "page-status"));
    return;
  }
  const parts = [];
  const { workspace } = state.status;
  const source = workspace.kind === "ok" ? field(workspace.data, "catalog", "source")
    : state.repos.every((repo) => repo.demo) ? "demo_fixtures" : "local_checkouts";
  parts.push(node("p", source === "demo_fixtures" ? "Bundled example repositories for the sample workspace."
    : source === "local_checkouts" ? "Local Git checkouts, indexed from their committed HEAD when OpenDevin started."
    : "Repository source unknown.", "page-note"));
  const github = workspace.kind === "ok" ? field(workspace.data, "catalog", "github") : null;
  if (github) {
    const line = node("p", undefined, "page-note");
    line.append(chip(statusOf(github.status, ["not_available"])), document.createTextNode(` GitHub: ${typeof github.reason === "string" ? github.reason : "status unknown."}`));
    parts.push(line);
  }

  const table = node("table", undefined, "repo-table");
  table.append(node("caption", `${plural(state.repos.length, "indexed repository", "indexed repositories")}`, "sr-only"));
  const head = node("thead");
  const headRow = node("tr");
  for (const label of ["Repository", "Revision", "Files", "Index"]) {
    const cell = node("th", label);
    cell.setAttribute("scope", "col");
    headRow.append(cell);
  }
  head.append(headRow);
  const body = node("tbody");
  for (const repo of state.repos) {
    const row = node("tr");
    const name = node("th", repo.name);
    name.setAttribute("scope", "row");
    const revision = node("td");
    const revisionText = node(repo.demo ? "span" : "code", repo.demo ? "Sample" : String(repo.revision).slice(0, 7));
    revisionText.title = repo.demo ? "Bundled sample revision" : String(repo.revision);
    revision.append(revisionText);
    const files = node("td", String(repo.files));
    const index = node("td");
    index.append(repo.limited
      ? chip(["attention", "!", "Index limit reached: some files were not indexed"])
      : chip(["good", "✓", "Indexed"]));
    index.title = `Indexed ${formatTime(repo.indexed_at)}`;
    row.append(name, revision, files, index);
    body.append(row);
  }
  table.append(head, body);
  parts.push(table);
  root.replaceChildren(...parts);
}

const connectedUI = { githubReady: false, providersReady: false };
const githubPanel = node("section", undefined, "connected-panel");
const providerPanel = node("section", undefined, "connected-panel");
const catalogPanel = node("section", undefined, "connected-panel");
function renderSettings() {
  renderLegacySettings();
  byId("settings-content").append(githubPanel, providerPanel);
}
function renderRepositories() {
  renderLegacyRepositories();
  byId("repositories-content").append(catalogPanel);
}

showRoute(false);
refreshStatus();

try {
  const settings = await api("/api/repos");
  state.repos = settings.repos;
  state.model = settings.model;
  state.reposLoaded = true;
  const demo = state.repos.every((repo) => repo.demo);
  state.current = newConversation(state.repos.map(({ name }) => name));
  byId("mode-label").textContent = state.model ? "Ollama" : "Search only";
  byId("mode").classList.toggle("model-ready", Boolean(state.model));
  byId("mode").title = state.model ? `Ollama model · ${state.model}` : "Ollama is optional";
  byId("examples").hidden = !demo;
  byId("workspace-label").textContent = demo ? "Sample workspace" : "Local workspace";
  byId("intro-text").textContent = demo
    ? "Explore a sample checkout flow across a web app, API, database, and worker."
    : "Select repositories, ask a question, and inspect the matching source lines.";
  renderThread();
  syncControls();
} catch (error) {
  state.reposError = error.message;
  thread.setAttribute("aria-busy", "false");
  byId("mode-label").textContent = "Unavailable";
  byId("intro-text").textContent = error.message;
  byId("composer-status").textContent = "Could not load repositories";
}
renderWorkspaceMode();
if (state.route === "repositories") renderRepositories();

// Connected settings use only the committed M1 HTTP boundary. Mutations are
// never retried automatically, including when the network outcome is unknown.
async function featureRequest(path, method = "GET", payload) {
  let response;
  try {
    response = await fetch(path, { method, cache: "no-store", headers: { "Content-Type": "application/json" },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  } catch {
    throw new Error(method === "GET" ? "Server unreachable. Refresh to try again."
      : "Connection lost; the outcome is unknown. Refresh and inspect saved state before submitting again.");
  }
  let result;
  try { result = await response.json(); } catch { throw new Error("Unsupported server response. Refresh and inspect saved state."); }
  if (!response.ok) {
    // Never render arbitrary upstream messages or reflected secret material.
    const code = /^[a-z_]{1,64}$/.test(result?.code) ? result.code : `http_${response.status}`;
    throw new Error(`${code}. ${response.status === 404 ? "Endpoint unavailable in this build." : "Check configuration and refresh saved state before retrying."}`);
  }
  return result;
}
function action(text, handler) {
  const button = node("button", text, "button"); button.type = "button";
  button.addEventListener("click", handler); return button;
}
function control(parent, label, value = "", type = "text") {
  const wrap = node("label", label, "setting-field");
  const input = node(type === "pem" ? "textarea" : "input");
  // textarea.type is read-only in browsers; only input elements accept a type.
  if (type !== "pem") input.type = type;
  input.value = String(value);
  if (type === "password" || type === "pem") { input.autocomplete = "new-password"; input.setAttribute("autocomplete", "new-password"); }
  wrap.append(input); parent.append(wrap); return input;
}
function toggle(parent, label, checked) {
  const input = control(parent, label, "", "checkbox"); input.checked = Boolean(checked); return input;
}
function choose(parent, label, entries, selected) {
  const wrap = node("label", label, "setting-field"); const select = node("select");
  for (const [value, text] of entries) { const option = node("option", text); option.value = value; select.append(option); }
  select.value = selected; wrap.append(select); parent.append(wrap); return select;
}
function submitButton(form, label) { const button = node("button", label, "button"); button.type = "submit"; form.append(button); return button; }
function notice(parent) { const out = node("p", "", "page-status"); out.setAttribute("role", "status"); parent.append(out); return out; }
async function perform(button, output, operation) {
  if (button.disabled) return;
  button.disabled = true; output.textContent = "Working…";
  try { await operation(); } catch (error) { output.textContent = error.message; }
  finally { button.disabled = false; }
}
function timeLabel(value) { return value ? new Date(value).toLocaleString() : "Never"; }

async function loadGitHub() {
  githubPanel.replaceChildren(node("h2", "GitHub connection"));
  const output = notice(githubPanel); output.textContent = "Loading connections…";
  const retry = action("Reload GitHub status", loadGitHub); githubPanel.append(retry);
  try {
    const data = await featureRequest("/api/github/connections");
    if (!Array.isArray(data.connections) || !data.summary) throw new Error("Unsupported GitHub response.");
    connectedUI.githubReady = true;
    output.textContent = `${data.summary.status} · ${data.summary.installations} active installations · ${data.summary.repository_count} accessible repositories`;
    githubPanel.append(node("p", "Create a GitHub App in GitHub Developer settings. Use this server’s /api/github/callback as its setup URL; keep this server on loopback. Grant metadata/read contents for discovery and indexing; write contents/pull requests are separate optional permissions. Install only on repositories you intend to share. CLI login does not configure this App. Secure persistent storage must be available."));
    githubPanel.append(node("p", "Disconnect removes access, but does not delete retained data. New repository indexing and implementation access are independent; implementation is always explicit. No runtime or PR publication is provided by these settings."));
    for (const connection of data.connections) {
      const box = node("section", undefined, "setting-box");
      box.append(node("h3", `${connection.slug} · ${connection.status}`), node("p", `App ${connection.app_id} · Last refresh ${timeLabel(connection.last_refresh_at)} · Next retry ${timeLabel(connection.next_retry_at)}${connection.last_error_code ? ` · ${connection.last_error_code}` : ""}`));
      const status = notice(box);
      for (const [label, endpoint] of [["Create connect link", "connect"], ["Refresh catalog", "refresh"], ["Disconnect", "disconnect"]]) {
        const button = action(label, () => perform(button, status, async () => {
          const result = await featureRequest(`/api/github/${endpoint}`, "POST", { connection_id: connection.id });
          if (endpoint === "connect") {
            const url = new URL(result.install_url);
            if (url.origin !== "https://github.com" || !url.pathname.startsWith("/apps/")) throw new Error("Invalid installation destination.");
            const link = node("a", "Continue installation on GitHub"); link.href = url.href; link.rel = "noreferrer";
            status.replaceChildren(link, node("span", ` · Expires ${timeLabel(result.expires_at)}`));
          } else {
            status.textContent = endpoint === "refresh" ? `Discovery ${result.state}. Reload status to check progress.` : "Disconnected. Reload status to inspect access.";
            await loadCatalog(true);
          }
        })); box.append(button);
      }
      githubPanel.append(box);
    }
    const form = node("form", undefined, "settings-form"); form.autocomplete = "off";
    form.append(node("h3", "Configure or rotate GitHub App credentials"));
    const appID = control(form, "App ID", "", "number"); appID.required = true; appID.min = "1";
    const slug = control(form, "App slug"); slug.required = true;
    const key = control(form, "RSA private key PEM (never redisplayed)", "", "pem"); key.required = true;
    const indexNew = toggle(form, "Index newly discovered repositories", false);
    const save = submitButton(form, "Save App configuration"); const status = notice(form);
    form.addEventListener("submit", event => {
      event.preventDefault(); if (save.disabled) return;
      const payload = { app_id: appID.value.trim(), slug: slug.value.trim(), private_key: key.value, index_new: indexNew.checked };
      key.value = "";
      perform(save, status, async () => { try { await featureRequest("/api/github/configure", "POST", payload); } finally { payload.private_key = ""; } await loadGitHub(); });
    });
    githubPanel.append(form);
  } catch (error) { output.textContent = `GitHub unavailable: ${error.message}`; }
}

const catalog = { cursor: null, previous: [], next: null, sequence: 0 };
const catalogForm = node("form", undefined, "settings-form catalog-filters");
catalogPanel.append(node("h2", "GitHub repository catalog"), node("p", "Catalog metadata is available before source indexing. Indexing selection does not grant implementation permission. Ask below still uses its explicit local/demo snapshots."));
const searchCatalog = control(catalogForm, "Search name or description", "", "search"); searchCatalog.maxLength = 200;
const ownerCatalog = control(catalogForm, "Exact owner");
const indexCatalog = choose(catalogForm, "Indexing selection", [["", "All"], ["true", "Enabled"], ["false", "Disabled"]], "");
const languageCatalog = control(catalogForm, "Language on this page");
const archivedCatalog = choose(catalogForm, "Archive state on this page", [["", "All"], ["true", "Archived"], ["false", "Active"]], "");
const forkCatalog = choose(catalogForm, "Fork state on this page", [["", "All"], ["true", "Forks"], ["false", "Originals"]], "");
submitButton(catalogForm, "Apply catalog filters"); catalogPanel.append(catalogForm);
const catalogStatus = notice(catalogPanel); const catalogRows = node("div"); catalogPanel.append(catalogRows);
const catalogPrevious = action("Previous page", () => { catalog.cursor = catalog.previous.pop() ?? null; loadCatalog(); });
const catalogNext = action("Next page", () => { catalog.previous.push(catalog.cursor); catalog.cursor = catalog.next; loadCatalog(); });
const catalogReload = action("Reload catalog", () => loadCatalog(true));
catalogPanel.append(catalogPrevious, catalogNext, catalogReload);
catalogForm.addEventListener("submit", event => { event.preventDefault(); loadCatalog(true); });
async function loadCatalog(reset = false) {
  if (reset) { catalog.cursor = null; catalog.previous = []; }
  const sequence = ++catalog.sequence;
  catalogPrevious.disabled = true; catalogNext.disabled = true; catalogStatus.textContent = "Loading catalog…";
  catalogRows.replaceChildren();
  const params = new URLSearchParams({ limit: "25" });
  if (searchCatalog.value.trim()) params.set("query", searchCatalog.value.trim());
  if (ownerCatalog.value.trim()) params.set("owner", ownerCatalog.value.trim());
  if (indexCatalog.value) params.set("index_enabled", indexCatalog.value);
  if (catalog.cursor) params.set("cursor", catalog.cursor);
  try {
    const result = await featureRequest(`/api/repositories?${params}`);
    if (sequence !== catalog.sequence) return;
    if (!Array.isArray(result.items)) throw new Error("Unsupported catalog response.");
    catalog.next = result.next_cursor;
    catalogStatus.textContent = `${result.total} matching repositories · ${result.items.length} on this page. ${result.items.length ? "" : "Connect GitHub or change filters to find repositories."}`;
    const visible = result.items.filter(repo =>
      (!languageCatalog.value.trim() || (repo.language || "").toLowerCase() === languageCatalog.value.trim().toLowerCase()) &&
      (!archivedCatalog.value || String(repo.archived) === archivedCatalog.value) &&
      (!forkCatalog.value || String(repo.fork) === forkCatalog.value));
    catalogStatus.textContent += ` ${visible.length} visible after page filters. Language/archive/fork filters apply only to this page; use Next page to continue.`;
    for (const repo of visible) {
      const box = node("section", undefined, "setting-box");
      box.append(node("h3", repo.full_name), node("p", repo.description || "No description"),
        node("p", `${repo.language || "Language unknown"} · ${repo.visibility || "Visibility unknown"} · ${repo.archived ? "Archived" : "Active"} · ${repo.fork ? "Fork" : "Original"} · ${repo.access_state}`),
        node("p", `Branch ${repo.default_branch || "unknown"} · Last push ${timeLabel(repo.pushed_at)} · Topics: ${(repo.topics || []).join(", ") || "none"}`),
        node("p", "Source index status unknown: deep indexing HTTP integration pending. Selection saves eligibility only; it does not confirm an indexed snapshot."));
      const form = node("form", undefined, "settings-form");
      const indexing = toggle(form, `Index ${repo.full_name}`, repo.index_enabled);
      const implementation = toggle(form, `Allow implementation in ${repo.full_name}`, repo.implementation_enabled);
      const save = submitButton(form, "Save repository selection"); const status = notice(form);
      if (repo.access_state !== "accessible") { indexing.disabled = true; implementation.disabled = true; save.disabled = true; status.textContent = "Access unavailable. Reconnect or refresh GitHub; saved choices do not grant access."; }
      form.addEventListener("submit", event => { event.preventDefault(); perform(save, status, async () => {
        await featureRequest(`/api/repositories/${encodeURIComponent(repo.id)}`, "PATCH", { index_enabled: indexing.checked, implementation_enabled: implementation.checked });
        status.textContent = "Selection saved. GitHub capabilities will be checked again before execution.";
      }); }); box.append(form); catalogRows.append(box);
    }
    catalogPrevious.disabled = !catalog.previous.length; catalogNext.disabled = !catalog.next;
  } catch (error) { if (sequence === catalog.sequence) catalogStatus.textContent = `Catalog unavailable: ${error.message}`; }
}

let providerProfiles = [];
let providerSettings;
let providerEditor;
async function loadProviders() {
  providerPanel.replaceChildren(node("h2", "Model providers and roles"));
  const output = notice(providerPanel); output.textContent = "Loading provider settings…";
  providerPanel.append(action("Reload provider settings", loadProviders));
  try {
    const [profiles, settings] = await Promise.all([featureRequest("/api/provider-profiles"), featureRequest("/api/settings/model-roles")]);
    if (!Array.isArray(profiles.profiles) || typeof settings.settings?.local_only !== "boolean" || !settings.roles) throw new Error("Unsupported provider response.");
    providerProfiles = profiles.profiles; providerSettings = settings;
    connectedUI.providersReady = true;
    output.textContent = "Profiles configure inference, not an implementation runner. Legacy Ask continues using its startup model. Costs are unknown unless pricing and actual usage are available. Tests send synthetic content only.";
    const policy = node("form", undefined, "settings-form");
    const local = toggle(policy, "Local-only inference and embeddings (blocks remote destinations)", settings.settings.local_only);
    const savePolicy = submitButton(policy, "Save destination policy"); const policyStatus = notice(policy);
    policy.addEventListener("submit", event => { event.preventDefault(); perform(savePolicy, policyStatus, async () => {
      await featureRequest("/api/settings/model-roles", "PATCH", { local_only: local.checked }); await loadProviders();
    }); });
    providerPanel.append(policy, node("p", "External source sharing requires a separate profile opt-in. Disabling local-only does not authorize source sharing. Model profiles cannot execute repository tools or publish PRs."));
    for (const profile of providerProfiles) {
      const box = node("section", undefined, "setting-box"); const version = profile.version;
      box.append(node("h3", profile.name), node("p", `${version.adapter} · ${version.model} · Version ${version.version}`),
        node("p", `Destination: ${version.endpoint} · Capabilities: ${version.config.capabilities.join(", ")} · Credential ${version.credential_configured ? "configured" : "not configured"}`),
        node("p", `External source sharing ${version.config.allow_external_source ? "allowed by profile (workspace policy still applies)" : "disabled"}`));
      const status = notice(box);
      box.append(action(`Edit ${profile.name} / rotate credential`, () => { renderProviderEditor(profile); providerEditor.querySelector("input")?.focus(); }));
      const test = action(`Test ${profile.name}`, () => perform(test, status, async () => {
        const result = await featureRequest(`/api/provider-profiles/${encodeURIComponent(profile.id)}/test`, "POST", { capabilities: version.config.capabilities });
        status.textContent = `Test ${result.status}: ${Object.entries(result.capabilities || {}).map(([cap, value]) => `${cap}: ${value.status}${value.error_code ? ` (${value.error_code})` : ""}`).join(" · ")}. Destination ${result.destination?.kind || "unknown"}: ${result.destination?.host || "unknown"}. Synthetic content only; cost unknown.`;
      })); box.append(test);
      const remove = action(`Delete ${profile.name}`, () => {
        const confirm = action(`Confirm delete ${profile.name}`, () => perform(confirm, status, async () => {
          await featureRequest(`/api/provider-profiles/${encodeURIComponent(profile.id)}`, "DELETE", {}); await loadProviders();
        }));
        status.replaceChildren(node("span", "Deletion revokes credentials and removes active roles; historical metadata remains. "), confirm, action("Cancel deletion", () => { status.textContent = "Deletion cancelled."; }));
      }); box.append(remove); providerPanel.append(box);
    }
    const roles = node("section", undefined, "setting-box"); roles.append(node("h3", "Default model roles"));
    for (const role of ["ask", "planning", "summary", "embedding"]) {
      const value = settings.roles[role] || {}; const form = node("form", undefined, "settings-form");
      const select = choose(form, `${role} profile`, [["", "Unassigned"], ...providerProfiles.map(p => [p.id, p.name])], value.profile_id || "");
      form.append(node("p", `${value.status || "unknown"} · Destination: ${value.destination ? `${value.destination.kind}: ${value.destination.host}` : "none"} · Version ${value.version_id || "none"}`));
      const save = submitButton(form, `Save ${role} role`); const status = notice(form);
      form.addEventListener("submit", event => { event.preventDefault(); perform(save, status, async () => {
        await featureRequest("/api/settings/model-roles", "PATCH", { assignments: { [role]: select.value || null } }); await loadProviders();
      }); }); roles.append(form);
    }
    providerPanel.append(roles);
    providerEditor = node("section", undefined, "setting-box"); providerPanel.append(providerEditor); renderProviderEditor();
  } catch (error) { output.textContent = `Provider settings unavailable: ${error.message}`; }
}
function renderProviderEditor(profile = null) {
  const version = profile?.version; const config = version?.config || {};
  providerEditor.replaceChildren(node("h3", profile ? `Edit ${profile.name}` : "Create provider profile"));
  const form = node("form", undefined, "settings-form"); form.setAttribute("autocomplete", "off");
  const name = control(form, "Profile name", profile?.name || ""); name.required = true; name.maxLength = 100;
  const adapter = choose(form, "Adapter", [["ollama", "Ollama"], ["openai_compatible", "OpenAI compatible"]], version?.adapter || "ollama");
  const endpoint = control(form, "Base URL / destination", version?.endpoint || "http://127.0.0.1:11434", "url"); endpoint.required = true;
  form.append(node("p", "Use the /v1 base for OpenAI compatible APIs. Only loopback HTTP or HTTPS is supported. Requests go to this destination; redirects are rejected."));
  const model = control(form, "Model identifier", version?.model || ""); model.required = true;
  const secret = control(form, profile ? "New credential (leave blank to retain current credential)" : "Credential (optional for local Ollama)", "", "password");
  const caps = {};
  for (const cap of ["chat", "structured_output", "embeddings"]) caps[cap] = toggle(form, cap, config.capabilities ? config.capabilities.includes(cap) : cap === "chat");
  const dimensions = control(form, "Embedding dimensions (required for embeddings)", config.embedding_dimensions || "", "number"); dimensions.min = "1"; dimensions.max = "16384";
  const timeout = control(form, "Timeout seconds", config.timeout_seconds ?? 60, "number"); timeout.min = "1"; timeout.max = "600"; timeout.required = true;
  const context = control(form, "Context token limit", config.context_limit ?? 8192, "number"); context.min = "256"; context.max = "2000000"; context.required = true;
  const output = control(form, "Maximum output tokens", config.max_output_tokens ?? 1024, "number"); output.min = "1"; output.max = "131072"; output.required = true;
  const external = toggle(form, "Allow sending repository source to this external destination", config.allow_external_source);
  const inputPrice = control(form, "Input price USD per million tokens (blank = unknown)", config.input_price_per_million ?? "", "number");
  const outputPrice = control(form, "Output price USD per million tokens (blank = unknown)", config.output_price_per_million ?? "", "number");
  for (const price of [inputPrice, outputPrice]) { price.min = "0"; price.max = "1000000"; price.step = "any"; }
  const save = submitButton(form, profile ? "Save new profile version" : "Create profile");
  if (profile) form.append(action("Cancel edit / new profile", () => renderProviderEditor()));
  const status = notice(form);
  form.addEventListener("submit", event => {
    event.preventDefault(); if (save.disabled) return;
    const capabilities = Object.keys(caps).filter(cap => caps[cap].checked);
    const secretValue = secret.value; secret.value = "";
    if (!capabilities.length || (caps.structured_output.checked && !caps.chat.checked)) { status.textContent = "Choose at least one capability. structured_output requires chat. Credential cleared; re-enter it when ready."; return; }
    const config = { capabilities, timeout_seconds: Number(timeout.value), context_limit: Number(context.value), max_output_tokens: Number(output.value), allow_external_source: external.checked };
    if (caps.embeddings.checked) config.embedding_dimensions = Number(dimensions.value);
    if (inputPrice.value !== "") config.input_price_per_million = Number(inputPrice.value);
    if (outputPrice.value !== "") config.output_price_per_million = Number(outputPrice.value);
    const payload = { name: name.value.trim(), adapter: adapter.value, endpoint: endpoint.value.trim(), model: model.value.trim(), config };
    if (secretValue) payload.secret_value = secretValue;
    perform(save, status, async () => {
      try { await featureRequest(profile ? `/api/provider-profiles/${encodeURIComponent(profile.id)}` : "/api/provider-profiles", profile ? "PATCH" : "POST", payload); }
      finally { delete payload.secret_value; }
      await loadProviders();
    });
  }); providerEditor.append(form);
}

// Callback contains a bounded status code only; never display callback query data.
if (/^#\/settings\?github=[a-z_]{1,64}$/.test(location.hash)) {
  const callbackNotice = node("p", "GitHub setup returned. Reload connection status to confirm installation or pending approval."); githubPanel.append(callbackNotice);
}
await Promise.all([loadGitHub(), loadProviders(), loadCatalog()]);
if (state.route === "settings") renderSettings();
if (state.route === "repositories") renderRepositories();
