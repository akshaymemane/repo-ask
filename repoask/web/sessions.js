// Durable session views consume safe public projections. Source is always text.
import { badge, relativeTime } from './ui.js';
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = String(text); if (cls) n.className = cls; return n; };
const enc = encodeURIComponent;
const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted', 'blocked']);
const inside = (root, child) => { for (let n = child; n; n = n.parentNode) if (n === root) return true; return false; };
const time = value => value ? new Date(value).toLocaleString() : 'unknown';
const human = value => String(value ?? 'unknown').replaceAll('_', ' ');
const scalar = value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : 'unknown';
const storage = {
  get(key) { try { return JSON.parse(window.sessionStorage?.getItem(key) || 'null'); } catch { return null; } },
  set(key, value) { try { if (value === null) window.sessionStorage?.removeItem(key); else window.sessionStorage?.setItem(key, JSON.stringify(value)); } catch {} },
};
export async function executionRequest(path, method = 'GET', body) {
  let response;
  try { response = await fetch(path, {method, cache: 'no-store', headers: {'Content-Type': 'application/json'}, ...(body === undefined ? {} : {body: JSON.stringify(body)})}); }
  catch { throw new Error(method === 'GET' ? 'Connection unavailable. Reconnect to reload saved state.' : 'Connection lost; outcome unknown. Retry the same request to reconcile saved state.'); }
  let value;
  try { value = await response.json(); } catch { throw new Error('Response unavailable; outcome unknown. Reload saved state or retry the same request.'); }
  if (!response.ok) { const code = /^[a-z_]{1,80}$/.test(value?.code) ? value.code : `http_${response.status}`; const e = new Error(human(code)); e.status = response.status; e.code = code; throw e; }
  return value;
}
function link(parent, text, hash) { const a = el('a', text); a.setAttribute('href', hash); a.dataset.focus = hash; parent.append(a); return a; }
function button(parent, text, fn) {
  const b = el('button', text, 'button'); b.type = 'button';
  b.addEventListener('click', () => { if (!b.disabled && b.isConnected) fn(b); }); parent.append(b); return b;
}
// One phase label per session, shared by the rail list and the session header.
export function phaseBadge(s, checks = null) {
  if (['open', 'pr_open', 'published'].includes(s.publication?.state)) return {label: 'PR open', tone: 'ok'};
  if (s.state === 'waiting_for_user') return {label: 'needs your input', tone: 'warn'};
  if (s.state === 'completed') return checks?.items?.some(c => c.status === 'failed') ? {label: 'completed · checks failing', tone: 'warn'} : {label: 'completed', tone: 'ok'};
  if (s.state === 'cancelled') return {label: 'cancelled', tone: 'off'};
  if (s.state === 'stopping' || s.stop_requested) return {label: 'stopping', tone: 'warn'};
  if (terminal.has(s.state)) return {label: human(s.state === 'interrupted' || s.state === 'blocked' ? s.state : 'failed'), tone: 'danger'};
  return {label: 'running', tone: 'info'};
}
const elapsedSeconds = s => { const start = s.started_at || s.created_at; return start ? Math.max(0, Math.floor(((s.finished_at || Date.now()) - start) / 1000)) : null; };
function region(parent, title) { const s = el('section', undefined, 'session-section'); s.append(el('h2', title)); parent.append(s); return s; }
function lines(parent, entries) { const dl = el('dl', undefined, 'session-facts'); for (const [label, value] of entries) dl.append(el('dt', label), el('dd', value)); parent.replaceChildren(dl); }
export function limitsText(limits = {}) {
  const runner = limits.runner || limits.runner_limits || {}, agent = limits.agent || limits.agent_limits || {};
  const parts = [];
  for (const [key, label, unit] of [['memory_mib', 'Memory', 'MiB'], ['workspace_mib', 'Workspace', 'MiB'], ['tmp_mib', 'Temporary disk', 'MiB'], ['cpus', 'CPU', 'cores'], ['pids', 'Processes', ''], ['wall_seconds', 'Runner deadline', 's'], ['max_files', 'Files', ''], ['max_file_bytes', 'File size', 'bytes'], ['max_output_bytes', 'Command output', 'bytes']]) if (runner[key] !== undefined) parts.push(`${label} ${runner[key]} ${unit}`.trim());
  for (const [key, label, unit] of [['wall_seconds', 'Agent deadline', 's'], ['max_turns', 'Turns', ''], ['max_budget_usd', 'Spending cap', 'USD'], ['max_output_bytes', 'Agent output', 'bytes']]) if (agent[key] !== undefined) parts.push(`${label} ${agent[key]} ${unit}`.trim());
  return parts.join(' · ') || 'Limits unavailable';
}
function eventText(event, sourceAllowed) {
  const p = event.payload || {};
  if (p.redacted || !sourceAllowed) return `${human(event.type)} · details redacted by current source policy`;
  // Only mapped summaries are displayed; arbitrary payloads/private reasoning never render.
  switch (event.type) {
    case 'session.state': return `State ${human(p.state)} · Phase ${human(p.phase)}${p.reason ? ` · ${human(p.reason)}` : ''}`;
    case 'agent.summary': return [p.kind === 'ready' ? `Agent ready · Model ${p.model || 'unknown'}` : human(p.kind), p.text, p.status, p.code].filter(Boolean).join(' · ');
    case 'tool.started': case 'tool.finished': case 'tool.denied': return [human(event.type), p.tool, p.path, p.ok === undefined ? null : p.ok ? 'succeeded' : 'failed', p.code, p.reason].filter(Boolean).map(scalar).join(' · ');
    case 'question.asked': return `Question · ${p.prompt || human(p.state)}`;
    case 'message.delivery': return `Message ${p.message_id || ''} · ${human(p.delivery)}${p.reason ? ` · ${human(p.reason)}` : ''}`;
    case 'checkpoint': return p.ok ? `Checkpoint saved · ${p.added ?? 0} added · ${p.modified ?? 0} modified · ${p.deleted ?? 0} deleted` : `Checkpoint unavailable · ${human(p.code || p.reason)}`;
    case 'validation.started': case 'validation.finished': return `${human(event.type)} · Check ${p.ordinal ?? ''} · ${human(p.status)}${p.exit_code !== undefined ? ` · Exit ${p.exit_code}` : ''}`;
    case 'stop.requested': return `Stop requested · ${human(p.reason)}`;
    case 'containment': return `Containment ${p.confirmed === true ? 'confirmed' : 'unconfirmed'} · ${human(p.code)}`;
    case 'usage': return 'Usage updated (reported totals shown above)';
    case 'error': return `Error · ${human(p.code || p.error_code)}`;
    case 'publication.state': return `Publication · ${human(p.state)}`;
    default: return human(event.type);
  }
}

export function createSessionPanel({host, request = executionRequest, onAvailable = () => {}, pollMs = 2000, shell = null}) {
  let listControls = [];
  const panel = el('div', undefined, 'sessions-panel'); host.append(panel);
  let epoch = 0, timer, active = false, currentID = null, refreshBusy = false, current, cursor = 0, sourceAllowed = true, messageCursor = null;
  const events = new Map(), history = new Map(); let messageSending = false, targetEdited = false, pendingMessage, retryKey, listCursor, listItems = new Map(), listFilters;
  let diffSignature, checksSignature, lastChecks = null, lastConfirmed = null, plan = null;
  let status, summary, origin, phase, activity, patches, checks, progress, publication, messageRows, questionArea, compose, send, responseTo, stop, retry, moreEvents, moreMessages;
  function publishRecent(items) {
    shell?.setRecent(items.map(s => { const b = phaseBadge(s), seconds = elapsedSeconds(s);
      return {href: `#/sessions/${enc(s.id)}`, title: `${(s.repositories || []).map(r => r.repository_id).join(', ') || s.id} · attempt ${s.attempt ?? '?'}`, meta: `${b.label}${seconds === null ? '' : ` · ${seconds} s`}`, attention: s.state === 'waiting_for_user'}; }), {heading: 'Recent sessions'});
  }
  const say = text => { if (status && status.textContent !== text) status.textContent = text; };
  const live = token => active && epoch === token && /^#\/sessions(?:\/[^/]+)?$/.test(location.hash);
  const schedule = token => { clearTimeout(timer); if (live(token)) { timer = setTimeout(() => refresh(token), pollMs); timer?.unref?.(); } };
  function focusReplacement(root, render) {
    const focused = document.activeElement, key = inside(root, focused) ? focused?.dataset?.focus : null;
    render();
    if (key && (document.activeElement === document.body || !document.activeElement?.isConnected)) {
      const target = [...root.querySelectorAll('[data-focus]')].find(n => n.dataset.focus === key);
      if (target) target.focus(); else { const heading = root.querySelector('h2'); heading?.setAttribute('tabindex', '-1'); heading?.focus(); }
    }
  }
  function clearSource(revoke = true) {
    events.clear(); history.clear(); cursor = 0; messageCursor = null; diffSignature = null; checksSignature = null;
    if (revoke) { pendingMessage = null; storage.set(`session-message-${currentID}`, null); }
    activity.replaceChildren(el('p', 'Activity details cleared under current source policy.'));
    messageRows.replaceChildren(el('p', 'Message content redacted.'));
    patches.replaceChildren(el('h2', 'Diff'), el('p', 'Source unavailable under current repository access or retention policy.'));
    checks.replaceChildren(el('h2', 'Validation checks'), el('p', 'Source-bearing check output cleared.'));
    progress.replaceChildren(el('h2', 'Progress'), el('p', 'Plan steps unavailable or redacted under current source policy.'));
    questionArea.replaceChildren(); if (revoke) { compose.value = ''; responseTo.value = ''; } send.disabled = true; compose.disabled = true; responseTo.disabled = true;
  }
  function renderSummary() {
    const s = current, x = s.execution || {}, u = s.usage || {}, outcome = s.outcome || {};
    const started = s.started_at || s.created_at; const end = s.finished_at || Date.now();
    const elapsed = started ? `${Math.max(0, Math.floor((end - started) / 1000))} seconds${s.finished_at ? '' : ' elapsed'}` : 'unknown';
    focusReplacement(summary, () => {
      summary.replaceChildren(el('h2', `${human(s.state)} · ${human(s.phase)}`));
      const details = el('details', undefined, 'session-run-details'); details.append(el('summary', 'Run details'));
      const facts = el('div'); details.append(facts); summary.append(details);
      const reportedTokens = u.tokens || u;
      const tokens = ['input_tokens', 'output_tokens', 'total_tokens'].filter(k => Number.isFinite(reportedTokens[k])).map(k => `${human(k)} ${reportedTokens[k]}`).join(' · ') || 'unknown';
      const cost = Number.isFinite(u.reported_cost_usd) ? `${u.reported_cost_usd} USD (reported)` : Number.isFinite(u.estimated_cost) ? `${u.estimated_cost} USD (${u.cost_status || 'estimated'})` : 'unknown';
      lines(facts, [['Attempt', `${s.attempt ?? 'unknown'} · ${s.id}`], ['Plan version', `${s.plan_version_id} · SHA256 ${s.content_hash}`], ['Elapsed time', elapsed], ['Execution profile', `${x.profile_id || 'unknown'} · Version ${x.version ?? 'unknown'} (${x.profile_version_id || 'unknown'})`], ['Agent', `${x.adapter || 'unknown'} · CLI ${x.cli_version || 'unknown'} · Model ${u.observed_model || u.model || [...events.values()].find(e => e.type === 'agent.summary' && e.payload?.kind === 'ready')?.payload.model || outcome.model || 'unknown'}`], ['Destination', x.destination ? `${x.destination.kind || 'unknown'} · ${x.destination.host || x.destination.disclosure || 'destination details unknown'}` : 'unknown'], ['Pinned image', x.image_id || 'unknown'], ['Resource limits', limitsText(s.limits)], ['Usage', tokens], ['Cost', cost], ['Containment', human(s.runner?.containment)], ['Outcome', human(outcome.result || outcome.status || outcome.code || outcome.reason || s.error_code || 'not yet recorded')], ['Stop reason', human(s.stop_reason || 'none')]]);
      for (const r of s.repositories || []) details.append(el('p', `${r.repository_id} · ${r.role} · Base ${r.base_sha || 'unknown'} (${r.base_branch || 'unknown branch'}) · Session branch ${r.session_branch || 'not assigned'}`));
      link(summary, 'Saved plan version', `#/plans/${enc(s.plan_id)}/${enc(s.plan_version_id)}`);
      if (s.predecessor_id) link(summary, 'Previous attempt', `#/sessions/${enc(s.predecessor_id)}`);
      if (s.successor_id) link(summary, 'Successor attempt', `#/sessions/${enc(s.successor_id)}`);
      details.append(el('p', `Capabilities: user questions ${s.capabilities?.ask_user ? 'available' : 'unavailable'} · Follow-ups ${s.capabilities?.follow_up ? 'available' : 'no proven delivery channel; messages may remain queued'} · Resume ${s.capabilities?.resume ? 'available' : 'unavailable'}`));
      details.append(el('p', `External source sharing at launch: ${x.allow_external_source === true ? 'explicitly permitted by the pinned profile; live workspace and repository policy still apply' : x.allow_external_source === false ? 'disabled' : 'unknown'}.`));
    });
    const b = phaseBadge(s, lastChecks);
    phase.replaceChildren(badge(b.tone, b.label));
    renderOrigin(); renderProgress(); renderPublication();
    shell?.setHeader({title: plan?.title || 'Session', pills: [{text: b.label}]});
    // Stop stays beside the composer while work may still be running, including after a failed containment.
    stop.hidden = stop.disabled = terminal.has(s.state) && s.runner?.containment !== 'failed';
    stop.textContent = s.state === 'stopping' || s.stop_requested ? 'Request stop again' : 'Stop session';
    retry.disabled = !terminal.has(s.state) || Boolean(s.successor_id);
    if (s.state === 'stopping' || s.stop_requested) say(`Stop requested. Containment ${human(s.runner?.containment)}; work is not confirmed stopped until the server verifies termination.`);
  }
  function renderOrigin() {
    const version = plan?.version?.version;
    origin.replaceChildren();
    link(origin, `From plan ${version ? `v${version}` : 'version'}${plan?.title ? ` · ${plan.title}` : ''}`, `#/plans/${enc(current.plan_id)}/${enc(current.plan_version_id)}`);
    if (plan?.conversation_id) { origin.append(' · '); link(origin, 'back to conversation', `#/ask/${enc(plan.conversation_id)}`); }
  }
  function renderProgress() {
    const steps = sourceAllowed ? plan?.version?.content?.steps : null;
    progress.replaceChildren(el('h2', 'Progress'));
    if (current) progress.append(el('p', `Phase: ${phaseBadge(current, lastChecks).label} · ${human(current.phase)}`));
    if (!Array.isArray(steps)) { progress.append(el('p', plan === null || plan.loading ? 'Loading the saved plan…' : 'Plan steps unavailable or redacted under current source policy.')); return; }
    const list = el('ol', undefined, 'session-steps');
    for (const step of steps) list.append(el('li', step.title || 'Untitled step'));
    progress.append(list, el('p', 'The agent does not report per-step completion. Follow the activity and checks for confirmed progress.', 'detail-muted'));
  }
  function renderPublication() {
    const policy = current?.publication?.policy || 'unavailable';
    publication.replaceChildren(el('h2', 'Pull request'), el('p', "Publishing isn't available yet."), el('p', `Saved publication policy: ${human(policy)}.`),
      el('p', policy === 'on_success_draft' ? 'The saved launch policy authorizes a remote branch and draft PR only after server success and publication checks.' : 'An explicit publication action is required after review.'));
  }
  function renderEvents() {
    activity.replaceChildren(el('h2', 'Activity timeline'));
    const list = el('ol'); let group = null;
    // Consecutive tool steps collapse into one "Worked for …" group; everything else stays a single line.
    const close = () => {
      if (!group) return;
      const {items, first, last, paths} = group, seconds = Math.max(0, Math.round(((last.created_at || 0) - (first.created_at || 0)) / 1000));
      const details = el('details', undefined, 'activity-group'), title = el('summary', `Worked for ${seconds} s · ${items.length} ${items.length === 1 ? 'step' : 'steps'}${sourceAllowed && paths.size ? ` in ${paths.size} ${paths.size === 1 ? 'file' : 'files'}` : ''}`);
      title.dataset.focus = `group-${first.seq}`; const inner = el('ol'); inner.append(...items); details.append(title, inner);
      const li = el('li'); li.append(details); list.append(li); group = null;
    };
    for (const e of [...events.values()].sort((a,b) => a.seq - b.seq)) {
      const item = el('li', `#${e.seq} · ${time(e.created_at)} · ${eventText(e, sourceAllowed)}`); item.dataset.seq = e.seq;
      if (!e.type?.startsWith('tool.')) { close(); list.append(item); continue; }
      group ||= {items: [], first: e, last: e, paths: new Set()};
      group.items.push(item); group.last = e; if (typeof e.payload?.path === 'string') group.paths.add(e.payload.path);
    }
    close(); activity.append(list); if (!events.size) activity.append(el('p', 'No saved activity yet.'));
  }
  function renderMessages() {
    messageRows.replaceChildren(el('h2', 'Messages and delivery'));
    for (const m of [...history.values()].sort((a,b) => a.created_at - b.created_at || a.id.localeCompare(b.id))) {
      const item = el('section', undefined, 'session-message');
      item.append(el('h3', `${m.question_id ? 'Question reply' : 'Clarification'} · ${human(m.delivery)}`), el('p', sourceAllowed && typeof m.content === 'string' ? m.content : 'Content redacted'), el('p', `${time(m.created_at)}${m.reason ? ` · ${human(m.reason)}` : ''}`)); messageRows.append(item);
    }
    if (!history.size) messageRows.append(el('p', 'No saved messages. Queued, delivered and acknowledged are distinct server states.'));
    if (pendingMessage) messageRows.append(el('p', 'A send outcome is unknown. Retry the same content and target to reconcile; the client request key is preserved.'));
  }
  function renderQuestion() {
    const q = current.pending_question;
    const selected = responseTo.value;
    responseTo.replaceChildren();
    const general = el('option', current.capabilities?.follow_up ? 'General clarification (inspect saved delivery and acknowledgement)' : 'General clarification (delivery may be unsupported)'); general.value = ''; responseTo.append(general);
    const asking = q && sourceAllowed && !q.redacted;
    if (asking) {
      const option = el('option', 'Reply to the current agent question'); option.value = q.id; responseTo.append(option);
      if (selected === q.id || (!targetEdited && !compose.value.trim())) responseTo.value = q.id;
      else responseTo.value = selected;
    } else responseTo.value = '';
    if (pendingMessage) {
      if (pendingMessage.question_id && ![...responseTo.querySelectorAll('option')].some(o => o.value === pendingMessage.question_id)) { const option = el('option', 'Reconcile reply to the original question'); option.value = pendingMessage.question_id; responseTo.append(option); }
      responseTo.value = pendingMessage.question_id || '';
    }
    const ended = !pendingMessage && (terminal.has(current.state) || current.stop_requested);
    compose.disabled = messageSending || !sourceAllowed; compose.readOnly = Boolean(ended);
    responseTo.disabled = compose.disabled || Boolean(pendingMessage);
    send.disabled = compose.disabled || Boolean(ended);
    focusReplacement(questionArea, () => {
      questionArea.replaceChildren();
      if (!asking) return;
      const card = el('section', undefined, 'question-card'); questionArea.append(card);
      card.append(el('h2', 'The agent is asking'), el('p', q.prompt || 'Question text unavailable'));
      const choices = el('div', undefined, 'question-choices'); card.append(choices);
      // The session contract does not define offered choices yet; render them only when the server sends them.
      for (const choice of Array.isArray(q.options) ? q.options.filter(o => typeof o === 'string' && o.trim()) : []) {
        const b = button(choices, choice, b => sendMessage(b, choice, q.id, false)); b.dataset.focus = `choice-${choice}`;
        b.disabled = send.disabled || Boolean(pendingMessage);
      }
      const reply = button(choices, 'Reply…', () => { if (compose.disabled) return; responseTo.value = q.id; targetEdited = true; compose.focus(); }); reply.dataset.focus = 'reply';
      reply.disabled = send.disabled;
    });
  }
  function sendMessage(b, content, question_id, fromComposer) {
    return mutate(b, async t => {
      if (!content) throw new Error('Enter a message.');
      if (pendingMessage && (pendingMessage.content !== content || (pendingMessage.question_id || null) !== question_id)) throw new Error('Retry the unchanged pending message and target to reconcile its unknown outcome.');
      pendingMessage ||= {content, question_id, client_request_id:globalThis.crypto.randomUUID()}; storage.set(`session-message-${currentID}`, pendingMessage);
      if (!fromComposer) compose.value = content;
      const submittedAttempt = pendingMessage, openedID = currentID; messageSending = true; renderQuestion();
      try { const result = await request(`/api/sessions/${enc(currentID)}/messages`, 'POST', submittedAttempt); if (!live(t)) return; if (!result.id || !result.delivery) throw new Error('Message outcome unknown; retry the same request.'); history.set(result.id,{...result,content:sourceAllowed ? submittedAttempt.content : null}); pendingMessage = null; storage.set(`session-message-${currentID}`, null); compose.value = ''; targetEdited = false; renderMessages(); say(`Message ${human(result.delivery)}${result.reason ? ` · ${human(result.reason)}` : ''}.`); }
      catch(e) { if (live(t) && e.status >= 400 && e.status < 500) { pendingMessage = null; storage.set(`session-message-${openedID}`, null); } throw e; }
      finally { if (live(t)) { messageSending = false; renderQuestion(); } }
    });
  }
  function renderDiff(data) {
    const signature = JSON.stringify([sourceAllowed, data]); if (signature === diffSignature) return; diffSignature = signature;
    const expanded = new Set([...patches.querySelectorAll('details')].filter(n => n.open).map(n => n.querySelector('summary')?.dataset.focus));
    focusReplacement(patches, () => {
      patches.replaceChildren(el('h2', 'Diff'));
      if (!sourceAllowed || !data.available) { patches.append(el('p', `Diff unavailable: ${human(!sourceAllowed ? 'source_unavailable' : data.reason || 'not_captured')}.`)); return; }
      const files = data.files || [], known = files.every(f => Number.isFinite(f.additions) && Number.isFinite(f.deletions));
      if (files.length && known) patches.append(el('p', `+${files.reduce((n, f) => n + f.additions, 0)} −${files.reduce((n, f) => n + f.deletions, 0)} in ${files.length} ${files.length === 1 ? 'file' : 'files'}`, 'diff-totals'));
      patches.append(el('p', `Base ${data.base_sha || 'unknown'} · Checkpoint ${time(data.captured_at)} · Hash ${data.diff_hash || 'unknown'} · ${data.files?.length || 0} visible files`));
      if (data.edits_since_last_checkpoint_may_be_lost) patches.append(el('p', 'Edits since the last verified checkpoint may be lost.', 'session-warning'));
      if (data.hidden_by_current_exclusions) patches.append(el('p', `${data.hidden_by_current_exclusions} files hidden by current exclusions.`));
      if (data.rejected?.length) patches.append(el('p', `${data.rejected.length} paths rejected by artifact policy.`));
      if (!data.files?.length) patches.append(el('p', 'The available checkpoint contains no visible file changes.'));
      for (const file of data.files || []) { const details = el('details'); const title = el('summary', `${human(file.status)} · ${file.path}`); title.dataset.focus = file.path; if (expanded.has(file.path)) details.setAttribute('open', ''); details.append(title, el('p', `Mode ${file.mode || file.new_mode || 'unknown'} · Size ${file.bytes ?? file.size ?? 'unknown'} bytes · +${file.additions ?? '?'} / −${file.deletions ?? '?'}`), el('pre', file.binary ? 'Binary change; text diff unavailable' : file.diff || 'Text diff unavailable')); patches.append(details); }
    });
  }
  function renderChecks(data) {
    const signature = JSON.stringify([sourceAllowed, data]); if (signature === checksSignature) return; checksSignature = signature;
    focusReplacement(checks, () => {
      checks.replaceChildren(el('h2', 'Validation checks'), el('p', data.fully_validated === true ? 'All recorded checks passed.' : 'Not fully validated. Review failed, unavailable and not-run checks.'));
      if (!data.items?.length) checks.append(el('p', 'No validation runs recorded.'));
      for (const c of data.items || []) {
        const box = el('section', undefined, 'setting-box');
        const command = sourceAllowed ? Array.isArray(c.command) ? c.command.join(' ') : c.command?.argv?.join(' ') || c.command?.command || c.command?.shell || 'Command unavailable' : 'Command redacted';
        box.append(el('h3', `Check ${c.ordinal} · ${human(c.status)}`), el('pre', command), el('p', `${c.required ? 'Required' : 'Optional'} · Source ${human(c.source)} · Exit ${c.exit_code ?? 'not recorded'} · ${time(c.started_at)} → ${time(c.finished_at)}`));
        const env = c.environment || {}; box.append(el('p', `Environment: image ${env.image_id || env.image || 'unknown'} · Network ${env.network || 'unknown'} · Working directory ${env.cwd || env.working_directory || 'unknown'}`));
        box.append(el('pre', !sourceAllowed || c.output_redacted ? 'Output redacted' : c.output ?? 'Output unavailable')); checks.append(box);
      }
    });
  }
  async function loadEvents(token) {
    const page = await request(`/api/sessions/${enc(currentID)}/events?after=${cursor}&limit=200`);
    if (!live(token)) return;
    if (!Array.isArray(page.items) || !Number.isSafeInteger(page.next_seq) || page.next_seq < cursor) throw new Error('Unsupported event replay response.');
    if (page.source_available === false) { if (sourceAllowed) clearSource(); sourceAllowed = false; }
    for (const e of page.items) if (e.session_id === currentID && Number.isSafeInteger(e.seq) && e.seq > 0) events.set(e.seq, e);
    cursor = page.next_seq; renderEvents(); moreEvents.hidden = !page.has_more;
  }
  async function loadMessages(token, append = false) {
    const page = await request(`/api/sessions/${enc(currentID)}/messages?limit=50${append && messageCursor ? `&cursor=${enc(messageCursor)}` : ''}`);
    if (!live(token)) return;
    if (!Array.isArray(page.items)) throw new Error('Unsupported message history response.');
    if (page.source_available === false) { if (sourceAllowed) clearSource(); sourceAllowed = false; }
    for (const m of page.items) history.set(m.id, m);
    if (append || messageCursor === null) messageCursor = page.next_cursor;
    moreMessages.hidden = !messageCursor;
    if (pendingMessage && page.items.some(m => m.client_request_id === pendingMessage.client_request_id)) { pendingMessage = null; storage.set(`session-message-${currentID}`, null); compose.value = ''; }
    renderMessages();
  }
  async function refresh(token = epoch) {
    if (!live(token) || refreshBusy || !currentID) return;
    refreshBusy = true;
    try {
      const data = await request(`/api/sessions/${enc(currentID)}`);
      if (!live(token)) return;
      if (data.id !== currentID || typeof data.state !== 'string') throw new Error('Unsupported session response.');
      onAvailable(); current = data; lastConfirmed = Date.now();
      if (plan === null) { plan = {loading: true}; request(`/api/plans/${enc(data.plan_id)}?version_id=${enc(data.plan_version_id)}`).then(p => { if (!live(token)) return; plan = p?.id === data.plan_id && p.version?.id === data.plan_version_id ? p : {}; renderSummary(); }, () => { if (live(token)) { plan = {}; renderProgress(); } }); }
      if (data.source_available === false) { if (sourceAllowed) clearSource(); sourceAllowed = false; }
      else if (!sourceAllowed) { sourceAllowed = true; events.clear(); history.clear(); cursor = 0; messageCursor = null; }
      renderSummary(); renderQuestion();
      const results = await Promise.allSettled([loadEvents(token), loadMessages(token), request(`/api/sessions/${enc(currentID)}/diff`), request(`/api/sessions/${enc(currentID)}/validations`)]);
      if (!live(token)) return;
      if (results.some(r => r.status === 'fulfilled' && r.value?.source_available === false)) { if (sourceAllowed) clearSource(); sourceAllowed = false; renderQuestion(); }
      if (results[2].status === 'fulfilled') renderDiff(results[2].value); else renderDiff({available:false,reason:results[2].reason.code || 'request_failed'});
      if (results[3].status === 'fulfilled') { lastChecks = results[3].value; renderChecks(results[3].value); renderSummary(); } else checks.replaceChildren(el('h2', 'Validation checks'), el('p', `Checks unavailable: ${results[3].reason.message}`));
      const failure = results.find(r => r.status === 'rejected');
      if (failure) say(`Some saved state is unavailable: ${failure.reason.message}. Reconnect retries from event #${cursor}.`);
      else if (!current.stop_requested) say(sourceAllowed ? `Connected · Saved activity through #${cursor}. Browser disconnects do not stop background work.` : 'Source unavailable. Previously displayed source has been cleared.');
    } catch (e) {
      if (!live(token)) return;
      // Source cannot be shown without a live policy check; the last confirmed state and phase stay visible.
      clearSource(false); renderProgress();
      say(e.status === undefined && lastConfirmed ? `Reconnecting… Last update ${relativeTime(lastConfirmed)}. Source details stay hidden until the connection is confirmed.` : `Session unavailable: ${e.message}. Reconnect to inspect current saved state.`);
    }
    finally { if (epoch === token) { refreshBusy = false; schedule(token); } }
  }
  async function mutate(b, fn) {
    if (!live(epoch)) return;
    const token = epoch, focused = document.activeElement === b;
    b.disabled = true;
    try { await fn(token); } catch (e) { if (live(token)) say(e.message); }
    finally { if (live(token)) { b.disabled = b === stop ? Boolean(current && terminal.has(current.state) && current.runner?.containment !== 'failed') : b === retry ? Boolean(current && (!terminal.has(current.state) || current.successor_id)) : b === send ? Boolean(!sourceAllowed || messageSending || (current && !pendingMessage && (terminal.has(current.state) || current.stop_requested))) : false; if (focused && (document.activeElement === document.body || !document.activeElement?.isConnected)) b.focus(); } }
  }
  function renderList() {
    activity.replaceChildren();
    const query = (listFilters?.query.value || '').trim().toLowerCase(), state = listFilters?.state.value || '', repo = (listFilters?.repository.value || '').trim().toLowerCase(), date = listFilters?.date.value ? new Date(listFilters.date.value).getTime() : null;
    let visible = 0;
    for (const s of listItems.values()) {
      const repos = (s.repositories || []).map(r => r.repository_id).join(' ');
      if ((query && !`${s.id} ${s.plan_version_id} ${s.phase} ${repos}`.toLowerCase().includes(query)) || (repo && !repos.toLowerCase().includes(repo)) || (state === 'active' && terminal.has(s.state)) || (state === 'terminal' && !terminal.has(s.state)) || (date !== null && s.created_at < date)) continue;
      ++visible;
      const row = el('article', undefined, 'setting-box');
      link(row, `${human(s.state)} · Attempt ${s.attempt ?? '?'} · ${s.id}`, `#/sessions/${enc(s.id)}`);
      const duration = s.created_at ? `${Math.max(0,Math.floor(((s.finished_at || Date.now()) - (s.started_at || s.created_at))/1000))} seconds` : 'unknown';
      row.append(el('p', `Phase ${human(s.phase)} · Elapsed ${duration} · Created ${time(s.created_at)} · Last activity ${time(s.updated_at)} (#${s.latest_seq ?? '?'}) · Plan ${s.plan_version_id}`));
      for (const r of s.repositories || []) row.append(el('p', `${r.repository_id} · ${r.role} @ ${r.base_sha || 'unknown'}`));
      activity.append(row);
    }
    say(listItems.size ? `${visible} visible of ${listItems.size} loaded sessions. Filters apply to loaded pages; load more history to search further.` : 'No saved sessions. Start from a ready, saved plan in Ask.');
    if (listItems.size && !visible) activity.append(el('p','No loaded sessions match these filters.'));
  }
  async function list(token, append = false) {
    say('Loading saved sessions…');
    try {
      const page = await request(`/api/sessions?limit=25${append && listCursor ? `&cursor=${enc(listCursor)}` : ''}`);
      if (!live(token)) return;
      if (!Array.isArray(page.items)) throw new Error('Unsupported sessions response.'); onAvailable();
      if (!append) listItems = new Map();
      for (const s of page.items) listItems.set(s.id, s);
      publishRecent([...listItems.values()]);
      listCursor = page.next_cursor; moreEvents.hidden = !listCursor; renderList();
    } catch (e) {
      if (!live(token)) return;
      if (e.status === 404) {
        // Nothing here can work without the session service; leave only the explanation and the way back.
        for (const control of listControls) control.remove();
        moreEvents.hidden = true;
        say("Sessions aren't available in this build. Plans you make in Ask are saved and can start a session once it is.");
      } else say(`Sessions unavailable: ${e.message}`);
    }
  }
  function open() {
    clearTimeout(timer); ++epoch; refreshBusy = false; active = /^#\/sessions(?:\/[^/]+)?$/.test(location.hash); if (!active) return;
    const token = epoch; try { currentID = location.hash.startsWith('#/sessions/') ? decodeURIComponent(location.hash.slice(11)) : null; } catch { currentID = null; }
    const openedID = currentID;
    panel.replaceChildren(); panel.classList.toggle('session-detail', location.hash.startsWith('#/sessions/')); status = el('p'); status.setAttribute('role', 'status'); panel.append(status);
    events.clear(); history.clear(); cursor = 0; messageCursor = null; sourceAllowed = true; current = null; messageSending = false; targetEdited = false; diffSignature = null; checksSignature = null;
    if (!currentID) {
      link(panel, 'Create a plan in Ask', '#/ask'); const reload = button(panel, 'Reload sessions', () => list(token));
      const filters = el('form', undefined, 'settings-form catalog-filters'); panel.append(filters); listControls = [reload, filters];
      const query = field(filters, 'Search loaded sessions', '', 'search');
      const stateLabel = el('label', 'Session state'); const state = el('select'); for (const [value,text] of [['','All states'],['active','Active'],['terminal','Terminal']]) { const option=el('option',text);option.value=value;state.append(option); } stateLabel.append(state);filters.append(stateLabel);
      const repository = field(filters, 'Repository in loaded sessions', '', 'search'); const date = field(filters, 'Created on or after', '', 'date');
      listFilters = {query,state,repository,date}; filters.addEventListener('input',renderList);filters.addEventListener('change',renderList);filters.addEventListener('submit',e=>e.preventDefault());
      activity = el('div'); panel.append(activity); moreEvents = button(panel, 'More sessions', () => list(token, true)); moreEvents.hidden = true; list(token); return;
    }
    plan = null; lastChecks = null; lastConfirmed = null;
    // Three panes: the rail (shell), the center thread, and a details pane the page owns so it cannot be dismissed.
    const main = el('div', undefined, 'session-main'), pane = el('aside', undefined, 'session-pane'); pane.setAttribute('aria-label', 'Session details');
    panel.append(main, pane);
    const top = el('div', undefined, 'session-top'); main.append(top);
    origin = el('p', undefined, 'session-origin'); phase = el('span', undefined, 'session-phase'); top.append(origin, phase);
    main.append(status);
    const nav = el('div', undefined, 'session-actions'); main.append(nav);
    link(nav, 'All sessions', '#/sessions'); button(nav, 'Reconnect / refresh session', () => refresh(token));
    retryKey = storage.get(`session-retry-${currentID}`);
    retry = button(nav, 'Retry as a new attempt', b => mutate(b, async t => { retryKey ||= globalThis.crypto.randomUUID(); storage.set(`session-retry-${currentID}`, retryKey); try { const result = await request(`/api/sessions/${enc(currentID)}/retry`, 'POST', {idempotency_key:retryKey}); if (!live(t)) return; if (!result.session_id) throw new Error('Retry outcome unknown; retry the same request.'); location.hash = `#/sessions/${enc(result.session_id)}`; } catch(e) { if (live(t) && e.status >= 400 && e.status < 500) { retryKey = null; storage.set(`session-retry-${openedID}`, null); } throw e; } })); retry.disabled = true;
    summary = region(main, 'Loading session');
    activity = region(main, 'Activity'); moreEvents = button(main, 'Load more activity', b => mutate(b, () => loadEvents(token))); moreEvents.hidden = true;
    messageRows = region(main, 'Messages and delivery'); moreMessages = button(main, 'More messages', b => mutate(b, () => loadMessages(token, true))); moreMessages.hidden = true;
    questionArea = el('div', undefined, 'session-question'); main.append(questionArea);
    const form = el('form', undefined, 'session-composer'); main.append(form);
    const targetLabel = el('label', 'Message target'); responseTo = el('select'); targetLabel.append(responseTo); form.append(targetLabel); responseTo.addEventListener('change', () => { targetEdited = true; });
    const label = el('label', 'Follow-up or question reply'); compose = el('textarea'); compose.maxLength = 8000; compose.rows = 3; compose.setAttribute('placeholder', 'Guide the agent while it works…'); label.append(compose); form.append(label);
    form.append(el('p', 'Clarifications stay within the saved plan. Goal, writable scope or grant changes require an amended plan. Queued does not mean the agent has read your message.', 'detail-muted'));
    const row = el('div', undefined, 'session-composer-actions'); form.append(row);
    send = el('button', 'Send message', 'button'); send.type = 'submit'; row.append(send); send.disabled = true;
    stop = button(row, 'Stop session', b => mutate(b, async t => { const result = await request(`/api/sessions/${enc(currentID)}/stop`, 'POST', {}); if (!live(t)) return; say(`Stop ${human(result.state || 'requested')}. Waiting for verified process and container termination.`); await refresh(t); })); stop.disabled = true; stop.classList.add('session-stop');
    row.append(el('span', 'Stopping ends the agent and its container; saved checkpoints stay.', 'detail-muted'));
    pendingMessage = storage.get(`session-message-${currentID}`); if (pendingMessage) compose.value = pendingMessage.content || '';
    form.addEventListener('submit', e => { e.preventDefault(); if (send.disabled || !form.isConnected || !live(token)) return; sendMessage(send, compose.value.trim(), responseTo.value || null, true); });
    const tabList = el('div', undefined, 'session-tabs'); tabList.setAttribute('role', 'tablist'); tabList.setAttribute('aria-label', 'Session details'); pane.append(tabList);
    progress = el('section', undefined, 'session-section'); patches = el('section', undefined, 'session-section session-side'); checks = el('section', undefined, 'session-section session-side'); publication = el('section', undefined, 'session-section');
    patches.append(el('h2', 'Diff')); checks.append(el('h2', 'Validation checks'));
    const tabs = [['Progress', progress], ['Diff', patches], ['Checks', checks], ['PR', publication]].map(([name, body], i) => {
      const tab = el('button', name, 'session-tab'); tab.type = 'button'; tab.id = `session-tab-${i}`; body.id = `session-tabpanel-${i}`;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', body.id); body.setAttribute('role', 'tabpanel'); body.setAttribute('aria-labelledby', tab.id);
      tabList.append(tab); pane.append(body); return [tab, body];
    });
    const select = i => tabs.forEach(([tab, body], j) => { tab.setAttribute('aria-selected', String(i === j)); tab.setAttribute('tabindex', i === j ? '0' : '-1'); body.hidden = i !== j; });
    tabs.forEach(([tab], i) => {
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', event => { const next = {ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1}[event.key]; if (next === undefined) return; event.preventDefault(); select(next); tabs[next][0].focus(); });
    });
    select(0); renderProgress();
    request('/api/sessions?limit=25').then(page => { if (live(token) && Array.isArray(page?.items)) publishRecent(page.items); }, () => {});
    refresh(token);
  }
  window.addEventListener('hashchange', open);
  return {panel, open, refresh: () => refresh(epoch), close() { active = false; ++epoch; clearTimeout(timer); }, focus() { host.querySelector('h1')?.focus(); }};
}

const runnerFields = [
  ['memory_mib', 'Container memory (MiB)', 512, 128, 4096], ['workspace_mib', 'Workspace disk (MiB)', 64, 1, 1024], ['tmp_mib', 'Temporary disk (MiB)', 16, 1, 256], ['cpus', 'CPU cores', 1, 1, 4], ['pids', 'Process limit', 64, 16, 512], ['wall_seconds', 'Runner deadline (seconds)', 600, 10, 3600], ['max_files', 'Maximum files', 2000, 1, 20000], ['max_file_bytes', 'Maximum file size (bytes)', 262144, 1, 16777216], ['max_output_bytes', 'Maximum command output (bytes)', 65536, 1024, 1048576],
];
const agentFields = [
  ['wall_seconds', 'Agent deadline (seconds)', 180, 1, 3600], ['max_turns', 'Maximum agent turns', 12, 1, 40], ['max_budget_usd', 'Maximum spending (USD)', 1, 0, 10], ['max_output_bytes', 'Maximum agent output (bytes)', 524288, 1024, 1048576],
];
function field(parent, label, value, type = 'text') { const wrap = el('label', label, 'setting-field'); const input = el('input'); input.type = type; input.value = value ?? ''; wrap.append(input); parent.append(wrap); return input; }
function checkText(check) { return !check ? 'Not tested. A real bounded synthetic coding test is required.' : `Synthetic coding test: ${human(check.status)}${check.error_code ? ` · ${human(check.error_code)}` : ''} · Checked ${time(check.checked_at)} · CLI ${check.cli_version || 'unknown'} · Resolved image ${check.image_id || 'unknown'}`; }
export function createExecutionSettings({request = executionRequest, onAvailable = () => {}, isVisible = () => true, pollMs = 2000} = {}) {
  const element = el('section', undefined, 'connected-panel execution-settings');
  const heading = el('h2', 'Execution profiles'); heading.setAttribute('tabindex', '-1');
  const status = el('p'); status.setAttribute('role','status');
  const rows = el('div'), editor = el('section', undefined, 'setting-box'), settingsHost = el('div');
  element.append(heading, status);
  button(element, 'Reload execution settings', () => refresh());
  element.append(el('p', 'Execution uses the installed Claude Code CLI with its normal CLI login. Sign in through that CLI on this machine before testing. Never paste CLI tokens, keys or authentication files here. Docker and a locally provisioned compatible image are required; runtime tests never install a toolchain or pull images automatically.'), el('p', 'Claude Code sends prompts and permitted source to its external model destination. Workspace local-only policy blocks this adapter, including synthetic tests. For repository execution, disable local-only in Model providers and explicitly allow source sharing on this execution profile. Source consent does not grant repository access or publication permission.'), settingsHost, rows, editor);
  let generation = 0, mutating = false, unknownWrite = false, pageCursor = null, profiles = new Map(), timer, pendingTests = new Map(), editorDirty = false;
  const current = token => token === generation;
  function preserveFocus(fn) { const restore = inside(element, document.activeElement); fn(); if (restore && isVisible() && (document.activeElement === document.body || !document.activeElement?.isConnected)) heading.focus(); }
  function schedule() { clearTimeout(timer); if (pendingTests.size) { timer = setTimeout(pollTests, pollMs); timer?.unref?.(); } }
  async function pollTests() {
    const token = generation;
    try {
      const observed = [];
      for (const [id, versionID] of pendingTests) {
        const version = await request(`/api/execution-profile-versions/${enc(versionID)}`);
        if (!current(token)) return;
        observed.push(`${versionID}: ${checkText(version.check)}`);
        const profile = profiles.get(id);
        if (profile?.active_version_id === versionID) { profile.check = version.check; profile.version.check = version.check; }
        if (!['queued','running'].includes(version.check?.status)) pendingTests.delete(id);
      }
      if (current(token)) { preserveFocus(renderRows); status.textContent = `${pendingTests.size ? 'Synthetic coding test is still running.' : 'Synthetic test finished; evidence covers only the checked immutable version.'} ${observed.join(' · ')}`; }
    } catch (e) { if (current(token)) status.textContent = `Test status unavailable: ${e.message}. Use Reload execution settings to reconnect; do not assume success.`; }
    finally { if (current(token)) schedule(); }
  }
  async function mutation(b, fn) {
    if (unknownWrite) { status.textContent = 'A previous write has an unknown outcome. Reload execution settings and inspect saved versions before another change.'; return; }
    if (mutating) return; mutating = true; ++generation; clearTimeout(timer); b.disabled = true; status.textContent = 'Saving execution settings…';
    const focused = inside(element, document.activeElement);
    try { await fn(); }
    catch(e) { unknownWrite = !e.status || e.status >= 500; status.textContent = unknownWrite ? `${e.message}. Reload execution settings and inspect saved versions before another change.` : e.message; }
    finally { mutating = false; b.disabled = false; if (focused && isVisible() && (document.activeElement === document.body || !document.activeElement?.isConnected)) heading.focus(); schedule(); }
  }
  function renderRows() {
    rows.replaceChildren();
    for (const profile of profiles.values()) {
      const v = profile.version, config = v.config || {}, box = el('section', undefined, 'setting-box');
      box.append(el('h3', profile.name), el('p', `${human(v.adapter)} · ${human(v.auth_mode)} · Version ${v.version} (${v.id})`), el('p', `Image ${config.image || 'unknown'} · External source ${config.allow_external_source ? 'allowed by this profile; workspace policy still applies' : 'sharing disabled'}`), el('p', limitsText(config)), el('p', checkText(profile.check)));
      const capabilities = profile.check?.capabilities || {};
      box.append(el('p', `Verified capabilities: ${Object.entries(capabilities).filter(([,v]) => v === true).map(([k]) => human(k)).join(', ') || 'none reported'}. Unreported capabilities are unavailable.`));
      button(box, `Edit execution profile ${profile.name}`, () => { if (!mutating && (!editorDirty || window.confirm('Discard unsaved execution profile edits?'))) { renderEditor(profile); editor.querySelector('input')?.focus(); } });
      const test = button(box, `Test execution profile ${profile.name}`, b => mutation(b, async () => {
        // No source or credentials are submitted by the UI. This is an explicit model invocation.
        const result = await request(`/api/execution-profiles/${enc(profile.id)}/test`, 'POST', {});
        if (!result.version_id || !result.job_id) throw new Error('Test outcome unknown. Reload saved profile checks before testing again.');
        pendingTests.set(profile.id, result.version_id); if (profile.active_version_id === result.version_id) profile.check = {status:result.status || 'queued'};
        preserveFocus(renderRows); status.textContent = `Synthetic coding test ${human(result.status || 'queued')} · Job ${result.job_id} · Immutable version ${result.version_id}. Polling its saved immutable-version check; usage and cost unknown.`;
      }));
      test.disabled = pendingTests.has(profile.id) || ['queued','running'].includes(profile.check?.status);
      button(box, `Delete execution profile ${profile.name}`, () => {
        if (mutating) return;
        const confirm = el('div'); confirm.append(el('p', 'Deletion prevents future use; immutable session history remains.'));
        button(confirm, `Confirm delete execution profile ${profile.name}`, b => mutation(b, async () => { await request(`/api/execution-profiles/${enc(profile.id)}`, 'DELETE', {}); profiles.delete(profile.id); pendingTests.delete(profile.id); preserveFocus(renderRows); status.textContent = 'Execution profile deleted. Existing history remains.'; }));
        button(confirm, 'Cancel execution profile deletion', () => { confirm.remove(); }); box.append(confirm);
      }); rows.append(box);
    }
    if (!profiles.size) rows.append(el('p', 'No execution profiles. Create one below, then run its synthetic coding test.'));
    if (pageCursor) button(rows, 'More execution profiles', () => refresh(true));
  }
  function renderEditor(profile = null) {
    editorDirty = false; const v = profile?.version, config = v?.config || {};
    editor.replaceChildren(el('h3', profile ? `Edit execution profile ${profile.name}` : 'Create execution profile'));
    const form = el('form', undefined, 'settings-form');
    const name = field(form, 'Execution profile name', profile?.name || ''); name.required = true; name.maxLength = 100;
    form.append(el('p', 'Adapter: Claude Code · Authentication: normal installed CLI login. API-key and managed authentication profiles are unavailable.'));
    const image = field(form, 'Locally provisioned container image (tag or digest)', config.image || ''); image.required = true; image.maxLength = 255;
    form.append(el('p', 'Choose an image already present in Docker with the tools your plan needs. Network is disabled inside the container. Missing dependencies produce unavailable checks; no host fallback is used. Memory must cover workspace disk + temporary disk + at least 64 MiB.'));
    const consent = field(form, 'Allow sending repository source to the external coding model', '', 'checkbox'); consent.checked = config.allow_external_source === true;
    const values = {};
    for (const [kind, title, specs] of [['runner_limits','Container resource limits',runnerFields], ['agent_limits','Agent limits',agentFields]]) {
      const group = el('fieldset'); group.append(el('legend', title)); values[kind] = {};
      for (const [key,label,def,min,max] of specs) { const input = field(group, label, config[kind]?.[key] ?? def, 'number'); input.required = true; input.min = String(min); input.max = String(max); input.step = key === 'max_budget_usd' ? 'any' : '1'; values[kind][key] = input; }
      form.append(group);
    }
    const save = el('button', profile ? 'Save execution profile version' : 'Create execution profile', 'button'); save.type = 'submit'; form.append(save);
    if (profile) button(form, 'Cancel execution profile edit', () => renderEditor());
    form.addEventListener('input', () => { editorDirty = true; }); form.addEventListener('change', () => { editorDirty = true; });
    form.addEventListener('submit', e => { e.preventDefault(); if (save.disabled || mutating || !form.isConnected) return;
      const runner_limits = Object.fromEntries(Object.entries(values.runner_limits).map(([k,input]) => [k,Number(input.value)]));
      const agent_limits = Object.fromEntries(Object.entries(values.agent_limits).map(([k,input]) => [k,Number(input.value)]));
      if (!Number.isFinite(agent_limits.max_budget_usd) || agent_limits.max_budget_usd <= 0) { status.textContent = 'Maximum spending must be a positive number up to 10 USD.'; return; }
      if (runner_limits.memory_mib < runner_limits.workspace_mib + runner_limits.tmp_mib + 64) { status.textContent = 'Increase container memory to cover workspace + temporary disk + 64 MiB.'; return; }
      mutation(save, async () => {
        const saved = await request(profile ? `/api/execution-profiles/${enc(profile.id)}` : '/api/execution-profiles', profile ? 'PATCH' : 'POST', {name:name.value.trim(),adapter:'claude_code',auth_mode:'cli_login',image:image.value.trim(),allow_external_source:consent.checked,runner_limits,agent_limits});
        if (!saved.id || !saved.version) throw new Error('Save outcome unknown. Reload saved execution profiles before creating another version.');
        profiles.set(saved.id, saved); preserveFocus(renderRows); renderEditor(); status.textContent = 'Execution profile version saved. Run its synthetic coding test before selecting it for a session.';
      });
    }); editor.append(form);
  }
  function renderSettings(settings, privacy) {
    settingsHost.replaceChildren(); const form = el('form', undefined, 'settings-form');
    form.append(el('p', `Workspace local-only: ${typeof privacy.settings?.local_only === 'boolean' ? privacy.settings.local_only ? 'enabled — remote execution and synthetic tests are blocked' : 'disabled — profile source consent is still required' : 'unknown — inspect Model providers before testing'}.`));
    const count = field(form, 'Maximum active implementation sessions', settings.max_active_sessions, 'number'); count.min = '1'; count.max = '4'; count.step = '1'; count.required = true;
    form.append(el('p', 'Applies to future launches; changing this limit does not terminate active work.'));
    const save = el('button', 'Save execution concurrency', 'button'); save.type = 'submit'; form.append(save);
    form.addEventListener('submit', e => { e.preventDefault(); if (!form.isConnected) return; mutation(save, async () => { const saved = await request('/api/settings/execution','PATCH',{max_active_sessions:Number(count.value)}); count.value = saved.max_active_sessions; status.textContent = 'Execution concurrency saved for future launches.'; }); }); settingsHost.append(form);
  }
  async function refresh(append = false) {
    if (mutating) { status.textContent = 'A settings mutation is pending. Wait before reloading saved profiles.'; return; }
    const token = ++generation; clearTimeout(timer); status.textContent = 'Loading execution settings…';
    try {
      const results = await Promise.allSettled([request(`/api/execution-profiles?limit=50${append && pageCursor ? `&cursor=${enc(pageCursor)}` : ''}`), request('/api/settings/execution'), request('/api/settings/model-roles')]);
      if (!current(token)) return;
      if (results[0].status === 'rejected') throw results[0].reason;
      const page = results[0].value;
      if (!Array.isArray(page.items)) throw new Error('Unsupported execution-profile list.'); onAvailable(); unknownWrite = false;
      if (!append) { profiles.clear(); pendingTests.clear(); }
      for (const profile of page.items) { profiles.set(profile.id,profile); if (['queued','running'].includes(profile.check?.status)) pendingTests.set(profile.id, profile.active_version_id); }
      pageCursor = page.next_cursor;
      preserveFocus(() => { renderRows(); if (results[1].status === 'fulfilled') renderSettings(results[1].value,results[2].status === 'fulfilled' ? results[2].value : {}); else settingsHost.replaceChildren(el('p', `Execution concurrency unavailable: ${results[1].reason.message}`)); if (!editorDirty) renderEditor(); });
      status.textContent = 'Execution profiles loaded. Cached checks are evidence for their immutable version; reads never start a model. Synthetic testing may incur model cost.';
    } catch(e) { if (current(token)) status.textContent = e.status === 404 ? 'Execution profiles are unavailable in this build. Model-provider setup remains separate.' : `Execution settings unavailable: ${e.message}`; }
    finally { if (current(token)) schedule(); }
  }
  return {element, refresh, close() { ++generation; clearTimeout(timer); }};
}
