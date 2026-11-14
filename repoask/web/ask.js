// Persistent Ask consumes the frozen AskAPI; source and model output are always text.
const el = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
const enc = encodeURIComponent;
export async function createAskPanel({host, request = http}) {
  let listing;
  try { listing = await request('/api/conversations'); if (!Array.isArray(listing.items)) return null; }
  catch { return null; } // Older servers retain the complete legacy demo.
  const panel = el('section'); panel.className = 'persistent-ask';
  const status = el('p'); status.setAttribute('role', 'status');
  const history = el('nav'); history.setAttribute('aria-label', 'Saved conversations');
  const body = el('div'); const source = el('aside'); source.setAttribute('aria-label', 'Snapshot source');
  panel.append(el('h2', 'Ask · saved planning'), status, history, body, source); host.append(panel);
  let sourceEpoch=0;
  let epoch = 0, current = null, draft = false, pending = false, timer, acceptedHash = location.hash;
  let sendAttempt = null;
  try { sendAttempt = JSON.parse(window.sessionStorage?.getItem('ask-pending-send') || 'null'); } catch {}
  const persistAttempt = () => { try { if(sendAttempt) window.sessionStorage?.setItem('ask-pending-send',JSON.stringify(sendAttempt)); else window.sessionStorage?.removeItem('ask-pending-send'); } catch {} }; const launchKeys = new Map(); const promptDrafts=new Map();
  const say = error => { status.textContent = error instanceof Error ? error.message : error; };
  const button = (parent, text, fn) => { const b = el('button', text); b.type = 'button'; b.addEventListener('click', async () => { if(b.disabled)return; b.disabled=true; try { await fn(); } catch(e) { say(e); } finally { b.disabled=false; } }); parent.append(b); return b; };
  const link = (parent, text, hash) => { const a = el('a', text); a.setAttribute('href', hash); parent.append(a); };
  const field = (parent, label, value) => { const wrap = el('label', label); const input = el('textarea'); input.value = value || ''; input.addEventListener('input', () => { draft = true; }); wrap.append(input); parent.append(wrap); return input; };
  const guard = () => !draft || window.confirm('Discard unsaved Ask or plan edits?');
  window.addEventListener('beforeunload', e => { if (draft) { e.preventDefault(); e.returnValue = ''; } });
  async function refreshHistory(cursor) {
    const page = cursor ? await request(`/api/conversations?cursor=${enc(cursor)}`) : await request('/api/conversations');
    if (!cursor) history.replaceChildren();
    button(history, 'New saved conversation', async () => { if (!guard()) return; const c = await request('/api/conversations', 'POST', {}); draft = false; location.hash = `#/ask/${enc(c.id)}`; });
    for (const c of page.items) link(history, c.title || c.id, `#/ask/${enc(c.id)}`);
    if (page.next_cursor) button(history, 'More conversations', () => refreshHistory(page.next_cursor));
  }
  async function cite(c, token) {
    const sourceToken=++sourceEpoch; source.replaceChildren(el('p', 'Loading exact snapshot…'));
    try {
      const q = new URLSearchParams(); for (const key of ['repository_id','snapshot_id','path','start_line','end_line']) q.set(key, c[key]);
      const s = await request(`/api/context/source?${q}`);
      if (token !== epoch || sourceToken!==sourceEpoch) return;
      source.replaceChildren(el('h3', `${s.repository_id} · ${s.revision} · ${s.path}`), el('pre', s.lines.map((line, i) => `${s.first_line + i}  ${line}`).join('\n')));
      button(source, 'Close source', () => {sourceEpoch++;source.replaceChildren();});
    } catch (e) { if (token === epoch && sourceToken===sourceEpoch) source.replaceChildren(el('p', `Source unavailable: ${e.message}`)); }
  }
  function citations(parent, list, token) { for (const c of list || []) button(parent, `${c.repository_id} · ${c.path}:${c.start_line}–${c.end_line} @ ${c.revision}`, () => cite(c, token)); }
  async function conversation(id, token) {
    const c = await request(`/api/conversations/${enc(id)}`); if (token !== epoch) return;
    current = c; body.replaceChildren(el('h3', c.title || 'Conversation'));
    body.append(el('p', `Scope revision ${c.scope_revision}: ${(c.repository_ids || []).join(', ') || 'Unscoped; route a question or choose repositories'}`));
    const details=el('section'); body.append(details);
    Promise.allSettled((c.repository_ids || []).map(r=>request(`/api/repositories/${enc(r)}/context`))).then(results=>{if(token!==epoch)return;for(const result of results){if(result.status==='fulfilled'){const r=result.value;details.append(el('p',`${r.name} · ${r.repository_id} · ${r.status} · Base ${r.active_snapshot?.revision || 'not indexed'} · Coverage ${JSON.stringify(r.active_snapshot?.coverage || 'unknown')} · Implementation ${r.implementation_enabled?'enabled':'disabled'}`));}}});
    request('/api/settings/model-roles').then(settings=>{if(token!==epoch)return;details.append(el('p',`Local-only policy: ${settings.settings?.local_only===true?'enabled':settings.settings?.local_only===false?'disabled':'unknown'}`));for(const role of ['ask','planning']){const r=settings.roles?.[role] || {};details.append(el('p',`${role} model: ${r.model || 'unknown'} · ${r.status || 'unknown'} · Destination: ${r.destination ? JSON.stringify(r.destination):'unknown'} · Usage and cost: unknown until returned`));}}).catch(()=>{if(token===epoch)details.append(el('p','Model configuration unavailable · destination, usage and cost unknown. See Settings.'));});
    const scope = field(body, 'Repository IDs (one per line; explicit manual scope)', (c.repository_ids || []).join('\n'));
    button(body, 'Save repository scope', async () => { await request(`/api/conversations/${enc(id)}`, 'PATCH', {repository_ids: scope.value.split('\n').map(x=>x.trim()).filter(Boolean), expected_revision:c.scope_revision}); if(token===epoch){draft = false; await load();} });
    const catalogQuery=field(body,'Find repositories by name','');
    const catalog=el('section');body.append(catalog);
    let catalogCursor=null;
    async function browse(append=false){const page=await request(`/api/context/repositories?query=${enc(catalogQuery.value)}${append && catalogCursor ? `&cursor=${enc(catalogCursor)}`:''}`);if(token!==epoch)return;if(!append)catalog.replaceChildren();catalogCursor=page.next_cursor;for(const r of page.items){const label=el('label',`${r.name} · ${r.status} · ${r.repository_id}`);const check=el('input');check.type='checkbox';check.checked=scope.value.split('\n').includes(r.repository_id);check.disabled=!r.eligible;check.addEventListener('change',()=>{const ids=new Set(scope.value.split('\n').filter(Boolean));if(check.checked)ids.add(r.repository_id);else ids.delete(r.repository_id);scope.value=[...ids].join('\n');draft=true;});label.append(check);catalog.append(label);}if(catalogCursor)button(catalog,'More repositories',()=>browse(true));}
    button(body,'Browse repository scope',()=>browse());
    const transcript = el('div'); body.append(transcript);
    const showMessages = messages => { for (const m of messages) { const box = el('article'); box.append(el('h4', `${m.role} · ${m.state}`), el('p', m.content || m.error_code || 'Waiting for generation')); box.append(el('p', `Model: ${m.model || m.generation?.model || 'unknown'} · Destination: ${JSON.stringify(m.destination || m.generation?.destination || 'unknown')} · Usage: ${m.usage ? JSON.stringify(m.usage) : 'unknown'} · Cost: unknown`)); citations(box,m.citations,token); transcript.append(box); } };
    showMessages(c.messages);
    let cursor = c.messages_next_cursor;
    const more = button(body, 'Load more saved messages', async () => { const page = await request(`/api/conversations/${enc(id)}/messages?cursor=${enc(cursor)}`); if(token!==epoch)return; showMessages(page.items); cursor = page.next_cursor; more.hidden = !cursor; }); more.hidden = !cursor;
    for (const p of c.plans || []) link(body, p.title || 'Saved plan', `#/plans/${enc(p.id)}/${enc(p.latest_version_id)}`);
    let planCursor=c.plans_next_cursor;
    const morePlans=button(body, 'More saved plans', async () => { const page = await request(`/api/plans?conversation_id=${enc(id)}&cursor=${enc(planCursor)}`); if(token!==epoch)return; for(const p of page.items) link(body,p.title,`#/plans/${enc(p.id)}/${enc(p.latest_version_id)}`); planCursor=page.next_cursor; morePlans.hidden=!planCursor; }); morePlans.hidden=!planCursor;
    const runLabels=new Map();
    for (const run of c.runs || []) {
      const label=el('p', `Request ${run.id}: ${run.state}${run.error_code ? ` · ${run.error_code}` : ''}`);body.append(label);runLabels.set(run.id,label);
      if (['queued','running'].includes(run.state)) button(body, 'Cancel request', async () => { await request(`/api/answer-runs/${enc(run.id)}/cancel`, 'POST', {}); if(token===epoch && !draft) await load(); });
      if (['failed','cancelled'].includes(run.state)) button(body, 'Retry request', async () => { await request(`/api/answer-runs/${enc(run.id)}/retry`, 'POST', {}); if(token===epoch && !draft) await load(); });
    }
    const prompt = field(body, 'Question or planning request', promptDrafts.get(id) ?? (sendAttempt?.conversation === id ? sendAttempt.content : ''));
    prompt.addEventListener('input',()=>promptDrafts.set(id,prompt.value));
    if(prompt.value)draft=true;
    button(body, 'Find repository candidates', async () => {
      const r = await request('/api/route','POST',{prompt:prompt.value,conversation_id:id,pinned_repository_ids:c.repository_ids || []}); if(token!==epoch)return;
      const results = el('section'); results.append(el('h4', `Routing: ${r.status}`),el('p',r.question || r.next_action || ''),el('p',r.degradation_code || ''));
      for(const candidate of r.candidates) { results.append(el('p',`${candidate.name}: ${candidate.reason} · Coverage ${JSON.stringify(candidate.coverage)} · Freshness ${JSON.stringify(candidate.freshness)} · Implementation ${candidate.implementation_enabled ? 'enabled' : 'disabled'}`)); citations(results,candidate.citations,token); button(results,`Use ${candidate.name}`,async()=>{await request(`/api/conversations/${enc(id)}`,'PATCH',{repository_ids:[candidate.repository_id],expected_revision:c.scope_revision});if(token===epoch){draft=false;await load();}}); } body.append(results);
    });
    async function send(intent) {
      if(pending || !prompt.value.trim())return;
      if(JSON.stringify(scope.value.split('\n').map(x=>x.trim()).filter(Boolean))!==JSON.stringify(c.repository_ids || []))throw new Error('Save repository scope before generating.');
      const content=prompt.value.trim();
      if(sendAttempt && (sendAttempt.content!==content || sendAttempt.intent!==intent || sendAttempt.conversation!==id)) throw new Error('Resolve the uncertain request by retrying the same content and action before submitting another.');
      sendAttempt ||= {conversation:id,content,intent,client_request_id:globalThis.crypto.randomUUID()}; persistAttempt(); pending=true;prompt.disabled=true;
      try { await request(`/api/conversations/${enc(id)}/messages`,'POST',{content,intent,client_request_id:sendAttempt.client_request_id}); sendAttempt=null;persistAttempt();promptDrafts.delete(id);if(token===epoch){draft=false;await load();}await refreshHistory(); } finally {pending=false;prompt.disabled=false;}
    }
    const active = (c.runs || []).some(r=>['queued','running'].includes(r.state));
    button(body,'Ask',()=>send('answer')).disabled=active;
    button(body,'Generate plan',()=>send('plan')).disabled=active;
    button(body,'Reload saved conversation',()=>{if(guard()){draft=false;return load();}});
    async function poll() {
      try {
        const runs=await Promise.all((c.runs || []).filter(r=>['queued','running'].includes(r.state)).map(r=>request(`/api/answer-runs/${enc(r.id)}`)));
        if(token!==epoch)return;
        for(const r of runs)runLabels.get(r.id).textContent=`Request ${r.id}: ${r.state}${r.error_code ? ` · ${r.error_code}`:''}`;
        if(runs.some(r=>['queued','running'].includes(r.state)))timer=setTimeout(poll,1500);
        else {let focused=false;for(let n=document.activeElement;n;n=n.parentNode)if(n===body)focused=true;if(!draft && !focused)await load();else say('Generation finished. Reload saved conversation to see the result; your edits are preserved.');}
      } catch(e){if(token===epoch)say(`Status unavailable: ${e.message}. Reload saved conversation to reconnect.`);}
    }
    if(active) timer=setTimeout(poll,1500);
  }
  async function plan(id, versionId, token) {
    const p = await request(`/api/plans/${enc(id)}${versionId ? `?version_id=${enc(versionId)}` : ''}`); if(token!==epoch)return;
    const v=p.version, c=v.content; body.replaceChildren(el('h3',`${p.title} · version ${v.version}`),el('p',`Version ${v.id} · SHA256 ${v.content_hash}`));
    if(p.conversation_id)link(body,'Conversation',`#/ask/${enc(p.conversation_id)}`);
    if(v.parent_version_id)link(body,'Previous version',`#/plans/${enc(id)}/${enc(v.parent_version_id)}`);
    link(body,'Latest version',`#/plans/${enc(id)}/${enc(p.latest_version_id)}`);
    body.append(el('p',`Readiness: ${v.readiness.state} · Blocking: ${v.readiness.blocking_reasons.join(', ') || 'none'} · Warnings: ${v.readiness.warnings.join(', ') || 'none'}`),el('pre',JSON.stringify(v.readiness.source_freshness,null,2)));
    if(!c){body.append(el('p','Plan content unavailable or redacted.'));return;}
    body.append(el('p',`Scope: ${c.repositories.map(r=>`${r.repository_id} (${r.role}) @ ${r.revision} · ${r.snapshot_id}`).join('; ')}`),el('p',`Execution profile: ${c.execution_context.execution_profile_id || 'not configured'} · Publication: ${c.publication.policy} · Limits: server execution profile; not available in M1`));
    citations(body,c.citations,token);
    const edited=structuredClone(c); const readers=[];
    for(const r of c.repositories) button(body,`Retain pinned base for ${r.repository_id}`,()=>{edited.execution_context.base_choices[r.repository_id]='retain';draft=true;say('Pinned base choice retained in draft; save a new version. Regenerate a plan from the conversation to use current context.');});
    for(const key of ['goal','user_request']){const f=field(body,key.replaceAll('_',' '),c[key]);readers.push(()=>edited[key]=f.value);}
    for(const key of ['requirements','risks','assumptions']){const f=field(body,`${key} (one per line)`,c[key].join('\n'));readers.push(()=>edited[key]=f.value.split('\n').filter(x=>x.trim()));}
    for(const [key, fields] of [['steps',['title','description']],['validation',['command','expected']],['open_questions',['text','answer']]]) {
      const group=el('section');group.append(el('h4',key.replaceAll('_',' ')));body.append(group);
      const rows=el('div');group.append(rows);
      const renderRows=()=>{rows.replaceChildren();edited[key].forEach((item,i)=>{
        const row=el('section'); rows.append(row);
        for(const k of fields){const f=field(row,`${i+1}. ${k}`,item[k]);f.addEventListener('input',()=>{edited[key][i][k]=f.value || (k==='answer'?null:'');});}
        if(key==='steps'){const f=field(row,`${i+1}. paths (one per line)`,item.paths.join('\n'));f.addEventListener('input',()=>{item.paths=f.value.split('\n').filter(Boolean);});}
        if(key==='validation'){const label=el('label','Validation source');const select=el('select');for(const value of ['proposed','observed']){const option=el('option',value);option.value=value;select.append(option);}select.value=item.source;select.addEventListener('change',()=>{item.source=select.value;draft=true;});label.append(select);row.append(label);}
        if(key==='open_questions'){const label=el('label','Blocking question');const check=el('input');check.type='checkbox';check.checked=item.blocking;check.addEventListener('change',()=>{item.blocking=check.checked;draft=true;});label.append(check);row.append(label);}
        button(row,'Remove entry',()=>{edited[key].splice(i,1);draft=true;renderRows();});
      });};renderRows();
      button(group,`Add ${key==='open_questions'?'question':key==='steps'?'step':'validation'}`,()=>{edited[key].push(key==='steps'?{title:'',description:'',paths:[],citation_ids:[]}:key==='validation'?{command:'',expected:'',source:'proposed',citation_ids:[]}:{id:globalThis.crypto.randomUUID(),text:'',blocking:true,answer:null});draft=true;renderRows();});
    }
    body.append(el('h4','Findings'),el('pre',c.findings.map(f=>f.text).join('\n')));
    button(body,'Save immutable version',async()=>{readers.forEach(read=>read());const controls=body.querySelectorAll('textarea, input, select');controls.forEach(n=>n.disabled=true);let saved;try{saved=await request(`/api/plans/${enc(id)}/versions`,'POST',{content:edited,parent_version_id:v.id});}finally{controls.forEach(n=>n.disabled=false);}if(token!==epoch)return;draft=false;location.hash=`#/plans/${enc(id)}/${enc(saved.version.id)}`;});
    button(body,'Export this saved version',async()=>{const result=await request(`/api/plans/${enc(id)}/export?version_id=${enc(v.id)}`);if(token!==epoch)return;if(result.content_hash!==v.content_hash || result.plan_version_id!==v.id)throw new Error('Export version/hash mismatch.');body.append(el('p',`Export ${result.plan_version_id} · ${result.content_hash}`),el('pre',result.markdown));});
    const start=button(body,'Start session',async()=>{if(draft)throw new Error('Save edits before starting.');const fresh=await request(`/api/plans/${enc(id)}?version_id=${enc(v.id)}`);if(token!==epoch)return;if(fresh.version.readiness.state!=='ready'||fresh.version.content_hash!==v.content_hash)throw new Error('Readiness changed; reload the saved version.');if(!launchKeys.has(v.id)){let key;try{key=window.sessionStorage?.getItem(`ask-launch-${v.id}`);}catch{}key ||= globalThis.crypto.randomUUID();launchKeys.set(v.id,key);try{window.sessionStorage?.setItem(`ask-launch-${v.id}`,key);}catch{}}const result=await request('/api/sessions','POST',{plan_version_id:v.id,content_hash:v.content_hash,idempotency_key:launchKeys.get(v.id)});if(token!==epoch)return;if(!result.session_id)throw new Error('Session ID missing.');location.hash=`#/sessions/${enc(result.session_id)}`;});start.disabled=v.readiness.state!=='ready';start.title=v.readiness.blocking_reasons.join(', ');const reasons=el('p',`Start session: ${v.readiness.state==='ready'?'server readiness ready':v.readiness.blocking_reasons.join(', ') || v.readiness.state}`);reasons.id='ask-launch-reasons';body.append(reasons);start.setAttribute('aria-describedby',reasons.id);
  }
  async function load() {
    clearTimeout(timer); const token=++epoch; source.replaceChildren();
    const parts=location.hash.split('/');
    if(parts[1]==='plans' && parts[2])return plan(decodeURIComponent(parts[2]),parts[3] ? decodeURIComponent(parts[3]):null,token);
    if(parts[1]==='ask' && parts[2])return conversation(decodeURIComponent(parts[2]),token);
    body.replaceChildren(el('p','Choose a saved conversation or create one. Ask only plans; it does not execute changes.'));
  }
  window.addEventListener('hashchange',()=>{if(location.hash===acceptedHash)return;if(!guard()){window.history.replaceState(null,'',acceptedHash);return;}draft=false;acceptedHash=location.hash;load().catch(say);});
  await refreshHistory();await load();
  return {panel, current:()=>current, canNavigate:()=>{if(location.hash===acceptedHash)return true;if(!guard()){window.history.replaceState(null,'',acceptedHash);return false;}draft=false;return true;}};
}
async function http(path,method='GET',body) {
  const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await response.json();if(!response.ok)throw new Error(typeof value.error==='string'?value.error:value.error?.message || value.message || value.code || `HTTP ${response.status}`);return value;
}
