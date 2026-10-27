import test from "node:test";
import assert from "node:assert/strict";
import {due,dueWindow,check} from "../src/scheduler.js";
const d={timezone:"Europe/London",settings:{beforeMinutes:10,atStart:true,incomplete:false,morning:false,summary:true,quietHours:true},routines:[{id:"study",title:"Study",startTime:"10:00",endTime:"11:00",days:["Monday"]}],completionDate:"2026-10-26",completedToday:[]};
test("before reminder",()=>assert.equal(due(new Date("2026-10-26T09:50:00Z"),d).length,1));
test("start reminder",()=>assert.equal(due(new Date("2026-10-26T10:00:00Z"),d).length,1));
test("wrong weekday",()=>assert.equal(due(new Date("2026-10-27T09:50:00Z"),d).length,0));
test("late window",()=>assert.equal(dueWindow(new Date("2026-10-26T09:52:00Z"),d).length,1));
test("validates",()=>assert.equal(check(d),d));

test("device mode follows new time zone (Kathmandu 10 AM local)",()=>{
  const travelling={...d,timezone:"Asia/Kathmandu",settings:{...d.settings,timezoneMode:"device",fixedTimezone:null}};
  assert.equal(due(new Date("2026-10-26T04:15:00Z"),travelling).some(e=>e.title==="Time to start"),true);
  assert.equal(due(new Date("2026-10-26T10:00:00Z"),travelling).some(e=>e.title==="Time to start"),false);
});
test("fixed mode continues using original London time while travelling",()=>{
  const fixed={...d,settings:{...d.settings,timezoneMode:"fixed",fixedTimezone:"Europe/London"}};
  assert.equal(due(new Date("2026-10-26T10:00:00Z"),fixed).some(e=>e.title==="Time to start"),true);
  assert.equal(due(new Date("2026-10-26T04:15:00Z"),fixed).some(e=>e.title==="Time to start"),false);
  assert.doesNotThrow(()=>check(fixed));
});
test("UK daylight saving moves the UTC delivery time",()=>{
  const summer={...d,completionDate:"2026-07-06"};
  assert.equal(due(new Date("2026-07-06T09:00:00Z"),summer).some(e=>e.title==="Time to start"),true);
  assert.equal(due(new Date("2026-07-06T10:00:00Z"),summer).some(e=>e.title==="Time to start"),false);
});
test("reject mismatched pinned zone",()=>{
  const mismatched={...d,settings:{...d.settings,timezoneMode:"fixed",fixedTimezone:"Asia/Kathmandu"}};
  assert.throws(()=>check(mismatched),/Fixed zone/);
});
