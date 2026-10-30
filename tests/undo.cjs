const { JSDOM } = require("jsdom"),
  fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const root = require("path").resolve(__dirname, "..") + "/";
function app() {
  const dom = new JSDOM(fs.readFileSync(root + "index.html", "utf8"), {
      url: "https://example.com/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    }),
    w = dom.window;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({ matches: true });
  w.confirm = () => true;
  w.alert = () => {};
  const day = new Date().toLocaleDateString("en-GB", { weekday: "long" }),
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
        category: "Study",
        days: [day],
        notes: "Keep notes",
        priority: "High",
      },
    ]),
  );
  w.localStorage.setItem(
    "completionHistory",
    JSON.stringify({ [date]: ["study"] }),
  );
  for (const file of [
    "progress-core",
    "app",
    "undo",
    "push-config",
    "layout",
    "activity-editor",
    "progress",
    "notifications",
  ])
    vm.runInContext(
      fs.readFileSync(root + "js/" + file + ".js", "utf8"),
      dom.getInternalVMContext(),
    );
  return {
    w,
    dom,
    $: (s) => w.document.querySelector(s),
    run: (s) => vm.runInContext(s, dom.getInternalVMContext()),
    state: () =>
      JSON.stringify(
        ["routines", "completionHistory", "routineProgress"].map((k) =>
          w.localStorage.getItem(k),
        ),
      ),
    date,
  };
}
{
  const { w, dom, $, state, date } = app(),
    initial = state();
  let syncs = 0;
  w.addEventListener("routine-data-changed", () => syncs++);
  w.deleteRoutine("study");
  assert.equal(JSON.parse(w.localStorage.getItem("routines")).length, 0);
  assert.equal($("#undoToast").hidden, false);
  assert.match($("#undoToastMessage").textContent, /Deleted/);
  $("#dismissUndoToast").click();
  assert.equal($("#undoToast").hidden, true);
  assert.equal($("#undoSettingsAction").disabled, false);
  assert.equal(w.RoutineUndo.perform(), true);
  assert.equal(state(), initial);
  assert.equal(JSON.parse(w.localStorage.getItem("routines"))[0].id, "study");
  assert.ok(
    JSON.parse(w.localStorage.getItem("completionHistory"))[date].includes(
      "study",
    ),
  );
  assert.equal($("#undoSettingsAction").disabled, true);
  assert.ok(syncs >= 2);
  w.toggleRoutine("study");
  assert.equal(
    JSON.parse(w.localStorage.getItem("completionHistory"))[date].includes(
      "study",
    ),
    false,
  );
  assert.equal(w.RoutineUndo.perform(), true);
  assert.equal(state(), initial);
  // Multiple saved changes undo in reverse order, with exact historical snapshots.
  w.editRoutine("study");
  $("#title").value = "Updated study";
  $("#routineForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
  const edited = state();
  w.toggleRoutine("study");
  assert.equal(w.RoutineUndo.perform(), true);
  assert.equal(state(), edited);
  assert.equal(w.RoutineUndo.perform(), true);
  assert.equal(state(), initial);
  // Cancel/no-op saves do not create undo entries.
  w.editRoutine("study");
  $("#cancelEditButton").click();
  assert.equal($("#undoSettingsAction").disabled, true);
  w.editRoutine("study");
  $("#routineForm").dispatchEvent(new w.Event("submit", { cancelable: true }));
  assert.equal($("#undoSettingsAction").disabled, true);
  // History corrections restore both the completion key and the progress ledger.
  $("[data-view=progress]").click();
  $("#historyDetails").open = true;
  $("#progressHistory select").value = "skipped";
  $("#progressHistory select").dispatchEvent(new w.Event("change"));
  assert.equal(
    JSON.parse(w.localStorage.getItem("routineProgress")).records[date].study
      .status,
    "skipped",
  );
  assert.equal(w.RoutineUndo.perform(), true);
  assert.equal(state(), initial);
  // Opening a dialog and demo mode disables Undo; neither can accidentally restore real data.
  w.toggleRoutine("study");
  const undoneCompletion = state();
  w.editRoutine("study");
  assert.equal($("#undoSettingsAction").disabled, true);
  assert.equal(w.RoutineUndo.perform(), false);
  assert.equal(state(), undoneCompletion);
  $("#cancelEditButton").click();
  $("[data-view=progress]").click();
  $("#toggleProgressDemo").click();
  assert.equal($("#undoSettingsAction").disabled, true);
  assert.equal(w.RoutineUndo.perform(), false);
  assert.equal(state(), undoneCompletion);
  $("#exitProgressDemo").click();
  assert.equal($("#undoSettingsAction").disabled, false);
  assert.equal(w.RoutineUndo.perform(), true);
  assert.equal(state(), initial);
  dom.window.close();
}
{
  const { w, dom, $, state } = app();
  w.toggleRoutine("study");
  const newer = JSON.parse(w.localStorage.getItem("routines"));
  newer[0].title = "Changed in another tab";
  w.localStorage.setItem("routines", JSON.stringify(newer));
  const external = state();
  assert.equal(w.RoutineUndo.perform(), false);
  assert.equal(state(), external);
  assert.match($("#undoToastMessage").textContent, /protect newer/);
  assert.equal($("#undoSettingsAction").disabled, true);
  dom.window.close();
}
{
  const { w, dom, $ } = app();
  w.toggleRoutine("study");
  w.dispatchEvent(new w.StorageEvent("storage", { key: "completionHistory" }));
  assert.equal($("#undoSettingsAction").disabled, true);
  assert.match($("#undoToastMessage").textContent, /Another tab/);
  dom.window.close();
}
{
  const { w, dom, $ } = app();
  $("[data-view=progress]").click();
  for (let goal = 21; goal <= 31; goal++) {
    $("#weeklyGoalInput").value = goal;
    $("#weeklyGoalForm").dispatchEvent(
      new w.Event("submit", { cancelable: true }),
    );
  }
  for (let i = 0; i < 10; i++) assert.equal(w.RoutineUndo.perform(), true);
  assert.equal(
    JSON.parse(w.localStorage.getItem("routineProgress")).goals.weekly,
    21,
  );
  assert.equal(w.RoutineUndo.perform(), false);
  dom.window.close();
}
{
  const { w, dom, $, run } = app();
  w.toggleRoutine("study");
  const imported = {
    routines: JSON.parse(w.localStorage.getItem("routines")),
    completionHistory: JSON.parse(w.localStorage.getItem("completionHistory")),
    progressData: JSON.parse(w.localStorage.getItem("routineProgress")),
  };
  w.FileReader = class {
    addEventListener(name, cb) {
      this.callback = cb;
    }
    readAsText() {
      this.result = JSON.stringify(imported);
      this.callback();
    }
  };
  w.importBackup({});
  assert.equal($("#undoSettingsAction").disabled, true);
  assert.equal(w.RoutineUndo.perform(), false);
  w.toggleRoutine("study");
  run('getTodayKey = () => "2099-01-01"');
  assert.equal(w.RoutineUndo.perform(), false);
  assert.match($("#undoToastMessage").textContent, /new day/);
  dom.window.close();
}
{
  const { w, dom, state } = app();
  const initial = state();
  w.toggleRoutine("study");
  const changed = state(),
    original = w.Storage.prototype.setItem;
  let fail = true;
  w.Storage.prototype.setItem = function (key, value) {
    if (key === "completionHistory" && fail) {
      fail = false;
      throw new w.DOMException("Quota exceeded", "QuotaExceededError");
    }
    return original.call(this, key, value);
  };
  assert.equal(w.RoutineUndo.perform(), false);
  assert.equal(state(), changed);
  w.Storage.prototype.setItem = original;
  assert.equal(w.RoutineUndo.perform(), true);
  assert.equal(state(), initial);
  dom.window.close();
}
console.log(
  "PASS Undo: deletion restores IDs/history, completion/edit/history/goal changes, reverse order, no-op/cancel, session limit, modal/demo guards, import/day boundaries and cross-tab protection",
);
