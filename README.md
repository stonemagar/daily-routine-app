# daily-routine-app
A mobile-friendly daily routine planner built with HTML, CSS and JavaScript


## Progress tracking

The Progress tab includes day/week/month/year reports, custom date ranges (up to 366 days), category and routine filters, equal-length period comparisons, a dated completed-routines list for each period, a completion-count heatmap (latest 91 days in the selected period), scheduled-day streaks, routine details, category/weekday insights, editable history, a weekly completion goal, lifetime milestones, CSV export and a printable report.

Data stays in localStorage. `routineProgress` adds versioned schedule snapshots, explicit skipped/completed records, completion timestamps and goals; original `routines` and `completionHistory` keys remain compatible with notifications. Backups are version 3 and include the progress ledger. Version 2 backups still import. Deletion archives analytical history and stops future scheduling from tomorrow. Edits apply today onward, preserving earlier dates.

Historical completions from before this upgrade are retained. Missing schedules and completion times are never invented: these completions count toward totals, but not rates or streaks. A past-date correction has no timestamp. Rates exclude skipped and upcoming routines; an early completion counts immediately. Streaks count fully completed scheduled days, skip rest/fully skipped days, and give today until midnight. Streaks follow the category/routine filter over all tracked dates. Goals and milestones always use all routines.

Run `npm ci`, `npm test`, and `npm run check` with Node 24+. Deterministic calculation tests cover legacy migration, schedule changes, deletion, statuses, timestamps, due-only rates, date arithmetic, filters, streaks and backup validation. DOM tests exercise navigation, persisted completion/editing, filters, custom dates, theme and preservation of history on deletion.


Use Previous/Next to browse complete past calendar weeks, months and years; current periods stop at today. The current-period button returns to the present. Custom date ranges use their date inputs instead of period arrows. Chart bars are keyboard-accessible buttons that open paginated occurrence details, including completion/missed/skipped/upcoming status and a link to review each date.

Explore demo progress creates fictional data in memory only. The banner and heading label the preview, history/goal editing and report exports are disabled, and returning restores the real report's dates and filters. Leaving Progress or reloading exits demo mode. It never replaces `routines`, `completionHistory`, or `routineProgress`. Tests compare browser storage before and after demo exploration.
