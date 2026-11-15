// Settings page: section navigation, GitHub setup through the App Manifest flow, privacy.
import { button, el, toggleSwitch } from "./ui.js";

const SECTIONS = [["github", "GitHub"], ["models", "Models"], ["agent", "Coding agent"], ["privacy", "Privacy"], ["health", "System health"]];
const STORAGE_NEEDED = "GitHub setup needs saved storage and an unlocked secure key store. Start OpenDevin with --data-dir and unlock your keychain.";
const STATUS = { manifest_key_not_saved: "The App was created on GitHub but its key wasn't saved. Delete it in GitHub → Settings → Developer settings → GitHub Apps, fix storage, then try again.", connected: "GitHub connected.", manifest_created: "App created. Now install it on your repositories.", pending_approval: "Installation is waiting for an organization owner's approval." };

export function githubStatusText(code) {
  if (!code) return null;
  return STATUS[code] ?? `GitHub setup failed: ${String(code).replaceAll("_", " ")}. Try again.`;
}

function defaultSubmit(form) {
  document.body.append(form);
  form.submit();
}

// Opens GitHub's install page for a created App; only github.com/apps/... destinations are followed.
export { STORAGE_NEEDED };

export async function startInstall(request, connectionId, navigate) {
  const result = await request("/api/github/connect", "POST", { connection_id: connectionId });
  let target;
  try { target = new URL(result.install_url); } catch { throw new Error("Invalid installation destination."); }
  if (target.origin !== "https://github.com" || target.username || target.password || !target.pathname.startsWith("/apps/")) throw new Error("Invalid installation destination.");
  navigate(target.href);
}

// Starts GitHub App creation: the browser posts the manifest to GitHub, which returns to our callback.
export async function startManifest(request, { organization = "" } = {}, submitForm = defaultSubmit) {
  const body = organization ? { organization } : {};
  const start = await request("/api/github/manifest/start", "POST", body);
  const form = el("form");
  form.setAttribute("method", "post");
  form.setAttribute("action", `${start.action}?state=${encodeURIComponent(start.state)}`);
  form.hidden = true;
  const field = el("input");
  field.type = "hidden";
  field.setAttribute("name", "manifest");
  field.value = JSON.stringify(start.manifest);
  form.append(field);
  submitForm(form);
  return start;
}

export function createSettingsPage({ host, request, sections, submitForm = defaultSubmit, navigate = (href) => location.assign(href) }) {
  const root = el("div", undefined, "settings-layout");
  const nav = el("nav", undefined, "settings-nav");
  nav.setAttribute("aria-label", "Settings sections");
  for (const [id, label] of SECTIONS) {
    const link = el("a", label);
    link.setAttribute("href", `#/settings/${id}`);
    link.dataset.section = id;
    nav.append(link);
  }
  const body = el("div", undefined, "settings-body");
  const status = el("p", "", "settings-status");
  status.setAttribute("role", "status");
  root.append(nav, body);
  host.replaceChildren(status, root);

  function githubSetup() {
    const box = el("section", undefined, "setting-card");
    box.append(el("h2", "GitHub"), el("p", "Checking connection…", "detail-muted"));
    request("/api/github/connections").then((data) => {
      const connections = data.connections || [];
      const connected = connections.some((item) => item.status === "connected");
      box.replaceChildren(el("h2", "GitHub"));
      if (connected) return;
      if (data.can_configure === false) { box.append(el("p", STORAGE_NEEDED, "detail-muted")); return; }
      const created = connections.find((item) => item.status !== "disconnected");
      if (created) {
        // The App exists; installing it is the only step left. Never offer to create a second App.
        box.append(el("p", `${created.slug ?? "Your GitHub App"} is created. Install it on the repositories OpenDevin should see.`));
        const output = el("p", "", "detail-muted");
        const installButton = button(box, "Install on your repositories", async () => {
          installButton.disabled = true;
          output.textContent = "";
          try { await startInstall(request, created.id, navigate); } catch (error) { output.textContent = error.message; } finally { installButton.disabled = false; }
        }, { variant: "primary" });
        box.append(output);
        return;
      }
      box.append(el("p", "Connect GitHub to search your repositories. OpenDevin creates a private, read-only GitHub App for you; you review it on GitHub before anything is created."));
      const org = el("input");
      org.setAttribute("aria-label", "Organization name");
      org.placeholder = "organization name";
      org.hidden = true;
      const orgToggle = button(null, "Create under an organization", () => { org.hidden = false; orgToggle.hidden = true; org.focus(); }, { variant: "ghost" });
      const output = el("p", "", "detail-muted");
      const connect = button(null, "Connect GitHub", async () => {
        connect.disabled = true;
        output.textContent = "Opening GitHub…";
        try {
          await startManifest(request, { organization: org.hidden ? "" : org.value.trim() }, submitForm);
        } catch (error) {
          output.textContent = `Could not start GitHub setup: ${error.message}`;
        } finally {
          connect.disabled = false;
        }
      }, { variant: "primary" });
      box.append(connect, orgToggle, org, output);
    }, (error) => box.replaceChildren(el("h2", "GitHub"), el("p", `GitHub status unavailable: ${error.message}`)));
    return box;
  }

  function privacy() {
    const box = el("section", undefined, "setting-card");
    box.append(el("h2", "Privacy"));
    request("/api/settings/model-roles").then((data) => {
      const row = el("div", undefined, "setting-row");
      const label = el("div");
      label.append(el("strong", "Keep everything on this computer"), el("p", "Blocks remote model destinations for answers, plans and search.", "detail-muted"));
      const control = toggleSwitch({ label: "Local-only inference and embeddings", checked: data.settings?.local_only === true,
        onChange: (next) => request("/api/settings/model-roles", "PATCH", { local_only: next }) });
      row.append(label, control.root);
      const more = el("details");
      more.append(el("summary", "Learn more"), el("p", "Turning this off does not share repository source by itself. Each remote model profile needs its own source-sharing opt-in, and model profiles can never run repository tools or publish pull requests."));
      box.append(row, more);
    }, (error) => box.append(el("p", `Privacy settings unavailable: ${error.message}`)));
    return box;
  }

  const builders = {
    github: () => {
      const wrap = el("div");
      wrap.append(githubSetup());
      if (sections.github) {
        const existing = el("details", undefined, "existing-app");
        existing.append(el("summary", "Use an existing GitHub App"), sections.github);
        request("/api/github/connections").then((data) => { if ((data.connections || []).length) existing.setAttribute("open", ""); }, () => { existing.setAttribute("open", ""); });
        wrap.append(existing);
      }
      return wrap;
    },
    models: () => sections.models ?? el("p", "Model settings aren't available in this build."),
    agent: () => sections.agent ?? el("p", "The coding agent isn't available in this build.", "detail-muted"),
    privacy,
    health: () => sections.health ?? el("p", "Health status is unavailable."),
  };

  return {
    element: root,
    mount() { if (root.parentNode !== host) host.replaceChildren(status, root); },
    setAgent(element) { sections.agent = element; },
    async show(section = "github", { code = "" } = {}) {
      const id = builders[section] ? section : "github";
      for (const link of nav.querySelectorAll("a")) {
        if (link.dataset.section === id) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
      body.replaceChildren(builders[id]());
      status.textContent = githubStatusText(code) ?? "";
    },
  };
}
