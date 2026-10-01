import test from 'node:test';
import assert from 'node:assert/strict';
import {readMoney,displayMoney} from '../src/money-input.js';
test('Currency masks roundtrip amounts without changing their value',()=>{for(const n of [0,1,50000,1234567.89,1.234567])assert.equal(readMoney(displayMoney(n)),n);assert.equal(readMoney('50.000,00'),50000);assert.equal(readMoney('50000'),50000);assert.equal(readMoney('1.000'),1000);assert.equal(readMoney(''), '');assert.equal(readMoney('-1'),'-1');});
