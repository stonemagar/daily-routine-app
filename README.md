# daily-routine-app
A mobile-friendly daily routine planner built with HTML, CSS and JavaScript


## Progress tracking

The Progress tab includes day/week/month/year reports, custom date ranges (up to 366 days), category and routine filters, equal-length period comparisons, a dated completed-routines list for each period, a completion-count heatmap (latest 91 days in the selected period), scheduled-day streaks, routine details, category/weekday insights, editable history, a weekly completion goal, lifetime milestones, CSV export and a printable report.

Data stays in localStorage. `routineProgress` adds versioned schedule snapshots, explicit skipped/completed records, completion timestamps and goals; original `routines` and `completionHistory` keys remain compatible with notifications. Backups are version 3 and include the progress ledger. Version 2 backups still import. Deletion archives analytical history and stops future scheduling from tomorrow. Edits apply today onward, preserving earlier dates.

Historical completions from before this upgrade are retained. Missing schedules and completion times are never invented: these completions count toward totals, but not rates or streaks. A past-date correction has no timestamp. Rates exclude skipped and upcoming routines; an early completion counts immediately. Streaks count fully completed scheduled days, skip rest/fully skipped days, and give today until midnight. Streaks follow the category/routine filter over all tracked dates. Goals and milestones always use all routines.

Run `npm ci`, `npm test`, and `npm run check` with Node 24+. Deterministic calculation tests cover legacy migration, schedule changes, deletion, statuses, timestamps, due-only rates, date arithmetic, filters, streaks and backup validation. DOM tests exercise navigation, persisted completion/editing, filters, custom dates, theme and preservation of history on deletion.


Use Previous/Next to browse complete past calendar weeks, months and years; current periods stop at today. The current-period button returns to the present. Custom date ranges use their date inputs instead of period arrows. Chart bars are keyboard-accessible buttons that open paginated occurrence details, including completion/missed/skipped/upcoming status and a link to review each date.

Explore demo progress creates fictional data in memory only. The banner and heading label the preview, history/goal editing and report exports are disabled, and returning restores the real report's dates and filters. Leaving Progress or reloading exits demo mode. It never replaces `routines`, `completionHistory`, or `routineProgress`. Tests compare browser storage before and after demo exploration.


The main chart adapts to the selected period: Day shows four status counts, Week shows stacked daily status bars, Month shows a daily completion-rate line, and Year shows monthly completion-rate bars. Rate gaps are deliberately left blank when no eligible schedule is known; a known 0% remains a real zero. Monthly rates aggregate eligible occurrences rather than averaging daily percentages. Legends, axis units, keyboard-operable chart targets and paginated details are included. Dense date charts scroll within their card on small screens. Custom ranges select a suitable chart based on their length.


The compact overview keeps period navigation, date/filter controls, completion rate, four status counts and the analytical chart at the top. Streak summaries follow the chart. Completed routines, the consistency calendar, goals/milestones, insights, completion history and exports use native expandable sections with summary counts. They start collapsed, retain their open state during updates, and remain keyboard-accessible. Chart review links and heatmap dates automatically open the history section and focus the selected date.


## New activity editor

The activity dialog/bottom sheet includes a live category/time/repeat preview, reversible Study/Walk/Reading presets, quick durations, weekday/weekend/everyday shortcuts, weekly time totals, optional notes/priority and a sticky create/save/cancel footer. Draft shortcuts never write to storage. Edit mode keeps saved values and hides new-activity presets. Same-day time validation prevents a duration from silently rolling past midnight. Overlap hints are advisory and retain the existing save confirmation. The editor uses local SVG icons, works offline and supports keyboard focus trapping/Escape.

`tests/editor.cjs` covers preview/preset behaviour, minute arithmetic, repeat groups, draft/cancel isolation, validation, overlap confirmation and create/edit preservation. Chromium QA also exercises scrolling, persistent footer actions at 320/390/480/1280 widths, reload persistence, dark mode and deletion. Actual device keyboard behaviour and push delivery are outside these editor checks.


## Undo saved changes

Activity creation, edits, deletion, completion toggles, history corrections and weekly goal updates can be undone. Use the confirmation message or Settings → Undo changes. Up to 10 snapshots are kept in memory in this tab; dismissing the message does not remove them. Undo restores the original activity IDs, completion history and analytical schedule ledger together, and triggers the existing notification sync event.

Undo history clears on reload, backup import, a new local day or an external storage change. Restoring checks both the current model and persisted data, so a stale snapshot cannot overwrite newer changes. Undo is disabled while the editor or demo preview is open. Tests cover reverse-order restoration, no-op/cancel behaviour, original IDs/history, goals/history corrections, session limits, import/day boundaries, external-change guards and storage-write rollback.
