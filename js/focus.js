const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

let focusMinutes = DEFAULT_FOCUS_MINUTES;
let breakMinutes = DEFAULT_BREAK_MINUTES;
let currentMode = "focus";
let remainingSeconds = focusMinutes * 60;
let timerId = null;
let endTimestamp = 0;
let endTimeoutId = null;
let lastShownSecond = null;

const timerDisplay = document.getElementById("timerDisplay");
const focusModeBtn = document.getElementById("focusModeBtn");
const breakModeBtn = document.getElementById("breakModeBtn");
const durationInput = document.getElementById("durationInput");
const applyDurationBtn = document.getElementById("applyDurationBtn");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const statusMessage = document.getElementById("statusMessage");
const quoteText = document.getElementById("quoteText");

const TASKS_KEY = "lockinTasks";
const LOCKIN_ALARM_KEY = "lockinAlarmOn";
const taskInput = document.getElementById("taskInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const clearDoneBtn = document.getElementById("clearDoneBtn");
const taskList = document.getElementById("taskList");
const tasksStatus = document.getElementById("tasksStatus");
const tasksToggleBtn = document.getElementById("tasksToggleBtn");
const taskPanel = document.getElementById("taskPanel");

let tasks = [];

let alarmOn = true;
try {
  if (localStorage.getItem(LOCKIN_ALARM_KEY) === "off") {
    alarmOn = false;
  }
} catch (error) {}

const quotes = [
  "Remember why you started.",
  "It does not matter how slowly you go as long as you do not stop.",
  "The secret of getting ahead is getting started.",
  "Discipline is the bridge between goals and accomplishment.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "Do something today that your future self will thank you for.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Focus on the step in front of you, not the whole staircase.",
  "You do not need more time, you need more focus.",
];

let currentQuoteIndex = -1;

function totalSecondsForMode(mode) {
  const minutes = mode === "focus" ? focusMinutes : breakMinutes;
  return minutes * 60;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  return paddedMinutes + ":" + paddedSeconds;
}

function render() {
  timerDisplay.textContent = formatTime(remainingSeconds);
}

function showRandomQuote() {
  let nextIndex;
  do {
    nextIndex = Math.floor(Math.random() * quotes.length);
  } while (nextIndex === currentQuoteIndex && quotes.length > 1);

  currentQuoteIndex = nextIndex;
  quoteText.textContent = quotes[currentQuoteIndex];
}

function isRunning() {
  return timerId !== null;
}

function enterFocusView() {
  document.body.classList.add("is-focusing");
}

function exitFocusView() {
  document.body.classList.remove("is-focusing");
}

let audioContext = null;

function ensureAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function beep(frequency, duration, volume) {
  if (!alarmOn) {
    return;
  }
  if (!audioContext) {
    return;
  }
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playCountdownTick() {
  beep(880, 0.09, 0.2);
}

function playSessionEndAlarm() {
  beep(660, 0.35, 0.4);
  setTimeout(function () {
    beep(660, 0.35, 0.4);
  }, 420);
  setTimeout(function () {
    beep(880, 0.6, 0.4);
  }, 850);
}

function startTimer() {
  if (isRunning()) {
    return;
  }
  if (remainingSeconds <= 0) {
    return;
  }
  ensureAudio();
  document.body.classList.remove("session-ended");
  clearTitleAlert();

  const ambientChoice = loadAmbientChoice();
  if (ambientChoice !== "off" && !ambientPlaying) {
    startAmbientAudio(ambientChoice);
  }

  requestNotificationPermission();

  statusMessage.textContent =
    currentMode === "focus" ? "Focusing..." : "Break time...";
  endTimestamp = Date.now() + remainingSeconds * 1000;
  lastShownSecond = remainingSeconds;
  timerId = setInterval(tick, 500);
  scheduleEndTimeout();
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  enterFocusView();
}

function secondsRemaining() {
  return Math.max(0, Math.round((endTimestamp - Date.now()) / 1000));
}

function tick() {
  const updated = secondsRemaining();

  if (updated !== lastShownSecond) {
    if (updated > 0 && updated <= 5) {
      playCountdownTick();
    }
    lastShownSecond = updated;
  }

  remainingSeconds = updated;
  render();

  if (remainingSeconds <= 0) {
    finishSession();
  }
}

function scheduleEndTimeout() {
  clearTimeout(endTimeoutId);
  endTimeoutId = setTimeout(function () {
    if (isRunning()) {
      tick();
    }
  }, Math.max(0, endTimestamp - Date.now()));
}

function finishSession() {
  const finishedMode = currentMode;
  const nextMode = finishedMode === "focus" ? "break" : "focus";

  stopTimer();
  setMode(nextMode);
  document.body.classList.add("session-ended");
  playSessionEndAlarm();
  setTitleAlert();
  showSessionNotification(finishedMode);

  statusMessage.textContent =
    finishedMode === "focus"
      ? "Focus complete. Break is ready \u2014 press Start."
      : "Break over. Focus is ready \u2014 press Start.";
}

const PAGE_TITLE = "Focus \u2014 LOCK IN";

function setTitleAlert() {
  document.title = "Session complete \u2014 LOCK IN";
}

function clearTitleAlert() {
  document.title = PAGE_TITLE;
}

function notificationsSupported() {
  return "Notification" in window;
}

function requestNotificationPermission() {
  if (!notificationsSupported()) {
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showSessionNotification(finishedMode) {
  if (!notificationsSupported() || Notification.permission !== "granted") {
    return;
  }
  if (!document.hidden) {
    return;
  }

  const isFocus = finishedMode === "focus";
  const title = isFocus ? "Focus complete" : "Break over";
  const body = isFocus
    ? "Nice work. Your break is ready."
    : "Break's done. Ready to lock in again?";

  try {
    new Notification(title, { body: body, tag: "lockin-session" });
  } catch (error) {}
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  clearTimeout(endTimeoutId);
  endTimeoutId = null;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  exitFocusView();
}

function pauseTimer() {
  if (!isRunning()) {
    return;
  }
  remainingSeconds = secondsRemaining();
  stopTimer();
  render();
  statusMessage.textContent = "Paused";
}

function resetTimer() {
  stopTimer();
  document.body.classList.remove("session-ended");
  remainingSeconds = totalSecondsForMode(currentMode);
  statusMessage.textContent = "";
  render();
}

function setMode(mode) {
  stopTimer();
  currentMode = mode;
  document.body.classList.remove("session-ended");
  remainingSeconds = totalSecondsForMode(mode);
  durationInput.value = mode === "focus" ? focusMinutes : breakMinutes;
  focusModeBtn.classList.toggle("is-active", mode === "focus");
  breakModeBtn.classList.toggle("is-active", mode === "break");
  statusMessage.textContent = "";
  render();
}

function applyDuration() {
  let minutes = parseInt(durationInput.value, 10);

  if (isNaN(minutes) || minutes < 1) {
    minutes = 1;
  }
  if (minutes > 180) {
    minutes = 180;
  }

  if (currentMode === "focus") {
    focusMinutes = minutes;
  } else {
    breakMinutes = minutes;
  }

  durationInput.value = minutes;
  stopTimer();
  document.body.classList.remove("session-ended");
  remainingSeconds = totalSecondsForMode(currentMode);
  statusMessage.textContent = "Duration set to " + minutes + " minutes.";
  render();
}

startBtn.addEventListener("click", startTimer);
pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);
applyDurationBtn.addEventListener("click", applyDuration);

focusModeBtn.addEventListener("click", function () {
  setMode("focus");
});

breakModeBtn.addEventListener("click", function () {
  setMode("break");
});

render();
pauseBtn.disabled = true;
showRandomQuote();

setInterval(showRandomQuote, 3 * 60 * 1000);

function loadTasks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TASKS_KEY));
    if (Array.isArray(parsed)) {
      tasks = parsed;
    }
  } catch (error) {
    tasks = [];
  }
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function addTask() {
  const text = taskInput.value.trim();

  if (text === "") {
    tasksStatus.textContent = "Type a task first.";
    return;
  }

  tasks.push({ id: Date.now(), text: text, done: false });
  taskInput.value = "";
  saveTasks();
  renderTasks();
  taskInput.focus();
}

function toggleTask(taskId) {
  tasks.forEach(function (task) {
    if (task.id === taskId) {
      task.done = !task.done;
    }
  });
  saveTasks();
  renderTasks();
}

function deleteTask(taskId) {
  tasks = tasks.filter(function (task) {
    return task.id !== taskId;
  });
  saveTasks();
  renderTasks();
}

function clearCompletedTasks() {
  tasks = tasks.filter(function (task) {
    return !task.done;
  });
  saveTasks();
  renderTasks();
}

function updateTasksStatus() {
  const remainingCount = tasks.filter(function (task) {
    return !task.done;
  }).length;

  if (tasks.length === 0) {
    tasksStatus.textContent = "No tasks yet. Add your first focus goal.";
  } else {
    tasksStatus.textContent =
      remainingCount + " active task" + (remainingCount === 1 ? "" : "s");
  }
}

function renderTasks() {
  taskList.innerHTML = "";

  tasks.forEach(function (task) {
    const item = document.createElement("li");
    item.className = "task-item" + (task.done ? " is-done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", "Mark task done");
    checkbox.addEventListener("change", function () {
      toggleTask(task.id);
    });

    const label = document.createElement("span");
    label.className = "task-text";
    label.textContent = task.text;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "task-delete";
    deleteButton.textContent = "\u00d7";
    deleteButton.setAttribute("aria-label", "Delete task");
    deleteButton.addEventListener("click", function () {
      deleteTask(task.id);
    });

    item.appendChild(checkbox);
    item.appendChild(label);
    item.appendChild(deleteButton);
    taskList.appendChild(item);
  });

  const hasCompleted = tasks.some(function (task) {
    return task.done;
  });
  clearDoneBtn.hidden = !hasCompleted;

  updateTasksStatus();
}

addTaskBtn.addEventListener("click", addTask);
clearDoneBtn.addEventListener("click", clearCompletedTasks);

taskInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    addTask();
  }
});

loadTasks();
renderTasks();

taskPanel.addEventListener("show.bs.collapse", function () {
  tasksToggleBtn.textContent = "Hide tasks";
});

taskPanel.addEventListener("hide.bs.collapse", function () {
  tasksToggleBtn.textContent = "Tasks";
});

document.addEventListener("visibilitychange", function () {
  if (!document.hidden && isRunning()) {
    tick();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && document.body.classList.contains("is-focusing")) {
    exitFocusView();
  }
});