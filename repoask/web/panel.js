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

  const tabList = make("div", undefined, "side-tabs");
  tabList.setAttribute("role", "tablist");
  const closeAll = make("button", "×", "icon-button side-close");
  closeAll.type = "button";
  closeAll.setAttribute("aria-label", "Close panel");
  const header = make("div", undefined, "side-header");
  header.append(tabList, closeAll);
  const body = make("div", undefined, "side-body");
  body.setAttribute("role", "tabpanel");
  host.replaceChildren(header, body);

  function render() {
    tabList.replaceChildren();
    for (const [id, tab] of tabs) {
      const button = make("button", tab.title, "side-tab");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(id === active)); button.setAttribute("tabindex", id===active ? "0" : "-1");
      button.addEventListener("keydown",event=>{const ids=[...tabs.keys()],at=ids.indexOf(id);let next;if(event.key==='ArrowRight')next=(at+1)%ids.length;else if(event.key==='ArrowLeft')next=(at+ids.length-1)%ids.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=ids.length-1;else return;event.preventDefault();active=ids[next];render();[...tabList.querySelectorAll("button")][next]?.focus();});
      button.addEventListener("click", () => { active = id; render(); });
      tabList.append(button);
    }
    body.replaceChildren();
    const tab = tabs.get(active);
    if (tab) tab.render(body);
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
    if (event.key !== "Escape" || host.hidden || event.defaultPrevented || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    api.close();
  });
  return api;
}
