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
      message.textContent = error && error.message ? error.message : "Could not save.";
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

  const focusables = () => root.querySelectorAll(FOCUSABLE).filter((node) =>
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
