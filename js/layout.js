/* Navigation and derived views. Routines keep their existing localStorage format. */
(() => {
  const $ = (id) => document.getElementById(id);
  const iconFor = (category) =>
    ({
      Study: "book",
      Work: "laptop",
      Health: "activity",
      Meal: "cup-hot",
      Sleep: "moon",
      Personal: "person",
    })[category] || "calendar-check";
  const node = (tag, className, text) => {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  let activeView = "today",
    lastFocus = null;
  function showView(name, focus = true) {
    if (!["today", "routines", "progress", "settings"].includes(name)) return;
    activeView = name;
    document
      .querySelectorAll(".app-view")
      .forEach((p) => (p.hidden = p.id !== "view-" + name));
    document.querySelectorAll("[data-view]").forEach((b) => {
      const selected = b.dataset.view === name;
      b.classList.toggle("is-active", selected);
      if (selected) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $("layoutAddButton").hidden = !["today", "routines"].includes(name);
    if (name === "routines") renderRoutines();
    else renderViews();
    if (focus) {
      window.scrollTo({ top: 0, behavior: "instant" });
      $("view-" + name)
        .querySelector("h2")
        ?.focus({ preventScroll: true });
    }
  }
  document
    .querySelectorAll("[data-view]")
    .forEach((b) =>
      b.addEventListener("click", () => showView(b.dataset.view)),
    );
  document
    .querySelector("[data-open-settings]")
    .addEventListener("click", () => showView("settings"));
  document.querySelectorAll("[data-add-routine]").forEach((b) =>
    b.addEventListener("click", () => {
      lastFocus = b;
      resetRoutineForm();
      openRoutineForm();
    }),
  );
  function todayRoutines() {
    return routines
      .filter((r) => getRoutineDays(r).includes(getTodayName()))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  function routineButton(r) {
    const button = node("button", "timeline-card");
    button.type = "button";
    button.setAttribute("aria-label", "Edit " + r.title);
    const icon = node("span", "category-icon");
    const glyph = node("i", "bi bi-" + iconFor(r.category));
    glyph.setAttribute("aria-hidden", "true");
    icon.append(glyph);
    const text = node("span");
    text.append(
      node(
        "span",
        "muted",
        formatTime(r.startTime) + " – " + formatTime(r.endTime),
      ),
      node("p", "timeline-title", r.title),
    );
    button.append(icon, text);
    button.addEventListener("click", () => {
      lastFocus = button;
      editRoutine(r.id);
    });
    return button;
  }
  function renderViews() {
    const today = todayRoutines(),
      done = today.filter((r) => isRoutineCompleted(r.id));
    updateProgress();
    $("todayCount").textContent = today.length + " routines";
    const timeline = $("todayTimeline");
    timeline.replaceChildren();
    for (const r of today) {
      const row = node(
        "div",
        "timeline-row" + (isRoutineCompleted(r.id) ? " is-complete" : ""),
      );
      const check = node("input", "timeline-check");
      check.type = "checkbox";
      check.checked = isRoutineCompleted(r.id);
      check.setAttribute("aria-label", "Mark " + r.title + " complete");
      check.addEventListener("change", () => toggleRoutine(r.id));
      row.append(check, routineButton(r));
      timeline.append(row);
    }
    if (!today.length) {
      const empty = node("div", "layout-card");
      empty.append(
        node("h3", null, "A fresh start"),
        node(
          "p",
          "muted",
          "No routines scheduled for today. Add one to plan your day.",
        ),
      );
      timeline.append(empty);
    }
    const now = new Date(),
      minute = now.getHours() * 60 + now.getMinutes();
    const next = today.find(
      (r) =>
        !isRoutineCompleted(r.id) &&
        Number(r.startTime.slice(0, 2)) * 60 + Number(r.startTime.slice(3)) >=
          minute,
    );
    const upcoming = $("upNext");
    upcoming.replaceChildren();
    const glyph = node("span", "next-icon");
    const i = node(
      "i",
      "bi bi-" + (next ? iconFor(next.category) : "check2-circle"),
    );
    i.setAttribute("aria-hidden", "true");
    glyph.append(i);
    const content = node("div");
    content.append(
      node("small", null, next ? "Up next" : "You’re all set"),
      node("p", "next-title", next ? next.title : "No upcoming routines"),
      node(
        "small",
        null,
        next
          ? formatTime(next.startTime) + " – " + formatTime(next.endTime)
          : "Your timeline is ready whenever you are.",
      ),
    );
    upcoming.append(glyph, content);
    $("completedStat").textContent = done.length + " of " + today.length;
    $("completionStat").textContent = today.length
      ? Math.round((done.length / today.length) * 100) + "% of today’s schedule"
      : "No routines today";
    // A streak counts consecutive local calendar days with any saved completion.
    let streak = 0;
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    const key = (d) =>
      [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
    if (!(completionHistory[key(date)] || []).length)
      date.setDate(date.getDate() - 1);
    while ((completionHistory[key(date)] || []).length) {
      streak++;
      date.setDate(date.getDate() - 1);
    }
    $("streakStat").textContent =
      streak + " " + (streak === 1 ? "day" : "days");
    const days = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - offset);
      days.push({
        label: d.toLocaleDateString("en-GB", { weekday: "short" }),
        date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        count: new Set(completionHistory[key(d)] || []).size,
      });
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    $("weekBars").replaceChildren();
    days.forEach((d, index) => {
      const col = node("div", "week-day" + (index === 6 ? " is-today" : ""));
      col.setAttribute("role", "listitem");
      col.setAttribute("aria-label", d.date + ": " + d.count + " completed");
      col.append(node("span", null, String(d.count)));
      const track = node("div", "bar-track");
      track.setAttribute("aria-hidden", "true");
      const fill = node("div", "bar-fill");
      fill.style.height = (d.count / max) * 100 + "%";
      track.append(fill);
      col.append(track, node("span", null, d.label));
      $("weekBars").append(col);
    });
    $("completedList").replaceChildren();
    for (const r of done) {
      const line = node("div", "completed-line");
      line.append(
        node("strong", null, "✓ " + r.title),
        node("span", "muted", formatTime(r.startTime)),
      );
      $("completedList").append(line);
    }
    if (!done.length)
      $("completedList").append(
        node("p", "muted", "Complete a routine to see it here."),
      );
  }
  window.addEventListener("routine-rendered", renderViews);
  // Expose the correct screen when a notification deep link opens a routine.
  const linked = new URL(location.href).searchParams.get("routine");
  if (linked) showView("routines", false);
  else showView("today", false);
  window.addEventListener("routine-editor-change", (e) => {
    if (e.detail) {
      lastFocus = document.activeElement;
      $("routineFormCard").focus();
    } else {
      renderViews();
      if (lastFocus?.isConnected) lastFocus.focus();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key !== "Tab" ||
      !$("routineFormCard").classList.contains("form-expanded")
    )
      return;
    const controls = [
      ...$("routineFormCard").querySelectorAll("button,input,select,textarea"),
    ].filter((n) => !n.disabled && !n.hidden && n.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  // Day/date and next activity refresh while the app stays open, including midnight.
  setInterval(() => {
    displayTodayDate();
    renderViews();
  }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      displayTodayDate();
      renderViews();
    }
  });
})();
