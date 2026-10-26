import test from "node:test";
import assert from "node:assert/strict";
import {due,dueWindow,check} from "../src/scheduler.js";
const d={timezone:"Europe/London",settings:{beforeMinutes:10,atStart:true,incomplete:false,morning:false,summary:true,quietHours:true},routines:[{id:"study",title:"Study",startTime:"10:00",endTime:"11:00",days:["Monday"]}],completionDate:"2026-10-26",completedToday:[]};
test("before reminder",()=>assert.equal(due(new Date("2026-10-26T09:50:00Z"),d).length,1));
test("start reminder",()=>assert.equal(due(new Date("2026-10-26T10:00:00Z"),d).length,1));
test("wrong weekday",()=>assert.equal(due(new Date("2026-10-27T09:50:00Z"),d).length,0));
test("late window",()=>assert.equal(dueWindow(new Date("2026-10-26T09:52:00Z"),d).length,1));
test("validates",()=>assert.equal(check(d),d));
