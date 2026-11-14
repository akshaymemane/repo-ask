import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrowser,install,input,settle,visibleText} from './dom.mjs';
import {createAskPanel} from '../../repoask/web/ask.js';
const html=readFileSync(new URL('../../repoask/web/index.html',import.meta.url),'utf8');
const conversation=(id='a',extra={})=>({id,title:`Conversation ${id}`,scope_revision:1,repository_ids:[],messages:[],runs:[],plans:[],...extra});
const plan=()=>({id:'p',title:'Plan',latest_version_id:'v',version:{id:'v',version:1,content_hash:'hash',content:{goal:'Goal',user_request:'Request',repositories:[],citations:[],findings:[],requirements:['R'],steps:[],validation:[],risks:[],assumptions:[],open_questions:[],execution_context:{execution_profile_id:'execution-1',base_choices:{}},publication:{policy:'manual_draft'}},readiness:{state:'ready',blocking_reasons:[],warnings:[],source_freshness:{}}}});
const missing={status:404,body:{code:'not_found'}};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
let imports=0;
async function boot(respond,{hash='#/ask/a',sessionStorage=storage(),app=false}={}){
 const b=createBrowser(html,{hash,respond});b.window.sessionStorage=sessionStorage;b.window.confirm=()=>true;install(b);
 let panel,ui;
 if(app){await import(new URL(`../../repoask/web/app.js?recovery=${++imports}`,import.meta.url));await settle();panel=b.document.querySelector('.persistent-ask');}
 else {ui=await createAskPanel({host:b.document.getElementById('view-ask')});panel=ui?.panel;}
 const button=t=>panel.querySelectorAll('button').find(n=>n.textContent===t);
 const field=t=>panel.querySelectorAll('label').find(n=>n.textContent.startsWith(t))?.querySelector('textarea');
 return {...b,panel,ui,button,field,text:()=>visibleText(panel)};
}

test('definite 4xx clears pending identity, keeps the draft and permits corrected/new-conversation sends',async()=>{
 for(const rejection of [400,401,403,404,409,422]){
  const attempts=[];
  const b=await boot((m,u,o)=>{
   if(u==='/api/conversations')return {items:[conversation()]};
   if(u==='/api/conversations/a')return conversation();if(u==='/api/conversations/b')return conversation('b');
   if(m==='POST' && u.endsWith('/messages')){attempts.push(JSON.parse(o.body));return attempts.length===1?{status:rejection,body:{message:'Definite rejection'}}:{id:'run',state:'queued'};}
   return missing;
  });
  input(b.field('Question'),'Original draft');b.button('Ask').click();await settle();
  assert.match(b.text(),/Definite rejection/);assert.equal(b.field('Question').value,'Original draft');assert.equal(b.button('Discard pending request'),undefined);assert.equal(b.window.sessionStorage.getItem('ask-pending-send'),null);
  input(b.field('Question'),'Corrected draft');b.button('Ask').click();await settle();assert.notEqual(attempts[0].client_request_id,attempts[1].client_request_id);
  b.window.location.hash='#/ask/b';await settle();input(b.field('Question'),'Other conversation');b.button('Ask').click();await settle();assert.equal(attempts.length,3);
 }
});

test('network/5xx ambiguity preserves client ID across reload; explicit discard preserves draft and permits a new attempt',async()=>{
 for(const kind of ['network','5xx']){
  const sessionStorage=storage(), attempts=[];
  const respond=(m,u,o)=>{
   if(u==='/api/conversations')return {items:[conversation()]};if(u==='/api/conversations/a')return conversation();
   if(u.endsWith('/messages')){attempts.push(JSON.parse(o.body));if(kind==='network')throw new Error('Network lost');return {status:503,body:{message:'Service unavailable'}};}
   return missing;
  };
  let b=await boot(respond,{sessionStorage});input(b.field('Question'),'Keep ambiguous draft');b.button('Ask').click();await settle();
  assert.ok(b.button('Discard pending request'));assert.ok(sessionStorage.getItem('ask-pending-send'));
  b=await boot(respond,{sessionStorage});assert.equal(b.field('Question').value,'Keep ambiguous draft');b.button('Ask').click();await settle();assert.equal(attempts[0].client_request_id,attempts[1].client_request_id);
  b.button('Discard pending request').click();await settle();assert.equal(b.field('Question').value,'Keep ambiguous draft');assert.equal(sessionStorage.getItem('ask-pending-send'),null);
  input(b.field('Question'),'New deliberate request');b.button('Ask').click();await settle();assert.notEqual(attempts[1].client_request_id,attempts[2].client_request_id);
 }
});

test('first history failure keeps one working persistent workspace and recovers history and saved URL',async()=>{
 let historyFails=true,pageFails=true;
 const b=await boot((m,u)=>{
  if(u==='/api/repos')return {repos:[],model:null};
  if(u==='/api/conversations'){if(historyFails)return {status:503,body:{message:'History offline'}};return {items:[conversation()]};}
  if(u==='/api/conversations/a'){if(pageFails)throw new Error('Saved URL offline');return conversation();}
  return missing;
 },{app:true});
 assert.ok(b.panel);assert.equal(b.document.querySelectorAll('.persistent-ask').length,1);assert.equal(b.document.getElementById('thread').parentNode.hidden,true);
 assert.match(b.text(),/Conversation history unavailable/);assert.match(b.text(),/Conversation unavailable/);assert.equal(b.button('Ask'),undefined);
 historyFails=false;b.button('Retry conversation history').click();await settle();assert.equal(b.panel.querySelectorAll('a').filter(n=>n.getAttribute('href')==='#/ask/a').length,1);
 pageFails=false;b.button('Retry saved page').click();await settle();assert.ok(b.button('Ask'));assert.match(b.text(),/Conversation a/);
});

test('missing saved conversation/plan URL and malformed/non-404 history keep recoverable panels',async()=>{
 for(const hash of ['#/ask/missing','#/plans/p/v']){
  for(const status of [404,500]){
   let recover=false;
   const b=await boot((m,u)=>{
    if(u==='/api/conversations')return {items:[]};
    if(u.startsWith('/api/plans/') || u==='/api/conversations/missing')return recover?(hash.includes('plans')?plan():conversation('missing')):{status,body:{message:'Saved page missing'}};
    return missing;
   },{hash});
   assert.ok(b.panel);assert.match(b.text(),/unavailable/);assert.equal(b.button('Ask'),undefined);assert.equal(b.button('Start session'),undefined);
   recover=true;b.button('Retry saved page').click();await settle();assert.ok(b.button(hash.includes('plans')?'Save immutable version':'Ask'));
  }
 }
 for(const value of [{}, {status:500,body:{message:'Offline'}}]){
  const b=await boot((m,u)=>u==='/api/conversations'?value:missing,{hash:'#/ask'});assert.ok(b.panel);assert.ok(b.button('Retry conversation history'));
 }
});

test('navigation clears stale Ask and plan actions during delayed/error GETs and rejects detached buttons',async()=>{
 for(const hash of ['#/ask/a','#/plans/p/v']){
  let reject,lateResolve;const writes=[];
  const b=await boot((m,u,o)=>{
   if(m!=='GET'){writes.push({m,u});return {};}
   if(u==='/api/conversations')return {items:[conversation()]};if(u==='/api/conversations/a')return conversation();if(u.startsWith('/api/plans/'))return plan();
   if(u==='/api/conversations/b')return new Promise((resolve,rejectFn)=>{reject=rejectFn;lateResolve=resolve;});
   return missing;
  },{hash});
  const old=hash.includes('plans')?[b.button('Save immutable version'),b.button('Start session')]:[b.button('Ask'),b.button('Save repository scope')];
  b.window.location.hash='#/ask/b';await settle();assert.match(b.text(),/Loading saved Ask/);for(const button of old)button.click();await settle();assert.deepEqual(writes,[]);
  reject(new Error('B unavailable'));await settle();assert.match(b.text(),/Conversation unavailable/);for(const button of old)button.click();await settle();assert.deepEqual(writes,[]);
  b.button('Retry saved page').click();await settle();b.window.location.hash='#/ask/a';await settle();lateResolve(conversation('b'));await settle();assert.match(b.text(),/Conversation a/);assert.doesNotMatch(b.text(),/Conversation b/);
 }
});

test('history/catalog pagination deduplicates links and consumes previous page controls',async()=>{
 const repo=(id)=>({repository_id:id,name:id,status:'ready',eligible:true});
 const b=await boot((m,u)=>{
  if(u==='/api/conversations')return {items:[conversation()],next_cursor:'next'};
  if(u==='/api/conversations?cursor=next')return {items:[conversation(),conversation('b')],next_cursor:null};
  if(u==='/api/conversations/a')return conversation();
  if(u==='/api/context/repositories?query=')return {items:[repo('r1')],next_cursor:'next'};
  if(u==='/api/context/repositories?query=&cursor=next')return {items:[repo('r1'),repo('r2')],next_cursor:null};
  return missing;
 });
 const more=b.button('More conversations');more.click();await settle();more.click();await settle();assert.equal(b.panel.querySelectorAll('button').filter(n=>n.textContent==='New saved conversation').length,1);assert.equal(b.button('More conversations'),undefined);assert.equal(b.panel.querySelectorAll('a').filter(n=>n.getAttribute('href')==='#/ask/a').length,1);
 b.button('Browse repository scope').click();await settle();const moreRepos=b.button('More repositories');moreRepos.click();await settle();moreRepos.click();await settle();assert.equal(b.button('More repositories'),undefined);assert.equal(b.panel.querySelectorAll('input').length,2);
});

test('search is not dirty, confirmed discard removes prompt/scope drafts, missing scoped repos are visible',async()=>{
 const c=conversation('a',{repository_ids:['unavailable']});let confirms=0;
 const b=await boot((m,u)=>u==='/api/conversations'?{items:[c]}:u==='/api/conversations/a'?c:missing);
 b.window.confirm=()=>{confirms++;return true;};await settle();assert.match(b.text(),/unavailable · repository context unavailable/);
 input(b.field('Find repositories'),'query');b.window.location.hash='#/ask';await settle();assert.equal(confirms,0);
 b.window.location.hash='#/ask/a';await settle();input(b.field('Question'),'discard me');input(b.field('Repository IDs'),'draft-scope');b.window.location.hash='#/ask';await settle();assert.equal(confirms,1);
 b.window.location.hash='#/ask/a';await settle();assert.equal(b.field('Question').value,'');assert.equal(b.field('Repository IDs').value,'unavailable');
});

test('Use candidate stages union with explicit pins and scope drafts, then scope save restores focus',async()=>{
 let c=conversation('a',{repository_ids:['pin']});const mutations=[];
 const b=await boot((m,u,o)=>{
  if(u==='/api/conversations')return {items:[c]};
  if(u==='/api/conversations/a'){if(m==='PATCH'){mutations.push(JSON.parse(o.body));c={...c,repository_ids:mutations.at(-1).repository_ids,scope_revision:2};}return c;}
  if(u==='/api/route'){assert.deepEqual(JSON.parse(o.body).pinned_repository_ids,['pin','draft']);return {status:'needs_selection',candidates:[{name:'Candidate',repository_id:'suggested',reason:'Observed match'}]};}
  return missing;
 });
 input(b.field('Repository IDs'),'draft');input(b.field('Question'),'request');b.button('Find repository candidates').click();await settle();b.button('Use Candidate').click();await settle();
 assert.deepEqual(b.field('Repository IDs').value.split('\n'),['pin','draft','suggested']);assert.equal(mutations.length,0);assert.equal(b.document.activeElement,b.field('Repository IDs'));
 b.button('Save repository scope').focus();b.button('Save repository scope').click();await settle();assert.deepEqual(mutations[0].repository_ids,['pin','draft','suggested']);assert.equal(b.document.activeElement,b.button('Save repository scope'));assert.equal(b.field('Question').value,'request');
});

test('stored generation attribution overrides neither unknown labels nor configured current role; repeated export replaces display',async()=>{
 const c=conversation('a',{messages:[{role:'assistant',state:'complete',content:'Answer',model:'stored-model',destination:{kind:'local',host:'stored-host'},usage:{input_tokens:2,output_tokens:3,estimated_cost:0.01,cost_status:'estimated'}},{role:'assistant',state:'failed',error_code:'failed'}]});
 const b=await boot((m,u)=>u==='/api/conversations'?{items:[c]}:u==='/api/conversations/a'?c:missing);
 assert.match(b.text(),/Model: stored-model/);assert.match(b.text(),/stored-host/);assert.match(b.text(),/Cost: estimated 0.01 USD/);assert.match(b.text(),/Model: unknown/);
 const p=plan();
 const other=await boot((m,u)=>u==='/api/conversations'?{items:[]}:u.includes('/export')?{plan_version_id:'v',content_hash:'hash',markdown:'One export only'}:u.startsWith('/api/plans/')?p:missing,{hash:'#/plans/p/v'});
 other.button('Export this saved version').click();await settle();other.button('Export this saved version').click();await settle();assert.equal(other.panel.querySelectorAll('pre').filter(n=>n.textContent==='One export only').length,1);
});

test('delayed first saved-page read retires legacy workspace before completing and recovers after rejection',async()=>{
 let rejectPage;
 const b=createBrowser(html,{hash:'#/ask/a',respond:(m,u)=>{
  if(u==='/api/repos')return {repos:[],model:null};if(u==='/api/conversations')return {items:[conversation()]};
  if(u==='/api/conversations/a')return new Promise((resolve,reject)=>{rejectPage=reject;});
  return missing;
 }});install(b);b.window.confirm=()=>true;
 const imported=import(new URL(`../../repoask/web/app.js?recovery=${++imports}`,import.meta.url));
 await settle(40);assert.ok(rejectPage);assert.equal(b.document.querySelectorAll('.persistent-ask').length,1);assert.equal(b.document.getElementById('thread').parentNode.hidden,true);assert.match(visibleText(b.document.querySelector('.persistent-ask')),/Loading saved Ask/);
 rejectPage(new Error('Delayed first GET failed'));await imported;await settle();assert.match(visibleText(b.document.querySelector('.persistent-ask')),/Conversation unavailable/);assert.equal(b.document.getElementById('thread').parentNode.hidden,true);
});

test('cancel/retry refresh preserves usable keyboard focus and stale retired controls cannot submit',async()=>{
 let run={id:'run',state:'queued'},posts=0;
 const b=await boot((m,u)=>{
  if(u==='/api/conversations')return {items:[conversation()]};if(u==='/api/conversations/a')return conversation('a',{runs:[run]});
  if(m==='POST' && u.endsWith('/cancel')){posts++;run={...run,state:'cancelled'};return run;}
  if(m==='POST' && u.endsWith('/retry')){posts++;run={...run,state:'queued'};return run;}
  return missing;
 });
 const cancel=b.button('Cancel request');cancel.focus();cancel.click();await settle();assert.notEqual(b.document.activeElement,b.document.body);assert.equal(b.document.activeElement.isConnected,true);cancel.click();await settle();assert.equal(posts,1);
 const retry=b.button('Retry request');retry.focus();retry.click();await settle();assert.notEqual(b.document.activeElement,b.document.body);assert.equal(b.document.activeElement.isConnected,true);assert.equal(posts,2);
 b.window.location.hash='#/ask';await settle();
});

test('browser-like NodeLists without Array helpers support history, catalog and focus restoration',async()=>{
 const repo=id=>({repository_id:id,name:id,status:'ready',eligible:true});let c=conversation();
 const b=createBrowser(html,{hash:'#/ask/a',respond:(m,u,o)=>{
  if(u==='/api/conversations')return {items:[c],next_cursor:'next'};if(u==='/api/conversations?cursor=next')return {items:[conversation('b')]};
  if(u==='/api/conversations/a'){if(m==='PATCH')c={...c,repository_ids:JSON.parse(o.body).repository_ids};return c;}
  if(u==='/api/context/repositories?query=')return {items:[repo('r1')],next_cursor:'next'};if(u==='/api/context/repositories?query=&cursor=next')return {items:[repo('r2')]};
  return missing;
 }});install(b);
 function nodeList(items){const list={length:items.length,item:i=>items[i]??null,forEach:fn=>items.forEach(fn),[Symbol.iterator]:()=>items[Symbol.iterator]()};items.forEach((item,i)=>{list[i]=item;});return Object.freeze(list);}
 function wrap(element){const query=element.querySelectorAll;element.querySelectorAll=selector=>nodeList(query.call(element,selector));return element;}
 for(const element of b.document.descendants())wrap(element);wrap(b.document);
 const create=b.document.createElement.bind(b.document);b.document.createElement=tag=>wrap(create(tag));
 b.window.confirm=()=>true;
 const ui=await createAskPanel({host:b.document.getElementById('view-ask')});
 const button=t=>[...ui.panel.querySelectorAll('button')].find(n=>n.textContent===t);
 assert.equal(ui.panel.querySelectorAll('a').map,undefined);button('More conversations').click();await settle();assert.equal(ui.panel.querySelectorAll('a').length,2);
 button('Browse repository scope').click();await settle();button('More repositories').click();await settle();assert.equal(ui.panel.querySelectorAll('input').length,2);
 const scope=[...ui.panel.querySelectorAll('textarea')][0];input(scope,'r1');button('Save repository scope').focus();button('Save repository scope').click();await settle();assert.equal(b.document.activeElement,button('Save repository scope'));
 assert.equal(ui.panel.tagName,'MAIN');ui.focus();assert.equal(b.document.activeElement,ui.panel.querySelector('h1'));
});

test('persistent Ask route focuses visible H1 instead of retired legacy title',async()=>{
 const b=await boot((m,u)=>u==='/api/repos'?{repos:[],model:null}:u==='/api/conversations'?{items:[]}:missing,{app:true,hash:'#/ask'});
 b.window.location.hash='#/settings';await settle();b.window.location.hash='#/ask';await settle();
 const title=b.panel.querySelector('h1');assert.equal(b.panel.tagName,'MAIN');assert.equal(b.document.activeElement,title);assert.equal(title.inHiddenSubtree,false);
});
