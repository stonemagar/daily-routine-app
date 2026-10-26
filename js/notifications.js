/* Web Push settings and device registration. The existing app retains local routine storage. */
(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const status = el("pushStatus");
  if (!status) return;
  const enable = el("pushEnable"), disable = el("pushDisable"), test = el("pushTest");
  const before = el("pushBefore");
  const fields = [["pushAtStart","atStart"],["pushIncomplete","incomplete"],["pushMorning","morning"],["pushSummary","summary"],["pushQuiet","quietHours"]];
  const PREF = "routine-push-preferences-v1", DEVICE = "routine-push-device-token-v1", ENABLED = "routine-push-enabled";
  const DEFAULT = { beforeMinutes:10,atStart:true,incomplete:false,morning:false,summary:true,quietHours:true };
  const base = (window.ROUTINE_PUSH_CONFIG?.apiBaseUrl || "").replace(/\/$/,"");
  let active = localStorage.getItem(ENABLED) === "yes", timer = null;
  function announce(s,bad=false) { status.textContent=s; status.classList.toggle("push-error",bad); }
  function prefs() {
    const p={beforeMinutes:Number(before.value)};
    for (const [id,key] of fields) p[key]=el(id).checked;
    return p;
  }
  function loadPrefs() {
    let p=DEFAULT;
    try { p={...DEFAULT,...JSON.parse(localStorage.getItem(PREF) || "{}")}; } catch {}
    before.value=String([0,5,10,15,30].includes(p.beforeMinutes)?p.beforeMinutes:10);
    for(const [id,key] of fields) el(id).checked=typeof p[key]==="boolean"?p[key]:DEFAULT[key];
  }
  function buttons() { enable.hidden=active;disable.hidden=!active;test.disabled=!active; }
  function deviceToken() {
    let token=localStorage.getItem(DEVICE);
    if(!token || !/^[0-9a-f]{64}$/.test(token)) {
      const data=crypto.getRandomValues(new Uint8Array(32));
      token=Array.from(data,x=>x.toString(16).padStart(2,"0")).join("");
      localStorage.setItem(DEVICE,token);
    }
    return token;
  }
  function today() {
    const d=new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  }
  function snapshot() {
    const date=today();
    const rs=JSON.parse(localStorage.getItem("routines") || "[]");
    const history=JSON.parse(localStorage.getItem("completionHistory") || "{}");
    return {timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,settings:prefs(),
      routines:rs.map(r=>({id:r.id,title:r.title,days:Array.isArray(r.days)?r.days:[r.day],startTime:r.startTime,endTime:r.endTime})),
      completionDate:date,completedToday:Array.isArray(history[date])?history[date]:[]};
  }
  async function api(path,method="POST",body) {
    if(!base || !base.startsWith("https://")) throw Error("Deploy the push Worker and enter its HTTPS URL in js/push-config.js.");
    const response=await fetch(base+path,{method,headers:{"authorization":"Bearer "+deviceToken(),...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw Error(data.error || "Push server returned HTTP "+response.status);
    return data;
  }
  function decodeKey(s) {
    const value=atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4));
    return Uint8Array.from(value,c=>c.charCodeAt(0));
  }
  function encodeKey(raw) {
    return btoa(String.fromCharCode(...new Uint8Array(raw))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }
  async function registration() {
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)) throw Error("Push unavailable. On iPhone, install the app to your Home Screen first.");
    await navigator.serviceWorker.register("./service-worker.js");
    return navigator.serviceWorker.ready;
  }
  async function subscribe() {
    const key=(await api("/api/config","GET")).publicKey;
    if(!key) throw Error("The push server has no VAPID public key configured.");
    const reg=await registration();
    let sub=await reg.pushManager.getSubscription();
    if(sub && (!sub.options?.applicationServerKey || encodeKey(sub.options.applicationServerKey)!==key)) { await sub.unsubscribe();sub=null; }
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(key)});
    return sub;
  }
  async function sync() { if(active) await api("/api/sync","POST",snapshot()); }
  function queueSync() {
    if(!active) return;
    clearTimeout(timer);
    timer=setTimeout(()=>sync().catch(e=>announce("Cannot sync reminders: "+e.message,true)),800);
  }
  enable.addEventListener("click",async()=>{
    enable.disabled=true;
    try {
      if(!base) throw Error("First configure the push Worker URL in js/push-config.js.");
      if(!("Notification" in window)||!("PushManager" in window)||!("serviceWorker" in navigator)) throw Error("This device does not support Web Push in this app.");
      const permission=await Notification.requestPermission();
      if(permission!=="granted") throw Error("Notifications not allowed. Check your browser and device settings.");
      const sub=await subscribe();
      await api("/api/register","POST",{...snapshot(),subscription:sub.toJSON()});
      active=true;localStorage.setItem(ENABLED,"yes");buttons();
      announce("Push notifications enabled. Try sending a test notification.");
    } catch(e) { announce(e.message,true); }
    finally { enable.disabled=false; }
  });
  disable.addEventListener("click",async()=>{
    disable.disabled=true;
    let failed=false;
    try { await api("/api/device","DELETE"); } catch(e) { failed=true;console.warn("Unregister failed",e); }
    try { (await (await registration()).pushManager.getSubscription())?.unsubscribe(); } catch(e) { console.warn("Unsubscribe failed",e); }
    active=false;localStorage.removeItem(ENABLED);buttons();disable.disabled=false;
    announce(failed?"Device disabled but server removal needs retry when online.":"Notifications disabled.",failed);
  });
  test.addEventListener("click",async()=>{
    test.disabled=true;
    try { await sync();await api("/api/test");announce("Test accepted by push service. Check your device."); }
    catch(e) { announce(e.message,true); }
    finally { test.disabled=!active; }
  });
  loadPrefs();
  [before,...fields.map(([id])=>el(id))].forEach(control=>control.addEventListener("change",()=>{
    localStorage.setItem(PREF,JSON.stringify(prefs()));queueSync();
  }));
  window.addEventListener("routine-data-changed",queueSync);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible") queueSync();});
  navigator.serviceWorker?.addEventListener("message",e=>{
    if(e.data?.type==="ROUTINE_PUSH") announce(e.data.title+": "+e.data.body);
  });
  if(active && (!("Notification" in window)||Notification.permission!=="granted")) {
    active=false;localStorage.removeItem(ENABLED);
  }
  buttons();
  announce(!base?"Deployment required: configure the Worker URL in js/push-config.js.":active?"Push enabled on this device.":"Enable notifications to receive scheduled reminders.");
  if(active) queueSync();
  // Show the linked routine when a push is tapped.
  const id=new URL(location.href).searchParams.get("routine");
  if(id && /^[\w-]{1,128}$/.test(id)) {
    const day=el("dayFilter"), category=el("categoryFilter"), search=el("searchInput");
    if(day&&category&&search&&typeof renderRoutines==="function") {
      day.value="All";category.value="All";search.value="";renderRoutines();
      const item=[...document.querySelectorAll("[data-routine-id]")].find(n=>n.dataset.routineId===id);
      if(item) { item.classList.add("push-highlight");item.scrollIntoView({block:"center"}); }
    }
    const url=new URL(location.href);url.searchParams.delete("routine");history.replaceState(null,"",url.href);
  }
})();
