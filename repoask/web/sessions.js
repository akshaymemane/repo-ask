// Durable session views consume safe public projections. Source is always text.
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

export function createSessionPanel({host, request = executionRequest, onAvailable = () => {}, pollMs = 2000}) {
  const panel = el('div', undefined, 'sessions-panel'); host.append(panel);
  let epoch = 0, timer, active = false, currentID = null, refreshBusy = false, current, cursor = 0, sourceAllowed = true, messageCursor = null;
  const events = new Map(), history = new Map(); let messageSending = false, targetEdited = false, pendingMessage, retryKey, listCursor, listItems = new Map(), listFilters;
  let diffSignature, checksSignature;
  let status, summary, activity, patches, checks, messageRows, questionArea, compose, send, responseTo, stop, retry, moreEvents, moreMessages;
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
    questionArea.replaceChildren(); if (revoke) { compose.value = ''; responseTo.value = ''; } send.disabled = true; compose.disabled = true; responseTo.disabled = true;
  }
  function renderSummary() {
    const s = current, x = s.execution || {}, u = s.usage || {}, outcome = s.outcome || {};
    const started = s.started_at || s.created_at; const end = s.finished_at || Date.now();
    const elapsed = started ? `${Math.max(0, Math.floor((end - started) / 1000))} seconds${s.finished_at ? '' : ' elapsed'}` : 'unknown';
    focusReplacement(summary, () => {
      summary.replaceChildren(el('h2', `${human(s.state)} · ${human(s.phase)}`));
      const facts = el('div'); summary.append(facts);
      const reportedTokens = u.tokens || u;
      const tokens = ['input_tokens', 'output_tokens', 'total_tokens'].filter(k => Number.isFinite(reportedTokens[k])).map(k => `${human(k)} ${reportedTokens[k]}`).join(' · ') || 'unknown';
      const cost = Number.isFinite(u.reported_cost_usd) ? `${u.reported_cost_usd} USD (reported)` : Number.isFinite(u.estimated_cost) ? `${u.estimated_cost} USD (${u.cost_status || 'estimated'})` : 'unknown';
      lines(facts, [['Attempt', `${s.attempt ?? 'unknown'} · ${s.id}`], ['Plan version', `${s.plan_version_id} · SHA256 ${s.content_hash}`], ['Elapsed time', elapsed], ['Execution profile', `${x.profile_id || 'unknown'} · Version ${x.version ?? 'unknown'} (${x.profile_version_id || 'unknown'})`], ['Agent', `${x.adapter || 'unknown'} · CLI ${x.cli_version || 'unknown'} · Model ${u.observed_model || u.model || [...events.values()].find(e => e.type === 'agent.summary' && e.payload?.kind === 'ready')?.payload.model || outcome.model || 'unknown'}`], ['Destination', x.destination ? `${x.destination.kind || 'unknown'} · ${x.destination.host || x.destination.disclosure || 'destination details unknown'}` : 'unknown'], ['Pinned image', x.image_id || 'unknown'], ['Resource limits', limitsText(s.limits)], ['Usage', tokens], ['Cost', cost], ['Containment', human(s.runner?.containment)], ['Outcome', human(outcome.result || outcome.status || outcome.code || outcome.reason || s.error_code || 'not yet recorded')], ['Stop reason', human(s.stop_reason || 'none')]]);
      for (const r of s.repositories || []) summary.append(el('p', `${r.repository_id} · ${r.role} · Base ${r.base_sha || 'unknown'} (${r.base_branch || 'unknown branch'}) · Session branch ${r.session_branch || 'not assigned'}`));
      link(summary, 'Saved plan version', `#/plans/${enc(s.plan_id)}/${enc(s.plan_version_id)}`);
      if (s.predecessor_id) link(summary, 'Previous attempt', `#/sessions/${enc(s.predecessor_id)}`);
      if (s.successor_id) link(summary, 'Successor attempt', `#/sessions/${enc(s.successor_id)}`);
      summary.append(el('p', `Capabilities: user questions ${s.capabilities?.ask_user ? 'available' : 'unavailable'} · Follow-ups ${s.capabilities?.follow_up ? 'available' : 'no proven delivery channel; messages may remain queued'} · Resume ${s.capabilities?.resume ? 'available' : 'unavailable'}`));
      summary.append(el('p', `Publication: ${human(s.publication?.policy || s.publication?.state || 'unavailable')}. ${s.publication?.policy === 'on_success_draft' ? 'The saved launch policy authorizes a remote branch and draft PR only after server success and publication checks.' : 'An explicit publication action is required after review.'} Draft PR controls are unavailable in this build.`));
      summary.append(el('p', `External source sharing at launch: ${x.allow_external_source === true ? 'explicitly permitted by the pinned profile; live workspace and repository policy still apply' : x.allow_external_source === false ? 'disabled' : 'unknown'}.`));
    });
    stop.disabled = terminal.has(s.state) && s.runner?.containment !== 'failed';
    stop.textContent = s.state === 'stopping' || s.stop_requested ? 'Request stop again' : 'Stop session';
    retry.disabled = !terminal.has(s.state) || Boolean(s.successor_id);
    if (s.state === 'stopping' || s.stop_requested) say(`Stop requested. Containment ${human(s.runner?.containment)}; work is not confirmed stopped until the server verifies termination.`);
  }
  function renderEvents() {
    activity.replaceChildren(el('h2', 'Activity timeline'));
    const list = el('ol');
    for (const e of [...events.values()].sort((a,b) => a.seq - b.seq)) { const item = el('li', `#${e.seq} · ${time(e.created_at)} · ${eventText(e, sourceAllowed)}`); item.dataset.seq = e.seq; list.append(item); }
    activity.append(list); if (!events.size) activity.append(el('p', 'No saved activity yet.'));
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
    questionArea.replaceChildren();
    if (q && sourceAllowed && !q.redacted) {
      questionArea.append(el('h2', 'Agent question'), el('p', q.prompt || 'Question text unavailable'));
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
  }
  function renderDiff(data) {
    const signature = JSON.stringify([sourceAllowed, data]); if (signature === diffSignature) return; diffSignature = signature;
    const expanded = new Set([...patches.querySelectorAll('details')].filter(n => n.open).map(n => n.querySelector('summary')?.dataset.focus));
    focusReplacement(patches, () => {
      patches.replaceChildren(el('h2', 'Diff'));
      if (!sourceAllowed || !data.available) { patches.append(el('p', `Diff unavailable: ${human(!sourceAllowed ? 'source_unavailable' : data.reason || 'not_captured')}.`)); return; }
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
      onAvailable(); current = data;
      if (data.source_available === false) { if (sourceAllowed) clearSource(); sourceAllowed = false; }
      else if (!sourceAllowed) { sourceAllowed = true; events.clear(); history.clear(); cursor = 0; messageCursor = null; }
      renderSummary(); renderQuestion();
      const results = await Promise.allSettled([loadEvents(token), loadMessages(token), request(`/api/sessions/${enc(currentID)}/diff`), request(`/api/sessions/${enc(currentID)}/validations`)]);
      if (!live(token)) return;
      if (results.some(r => r.status === 'fulfilled' && r.value?.source_available === false)) { if (sourceAllowed) clearSource(); sourceAllowed = false; renderQuestion(); }
      if (results[2].status === 'fulfilled') renderDiff(results[2].value); else renderDiff({available:false,reason:results[2].reason.code || 'request_failed'});
      if (results[3].status === 'fulfilled') renderChecks(results[3].value); else checks.replaceChildren(el('h2', 'Validation checks'), el('p', `Checks unavailable: ${results[3].reason.message}`));
      const failure = results.find(r => r.status === 'rejected');
      if (failure) say(`Some saved state is unavailable: ${failure.reason.message}. Reconnect retries from event #${cursor}.`);
      else if (!current.stop_requested) say(sourceAllowed ? `Connected · Saved activity through #${cursor}. Browser disconnects do not stop background work.` : 'Source unavailable. Previously displayed source has been cleared.');
    } catch (e) { if (live(token)) { clearSource(false); say(`Session unavailable: ${e.message}. Reconnect to inspect current saved state.`); } }
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
      listCursor = page.next_cursor; moreEvents.hidden = !listCursor; renderList();
    } catch (e) { if (live(token)) say(e.status === 404 ? 'Sessions are unavailable in this build. Ask and saved plans remain available.' : `Sessions unavailable: ${e.message}`); }
  }
  function open() {
    clearTimeout(timer); ++epoch; refreshBusy = false; active = /^#\/sessions(?:\/[^/]+)?$/.test(location.hash); if (!active) return;
    const token = epoch; try { currentID = location.hash.startsWith('#/sessions/') ? decodeURIComponent(location.hash.slice(11)) : null; } catch { currentID = null; }
    const openedID = currentID;
    panel.replaceChildren(); status = el('p'); status.setAttribute('role', 'status'); panel.append(status);
    events.clear(); history.clear(); cursor = 0; messageCursor = null; sourceAllowed = true; current = null; messageSending = false; targetEdited = false; diffSignature = null; checksSignature = null;
    if (!currentID) {
      link(panel, 'Create a plan in Ask', '#/ask'); button(panel, 'Reload sessions', () => list(token));
      const filters = el('form', undefined, 'settings-form catalog-filters'); panel.append(filters);
      const query = field(filters, 'Search loaded sessions', '', 'search');
      const stateLabel = el('label', 'Session state'); const state = el('select'); for (const [value,text] of [['','All states'],['active','Active'],['terminal','Terminal']]) { const option=el('option',text);option.value=value;state.append(option); } stateLabel.append(state);filters.append(stateLabel);
      const repository = field(filters, 'Repository in loaded sessions', '', 'search'); const date = field(filters, 'Created on or after', '', 'date');
      listFilters = {query,state,repository,date}; filters.addEventListener('input',renderList);filters.addEventListener('change',renderList);filters.addEventListener('submit',e=>e.preventDefault());
      activity = el('div'); panel.append(activity); moreEvents = button(panel, 'More sessions', () => list(token, true)); moreEvents.hidden = true; list(token); return;
    }
    link(panel, 'All sessions', '#/sessions'); button(panel, 'Reconnect / refresh session', () => refresh(token));
    summary = region(panel, 'Loading session'); const actions = el('div', undefined, 'session-actions'); panel.append(actions);
    stop = button(actions, 'Stop session', b => mutate(b, async t => { const result = await request(`/api/sessions/${enc(currentID)}/stop`, 'POST', {}); if (!live(t)) return; say(`Stop ${human(result.state || 'requested')}. Waiting for verified process and container termination.`); await refresh(t); })); stop.disabled = true;
    retryKey = storage.get(`session-retry-${currentID}`);
    retry = button(actions, 'Retry as a new attempt', b => mutate(b, async t => { retryKey ||= globalThis.crypto.randomUUID(); storage.set(`session-retry-${currentID}`, retryKey); try { const result = await request(`/api/sessions/${enc(currentID)}/retry`, 'POST', {idempotency_key:retryKey}); if (!live(t)) return; if (!result.session_id) throw new Error('Retry outcome unknown; retry the same request.'); location.hash = `#/sessions/${enc(result.session_id)}`; } catch(e) { if (live(t) && e.status >= 400 && e.status < 500) { retryKey = null; storage.set(`session-retry-${openedID}`, null); } throw e; } })); retry.disabled = true;
    questionArea = region(panel, 'Agent questions'); const form = el('form', undefined, 'settings-form'); panel.append(form);
    const targetLabel = el('label', 'Message target'); responseTo = el('select'); targetLabel.append(responseTo); form.append(targetLabel); responseTo.addEventListener('change', () => { targetEdited = true; });
    const label = el('label', 'Follow-up or question reply'); compose = el('textarea'); compose.maxLength = 8000; compose.rows = 4; label.append(compose); form.append(label);
    form.append(el('p', 'Clarifications stay within the saved plan. Goal, writable scope or grant changes require an amended plan. Queued does not mean the agent has read your message.'));
    send = el('button', 'Send message', 'button'); send.type = 'submit'; form.append(send); send.disabled = true;
    pendingMessage = storage.get(`session-message-${currentID}`); if (pendingMessage) compose.value = pendingMessage.content || '';
    form.addEventListener('submit', e => { e.preventDefault(); if (send.disabled || !form.isConnected || !live(token)) return; mutate(send, async t => {
      const content = compose.value.trim(), question_id = responseTo.value || null;
      if (!content) throw new Error('Enter a message.');
      if (pendingMessage && (pendingMessage.content !== content || (pendingMessage.question_id || null) !== question_id)) throw new Error('Retry the unchanged pending message and target to reconcile its unknown outcome.');
      pendingMessage ||= {content, question_id, client_request_id:globalThis.crypto.randomUUID()}; storage.set(`session-message-${currentID}`, pendingMessage);
      const submittedAttempt = pendingMessage; messageSending = true; renderQuestion();
      try { const result = await request(`/api/sessions/${enc(currentID)}/messages`, 'POST', submittedAttempt); if (!live(t)) return; if (!result.id || !result.delivery) throw new Error('Message outcome unknown; retry the same request.'); history.set(result.id,{...result,content:sourceAllowed ? submittedAttempt.content : null}); pendingMessage = null; storage.set(`session-message-${currentID}`, null); compose.value = ''; targetEdited = false; renderMessages(); say(`Message ${human(result.delivery)}${result.reason ? ` · ${human(result.reason)}` : ''}.`); }
      catch(e) { if (live(t) && e.status >= 400 && e.status < 500) { pendingMessage = null; storage.set(`session-message-${openedID}`, null); } throw e; }
      finally { if (live(t)) { messageSending = false; renderQuestion(); } }
    }); });
    messageRows = region(panel, 'Messages and delivery'); moreMessages = button(panel, 'More messages', b => mutate(b, () => loadMessages(token, true))); moreMessages.hidden = true;
    activity = region(panel, 'Activity timeline'); moreEvents = button(panel, 'Load more activity', b => mutate(b, () => loadEvents(token))); moreEvents.hidden = true;
    patches = region(panel, 'Diff'); checks = region(panel, 'Validation checks'); refresh(token);
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
