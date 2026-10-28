/* Progress UI. All metrics come from the same occurrence ledger. */
(() => {
  "use strict";
  const C = ProgressCore,
    $ = (id) => document.getElementById(id);
  const node = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  let demoData = null,
    savedView = null;
  const data = () => demoData?.state || progressData;
  const activeRoutines = () => demoData?.routines || routines;
  const rate = (n) => (n === null ? "—" : n + "%");
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const readable = (d) => dateFormatter.format(new Date(d + "T12:00:00"));
  let period = "week",
    periodAnchor = getTodayKey(),
    selected = C.periodRange(period, periodAnchor),
    detailId = null,
    datesDirty = false,
    followCurrent = true;
  $("progressFrom").value = selected.start;
  $("progressTo").value = selected.end;
  $("historyDate").value = getTodayKey();
  const filters = () => ({
    category: $("progressCategory").value,
    routine: $("progressRoutine").value,
  });
  const allRows = (a, b, filter = filters(), now = new Date()) =>
    C.dates(a, b).flatMap((d) => C.rows(data(), d, now, filter));
  function options() {
    const category = $("progressCategory").value,
      routine = $("progressRoutine").value;
    const ids = new Set([
      ...Object.keys(data().schedules),
      ...Object.values(data().records).flatMap((rs) => Object.keys(rs)),
    ]);
    const entries = [...ids]
      .map((id) => C.labelRoutine(data(), id, getTodayKey()))
      .sort((a, b) => a.title.localeCompare(b.title));
    $("progressCategory").replaceChildren(node("option", "All"));
    [...new Set(entries.map((r) => r.category))]
      .sort()
      .forEach((c) => $("progressCategory").append(node("option", c)));
    $("progressCategory").value = [...$("progressCategory").options].some(
      (o) => o.value === category,
    )
      ? category
      : "All";
    const first = node("option", "All routines");
    first.value = "";
    $("progressRoutine").replaceChildren(first);
    entries.forEach((r) => {
      const o = node(
        "option",
        r.title +
          (activeRoutines().some((x) => x.id === r.id) ? "" : " (archived)"),
      );
      o.value = r.id;
      $("progressRoutine").append(o);
    });
    $("progressRoutine").value = entries.some((r) => r.id === routine)
      ? routine
      : "";
  }
  function insightRow(title, description, value) {
    const row = node("div", undefined, "insight-row");
    const copy = node("div");
    copy.append(node("strong", title), node("small", description));
    row.append(copy, node("span", value));
    return row;
  }
  function renderChart(rs) {
    const ds = C.dates(selected.start, selected.end),
      groups = [];
    for (const d of ds) {
      const key =
        ds.length <= 7
          ? d
          : ds.length <= 31
            ? C.shift(selected.start, Math.floor(ds.indexOf(d) / 7) * 7)
            : d.slice(0, 7);
      let g = groups.at(-1);
      if (!g || g.key !== key) {
        g = { key, dates: [], count: 0 };
        groups.push(g);
      }
      g.dates.push(d);
    }
    for (const g of groups)
      g.count = rs.filter(
        (r) => g.dates.includes(r.date) && r.status === "completed",
      ).length;
    const max = Math.max(1, ...groups.map((g) => g.count));
    $("weekBars").replaceChildren();
    groups.forEach((g) => {
      const col = node("div", undefined, "week-day");
      col.setAttribute("role", "listitem");
      const label =
        g.dates.length === 1
          ? readable(g.key)
          : readable(g.dates[0]) + " – " + readable(g.dates.at(-1));
      col.setAttribute("aria-label", label + ": " + g.count + " completed");
      col.title = label + ": " + g.count + " completed";
      const track = node("div", undefined, "bar-track"),
        bar = node("div", undefined, "bar-fill");
      bar.style.height = (100 * g.count) / max + "%";
      track.append(bar);
      const button = node("button", undefined, "chart-bar-button");
      button.type = "button";
      button.setAttribute(
        "aria-label",
        "View " + label + ": " + g.count + " completed",
      );
      button.title = "View routines for " + label;
      button.onclick = () => {
        chartSelection = {
          start: g.dates[0],
          end: g.dates.at(-1),
          signature: reportSignature(),
        };
        chartLimit = 20;
        renderDrilldown(rs);
        $("chartDrilldown").scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        $("chartDrilldownHeading").focus({ preventScroll: true });
      };
      button.append(
        track,
        node(
          "span",
          ds.length > 31
            ? new Date(g.key + "-01T12:00:00").toLocaleDateString("en-GB", {
                month: "narrow",
              })
            : String(new Date(g.dates[0] + "T12:00:00").getDate()),
        ),
      );
      col.append(button);
      $("weekBars").append(col);
    });
  }
  let chartSelection = null,
    chartLimit = 20;
  const reportSignature = () =>
    JSON.stringify([selected, filters(), Boolean(demoData)]);
  function renderDrilldown(rs) {
    if (chartSelection?.signature !== reportSignature()) chartSelection = null;
    $("chartDrilldown").hidden = !chartSelection;
    if (!chartSelection) return;
    const rows = rs
      .filter(
        (r) => r.date >= chartSelection.start && r.date <= chartSelection.end,
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          a.routine.startTime.localeCompare(b.routine.startTime),
      );
    const summary = C.summary(rows);
    $("chartDrilldownHeading").textContent =
      readable(chartSelection.start) +
      (chartSelection.end === chartSelection.start
        ? ""
        : " – " + readable(chartSelection.end));
    $("chartDrilldownSummary").textContent =
      `${summary.completed} completed · ${summary.missed} missed · ${summary.skipped} skipped · ${summary.pending} upcoming`;
    $("chartDrilldownList").replaceChildren();
    rows.slice(0, chartLimit).forEach((r) => {
      const row = historyRow(r, false);
      row.dataset.status = r.status;
      const review = node("button", "Review date");
      review.type = "button";
      review.setAttribute(
        "aria-label",
        "Review " + r.routine.title + " on " + r.date,
      );
      review.onclick = () => {
        $("historyDate").value = r.date;
        renderHistory();
        heatmap();
        $("historyDate").scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        $("historyDate").focus({ preventScroll: true });
      };
      row.append(review);
      $("chartDrilldownList").append(row);
    });
    if (!rows.length)
      $("chartDrilldownList").append(
        node(
          "p",
          "No recorded or scheduled routines in this chart period.",
          "muted",
        ),
      );
    $("moreChartDetails").hidden = rows.length <= chartLimit;
    $("moreChartDetails").textContent =
      "Show more (" + Math.max(0, rows.length - chartLimit) + " remaining)";
  }
  $("closeChartDrilldown").onclick = () => {
    chartSelection = null;
    $("chartDrilldown").hidden = true;
    $("chartHeading").focus();
  };
  $("moreChartDetails").onclick = () => {
    chartLimit += 20;
    renderDrilldown(allRows(selected.start, selected.end));
  };
  function heatmap() {
    const start =
        selected.start > C.shift(selected.end, -90)
          ? selected.start
          : C.shift(selected.end, -90),
      ds = C.dates(start, selected.end);
    $("heatmapLabel").textContent = ds.length + " days";
    $("progressHeatmap").replaceChildren();
    ["M", "T", "W", "T", "F", "S", "S"].forEach((d) =>
      $("progressHeatmap").append(node("span", d, "heatmap-weekday")),
    );
    const offset = (new Date(start + "T12:00:00").getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) $("progressHeatmap").append(node("span"));
    const stats = ds.map((d) =>
        C.summary(C.rows(data(), d, new Date(), filters())),
      ),
      max = Math.max(1, ...stats.map((s) => s.completed));
    ds.forEach((d, i) => {
      const b = node(
          "button",
          String(new Date(d + "T12:00:00").getDate()),
          "heatmap-cell",
        ),
        s = stats[i];
      b.type = "button";
      b.dataset.date = d;
      b.dataset.level = s.completed
        ? String(Math.max(1, Math.ceil((3 * s.completed) / max)))
        : "0";
      b.setAttribute(
        "aria-label",
        readable(d) +
          ": " +
          s.completed +
          " completed, " +
          s.missed +
          " missed, " +
          s.skipped +
          " skipped",
      );
      b.setAttribute("aria-pressed", String($("historyDate").value === d));
      b.title = b.getAttribute("aria-label");
      b.onclick = () => {
        $("historyDate").value = d;
        renderHistory();
        heatmap();
        $("historyDate").scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      };
      $("progressHeatmap").append(b);
    });
  }
  function historyRow(r, editable) {
    const row = node("div", undefined, "history-row");
    row.append(node("strong", r.routine.title));
    let desc =
      readable(r.date) +
      " · " +
      r.status +
      (r.known ? "" : " · historical schedule unavailable");
    if (r.completedAt)
      desc +=
        " · recorded " +
        new Date(r.completedAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
    row.append(node("small", desc));
    if (editable) {
      const select = node("select");
      select.setAttribute(
        "aria-label",
        "Status for " + r.routine.title + " on " + r.date,
      );
      [
        ["pending", "Not completed"],
        ["completed", "Completed"],
        ["skipped", "Skipped"],
      ].forEach(([value, label]) => {
        const o = node("option", label);
        o.value = value;
        select.append(o);
      });
      select.value = r.status === "missed" ? "pending" : r.status;
      select.onchange = () => {
        if (demoData) return;
        C.setStatus(data(), r.id, r.date, select.value);
        persistProgress();
        const ids = (completionHistory[r.date] || []).filter(
          (id) => id !== r.id,
        );
        if (select.value === "completed") ids.push(r.id);
        completionHistory[r.date] = ids;
        saveCompletionHistory();
        renderRoutines();
        $("historyFeedback").textContent =
          "History updated for " + readable(r.date) + ".";
      };
      row.append(select);
    }
    return row;
  }
  function renderHistory() {
    const d = $("historyDate").value,
      area = $("progressHistory");
    area.replaceChildren();
    if (!C.validDate(d) || d > getTodayKey()) {
      $("historyNotice").textContent = "Choose today or an earlier date.";
      return;
    }
    const rs = C.rows(data(), d, new Date(), filters());
    $("historyNotice").textContent = demoData
      ? "Demo history is read-only. Return to your progress to edit your own records."
      : d < data().startedOn
        ? "Only recorded completions are available before " +
          readable(data().startedOn) +
          ". Missing schedules cannot be reconstructed."
        : "Changes are saved immediately. Past corrections do not invent a completion time.";
    rs.forEach((r) => area.append(historyRow(r, !demoData)));
    if (!rs.length)
      area.append(
        node(
          "p",
          "No recorded or scheduled routines for this date and filter.",
          "muted",
        ),
      );
  }
  let completedLimit = 20,
    completedSelection = "",
    completedRows = [];
  function renderCompletedRows() {
    const list = $("periodCompletedList");
    list.replaceChildren();
    completedRows.slice(0, completedLimit).forEach((r) => {
      const row = node("div", undefined, "history-row");
      row.dataset.date = r.date;
      row.append(node("strong", r.routine.title));
      const time = r.completedAt
        ? " · completed at " +
          new Date(r.completedAt).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      row.append(
        node("small", readable(r.date) + " · " + r.routine.category + time),
      );
      list.append(row);
    });
    if (!completedRows.length)
      list.append(
        node(
          "p",
          "No completed routines saved for this period and filter. Mark a routine complete on Today, or review a past date in Completion history.",
          "muted",
        ),
      );
    $("showMoreCompleted").hidden = completedRows.length <= completedLimit;
    $("showMoreCompleted").textContent =
      "Show more (" +
      Math.max(0, completedRows.length - completedLimit) +
      " remaining)";
  }
  function renderCompleted(rs) {
    const signature = reportSignature();
    if (signature !== completedSelection) completedLimit = 20;
    completedSelection = signature;
    completedRows = rs
      .filter((r) => r.status === "completed")
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.completedAt || "").localeCompare(a.completedAt || "") ||
          a.routine.title.localeCompare(b.routine.title),
      );
    $("periodCompletedCount").textContent = String(completedRows.length);
    $("periodCompletedDescription").textContent =
      readable(selected.start) +
      " – " +
      readable(selected.end) +
      ". Most recent first; each completed occurrence is listed separately.";
    renderCompletedRows();
  }
  $("showMoreCompleted").onclick = () => {
    completedLimit += 20;
    renderCompletedRows();
  };
  function renderDetail(rs) {
    $("routineDetail").hidden = !detailId;
    if (!detailId) return;
    const r = C.labelRoutine(data(), detailId, getTodayKey()),
      list = rs.filter((x) => x.id === detailId),
      s = C.summary(list),
      st = C.streaks(data(), new Date(), {
        ...filters(),
        routine: detailId,
      });
    const lifetime = Object.entries(data().records)
      .filter(([d]) => d <= getTodayKey())
      .filter(
        ([, records]) => records[detailId]?.status === "completed",
      ).length;
    $("routineDetailTitle").textContent = r.title;
    $("routineDetailSummary").textContent =
      `${lifetime} lifetime completions · ${s.completed} this period · ${rate(s.rate)} rate · ${st.current} current / ${st.best} best streak. Showing latest 30 occurrences in the selected period.`;
    $("routineDetailHistory").replaceChildren();
    list
      .slice(-30)
      .reverse()
      .forEach((r) => $("routineDetailHistory").append(historyRow(r, false)));
  }
  function render() {
    if (!demoData) {
      C.sync(data(), routines, getTodayKey());
      persistProgress();
    }
    options();
    $("progressDemoBanner").hidden = !demoData;
    $("progressHeading").textContent = demoData
      ? "Demo progress"
      : "Your progress";
    $("toggleProgressDemo").hidden = Boolean(demoData);
    $("toggleProgressDemo").textContent = demoData
      ? "Return to my progress"
      : "Explore demo progress";
    $("toggleProgressDemo").setAttribute(
      "aria-pressed",
      String(Boolean(demoData)),
    );
    $("weeklyGoalForm").hidden = Boolean(demoData);
    $("goalFeedback").hidden = $("historyFeedback").hidden = Boolean(demoData);
    $("exportProgressCsv").disabled = $("printProgress").disabled =
      Boolean(demoData);
    document.querySelectorAll("[data-progress-period]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.progressPeriod === period);
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.progressPeriod === period),
      );
    });
    if (period !== "custom") {
      if (followCurrent) periodAnchor = getTodayKey();
      selected = C.periodRange(period, periodAnchor);
      if (!datesDirty) {
        $("progressFrom").value = selected.start;
        $("progressTo").value = selected.end;
      }
    }
    $("progressFrom").max =
      $("progressTo").max =
      $("historyDate").max =
        getTodayKey();
    const rs = allRows(selected.start, selected.end),
      s = C.summary(rs),
      st = C.streaks(data(), new Date(), filters());
    renderNavigation();
    $("progressRangeLabel").textContent =
      (demoData ? "Demo · " : "") +
      readable(selected.start) +
      " – " +
      readable(selected.end);
    $("ratePercent").textContent = $("ringPercent").textContent = rate(s.rate);
    $("completionRing").style.setProperty("--completion", (s.rate || 0) + "%");
    $("progressTodayLabel").textContent =
      s.completed +
      " completed · " +
      s.eligible +
      " eligible" +
      (s.legacy
        ? " · " + s.legacy + " older completions excluded from rate"
        : "");
    $("progressCounts").replaceChildren();
    [
      ["Completed", s.completed],
      ["Missed", s.missed],
      ["Skipped", s.skipped],
      ["Upcoming", s.pending],
    ].forEach(([label, n]) => {
      const d = node("div");
      d.append(node("strong", String(n)), node("small", label));
      $("progressCounts").append(d);
    });
    const length = C.dates(selected.start, selected.end).length,
      prevEnd = C.shift(selected.start, -1),
      prevStart = C.shift(prevEnd, -length + 1),
      prev = C.summary(allRows(prevStart, prevEnd));
    $("progressComparison").textContent =
      s.rate === null || prev.rate === null
        ? "A rate comparison will appear when both periods have known schedules."
        : `${s.rate - prev.rate >= 0 ? "+" : ""}${s.rate - prev.rate} percentage points vs the previous ${length} day${length === 1 ? "" : "s"} (${readable(prevStart)} – ${readable(prevEnd)}).`;
    $("streakStat").textContent =
      st.current + " " + (st.current === 1 ? "day" : "days");
    $("bestStreak").textContent =
      st.best + " " + (st.best === 1 ? "day" : "days");
    renderChart(rs);
    renderDrilldown(rs);
    renderCompleted(rs);
    heatmap();
    // Goals and milestones deliberately use all routines, independent of report filters.
    const week = C.range("week", getTodayKey()),
      weekly = C.summary(allRows(week.start, week.end, {})).completed,
      goal = data().goals.weekly;
    $("weeklyGoalLabel").textContent =
      `${weekly} of ${goal} completions this calendar week · all routines`;
    $("weeklyGoalProgress").setAttribute("aria-valuemax", goal);
    $("weeklyGoalProgress").setAttribute(
      "aria-valuenow",
      Math.min(weekly, goal),
    );
    $("weeklyGoalProgress").setAttribute(
      "aria-valuetext",
      weekly + " of " + goal + " completed",
    );
    $("weeklyGoalProgress").firstElementChild.style.width =
      Math.min(100, (100 * weekly) / goal) + "%";
    if (document.activeElement !== $("weeklyGoalInput"))
      $("weeklyGoalInput").value = goal;
    const total = Object.entries(data().records)
      .filter(([d]) => d <= getTodayKey())
      .reduce(
        (n, [, records]) =>
          n +
          Object.values(records).filter((r) => r.status === "completed").length,
        0,
      );
    $("progressMilestones").replaceChildren(
      node("p", total + " lifetime completions", "chart-note"),
    );
    [1, 10, 30, 100, 365, 1000].forEach((n) => {
      const b = node(
        "span",
        (total >= n ? "✓ " : "") + n + " completions",
        total >= n ? "earned" : "",
      );
      b.setAttribute(
        "aria-label",
        n + " completions: " + (total >= n ? "achieved" : "not yet achieved"),
      );
      $("progressMilestones").append(b);
    });
    $("categoryStats").replaceChildren();
    [...new Set(rs.map((r) => r.routine.category))].sort().forEach((c) => {
      const a = C.summary(rs.filter((r) => r.routine.category === c));
      $("categoryStats").append(
        insightRow(
          c,
          a.completed + " completed · " + a.missed + " missed",
          rate(a.rate),
        ),
      );
    });
    if (!rs.length)
      $("categoryStats").append(node("p", "No data for this period.", "muted"));
    $("weekdayStats").replaceChildren();
    [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]
      .map((day) => ({
        day,
        s: C.summary(
          rs.filter(
            (r) =>
              [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ][new Date(r.date + "T12:00:00").getDay()] === day,
          ),
        ),
      }))
      .sort((a, b) => (b.s.rate ?? -1) - (a.s.rate ?? -1))
      .forEach(({ day, s }) =>
        $("weekdayStats").append(
          insightRow(
            day,
            s.completed + " completed · " + s.eligible + " eligible",
            rate(s.rate),
          ),
        ),
      );
    $("routineStats").replaceChildren();
    [...new Set(rs.map((r) => r.id))]
      .map((id) => ({ id, s: C.summary(rs.filter((r) => r.id === id)) }))
      .sort(
        (a, b) =>
          (b.s.rate ?? -1) - (a.s.rate ?? -1) || b.s.completed - a.s.completed,
      )
      .forEach(({ id, s }) => {
        const r = C.labelRoutine(data(), id, selected.end),
          b = node("button");
        b.type = "button";
        b.className = "insight-row";
        const copy = node("div");
        copy.append(
          node("strong", r.title),
          node(
            "small",
            `${s.completed} completed · ${s.missed} missed · ${s.skipped} skipped`,
          ),
        );
        b.append(copy, node("span", rate(s.rate)));
        b.onclick = () => {
          detailId = id;
          renderDetail(rs);
          $("routineDetail").scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        };
        $("routineStats").append(b);
      });
    if (!rs.length)
      $("routineStats").append(
        node("p", "Your routine insights will appear here.", "muted"),
      );
    renderDetail(rs);
    renderHistory();
    $("progressTrackingNote").textContent =
      (demoData
        ? "Fictional demo schedule began "
        : "Schedule tracking began ") +
      readable(data().startedOn) +
      (demoData
        ? ". Demo progress is temporary and never saved to your device."
        : ". Completions are stored on this device and included in Settings → Export backup.");
  }
  function renderNavigation() {
    const custom = period === "custom";
    $("previousProgressPeriod").disabled = custom;
    $("nextProgressPeriod").disabled =
      custom || !C.periodRange(period, C.movePeriod(period, periodAnchor, 1));
    $("previousProgressPeriod").setAttribute(
      "aria-label",
      "Previous " + (custom ? "period" : period),
    );
    $("nextProgressPeriod").setAttribute(
      "aria-label",
      "Next " + (custom ? "period" : period),
    );
    $("currentProgressPeriod").textContent = {
      day: "Today",
      week: "This week",
      month: "This month",
      year: "This year",
      custom: "This week",
    }[period];
    $("periodNavigationHint").hidden = !custom;
  }
  function navigatePeriod(offset) {
    if (period === "custom") return;
    const target = C.movePeriod(period, periodAnchor, offset);
    if (!C.periodRange(period, target)) return;
    periodAnchor = target;
    followCurrent =
      C.range(period, target).start === C.range(period, getTodayKey()).start;
    datesDirty = false;
    $("progressFilterError").textContent = "";
    render();
  }
  $("previousProgressPeriod").onclick = () => navigatePeriod(-1);
  $("nextProgressPeriod").onclick = () => navigatePeriod(1);
  $("currentProgressPeriod").onclick = () => {
    if (period === "custom") period = "week";
    periodAnchor = getTodayKey();
    followCurrent = true;
    datesDirty = false;
    $("progressFilterError").textContent = "";
    render();
  };
  function toggleDemo() {
    chartSelection = null;
    if (!demoData) {
      savedView = {
        period,
        periodAnchor,
        followCurrent,
        selected: { ...selected },
        detailId,
        datesDirty,
        category: filters().category,
        routine: filters().routine,
        history: $("historyDate").value,
        from: $("progressFrom").value,
        to: $("progressTo").value,
      };
      demoData = C.demo();
      period = "month";
      periodAnchor = getTodayKey();
      followCurrent = true;
      datesDirty = false;
      detailId = null;
      options();
      $("progressCategory").value = "All";
      $("progressRoutine").value = "";
      $("historyDate").value = getTodayKey();
    } else {
      demoData = null;
      ({ period, periodAnchor, followCurrent, selected, detailId, datesDirty } =
        savedView);
      options();
      $("progressCategory").value = savedView.category;
      $("progressRoutine").value = savedView.routine;
      $("historyDate").value = savedView.history;
      $("progressFrom").value = savedView.from;
      $("progressTo").value = savedView.to;
    }
    $("progressFilterError").textContent = "";
    render();
  }
  $("toggleProgressDemo").onclick = toggleDemo;
  $("exitProgressDemo").onclick = toggleDemo;
  document.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      if (demoData && b.dataset.view !== "progress") toggleDemo();
    }),
  );
  document.querySelectorAll("[data-progress-period]").forEach(
    (b) =>
      (b.onclick = () => {
        period = b.dataset.progressPeriod;
        periodAnchor = getTodayKey();
        followCurrent = true;
        datesDirty = false;
        document.querySelectorAll("[data-progress-period]").forEach((x) => {
          x.classList.toggle("selected", x === b);
          x.setAttribute("aria-pressed", String(x === b));
        });
        $("progressFilterError").textContent = "";
        render();
      }),
  );
  $("applyProgressFilters").onclick = () => {
    const start = $("progressFrom").value,
      end = $("progressTo").value;
    if (
      !C.validDate(start) ||
      !C.validDate(end) ||
      start > end ||
      end > getTodayKey() ||
      C.shift(start, 365) < end
    ) {
      $("progressFilterError").textContent =
        "Choose a valid range of up to 366 days, ending today or earlier.";
      return;
    }
    selected = { start, end };
    period = "custom";
    followCurrent = false;
    datesDirty = false;
    document.querySelectorAll("[data-progress-period]").forEach((x) => {
      x.classList.remove("selected");
      x.setAttribute("aria-pressed", "false");
    });
    $("progressFilterError").textContent = "";
    render();
  };
  ["progressFrom", "progressTo"].forEach((id) =>
    $(id).addEventListener("input", () => {
      datesDirty = true;
    }),
  );
  ["progressCategory", "progressRoutine"].forEach(
    (id) => ($(id).onchange = render),
  );
  $("historyDate").onchange = () => {
    renderHistory();
    heatmap();
  };
  $("closeRoutineDetail").onclick = () => {
    detailId = null;
    $("routineDetail").hidden = true;
  };
  $("weeklyGoalForm").onsubmit = (e) => {
    e.preventDefault();
    if (demoData) return;
    const goal = Number($("weeklyGoalInput").value);
    if (!Number.isInteger(goal) || goal < 1 || goal > 9999) return;
    data().goals.weekly = goal;
    persistProgress();
    render();
    $("goalFeedback").textContent = "Weekly goal saved.";
  };
  const csvCell = (value) => {
    let s = String(value ?? "");
    if (/^(\s*[=+\-@]|[\t\r])/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  $("exportProgressCsv").onclick = () => {
    if (demoData) return;
    const rs = allRows(selected.start, selected.end),
      headers = [
        "Date",
        "Routine",
        "Category",
        "Status",
        "Scheduled",
        "Completed at",
      ];
    const lines = [
      headers,
      ...rs.map((r) => [
        r.date,
        r.routine.title,
        r.routine.category,
        r.status,
        r.known ? "yes" : "unknown",
        r.completedAt || "",
      ]),
    ];
    const blob = new Blob(
        [
          "\uFEFF" +
            lines.map((row) => row.map(csvCell).join(",")).join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      url = URL.createObjectURL(blob),
      a = node("a");
    a.href = url;
    a.download = `routine-progress-${selected.start}-to-${selected.end}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $("printProgress").onclick = () => {
    if (demoData) return;
    let report = $("printReport");
    if (!report) {
      report = node("section");
      report.id = "printReport";
      document.body.append(report);
    }
    report.replaceChildren(
      node("h1", "Daily Routine · Progress report"),
      node("p", $("progressRangeLabel").textContent),
      node(
        "p",
        "Category: " +
          filters().category +
          " · Routine: " +
          ($("progressRoutine").selectedOptions[0]?.textContent ||
            "All routines"),
      ),
      node(
        "p",
        $("progressTodayLabel").textContent +
          " · Rate " +
          $("ratePercent").textContent,
      ),
      node(
        "p",
        "Schedule tracking began " +
          readable(data().startedOn) +
          ". Upcoming and skipped routines are excluded from rates. Older completions may have no known schedule.",
      ),
    );
    const table = node("table"),
      head = node("thead"),
      tr = node("tr");
    ["Date", "Routine", "Status", "Completion time"].forEach((t) =>
      tr.append(node("th", t)),
    );
    head.append(tr);
    table.append(head);
    const body = node("tbody");
    allRows(selected.start, selected.end).forEach((r) => {
      const row = node("tr");
      [
        r.date,
        r.routine.title,
        r.status,
        r.completedAt
          ? new Date(r.completedAt).toLocaleString("en-GB")
          : "Not recorded",
      ].forEach((t) => row.append(node("td", t)));
      body.append(row);
    });
    table.append(body);
    report.append(table);
    window.print();
  };
  window.addEventListener("routine-rendered", render);
  document
    .querySelector('[data-view="progress"]')
    .addEventListener("click", render);
  window.addEventListener("routine-editor-change", render);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") render();
  });
  setInterval(render, 60000);
  render();
})();
