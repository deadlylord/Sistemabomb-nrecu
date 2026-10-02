import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
function worker({offline=false,policy='',redirected=false}={}) {
 const handlers={},puts=[],deleted=[],matches=[],pending=[];
 const cache={addAll:async()=>{},put:async request=>puts.push(request.url),match:async request=>{matches.push(typeof request==='string'?request:request.url);return request==='/'?new Response('shell'):undefined}};
 vm.runInNewContext(source,{URL,Response,console,self:{location:{origin:'https://vestika.test'},skipWaiting(){},clients:{claim:async()=>{}},addEventListener:(name,handler)=>handlers[name]=handler},caches:{open:async()=>cache,match:async request=>cache.match(request),keys:async()=>['bombon-pos-cache-old','another-app-cache'],delete:async name=>deleted.push(name)},fetch:async()=>{if(offline)throw Error('offline');const response=new Response('asset',{headers:{'Cache-Control':policy,'Content-Type':'application/javascript'}});Object.defineProperty(response,'redirected',{value:redirected});return response}});
 return {puts,deleted,matches,handlers,async request(path,extra={}) {let result;handlers.fetch({request:{url:path.startsWith('http')?path:'https://vestika.test'+path,method:'GET',headers:new Headers(),cache:'default',...extra},respondWith(value){result=value},waitUntil(value){pending.push(value)}});if(!result)return undefined;const response=await result;await Promise.all(pending);return response;}};
}
test('service worker never intercepts business APIs, other origins, authenticated or no-store requests',async()=>{
 const w=worker();
 for(const path of ['/api/sales','/companies/mayla','https://vestika.test.attacker.test/assets/app.js','https://firestore.googleapis.com/assets/app.js'])assert.equal(await w.request(path),undefined);
 assert.equal(await w.request('/assets/app.js',{headers:new Headers({Authorization:'Bearer test'})}),undefined);
 assert.equal(await w.request('/assets/app.js',{cache:'no-store'}),undefined);
 assert.equal(await w.request('/assets/app.js',{method:'POST'}),undefined);
 assert.deepEqual(w.puts,[]);
});
test('service worker caches static files only and honors private response policies',async()=>{
 const w=worker();assert.equal((await w.request('/assets/app.js')).status,200);assert.deepEqual(w.puts,['https://vestika.test/assets/app.js']);
 for(const options of [{policy:'private'},{policy:'no-store'},{redirected:true}]){const privateWorker=worker(options);await privateWorker.request('/index.html');assert.deepEqual(privateWorker.puts,[]);}
});
test('offline shell stays within current cache and activation preserves unrelated caches',async()=>{
 const w=worker({offline:true});assert.equal(await (await w.request('/index.html',{mode:'navigate'})).text(),'shell');
 let activation;w.handlers.activate({waitUntil(p){activation=p}});await activation;assert.deepEqual(w.deleted,[]) /* retain the prior release for open tabs */;
 assert.deepEqual(w.matches,['https://vestika.test/index.html','/']);
});
