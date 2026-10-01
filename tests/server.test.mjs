import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
test('HTTP delivery, server recalculation, persistence and rejection paths',async()=>{
 const store=await mkdtemp(path.join(tmpdir(),'cbi-test-'));
 const proc=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'4174',LEAD_STORAGE_DIR:store},stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(proc.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Test server did not start')),5000).unref())]);
  const url='http://127.0.0.1:4174';
  assert.equal((await fetch(url)).status,200);assert.equal((await fetch(url+'/storage/leads.jsonl')).status,404);assert.equal((await fetch(url+'/server.mjs')).status,404);
  assert.equal((await fetch(url+'/.env')).status,404);assert.equal((await fetch(url+'/assistant.mjs')).status,404);
  for(const module of ['rules','guidance','decimal'])assert.equal((await fetch(url+'/src/'+module+'.js')).status,200);
  const helpResponse=await fetch(url+'/api/guide',{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify({question:'Brüt ağırlık nedir?'})});assert.equal(helpResponse.status,200);const help=await helpResponse.json();assert.equal(help.topic,'grossKg');assert.equal(help.provider,'local');assert.ok(!JSON.stringify(help).includes('API_KEY'));
  const payload={contact:{name:'Test Kullanıcısı',company:'Test Şirketi',email:'test@example.com',phone:'',consent:true},inputs:{gtip:'9503.00.21.00.00',regime:'standard',date:'2026-10-01',origin:'Çin',dispatch:'Çin',proof:'none',gvGroup:'DU',igvGroup:'DU',tariffConfirmed:true,quantity:'1000',grossKg:'1000',currency:'USD',fx:'40',usdFx:'40',basis:'goods',invoice:'5000',freight:'800',insurance:'50',adjustments:'0',scenario:'certificate',certificateConfirmed:true,otherTaxes:'1200',vatExpenses:'3000',outsideExpenses:'10000'},result:{cash:1}};
  const post=(body,origin=url)=>fetch(url+'/api/leads',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  assert.equal((await post(payload,'https://invalid.example')).status,403);
  assert.equal((await post({...payload,contact:{...payload.contact,consent:false}})).status,422);
  assert.equal((await post({...payload,inputs:{...payload.inputs,gtip:'unknown'}})).status,422);
  const response=await post(payload);assert.equal(response.status,201);const data=await response.json();assert.match(data.id,/^[a-f\d-]{36}$/);
  const saved=JSON.parse((await readFile(path.join(store,'leads.jsonl'),'utf8')).trim());assert.equal(saved.id,data.id);assert.equal(saved.result.cash,379237.6);assert.equal(saved.contact.consent,true);
 }finally{proc.kill();await once(proc,'exit');await rm(store,{recursive:true,force:true});}
});
