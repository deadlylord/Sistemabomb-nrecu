import test from 'node:test';
import assert from 'node:assert/strict';
import {restSourceVersion,verifyStagingFinancialLedger} from '../functions/scripts/verifyStagingFinancialLedger.mjs';
test('staging gate preserves nanoseconds and rejects invalid ownership paths before authentication',async()=>{
 assert.equal(restSourceVersion('1970-01-01T00:00:00Z'),'0:0');
 assert.equal(restSourceVersion('1970-01-01T00:00:00.000000001Z'),'0:1');
 assert.equal(restSourceVersion('1970-01-01T00:00:01.045123456Z'),'1:45123456');
 await assert.rejects(verifyStagingFinancialLedger(()=>{throw Error('must not authenticate');},{companyId:'foreign/forged',storeId:'store'}),/Invalid staging/);
});
