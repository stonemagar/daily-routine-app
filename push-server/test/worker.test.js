import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import worker from '../src/index.js';
const origin='https://stonemagar.github.io';
function keys(){const k=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({format:'jwk'});return {publicKey:Buffer.concat([Buffer.from([4]),Buffer.from(k.x,'base64url'),Buffer.from(k.y,'base64url')]).toString('base64url'),privateKey:k.d};}
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const DB={prepare(query){let args=[];const s=sql.prepare(query);const stmt={bind(...values){args=values;return stmt;},async run(){const r=s.run(...args);return {meta:{changes:Number(r.changes)}};},async first(){return s.get(...args)||null;},async all(){return {results:s.all(...args)};}};return stmt;}};
 const vapid=keys(),client=keys();
 const data={timezone:'Europe/London',settings:{beforeMinutes:0,atStart:true,quietHours:false},routines:[{id:'test',title:'Deployment test',startTime:'10:00',endTime:'11:00',days:['Monday']}],completionDate:'2026-10-26',completedToday:[],subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/test-only',keys:{p256dh:client.publicKey,auth:randomBytes(16).toString('base64url')}}};
 const env={DB,APP_ORIGIN:origin,VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:vapid.privateKey,VAPID_SUBJECT:'mailto:test@example.com'};
 const call=(path,method='POST',body=data,token='a'.repeat(64),requestOrigin=origin)=>worker.fetch(new Request('https://worker.example'+path,{method,headers:{Origin:requestOrigin,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='GET'||method==='DELETE'||method==='OPTIONS'?{}:{body:JSON.stringify(body)})}),env);
 return {sql,env,data,call};
}
test('API origin, preflight, authentication, subscription validation and device isolation',async()=>{
 const {sql,call,data}=setup();
 assert.equal((await call('/api/config','GET',null,'','https://evil.example')).status,403);
 assert.equal((await call('/api/config','OPTIONS')).status,204);
 assert.equal((await call('/api/register','POST',data,'invalid')).status,401);
 assert.equal((await call('/api/register','POST',{...data,subscription:{...data.subscription,endpoint:'https://example.com/internal'}})).status,400);
 assert.equal((await call('/api/register')).status,200);
 assert.equal((await call('/api/sync','POST',data,'b'.repeat(64))).status,404);
 assert.equal((await call('/api/sync')).status,200);
 assert.equal(sql.prepare('SELECT count(*) n FROM devices').get().n,1);
 assert.equal((await call('/api/device','DELETE')).status,200);
 assert.equal(sql.prepare('SELECT count(*) n FROM devices').get().n,0);
 sql.close();
});
test('encrypted test push, throttle, cron deduplication, retry and expired cleanup',async(t)=>{
 const {sql,call,env}=setup();let status=201,sent=[];
 t.mock.method(globalThis,'fetch',async(url,request)=>{assert.match(url,/^https:\/\/fcm.googleapis.com\//);assert.equal(request.headers['content-encoding'],'aes128gcm');assert.match(request.headers.authorization,/^vapid /);assert.equal(request.body.byteLength,4096);sent.push(request);return new Response(null,{status});});
 assert.equal((await call('/api/register')).status,200);
 assert.equal((await call('/api/test')).status,200);
 assert.equal((await call('/api/test')).status,429);
 const tick={scheduledTime:Date.parse('2026-10-26T10:00:00Z')};
 status=503;await worker.scheduled(tick,env);assert.equal(sql.prepare('SELECT count(*) n FROM deliveries').get().n,0);
 status=201;await worker.scheduled(tick,env);await worker.scheduled(tick,env);assert.equal(sql.prepare('SELECT count(*) n FROM deliveries').get().n,1);assert.equal(sent.length,3);
 sql.exec('UPDATE devices SET last_test_at=0');status=410;assert.equal((await call('/api/test')).status,410);
 assert.equal(sql.prepare('SELECT count(*) n FROM devices').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM deliveries').get().n,0);
 sql.close();
});
