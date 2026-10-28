const assert = require("node:assert/strict"),
  C = require("../js/progress-core.js");
const all = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const now = new Date("2026-10-28T12:00:00"),
  r = {
    id: "study",
    title: "Study",
    category: "Study",
    startTime: "10:00",
    endTime: "11:00",
    days: all,
  };
let s = C.create([r], { "2026-10-25": ["study", "deleted"] }, "2026-10-26");
assert.ok(C.validState(s));
assert.equal(C.summary(C.rows(s, "2026-10-25", now)).legacy, 2);
assert.equal(C.summary(C.rows(s, "2026-10-25", now)).rate, null);
C.setStatus(s, "study", "2026-10-26", "completed", now);
assert.equal(s.records["2026-10-26"].study.completedAt, null);
C.setStatus(s, "study", "2026-10-27", "skipped", now);
C.setStatus(s, "study", "2026-10-28", "completed", now);
assert.equal(s.records["2026-10-28"].study.completedAt, now.toISOString());
assert.deepEqual(C.streaks(s, now), { current: 2, best: 2 });
C.setStatus(
  s,
  "study",
  "2026-10-28",
  "completed",
  new Date("2026-10-28T13:00:00"),
);
assert.equal(s.records["2026-10-28"].study.completedAt, now.toISOString());
const future = {
  ...r,
  id: "later",
  title: "Later",
  startTime: "22:00",
  endTime: "23:00",
};
C.sync(s, [r, future], "2026-10-28");
let sum = C.summary(C.rows(s, "2026-10-28", now));
assert.equal(sum.rate, 100);
assert.equal(sum.pending, 1);
assert.equal(sum.eligible, 1);
C.setStatus(s, "later", "2026-10-28", "skipped", now);
sum = C.summary(C.rows(s, "2026-10-28", now));
assert.equal(sum.skipped, 1);
assert.equal(sum.rate, 100);
// Edits preserve earlier title/category/schedule; deleted routines retain records.
C.sync(
  s,
  [{ ...r, title: "Changed", category: "Work", days: ["Wednesday"] }, future],
  "2026-10-28",
);
assert.equal(C.rows(s, "2026-10-26", now)[0].routine.title, "Study");
assert.equal(
  C.rows(s, "2026-10-28", now).find((x) => x.id === "study").routine.title,
  "Changed",
);
C.sync(s, [future], "2026-10-28");
assert.equal(
  C.rows(s, "2026-10-28", now).find((x) => x.id === "study").status,
  "completed",
);
assert.equal(
  C.rows(s, "2026-10-29", new Date("2026-10-30T12:00:00")).some(
    (x) => x.id === "study",
  ),
  false,
);
assert.equal(C.rows(s, "2026-10-28", now, { category: "Work" }).length, 1);
assert.equal(C.rows(s, "2026-10-28", now, { routine: "later" }).length, 1);
assert.deepEqual(C.rows(s, "2026-10-29", now), []);
assert.throws(() => C.setStatus(s, "study", "2026-10-29", "completed", now));
assert.equal(C.validDate("2026-02-30"), false);
assert.equal(C.validDate("2024-02-29"), true);
assert.equal(C.shift("2026-03-29", 1), "2026-03-30");
assert.deepEqual(C.range("week", "2026-10-28"), {
  start: "2026-10-26",
  end: "2026-10-28",
});
assert.equal(C.dates("2024-02-01", "2024-02-29").length, 29);
assert.equal(C.validState({ ...s, records: { bad: {} } }), false);
assert.equal(C.validState({ ...s, goals: { weekly: -1 } }), false);
assert.equal(C.validState(JSON.parse(JSON.stringify(s))), true);
// Unscheduled days and skipped days do not break scheduled-day streaks; missed days do.
s = C.create(
  [{ ...r, days: ["Monday", "Wednesday", "Friday"] }],
  {},
  "2026-10-19",
);
for (const d of ["2026-10-19", "2026-10-21", "2026-10-23"])
  C.setStatus(s, "study", d, "completed", now);
assert.deepEqual(C.streaks(s, new Date("2026-10-24T12:00:00")), {
  current: 3,
  best: 3,
});
assert.deepEqual(C.streaks(s, now), { current: 0, best: 3 });
console.log(
  "PASS analytics: legacy migration, calendar arithmetic, snapshots, deletion, statuses, timestamps, due-only rates, filters, scheduled-day streaks and backup validation",
);
