import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Optimistic document-version transactions: competing commits are retried from
// their read set, like the browser SDK. No production credentials or writes.
const fixture = `
export const collection=(db,name)=>({db,path:name});
export const doc=(db,name,id)=>({db,path:name+'/'+id,id});
const snap=(db,ref)=>{const exists=db.rows.has(ref.path),value=structuredClone(db.rows.get(ref.path));return{id:ref.id,exists:()=>exists,data:()=>structuredClone(value)};};
export async function getDocFromServer(ref){if(ref.db.offline)throw Error('Sin conexión');return snap(ref.db,ref);}
export async function getDocsFromServer(ref){
 const rows=[...ref.db.rows].filter(([path])=>path.startsWith(ref.path+'/')).map(([path,data])=>({id:path.split('/').at(-1),data:()=>structuredClone(data)}));
 if(ref.db.afterList)await ref.db.afterList();
 return {docs:rows};
}
export async function runTransaction(db,callback){
 for(let i=0;i<20;i++){
  const reads=new Map(),pending=[];
  const tx={get:async ref=>{reads.set(ref.path,db.versions.get(ref.path)||0);return snap(db,ref);},set:(ref,data,options)=>pending.push({ref,data,merge:!!options?.merge}),update:(ref,data)=>pending.push({ref,data,merge:true}),delete:ref=>pending.push({ref,remove:true})};
  await callback(tx);
  if([...reads].some(([path,version])=>(db.versions.get(path)||0)!==version))continue;
  for(const op of pending){const path=op.ref.path;if(op.remove)db.rows.delete(path);else db.rows.set(path,structuredClone(op.merge?{...db.rows.get(path),...op.data}:op.data));db.versions.set(path,(db.versions.get(path)||0)+1);}
  db.commits++;return;
 }
 throw Error('Too much contention');
}`;
const dir=await mkdtemp(join(process.cwd(),'tests/.unique-users-'));
const result=await build({entryPoints:['services/uniqueLegacyUsers.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'optimistic-firestore',setup(b){b.onResolve({filter:/^firebase\/firestore$/},()=>({path:'fixture',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:fixture}));}}]});
const file=join(dir,'writer.mjs');await writeFile(file,result.outputFiles[0].text);
const{commitUniqueLegacyUser:save,assertUniqueLoginAliases,loginAliases}=await import(pathToFileURL(file).href);
test.after(()=>rm(dir,{recursive:true,force:true}));
function database(users=[]){return{rows:new Map(users.map(u=>['sellers/'+u.id,structuredClone(u)])),versions:new Map(),commits:0};}
const ref=(db,path)=>({db,path,id:path.split('/').at(-1)});
const mutation=(db,id,data,action='create')=>({ref:ref(db,'sellers/'+id),data,action});
const user=(id,username,name=id,extra={})=>({id,username,name,password:'unchanged',companyId:'a',storeId:'a1',roleId:'r',...extra});
const duplicate=/Ese nombre o usuario de inicio de sesión ya está en uso/;

test('normalization matches login: casing and outer whitespace; internal spaces and accents remain meaningful',()=>{
 assert.deepEqual(loginAliases({name:' Ángela María ',username:' MiXeD.Legacy '}),['ángela maría','mixed.legacy']);
 assert.deepEqual(loginAliases({name:' SAME ',username:'same'}),['same']);
 assert.throws(()=>assertUniqueLoginAliases([user('a','Carlos.Login')],user('b',' carLOS.LOGIN ')),duplicate);
 assert.doesNotThrow(()=>assertUniqueLoginAliases([user('a','angela')],user('b','ángela')));
 assert.doesNotThrow(()=>assertUniqueLoginAliases([user('a','a b')],user('b','ab')));
});

test('create and edit reject username/name cross-collisions, foreign companies and disabled accounts without changing anything',async()=>{
 const db=database([user('existing','reserved.login','Reserved Name',{companyId:'foreign',isDisabled:true}),user('editing','own.login','Own Name')]);
 for(const action of ['create','update'])for(const data of [user('candidate',' RESERVED.LOGIN ','Free Name'),user('candidate','free.login',' reserved name '),user('candidate',' reserved name ','Free Name'),user('candidate','free.login','reserved.login')]){
  await assert.rejects(save(db,mutation(db,action==='create'?'candidate':'editing',data,action)),duplicate);
 }
 assert.equal(db.commits,0);assert.equal(db.rows.size,2);
 assert.equal(db.rows.get('sellers/editing').username,'own.login');
});

test('editing yourself preserves credentials, ownership and disabled state; removing username really clears it',async()=>{
 const db=database([user('a','MiXeD.Login','Name',{isDisabled:true})]);
 await save(db,mutation(db,'a',{name:' NAME ',username:' mixed.LOGIN '},'update'));
 assert.equal(db.rows.get('sellers/a').password,'unchanged');assert.equal(db.rows.get('sellers/a').companyId,'a');assert.equal(db.rows.get('sellers/a').isDisabled,true);
 await save(db,mutation(db,'a',{username:''},'update'));
 assert.equal(db.rows.get('sellers/a').username,'');
 await save(db,mutation(db,'b',user('b','mixed.login','Other Name')));
 assert.equal(db.rows.size,3); // two profiles plus the shared revision
});

test('two concurrent creates sharing an alias commit exactly one user',async()=>{
 const db=database();const results=await Promise.allSettled([
  save(db,mutation(db,'a',user('a','Shared.Login','First'))),
  save(db,mutation(db,'b',user('b',' shared.LOGIN ','Second')))
 ]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.match(results.find(r=>r.status==='rejected').reason.message,duplicate);
 assert.equal([...db.rows.keys()].filter(k=>k.startsWith('sellers/')).length,1);
 assert.equal(db.commits,1);
});

test('simultaneous renames and create-versus-rename cannot claim the same available alias',async()=>{
 for(const secondAction of ['create','update']){
  const db=database([user('a','old.a','First'),...(secondAction==='update'?[user('b','old.b','Second')]:[])]);
  const results=await Promise.allSettled([save(db,mutation(db,'a',{username:'new.shared'},'update')),save(db,mutation(db,'b',user('b','NEW.SHARED','Second'),secondAction))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const matches=[...db.rows].filter(([path,u])=>path.startsWith('sellers/')&&loginAliases(u).includes('new.shared'));
  assert.equal(matches.length,1);
 }
});

test('company, store, role and platform grant bootstrap writes are atomic with their user',async()=>{
 const db=database([user('a','taken','Existing')]);
 const bootstrap=tx=>{for(const path of ['companies/new','stores/new','roles/new','platformDevelopers/new'])tx.set(ref(db,path),{companyId:'new'});};
 await assert.rejects(save(db,mutation(db,'new',user('new',' TAKEN ','New Admin')),bootstrap),duplicate);
 assert.equal(db.rows.size,1);
 await save(db,mutation(db,'new',user('new','available','New Admin')),bootstrap);
 assert.equal(db.commits,1);for(const path of ['companies/new','stores/new','roles/new','platformDevelopers/new','sellers/new'])assert.ok(db.rows.has(path));
});

test('failed reads, missing updates, reused IDs and tenant validation failures do not write',async()=>{
 const db=database([user('a','original')]);db.offline=true;
 await assert.rejects(save(db,mutation(db,'new',user('new','new'))),/Sin conexión/);db.offline=false;
 await assert.rejects(save(db,mutation(db,'missing',{name:'Missing'},'update')),/No se encontró/);
 await assert.rejects(save(db,mutation(db,'a',user('a','another'))),/ya se guardó/);
 await assert.rejects(save(db,{...mutation(db,'a',{companyId:'foreign'},'update'),validate(){throw Error('Otra empresa');}}),/Otra empresa/);
 assert.equal(db.commits,0);assert.equal(db.rows.get('sellers/a').companyId,'a');
});

test('a stale list is discarded and re-read before saving',async()=>{
 const db=database();let calls=0;
 db.afterList=async()=>{if(calls++===0){db.rows.set('sellers/racer',user('racer','taken','Racer'));db.rows.set('userManagementState/loginIdentifiers',{revision:1});db.versions.set('userManagementState/loginIdentifiers',1);}};
 await assert.rejects(save(db,mutation(db,'new',user('new','taken','New'))),duplicate);
 assert.equal(calls,2);assert.equal(db.commits,0);assert.equal(db.rows.has('sellers/new'),false);
});

test('a deleted account frees its aliases and participates in the revision protocol',async()=>{
 const db=database([user('a','released','Old')]);
 await save(db,mutation(db,'a',undefined,'delete'));
 await save(db,mutation(db,'b',user('b','RELEASED','New')));
 assert.equal(db.rows.has('sellers/a'),false);assert.equal(db.rows.get('userManagementState/loginIdentifiers').revision,2);
});
