import {buildPushPayload} from "@block65/webcrypto-web-push";
import {check,dueWindow} from "./scheduler.js";
const response=(x,status=200,h={})=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json",...h}});
const validSub=s=>{try{const u=new URL(s.endpoint);return u.protocol==="https:"&&!u.port&&!u.username&&!u.password&&(u.hostname==="fcm.googleapis.com"||u.hostname==="updates.push.services.mozilla.com"||[".push.apple.com",".push.services.mozilla.com",".notify.windows.com",".push.microsoft.com"].some(k=>u.hostname.endsWith(k)))&&/^[A-Za-z0-9_-]{80,130}$/.test(s.keys.p256dh)&&/^[A-Za-z0-9_-]{16,40}$/.test(s.keys.auth)}catch{return false}};
async function push(env,sub,evt){if(!validSub(sub))return "expired";const req=await buildPushPayload({data:{title:evt.title,body:evt.body,routineId:evt.routineId,tag:evt.key},options:{ttl:3600}},sub,{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});const res=await fetch(sub.endpoint,req);return res.status===404||res.status===410?"expired":res.ok?"ok":"failed"}
async function read(req){if(Number(req.headers.get("content-length")||0)>50000)throw Error("Too large");const data=await req.text();if(data.length>50000)throw Error("Too large");return JSON.parse(data)}
async function idOf(req){const token=(req.headers.get("authorization")||"").replace(/^Bearer /,"");if(!/^[a-f0-9]{64}$/.test(token))return null;return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,"0")).join("")}
export default {
 async fetch(req,env){
  const origin=req.headers.get("origin");if(origin!==env.APP_ORIGIN)return response({error:"Origin not allowed"},403);
  const h={"access-control-allow-origin":origin,"vary":"Origin","access-control-allow-methods":"GET,POST,DELETE,OPTIONS","access-control-allow-headers":"authorization,content-type"};
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h});
  const path=new URL(req.url).pathname;
  if(path==="/api/config"&&req.method==="GET")return response({publicKey:env.VAPID_PUBLIC_KEY||null},200,h);
  if(!["/api/register","/api/sync","/api/device","/api/test"].includes(path))return response({error:"Not found"},404,h);
  const id=await idOf(req);if(!id)return response({error:"Invalid device token"},401,h);
  try{
   if(path==="/api/register"&&req.method==="POST"){
    const body=await read(req),d=check(body);if(!validSub(body.subscription))return response({error:"Invalid subscription"},400,h);
    await env.DB.prepare("INSERT INTO devices(id,subscription_json,data_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription_json=excluded.subscription_json,data_json=excluded.data_json,updated_at=excluded.updated_at").bind(id,JSON.stringify(body.subscription),JSON.stringify(d),Date.now()).run();
    return response({ok:true},200,h);
   }
   if(path==="/api/sync"&&req.method==="POST"){
    const d=check(await read(req)),r=await env.DB.prepare("UPDATE devices SET data_json=?,updated_at=? WHERE id=?").bind(JSON.stringify(d),Date.now(),id).run();
    return response(r.meta?.changes?{ok:true}:{error:"Device not registered"},r.meta?.changes?200:404,h);
   }
   if(path==="/api/device"&&req.method==="DELETE"){await env.DB.prepare("DELETE FROM devices WHERE id=?").bind(id).run();return response({ok:true},200,h)}
   if(path==="/api/test"&&req.method==="POST"){
    const d=await env.DB.prepare("SELECT * FROM devices WHERE id=?").bind(id).first();if(!d)return response({error:"Not registered"},404,h);
    if(Date.now()-d.last_test_at<30000)return response({error:"Wait 30 seconds"},429,h);
    await env.DB.prepare("UPDATE devices SET last_test_at=? WHERE id=?").bind(Date.now(),id).run();
    const result=await push(env,JSON.parse(d.subscription_json),{title:"Test notification",body:"Your My Routine push notifications are ready!",routineId:null,key:"test:"+Date.now()});
    if(result==="expired"){await env.DB.prepare("DELETE FROM devices WHERE id=?").bind(id).run();return response({error:"Subscription expired"},410,h)}
    return response(result==="ok"?{ok:true}:{error:"Push service rejected request"},result==="ok"?200:502,h);
   }
   return response({error:"Method not allowed"},405,h);
  }catch(e){console.error("Push API failure",String(e));return response({error:"Invalid request or server unavailable"},400,h)}
 },
 async scheduled(controller,env){
  const devices=await env.DB.prepare("SELECT * FROM devices LIMIT 500").all();
  for(const d of devices.results||[]){
   try{
    const data=JSON.parse(d.data_json),events=dueWindow(new Date(controller.scheduledTime),data);
    for(const event of events){
     const r=await env.DB.prepare("INSERT OR IGNORE INTO deliveries(device_id,event_key,created_at) VALUES(?,?,?)").bind(d.id,event.key,Date.now()).run();
     if(!r.meta?.changes)continue;
     let status="failed";try{status=await push(env,JSON.parse(d.subscription_json),event)}catch(e){console.error("Delivery error",String(e))}
     if(status==="expired"){await env.DB.prepare("DELETE FROM devices WHERE id=?").bind(d.id).run();break}
     if(status==="failed")await env.DB.prepare("DELETE FROM deliveries WHERE device_id=? AND event_key=?").bind(d.id,event.key).run();
    }
   }catch(e){console.error("Schedule error",String(e))}
  }
  await env.DB.prepare("DELETE FROM deliveries WHERE created_at<?").bind(Date.now()-35*86400000).run();
 }
};