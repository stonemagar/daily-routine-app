/* A live activity preview and reversible form shortcuts. Saving stays in app.js. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    form = $("routineForm");
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    weekend = ["Saturday", "Sunday"],
    allDays = [...weekdays, ...weekend];
  const presets = {
    study: { title: "Study session", category: "Study", minutes: 25 },
    walk: { title: "Go for a walk", category: "Health", minutes: 30 },
    read: { title: "Read a book", category: "Personal", minutes: 20 },
  };
  const paths = {
    Study: "M12 5C8 2 3 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-1-1-6-2-10 1v15",
    Work: "M4 7h16v14H4ZM8 7V3h8v4M4 12h16M10 12v3h4v-3",
    Health: "M2 12h4l3-8 5 16 3-8h5",
    Personal: "M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0M4 22v-3c0-6 16-6 16 0v3",
    Meal: "M4 8h13v7c0 6-13 6-13 0ZM17 9h2c5 0 3 6-2 6M2 22h19M7 5V2M12 5V2",
    Sleep: "M20 15A9 9 0 0 1 9 4 9 9 0 1 0 20 15Z",
  };
  let pendingDuration = null;
  const minutes = (value) =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
      : null;
  const time = (value) =>
    String(Math.floor(value / 60)).padStart(2, "0") +
    ":" +
    String(value % 60).padStart(2, "0");
  const durationLabel = (value) =>
    value >= 60
      ? Math.floor(value / 60) +
        " h" +
        (value % 60 ? " " + (value % 60) + " min" : "")
      : value + " min";
  const same = (a, b) => a.length === b.length && a.every((v) => b.includes(v));
  function applyDuration() {
    const start = minutes($("startTime").value);
    if (start === null || pendingDuration === null) return;
    $("endTime").value =
      start + pendingDuration < 1440 ? time(start + pendingDuration) : "";
  }
  function renderIcon(category) {
    const ns = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(ns, "svg"),
      path = document.createElementNS(ns, "path");
    for (const [key, value] of Object.entries({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.7",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }))
      svg.setAttribute(key, value);
    path.setAttribute("d", paths[category] || paths.Study);
    svg.append(path);
    $("activityPreviewIcon").replaceChildren(svg);
    $("activityPreviewIcon").dataset.category = category;
  }
  function render() {
    const start = minutes($("startTime").value),
      end = minutes($("endTime").value),
      days = getSelectedDaysFromForm(),
      validTime = start !== null && end !== null && end > start,
      duration = validTime ? end - start : null;
    let error = "";
    if (
      pendingDuration !== null &&
      start !== null &&
      start + pendingDuration >= 1440
    )
      error =
        "This duration crosses midnight. Choose an earlier start or a same-day end time.";
    else if (start !== null && end !== null && end <= start)
      error =
        "End time must be later than start time. Activities must finish on the same day.";
    $("endTime").setCustomValidity(error);
    $("endTime").setAttribute("aria-invalid", String(Boolean(error)));
    $("activityTimeHint").textContent =
      error ||
      (validTime
        ? durationLabel(duration) + " planned."
        : pendingDuration !== null && start === null
          ? "Choose a start time to apply " +
            durationLabel(pendingDuration) +
            "."
          : "Choose a start and end time for the same day.");
    $("activityTimeHint").classList.toggle("is-error", Boolean(error));
    const repeat = same(days, allDays)
      ? "Every day"
      : same(days, weekdays)
        ? "Weekdays"
        : same(days, weekend)
          ? "Weekends"
          : days.length === 1
            ? "Every " + days[0]
            : days.length
              ? days.map((d) => d.slice(0, 3)).join(", ")
              : "Choose repeat days";
    $("activityPreviewTitle").textContent =
      $("title").value.trim() || "Your next activity";
    $("activityPreviewSchedule").textContent =
      (validTime
        ? $("startTime").value + " – " + $("endTime").value
        : "Choose a time") +
      " · " +
      repeat;
    $("activityPreviewDuration").textContent =
      duration === null ? "Set time" : durationLabel(duration);
    $("activityPreviewCategory").textContent = $("category").value;
    renderIcon($("category").value);
    $("activityTitleCount").textContent = $("title").value.length + "/100";
    $("activityNotesCount").textContent = $("notes").value.length + "/300";
    $("activityWeeklySummary").textContent = days.length
      ? duration === null
        ? "Repeats each week on your selected days."
        : durationLabel(duration * days.length) +
          " each week across " +
          days.length +
          " " +
          (days.length === 1 ? "day." : "days.")
      : "Select at least one day to repeat this activity.";
    $("activityExtrasSummary").textContent =
      [
        $("notes").value.trim() ? "Notes added" : "",
        $("priority").value !== "Medium"
          ? $("priority").value + " priority"
          : "",
      ]
        .filter(Boolean)
        .join(" · ") || "Optional";
    $("activityQuickStart").hidden = Boolean(editingRoutineId);
    $("cancelNewActivity").hidden = Boolean(editingRoutineId);
    document.querySelectorAll("[data-activity-duration]").forEach((b) => {
      const selected =
        Number(b.dataset.activityDuration) === (duration ?? pendingDuration);
      b.setAttribute("aria-pressed", String(selected));
    });
    const groups = {
      today: [getTodayName()],
      weekdays,
      weekend,
      everyday: allDays,
    };
    document
      .querySelectorAll("[data-activity-days]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(same(days, groups[b.dataset.activityDays])),
        ),
      );
    const conflict =
      validTime && days.length
        ? findScheduleConflict(
            {
              startTime: $("startTime").value,
              endTime: $("endTime").value,
              days,
            },
            editingRoutineId,
          )
        : null;
    $("activityConflictHint").hidden = !conflict;
    $("activityConflictHint").textContent = conflict
      ? "Overlaps with “" +
        conflict.title +
        "” (" +
        conflict.startTime +
        " – " +
        conflict.endTime +
        "). You’ll be asked to confirm when saving."
      : "";
  }
  document.querySelectorAll("[data-activity-duration]").forEach((b) =>
    b.addEventListener("click", () => {
      pendingDuration = Number(b.dataset.activityDuration);
      applyDuration();
      render();
    }),
  );
  document.querySelectorAll("[data-activity-days]").forEach((b) =>
    b.addEventListener("click", () => {
      setSelectedDays(
        { today: [getTodayName()], weekdays, weekend, everyday: allDays }[
          b.dataset.activityDays
        ],
      );
      showDayError(false);
      render();
    }),
  );
  document.querySelectorAll("[data-activity-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      if (editingRoutineId) return;
      const preset = presets[b.dataset.activityPreset];
      $("title").value = preset.title;
      $("category").value = preset.category;
      pendingDuration = preset.minutes;
      applyDuration();
      render();
      $("title").focus();
    }),
  );
  form.addEventListener("input", (e) => {
    if (e.target.id === "endTime") pendingDuration = null;
    if (e.target.id === "startTime") applyDuration();
    render();
  });
  form.addEventListener("change", render);
  form.addEventListener("reset", () => {
    pendingDuration = null;
    $("endTime").setCustomValidity("");
    queueMicrotask(render);
  });
  $("cancelNewActivity").addEventListener("click", resetRoutineForm);
  window.addEventListener("routine-editor-change", (e) => {
    if (!e.detail) return;
    pendingDuration = null;
    $("endTime").setCustomValidity("");
    $("activityExtras").open = Boolean(
      $("notes").value.trim() || $("priority").value !== "Medium",
    );
    render();
  });
  render();
})();
