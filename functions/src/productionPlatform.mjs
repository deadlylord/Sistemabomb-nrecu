import {IdentityError,OWNER_ID,hashPassword,loginIndexId} from './identity.mjs';
import {verifiedActor,aliases,publicSeller,roleType} from './stagingUsers.mjs';
import {businessRoot,emptyBusinessRoot} from './businessSummary.mjs';
const fail=message=>{throw new IdentityError('permission-denied',message||'No tienes permiso para esta operación.');};
const text=(value,max=200)=>typeof value==='string'&&value.trim()&&value.length<=max;
const views=['dashboard','pos','inventory','inventory_transfer','layaway','purchases','sellers','stores','customers','stock_take_history','payroll','settings','incidents','role_manager','accounting','financial_reconciliation','gift_vouchers','ceo_center','tag_scanning'];
const cleanCompany=input=>{
 if(!text(input?.name))throw new IdentityError('invalid-argument','Completa el nombre de la empresa.');
 const value={name:input.name.trim(),status:'active',createdAt:new Date().toISOString(),maxStores:Math.max(1,Number(input.maxStores)||2),maxAdmins:Math.max(1,Number(input.maxAdmins)||1),maxSellers:Math.max(0,Number(input.maxSellers)||0),allowedViews:input.allowedViews?.length?input.allowedViews:views};
 for(const f of ['nit','phone','email','address']){if(input[f]!==undefined&&(typeof input[f]!=='string'||input[f].length>500))throw new IdentityError('invalid-argument');value[f]=input[f]||'';}
 if(!value.allowedViews.every(v=>views.includes(v))||['maxStores','maxAdmins','maxSellers'].some(f=>!Number.isInteger(value[f])||value[f]>10000))throw new IdentityError('invalid-argument');return value;
};
const cleanStore=(data,companyId)=>{
 if(!text(data?.name))throw new IdentityError('invalid-argument','Completa el nombre de la sede.');
 const value={companyId,name:data.name.trim(),logo:data.logo||null,contactInfo:data.contactInfo||'',footerText:data.footerText||'¡Gracias por su compra!',whatsappFooterText:data.whatsappFooterText||'Gracias por preferirnos.',addiLink:data.addiLink||'',sistecreditoLink:data.sistecreditoLink||'',accentColor:data.accentColor||'#4f46e5',accentColorHover:data.accentColorHover||'#4338ca',nextInvoiceNumber:data.nextInvoiceNumber||1,initialBalances:data.initialBalances||{cash:0,qr:0}};
 const optional=['receiptName','autoPrint','autoSendWhatsApp','secondaryColor','loginBackgroundUrl','imageCompressionQuality','accentColorsUpdated','hideDetailedVerificationForSellers','detailedVerificationEnabledDate','crossStoreInitialBalances','accountNames','paymentCommissions','paymentSurcharges','labelConfig'];
 const valid=(v,depth=0)=>depth<=5&&(v===null||typeof v==='boolean'||typeof v==='string'&&v.length<=10000||typeof v==='number'&&Number.isFinite(v)||Array.isArray(v)&&v.length<=200&&v.every(x=>valid(x,depth+1))||v&&typeof v==='object'&&Object.keys(v).length<=100&&Object.values(v).every(x=>valid(x,depth+1)));
 for(const field of optional)if(data[field]!==undefined){if(!valid(data[field]))throw new IdentityError('invalid-argument');value[field]=data[field];}
 if(Buffer.byteLength(JSON.stringify(value))>700000)throw new IdentityError('invalid-argument');
 for(const [k,v]of Object.entries(value))if(typeof v==='string'&&v.length>(k==='logo'?500000:10000))throw new IdentityError('invalid-argument');
 if(!Number.isInteger(value.nextInvoiceNumber)||value.nextInvoiceNumber<1||!value.initialBalances||Object.values(value.initialBalances).some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e12))throw new IdentityError('invalid-argument');return value;
};
export async function manageProductionPlatform(db,auth,input){
 if(!input||!['createCompany','createStore','createDeveloper','setDeveloper'].includes(input.action))throw new IdentityError('invalid-argument');
 const password=input.admin?.password||input.password;
 if(['createDeveloper'].includes(input.action)||input.action==='createCompany'&&input.admin){if(!text(password,256))throw new IdentityError('invalid-argument','La contraseña es obligatoria.');}
 const encoded=password?await hashPassword(password):null;
 const companyRef=input.action==='createCompany'?db.collection('companies').doc():null;
 const storeRef=['createCompany','createStore'].includes(input.action)?db.collection('stores').doc():null;
 const sellerRef=['createCompany','createDeveloper'].includes(input.action)?db.collection('sellers').doc():null;
 const roleRef=['createCompany','createDeveloper'].includes(input.action)?db.collection('roles').doc():null;
 return db.runTransaction(async tx=>{
  const read=async(c,id)=>{const s=await tx.get(db.doc(c+'/'+id));return s.exists?s.data():null;};
  const actor=await verifiedActor(auth,read);if(!actor.developer&&!(input.action==='createStore'&&roleType(actor.role)==='admin'&&actor.role.permissions?.some(p=>['stores','settings'].includes(p))))fail();
  if(input.action==='setDeveloper'){
   if(!actor.owner||input.userId===OWNER_ID||typeof input.active!=='boolean'||!text(input.userId,128)||input.userId.includes('/'))fail();
   const seller=await read('sellers',input.userId);if(!seller||input.active&&seller.isDisabled)fail('Activa el usuario antes de asignarle Developer.');
   tx.update(db.doc('sellers/'+input.userId),{platformRole:input.active?'developer':null,authVersion:(seller.authVersion||0)+1});
   tx.set(db.doc('platformDevelopers/'+input.userId),{userId:input.userId,role:'developer',active:input.active,grantedBy:OWNER_ID,grantedAt:new Date().toISOString()});return{id:input.userId};
  }
  if(input.action==='createStore'){
   if(!text(input.companyId,128)||input.companyId.includes('/'))throw new IdentityError('invalid-argument');
   if(!actor.developer&&input.companyId!==actor.seller.companyId)fail();
   const company=await read('companies',input.companyId);if(!company)throw new IdentityError('not-found');
   const stores=await tx.get(db.collection('stores').where('companyId','==',input.companyId));
   if(Number.isFinite(company.maxStores)&&stores.size>=company.maxStores)throw new IdentityError('resource-exhausted','La empresa alcanzó el límite de sedes.');
   tx.set(storeRef,{...cleanStore(input.store,input.companyId),id:storeRef.id});
   tx.set(db.doc(businessRoot(input.companyId,storeRef.id)),{...emptyBusinessRoot(input.companyId,storeRef.id),ready:true,paymentIndexVersion:1,verifiedAt:new Date().toISOString()});
   tx.update(db.doc('companies/'+input.companyId),{identityRevision:(company.identityRevision||0)+1});return{id:storeRef.id};
  }
  if(input.action==='createDeveloper'&&!actor.owner)fail();
  let companyId,company,storeId;
  if(input.action==='createCompany'){companyId=companyRef.id;company={id:companyId,...cleanCompany(input.company)};storeId=storeRef.id;}
  else{
   if(!text(input.storeId,128)||input.storeId.includes('/'))throw new IdentityError('invalid-argument');
   const store=await read('stores',input.storeId);if(!store)throw new IdentityError('not-found');companyId=store.companyId||'default_company';company=await read('companies',companyId);storeId=input.storeId;if(!company)throw new IdentityError('not-found');
  }
  const admin=input.action==='createDeveloper'?input:input.admin;
  let seller,template,assignedRole=roleRef;
  if(admin){
   if(!text(admin.name,160)||!text(admin.username,160))throw new IdentityError('invalid-argument','Completa nombre y usuario.');
   const templates=await tx.get(db.collection('roles').where('companyId','==','default_company'));
   template=templates.docs.map(d=>({...d.data(),id:d.id})).find(r=>r.name==='Administrator'&&roleType(r)==='admin');if(!template)throw new IdentityError('failed-precondition','No existe el rol Administrator.');
   if(input.action==='createDeveloper'){const ownRoles=await tx.get(db.collection('roles').where('companyId','==',companyId));const existing=ownRoles.docs.find(d=>d.data().name==='Administrator'&&roleType(d.data())==='admin');if(existing)assignedRole=existing.ref;}
   seller=publicSeller(sellerRef.id,{name:admin.name.trim(),username:admin.username.trim(),storeId,roleId:assignedRole.id,companyId,isDisabled:false,authVersion:1,platformRole:input.action==='createDeveloper'?'developer':null});
   for(const alias of aliases(seller))if(await read('authLoginIndex',loginIndexId(alias)))throw new IdentityError('already-exists','Ese nombre o usuario ya identifica a otra persona.');
  }
  if(companyRef){tx.set(companyRef,company);tx.set(storeRef,{...cleanStore({name:input.initialStoreName||'Sede Principal',contactInfo:company.phone},companyId),id:storeRef.id});tx.set(db.doc(businessRoot(companyId,storeId)),{...emptyBusinessRoot(companyId,storeId),ready:true,paymentIndexVersion:1,verifiedAt:new Date().toISOString()});}
  if(seller){
   const permissions=(template.permissions||[]).filter(v=>views.includes(v)&&(!company.allowedViews?.length||company.allowedViews.includes(v)));
   if(assignedRole===roleRef)tx.set(roleRef,{...template,id:roleRef.id,companyId,userType:'admin',permissions});tx.set(sellerRef,seller);tx.set(db.doc('authCredentials/'+seller.id),{passwordHash:encoded,disabled:false});
   for(const alias of aliases(seller))tx.set(db.doc('authLoginIndex/'+loginIndexId(alias)),{sellerId:seller.id});
   if(input.action==='createDeveloper')tx.set(db.doc('platformDevelopers/'+seller.id),{userId:seller.id,role:'developer',active:true,grantedBy:OWNER_ID,grantedAt:new Date().toISOString()});
  }
  return{id:companyRef?.id||sellerRef.id,storeId,...(seller?{sellerId:seller.id}:{})};
 });
}
