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
