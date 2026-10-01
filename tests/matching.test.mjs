import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchProducts,normalizeCode} from '../src/matching.js';
import {resolveProductCode} from '../src/engine.js';
import {findCountries} from '../src/countries.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url)));
test('every catalog code accepts presentation differences without changing identity',()=>{
 for(const p of catalog.products)for(const code of [p.code.replaceAll('.',','),p.code.replaceAll('.',' '),p.code.replaceAll('.',''),p.code.replaceAll('.','-')])assert.equal(resolveProductCode(code,catalog)?.canonicalCode,p.code);
 assert.equal(normalizeCode('9503abc00100019'),'');
});
test('text search tolerates accents punctuation word order and typos',()=>{
 const products=[{code:'1111.11.11.11.11',label:'Üç tekerlekli bisikletler'},{code:'2222.22.22.22.22',label:'Pelüş oyuncak bebek'}];
 for(const q of ['uc, tekerlekli','bisikletler üç','tekerlekil','pelus','oyuncakk bebek'])assert.ok(searchProducts(products,q).length,q);
 assert.equal(searchProducts(products,'tekerlekil')[0].suggested,true);
 assert.equal(searchProducts(products,'alakasiz')[0],undefined);
});
test('nearby numerical codes suggest candidates but never silently resolve',()=>{
 const p={code:'1111.11.11.11.11',label:'Test'};
 assert.equal(searchProducts([p],'111111111112')[0].suggested,true);
 assert.equal(resolveProductCode('111111111112',{products:[p]}),null);
});
test('legacy code punctuation resolves registered mapping and countries tolerate minor spelling',()=>{
 assert.equal(resolveProductCode('9503,00,10,19,19',catalog)?.canonicalCode,'9503.00.10.00.19');
 assert.ok(findCountries('Almnya').some(c=>c.code==='DE'));
 assert.ok(findCountries('CIN').some(c=>c.code==='CN'));
});
