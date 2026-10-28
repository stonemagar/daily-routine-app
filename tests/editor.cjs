const { JSDOM } = require("jsdom"),
  fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const root = require("path").resolve(__dirname, "..") + "/";
const dom = new JSDOM(fs.readFileSync(root + "index.html", "utf8"), {
  url: "https://example.com/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const w = dom.window,
  $ = (s) => w.document.querySelector(s),
  run = (s) => vm.runInContext(s, dom.getInternalVMContext());
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
w.matchMedia = () => ({ matches: true });
w.alert = () => {};
let confirmations = 0;
w.confirm = () => {
  confirmations++;
  return true;
};
const today = new Date().toLocaleDateString("en-GB", { weekday: "long" });
w.localStorage.setItem(
  "routines",
  JSON.stringify([
    {
      id: "existing",
      title: "Existing study",
      category: "Study",
      startTime: "10:00",
      endTime: "11:00",
      days: [today],
      notes: "Bring notes",
      priority: "High",
    },
  ]),
);
for (const name of [
  "progress-core",
  "app",
  "push-config",
  "layout",
  "activity-editor",
  "progress",
  "notifications",
])
  run(fs.readFileSync(root + "js/" + name + ".js", "utf8"));
function fill(id, value) {
  $("#" + id).value = value;
  $("#" + id).dispatchEvent(new w.Event("input", { bubbles: true }));
}
const snapshot = () => JSON.stringify(Object.entries(w.localStorage).sort());
const beforeDraft = snapshot();
$("[data-add-routine]").click();
assert.equal($("#routineFormHeading").textContent, "New activity");
assert.equal($("#cancelNewActivity").hidden, false);
$("[data-activity-preset=study]").click();
assert.equal($("#title").value, "Study session");
assert.match($("#activityTimeHint").textContent, /Choose a start/);
fill("startTime", "09:00");
assert.equal($("#endTime").value, "09:25");
assert.match($("#activityPreviewSchedule").textContent, /09:00 – 09:25/);
$('[data-activity-duration="60"]').click();
assert.equal($("#endTime").value, "10:00");
$("[data-activity-days=everyday]").click();
assert.equal(w.getSelectedDaysFromForm().length, 7);
assert.match($("#activityWeeklySummary").textContent, /7 h/);
assert.equal(snapshot(), beforeDraft, "shortcuts must not save drafts");
fill("startTime", "23:50");
assert.equal($("#endTime").value, "");
assert.equal($("#endTime").validity.customError, true);
assert.match($("#activityTimeHint").textContent, /midnight/);
assert.equal($("#routineForm").checkValidity(), false);
fill("endTime", "23:59");
assert.equal($("#endTime").validity.customError, false);
assert.match($("#activityPreviewDuration").textContent, /9 min/);
fill("title", "<img src=x onerror=alert(1)>");
assert.equal($("#activityPreviewTitle").querySelector("img"), null);
$("#cancelNewActivity").click();
assert.equal($("#routineFormCard").getAttribute("aria-hidden"), "true");
assert.equal(snapshot(), beforeDraft);
$("[data-add-routine]").click();
assert.equal($("#endTime").validity.customError, false);
fill("title", "Research plan");
fill("startTime", "09:00");
$('[data-activity-duration="25"]').click();
$("[data-activity-days=weekdays]").click();
$("#routineForm").dispatchEvent(
  new w.Event("submit", { bubbles: true, cancelable: true }),
);
let stored = JSON.parse(w.localStorage.getItem("routines"));
assert.equal(stored.length, 2);
assert.equal(stored[1].endTime, "09:25");
assert.equal(stored[1].days.length, 5);
assert.equal($("#routineFormCard").getAttribute("aria-hidden"), "true");
// Overlap hints are advisory, and the existing save confirmation remains authoritative.
$("[data-add-routine]").click();
fill("title", "Overlap test");
fill("startTime", "10:15");
fill("endTime", "10:45");
assert.equal($("#activityConflictHint").hidden, false);
assert.match($("#activityConflictHint").textContent, /Existing study/);
$("#routineForm").dispatchEvent(
  new w.Event("submit", { bubbles: true, cancelable: true }),
);
assert.equal(confirmations, 1);
// Edit mode preserves optional fields and never applies new-activity presets.
w.editRoutine("existing");
assert.equal($("#routineFormHeading").textContent, "Edit activity");
assert.equal($("#activityQuickStart").hidden, true);
assert.equal($("#activityExtras").open, true);
assert.equal($("#notes").value, "Bring notes");
assert.equal($("#priority").value, "High");
assert.equal($("#submitButton").textContent, "Save changes");
const originalTitle = $("#title").value;
$("[data-activity-preset=walk]").click();
assert.equal($("#title").value, originalTitle);
const beforeCancel = snapshot();
$("#cancelEditButton").click();
assert.equal(snapshot(), beforeCancel);
w.editRoutine("existing");
fill("title", "Existing study updated");
$("#routineForm").dispatchEvent(
  new w.Event("submit", { bubbles: true, cancelable: true }),
);
stored = JSON.parse(w.localStorage.getItem("routines"));
assert.equal(
  stored.find((r) => r.id === "existing").title,
  "Existing study updated",
);
assert.equal(stored.find((r) => r.id === "existing").notes, "Bring notes");
assert.equal(stored.find((r) => r.id === "existing").priority, "High");
assert.equal(w.document.querySelectorAll("#routineFormCard").length, 1);
console.log(
  "PASS activity editor: preview, presets, duration arithmetic, repeat schedules, cross-midnight validation, draft isolation, overlap confirmation, create/edit and optional fields",
);
dom.window.close();
