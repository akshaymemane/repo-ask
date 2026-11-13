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
  if (event.key === "Escape" && !dialog.open) {
    if (!byId("source-panel").hidden) closeSource(true);
    else toggleHistory(false);
  }
});

try {
  const settings = await api("/api/repos");
  state.repos = settings.repos;
  state.model = settings.model;
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
  thread.setAttribute("aria-busy", "false");
  byId("mode-label").textContent = "Unavailable";
  byId("intro-text").textContent = error.message;
  byId("composer-status").textContent = "Could not load repositories";
}
