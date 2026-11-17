import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBrowser,install,settle,visibleText} from './dom.mjs';
import {createAskPanel} from '../../repoask/web/ask.js';

test('conversation fix opens the saved plan editor at Execution and publication', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ask-start-fix-'));
  const bridge=fileURLToPath(new URL('./ask-service-bridge.py',import.meta.url));
  const call=(path,method='GET',body)=>{
    const url=new URL(path,'http://localhost');
    return JSON.parse(execFileSync(process.env.REPOASK_TEST_PYTHON || 'python3',[bridge,dir],{input:JSON.stringify({path:url.pathname,query:url.search.slice(1),method,body}),encoding:'utf8'}));
  };
  try {
    const seed=call('/test/seed','POST').body;
    const b=createBrowser(readFileSync(new URL('../../repoask/web/index.html',import.meta.url),'utf8'),{hash:`#/ask/${seed.conversation.id}`,respond:(m,u,o)=>call(u,m,o.body?JSON.parse(o.body):undefined)});
    install(b); b.window.confirm=()=>true;
    const editorHost=b.document.createElement('aside');b.document.body.append(editorHost);
    const sidePanel={close(){},openTab({render}){render(editorHost);}};
    const ui=await createAskPanel({host:b.document.getElementById('view-ask'),sidePanel});
    await settle();
    assert.match(visibleText(ui.panel.querySelector('.plan-card-reason')),/Choose a tested execution profile/);
    ui.panel.querySelector('.plan-card-reason a').click();await settle(30);
    const section=editorHost.querySelectorAll('details').find(n=>n.querySelector('summary')?.textContent==='Execution and publication');
    assert.ok(section);assert.equal(section.open,true);
    assert.match(b.window.location.hash,new RegExp(`^#/plans/${seed.plan.id}/`));
    assert.equal(call(`/api/plans/${seed.plan.id}`).body.version.id,seed.plan.version.id);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
