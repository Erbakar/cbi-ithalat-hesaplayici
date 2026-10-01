import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadSectorCatalog} from '../src/sectors.js';
import {calculate} from '../src/engine.js';
import {resolveTariff} from '../src/rules.js';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const registry=await read('data/sectors.json');
const toys=await loadSectorCatalog(registry,'toys',read);
const input={sectorId:'toys',gtip:'9503.00.21.00.00',regime:'standard',date:'2026-10-01',origin:'Çin',dispatch:'Çin',proof:'none',gvGroup:'DU',igvGroup:'DU',tariffConfirmed:true,quantity:'1000',grossKg:'1000',currency:'USD',fx:'40',usdFx:'40',basis:'goods',invoice:'5000',freight:'800',insurance:'50',adjustments:'0',scenario:'certificate',certificateConfirmed:true,otherTaxes:'0',vatExpenses:'0',outsideExpenses:'0'};
test('Pilot catalog remains numerically unchanged and has explicit sector identity',()=>{const r=calculate(input,toys);assert.equal(r.cash,364197.6);assert.equal(r.sectorId,'toys');assert.equal(r.vatRate,20);assert.ok(toys.groups.every(g=>g.productCodes.every(code=>toys.products.some(p=>p.code===code))));});
test('Planned or unknown sectors never fall back to toys',async()=>{for(const id of ['technology','textiles','unknown'])await assert.rejects(loadSectorCatalog(registry,id,read));assert.equal(calculate({...input,sectorId:'textiles'},toys).ok,false);});
test('Independent synthetic sector uses its own GTIP, rates, VAT and default tariff policy',async()=>{
 const fixture={version:'test-only',effectiveFrom:'2026-01-01',snapshotDate:'2026-12-31',vatRate:10,sources:[],products:[{code:'1234.00.00.00.00',label:'Synthetic test fixture',customs:{DU:2},additional:{DU:3},surveillanceRate:null}]};
 const config={sectors:[{id:'test',status:'active',label:'Test only',catalogPath:'data/test.json',model:'ad-valorem-v1',surveillanceUnit:'USD/gross-tonne'}]};
 const c=await loadSectorCatalog(config,'test',async()=>fixture);
 const r=calculate({...input,sectorId:'test',gtip:fixture.products[0].code,scenario:'actual'},c);
 assert.equal(r.ok,true);assert.equal(r.vatRate,10);assert.equal(r.reference,null);assert.equal(r.gv,4680);assert.equal(r.igv,7020);assert.equal(r.vat,24570);assert.equal(r.cash,270270);
 assert.equal(resolveTariff({tariffMode:'guided',origin:'Almanya',dispatch:'Almanya',proof:'atr',documentConfirmed:true},c.tariffPolicy).resolved,false);
 assert.equal(calculate({...input,sectorId:'test'},c).ok,false);
 fixture.products[0].vatRate=8;assert.equal(calculate({...input,sectorId:'test',gtip:fixture.products[0].code,scenario:'actual'},c).vatRate,8);
});
test('Unsupported sector models, surveillance units and required rules block activation',async()=>{
 const base=registry.sectors[0];
 for(const patch of [{model:'specific-duty'},{surveillanceUnit:'USD/piece'}])await assert.rejects(loadSectorCatalog({sectors:[{...base,...patch}]},'toys',read));
 const raw=await read('data/catalog.json');raw.products[0].requiredRules=['excise'];
 await assert.rejects(loadSectorCatalog(registry,'toys',async()=>raw));
 raw.products[0].requiredRules=[];raw.products[0].surveillanceUnit='USD/piece';await assert.rejects(loadSectorCatalog(registry,'toys',async()=>raw));
});
