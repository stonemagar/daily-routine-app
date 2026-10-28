const routineForm = document.getElementById("routineForm");
const routineList = document.getElementById("routineList");
const dayFilter = document.getElementById("dayFilter");
const todayDate = document.getElementById("todayDate");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressTrack = document.getElementById("progressTrack");
const progressBarFill = document.getElementById("progressBarFill");
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeButtonText = document.getElementById("themeButtonText");
const exportButton = document.getElementById("exportButton");
const importButton = document.getElementById("importButton");
const importFile = document.getElementById("importFile");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");

/* Search and filter controls from index.html */
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const clearFiltersButton = document.getElementById("clearFiltersButton");

const updateBanner = document.getElementById("updateBanner");
const updateNowButton = document.getElementById("updateNowButton");
const dismissUpdateButton = document.getElementById("dismissUpdateButton");

/* Mobile bottom-sheet form controls */
const routineFormCard = document.getElementById("routineFormCard");
const routineFormHeading = document.getElementById("routineFormHeading");
const closeRoutineFormButton = document.getElementById(
  "closeRoutineFormButton",
);
const formBackdrop = document.getElementById("formBackdrop");
let routines = JSON.parse(localStorage.getItem("routines")) || [];

let completionHistory =
  JSON.parse(localStorage.getItem("completionHistory")) || {};

let editingRoutineId = null;
let progressData = null;
function persistProgress() {
  if (progressData)
    localStorage.setItem("routineProgress", JSON.stringify(progressData));
}

/* ------------------------------
   Local storage
------------------------------ */

function saveRoutines() {
  if (progressData) {
    ProgressCore.sync(progressData, routines, getTodayKey());
    persistProgress();
  }
  localStorage.setItem("routines", JSON.stringify(routines));
  window.dispatchEvent(new Event("routine-data-changed"));
}

function saveCompletionHistory() {
  localStorage.setItem("completionHistory", JSON.stringify(completionHistory));
  window.dispatchEvent(new Event("routine-data-changed"));
}

/* ------------------------------
   Date helpers
------------------------------ */

function getTodayKey() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayName() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
  });
}

function displayTodayDate() {
  todayDate.textContent = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(time) {
  if (!time) {
    return "";
  }

  const [hour, minute] = time.split(":");
  const date = new Date();

  date.setHours(Number(hour));
  date.setMinutes(Number(minute));

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------
   Completion tracking
------------------------------ */

function getTodayCompletedRoutineIds() {
  const todayKey = getTodayKey();

  return completionHistory[todayKey] || [];
}

function isRoutineCompleted(routineId) {
  return getTodayCompletedRoutineIds().includes(routineId);
}

function toggleRoutine(id) {
  const todayKey = getTodayKey();
  const completedIds = completionHistory[todayKey] || [];

  if (completedIds.includes(id)) {
    completionHistory[todayKey] = completedIds.filter(
      (routineId) => routineId !== id,
    );
  } else {
    completionHistory[todayKey] = [...completedIds, id];
  }

  if (progressData) {
    ProgressCore.setStatus(
      progressData,
      id,
      todayKey,
      completionHistory[todayKey].includes(id) ? "completed" : "pending",
    );
    persistProgress();
  }
  saveCompletionHistory();
  renderRoutines();
}

/* Routine editor: centered dialog on desktop and bottom sheet on phones. */

function setRoutineFormExpanded(expanded) {
  if (!routineFormCard) {
    return;
  }

  routineFormCard.classList.toggle("form-expanded", expanded);
  routineFormCard.classList.toggle("form-collapsed", !expanded);

  document.body.classList.toggle("sheet-open", expanded);
  routineFormCard.setAttribute("aria-hidden", String(!expanded));
  window.dispatchEvent(
    new CustomEvent("routine-editor-change", { detail: expanded }),
  );

  if (formBackdrop) {
    formBackdrop.hidden = !expanded;
  }
}

function openRoutineForm(options = {}) {
  const { focusTitle = true } = options;

  setRoutineFormExpanded(true);

  if (focusTitle) {
    window.setTimeout(() => {
      document.getElementById("title").focus();
    }, 100);
  }
}

function closeRoutineForm() {
  setRoutineFormExpanded(false);
}

if (closeRoutineFormButton) {
  closeRoutineFormButton.addEventListener("click", closeRoutineForm);
}

if (formBackdrop) {
  formBackdrop.addEventListener("click", closeRoutineForm);
}

/* Allow keyboard users to close the sheet with Escape */
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    routineFormCard.classList.contains("form-expanded")
  ) {
    closeRoutineForm();
  }
});

function resetRoutineForm() {
  editingRoutineId = null;

  routineForm.reset();
  clearSelectedDays();
  selectTodayByDefault();
  showDayError(false);

  submitButton.textContent = "Create activity";
  cancelEditButton.classList.add("d-none");

  if (routineFormHeading) {
    routineFormHeading.textContent = "New activity";
  }

  setRoutineFormExpanded(false);
}

/* ------------------------------
   Weekday form helpers
------------------------------ */

function getSelectedDaysFromForm() {
  return Array.from(
    routineForm.querySelectorAll('input[name="days"]:checked'),
  ).map((checkbox) => checkbox.value);
}

function clearSelectedDays() {
  routineForm.querySelectorAll('input[name="days"]').forEach((checkbox) => {
    checkbox.checked = false;
  });
}

function setSelectedDays(days) {
  routineForm.querySelectorAll('input[name="days"]').forEach((checkbox) => {
    checkbox.checked = days.includes(checkbox.value);
  });
}

function selectTodayByDefault() {
  const todayName = getTodayName();

  const todayCheckbox = routineForm.querySelector(
    `input[name="days"][value="${todayName}"]`,
  );

  if (todayCheckbox) {
    todayCheckbox.checked = true;
  }
}

function showDayError(show) {
  const dayError = document.getElementById("dayError");

  if (!dayError) {
    return;
  }

  dayError.classList.toggle("d-none", !show);
}

/* ------------------------------
   Routine filtering
------------------------------ */

function getSelectedDay() {
  return dayFilter.value === "Today" ? getTodayName() : dayFilter.value;
}

function getRoutineDays(routine) {
  if (Array.isArray(routine.days)) {
    return routine.days;
  }

  if (typeof routine.day === "string") {
    return [routine.day];
  }

  return [];
}

/* ==================================================
   FILTER AND SORT ROUTINES

   This function applies three filters:
   1. Selected weekday
   2. Search text
   3. Selected category

   It then sorts matching routines by start time.
================================================== */

function getFilteredRoutines() {
  const selectedDay = getSelectedDay();

  // Remove extra spaces and use lowercase for case-insensitive searching
  const searchText = searchInput.value.trim().toLowerCase();

  // Read the selected category from the category filter
  const selectedCategory = categoryFilter.value;

  return routines
    .filter((routine) => {
      const routineDays = getRoutineDays(routine);

      // Match every routine when "All days" is selected
      const matchesDay =
        selectedDay === "All" || routineDays.includes(selectedDay);

      /* Search both the routine title and optional notes */
      const searchableText = `
        ${routine.title}
        ${routine.notes || ""}
      `.toLowerCase();

      const matchesSearch = searchableText.includes(searchText);

      // Match every category when "All categories" is selected
      const matchesCategory =
        selectedCategory === "All" || routine.category === selectedCategory;

      // A routine must pass all three checks
      return matchesDay && matchesSearch && matchesCategory;
    })
    .sort((firstRoutine, secondRoutine) =>
      firstRoutine.startTime.localeCompare(secondRoutine.startTime),
    );
}

/* ==================================================
   FORMAT ROUTINE DAYS

   Short weekday names use less space inside mobile
   routine cards.
================================================== */

function formatRoutineDays(days) {
  const weekdayNames = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
    Sunday: "Sun",
  };

  return days.map((day) => weekdayNames[day] || day).join(", ");
}

/* ==================================================
   GET PRIORITY CSS CLASS

   Converts a priority such as "High" into a CSS class
   such as "priority-high".
================================================== */

function getPriorityClass(priority) {
  const safePriority =
    typeof priority === "string" ? priority.toLowerCase() : "medium";

  return `priority-${safePriority}`;
}

/* ------------------------------
   Display routines
------------------------------ */

function renderRoutines() {
  const filteredRoutines = getFilteredRoutines();

  /*
   * Weekday names are useful only when routines from
   * every weekday are displayed together.
   */
  const showRoutineDays = dayFilter.value === "All";

  if (filteredRoutines.length === 0) {
    const noRoutinesExist = routines.length === 0;

    routineList.innerHTML = noRoutinesExist
      ? `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="bi bi-calendar-plus" aria-hidden="true"></i>
        </div>

        <h3>Create your first routine</h3>

        <p>
          Add an activity, choose its time and select the days
          when it should appear.
        </p>

        <button
          class="primary-button empty-state-button"
          type="button"
          onclick="openRoutineForm()"
        >
          <i class="bi bi-plus-lg" aria-hidden="true"></i>
          <span>Add routine</span>
        </button>
      </div>
    `
      : `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="bi bi-search" aria-hidden="true"></i>
        </div>

        <h3>No matching routines</h3>

        <p>
          Change your search, selected day or category filter.
        </p>

        <button
          class="btn btn-outline-secondary empty-state-button"
          type="button"
          onclick="clearRoutineFilters()"
        >
          <i
            class="bi bi-arrow-counterclockwise"
            aria-hidden="true"
          ></i>
          <span>Clear filters</span>
        </button>
      </div>
    `;

    updateProgress();
    window.dispatchEvent(new Event("routine-rendered"));
    return;
  }

  routineList.innerHTML = filteredRoutines
    .map((routine) => {
      const routineDays = getRoutineDays(routine);
      const completed = isRoutineCompleted(routine.id);

      /* Older routines may not contain these new properties */
      const routineNotes = routine.notes || "";
      const routinePriority = routine.priority || "Medium";
      const routineDayText = formatRoutineDays(routineDays);
      return `
  <article data-routine-id="${escapeHtml(routine.id)}" class="routine-item ${completed ? "completed" : ""}">
    <input
      class="complete-checkbox"
      type="checkbox"
      aria-label="Mark ${escapeHtml(routine.title)} complete"
      ${completed ? "checked" : ""}
      onchange="toggleRoutine('${routine.id}')"
    />

    <div class="routine-content">
      <p class="routine-title">
        ${escapeHtml(routine.title)}
      </p>

      <p class="routine-meta">
        <span>
          ${formatTime(routine.startTime)}
          –
          ${formatTime(routine.endTime)}
        </span>

        ${
          showRoutineDays
            ? `
      ${
        showRoutineDays
          ? `
      <span class="meta-separator" aria-hidden="true">·</span>
      <span>${escapeHtml(routineDayText)}</span>
    `
          : ""
      }
    `
            : ""
        }
      </p>

      <div class="routine-badges">
        <span class="routine-category">
          ${escapeHtml(routine.category)}
        </span>

        <span
          class="priority-badge ${getPriorityClass(routinePriority)}"
        >
          ${escapeHtml(routinePriority)}
        </span>
      </div>

      ${
        routineNotes
          ? `
            <p
              class="routine-notes"
              title="${escapeHtml(routineNotes)}"
            >
              ${escapeHtml(routineNotes)}
            </p>
          `
          : ""
      }
    </div>

    <details class="routine-menu">
      <summary
        aria-label="Actions for ${escapeHtml(routine.title)}"
        title="Routine actions"
      >
        <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
      </summary>

      <div class="routine-menu-panel">
        <button
          class="action-button routine-menu-button"
          type="button"
          onclick="
            this.closest('details').removeAttribute('open');
            editRoutine('${routine.id}');
          "
        >
          <i class="bi bi-pencil" aria-hidden="true"></i>
<span>Edit</span>
        </button>

        <button
          class="action-button routine-menu-button delete-button"
          type="button"
          onclick="
            this.closest('details').removeAttribute('open');
            deleteRoutine('${routine.id}');
          "
        >
          <i class="bi bi-trash3" aria-hidden="true"></i>
<span>Delete</span>
        </button>
      </div>
    </details>
  </article>
`;
    })
    .join("");

  updateProgress();
  window.dispatchEvent(new Event("routine-rendered"));
}

function updateProgress() {
  const selectedRoutines = routines.filter((r) =>
    getRoutineDays(r).includes(getTodayName()),
  );
  const total = selectedRoutines.length;

  const completed = selectedRoutines.filter((routine) =>
    isRoutineCompleted(routine.id),
  ).length;

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  progressText.textContent = `${completed} of ${total} completed`;
  progressPercent.textContent = `${percentage}%`;

  if (progressBarFill) {
    progressBarFill.style.width = `${percentage}%`;
  }

  if (progressTrack) {
    progressTrack.setAttribute("aria-valuenow", String(percentage));
  }
}

/* ==================================================
   CREATE A ROUTINE OBJECT

   Converts the form values into one routine object.
   The object is then saved inside the routines array.
================================================== */

function createRoutine(formData, selectedDays) {
  return {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now()),

    title: formData.get("title").trim(),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    category: formData.get("category"),
    days: selectedDays,

    // Notes are optional, so an empty value is allowed
    notes: formData.get("notes").trim(),

    // Priority must be Low, Medium, or High
    priority: formData.get("priority"),
  };
}

function validateRoutine(routine) {
  if (!routine.title) {
    alert("Please enter an activity name.");
    return false;
  }

  if (!routine.startTime || !routine.endTime) {
    alert("Please select both start and end times.");
    return false;
  }

  if (routine.endTime <= routine.startTime) {
    alert("End time must be later than start time.");
    return false;
  }

  return true;
}

function findScheduleConflict(newRoutine, ignoredRoutineId = null) {
  return routines.find((existingRoutine) => {
    if (existingRoutine.id === ignoredRoutineId) {
      return false;
    }

    const existingDays = getRoutineDays(existingRoutine);
    const newDays = Array.isArray(newRoutine.days) ? newRoutine.days : [];

    const sharesDay = existingDays.some((day) => newDays.includes(day));

    if (!sharesDay) {
      return false;
    }

    return (
      newRoutine.startTime < existingRoutine.endTime &&
      newRoutine.endTime > existingRoutine.startTime
    );
  });
}

cancelEditButton.addEventListener("click", () => {
  resetRoutineForm();
});

/* ------------------------------
   Submit routine form
------------------------------ */

routineForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const formData = new FormData(routineForm);
  const selectedDays = getSelectedDaysFromForm();

  /* Read the current values from the routine form */
  const routineData = {
    title: formData.get("title").trim(),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    category: formData.get("category"),
    days: selectedDays,
    notes: formData.get("notes").trim(),
    priority: formData.get("priority"),
  };

  if (selectedDays.length === 0) {
    showDayError(true);
    return;
  }

  showDayError(false);

  if (!validateRoutine(routineData)) {
    return;
  }

  const conflictingRoutine = findScheduleConflict(
    routineData,
    editingRoutineId,
  );

  if (conflictingRoutine) {
    const shouldContinue = confirm(
      `"${routineData.title}" overlaps with ` +
        `"${conflictingRoutine.title}" from ` +
        `${formatTime(conflictingRoutine.startTime)} to ` +
        `${formatTime(conflictingRoutine.endTime)}. ` +
        `Add it anyway?`,
    );

    if (!shouldContinue) {
      return;
    }
  }

  if (editingRoutineId) {
    routines = routines.map((routine) =>
      routine.id === editingRoutineId
        ? {
            ...routine,
            ...routineData,
          }
        : routine,
    );

    editingRoutineId = null;

    routineForm.querySelector('button[type="submit"]').textContent =
      "Create activity";
  } else {
    routines.push(createRoutine(formData, selectedDays));
  }

  saveRoutines();

  /*
   * Reset also hides the Cancel button and collapses
   * the form on mobile.
   */
  resetRoutineForm();

  renderRoutines();
});

/* ------------------------------
   Edit routine
------------------------------ */

function editRoutine(id) {
  const routine = routines.find((item) => item.id === id);

  if (!routine) {
    return;
  }

  document.getElementById("title").value = routine.title;

  document.getElementById("startTime").value = routine.startTime;

  document.getElementById("endTime").value = routine.endTime;

  document.getElementById("category").value = routine.category;

  /* Load saved notes and priority into the edit form */
  document.getElementById("notes").value = routine.notes || "";

  document.getElementById("priority").value = routine.priority || "Medium";

  setSelectedDays(getRoutineDays(routine));
  showDayError(false);

  editingRoutineId = id;

  /* Open the mobile bottom sheet or scroll to the desktop form */
  openRoutineForm({
    focusTitle: false,
  });

  submitButton.textContent = "Save changes";
  if (routineFormHeading) {
    routineFormHeading.textContent = "Edit activity";
  }
  cancelEditButton.classList.remove("d-none");

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

/* ------------------------------
   Delete routine
------------------------------ */

function deleteRoutine(id) {
  const routine = routines.find((item) => item.id === id);

  if (!routine) {
    return;
  }

  const shouldDelete = confirm(`Delete "${routine.title}" from your routine?`);

  if (!shouldDelete) {
    return;
  }

  routines = routines.filter((routineItem) => routineItem.id !== id);

  // Retain completion history and schedule snapshots after deletion.
  if (editingRoutineId === id) {
    resetRoutineForm();
  }

  saveRoutines();
  renderRoutines();
}

/* ------------------------------
   Theme
------------------------------ */

function updateThemeButton(darkModeEnabled) {
  if (themeButtonText) {
    themeButtonText.textContent = darkModeEnabled ? "Light mode" : "Dark mode";
  }

  if (themeIcon) {
    themeIcon.className = darkModeEnabled ? "bi bi-sun" : "bi bi-moon-stars";
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem("theme");
  const darkModeEnabled = savedTheme === "dark";

  document.body.classList.toggle("dark-mode", darkModeEnabled);
  updateThemeButton(darkModeEnabled);
}

themeToggle.addEventListener("click", function () {
  document.body.classList.toggle("dark-mode");

  const darkModeEnabled = document.body.classList.contains("dark-mode");

  localStorage.setItem("theme", darkModeEnabled ? "dark" : "light");

  updateThemeButton(darkModeEnabled);
});

/* ==================================================
   SEARCH AND FILTER EVENTS

   Each event redraws the routine list immediately.
================================================== */

// Search while the user types
searchInput.addEventListener("input", renderRoutines);

// Filter when a different day is selected
dayFilter.addEventListener("change", renderRoutines);

// Filter when a different category is selected
categoryFilter.addEventListener("change", renderRoutines);

// Restore the default filters
function clearRoutineFilters() {
  searchInput.value = "";
  dayFilter.value = "Today";
  categoryFilter.value = "All";

  renderRoutines();
}

clearFiltersButton.addEventListener("click", clearRoutineFilters);

/* ==================================================
   MOBILE BOTTOM NAVIGATION

   Scroll to the selected section and visually mark
   the most recently selected navigation item.
================================================== */

/* ------------------------------
   HTML safety
------------------------------ */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ------------------------------
   Old-data migration
------------------------------ */

function migrateOldCompletionData() {
  const completedRoutineIds = routines
    .filter((routine) => routine.completed === true)
    .map((routine) => routine.id);

  if (completedRoutineIds.length === 0) {
    return;
  }

  const todayKey = getTodayKey();
  const existingIds = completionHistory[todayKey] || [];

  completionHistory[todayKey] = [
    ...new Set([...existingIds, ...completedRoutineIds]),
  ];

  routines = routines.map(({ completed, ...routine }) => routine);

  saveRoutines();
  saveCompletionHistory();
}

function migrateOldDayFormat() {
  let changed = false;

  routines = routines.map((routine) => {
    if (!Array.isArray(routine.days) && typeof routine.day === "string") {
      changed = true;

      const { day, ...remainingRoutine } = routine;

      return {
        ...remainingRoutine,
        days: [day],
      };
    }

    return routine;
  });

  if (changed) {
    saveRoutines();
  }
}

/* ==================================================
   ADD DEFAULT DETAILS TO OLD ROUTINES

   Routines created before notes and priority existed
   are updated with safe default values.
================================================== */

function migrateRoutineDetails() {
  let dataChanged = false;

  routines = routines.map((routine) => {
    const updatedRoutine = { ...routine };

    if (typeof updatedRoutine.notes !== "string") {
      updatedRoutine.notes = "";
      dataChanged = true;
    }

    if (!["Low", "Medium", "High"].includes(updatedRoutine.priority)) {
      updatedRoutine.priority = "Medium";
      dataChanged = true;
    }

    return updatedRoutine;
  });

  if (dataChanged) {
    saveRoutines();
  }
}

/* ------------------------------
   Export backup
------------------------------ */

function exportBackup() {
  const backupData = {
    app: "Daily Routine App",
    version: 3,
    progressData,
    exportedAt: new Date().toISOString(),
    routines,
    completionHistory,
    theme: localStorage.getItem("theme") || "light",
  };

  const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: "application/json",
  });

  const backupUrl = URL.createObjectURL(backupBlob);

  const downloadLink = document.createElement("a");

  downloadLink.href = backupUrl;

  downloadLink.download = `daily-routine-backup-${getTodayKey()}.json`;

  document.body.appendChild(downloadLink);

  downloadLink.click();
  downloadLink.remove();

  URL.revokeObjectURL(backupUrl);
}

/* ------------------------------
   Import backup
------------------------------ */

function isValidBackup(data) {
  if (
    !data ||
    !Array.isArray(data.routines) ||
    typeof data.completionHistory !== "object" ||
    data.completionHistory === null
  ) {
    return false;
  }

  if (
    Array.isArray(data.completionHistory) ||
    !Object.entries(data.completionHistory).every(
      ([date, ids]) =>
        ProgressCore.validDate(date) &&
        Array.isArray(ids) &&
        ids.every((id) => typeof id === "string"),
    )
  )
    return false;
  if (
    data.progressData !== undefined &&
    !ProgressCore.validState(data.progressData)
  )
    return false;
  if (new Set(data.routines.map((r) => r.id)).size !== data.routines.length)
    return false;
  return data.routines.every((routine) => {
    const hasValidDays =
      Array.isArray(routine.days) || typeof routine.day === "string";

    return (
      typeof routine.id === "string" &&
      !["__proto__", "constructor", "prototype"].includes(routine.id) &&
      typeof routine.title === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(routine.startTime) &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(routine.endTime) &&
      typeof routine.category === "string" &&
      hasValidDays &&
      (Array.isArray(routine.days) ? routine.days : [routine.day]).every(
        (day) =>
          [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ].includes(day),
      )
    );
  });
}

function importBackup(file) {
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    try {
      const backupData = JSON.parse(reader.result);

      if (!isValidBackup(backupData)) {
        alert("This backup file is not valid.");
        return;
      }

      const shouldImport = confirm(
        "Importing will replace your current routines and completion history. Continue?",
      );

      if (!shouldImport) {
        return;
      }

      routines = backupData.routines;
      completionHistory = backupData.completionHistory;
      progressData =
        backupData.progressData ||
        ProgressCore.create(routines, completionHistory, getTodayKey());
      persistProgress();

      migrateOldDayFormat();
      /* Add default notes and priority to older backups */
      migrateRoutineDetails();

      saveRoutines();
      saveCompletionHistory();

      if (backupData.theme === "dark") {
        localStorage.setItem("theme", "dark");
        document.body.classList.add("dark-mode");
        updateThemeButton(true);
      } else {
        localStorage.setItem("theme", "light");
        document.body.classList.remove("dark-mode");
        updateThemeButton(false);
      }

      renderRoutines();

      alert("Backup imported successfully.");
    } catch (error) {
      console.error("Backup import failed:", error);

      alert("The selected file could not be imported.");
    } finally {
      importFile.value = "";
    }
  });

  reader.readAsText(file);
}

exportButton.addEventListener("click", exportBackup);

importButton.addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", () => {
  const selectedFile = importFile.files[0];

  if (!selectedFile) {
    return;
  }

  importBackup(selectedFile);
});

/* ==================================================
   SERVICE WORKER AND APP UPDATES

   When a new service worker is ready, the app displays
   an update banner. Selecting "Update now" activates
   the new worker and reloads the application.

   Routines remain safe because they are stored in
   localStorage, which is not cleared during updating.
================================================== */

let refreshingAfterUpdate = false;
let waitingServiceWorker = null;

/*
 * Display the update banner and remember which
 * service worker is waiting to become active.
 */
function showUpdateBanner(worker) {
  if (!updateBanner || !worker) {
    return;
  }

  waitingServiceWorker = worker;
  updateBanner.classList.remove("d-none");
}

/*
 * Hide the banner when the user selects "Later".
 */
function hideUpdateBanner() {
  if (!updateBanner) {
    return;
  }

  updateBanner.classList.add("d-none");
}

/*
 * Tell the waiting service worker to activate.
 */
if (updateNowButton) {
  updateNowButton.addEventListener("click", () => {
    if (!waitingServiceWorker) {
      return;
    }

    updateNowButton.disabled = true;
    updateNowButton.textContent = "Updating...";

    waitingServiceWorker.postMessage({
      type: "SKIP_WAITING",
    });
  });
}

/*
 * The update remains available even when the banner
 * is temporarily dismissed.
 */
if (dismissUpdateButton) {
  dismissUpdateButton.addEventListener("click", hideUpdateBanner);
}

if ("serviceWorker" in navigator) {
  /*
   * Reload once when the newly activated worker takes
   * control of the page.
   */
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingAfterUpdate) {
      return;
    }

    refreshingAfterUpdate = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "./service-worker.js",
      );

      console.log("Service worker registered.");

      /*
       * A new worker may already be waiting when the
       * user opens the app.
       */
      if (registration.waiting) {
        showUpdateBanner(registration.waiting);
      }

      /*
       * Watch for newly downloaded service workers.
       */
      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;

        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener("statechange", () => {
          const updateIsReady =
            installingWorker.state === "installed" &&
            navigator.serviceWorker.controller;

          if (updateIsReady) {
            showUpdateBanner(installingWorker);
          }
        });
      });

      /*
       * Check for updates whenever the user returns
       * to the app after using another application.
       */
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registration.update().catch((error) => {
            console.error("Update check failed:", error);
          });
        }
      });

      /*
       * Check once per hour while the app remains open.
       */
      window.setInterval(
        () => {
          registration.update().catch((error) => {
            console.error("Update check failed:", error);
          });
        },
        60 * 60 * 1000,
      );
    } catch (error) {
      console.error("Service worker registration failed:", error);
    }
  });
}

/* ------------------------------
   Start application
------------------------------ */

displayTodayDate();
migrateOldDayFormat();
migrateOldCompletionData();
migrateRoutineDetails();
try {
  const savedProgress = JSON.parse(localStorage.getItem("routineProgress"));
  progressData = ProgressCore.validState(savedProgress)
    ? savedProgress
    : ProgressCore.create(routines, completionHistory, getTodayKey());
} catch (_) {
  progressData = ProgressCore.create(
    routines,
    completionHistory,
    getTodayKey(),
  );
}
ProgressCore.sync(progressData, routines, getTodayKey());
persistProgress();
selectTodayByDefault();
loadTheme();
renderRoutines();
