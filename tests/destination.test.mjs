import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadSectorCatalog} from '../src/sectors.js';
import {calculate} from '../src/engine.js';
import {validateThroughStep,workflowErrors} from '../src/workflow.js';
import {updateDestinationInput,DESTINATIONS} from '../src/destination.js';
import {reportModel} from '../reports/model.mjs';

const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const registry=await read('data/sectors.json');

const ok=(third,pref)=>({status:'ok',reasons:[],thirdCountry:{text:`${third}.00 %`,rate:third},preference:pref==null?null:{text:`${pref}.00 %`,rate:pref,label:'Customs Union Duty'},remedies:[],quota:false,commodities:['1234567800']});
const fixture={version:'test',snapshotDate:'2026-11-24',sources:[{file:'test'}],products:[
 {code:'1234.56.78.00.00',cn8:'12345678',label:'Deneme ürün',unit:'Çift'},
 {code:'1234.56.79.00.00',cn8:'12345679',label:'Bölünen ürün'},
 {code:'1234.56.80.00.00',cn8:'12345680',label:'İncelemeli ürün'}],
 tariffs:{
  '12345678':{EU:ok(8,0),UK:ok(4,0)},
  '12345679':{EU:{...ok(0,0),status:'review',reasons:['Bu GTİP hedef ülke tarifesinde farklı vergili alt kodlara ayrılıyor.'],variants:[{commodity:'1234567910',description:'A',status:'ok',reasons:[],thirdCountry:{text:'3.00 %',rate:3},preference:{text:'0.00 %',rate:0}},{commodity:'1234567990',description:'B',status:'ok',reasons:[],thirdCountry:{text:'6.00 %',rate:6},preference:{text:'0.00 %',rate:0}}]},UK:ok(2,0)},
  '12345680':{EU:{...ok(17,0),status:'review',reasons:['Türkiye menşeine uygulanabilen ek / korunma / anti-damping önlemi var.']},UK:ok(5,0)}}};
const config={sectors:[{id:'fx-test',label:'Test',status:'active',catalogPath:'data/fx-test.json',model:'destination-import-v1'}]};
const catalog=await loadSectorCatalog(config,'fx-test',async()=>structuredClone(fixture));
const base={sectorId:'fx-test',gtip:'1234.56.78.00.00',variant:'',destination:'DE',proof:'pref',proofConfirmed:true,quantity:'100',currency:'EUR',fx:'1',basis:'goods',invoice:'10000',freight:'800',insurance:'200',adjustments:'0',otherTaxes:'0',vatExpenses:'500',outsideExpenses:'300'};

test('Germany with confirmed A.TR: customs-union 0% duty, German 19% VAT',()=>{
 const r=calculate(base,catalog);
 assert.equal(r.ok,true);assert.equal(r.customsValue,11000);assert.equal(r.duty,0);
 assert.equal(r.vatBase,11500);assert.equal(r.vat,2185);assert.equal(r.cash,13985);assert.equal(r.unitCash,139.85);
 assert.equal(r.currency,'EUR');assert.equal(r.status,'estimate');
});
test('Without a proof of origin the third-country rate applies; unknown proof is flagged for review',()=>{
 const none=calculate({...base,proof:'none',proofConfirmed:false},catalog);
 assert.equal(none.duty,880);assert.equal(none.vat,taxOf(11000+880+500,19));assert.equal(none.status,'estimate');
 const unknown=calculate({...base,proof:'unknown',proofConfirmed:false},catalog);
 assert.equal(unknown.duty,880);assert.equal(unknown.status,'review');
 assert.equal(calculate({...base,proofConfirmed:false},catalog).ok,false);
});
function taxOf(base,rate){return Math.round(base*rate)/100;}
test('UK uses its own tariff, GBP and 20% VAT; invoice in USD is converted with the entered rate',()=>{
 const r=calculate({...base,destination:'GB',proof:'none',proofConfirmed:false,currency:'USD',fx:'0.8'},catalog);
 assert.equal(r.currency,'GBP');assert.equal(r.customsValue,8800);assert.equal(r.duty,352);assert.equal(r.vat,taxOf(8800+352+500,20));
 assert.equal(calculate({...base,destination:'GB',currency:'GBP',fx:'0.9'},catalog).ok,false);
});
test('A split tariff line requires a sub-code; a trade-defence line never invents a duty',()=>{
 const split={...base,gtip:'1234.56.79.00.00'};
 assert.equal(calculate(split,catalog).errors.variant!==undefined,true);
 const r=calculate({...split,variant:'1234567990',proof:'none',proofConfirmed:false},catalog);
 assert.equal(r.ok,true);assert.equal(r.duty,660);assert.equal(r.status,'estimate');
 const review=calculate({...base,gtip:'1234.56.80.00.00'},catalog);
 assert.equal(review.ok,true);assert.equal(review.duty,null);assert.equal(review.cash,null);assert.equal(review.status,'review');
});
test('Unknown expenses are not zero and block the workflow until entered',()=>{
 const r=calculate({...base,outsideExpenses:''},catalog);
 assert.equal(r.ok,true);assert.equal(r.cash,null);assert.equal(r.status,'partial');
 const v=validateThroughStep({...base,outsideExpenses:''},catalog,3);assert.equal(v.ok,false);assert.equal(v.step,3);
 assert.equal(validateThroughStep(base,catalog,3).ok,true);
 assert.equal(workflowErrors({...base,proof:'unknown',proofConfirmed:false},catalog).proof,undefined);
});
test('Changing the destination resets dependent answers',()=>{
 const next=updateDestinationInput({...base,variant:'x'},'destination','GB');
 assert.equal(next.variant,'');assert.equal(next.proofConfirmed,false);assert.equal(next.fx,'');
 assert.equal(updateDestinationInput({...base,currency:'USD'},'currency','EUR').fx,'1');
 assert.equal(DESTINATIONS.filter(d=>d.bloc==='EU').length,27);
});
test('Report model carries the destination currency and headline',()=>{
 const r=calculate(base,catalog);const m=reportModel(base,r,catalog);
 assert.equal(m.currency,'EUR');assert.equal(m.headline.cash,13985);assert.match(m.title,/Almanya/);
});
test('Real sector catalogs load, every product has EU and UK tariff data and groups cover all products',async()=>{
 for(const id of ['textiles','footwear']){
  const c=await loadSectorCatalog(registry,id,read);
  assert.ok(c.products.length>50);
  assert.ok(c.groups.every(g=>g.productCodes.every(code=>c.products.some(p=>p.code===code))));
  assert.equal(new Set(c.groups.flatMap(g=>g.productCodes)).size,c.products.length);
  const first=c.products.find(p=>c.tariffs[p.cn8].EU.status==='ok');
  const r=calculate({...base,sectorId:id,gtip:first.code},c);assert.equal(r.ok,true);
 }
});
