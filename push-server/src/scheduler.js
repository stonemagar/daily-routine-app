export const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const m=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
export function check(d){
 if(!d||!Array.isArray(d.routines)||d.routines.length>150||!d.settings)throw Error("Invalid payload");
 new Intl.DateTimeFormat("en",{timeZone:d.timezone});
 if(![0,5,10,15,30].includes(d.settings.beforeMinutes))throw Error("Invalid lead time");
 const mode=d.settings.timezoneMode||"device";
 if(!["device","fixed"].includes(mode))throw Error("Invalid time zone mode");
 if(mode==="fixed"&&d.settings.fixedTimezone!==d.timezone)throw Error("Fixed zone must match schedule zone");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.completionDate)||!Array.isArray(d.completedToday))throw Error("Invalid history");
 for(const r of d.routines)if(!/^[\w-]{1,128}$/.test(r.id)||typeof r.title!=="string"||!r.title.trim()||r.title.length>100||!/^\d\d:\d\d$/.test(r.startTime)||!/^\d\d:\d\d$/.test(r.endTime)||r.endTime<=r.startTime||!Array.isArray(r.days)||r.days.some(day=>!DAYS.includes(day)))throw Error("Invalid routine");
 return d;
}
export function due(date,d){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:d.timezone,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",weekday:"long",hour:"2-digit",minute:"2-digit"}).formatToParts(date).map(x=>[x.type,x.value]));
 const key=p.year+"-"+p.month+"-"+p.day,day=p.weekday,time=+p.hour*60+(+p.minute),s=d.settings,out=[];
 if(s.quietHours&&(time>=1320||time<420))return out;
 for(const r of d.routines){
  const start=m(r.startTime),end=m(r.endTime),lead=start-s.beforeMinutes;
  const next=DAYS[(DAYS.indexOf(day)+1)%7];
  if(s.beforeMinutes&&((lead+1440)%1440)===time&&r.days.includes(lead<0?next:day))out.push({key:key+":"+r.id+":before",title:"Upcoming routine",body:r.title+" starts in "+s.beforeMinutes+" minutes.",routineId:r.id});
  if(s.atStart&&start===time&&r.days.includes(day))out.push({key:key+":"+r.id+":start",title:"Time to start",body:r.title+" starts now.",routineId:r.id});
  if(s.incomplete&&end+10<1440&&end+10===time&&r.days.includes(day)&&(d.completionDate!==key||!d.completedToday.includes(r.id)))out.push({key:key+":"+r.id+":incomplete",title:"Not marked complete",body:"Did you finish "+r.title+"?",routineId:r.id});
 }
 if(s.morning&&time===420){const count=d.routines.filter(r=>r.days.includes(day)).length;if(count)out.push({key:key+":morning",title:"Daily schedule",body:count+" routines today.",routineId:null})}
 if(s.summary&&time===1200){const today=d.routines.filter(r=>r.days.includes(day));if(today.length)out.push({key:key+":summary",title:"Daily summary",body:today.filter(r=>d.completionDate===key&&d.completedToday.includes(r.id)).length+" of "+today.length+" completed.",routineId:null})}
 return out;
}
export function dueWindow(now,d){const out=new Map();for(let i=0;i<=2;i++)for(const e of due(new Date(now.getTime()-i*60000),d))out.set(e.key,e);return [...out.values()]}
