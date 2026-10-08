/**
 * Seed seguro para Firebase STAGING de Vestika.
 * Requiere variables VITE_FIREBASE_* de staging.
 * --second-store preserva datos existentes y valida stagingadmin sin pedir contraseña.
 * El modo inicial sin flags requiere STAGING_SEED_USERNAME / STAGING_SEED_PASSWORD.
 * Usa SDK cliente: respeta las reglas de Firestore y no contiene credenciales ni service accounts.
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, writeBatch, runTransaction } from 'firebase/firestore';
import { assertStagingConfig, seedSecondStore, SECOND_STORE } from './stagingSecondStore.mjs';

const REQUIRED_PROJECT_ID = 'vestika-staging';
const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};
if (config.projectId !== REQUIRED_PROJECT_ID) {
  throw new Error(`SAFETY STOP: seed permitido únicamente en ${REQUIRED_PROJECT_ID}; recibido ${config.projectId || '(vacío)'}`);
}
if (config.authDomain !== 'vestika-staging.firebaseapp.com') {
  throw new Error('SAFETY STOP: authDomain no corresponde a staging');
}
assertStagingConfig(config);

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--second-store') || args.length > 1) throw new Error('Uso: node scripts/seed-staging.mjs [--second-store]');
if (args.includes('--second-store')) {
  const app = initializeApp(config);
  try {
    await signInAnonymously(getAuth(app));
    const created = await seedSecondStore(getFirestore(app), { doc, runTransaction });
    console.log(`Seed staging: ${SECOND_STORE}, ${created} documentos nuevos; datos existentes intactos.`);
  } finally { await deleteApp(app); }
} else {

const username = process.env.STAGING_SEED_USERNAME;
const password = process.env.STAGING_SEED_PASSWORD;
if (!username || !password) throw new Error('Define STAGING_SEED_USERNAME y STAGING_SEED_PASSWORD');

const COMPANY_ID='staging_company', STORE_ID='staging_store_01', ROLE_ID='staging_admin_role';
const SELLER_ID='staging_admin', CATEGORY_ID='staging_category_01';
const views=['dashboard','pos','inventory','inventory_transfer','layaway','purchases','sellers','stores','customers','stock_take_history','payroll','settings','incidents','role_manager','accounting','financial_reconciliation','gift_vouchers','ceo_center','tag_scanning'];

const app=initializeApp(config);
await signInAnonymously(getAuth(app));
const db=getFirestore(app), batch=writeBatch(db), now=new Date().toISOString();

batch.set(doc(db,'companies',COMPANY_ID),{id:COMPANY_ID,name:'Vestika Staging',status:'active',maxStores:5,maxAdmins:5,maxSellers:20,createdAt:now,allowedViews:views,primaryColor:'#7c3aed',primaryColorHover:'#6d28d9',secondaryColor:'#ec4899'});
batch.set(doc(db,'stores',STORE_ID),{id:STORE_ID,companyId:COMPANY_ID,name:'Tienda Pruebas',receiptName:'VESTIKA STAGING',logo:null,contactInfo:'Ambiente de pruebas',footerText:'Documento de prueba - sin valor comercial',whatsappFooterText:'Prueba Vestika',addiLink:'',sistecreditoLink:'',accentColor:'#7c3aed',accentColorHover:'#6d28d9',secondaryColor:'#ec4899',nextInvoiceNumber:1,initialBalances:{cash:0,qr:0},accountNames:{cash:'Efectivo',qr:'QR'},paymentCommissions:{},paymentSurcharges:{}});
batch.set(doc(db,'roles',ROLE_ID),{id:ROLE_ID,companyId:COMPANY_ID,name:'Administrador Staging',userType:'admin',permissions:views});
batch.set(doc(db,'sellers',SELLER_ID),{id:SELLER_ID,companyId:COMPANY_ID,storeId:STORE_ID,roleId:ROLE_ID,name:'Administrador Staging',username,password,isDisabled:false});
batch.set(doc(db,'categories',CATEGORY_ID),{id:CATEGORY_ID,companyId:COMPANY_ID,name:'Pruebas'});
for(const p of [
 {id:'staging_product_01',sku:'TEST001',name:'Producto Prueba 1',price:50000,cost:25000,stock:10},
 {id:'staging_product_02',sku:'TEST002',name:'Producto Prueba 2',price:80000,cost:40000,stock:6},
 {id:'staging_product_03',sku:'TEST003',name:'Producto Prueba Sin Stock',price:65000,cost:30000,stock:0}
]) batch.set(doc(db,'inventory',p.id),{...p,companyId:COMPANY_ID,storeId:STORE_ID,categoryId:CATEGORY_ID,description:'Dato exclusivo de staging',imageUrl:'',supplier:'Proveedor Prueba',isDisabled:false});

await batch.commit();
console.log(`Seed staging completado en ${config.projectId}: ${COMPANY_ID} / ${STORE_ID}`);
await deleteApp(app);
}
