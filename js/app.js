const routineForm = document.getElementById("routineForm");
const routineList = document.getElementById("routineList");
const dayFilter = document.getElementById("dayFilter");
const todayDate = document.getElementById("todayDate");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const themeToggle = document.getElementById("themeToggle");

let routines = JSON.parse(localStorage.getItem("routines")) || [];
let editingRoutineId = null;

function saveRoutines() {
  localStorage.setItem("routines", JSON.stringify(routines));
}

function getTodayName() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long"
  });
}

function displayTodayDate() {
  todayDate.textContent = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatTime(time) {
  if (!time) return "";

  const [hour, minute] = time.split(":");
  const date = new Date();

  date.setHours(Number(hour));
  date.setMinutes(Number(minute));

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getSelectedDay() {
  return dayFilter.value === "Today"
    ? getTodayName()
    : dayFilter.value;
}

function getFilteredRoutines() {
  const selectedDay = getSelectedDay();

  if (selectedDay === "All") {
    return [...routines].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
  }

  return routines
    .filter((routine) => routine.day === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function renderRoutines() {
  const filteredRoutines = getFilteredRoutines();

  if (filteredRoutines.length === 0) {
    routineList.innerHTML =
      '<p class="empty-state">No routines found for this day.</p>';
    updateProgress([]);
    return;
  }

  routineList.innerHTML = filteredRoutines
    .map(
      (routine) => `
        <article class="routine-item ${routine.completed ? "completed" : ""}">
          <input
            class="complete-checkbox"
            type="checkbox"
            aria-label="Mark ${routine.title} complete"
            ${routine.completed ? "checked" : ""}
            onchange="toggleRoutine('${routine.id}')"
          />

          <div>
            <p class="routine-title">${escapeHtml(routine.title)}</p>

            <p class="routine-meta">
              ${formatTime(routine.startTime)} to ${formatTime(routine.endTime)}
              · ${routine.day}
            </p>

            <span class="routine-category">
              ${escapeHtml(routine.category)}
            </span>
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
      `
    )
    .join("");

  updateProgress(filteredRoutines);
}

function updateProgress(selectedRoutines) {
  const total = selectedRoutines.length;
  const completed = selectedRoutines.filter(
    (routine) => routine.completed
  ).length;

  const percentage =
    total === 0 ? 0 : Math.round((completed / total) * 100);

  progressText.textContent = `${completed} of ${total} completed`;
  progressPercent.textContent = `${percentage}%`;
}

function createRoutine(formData) {
  return {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()),
    title: formData.get("title").trim(),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    category: formData.get("category"),
    day: formData.get("day"),
    completed: false
  };
}

function validateRoutine(routine) {
  if (!routine.title) {
    alert("Please enter an activity name.");
    return false;
  }

  if (routine.endTime <= routine.startTime) {
    alert("End time must be later than start time.");
    return false;
  }

  return true;
}

routineForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const formData = new FormData(routineForm);

  const routineData = {
    title: formData.get("title").trim(),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    category: formData.get("category"),
    day: formData.get("day")
  };

  if (!validateRoutine(routineData)) {
    return;
  }

  if (editingRoutineId) {
    routines = routines.map((routine) =>
      routine.id === editingRoutineId
        ? {
            ...routine,
            ...routineData
          }
        : routine
    );

    editingRoutineId = null;
    routineForm.querySelector('button[type="submit"]').textContent =
      "Add routine";
  } else {
    routines.push(createRoutine(formData));
  }

  saveRoutines();
  routineForm.reset();
  setDefaultDay();
  renderRoutines();
});

function toggleRoutine(id) {
  routines = routines.map((routine) =>
    routine.id === id
      ? {
          ...routine,
          completed: !routine.completed
        }
      : routine
  );

  saveRoutines();
  renderRoutines();
}

function editRoutine(id) {
  const routine = routines.find((item) => item.id === id);

  if (!routine) return;

  document.getElementById("title").value = routine.title;
  document.getElementById("startTime").value = routine.startTime;
  document.getElementById("endTime").value = routine.endTime;
  document.getElementById("category").value = routine.category;
  document.getElementById("day").value = routine.day;

  editingRoutineId = id;

  routineForm.querySelector('button[type="submit"]').textContent =
    "Update routine";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function deleteRoutine(id) {
  const routine = routines.find((item) => item.id === id);

  if (!routine) return;

  const shouldDelete = confirm(
    `Delete "${routine.title}" from your routine?`
  );

  if (!shouldDelete) return;

  routines = routines.filter((routine) => routine.id !== id);

  if (editingRoutineId === id) {
    editingRoutineId = null;
    routineForm.reset();
    setDefaultDay();
    routineForm.querySelector('button[type="submit"]').textContent =
      "Add routine";
  }

  saveRoutines();
  renderRoutines();
}

function setDefaultDay() {
  document.getElementById("day").value = getTodayName();
}

function loadTheme() {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.textContent = "Light mode";
  }
}

themeToggle.addEventListener("click", function () {
  document.body.classList.toggle("dark-mode");

  const darkModeEnabled =
    document.body.classList.contains("dark-mode");

  localStorage.setItem(
    "theme",
    darkModeEnabled ? "dark" : "light"
  );

  themeToggle.textContent = darkModeEnabled
    ? "Light mode"
    : "Dark mode";
});

dayFilter.addEventListener("change", renderRoutines);

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

displayTodayDate();
setDefaultDay();
loadTheme();
renderRoutines();