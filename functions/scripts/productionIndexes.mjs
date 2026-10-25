import {productionAccess,PRODUCTION_PROJECT} from './productionAccess.mjs';
const specs=[{collection:'sales',fields:[{fieldPath:'storeId',order:'ASCENDING'},{fieldPath:'createdAt',order:'ASCENDING'}]},{collection:'repeats',fields:[{fieldPath:'lastDay',order:'ASCENDING'},{fieldPath:'firstDay',order:'ASCENDING'}]}];
export async function prepareProductionIndexes(){const {db,request}=await productionAccess();try{
 const results=[];for(const spec of specs){const url=`https://firestore.googleapis.com/v1/projects/${PRODUCTION_PROJECT}/databases/(default)/collectionGroups/${spec.collection}/indexes`;
  const matches=i=>i.queryScope==='COLLECTION'&&JSON.stringify((i.fields||[]).filter(f=>f.fieldPath!=='__name__'))===JSON.stringify(spec.fields);
  let rows=await request(url),index=rows.indexes?.find(matches);
  if(!index){await request(url,{method:'POST',body:JSON.stringify({queryScope:'COLLECTION',fields:spec.fields})});rows=await request(url);index=rows.indexes?.find(matches);}
  results.push({collection:spec.collection,state:index?.state||'CREATING'});
 }return{projectId:PRODUCTION_PROJECT,indexes:results,ready:results.every(r=>r.state==='READY')};
}finally{await db.terminate();}}
if(process.argv[1]?.endsWith('/productionIndexes.mjs'))console.log(JSON.stringify(await prepareProductionIndexes()));
