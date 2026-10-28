/* Calendar-based analytics, shared by the browser and deterministic Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ProgressCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const dateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const validDate = (s) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    dateKey(new Date(s + "T12:00:00")) === s;
  const shift = (s, n) => {
    const d = new Date(s + "T12:00:00");
    d.setDate(d.getDate() + n);
    return dateKey(d);
  };
  const dates = (a, b) => {
    const out = [];
    if (!validDate(a) || !validDate(b)) return out;
    for (let d = a; d <= b && out.length < 3660; d = shift(d, 1)) out.push(d);
    return out;
  };
  const days = (r) =>
    Array.isArray(r.days)
      ? r.days
      : r.day === "Everyday"
        ? [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ]
        : [r.day];
  const snapshot = (r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    startTime: r.startTime,
    endTime: r.endTime,
    days: days(r),
  });
  function validState(s) {
    if (
      !s ||
      s.version !== 1 ||
      !validDate(s.startedOn) ||
      !s.schedules ||
      typeof s.schedules !== "object" ||
      Array.isArray(s.schedules) ||
      !s.records ||
      typeof s.records !== "object" ||
      Array.isArray(s.records) ||
      !s.goals ||
      !Number.isInteger(s.goals.weekly) ||
      s.goals.weekly < 1 ||
      s.goals.weekly > 9999
    )
      return false;
    const validRoutine = (r) =>
      r &&
      typeof r.id === "string" &&
      typeof r.title === "string" &&
      typeof r.category === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(r.startTime) &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(r.endTime) &&
      Array.isArray(r.days) &&
      r.days.every((d) =>
        [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ].includes(d),
      );
    return (
      Object.entries(s.schedules).every(
        ([id, revs]) =>
          !["__proto__", "constructor", "prototype"].includes(id) &&
          Array.isArray(revs) &&
          revs.length &&
          revs.every(
            (v, i) =>
              validDate(v.from) &&
              (i === 0 || v.from >= revs[i - 1].from) &&
              (v.routine === null ||
                (validRoutine(v.routine) && v.routine.id === id)),
          ),
      ) &&
      Object.entries(s.records).every(
        ([d, rs]) =>
          validDate(d) &&
          rs &&
          typeof rs === "object" &&
          !Array.isArray(rs) &&
          Object.entries(rs).every(
            ([id, r]) =>
              !["__proto__", "constructor", "prototype"].includes(id) &&
              r &&
              ["completed", "skipped", "pending"].includes(r.status) &&
              (r.completedAt === null ||
                (typeof r.completedAt === "string" &&
                  !Number.isNaN(Date.parse(r.completedAt)))),
          ),
      )
    );
  }
  function create(routines, history, today) {
    const state = {
      version: 1,
      startedOn: today,
      schedules: {},
      records: {},
      goals: { weekly: 20 },
    };
    sync(state, routines, today);
    for (const [d, ids] of Object.entries(history))
      if (validDate(d) && Array.isArray(ids))
        for (const id of ids)
          if (
            typeof id === "string" &&
            !["__proto__", "constructor", "prototype"].includes(id)
          ) {
            state.records[d] ||= {};
            state.records[d][id] = { status: "completed", completedAt: null };
          }
    return state;
  }
  function sync(s, routines, today) {
    const current = new Set(routines.map((r) => r.id));
    for (const r of routines) {
      if (["__proto__", "constructor", "prototype"].includes(r.id)) continue;
      const revs = own(s.schedules, r.id) ? s.schedules[r.id] : [];
      const value = snapshot(r),
        last = revs.at(-1);
      if (!last || JSON.stringify(last.routine) !== JSON.stringify(value)) {
        if (last?.from === today) revs.pop();
        revs.push({ from: today, routine: value });
        s.schedules[r.id] = revs;
      }
    }
    for (const [id, revs] of Object.entries(s.schedules))
      if (!current.has(id) && revs.at(-1)?.routine !== null) {
        const from = shift(today, 1);
        if (revs.at(-1)?.from === from) revs.pop();
        revs.push({ from, routine: null });
      }
  }
  function routineAt(s, id, date) {
    const revs = own(s.schedules, id) ? s.schedules[id] : [];
    return [...revs].reverse().find((v) => v.from <= date)?.routine || null;
  }
  function labelRoutine(s, id, date) {
    return (
      routineAt(s, id, date) ||
      [...(s.schedules[id] || [])].reverse().find((v) => v.routine)
        ?.routine || {
        id,
        title: "Archived routine",
        category: "Unknown",
        startTime: "",
        endTime: "",
        days: [],
      }
    );
  }
  function setStatus(s, id, date, status, now = new Date()) {
    if (
      !validDate(date) ||
      date > dateKey(now) ||
      !["completed", "skipped", "pending"].includes(status) ||
      ["__proto__", "constructor", "prototype"].includes(id)
    )
      throw new Error("Invalid history change");
    s.records[date] ||= {};
    const previous = s.records[date][id];
    s.records[date][id] = {
      status,
      completedAt:
        status === "completed"
          ? previous?.status === "completed"
            ? previous.completedAt
            : date === dateKey(now)
              ? now.toISOString()
              : null
          : null,
    };
  }
  function rows(s, date, now = new Date(), filter = {}) {
    const today = dateKey(now);
    if (date > today) return [];
    const weekday = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][new Date(date + "T12:00:00").getDay()];
    const ids = new Set(
      Object.keys(s.schedules).filter((id) =>
        routineAt(s, id, date)?.days.includes(weekday),
      ),
    );
    for (const id of Object.keys(s.records[date] || {})) ids.add(id);
    return [...ids]
      .map((id) => {
        const routine = labelRoutine(s, id, date),
          scheduled = routineAt(s, id, date)?.days.includes(weekday) || false;
        const record = s.records[date]?.[id];
        const due =
          date < today ||
          (routine.endTime &&
            routine.endTime <=
              `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
        const status =
          record?.status === "completed"
            ? "completed"
            : record?.status === "skipped"
              ? "skipped"
              : due && scheduled
                ? "missed"
                : "pending";
        return {
          id,
          date,
          routine,
          scheduled,
          known: scheduled,
          status,
          completedAt: record?.completedAt || null,
          eligible:
            scheduled &&
            (due || status === "completed") &&
            status !== "skipped",
        };
      })
      .filter(
        (r) =>
          (!filter.category ||
            filter.category === "All" ||
            r.routine.category === filter.category) &&
          (!filter.routine || r.id === filter.routine),
      );
  }
  function summary(rs) {
    const count = (status) => rs.filter((r) => r.status === status).length;
    const eligible = rs.filter((r) => r.eligible),
      completed = eligible.filter((r) => r.status === "completed").length;
    return {
      completed: count("completed"),
      missed: count("missed"),
      skipped: count("skipped"),
      pending: rs.filter((r) => r.known && r.status === "pending").length,
      eligible: eligible.length,
      rate: eligible.length
        ? Math.round((100 * completed) / eligible.length)
        : null,
      legacy: rs.filter((r) => !r.known && r.status === "completed").length,
    };
  }
  function streaks(s, now = new Date(), filter = {}) {
    const today = dateKey(now);
    let run = 0,
      best = 0;
    for (const d of dates(s.startedOn, today)) {
      const rs = rows(s, d, now, filter).filter(
        (r) => r.known && r.status !== "skipped",
      );
      if (!rs.length) continue;
      if (rs.every((r) => r.status === "completed")) {
        run++;
        best = Math.max(best, run);
      } else if (d !== today) run = 0;
    }
    return { current: run, best };
  }
  function range(period, end) {
    if (period === "day") return { start: end, end };
    if (period === "month") return { start: end.slice(0, 7) + "-01", end };
    if (period === "year") return { start: end.slice(0, 4) + "-01-01", end };
    const day = new Date(end + "T12:00:00").getDay();
    return { start: shift(end, -((day + 6) % 7)), end };
  }
  // Full calendar periods for browsing; current periods stop at today.
  function periodRange(period, anchor, today = dateKey(new Date())) {
    const start = range(period, anchor).start;
    let end = anchor;
    if (period === "week") end = shift(start, 6);
    if (period === "month")
      end = dateKey(
        new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0, 12),
      );
    if (period === "year") end = start.slice(0, 4) + "-12-31";
    if (start > today) return null;
    return { start, end: end > today ? today : end };
  }
  function movePeriod(period, anchor, offset) {
    const d = new Date(anchor + "T12:00:00");
    if (period === "month") {
      d.setDate(1);
      d.setMonth(d.getMonth() + offset);
    } else if (period === "year") {
      d.setMonth(0, 1);
      d.setFullYear(d.getFullYear() + offset);
    } else d.setDate(d.getDate() + offset * (period === "week" ? 7 : 1));
    return dateKey(d);
  }
  // Fictional data is returned in memory only. It never accesses browser storage.
  function demo(now = new Date()) {
    const today = dateKey(now),
      start = now.getFullYear() - 1 + "-01-01";
    const everyday = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const routines = [
      {
        id: "demo-stretch",
        title: "Morning stretch",
        category: "Health",
        startTime: "07:00",
        endTime: "07:20",
        days: everyday,
      },
      {
        id: "demo-study",
        title: "Focused study",
        category: "Study",
        startTime: "10:00",
        endTime: "11:00",
        days: everyday.slice(0, 5),
      },
      {
        id: "demo-walk",
        title: "Evening walk",
        category: "Health",
        startTime: "18:00",
        endTime: "18:30",
        days: everyday,
      },
    ];
    const state = create(routines, {}, start);
    state.goals.weekly = 12;
    for (const [i, date] of dates(start, today).entries()) {
      for (const [j, r] of routines.entries()) {
        const occurrence = rows(state, date, now, { routine: r.id })[0];
        if (!occurrence?.eligible) continue;
        if ((i * 3 + j * 7) % 11 < 8 || date >= shift(today, -4)) {
          setStatus(
            state,
            r.id,
            date,
            "completed",
            new Date(date + "T" + r.endTime + ":00"),
          );
        } else if ((i + j) % 5 === 0)
          setStatus(state, r.id, date, "skipped", now);
      }
    }
    return { state, routines };
  }
  return {
    dateKey,
    validDate,
    shift,
    dates,
    create,
    validState,
    sync,
    routineAt,
    labelRoutine,
    setStatus,
    rows,
    summary,
    streaks,
    range,
    periodRange,
    movePeriod,
    demo,
  };
});
