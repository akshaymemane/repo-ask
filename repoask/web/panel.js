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
      button.setAttribute("aria-selected", String(id === active));
      button.addEventListener("click", () => { active = id; render(); });
      tabList.append(button);
    }
    body.replaceChildren();
    const tab = tabs.get(active);
    if (tab) tab.render(body);
  }

  const api = {
    openTab({ id, title, render: draw }) {
      if (host.hidden) returnFocus = document.activeElement;
      tabs.set(id, { title, render: draw });
      active = id;
      host.hidden = false;
      render();
    },
    closeTab(id) {
      tabs.delete(id);
      if (!tabs.size) return api.close();
      if (active === id) active = [...tabs.keys()].at(-1);
      render();
    },
    close() {
      if (host.hidden) return;
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
  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      api.close();
    }
  });
  return api;
}
