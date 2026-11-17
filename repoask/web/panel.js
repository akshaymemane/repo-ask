// Right-hand slide-in panel with tabs (code files, plans, repository details).

export function createSidePanel(host) {
  const document = host.ownerDocument;
  const make = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const tabs = new Map();
  let active = null;
  let returnFocus = null;
  const panelId = host.id || `side-panel-${Math.random().toString(36).slice(2)}`;
  host.id = panelId;
  const compact = () => globalThis.matchMedia?.("(max-width: 760px)")?.matches === true;
  let inerted = [];

  const tabList = make("div", undefined, "side-tabs");
  tabList.setAttribute("role", "tablist");
  const closeAll = make("button", "×", "icon-button side-close");
  closeAll.type = "button";
  closeAll.setAttribute("aria-label", "Close panel");
  const header = make("div", undefined, "side-header");
  header.append(tabList, closeAll);
  const body = make("div", undefined, "side-body");
  body.setAttribute("role", "tabpanel");
  body.id = `${panelId}-tabpanel`;
  host.replaceChildren(header, body);

  function setCompactModal(enabled) {
    if (!enabled) {
      host.removeAttribute("role");
      host.removeAttribute("aria-modal");
      for (const [node, wasInert] of inerted) node.inert = wasInert;
      inerted = [];
      return;
    }
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    const outside = [];
    for (let current = host; current && current !== document.body; current = current.parentNode) {
      for (const sibling of current.parentNode?.children ?? []) {
        if (sibling !== current && !outside.includes(sibling)) outside.push(sibling);
      }
    }
    inerted = outside.map((node) => [node, Boolean(node.inert)]);
    for (const [node] of inerted) node.inert = true;
  }

  function focusable() {
    return [
      ...host.querySelectorAll("button"), ...host.querySelectorAll("a"),
      ...host.querySelectorAll("input"), ...host.querySelectorAll("select"),
      ...host.querySelectorAll("textarea"),
    ].filter((node) => !node.disabled && node.getAttribute("tabindex") !== "-1" && !node.hidden);
  }

  function render() {
    tabList.replaceChildren();
    for (const [id, tab] of tabs) {
      const button = make("button", tab.title, "side-tab");
      button.type = "button";
      button.id = `${panelId}-tab-${encodeURIComponent(id)}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", body.id);
      button.setAttribute("aria-selected", String(id === active)); button.setAttribute("tabindex", id===active ? "0" : "-1");
      button.addEventListener("keydown",event=>{const ids=[...tabs.keys()],at=ids.indexOf(id);let next;if(event.key==='ArrowRight')next=(at+1)%ids.length;else if(event.key==='ArrowLeft')next=(at+ids.length-1)%ids.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=ids.length-1;else return;event.preventDefault();active=ids[next];render();[...tabList.querySelectorAll("button")][next]?.focus();});
      button.addEventListener("click", () => { active = id; render(); });
      tabList.append(button);
    }
    body.replaceChildren();
    const tab = tabs.get(active);
    if (tab) {
      body.setAttribute("aria-labelledby", `${panelId}-tab-${encodeURIComponent(active)}`);
      tab.render(body);
    }
  }

  const api = {
    openTab({ id, title, render: draw, canClose = null }) {
      const opener = document.activeElement;
      let inside = false;
      for (let node = opener; node; node = node.parentNode) if (node === host) inside = true;
      if (!inside && opener && opener !== document.body && opener.isConnected) returnFocus = opener;
      tabs.set(id, { title, render: draw, canClose });
      active = id;
      host.hidden = false;
      setCompactModal(compact());
      render();
      const selected = [...tabList.querySelectorAll("button")].find((tab) => tab.getAttribute("aria-selected") === "true");
      (selected ?? closeAll).focus();
    },
    closeTab(id) {
      if(tabs.get(id)?.canClose && !tabs.get(id).canClose())return false;
      tabs.delete(id);
      if (!tabs.size) return api.close();
      if (active === id) active = [...tabs.keys()].at(-1);
      render();
    },
    close({force=false} = {}) {
      if (host.hidden) return true;
      if(!force && [...tabs.values()].some(tab=>tab.canClose && !tab.canClose()))return false;
      tabs.clear();
      active = null;
      host.hidden = true;
      setCompactModal(false);
      body.replaceChildren();
      tabList.replaceChildren();
      if (returnFocus && returnFocus.isConnected) returnFocus.focus();
      returnFocus = null;
    },
    isOpen: () => !host.hidden,
  };

  closeAll.addEventListener("click", () => api.close());
  // Escape closes the panel from anywhere, unless a dialog (which handles its own Escape) is open.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && !host.hidden && compact()) {
      const nodes = focusable();
      if (!nodes.length) return;
      const at = nodes.indexOf(document.activeElement);
      if (event.shiftKey && at <= 0) {
        event.preventDefault();
        nodes.at(-1).focus();
      } else if (!event.shiftKey && (at < 0 || at === nodes.length - 1)) {
        event.preventDefault();
        nodes[0].focus();
      }
      return;
    }
    if (event.key !== "Escape" || host.hidden || event.defaultPrevented || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    api.close();
  });
  return api;
}
