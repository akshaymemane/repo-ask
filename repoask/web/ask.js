import { limitsText } from "./sessions.js";
// Persistent Ask consumes the frozen AskAPI; source and model output are always text.
const el = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
const enc = encodeURIComponent;
const destinationText = d => d && typeof d === 'object' ? `${d.kind || 'unknown'}${d.host ? ` · ${d.host}` : d.disclosure ? ` · ${d.disclosure}` : ''}` : 'unknown';
const coverageText = c => c && typeof c === 'object' ? [Number.isFinite(c.files) ? `${c.files} files` : null, Number.isFinite(c.chunks) ? `${c.chunks} chunks` : null, c.mode ? c.mode.replaceAll('_',' ') : null, c.partial === true ? 'partial coverage' : null].filter(Boolean).join(' · ') || 'unknown' : 'unknown';

export async function createAskPanel({host, request = http, onMount = () => {}}) {
  let listing, initialHistoryError;
  try {
    listing = await request('/api/conversations');
    if (!Array.isArray(listing?.items)) throw new Error('Unsupported conversation history response.');
  } catch (error) {
    if (error.status === 404) return null; // Only a missing API uses legacy Ask.
    initialHistoryError = error;
  }
  const panel = el('main'); panel.className = 'persistent-ask';
  const title=el('h1','Ask · saved planning');title.id='persistent-ask-title';title.setAttribute('tabindex','-1');panel.setAttribute('aria-labelledby',title.id);
  const status = el('p'); status.setAttribute('role', 'status');
  const history = el('nav'); history.setAttribute('aria-label', 'Saved conversations');
  const pendingNotice=el('div');
  const body = el('div'); const source = el('aside'); source.setAttribute('aria-label', 'Snapshot source');
  panel.append(title, status, history, pendingNotice, body, source); host.append(panel);
  let sourceEpoch=0;
  let epoch = 0, current = null, draft = false, pending = false, timer, acceptedHash = location.hash;
  let sendAttempt = null;
  try { sendAttempt = JSON.parse(window.sessionStorage?.getItem('ask-pending-send') || 'null'); } catch {}
  const persistAttempt = () => { try { if(sendAttempt) window.sessionStorage?.setItem('ask-pending-send',JSON.stringify(sendAttempt)); else window.sessionStorage?.removeItem('ask-pending-send'); } catch {} }; const launchKeys = new Map(); const promptDrafts=new Map(); const scopeDrafts=new Map();
  const say = error => { status.textContent = error instanceof Error ? error.message : error; };
  const inside = (parent, child) => { for (let n=child;n;n=n.parentNode) if(n===parent)return true; return false; };
  const button = (parent, text, fn) => {
    const b = el('button', text); b.type = 'button';
    const token = inside(body,parent) || inside(source,parent) ? epoch : null;
    b.addEventListener('click', async () => {
      if(b.disabled || !b.isConnected || (token!==null && token!==epoch))return;
      const focused=document.activeElement===b, hash=location.hash;
      b.disabled=true;
      try { await fn(b); } catch(e) { if(token===null || hash===location.hash)say(e); }
      finally {
        b.disabled=false;
        if(focused && location.hash===hash && (document.activeElement===document.body || document.activeElement===b || !document.activeElement?.isConnected)){
          const target=b.isConnected ? b : [...body.querySelectorAll('button')].find(n=>n.textContent===text && !n.hidden && !n.disabled);
          if(target)target.focus();
          else {const heading=body.querySelector('h3');if(heading){heading.setAttribute('tabindex','-1');heading.focus();}}
        }
      }
    }); parent.append(b); return b;
  };
  const link = (parent, text, hash) => { const a = el('a', text); a.setAttribute('href', hash); parent.append(a); };
  const field = (parent, label, value, dirty=true) => { const wrap = el('label', label); const input = el('textarea'); input.value = value || ''; if(dirty)input.addEventListener('input', () => { draft = true; }); wrap.append(input); parent.append(wrap); return input; };
  const guard = () => !draft || window.confirm('Discard unsaved Ask or plan edits?');
  function discardDraft(){if(current){promptDrafts.delete(current.id);scopeDrafts.delete(current.id);}draft=false;}
  function renderPending(){
    pendingNotice.replaceChildren();if(!sendAttempt)return;
    pendingNotice.append(el('p',`Unconfirmed request for ${sendAttempt.conversation}. Retry the same request to reconcile it, or explicitly discard the pending client attempt. Discard does not cancel a request the server may already have accepted.`));
    link(pendingNotice,'Open pending conversation',`#/ask/${enc(sendAttempt.conversation)}`);
    button(pendingNotice,'Discard pending request',()=>{sendAttempt=null;persistAttempt();renderPending();say('Pending client attempt discarded. Draft text is preserved; any accepted server request is unchanged.');});
  }
  window.addEventListener('beforeunload', e => { if (draft) { e.preventDefault(); e.returnValue = ''; } });
  let historyGeneration=0;
  async function refreshHistory(cursor, supplied) {
    const generation=++historyGeneration;
    if(!cursor){history.replaceChildren();button(history, 'New saved conversation', async () => { if (!guard()) return; const c = await request('/api/conversations', 'POST', {}); discardDraft(); location.hash = `#/ask/${enc(c.id)}`; });}
    try {
      const page = supplied || await request(`/api/conversations${cursor ? `?cursor=${enc(cursor)}`:''}`);
      if(generation!==historyGeneration)return;
      if(!Array.isArray(page?.items))throw new Error('Unsupported conversation history response.');
      const existing=new Set([...history.querySelectorAll('a')].map(a=>a.getAttribute('href')));
      for (const c of page.items){const hash=`#/ask/${enc(c.id)}`;if(!existing.has(hash)){link(history,c.title || c.id,hash);existing.add(hash);}}
      if (page.next_cursor) button(history, 'More conversations', async b => {await refreshHistory(page.next_cursor);b.remove();});
    } catch(error) {
      if(generation!==historyGeneration)return;
      history.append(el('p',`Conversation history unavailable: ${error.message}`));
      button(history,'Retry conversation history',()=>refreshHistory());
    }
  }
  async function cite(c, token, trigger) {
    const sourceToken=++sourceEpoch; source.replaceChildren(el('p', 'Loading exact snapshot…'));
    try {
      const q = new URLSearchParams(); for (const key of ['repository_id','snapshot_id','path','start_line','end_line']) q.set(key, c[key]);
      const s = await request(`/api/context/source?${q}`);
      if (token !== epoch || sourceToken!==sourceEpoch) return;
      source.replaceChildren(el('h3', `${s.repository_id} · ${s.revision} · ${s.path}`), el('pre', s.lines.map((line, i) => `${s.first_line + i}  ${line}`).join('\n')));
      button(source, 'Close source', () => {sourceEpoch++;source.replaceChildren();if(trigger?.isConnected)trigger.focus();});
    } catch (e) { if (token === epoch && sourceToken===sourceEpoch) source.replaceChildren(el('p', `Source unavailable: ${e.message}`)); }
  }
  function citations(parent, list, token) { for (const c of list || []) button(parent, `${c.repository_id} · ${c.path}:${c.start_line}–${c.end_line} @ ${c.revision}`, trigger => cite(c, token, trigger)); }
  async function conversation(id, token) {
    const c = await request(`/api/conversations/${enc(id)}`); if (token !== epoch) return;
    current = c; body.replaceChildren(el('h3', c.title || 'Conversation'));
    body.append(el('p', `Scope revision ${c.scope_revision}: ${(c.repository_ids || []).join(', ') || 'Unscoped; route a question or choose repositories'}`));
    const details=el('section'); body.append(details);
    Promise.allSettled((c.repository_ids || []).map(r=>request(`/api/repositories/${enc(r)}/context`))).then(results=>{
      if(token!==epoch)return;
      results.forEach((result,i)=>{if(result.status==='fulfilled'){
        const r=result.value;details.append(el('p',`${r.name} · ${r.repository_id} · ${r.status} · Base ${r.active_snapshot?.revision || 'not indexed'} · Coverage ${coverageText(r.active_snapshot?.coverage)} · Implementation ${r.implementation_enabled?'enabled':'disabled'}`));
      }else details.append(el('p',`${c.repository_ids[i]} · repository context unavailable. Scope is retained; reload or adjust scope explicitly.`));});
    });
    request('/api/settings/model-roles').then(settings=>{if(token!==epoch)return;details.append(el('p',`Local-only policy: ${settings.settings?.local_only===true?'enabled':settings.settings?.local_only===false?'disabled':'unknown'}`));for(const role of ['ask','planning']){const r=settings.roles?.[role] || {};details.append(el('p',`${role} model: ${r.model || 'unknown'} · ${r.status || 'unknown'} · Destination: ${destinationText(r.destination)} · Usage and cost: unknown until returned`));}}).catch(()=>{if(token===epoch)details.append(el('p','Model configuration unavailable · destination, usage and cost unknown. See Settings.'));});
    const scope = field(body, 'Repository IDs (one per line; explicit manual scope)', scopeDrafts.get(id) ?? (c.repository_ids || []).join('\n'));
    scope.addEventListener('input',()=>scopeDrafts.set(id,scope.value));
    if(scopeDrafts.has(id))draft=true;
    button(body, 'Save repository scope', async () => { await request(`/api/conversations/${enc(id)}`, 'PATCH', {repository_ids: scope.value.split('\n').map(x=>x.trim()).filter(Boolean), expected_revision:c.scope_revision}); if(token===epoch){scopeDrafts.delete(id);draft = false; await load();} });
    const catalogQuery=field(body,'Find repositories by name','',false);
    const catalog=el('section');body.append(catalog);
    let catalogCursor=null, catalogGeneration=0;
    async function browse(append=false){
      const generation=++catalogGeneration;
      if(!append)catalog.replaceChildren(el('p','Loading repositories…'));
      const page=await request(`/api/context/repositories?query=${enc(catalogQuery.value)}${append && catalogCursor ? `&cursor=${enc(catalogCursor)}`:''}`);
      if(token!==epoch || generation!==catalogGeneration)return;
      if(!append)catalog.replaceChildren();catalogCursor=page.next_cursor;
      const existing=new Set([...catalog.querySelectorAll('input')].map(n=>n.dataset.repository));
      for(const r of page.items){
        if(existing.has(r.repository_id))continue;
        const label=el('label',`${r.name} · ${r.status} · ${r.repository_id}`);const check=el('input');check.type='checkbox';check.dataset.repository=r.repository_id;
        check.checked=scope.value.split('\n').includes(r.repository_id);check.disabled=!r.eligible;
        check.addEventListener('change',()=>{const ids=new Set(scope.value.split('\n').filter(Boolean));if(check.checked)ids.add(r.repository_id);else ids.delete(r.repository_id);scope.value=[...ids].join('\n');scopeDrafts.set(id,scope.value);draft=true;});label.append(check);catalog.append(label);
      }
      if(catalogCursor)button(catalog,'More repositories',async b=>{await browse(true);b.remove();});
    }
    button(body,'Browse repository scope',()=>browse());
    const transcript = el('div'); body.append(transcript);
    const showMessages = messages => { for (const m of messages) {
      const box = el('article');
      box.append(el('h4', `${m.role} · ${m.state}`), el('p', m.content || m.error_code || 'Waiting for generation'));
      const generation=m.generation || m.generation_metadata || {};
      const usage=m.usage || generation.usage;
      const knownUsage=usage && Object.values(usage).some(value=>value!==null && value!==undefined);
      const cost=typeof usage?.estimated_cost==='number' ? `${usage.cost_status || 'estimated'} ${usage.estimated_cost} USD` : 'unknown';
      box.append(el('p', `Model: ${m.model || generation.model || 'unknown'} · Destination: ${destinationText(m.destination || generation.destination)} · Usage: ${knownUsage ? JSON.stringify(usage) : 'unknown'} · Cost: ${cost}`));
      citations(box,m.citations,token);transcript.append(box);
    } };
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
      const r = await request('/api/route','POST',{prompt:prompt.value,conversation_id:id,pinned_repository_ids:[...new Set([...(c.repository_ids || []),...scope.value.split('\n').map(x=>x.trim()).filter(Boolean)])]}); if(token!==epoch)return;
      const results = el('section'); results.append(el('h4', `Routing: ${r.status}`),el('p',r.question || r.next_action || ''),el('p',r.degradation_code || ''));
      for(const candidate of r.candidates) { results.append(el('p',`${candidate.name}: ${candidate.reason} · Coverage ${coverageText(candidate.coverage)} · Freshness ${candidate.freshness || 'unknown'} · Implementation ${candidate.implementation_enabled ? 'enabled' : 'disabled'}`)); citations(results,candidate.citations,token); button(results,`Use ${candidate.name}`,()=>{const pins=new Set([...(c.repository_ids || []),...scope.value.split('\n').map(x=>x.trim()).filter(Boolean),candidate.repository_id]);scope.value=[...pins].join('\n');scopeDrafts.set(id,scope.value);draft=true;say('Candidate added to scope draft; existing pins and edits retained. Save repository scope to confirm.');scope.focus();}); } body.append(results);
    });
    async function send(intent) {
      if(pending || !prompt.value.trim())return;
      if(JSON.stringify(scope.value.split('\n').map(x=>x.trim()).filter(Boolean))!==JSON.stringify(c.repository_ids || []))throw new Error('Save repository scope before generating.');
      const content=prompt.value.trim();
      if(sendAttempt && (sendAttempt.content!==content || sendAttempt.intent!==intent || sendAttempt.conversation!==id)) throw new Error('Resolve the uncertain request by retrying the same content and action before submitting another.');
      sendAttempt ||= {conversation:id,content,intent,client_request_id:globalThis.crypto.randomUUID()}; persistAttempt(); pending=true;prompt.disabled=true;
      renderPending();
      try {
        await request(`/api/conversations/${enc(id)}/messages`,'POST',{content,intent,client_request_id:sendAttempt.client_request_id});
      } catch(error) {
        if(error.status>=400 && error.status<500){sendAttempt=null;persistAttempt();renderPending();}
        throw error;
      } finally {pending=false;prompt.disabled=false;}
      sendAttempt=null;persistAttempt();renderPending();promptDrafts.delete(id);
      if(token===epoch){draft=false;await load();}await refreshHistory();
    }
    const active = (c.runs || []).some(r=>['queued','running'].includes(r.state));
    button(body,'Ask',()=>send('answer')).disabled=active;
    button(body,'Generate plan',()=>send('plan')).disabled=active;
    button(body,'Reload saved conversation',()=>{if(guard()){discardDraft();return load();}});
    async function poll() {
      try {
        const runs=await Promise.all((c.runs || []).filter(r=>['queued','running'].includes(r.state)).map(r=>request(`/api/answer-runs/${enc(r.id)}`)));
        if(token!==epoch)return;
        for(const r of runs)runLabels.get(r.id).textContent=`Request ${r.id}: ${r.state}${r.error_code ? ` · ${r.error_code}`:''}`;
        if(runs.some(r=>['queued','running'].includes(r.state)))timer=setTimeout(poll,1500);
        else {
          const focused=document.activeElement;
          const editing=['INPUT','TEXTAREA','SELECT'].includes(focused?.tagName) || focused?.isContentEditable;
          const within=inside(body,focused);
          if(!draft && !editing){await load();if(within && token+1===epoch){const heading=body.querySelector('h3');if(heading){heading.setAttribute('tabindex','-1');heading.focus();}}}
          else say('Generation finished. Reload saved conversation to see the result; your edits are preserved.');
        }
      } catch(e){if(token===epoch)say(`Status unavailable: ${e.message}. Reload saved conversation to reconnect.`);}
    }
    if(active) timer=setTimeout(poll,1500);
  }
  async function plan(id, versionId, token) {
    const p = await request(`/api/plans/${enc(id)}${versionId ? `?version_id=${enc(versionId)}` : ''}`); if(token!==epoch)return;
    const v=p.version, c=v.content; body.replaceChildren(el('h3',`${p.title} · version ${v.version}`),el('p',`Version ${v.id} · SHA256 ${v.content_hash}`));
    const generation=v.generation || {};body.append(el('p',`Plan model: ${generation.model || 'unknown'} · Destination: ${destinationText(generation.destination)} · Usage: ${generation.usage ? Object.entries(generation.usage).filter(([key,value])=>['input_tokens','output_tokens','total_tokens'].includes(key)&&Number.isFinite(value)).map(([key,value])=>`${key.replaceAll('_',' ')} ${value}`).join(' · ') || 'unknown':'unknown'} · Cost: ${typeof generation.usage?.estimated_cost==='number' ? `${generation.usage.cost_status || 'estimated'} ${generation.usage.estimated_cost} USD`:'unknown'}`));
    if(p.conversation_id)link(body,'Conversation',`#/ask/${enc(p.conversation_id)}`);
    if(v.parent_version_id)link(body,'Previous version',`#/plans/${enc(id)}/${enc(v.parent_version_id)}`);
    link(body,'Latest version',`#/plans/${enc(id)}/${enc(p.latest_version_id)}`);
    body.append(el('p',`Readiness: ${v.readiness.state} · Blocking: ${v.readiness.blocking_reasons.join(', ') || 'none'} · Warnings: ${v.readiness.warnings.join(', ') || 'none'}`),el('p',`Source freshness: ${Object.entries(v.readiness.source_freshness || {}).map(([repository,value])=>`${repository}: ${String(value).replaceAll('_',' ')}`).join(' · ') || 'unknown'}`));
    if(!c){body.append(el('p','Plan content unavailable or redacted.'));return;}
    body.append(el('p',`Scope: ${c.repositories.map(r=>`${r.repository_id} (${r.role}) @ ${r.revision} · ${r.snapshot_id}`).join('; ')}`),el('p',`Execution profile: ${c.execution_context.execution_profile_id || 'not configured'} · Publication: ${c.publication.policy}`));
    citations(body,c.citations,token);
    const execution=v.readiness.execution;
    const executionBox=el('section');executionBox.className='setting-box';executionBox.append(el('h4','Execution preflight for this saved version'));
    if(execution){
      executionBox.append(el('p',`Profile ${execution.profile_id || 'unknown'} · Immutable version ${execution.profile_version_id || 'unknown'}`),el('p',`Image ${execution.image_id || 'unknown'} · CLI ${execution.cli_version || 'unknown'} · Destination ${destinationText(execution.destination)}`),el('p',limitsText(execution.limits)),el('p',`Verified capabilities: ${Object.entries(execution.capabilities || {}).filter(([,value])=>value===true).map(([key])=>key.replaceAll('_',' ')).join(', ') || 'none reported'}`));
    }else executionBox.append(el('p','Execution preflight is unavailable. Review server readiness below; configure and test an execution profile in Settings.'));
    body.append(executionBox);
    const edited=structuredClone(c); const readers=[];
    const profileLabel=el('label','Execution profile for the next immutable version');const profileSelect=el('select');profileSelect.disabled=true;profileLabel.append(profileSelect);body.append(profileLabel);
    const profileStatus=el('p','Loading execution profiles…');body.append(profileStatus);
    const publicationLabel=el('label','Publication policy for the next immutable version');const publicationSelect=el('select');
    for(const [value,text] of [['manual_draft','Manual draft PR — explicitly choose publication after review'],['on_success_draft','Automatic draft PR after success — authorizes a remote branch and draft PR']]){const option=el('option',text);option.value=value;publicationSelect.append(option);}publicationSelect.value=c.publication.policy;publicationLabel.append(publicationSelect);body.append(publicationLabel);
    publicationSelect.addEventListener('change',()=>{edited.publication.policy=publicationSelect.value;draft=true;say('Publication policy changed in draft. Save an immutable version before starting.');});
    body.append(el('p',c.publication.policy==='on_success_draft'?'This saved version authorizes a remote branch and draft pull request after the server confirms the required success and publication checks. Publication capability and policy are rechecked by the server.':'This saved version requires an explicit publication action after review. Starting implementation alone does not authorize a remote branch or pull request.'));

    const unassigned=el('option','Unassigned');unassigned.value='';profileSelect.append(unassigned);
    const selectedProfile=c.execution_context.execution_profile_id;
    if(selectedProfile){const opt=el('option',`Saved profile ${selectedProfile}`);opt.value=selectedProfile;profileSelect.append(opt);}profileSelect.value=selectedProfile || '';
    profileSelect.addEventListener('change',()=>{edited.execution_context.execution_profile_id=profileSelect.value || null;draft=true;profileStatus.textContent='Profile changed in draft. Save a new immutable version to recalculate execution readiness.';});
    // A failed or late profile read must not discard the saved plan or user edits.
    (async()=>{try{let cursor=null;const seen=new Set(selectedProfile?[selectedProfile]:[]);do{const page=await request(`/api/execution-profiles?limit=100${cursor?`&cursor=${enc(cursor)}`:''}`);if(token!==epoch)return;if(!Array.isArray(page.items))throw new Error('Unsupported execution profile response.');for(const profile of page.items){if(seen.has(profile.id)){const existing=[...profileSelect.querySelectorAll('option')].find(o=>o.value===profile.id);if(existing)existing.textContent=`${profile.name} · v${profile.version.version} · test ${profile.check?.status || 'not tested'}`;continue;}seen.add(profile.id);const option=el('option',`${profile.name} · v${profile.version.version} · test ${profile.check?.status || 'not tested'}`);option.value=profile.id;profileSelect.append(option);}cursor=page.next_cursor;}while(cursor);if(token!==epoch)return;profileSelect.disabled=false;profileStatus.textContent='Choose an execution profile, then save a new version. The server pins its exact version and rechecks policy and readiness before launch.';}catch(e){if(token===epoch)profileStatus.textContent=`Execution profile selection unavailable: ${e.message}. Saved plan fields remain editable.`;}})();
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
    const exportDisplay=el('section');body.append(exportDisplay);
    button(body,'Export this saved version',async()=>{const result=await request(`/api/plans/${enc(id)}/export?version_id=${enc(v.id)}`);if(token!==epoch)return;if(result.content_hash!==v.content_hash || result.plan_version_id!==v.id)throw new Error('Export version/hash mismatch.');exportDisplay.replaceChildren(el('p',`Export ${result.plan_version_id} · ${result.content_hash}`),el('pre',result.markdown));});
    const start=button(body,'Start session',async()=>{
      if(draft)throw new Error('Save edits before starting.');
      const fresh=await request(`/api/plans/${enc(id)}?version_id=${enc(v.id)}`);if(token!==epoch)return;
      if(fresh.version.readiness.state!=='ready'||fresh.version.content_hash!==v.content_hash)throw new Error('Readiness changed; reload the saved version.');
      if(!launchKeys.has(v.id)){let key;try{key=window.sessionStorage?.getItem(`ask-launch-${v.id}`);}catch{}key ||= globalThis.crypto.randomUUID();launchKeys.set(v.id,key);try{window.sessionStorage?.setItem(`ask-launch-${v.id}`,key);}catch{}}
      try {
        const result=await request('/api/sessions','POST',{plan_version_id:v.id,content_hash:v.content_hash,idempotency_key:launchKeys.get(v.id)});
        if(token!==epoch)return;if(!result.session_id)throw new Error('Session outcome unknown. Retry Start with the same saved version to reconcile.');location.hash=`#/sessions/${enc(result.session_id)}`;
      }catch(e){if(e.status>=400&&e.status<500){launchKeys.delete(v.id);try{window.sessionStorage?.removeItem(`ask-launch-${v.id}`);}catch{}}throw e;}
    });
    start.disabled=v.readiness.state!=='ready';start.title=v.readiness.blocking_reasons.join(', ');
    const reasons=el('p',`Start session: ${v.readiness.state==='ready'?'server readiness ready':v.readiness.blocking_reasons.join(', ') || v.readiness.state}`);reasons.id='ask-launch-reasons';body.append(reasons);start.setAttribute('aria-describedby',reasons.id);
  }
  async function load() {
    clearTimeout(timer); const token=++epoch; sourceEpoch++; current=null;
    // Retire controls immediately: the URL must never operate on the previous record.
    source.replaceChildren();body.replaceChildren(el('p','Loading saved Ask…'));
    const parts=location.hash.split('/');
    try {
      if(parts[1]==='plans' && parts[2])await plan(decodeURIComponent(parts[2]),parts[3] ? decodeURIComponent(parts[3]):null,token);
      else if(parts[1]==='ask' && parts[2])await conversation(decodeURIComponent(parts[2]),token);
      else body.replaceChildren(el('p','Choose a saved conversation or create one. Ask only plans; it does not execute changes.'));
    } catch(error) {
      if(token!==epoch)return;
      body.replaceChildren(el('h3',parts[1]==='plans'?'Plan unavailable':'Conversation unavailable'),el('p',error.message));
      button(body,'Retry saved page',()=>load());link(body,'Conversation history','#/ask');
      say(`Saved page unavailable: ${error.message}`);
    }
  }
  window.addEventListener('hashchange',()=>{if(location.hash===acceptedHash)return;if(!guard()){window.history.replaceState(null,'',acceptedHash);return;}discardDraft();acceptedHash=location.hash;load();});
  const handle={panel, focus:()=>title.focus(), current:()=>current, canNavigate:()=>{if(location.hash===acceptedHash)return true;if(!guard()){window.history.replaceState(null,'',acceptedHash);return false;}discardDraft();return true;}};
  onMount(handle);
  renderPending();
  if(initialHistoryError){
    history.append(el('p',`Conversation history unavailable: ${initialHistoryError.message}`));
    button(history,'Retry conversation history',()=>refreshHistory());
    button(history,'New saved conversation',async()=>{if(!guard())return;const c=await request('/api/conversations','POST',{});discardDraft();location.hash=`#/ask/${enc(c.id)}`;});
  }else await refreshHistory(null,listing);
  await load();
  return handle;
}
async function http(path,method='GET',body) {
  const response=await fetch(path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let value;
  try {value=await response.json();}catch(error){if(response.ok)throw error;}
  if(!response.ok){const error=new Error(typeof value?.error==='string'?value.error:value?.error?.message || value?.message || value?.code || `HTTP ${response.status}`);error.status=response.status;error.code=value?.code || value?.error?.code;throw error;}
  return value;
}
