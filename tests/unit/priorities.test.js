const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function services(fetch) {
  const context={window:{},fetch,AbortController,DOMException,TypeError,Date,Map,Promise,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('trip-services.js','utf8'),context);
  return context.window.CarburantiServices;
}
test('trip request reports timeout and aborts transport',async()=>{
  const api=services((url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
  await assert.rejects(api.json('https://example.test',{timeout:15,label:'Percorso'}),/tempo di attesa/);
});
test('429 is actionable and does not immediately repeat requests',async()=>{
  let count=0;const api=services(async()=>{count++;return {ok:false,status:429};});
  await assert.rejects(api.json('https://example.test'),/Attendi un minuto/);assert.equal(count,1);
});
test('cancelling a trip preserves cancellation instead of displaying timeout',async()=>{
  const controller=new AbortController();
  const api=services((url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
  const pending=api.json('https://example.test',{signal:controller.signal});controller.abort();
  await assert.rejects(pending,{name:'AbortError'});
});
test('geocoding cache avoids repeated requests and serializes new searches',async()=>{
  const started=[];const api=services(async url=>{started.push(Date.now());return {ok:true,json:async()=>[{name:url}]};});
  await Promise.all([api.geocode('Lucca'),api.geocode('Prato')]);
  await api.geocode('Lucca');assert.equal(started.length,2);assert.ok(started[1]-started[0]>=1050);
});
function worker(fetch, cached=null) {
  const events={};const cache={match:async()=>cached,put:async()=>{}};
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self:{addEventListener:(name,fn)=>events[name]=fn,location:{origin:'https://app.test'},registration:{scope:'https://app.test/Carburanti/'}},caches:{open:async()=>cache},URL,Request,Response,Headers,fetch});
  return async (path,mode)=>{let response;events.fetch({request:{url:'https://app.test/Carburanti/'+path,method:'GET',mode},respondWith:r=>response=r});return response;};
}
test('offline missing script returns 503 rather than HTML',async()=>{
  const fetch=worker(async()=>{throw new Error('offline');});
  const response=await fetch('missing.js','cors');assert.equal(response.status,503);assert.equal(await response.text(),'');
});
test('offline cached dataset is marked as a local copy',async()=>{
  const fetch=worker(async()=>{throw new Error('offline');},new Response('{"stations":[]}',{headers:{'Content-Type':'application/json'}}));
  const response=await fetch('data/stations.json','cors');assert.equal(response.headers.get('X-Carburanti-Offline'),'1');
});
test('transient HTTP error can reuse the last valid shell response',async()=>{
  const fetch=worker(async()=>new Response('failure',{status:503}),new Response('valid-script'));
  assert.equal(await (await fetch('app.js','cors')).text(),'valid-script');
});
