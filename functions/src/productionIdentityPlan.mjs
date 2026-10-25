import {hashPassword,verifyPassword,loginIndexId} from './identity.mjs';import {roleType,aliases} from './stagingUsers.mjs';
export const IDENTITY_PROJECT='factura2-6e811';
const prefix=`projects/${IDENTITY_PROJECT}/databases/(default)/documents/`;
export const decodeIdentityValue=v=>'stringValue'in v?v.stringValue:'integerValue'in v?Number(v.integerValue):'doubleValue'in v?v.doubleValue:'booleanValue'in v?v.booleanValue:'nullValue'in v?null:'timestampValue'in v?v.timestampValue:'arrayValue'in v?(v.arrayValue.values||[]).map(decodeIdentityValue):Object.fromEntries(Object.entries(v.mapValue?.fields||{}).map(([k,v])=>[k,decodeIdentityValue(v)]));
export const wireFields=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:v===null?{nullValue:null}:{integerValue:String(v)}]));
export async function planProductionIdentity(snapshot){
 if(snapshot?.manifest?.projectId!==IDENTITY_PROJECT||!Array.isArray(snapshot.items))throw Error('Production identity backup required');
 const raw=new Map(snapshot.items.map(i=>[i.path,i.document]));
 const values=new Map([...raw].map(([path,d])=>[path,Object.fromEntries(Object.entries(d.fields).map(([k,v])=>[k,decodeIdentityValue(v)]))]));
 const writes=new Map(),owners=new Map();let users=0;
 const put=(path,fields)=>{const before=raw.get(path);writes.set(path,{path,update:{name:prefix+path,fields},currentDocument:before?{updateTime:before.updateTime}:{exists:false}});};
 for(const [path,d]of raw)if(path.startsWith('stores/')||path.startsWith('roles/')){
  const data=values.get(path),companyId=data.companyId||'default_company';if(!values.has('companies/'+companyId))throw Error('Identity metadata company missing');
  const changes={};if(!data.companyId)changes.companyId={stringValue:companyId};
  if(path.startsWith('roles/')&&!data.userType)changes.userType={stringValue:roleType(data)};
  if(Object.keys(changes).length)put(path,{...d.fields,...changes});
 }
 for(const [path,d]of raw)if(path.startsWith('sellers/')){
  const id=path.slice(8),seller=values.get(path),store=values.get('stores/'+seller.storeId),role=values.get('roles/'+seller.roleId),companyId=store?.companyId||'default_company';
  if(!store||!role||!values.has('companies/'+companyId)||seller.companyId&&seller.companyId!==companyId||(role.companyId||'default_company')!==companyId||role.userType==='developer'||['developer','desarrollador'].includes(String(role.name||'').toLowerCase()))throw Error('Identity ownership or role mismatch');
  if(typeof seller.password!=='string'||!seller.password.trim()||seller.password.length>256)throw Error('Identity requires an existing compatible credential');
  const names=aliases(seller);if(!names.length)throw Error('Identity alias missing');
  for(const alias of names){const key=loginIndexId(alias),old=values.get('authLoginIndex/'+key)?.sellerId;if(owners.has(key)&&owners.get(key)!==id||old&&old!==id)throw Error('Identity aliases collide');owners.set(key,id);put('authLoginIndex/'+key,wireFields({sellerId:id}));}
  let encoded=values.get('authCredentials/'+id)?.passwordHash;
  if(!encoded||!await verifyPassword(seller.password,encoded))encoded=await hashPassword(seller.password);
  put('authCredentials/'+id,wireFields({passwordHash:encoded,disabled:!!seller.isDisabled}));
  const fields={...d.fields,...wireFields({id,companyId,authVersion:seller.authVersion||1})};delete fields.password;delete fields.passwordHash;put(path,fields);users++;
 }
 if(!users||writes.size>400)throw Error('Unexpected identity migration size');
 return{projectId:IDENTITY_PROJECT,backupHash:snapshot.manifest.documentsHash,users,aliases:owners.size,writes:[...writes.values()]};
}
