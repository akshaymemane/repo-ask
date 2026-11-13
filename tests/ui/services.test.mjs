import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBrowser,install,settle,visibleText} from './dom.mjs';
test('UI profile CRUD, roles and local policy persist through real FeatureAPI and SQLite (no sockets)',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'catalog-ui-'));
 try {
  const bridge=fileURLToPath(new URL('./service-bridge.py',import.meta.url));
  const browser=createBrowser(readFileSync(new URL('../../repoask/web/index.html',import.meta.url),'utf8'),{hash:'#/settings',respond(method,url,options){
   if(url==='/api/repos')return {repos:[],model:null};
   const parsed=new URL(url,'http://localhost');
   return JSON.parse(execFileSync('python3',[bridge,directory],{input:JSON.stringify({method,path:parsed.pathname,query:parsed.search.slice(1),body:options.body?JSON.parse(options.body):undefined}),encoding:'utf8'}));
  }});
  install(browser);await import(new URL('../../repoask/web/app.js?real-services',import.meta.url));await settle();
  const root=browser.document.getElementById('settings-content');
  const button=text=>root.querySelectorAll('button').find(x=>x.textContent===text);
  const input=(form,label)=>{const wrap=form.querySelectorAll('label').find(x=>x.textContent.startsWith(label));return wrap.querySelector('input')||wrap.querySelector('select');};
  assert.match(visibleText(root),/disconnected · 0 active installations/);
  let form=button('Create profile').closest('form');input(form,'Profile name').value='Real local profile';input(form,'Model identifier').value='synthetic';form.requestSubmit();await settle();
  assert.match(visibleText(root),/Real local profile/);
  form=button('Save ask role').closest('form');const select=input(form,'ask profile');select.value=select.querySelectorAll('option')[1].value;form.requestSubmit();await settle();
  assert.match(visibleText(root),/untested · Destination: local: 127\.0\.0\.1:11434/);
  button('Edit Real local profile / rotate credential').click();form=button('Save new profile version').closest('form');input(form,'Model identifier').value='synthetic-v2';form.requestSubmit();await settle();assert.match(visibleText(root),/synthetic-v2 · Version 2/);
  form=button('Save destination policy').closest('form');input(form,'Local-only inference').checked=false;form.requestSubmit();await settle();assert.equal(input(button('Save destination policy').closest('form'),'Local-only inference').checked,false);
  button('Delete Real local profile').click();button('Confirm delete Real local profile').click();await settle();assert.equal(button('Delete Real local profile'),undefined);
 } finally {rmSync(directory,{recursive:true,force:true});}
});
