const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("node:assert/strict");
const root = require("path").resolve(__dirname, "..") + "/";
const dom = new JSDOM(fs.readFileSync(root + "index.html", "utf8"), {
  url: "https://example.com/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const w = dom.window;
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
w.matchMedia = () => ({ matches: true });
w.confirm = () => true;
const weekday = new Date().toLocaleDateString("en-GB", { weekday: "long" }),
  date = [
    new Date().getFullYear(),
    String(new Date().getMonth() + 1).padStart(2, "0"),
    String(new Date().getDate()).padStart(2, "0"),
  ].join("-");
w.localStorage.setItem(
  "routines",
  JSON.stringify([
    {
      id: "study",
      title: "Study Python",
      startTime: "10:00",
      endTime: "11:00",
      days: [weekday],
      category: "Study",
      priority: "Medium",
      notes: "",
    },
  ]),
);
for (const name of [
  "progress-core",
  "app",
  "push-config",
  "layout",
  "progress",
  "notifications",
])
  require("vm").runInContext(
    fs.readFileSync(root + "js/" + name + ".js", "utf8"),
    dom.getInternalVMContext(),
  );
const $ = (s) => w.document.querySelector(s);
assert.equal(w.document.querySelectorAll(".app-view:not([hidden])").length, 1);
assert.match($("#todayTimeline").textContent, /Study Python/);
$("#todayTimeline input").click();
assert.equal($("#progressText").textContent, "1 of 1 completed");
$("[data-view=routines]").click();
$("#searchInput").value = "missing";
$("#searchInput").dispatchEvent(new w.Event("input"));
assert.match($("#routineList").textContent, /No matching routines/);
assert.equal($("#progressText").textContent, "1 of 1 completed");
$("[data-view=progress]").click();
assert.match($("#progressTodayLabel").textContent, /1 completed/);
assert.equal($("#streakStat").textContent, "1 day");
assert.ok(w.document.querySelectorAll(".week-day").length >= 1);
$("[data-progress-period=month]").click();
assert.ok(w.document.querySelectorAll(".week-day").length >= 1);
$("[data-progress-period=year]").click();
assert.ok(w.document.querySelectorAll(".week-day").length >= 1);
$("[data-progress-period=week]").click();
assert.ok(w.document.querySelectorAll(".week-day").length >= 1);
assert.equal($("#ringPercent").textContent, "100%");
assert.equal($("#bestStreak").textContent, "1 day");
$("#searchInput").value = "";
$("[data-view=routines]").click();
$("[data-category-filter=Work]").click();
assert.match($("#routineList").textContent, /No matching routines/);
$("[data-category-filter=All]").click();
assert.equal(w.document.querySelectorAll(".proposal-routine").length, 1);
$("[data-view=settings]").click();
assert.equal($("#view-settings").hidden, false);
assert.ok($("#view-settings").contains($("#pushEnable")));
assert.ok($("#view-settings").contains($("#exportButton")));
$("#themeToggle").click();
assert.ok(w.document.body.classList.contains("dark-mode"));
$("[data-view=today]").click();
$("[data-add-routine]").click();
assert.equal($("#routineFormCard").getAttribute("aria-hidden"), "false");
w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape" }));
assert.equal($("#routineFormCard").getAttribute("aria-hidden"), "true");
w.editRoutine("study");
assert.equal($("#title").value, "Study Python");
$("#title").value = "Study JavaScript";
$("#routineForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
assert.match($("#todayTimeline").textContent, /Study JavaScript/);
assert.equal(
  JSON.parse(w.localStorage.getItem("routines"))[0].title,
  "Study JavaScript",
);
assert.equal(
  JSON.parse(w.localStorage.getItem("completionHistory"))[date][0],
  "study",
);
// The compact overview keeps detailed reports collapsed and opens history on demand.
$("[data-view=progress]").click();
assert.equal(w.document.querySelectorAll(".progress-disclosure").length, 6);
assert.ok(
  [...w.document.querySelectorAll(".progress-disclosure")].every(
    (n) => !n.open,
  ),
);
assert.ok($(".progress-summary").contains($("#progressComparison")));
$("#completedDetails").open = true;
$("[data-progress-period=month]").click();
assert.equal($("#completedDetails").open, true);
$("#completedDetails").open = false;
$("#calendarDetails").open = true;
$(".heatmap-cell").click();
assert.equal($("#historyDetails").open, true);
assert.equal(w.document.activeElement, $("#historyDate"));
$("#historyDetails").open = false;
$("#calendarDetails").open = false;
// Custom dates survive unrelated data refreshes until Apply is pressed.
$("#progressFrom").value = "2026-01-01";
$("#progressFrom").dispatchEvent(new w.Event("input"));
w.dispatchEvent(new w.Event("routine-rendered"));
assert.equal($("#progressFrom").value, "2026-01-01");
$("#progressTo").value = "2026-01-07";
$("#applyProgressFilters").click();
assert.equal(w.document.querySelectorAll(".heatmap-cell").length, 7);
$("#progressFrom").value = "2026-02-30";
$("#applyProgressFilters").click();
assert.match($("#progressFilterError").textContent, /valid range/);
// Completed occurrences follow period selection, include old history, and paginate.
require("vm").runInContext(
  `
  for (let i=0;i<45;i++) {
    const key=ProgressCore.shift(getTodayKey(),-i);
    ProgressCore.setStatus(progressData,"study",key,"completed");
  }
  persistProgress();
`,
  dom.getInternalVMContext(),
);
$("[data-progress-period=week]").click();
assert.match($("#periodCompletedList").textContent, /Study JavaScript/);
for (const period of ["month", "year"]) {
  $("[data-progress-period=" + period + "]").click();
  const keys = [
    ...w.document.querySelectorAll("#periodCompletedList [data-date]"),
  ].map((n) => n.dataset.date);
  assert.ok(
    keys.every((key) =>
      key.startsWith(date.slice(0, period === "month" ? 7 : 4)),
    ),
  );
  assert.equal(keys[0], date);
}
$("#progressFrom").value = w.ProgressCore.shift(date, -44);
$("#progressTo").value = date;
$("#applyProgressFilters").click();
assert.equal($("#periodCompletedCount").textContent, "45");
assert.equal(
  w.document.querySelectorAll("#periodCompletedList .history-row").length,
  20,
);
$("#showMoreCompleted").click();
assert.equal(
  w.document.querySelectorAll("#periodCompletedList .history-row").length,
  40,
);
$("#showMoreCompleted").click();
assert.equal(
  w.document.querySelectorAll("#periodCompletedList .history-row").length,
  45,
);
assert.equal($("#showMoreCompleted").hidden, true);
require("vm").runInContext(
  `progressData.schedules.work = [{from:getTodayKey(),routine:{id:"work",title:"Work",category:"Work",startTime:"23:00",endTime:"23:30",days:[]}}];`,
  dom.getInternalVMContext(),
);
w.dispatchEvent(new w.Event("routine-rendered"));
$("#progressCategory").value = "Work";
$("#progressCategory").dispatchEvent(new w.Event("change"));
assert.equal($("#periodCompletedCount").textContent, "0");
assert.match($("#periodCompletedList").textContent, /No completed routines/);
$("#progressCategory").value = "All";
$("#progressCategory").dispatchEvent(new w.Event("change"));
// Whole-period navigation, chart drilldown and read-only demo isolation.
$("[data-progress-period=month]").click();
assert.equal($("#nextProgressPeriod").disabled, true);
$("#previousProgressPeriod").click();
const previousMonth = w.ProgressCore.movePeriod("month", date, -1);
assert.equal($("#progressFrom").value, previousMonth);
assert.equal(
  $("#progressTo").value,
  w.ProgressCore.periodRange("month", previousMonth).end,
);
assert.equal($("#nextProgressPeriod").disabled, false);
$("#nextProgressPeriod").click();
assert.equal($("#progressFrom").value, date.slice(0, 7) + "-01");
$("[data-progress-period=week]").click();
$(".chart-bar-button").dispatchEvent(
  new w.MouseEvent("click", { bubbles: true }),
);
assert.equal($("#chartDrilldown").hidden, false);
assert.match($("#chartDrilldownSummary").textContent, /completed/);
assert.ok(
  w.document.querySelectorAll("#chartDrilldownList .history-row").length > 0,
);
$("[data-progress-period=year]").click();
assert.equal($("#chartDrilldown").hidden, true);
$("#progressCategory").value = "Study";
$("#progressCategory").dispatchEvent(new w.Event("change"));
const beforeDemo = JSON.stringify(Object.entries(w.localStorage).sort());
const beforeDemoRange = $("#progressRangeLabel").textContent;
$("#toggleProgressDemo").click();
assert.equal($("#progressDemoBanner").hidden, false);
assert.equal($("#toggleProgressDemo").getAttribute("aria-pressed"), "true");
assert.match($("#routineStats").textContent, /Morning stretch/);
assert.equal(w.document.querySelectorAll("#progressHistory select").length, 0);
assert.equal($("#weeklyGoalForm").hidden, true);
assert.equal($("#exportProgressCsv").disabled, true);
assert.equal($("#printProgress").disabled, true);
$("#weeklyGoalInput").value = "999";
$("#weeklyGoalForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
$("#previousProgressPeriod").click();
$(".chart-bar-button").dispatchEvent(
  new w.MouseEvent("click", { bubbles: true }),
);
assert.equal($("#chartDrilldown").hidden, false);
assert.equal(JSON.stringify(Object.entries(w.localStorage).sort()), beforeDemo);
$("#exitProgressDemo").click();
assert.equal($("#progressDemoBanner").hidden, true);
assert.equal($("#progressRangeLabel").textContent, beforeDemoRange);
assert.equal($("#progressCategory").value, "Study");
assert.equal($("#exportProgressCsv").disabled, false);
assert.equal(JSON.stringify(Object.entries(w.localStorage).sort()), beforeDemo);
$("#toggleProgressDemo").click();
$("[data-view=today]").click();
assert.equal($("#progressDemoBanner").hidden, true);
assert.equal(JSON.stringify(Object.entries(w.localStorage).sort()), beforeDemo);
// Each period uses its analytical presentation, with accessible SVG targets.
for (const mode of ["day", "week", "month", "year"]) {
  $("[data-progress-period=" + mode + "]").click();
  assert.equal($("#weekBars").dataset.chartMode, mode);
  assert.ok(
    w.document.querySelectorAll(
      ".analytics-chart-target[role=button][tabindex='0']",
    ).length > 0,
  );
  if (mode === "day") {
    $(".analytics-chart-target").dispatchEvent(
      new w.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    assert.match($("#chartDrilldownHeading").textContent, /Completed/);
    assert.ok(
      [
        ...w.document.querySelectorAll("#chartDrilldownList [data-status]"),
      ].every((n) => n.dataset.status === "completed"),
    );
  }
  if (mode === "month") assert.ok($(".analytics-rate-line"));
  if (mode === "year")
    assert.match($("#chartHeading").textContent, /Monthly completion rate/);
}
// Explicit skipped day breaks the line: it is neither 0% nor a connecting segment.
require("vm").runInContext(
  `
  progressData.schedules.study = [{from:"2026-10-26",routine:{id:"study",title:"Study JavaScript",category:"Study",startTime:"10:00",endTime:"11:00",days:["Monday","Tuesday","Wednesday"]}}];
  progressData.records["2026-10-26"] = {study:{status:"completed",completedAt:null}};
  progressData.records["2026-10-27"] = {study:{status:"skipped",completedAt:null}};
  progressData.records["2026-10-28"] = {study:{status:"pending",completedAt:null}};
`,
  dom.getInternalVMContext(),
);
$("#progressFrom").value = "2026-10-26";
$("#progressTo").value = "2026-10-28";
$("#applyProgressFilters").click();
// Custom 3-day ranges use counts. Choose Month for a rate line containing the gap.
$("[data-progress-period=month]").click();
const skippedPoint = $(".analytics-chart-target[data-chart-group='26']");
assert.equal(skippedPoint.dataset.value, "");
assert.match(skippedPoint.getAttribute("aria-label"), /rate unavailable/);
assert.ok(!skippedPoint.querySelector(".analytics-rate-point"));
// Backup validation accepts legacy history and rejects malformed new ledgers.
const storedRoutine = JSON.parse(w.localStorage.getItem("routines"))[0];
const ledger = JSON.parse(w.localStorage.getItem("routineProgress"));
const backup = {
  routines: [storedRoutine],
  completionHistory: { [date]: ["study"] },
  progressData: ledger,
};
assert.equal(w.isValidBackup(backup), true);
assert.equal(
  w.isValidBackup({
    ...backup,
    progressData: { ...ledger, records: { invalid: {} } },
  }),
  false,
);
assert.equal(
  w.isValidBackup({ ...backup, routines: [storedRoutine, storedRoutine] }),
  false,
);
assert.equal(
  w.isValidBackup({
    routines: [storedRoutine],
    completionHistory: { [date]: ["study"] },
  }),
  true,
);
// Deleting a routine keeps the completion and analytics ledger.
w.deleteRoutine("study");
assert.ok(
  JSON.parse(w.localStorage.getItem("completionHistory"))[date].includes(
    "study",
  ),
);
assert.ok(
  JSON.parse(w.localStorage.getItem("routineProgress")).schedules.study.length,
);
console.log(
  "PASS: four-tab navigation, real progress, completion persistence, filtering independence, settings controls, theme, add/edit dialog, Escape and editing persistence",
);
dom.window.close();
