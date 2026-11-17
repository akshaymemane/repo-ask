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
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const INLINE = /`([^`\n]+)`|\*\*(?=\S)([^\n]*?\S)\*\*/g;

function inline(parent, text, allowBold = true) {
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match[2] !== undefined && !allowBold) continue;
    if (match.index > last) parent.append(document.createTextNode(text.slice(last, match.index)));
    if (match[1] !== undefined) parent.append(el("code", match[1]));
    else { const strong = el("strong"); inline(strong, match[2], false); parent.append(strong); }
    last = match.index + match[0].length;
  }
  if (last < text.length) parent.append(document.createTextNode(text.slice(last)));
}

export function renderMarkdown(text, className = "md") {
  const root = el("div", undefined, className);
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  let paragraph = [];
  const flush = () => {
    if (!paragraph.length) return;
    const p = el("p");
    paragraph.forEach((line, i) => { if (i) p.append(document.createTextNode("\n")); inline(p, line); });
    root.append(p); paragraph = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const body = [];
      // A fence closes on a line of the same character, at least as long; an unclosed fence runs to the end.
      const close = new RegExp(`^\\s{0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
      for (i += 1; i < lines.length && !close.test(lines[i]); i += 1) body.push(lines[i]);
      const pre = el("pre"); pre.append(el("code", body.join("\n"))); root.append(pre);
      continue;
    }
    const bullet = BULLET.exec(line), numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered && !bullet), list = el(ordered ? "ol" : "ul"), pattern = ordered ? NUMBERED : BULLET;
      if (ordered && numbered[1] !== "1") list.setAttribute("start", String(Number(numbered[1])));
      for (; i < lines.length && pattern.test(lines[i]); i += 1) { const item = pattern.exec(lines[i]); const li = el("li"); inline(li, ordered ? item[2] : item[1]); list.append(li); }
      i -= 1; root.append(list);
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    paragraph.push(line);
  }
  flush();
  return root;
}
