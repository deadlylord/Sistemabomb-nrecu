import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,readFile,writeFile,rm}from'node:fs/promises';import{join}from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{build}from'esbuild';
test('actual inventory and consolidated export handlers exclude foreign tags, stores and category names',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./.exports-',import.meta.url)));
 try{
 const inv=await readFile('components/InventoryView.tsx','utf8');const settings=await readFile('components/SettingsView.tsx','utf8');
 const boundary=inv.slice(inv.indexOf('  const scope ='),inv.indexOf('  const [',inv.indexOf('  const scope =')));
 const handler=inv.slice(inv.indexOf('  const handleExportToExcel ='),inv.indexOf('  const processedInventory ='));
 const consolidated=settings.slice(settings.indexOf('  const handleExportConsolidatedProducts ='),settings.indexOf('  const handleLabelConfigSave ='));
 const fixture=`import {analyticsScope,selectAnalyticsRows} from './services/analyticsScope';
 export function inventoryExport(args){const {companyId,stores,currentStoreId,rawInventory,rawAllInventory,rawSales,rawPurchases,rawLayaways,rawCategories,rawProductHistory}=args;${boundary}${handler}handleExportToExcel();}
 export function consolidatedExport(args){const {companyId,stores,allInventory,categories}=args;${consolidated}handleExportConsolidatedProducts();}`;
 const result=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',external:['firebase/firestore']});const path=join(dir,'exports.mjs');await writeFile(path,result.outputFiles[0].text);const exports=await import(pathToFileURL(path).href);
 let blob;const originalDocument=globalThis.document,originalURL=URL.createObjectURL;
 globalThis.document={createElement:()=>({download:'',style:{},setAttribute(){},click(){}}),body:{appendChild(){},removeChild(){}}};URL.createObjectURL=value=>{blob=value;return 'blob:test'};
 try{
 const stores=[{id:'m1',companyId:'mayla',name:'Mayla'},{id:'m2',companyId:'mayla'},{id:'foreign',companyId:'other'}];const product=(id,storeId,companyId)=>({id,name:id,storeId,companyId,stock:1,categoryId:'foreign-category',price:10,cost:5});
 const products=[product('OwnProduct','m1','mayla'),product('OtherOwnStore','m2','mayla'),product('PrivateProduct','foreign','other'),product('ForgedProduct','m1','other')];
 const categories=[{id:'foreign-category',companyId:'other',name:'PrivateCategory'}];
 exports.inventoryExport({companyId:'mayla',stores,currentStoreId:'m1',rawInventory:products,rawAllInventory:products,rawSales:[],rawPurchases:[],rawLayaways:[],rawCategories:categories,rawProductHistory:[]});const csv=await blob.text();assert.ok(csv.includes('OwnProduct'));for(const privateName of ['OtherOwnStore','PrivateProduct','ForgedProduct','PrivateCategory'])assert.ok(!csv.includes(privateName));
 exports.consolidatedExport({companyId:'mayla',stores,allInventory:products,categories});const consolidatedCsv=await blob.text();assert.ok(consolidatedCsv.includes('OwnProduct'));assert.ok(consolidatedCsv.includes('OtherOwnStore'));for(const privateName of ['PrivateProduct','ForgedProduct','PrivateCategory'])assert.ok(!consolidatedCsv.includes(privateName));
 }finally{globalThis.document=originalDocument;URL.createObjectURL=originalURL;}
 }finally{await rm(dir,{recursive:true,force:true});}
});
