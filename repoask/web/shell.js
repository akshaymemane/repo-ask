// App shell: rail navigation state, recent list, page header and workspace pill.

export function createShell({ document }) {
  const byId = (id) => document.getElementById(id);
  const make = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };

  return {
    page: byId("page"),
    setRoute(route) {
      for (const link of byId("rail-nav").querySelectorAll("a")) {
        if (link.dataset.route === route) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    },
    setRecent(items, { heading }) {
      byId("recent-heading").textContent = heading;
      const list = byId("recent-list");
      list.replaceChildren();
      for (const item of items) {
        const link = make("a", undefined, "recent-item");
        link.setAttribute("href", item.href);
        if (location.hash === item.href) link.setAttribute("aria-current", "page");
        const title = make("span", item.title, "recent-title");
        if (item.attention) title.append(make("span", " ●", "attention"));
        link.append(title);
        if (item.meta) link.append(make("small", item.meta, "recent-meta"));
        const li = make("li");
        li.append(link);
        list.append(li);
      }
      byId("recent").hidden = items.length === 0;
    },
    setHeader({ title, pills = [] }) {
      byId("page-header-title").textContent = title;
      byId("page-header-pills").replaceChildren(...pills.map((pill) => make("span", pill.text, `pill${pill.tone ? ` pill-${pill.tone}` : ""}`)));
    },
    setWorkspaceMode(mode) {
      // A connected GitHub catalog is the normal state; only label the exceptions.
      byId("workspace-mode").hidden = mode === "connected";
    },
  };
}
