import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRIES,findCountries,isCountry} from '../src/countries.js';
import {EU_COUNTRIES} from '../src/rules.js';
test('Country list covers ISO regions and existing EU rule names',()=>{assert.equal(COUNTRIES.length,249);assert.equal(new Set(COUNTRIES.map(c=>c.code)).size,249);for(const name of EU_COUNTRIES)assert.ok(isCountry(name),name);});
test('Country search handles Turkish letters, codes and common aliases',()=>{for(const [query,code] of [['cin','CN'],['ÇİN','CN'],['alm','DE'],['ABD','US'],['ingiltere','GB'],['turkiye','TR']])assert.ok(findCountries(query).some(c=>c.code===code));assert.equal(findCountries('zzzzzz').length,0);});
test('Only canonical country selections or explicit unknown are accepted',()=>{assert.equal(isCountry('Çin'),true);assert.equal(isCountry('Bilmiyorum'),true);for(const value of ['cin','',undefined,'Rastgele ülke'])assert.equal(isCountry(value),false);});
