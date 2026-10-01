import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateIdentity, hashPassword, verifyPassword, loginIndexId, nextAttempt, OWNER_ID } from '../functions/src/identity.mjs';
const password='test-password-only';
const encoded=await hashPassword(password);
function fixture({id='mayla-user',companyId='mayla',legacy=false}={}) {
 const records=new Map([
  [`authLoginIndex/${loginIndexId('Carlos')}`,{sellerId:id}],
  [`authCredentials/${id}`,{passwordHash:encoded}],
  [`sellers/${id}`,{name:'Carlos',username:'Carlos',password:'must-never-be-returned',storeId:'m1',roleId:'r1',...(legacy?{}:{companyId})}],
  ['stores/m1',{...(legacy?{}:{companyId})}],
  [`companies/${legacy?'default_company':companyId}`,{status:'active'}],
  ['roles/r1',{name:'Vendedor',...(legacy?{}:{companyId})}]
 ]);
 const reads=[],tokens=[],attempts=[];
 return {records,reads,tokens,attempts,deps:{enabled:true,consumeAttempt:async identifier=>attempts.push(identifier),read:async(collection,id)=>{reads.push(`${collection}/${id}`);return records.get(`${collection}/${id}`)},createCustomToken:async(uid,claims)=>{tokens.push({uid,claims});return 'fake-signed-token'}}};
}
const login=f=>authenticateIdentity({identifier:' CARLOS ',password},f.deps);
test('server verifies hashed credentials and derives identity only from real seller/store/role documents',async()=>{
 const f=fixture();const result=await authenticateIdentity({identifier:'Carlos',password,companyId:'other',sellerId:OWNER_ID,platformOwner:true,platformDeveloper:true,roleId:'admin'},f.deps);
 assert.equal(result.user.companyId,'mayla');assert.equal(result.claims.platformOwner,false);assert.equal(result.claims.platformDeveloper,false);assert.equal(result.claims.roleId,'r1');assert.match(f.tokens[0].uid,/^vestika:[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(result).includes('must-never-be-returned'));assert.ok(!JSON.stringify(result).includes(encoded));assert.equal(f.reads.length,7);assert.deepEqual(f.attempts,['carlos']);
});
test('server rejects invalid passwords, plaintext credential records, unknown aliases and stale renamed accounts before signing',async()=>{
 for(const mutate of [f=>f.records.set('authCredentials/mayla-user',{passwordHash:'plaintext'}),f=>f.records.delete(`authLoginIndex/${loginIndexId('Carlos')}`),f=>f.records.get('sellers/mayla-user').username=f.records.get('sellers/mayla-user').name='Renamed']){
  const f=fixture();mutate(f);await assert.rejects(login(f),{code:'unauthenticated'});assert.equal(f.tokens.length,0);
 }
 const f=fixture();await assert.rejects(authenticateIdentity({identifier:'Carlos',password:'wrong'},f.deps));assert.equal(f.tokens.length,0);assert.equal(f.reads.length,2);
 assert.equal(await verifyPassword(password,encoded),true);assert.equal(await verifyPassword('bad',encoded),false);
});
test('server rejects disabled credentials, sellers, stores and companies, missing roles and contradictory ownership',async()=>{
 for(const mutate of [f=>f.records.get('authCredentials/mayla-user').disabled=true,f=>f.records.get('sellers/mayla-user').isDisabled=true,f=>f.records.get('stores/m1').isDisabled=true,f=>f.records.get('companies/mayla').status='suspended',f=>f.records.get('sellers/mayla-user').companyId='other',f=>f.records.get('roles/r1').companyId='other',f=>f.records.delete('roles/r1'),f=>f.records.get('sellers/mayla-user').storeId='missing',f=>f.records.get('roles/r1').userType='developer']){
  const f=fixture();mutate(f);await assert.rejects(login(f),{code:'unauthenticated'});assert.equal(f.tokens.length,0);
 }
});
test('Developer authority uses immutable Carlos ID or a current owner-issued grant, never seller name or role permission',async()=>{
 const normal=fixture();normal.records.get('sellers/mayla-user').platformRole='developer';normal.records.get('roles/r1').permissions=['Developer Center'];assert.equal((await login(normal)).claims.platformDeveloper,false);
 const owner=fixture({id:OWNER_ID});const ownerResult=await login(owner);assert.equal(ownerResult.claims.platformOwner,true);assert.equal(ownerResult.claims.platformDeveloper,true);assert.equal(owner.reads.length,6);
 for(const changes of [{},{active:false},{grantedBy:'another-user'},{userId:'wrong'},{role:'admin'}]){
  const f=fixture();f.records.set('platformDevelopers/mayla-user',{userId:'mayla-user',role:'developer',active:true,grantedBy:OWNER_ID,...changes});const result=await login(f);assert.equal(result.claims.platformDeveloper,Object.keys(changes).length===0);assert.equal(result.claims.platformOwner,false);
 }
});
test('legacy original-company identities stay compatible; Mayla cannot borrow their role',async()=>{
 const legacy=fixture({legacy:true});assert.equal((await login(legacy)).user.companyId,'default_company');
 const mayla=fixture();delete mayla.records.get('roles/r1').companyId;await assert.rejects(login(mayla));assert.equal(mayla.tokens.length,0);
});
test('disabled rollout and malformed requests fail closed without reading documents or issuing tokens',async()=>{
 const f=fixture();f.deps.enabled=false;await assert.rejects(login(f),{code:'failed-precondition'});assert.equal(f.reads.length,0);assert.equal(f.attempts.length,0);
 f.deps.enabled=true;
 for(const input of [null,{}, {identifier:'',password},{identifier:'Carlos',password:123},{identifier:'x'.repeat(161),password},{identifier:'Carlos',password:'x'.repeat(257)}])await assert.rejects(authenticateIdentity(input,f.deps));
 assert.equal(f.reads.length,0);assert.equal(f.tokens.length,0);
});
test('accounts get separate Firebase UIDs; rate limiting uses fixed windows and blocks limits before signing',async()=>{
 const a=fixture({id:'user-a'}),b=fixture({id:'user-b',companyId:'other'});await login(a);await login(b);assert.notEqual(a.tokens[0].uid,b.tokens[0].uid);assert.notEqual(a.tokens[0].claims.companyId,b.tokens[0].claims.companyId);
 assert.deepEqual(nextAttempt(null,1000,2),{windowStart:1000,count:1});assert.deepEqual(nextAttempt({windowStart:1000,count:1},2000,2),{windowStart:1000,count:2});assert.throws(()=>nextAttempt({windowStart:1000,count:2},2000,2),{code:'resource-exhausted'});assert.deepEqual(nextAttempt({windowStart:1000,count:2},601000,2),{windowStart:601000,count:1});
 const f=fixture();f.deps.consumeAttempt=async()=>{nextAttempt({windowStart:0,count:15},1,15)};await assert.rejects(login(f),{code:'resource-exhausted'});assert.equal(f.tokens.length,0);assert.equal(f.reads.length,0);
});

test('long valid seller IDs produce Firebase UIDs within the 128-character limit', async()=>{const f=fixture({id:'x'.repeat(128)});await login(f);assert.ok(f.tokens[0].uid.length <= 128);assert.equal(f.tokens[0].claims.sellerId.length,128);});
