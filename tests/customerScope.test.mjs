import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,writeFile,rm}from'node:fs/promises';import{join}from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{build}from'esbuild';import React from'react';import{renderToStaticMarkup}from'react-dom/server';
test('customer history excludes matching names and phones from another company or store',async()=>{
 const dir=await mkdtemp(fileURLToPath(new URL('./.customers-',import.meta.url)));
 try{
 const result=await build({entryPoints:['components/CustomersView.tsx'],bundle:true,write:false,format:'esm',platform:'node',external:['react','firebase/firestore']});const path=join(dir,'view.mjs');await writeFile(path,result.outputFiles[0].text);const{default:Customers}=await import(pathToFileURL(path).href);
 const now=new Date().toISOString();const sale=(storeId,companyId,totalAmount)=>({id:storeId+companyId,storeId,companyId,createdAt:now,customerName:'Ana',customerPhone:'3001234567',totalAmount,items:[{id:'p',quantity:1}]});
 const html=renderToStaticMarkup(React.createElement(Customers,{companyId:'mayla',storeId:'m1',allCustomers:[{id:'own',storeId:'m1',name:'Ana',phone:'3001234567'},{id:'bad',storeId:'m1',companyId:'other',name:'Privado',phone:'3001234567'}],sales:[sale('m1','mayla',10),sale('m1','other',999),sale('m2','mayla',888)],layaways:[]}));
 assert.ok(html.includes('Ana'));assert.ok(!html.includes('Privado'));assert.ok(!html.includes('999'));assert.ok(!html.includes('888'));assert.ok(html.includes('10'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
