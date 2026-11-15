// Chat composer: message box, repository chips (+ picker and @ mentions), send/cancel, drafts.
import { button, el } from "./ui.js";
import { openRepoPicker } from "./picker.js";
import { attachMentions } from "./mentions.js";

function readDraft(key) {
  try { return globalThis.sessionStorage?.getItem(key) ?? ""; } catch { return ""; }
}
function writeDraft(key, value) {
  try {
    if (value) globalThis.sessionStorage?.setItem(key, value);
    else globalThis.sessionStorage?.removeItem(key);
  } catch {
    // Drafts are a convenience; storage may be unavailable.
  }
}

export function createComposer({ request, placeholder = "Ask about your code, or describe a change…", onSend, onScopeChange, onCancel, draftKey, chips: withChips = true }) {
  const root = el("form", undefined, "composer-v2");
  root.noValidate = true;
  const field = el("div", undefined, "composer-field");
  const textarea = el("textarea");
  textarea.rows = 2;
  textarea.maxLength = 4000;
  textarea.setAttribute("placeholder", placeholder);
  textarea.setAttribute("aria-label", "Message");
  field.append(textarea);
  const row = el("div", undefined, "composer-row");
  const chipList = el("div", undefined, "composer-chips");
  const error = el("p", "", "composer-error");
  error.setAttribute("aria-live", "polite");
  const send = button(null, "↑", () => (busy ? cancel() : submit()), { variant: "primary" });
  send.classList.add("composer-send");
  send.setAttribute("aria-label", "Send");
  root.append(field, row, error);

  let chips = [];
  let busy = false;
  let sending = false;
  let plus = null;

  function renderChips() {
    chipList.replaceChildren();
    for (const chip of chips) {
      const item = el("span", undefined, "chip-repo");
      item.append(el("span", chip.name, "chip-label"));
      const remove = button(item, "×", () => change(chips.filter((other) => other.id !== chip.id)), { variant: "ghost" });
      remove.setAttribute("aria-label", `Remove ${chip.name}`);
      chipList.append(item);
    }
  }

  async function change(next) {
    const previous = chips;
    chips = next;
    renderChips();
    error.textContent = "";
    try {
      await onScopeChange(next.map((chip) => chip.id));
    } catch (failure) {
      chips = previous;
      renderChips();
      error.textContent = failure?.message || "Could not update repositories.";
    }
  }

  function addRepositories(repos) {
    const merged = [...chips];
    for (const repo of repos) if (!merged.some((chip) => chip.id === repo.id)) merged.push(repo);
    if (merged.length !== chips.length) change(merged);
  }

  if (withChips) {
    plus = button(null, "+", async () => {
      const result = await openRepoPicker({ request, selected: chips, trigger: plus });
      if (result === null) return;
      const keep = new Set(result.map((repo) => repo.id));
      const same = keep.size === chips.length && chips.every((chip) => keep.has(chip.id));
      if (!same) change([...chips.filter((chip) => keep.has(chip.id)), ...result.filter((repo) => !chips.some((chip) => chip.id === repo.id))]);
    }, { variant: "ghost" });
    plus.classList.add("composer-plus");
    plus.setAttribute("aria-label", "Add repositories");
    plus.setAttribute("title", "Add repositories (or type @)");
    attachMentions(textarea, { request, onPick: (repo) => addRepositories([repo]) });
    row.append(plus, chipList, send);
  } else {
    row.append(el("span", undefined, "composer-spacer"), send);
  }

  async function submit() {
    const text = textarea.value.trim();
    if (!text || busy || sending) return;
    sending = true;
    error.textContent = "";
    try {
      await onSend({ text, repositoryIds: chips.map((chip) => chip.id) });
      textarea.value = "";
      writeDraft(draftKey, "");
    } catch (failure) {
      error.textContent = failure?.message || "Could not send.";
    } finally {
      sending = false;
    }
  }
  async function cancel() {
    try { await onCancel(); } catch (failure) { error.textContent = failure?.message || "Could not cancel."; }
  }

  textarea.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.defaultPrevented) return;
    event.preventDefault();
    submit();
  });
  textarea.addEventListener("input", () => writeDraft(draftKey, textarea.value));
  root.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
  textarea.value = readDraft(draftKey);

  return {
    root,
    setChips(next) { chips = [...next]; renderChips(); },
    setBusy(next) {
      busy = Boolean(next);
      send.textContent = busy ? "Cancel" : "↑";
      send.setAttribute("aria-label", busy ? "Cancel" : "Send");
      send.classList.toggle("btn-primary", !busy);
    },
    focus() { textarea.focus(); },
  };
}
