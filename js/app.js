const routineForm = document.getElementById("routineForm");
const routineList = document.getElementById("routineList");
const dayFilter = document.getElementById("dayFilter");
const todayDate = document.getElementById("todayDate");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const themeToggle = document.getElementById("themeToggle");
const exportButton = document.getElementById("exportButton");
const importButton = document.getElementById("importButton");
const importFile = document.getElementById("importFile");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
/* Search and filter controls from index.html */
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const clearFiltersButton = document.getElementById("clearFiltersButton");
let routines = JSON.parse(localStorage.getItem("routines")) || [];

let completionHistory =
  JSON.parse(localStorage.getItem("completionHistory")) || {};

let editingRoutineId = null;

/* ------------------------------
   Local storage
------------------------------ */

function saveRoutines() {
  localStorage.setItem("routines", JSON.stringify(routines));
}

function saveCompletionHistory() {
  localStorage.setItem("completionHistory", JSON.stringify(completionHistory));
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

  saveCompletionHistory();
  renderRoutines();
}

function resetRoutineForm() {
  editingRoutineId = null;

  routineForm.reset();
  clearSelectedDays();
  selectTodayByDefault();
  showDayError(false);

  submitButton.textContent = "Add routine";
  cancelEditButton.classList.add("d-none");
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

  if (filteredRoutines.length === 0) {
    routineList.innerHTML =
      '<p class="empty-state">No routines match the selected filters.</p>';
    updateProgress([]);
    return;
  }

  routineList.innerHTML = filteredRoutines
    .map((routine) => {
      const routineDays = getRoutineDays(routine);
      const completed = isRoutineCompleted(routine.id);

      /* Older routines may not contain these new properties */
      const routineNotes = routine.notes || "";
      const routinePriority = routine.priority || "Medium";

      return `
        <article class="routine-item ${completed ? "completed" : ""}">
          <input
            class="complete-checkbox"
            type="checkbox"
            aria-label="Mark ${escapeHtml(routine.title)} complete"
            ${completed ? "checked" : ""}
            onchange="toggleRoutine('${routine.id}')"
          />

          <div>
            <p class="routine-title">
              ${escapeHtml(routine.title)}
            </p>

            <p class="routine-meta">
              ${formatTime(routine.startTime)}
              to
              ${formatTime(routine.endTime)}
              ·
              ${routineDays.join(", ")}
            </p>

            <span class="routine-category">
              ${escapeHtml(routine.category)}
            </span>

            <span
             class="priority-badge ${getPriorityClass(routinePriority)}"
              >
              ${escapeHtml(routinePriority)} priority
            </span>

              ${
                routineNotes
                  ? `
                    <p class="routine-notes">
                      ${escapeHtml(routineNotes)}
                    </p>
                  `
                  : ""
              }
          </div>

          <div class="routine-actions">
            <button
              class="action-button"
              type="button"
              onclick="editRoutine('${routine.id}')"
            >
              Edit
            </button>

            <button
              class="action-button delete-button"
              type="button"
              onclick="deleteRoutine('${routine.id}')"
            >
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  updateProgress(filteredRoutines);
}

function updateProgress(selectedRoutines) {
  const total = selectedRoutines.length;

  const completed = selectedRoutines.filter((routine) =>
    isRoutineCompleted(routine.id),
  ).length;

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  progressText.textContent = `${completed} of ${total} completed`;

  progressPercent.textContent = `${percentage}%`;
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
      "Add routine";
  } else {
    routines.push(createRoutine(formData, selectedDays));
  }

  saveRoutines();

  routineForm.reset();
  clearSelectedDays();
  selectTodayByDefault();
  showDayError(false);

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

  submitButton.textContent = "Update routine";
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

  Object.keys(completionHistory).forEach((date) => {
    completionHistory[date] = completionHistory[date].filter(
      (routineId) => routineId !== id,
    );

    if (completionHistory[date].length === 0) {
      delete completionHistory[date];
    }
  });

  saveCompletionHistory();

  if (editingRoutineId === id) {
    resetRoutineForm();
  }

  saveRoutines();
  renderRoutines();
}

/* ------------------------------
   Theme
------------------------------ */

function loadTheme() {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark-mode");
    themeToggle.textContent = "Dark mode";
  }
}

themeToggle.addEventListener("click", function () {
  document.body.classList.toggle("dark-mode");

  const darkModeEnabled = document.body.classList.contains("dark-mode");

  localStorage.setItem("theme", darkModeEnabled ? "dark" : "light");

  themeToggle.textContent = darkModeEnabled ? "Light mode" : "Dark mode";
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
clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  dayFilter.value = "Today";
  categoryFilter.value = "All";

  renderRoutines();
});

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
    version: 2,
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

  return data.routines.every((routine) => {
    const hasValidDays =
      Array.isArray(routine.days) || typeof routine.day === "string";

    return (
      typeof routine.id === "string" &&
      typeof routine.title === "string" &&
      typeof routine.startTime === "string" &&
      typeof routine.endTime === "string" &&
      typeof routine.category === "string" &&
      hasValidDays
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

      migrateOldDayFormat();
      /* Add default notes and priority to older backups */
      migrateRoutineDetails();

      saveRoutines();
      saveCompletionHistory();

      if (backupData.theme === "dark") {
        localStorage.setItem("theme", "dark");
        document.body.classList.add("dark-mode");
        themeToggle.textContent = "Light mode";
      } else {
        localStorage.setItem("theme", "light");
        document.body.classList.remove("dark-mode");
        themeToggle.textContent = "Dark mode";
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

/* ------------------------------
   Service worker
------------------------------ */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => {
        console.log("Service worker registered.");
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}

/* ------------------------------
   Start application
------------------------------ */

displayTodayDate();
migrateOldDayFormat();
migrateOldCompletionData();
migrateRoutineDetails();
selectTodayByDefault();
loadTheme();
renderRoutines();
