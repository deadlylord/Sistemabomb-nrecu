import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareStagingDailySummaries} from '../functions/scripts/prepareStagingDailySummaries.mjs';
test('daily dashboard rollout rejects production before credential access; offline plan targets all three test stores',async()=>{
 const forbidden=()=>assert.fail('credential access');
 for(const projectId of ['factura2-6e811','other',undefined])await assert.rejects(prepareStagingDailySummaries(forbidden,{projectId,write:true}),/restricted/);
 const plan=await prepareStagingDailySummaries(forbidden,{projectId:'vestika-staging'});
 assert.equal(plan.stores.length,3);assert.equal(plan.companyId,'load_reads_20261023_company');assert.equal(plan.mode,'plan');
});
