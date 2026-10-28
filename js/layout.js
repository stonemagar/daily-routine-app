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
  // Local line icons keep navigation and routine cards legible offline.
  const paths = {
    "house-door": "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
    "list-check":
      "M9 5h12M9 12h12M9 19h12M3 5l1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2",
    "bar-chart": "M4 21V13h3v8ZM11 21V8h3v13ZM18 21V3h3v18Z",
    gear: "M9 3h6l1 3 3 1 2 5-2 2v4l-5 3-3-1-3 1-5-3v-4l-2-2 2-5 3-1Z M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
    book: "M12 5C8 2 3 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-1-1-6-2-10 1v15",
    laptop: "M4 4h16v13H4ZM2 20h20l-2-3H4Z",
    activity: "M2 12h4l3-8 5 16 3-8h5",
    "cup-hot":
      "M4 8h13v7c0 6-13 6-13 0ZM17 9h2c5 0 3 6-2 6M2 22h19M7 5V2M12 5V2",
    moon: "M20 15A9 9 0 0 1 9 4 9 9 0 1 0 20 15Z",
    person: "M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0M4 22v-3c0-6 16-6 16 0v3",
    "calendar-check": "M4 5h16v16H4ZM8 2v6M16 2v6M4 10h16M8 15l3 3 5-5",
    "check2-circle": "M21 11a9 9 0 1 1-6-8M8 11l4 4 10-11",
    "chevron-right": "m9 5 7 7-7 7",
    pencil: "m4 16 12-12 4 4L8 20l-5 1ZM13 7l4 4",
    search: "M16 10a6 6 0 1 0-12 0 6 6 0 0 0 12 0m-2 4 7 7",
    flame: "M12 2c3 6-3 7 1 11 2-1 3-3 3-5 10 12-9 20-12 8-1-6 6-8 8-14Z",
    trophy:
      "M7 3h10v7c0 7-10 7-10 0ZM7 5H3v4c0 4 4 5 5 4M17 5h4v4c0 4-4 5-5 4M12 15v6M7 22h10",
    download: "M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5",
    upload: "M12 16V4m-5 5 5-5 5 5M3 16v5h18v-5",
    bell: "M5 17h14l-2-4V9c0-7-10-7-10 0v4ZM10 21h4",
    clock: "M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0M12 6v6l4 2",
    globe:
      "M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0M3 12h18M12 3c-5 4-5 14 0 18 5-4 5-14 0-18",
    "three-dots-vertical": "M12 4h.01M12 12h.01M12 20h.01",
    "cloud-arrow-down":
      "M5 17a5 5 0 0 1-1-10 8 8 0 0 1 15 0 5 5 0 0 1 0 10M12 10v12m-4-4 4 4 4-4",
    "cloud-arrow-up":
      "M5 17a5 5 0 0 1-1-10 8 8 0 0 1 15 0 5 5 0 0 1 0 10M12 22V10m-4 4 4-4 4 4",
  };
  function localIcons() {
    document.querySelectorAll("i.bi").forEach((el) => {
      const name = [...el.classList].find((c) => c.startsWith("bi-"))?.slice(3);
      if (!paths[name] || el.dataset.localIcon === name) return;
      el.textContent = "";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "1.7");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", paths[name]);
      svg.append(path);
      el.append(svg);
      el.dataset.localIcon = name;
    });
  }
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
    $("layoutAddButton").hidden = name !== "today";
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
    .querySelector("[data-show-routines]")
    .addEventListener("click", () => showView("routines"));
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
    const text = node("span", "timeline-text");
    text.append(
      node(
        "span",
        "muted",
        formatTime(r.startTime) + " – " + formatTime(r.endTime),
      ),
      node("p", "timeline-title", r.title),
    );
    icon.dataset.category = r.category;
    button.append(
      icon,
      text,
      node("i", "bi bi-chevron-right timeline-chevron"),
    );
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
    upcoming.disabled = !next;
    upcoming.onclick = next ? () => editRoutine(next.id) : null;
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
    upcoming.append(
      glyph,
      content,
      node("i", "bi bi-chevron-right next-chevron"),
    );
    if (next)
      timeline
        .querySelectorAll(".timeline-row")
        [today.indexOf(next)]?.classList.add("is-upcoming");
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
      const copy = node("div", "completed-copy");
      copy.append(
        node("strong", null, r.title),
        node(
          "small",
          null,
          formatTime(r.startTime) + " – " + formatTime(r.endTime),
        ),
      );
      const icon = node("span", "category-icon");
      icon.dataset.category = r.category;
      icon.append(node("i", "bi bi-" + iconFor(r.category)));
      line.append(
        node("span", "complete-dot", "✓"),
        icon,
        copy,
        node("i", "bi bi-chevron-right"),
      );
      $("completedList").append(line);
    }
    if (!done.length)
      $("completedList").append(
        node("p", "muted", "Complete a routine to see it here."),
      );
  }
  let chartRange = "week";
  function localKey(d) {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }
  function syncChips() {
    document.querySelectorAll("[data-day]").forEach((b) => {
      const selected =
        dayFilter.value === b.dataset.day ||
        (dayFilter.value === "Today" && getTodayName() === b.dataset.day);
      b.classList.toggle("selected", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-category-filter]").forEach((b) => {
      const selected = categoryFilter.value === b.dataset.categoryFilter;
      b.classList.toggle("selected", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
  }
  [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ].forEach((day) => {
    const b = node("button", null, day.slice(0, 3));
    b.type = "button";
    b.dataset.day = day;
    b.setAttribute("aria-label", day);
    b.addEventListener("click", () => {
      dayFilter.value = day;
      renderRoutines();
    });
    document.querySelector(".day-chips").append(b);
  });
  // Keep every supported category accessible; additional pills scroll horizontally.
  ["All", "Study", "Work", "Health", "Personal", "Meal", "Sleep"].forEach(
    (category) => {
      const b = node("button", null, category);
      b.type = "button";
      b.dataset.categoryFilter = category;
      b.addEventListener("click", () => {
        categoryFilter.value = category;
        renderRoutines();
      });
      document.querySelector(".category-chips").append(b);
    },
  );
  function routineCards() {
    document
      .querySelectorAll("#routineList article[data-routine-id]")
      .forEach((card) => {
        const r = routines.find((r) => String(r.id) === card.dataset.routineId);
        if (!r) return;
        const menu = card.querySelector(".routine-menu");
        card.replaceChildren();
        card.className = "routine-item proposal-routine";
        const icon = node("span", "category-icon");
        icon.dataset.category = r.category;
        icon.append(node("i", "bi bi-" + iconFor(r.category)));
        const copy = node("div", "routine-copy");
        copy.append(
          node("h3", null, r.title),
          node(
            "p",
            null,
            formatTime(r.startTime) + " – " + formatTime(r.endTime),
          ),
        );
        const days = getRoutineDays(r),
          weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        copy.append(
          node(
            "p",
            null,
            days.length === 7
              ? "Every day"
              : days.length === 5 && weekdays.every((d) => days.includes(d))
                ? "Weekdays"
                : days.map((d) => d.slice(0, 3)).join(", "),
          ),
        );
        const edit = node("button", "edit-routine");
        edit.type = "button";
        edit.setAttribute("aria-label", "Edit " + r.title);
        edit.append(node("i", "bi bi-pencil"));
        edit.addEventListener("click", () => editRoutine(r.id));
        card.append(icon, copy, edit);
      });
  }
  function renderChart() {
    const groups = [];
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    if (chartRange === "week")
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        groups.push({
          label: d.toLocaleDateString("en-GB", { weekday: "narrow" }),
          description: d.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          }),
          count: new Set(completionHistory[localKey(d)] || []).size,
        });
      }
    if (chartRange === "month")
      for (let i = 3; i >= 0; i--) {
        let count = 0;
        for (let j = i * 7; j < (i + 1) * 7; j++) {
          const d = new Date(now);
          d.setDate(d.getDate() - j);
          count += new Set(completionHistory[localKey(d)] || []).size;
        }
        groups.push({
          label: "W" + (4 - i),
          description: "Week " + (4 - i) + " of the last 28 days",
          count,
        });
      }
    if (chartRange === "year")
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 12);
        const prefix = localKey(d).slice(0, 7);
        let count = 0;
        Object.entries(completionHistory).forEach(([date, ids]) => {
          if (date.startsWith(prefix)) count += new Set(ids).size;
        });
        groups.push({
          label: d.toLocaleDateString("en-GB", { month: "narrow" }),
          description: d.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          }),
          count,
        });
      }
    $("chartHeading").textContent = {
      week: "Weekly completion",
      month: "Monthly completion",
      year: "Yearly completion",
    }[chartRange];
    const max = Math.max(1, ...groups.map((g) => g.count));
    $("weekBars").replaceChildren();
    groups.forEach((g) => {
      const col = node("div", "week-day");
      col.setAttribute("role", "listitem");
      col.setAttribute(
        "aria-label",
        g.description + ": " + g.count + " completed",
      );
      col.title = g.count + " completed";
      const track = node("div", "bar-track");
      const bar = node("div", "bar-fill");
      bar.style.height = (g.count / max) * 100 + "%";
      track.append(bar);
      col.append(track, node("span", null, g.label));
      $("weekBars").append(col);
    });
  }
  document.querySelectorAll("[data-range]").forEach((b) =>
    b.addEventListener("click", () => {
      chartRange = b.dataset.range;
      document.querySelectorAll("[data-range]").forEach((other) => {
        const selected = other === b;
        other.classList.toggle("selected", selected);
        other.setAttribute("aria-pressed", String(selected));
      });
      renderChart();
    }),
  );
  function matchProposal() {
    $("screenDate").textContent = new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const today = todayRoutines(),
      done = today.filter((r) => isRoutineCompleted(r.id));
    const percent = today.length
      ? Math.round((done.length / today.length) * 100)
      : 0;
    $("ratePercent").textContent = percent + "%";
    $("ringPercent").textContent = percent + "%";
    $("completionRing").style.setProperty("--completion", percent + "%");
    $("progressTodayLabel").textContent =
      done.length + " of " + today.length + " completed today";
    $("completedCount").textContent = done.length + "/" + today.length;
    const dates = Object.keys(completionHistory)
      .filter((k) => (completionHistory[k] || []).length)
      .sort();
    let best = 0,
      run = 0,
      previous = null;
    for (const key of dates) {
      const d = new Date(key + "T12:00:00");
      const yesterday = new Date(d);
      yesterday.setDate(d.getDate() - 1);
      run = previous === localKey(yesterday) ? run + 1 : 1;
      best = Math.max(best, run);
      previous = key;
    }
    $("bestStreak").textContent = best + " " + (best === 1 ? "day" : "days");
    $("themeToggle").setAttribute(
      "aria-checked",
      String(document.body.classList.contains("dark-mode")),
    );
    syncChips();
    routineCards();
    renderChart();
    localIcons();
  }
  $("deleteRoutineFromEditor").addEventListener("click", () => {
    if (editingRoutineId) deleteRoutine(editingRoutineId);
  });
  $("themeToggle").addEventListener("click", () =>
    $("themeToggle").setAttribute(
      "aria-checked",
      String(document.body.classList.contains("dark-mode")),
    ),
  );
  const renderBase = renderViews;
  renderViews = function () {
    renderBase();
    matchProposal();
  };
  window.addEventListener("routine-rendered", renderViews);
  // Expose the correct screen when a notification deep link opens a routine.
  const linked = new URL(location.href).searchParams.get("routine");
  if (linked) showView("routines", false);
  else showView("today", false);
  window.addEventListener("routine-editor-change", (e) => {
    if (e.detail) {
      $("deleteRoutineFromEditor").hidden = !editingRoutineId;
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
