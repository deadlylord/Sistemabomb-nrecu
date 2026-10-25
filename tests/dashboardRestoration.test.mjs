import {activityProjection,activityMonth} from '../functions/src/dashboardActivity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { browserGlobals } from './helpers/developerSession.mjs';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
test('original dashboard retains payment breakdown, editable history, price differences, categories and top products', async () => {
  const restore = browserGlobals(), dir = await mkdtemp(join(process.cwd(), 'tests/.dashboard-'));
  let renderer;
  const scrolled = [];
  globalThis.document.getElementById = id => ({scrollIntoView:()=>scrolled.push(id)});
  try {
    const result = await build({
      stdin: {contents: "export {default as Dashboard} from './components/DashboardView';export {PaymentMethod,View} from './types';", resolveDir:process.cwd()},
      bundle: true, write: false, format: 'esm', platform: 'node', external: ['react', 'firebase/firestore'],
      plugins: [{ name: 'dashboard-fixtures', setup(b) {
        b.onResolve({filter:/\.\/(SalesHistoryChart|CategorySalesChart|EditSaleModal|EditLayawayModal|DeleteConfirmationModal)$/},a=>({path:a.path.slice(2),namespace:'fixture'}));
        b.onResolve({filter:/services\/geminiService$/},()=>({path:'ai',namespace:'fixture'}));
        b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='ai' ? 'export const analyzeSalesData=async()=>"";' : `import React from 'react';export function ${a.path}(props){return React.createElement('fixture',{...props,screen:'${a.path}'});}export default ${a.path};`}));
      }}]
    });
    const file=join(dir,'dashboard.mjs');await writeFile(file,result.outputFiles[0].text);
    const {Dashboard,PaymentMethod}=await import(pathToFileURL(file).href);
    const day=new Date();day.setHours(12,0,0,0);
    const product={id:'p1',companyId:'a',storeId:'a1',name:'Vestido prueba',stock:5,price:50000,cost:20000,categoryId:'cat'};
    const sale={id:'s1',companyId:'a',storeId:'a1',createdAt:day.toISOString(),invoiceNumber:101,seller:'Ana',customerName:'Cliente prueba',items:[{...product,quantity:2,price:45000}],totalAmount:90000,paymentMethod:PaymentMethod.Efectivo,payments:[{date:day.toISOString(),amount:90000,method:PaymentMethod.Efectivo,seller:'Ana'}]};
    const foreign={...sale,id:'foreign',companyId:'b',storeId:'b1',customerName:'EXCLUDED'};
    const store={id:'a1',companyId:'a',name:'Sede Uno'};
    const props={companyId:'a',stores:[store],currentStore:store,currentUser:{id:'u',name:'Ana',roleId:'admin'},roles:[{id:'admin',name:'Administrator'}],sales:[sale,foreign],inventory:[product],layaways:[],expenses:[],purchases:[],allSales:[sale,foreign],allInventory:[product],allLayaways:[],allIncidents:[{id:'pending-inconsistency',companyId:'a',storeId:'a1',type:'Inconsistencia de Inventario',status:'Registrado',createdAt:day.toISOString(),sellerName:'Ana',description:'Conteo pendiente'}],dailyNotes:[],categories:[{id:'cat',companyId:'a',name:'Vestidos'}],sellers:[{id:'u',name:'Ana'}],onSwitchStore(){},onNavigate(){},onOpenReports(){},onOpenVerification(){},onUpdateSale(){},onDeleteSale(){},onReprintSale(){}};
    await act(async()=>{renderer=create(React.createElement(Dashboard,props));});
    const text=()=>JSON.stringify(renderer.toJSON());
    for(const label of ['Resumen del negocio','Medios de pago','Top Productos','Ventas por Categoría','Historial de Ventas','Análisis de Precios y Diferencias','Vestido prueba','Cliente prueba']) assert.ok(text().includes(label),label);
    assert.equal(text().includes('EXCLUDED'),false);
    assert.equal(text().includes('Descuadre'),false,'the difference alert is absent on mobile and desktop even with pending discrepancies');
    assert.equal(renderer.root.findAllByType('button').filter(n=>n.props.onClick===props.onOpenVerification).length,2,'mobile and desktop inventory verification controls remain available');
    for(const id of ['payment-report','price-analysis','sales-history','sales-chart'])assert.ok(renderer.root.findByProps({id}));
    const bar=renderer.root.findAllByType('div').find(n=>n.props.className?.includes('lg:hidden fixed inset-x-0'));
    for(const [label,id] of [['Pagos','payment-report'],['Precios','price-analysis'],['Historial','sales-history'],['Gráficos','sales-chart']]){
      await act(async()=>bar.findAllByType('button').find(n=>n.children.join('')===label).props.onClick());
      assert.equal(scrolled.at(-1),id);
    }
    const year=new Date().getFullYear();
    await act(async()=>renderer.update(React.createElement(Dashboard,{...props,monthlySummary:{ready:true,loading:false,chartLoading:false,error:null,days:[],months:[{month:year+'-01',days:{[year+'-01-01']:{income:12345,sales:8000}}}],total:()=>({income:0})}})));
    assert.equal(renderer.root.findByProps({screen:'SalesHistoryChart'}).props.data[0].total,12345,'visible January column comes from monthly summary, independent of loaded current-month sales');
    await act(async()=>renderer.update(React.createElement(Dashboard,props)));
    const chartData = renderer.root.findByProps({screen:'SalesHistoryChart'}).props.data;
    const search = () => renderer.root.findByProps({placeholder:'Factura, cliente, producto...'});
    await act(async()=>search().props.onChange({target:{value:'ningún resultado'}}));
    assert.equal(text().includes('Cliente prueba'),false);
    assert.equal(renderer.root.findByProps({screen:'SalesHistoryChart'}).props.data,chartData,'search reuses chart calculations when source data and dates have not changed');
    await act(async()=>search().props.onChange({target:{value:''}}));
    assert.ok(text().includes('Cliente prueba'));
    const priceSection=renderer.root.findByProps({id:'price-analysis'});
    await act(async()=>priceSection.findAllByType('div').find(n=>n.props.onClick).props.onClick());
    assert.ok(priceSection.findAllByType('table').length>0,'price differences retain their detailed table');
    const originalPriceRows=JSON.stringify(priceSection.findByType('tbody').children.map(n=>n.findAllByType('td').map(td=>td.children.map(c=>typeof c==='string'?c:JSON.stringify(c.props.children)))));
    const edit=renderer.root.findAllByType('button').find(n=>n.props.title==='Editar');assert.ok(edit);
    await act(async()=>edit.props.onClick({stopPropagation(){}}));
    assert.equal(renderer.root.findByProps({screen:'EditSaleModal'}).props.sale.id,'s1');
    assert.equal(renderer.root.findByProps({screen:'EditSaleModal'}).props.onUpdateSale,props.onUpdateSale);
    const inventoryRequests=[];
    const onInventoryRequest=request=>inventoryRequests.push(request);
    const optimized={...props,inventory:[],inventorySummary:{value:999999},onInventoryRequest,inventoryStatus:{loading:true,error:'',editReady:false}};
    await act(async()=>renderer.update(React.createElement(Dashboard,optimized)));
    assert.equal(renderer.root.findAllByProps({screen:'EditSaleModal'}).length,0,'editor must not open with a partial catalog');
    assert.ok(text().includes('Cargando productos para editar'));
    assert.equal(inventoryRequests.at(-1).full,true);assert.deepEqual(inventoryRequests.at(-1).productIds,['p1']);
    const inventoryLabel=renderer.root.findAllByType('p').find(n=>n.children.join('')==='Valor del inventario');
    assert.equal(inventoryLabel.parent.findAllByType('p')[1].children.join('').replace(/\D/g,''),'999999','inventory card uses verified total, never partial product sum');
    await act(async()=>renderer.update(React.createElement(Dashboard,{...optimized,inventory:[product],inventoryStatus:{loading:false,error:'',editReady:true}})));
    assert.equal(renderer.root.findByProps({screen:'EditSaleModal'}).props.inventory.length,1);
    const optimizedPriceRows=JSON.stringify(renderer.root.findByProps({id:'price-analysis'}).findByType('tbody').children.map(n=>n.findAllByType('td').map(td=>td.children.map(c=>typeof c==='string'?c:JSON.stringify(c.props.children)))));
    assert.equal(optimizedPriceRows,originalPriceRows,'current product prices and discount differences remain identical');
    await act(async()=>renderer.root.findByProps({screen:'EditSaleModal'}).props.onClose());
    assert.equal(inventoryRequests.at(-1).full,false,'closing editor releases full catalog request without another user action');
    const extraLayaways=[
      {id:'current-layaway',companyId:'a',storeId:'a1',createdAt:day.toISOString(),invoiceNumber:202,seller:'Ana',status:'active',customerName:'Abono de prueba',customerPhone:'300',items:[{...product,quantity:1,price:40000}],totalAmount:40000,discountAmount:1000,payments:[{date:day.toISOString(),method:PaymentMethod.QR,amount:15000,seller:'Ana'}],notes:'ORIGINAL NOTES'},
      {id:'old-payment',companyId:'a',storeId:'a1',createdAt:'2020-01-02T12:00:00Z',invoiceNumber:203,seller:'Ana',status:'cancelled',items:[],totalAmount:10000,payments:[{date:day.toISOString(),method:PaymentMethod.Efectivo,amount:5000,seller:'Ana'}]},
      {id:'old-unused',companyId:'a',storeId:'a1',createdAt:'2016-01-02T12:00:00Z',invoiceNumber:204,seller:'Ana',status:'completed',items:[],totalAmount:10000,payments:[]}
    ];
    const extraIncidents=[...props.allIncidents,{id:'cash',companyId:'a',storeId:'a1',createdAt:day.toISOString(),type:'Recaudo',status:'Registrado',adjustmentAmount:7000,description:'Recaudo prueba',originalSaleInvoiceNumber:99,sellerName:'Ana',customerName:'Cliente recaudo'}];
    const complete={...props,layaways:extraLayaways,allIncidents:extraIncidents};
    await act(async()=>renderer.update(React.createElement(Dashboard,complete)));
    const originalTree=JSON.stringify(renderer.toJSON()),month=activityMonth(day.toISOString());
    const projected=(kind,rows)=>rows.filter(row=>activityProjection(kind,row).months.some(m=>m===month||m==='pending')).map(row=>({...activityProjection(kind,row).record,id:row.id}));
    const compact={...complete,layaways:projected('layaways',extraLayaways),allIncidents:projected('incidents',extraIncidents),activityMonths:extraLayaways.map(v=>activityMonth(v.createdAt))};
    await act(async()=>renderer.update(React.createElement(Dashboard,compact)));
    assert.equal(JSON.stringify(renderer.toJSON()),originalTree,'all visible figures, payment references, categories, prices, history and available months stay identical with compact monthly data');
    await act(async()=>renderer.update(React.createElement(Dashboard,{...compact,activityLoading:true})));
    const incomeLabel=renderer.root.findAllByType('p').find(p=>p.children.join('')==='Ingresos del período');assert.equal(incomeLabel.parent.findAllByType('p')[1].children.join(''),'—','pending sources must not be presented as zero income');
    await act(async()=>renderer.update(React.createElement(Dashboard,compact)));
    const fresh={...extraLayaways[0],notes:'FRESH ORIGINAL NOTES',totalAmount:41000};let resolve;
    await act(async()=>renderer.update(React.createElement(Dashboard,{...compact,onResolveLayaway:()=>new Promise(r=>resolve=r)})));
    const editButtons=renderer.root.findAllByType('button').filter(n=>n.props.title==='Editar');
    const layawayButton=editButtons.find(n=>{let row=n;while(row&&row.type!=='tr')row=row.parent;return row?.findAllByType('p').some(p=>p.children.join('')==='Abono de prueba');});
    assert.ok(layawayButton);await act(async()=>layawayButton.props.onClick({stopPropagation(){}}));
    assert.equal(renderer.root.findAllByProps({screen:'EditLayawayModal'}).length,0,'the compact read model never enters the editor as the authoritative original');
    await act(async()=>resolve(fresh));assert.equal(renderer.root.findByProps({screen:'EditLayawayModal'}).props.layaway.notes,'FRESH ORIGINAL NOTES');
    await act(async()=>renderer.root.findByProps({screen:'EditLayawayModal'}).props.onClose());
    let receipt;await act(async()=>renderer.update(React.createElement(Dashboard,{...compact,onResolveLayaway:async()=>fresh,onReprintSale:value=>{receipt=value;}})));
    let printRow=renderer.root.findAllByType('tr').find(row=>row.findAllByType('p').some(p=>p.children.join('')==='Abono de prueba'));
    await act(async()=>printRow.findAllByType('button').find(b=>b.props.title==='Reimprimir Factura').props.onClick({stopPropagation(){}}));
    assert.equal(receipt.notes,'FRESH ORIGINAL NOTES','reprinting also reads the full original');


  } finally {
    if(renderer)await act(async()=>renderer.unmount());
    restore();await rm(dir,{recursive:true,force:true});
  }
});
