/* Session-only undo for saved routine changes. Never overwrites newer external data. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    stack = [];
  let timer = null;
  const capture = () =>
    JSON.stringify({ routines, completionHistory, progressData });
  const stored = () =>
    JSON.stringify({
      routines: JSON.parse(localStorage.getItem("routines") || "[]"),
      completionHistory: JSON.parse(
        localStorage.getItem("completionHistory") || "{}",
      ),
      progressData: JSON.parse(
        localStorage.getItem("routineProgress") || "null",
      ),
    });
  const blocked = () =>
    routineFormCard.classList.contains("form-expanded") ||
    !$("progressDemoBanner").hidden;
  function update() {
    if (stack.length && stack.at(-1).day !== getTodayKey()) {
      stack.length = 0;
      hide();
    }
    const last = stack.at(-1),
      available = Boolean(last && last.day === getTodayKey() && !blocked());
    $("undoLatestLabel").textContent = last
      ? last.label
      : "No saved changes to undo in this tab.";
    $("undoSettingsAction").disabled = $("undoToastAction").disabled =
      !available;
    $("undoToastAction").setAttribute(
      "aria-label",
      last ? "Undo " + last.label : "Undo last change",
    );
  }
  function hide() {
    clearTimeout(timer);
    $("undoToast").hidden = true;
  }
  function toast(message) {
    $("undoToastMessage").textContent = message;
    $("undoToast").hidden = false;
    update();
    clearTimeout(timer);
    timer = setTimeout(hide, 15000);
  }
  function clear() {
    stack.length = 0;
    hide();
    update();
  }
  function record(before, label) {
    if (typeof before !== "string") return;
    const after = capture();
    if (before === after) return;
    stack.push({ before, after, label, day: getTodayKey() });
    if (stack.length > 10) stack.shift();
    toast(label);
  }
  function write(state) {
    localStorage.setItem("routines", JSON.stringify(state.routines));
    localStorage.setItem(
      "completionHistory",
      JSON.stringify(state.completionHistory),
    );
    localStorage.setItem("routineProgress", JSON.stringify(state.progressData));
  }
  function perform() {
    const last = stack.at(-1);
    if (!last) return false;
    if (blocked()) return false;
    if (last.day !== getTodayKey()) {
      clear();
      toast("Undo history expired at the start of a new day.");
      return false;
    }
    let matches = false;
    try {
      matches = capture() === last.after && stored() === last.after;
    } catch (_) {
      /* Treat malformed external data as a conflicting change. */
    }
    if (!matches) {
      clear();
      toast(
        "Your data changed since this action. Undo history was cleared to protect newer changes.",
      );
      return false;
    }
    const before = JSON.parse(last.before),
      after = JSON.parse(last.after);
    try {
      write(before);
    } catch (error) {
      try {
        write(after);
      } catch (_) {}
      toast(
        "This change could not be restored. Please export a backup before trying again.",
      );
      return false;
    }
    routines = before.routines;
    completionHistory = before.completionHistory;
    progressData = before.progressData;
    stack.pop();
    window.dispatchEvent(new Event("routine-data-changed"));
    renderRoutines();
    ["goalFeedback", "historyFeedback"].forEach(
      (id) => ($(id).textContent = ""),
    );
    toast("Undid: " + last.label);
    return true;
  }
  $("undoToastAction").addEventListener("click", perform);
  $("undoSettingsAction").addEventListener("click", perform);
  $("dismissUndoToast").addEventListener("click", hide);
  window.addEventListener("routine-editor-change", update);
  window.addEventListener("progress-demo-changed", update);
  window.addEventListener("storage", (e) => {
    if (
      (e.key === null ||
        ["routines", "completionHistory", "routineProgress"].includes(e.key)) &&
      stack.length
    ) {
      clear();
      toast("Another tab changed your data. Undo history was cleared.");
    }
  });
  window.addEventListener("routine-rendered", update);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (stack.at(-1)?.day !== getTodayKey()) clear();
      else update();
    }
  });
  window.RoutineUndo = { capture, record, clear, perform };
  update();
})();
