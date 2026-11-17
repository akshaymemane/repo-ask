// Shared DOM primitives for the redesigned UI. No framework; every control is a native element.

export function el(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function button(parent, text, onClick, { variant, title } = {}) {
  const control = el("button", text, `btn${variant ? ` btn-${variant}` : ""}`);
  control.type = "button";
  if (title) control.setAttribute("title", title);
  control.addEventListener("click", (event) => onClick(event, control));
  if (parent) parent.append(control);
  return control;
}

export function badge(tone, text) {
  return el("span", text, `badge badge-${tone}`);
}

// A switch flips immediately, then saves; a failed save reverts and says why.
export function toggleSwitch({ label, checked, onChange }) {
  const root = el("span", undefined, "switch-field");
  const control = el("button", undefined, "switch");
  control.type = "button";
  control.setAttribute("role", "switch");
  control.setAttribute("aria-label", label);
  const message = el("span", "", "switch-error");
  message.setAttribute("aria-live", "polite");
  root.append(control, message);
  let value = Boolean(checked);
  let pending = false;
  const show = (next) => control.setAttribute("aria-checked", String(next));
  show(value);
  control.addEventListener("click", async () => {
    if (pending) return;
    pending = true;
    const next = !value;
    show(next);
    message.textContent = "";
    control.setAttribute("aria-busy", "true");
    try {
      await onChange(next);
      value = next;
    } catch (error) {
      show(value);
      message.textContent = error?.silent ? "" : error && error.message ? error.message : "Could not save.";
    } finally {
      pending = false;
      control.removeAttribute("aria-busy");
    }
  });
  return { root, set(next) { value = Boolean(next); show(value); } };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function relativeTime(ms, now = Date.now()) {
  const age = now - ms;
  if (age < 45_000) return "now";
  if (age < 3_600_000) return `${Math.max(1, Math.round(age / 60_000))} min ago`;
  if (age < 86_400_000) return `${Math.round(age / 3_600_000)} h ago`;
  if (age < 172_800_000) return "yesterday";
  const date = new Date(ms);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

const FOCUSABLE = "button, input, select, textarea, a";

// Accessible modal on <dialog>: focus stays inside, Escape closes with null,
// focus returns to the control that opened it.
export function createModal({ title, onClose } = {}) {
  const root = el("dialog", undefined, "modal");
  const heading = el("h2", title, "modal-title");
  const close = button(null, "×", () => api.close(null), { variant: "ghost" });
  close.classList.add("modal-close");
  close.setAttribute("aria-label", "Close");
  const header = el("header", undefined, "modal-header");
  header.append(heading, close);
  const body = el("div", undefined, "modal-body");
  const footer = el("footer", undefined, "modal-footer");
  root.append(header, body, footer);
  let trigger = null;
  let settle;
  const closed = new Promise((resolve) => { settle = resolve; });

  const focusables = () => [...root.querySelectorAll(FOCUSABLE)].filter((node) =>
    !node.disabled && !node.closest("[hidden]") && (node.tagName !== "A" || node.hasAttribute("href")));

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      api.close(null);
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  root.addEventListener("cancel", (event) => { event.preventDefault(); api.close(null); });

  const api = {
    root, body, footer, closed,
    open(opener) {
      trigger = opener ?? document.activeElement;
      if (!root.isConnected) document.body.append(root);
      root.showModal();
      const target = body.querySelector("input, textarea") ?? focusables()[0];
      if (target) target.focus();
    },
    close(result = null) {
      if (!root.hasAttribute("open")) return;
      root.close();
      root.remove();
      if (trigger && trigger.isConnected) trigger.focus();
      if (onClose) onClose(result);
      settle(result);
    },
  };
  return api;
}

// Safe Markdown subset for agent prose: paragraphs, **bold**, `inline code`, fenced code blocks,
// unordered and ordered lists. Built only from elements and text nodes (never innerHTML), so markup
// in the input stays literal text. Anything else, including links and headings, is shown as written.
// Parsing is linear in the input, and output is capped; a capped message says so and keeps the full
// text available as plain text.
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
export const MARKDOWN_LIMITS = { chars: 20000, nodes: 600 };
const isSpace = (ch) => ch === undefined || /\s/.test(ch);

// One left-to-right pass. A code span closes at the next backtick; a bold run at the first later "**"
// preceded by a non-space character. When a search for a closer fails, no later opener of that kind
// can succeed either, so that kind is switched off for the rest of the text: no position is rescanned.
function inline(parent, text, budget, allowBold = true) {
  let plain = 0, i = 0, codeOpen = true, boldOpen = allowBold;
  const flush = (end) => { if (end > plain) { budget.nodes -= 1; parent.append(document.createTextNode(text.slice(plain, end))); } };
  while (i < text.length) {
    if (budget.nodes <= 2) { budget.truncated = budget.stopped = true; break; }
    const ch = text[i];
    if (ch === "`" && codeOpen) {
      const end = text.indexOf("`", i + 1);
      if (end === -1) codeOpen = false;
      else if (end > i + 1) { flush(i); budget.nodes -= 1; parent.append(el("code", text.slice(i + 1, end))); i = end + 1; plain = i; continue; }
    } else if (ch === "*" && boldOpen && text[i + 1] === "*" && !isSpace(text[i + 2])) {
      let from = i + 3, end = -1;
      while ((end = text.indexOf("**", from)) !== -1 && isSpace(text[end - 1])) from = end + 1;
      if (end === -1) boldOpen = false;
      else { flush(i); budget.nodes -= 1; const strong = el("strong"); inline(strong, text.slice(i + 2, end), budget, false); parent.append(strong); i = end + 2; plain = i; continue; }
    }
    i += 1;
  }
  flush(text.length);
}

export function renderMarkdown(text, className = "md") {
  const root = el("div", undefined, className);
  const source = String(text ?? "").replace(/\r\n?/g, "\n");
  const budget = { nodes: MARKDOWN_LIMITS.nodes, truncated: source.length > MARKDOWN_LIMITS.chars, stopped: false };
  const shown = budget.truncated ? source.slice(0, MARKDOWN_LIMITS.chars) : source;
  const lines = shown.split("\n");
  let paragraph = [];
  const block = (node) => { budget.nodes -= 1; root.append(node); return node; };
  const flush = () => {
    if (!paragraph.length) return;
    const p = block(el("p"));
    paragraph.forEach((line, i) => { if (i) p.append(document.createTextNode("\n")); inline(p, line, budget); });
    paragraph = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    if (budget.stopped || budget.nodes <= 0) { budget.truncated = true; break; }
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      // A fence closes on a line of the same character, at least as long; an unclosed fence runs to the end.
      const close = new RegExp(`^\\s{0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
      const body = [];
      for (i += 1; i < lines.length && !close.test(lines[i]); i += 1) body.push(lines[i]);
      const pre = block(el("pre")); pre.append(el("code", body.join("\n"))); budget.nodes -= 1;
      continue;
    }
    const bullet = BULLET.exec(line), numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered && !bullet), list = block(el(ordered ? "ol" : "ul")), pattern = ordered ? NUMBERED : BULLET;
      if (ordered && numbered[1] !== "1") list.setAttribute("start", String(Number(numbered[1])));
      for (; i < lines.length && pattern.test(lines[i]); i += 1) {
        if (budget.nodes <= 2) { budget.truncated = budget.stopped = true; break; }
        const item = pattern.exec(lines[i]); const li = el("li"); budget.nodes -= 1; inline(li, ordered ? item[2] : item[1], budget); list.append(li);
      }
      i -= 1;
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    paragraph.push(line);
  }
  flush();
  if (budget.truncated) {
    // The marker and the full plain text sit outside the budget: one paragraph and one text node.
    root.append(el("p", "… message truncated", "md-truncated"));
    const full = el("details", undefined, "md-full"), label = el("summary", "Show the full message as plain text");
    full.append(label, el("pre", source)); root.append(full);
  }
  return root;
}
