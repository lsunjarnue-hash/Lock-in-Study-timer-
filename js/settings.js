const themeButtons = document.querySelectorAll(".theme-btn");
const overlayModeButtons = document.querySelectorAll("[data-overlay]");
const photoInput = document.getElementById("photoInput");
const removePhotoBtn = document.getElementById("removePhotoBtn");
const photoPreview = document.getElementById("photoPreview");
const overlayControls = document.getElementById("overlayControls");
const overlayStrengthInput = document.getElementById("overlayStrength");
const backgroundStatus = document.getElementById("backgroundStatus");
const ambientChoiceButtons = document.querySelectorAll(".ambient-controls [data-ambient]");
const ambientStatus = document.getElementById("ambientStatus");
const ambientVolumeInput = document.getElementById("ambientVolume");
const alarmToggleBtn = document.getElementById("alarmToggleBtn");

const LOCKIN_ALARM_KEY = "lockinAlarmOn";

let currentTheme = "sage";
let pictureDataUrl = null;
let overlayMode = "dark";

function setThemeButtons(themeName) {
  themeButtons.forEach(function (button) {
    const isSelected = button.dataset.theme === themeName;
    button.classList.toggle("is-active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function setOverlayMode(mode) {
  overlayMode = mode;
  overlayModeButtons.forEach(function (button) {
    button.classList.toggle("is-active", button.dataset.overlay === mode);
  });
}

function applyOverlayToPage() {
  const overlay = document.getElementById("photoOverlay");
  const alpha = Number(overlayStrengthInput.value) / 100;

  if (overlayMode === "dark") {
    overlay.style.backgroundColor = "rgba(12, 14, 20, " + alpha + ")";
  } else if (overlayMode === "light") {
    overlay.style.backgroundColor = "rgba(248, 248, 244, " + alpha + ")";
  } else {
    overlay.style.backgroundColor = "transparent";
  }
}

function saveBackground() {
  const hasPhoto = pictureDataUrl !== null;
  const saved = {
    type: hasPhoto ? "photo" : "theme",
    theme: currentTheme,
    overlayMode: hasPhoto ? overlayMode : "none",
    overlayStrength: hasPhoto ? Number(overlayStrengthInput.value) : 0,
  };

  if (hasPhoto) {
    saved.photo = pictureDataUrl;
  }

  localStorage.setItem(LOCKIN_BG_KEY, JSON.stringify(saved));
}

function applyThemeColors(themeName) {
  document.body.setAttribute("data-theme", themeName);
  document.body.style.backgroundImage = "";
  document.body.classList.remove("has-photo");
}

function enterPhotoMode(previewUrl) {
  pictureDataUrl = previewUrl;
  document.body.style.backgroundImage = 'url("' + previewUrl + '")';
  document.body.classList.add("has-photo");
  document.body.setAttribute("data-theme", currentTheme);
  photoPreview.src = previewUrl;
  photoPreview.hidden = false;
  removePhotoBtn.hidden = false;
  overlayControls.hidden = false;
  applyOverlayToPage();
  saveBackground();
}

themeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    currentTheme = button.dataset.theme;
    pictureDataUrl = null;
    applyThemeColors(currentTheme);
    setThemeButtons(currentTheme);
    photoPreview.hidden = true;
    removePhotoBtn.hidden = true;
    overlayControls.hidden = true;
    setOverlayMode("none");
    applyOverlayToPage();
    saveBackground();
    backgroundStatus.textContent = "Ambient color applied.";
  });
});

function removePhoto() {
  currentTheme = currentTheme || "sage";
  pictureDataUrl = null;
  applyThemeColors(currentTheme);
  photoPreview.hidden = true;
  removePhotoBtn.hidden = true;
  overlayControls.hidden = true;
  setOverlayMode("none");
  applyOverlayToPage();
  saveBackground();
  backgroundStatus.textContent = "Back to the " + currentTheme + " theme.";
}

removePhotoBtn.addEventListener("click", removePhoto);

function downscaleImage(dataUrl, maxWidth, onDone) {
  const image = new Image();
  image.onload = function () {
    const shouldShrink = image.width > maxWidth;
    const width = shouldShrink ? maxWidth : image.width;
    const scale = width / image.width;
    const height = shouldShrink ? image.height * scale : image.height;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);
    onDone(canvas.toDataURL("image/jpeg", 0.8));
  };
  image.onerror = function () {
    backgroundStatus.textContent = "That image could not be loaded. Try another one.";
  };
  image.src = dataUrl;
}

photoInput.addEventListener("change", function () {
  const file = photoInput.files[0];
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    backgroundStatus.textContent = "That is not an image file.";
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    downscaleImage(reader.result, 1400, function (previewUrl) {
      enterPhotoMode(previewUrl);
      backgroundStatus.textContent = "Photo applied to the background.";
    });
  };
  reader.onerror = function () {
    backgroundStatus.textContent = "The file could not be read.";
  };

  reader.readAsDataURL(file);
  photoInput.value = "";
});

overlayModeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    if (pictureDataUrl === null) {
      return;
    }
    setOverlayMode(button.dataset.overlay);
    applyOverlayToPage();
    saveBackground();
  });
});

overlayStrengthInput.addEventListener("input", function () {
  if (pictureDataUrl === null) {
    return;
  }
  applyOverlayToPage();
  saveBackground();
});

function setAmbientChoiceButtons(choice) {
  ambientChoiceButtons.forEach(function (button) {
    const isActive = button.dataset.ambient === choice;
    button.classList.toggle("is-active", isActive);
  });

  if (typeof setAudioOptionButtons === "function") {
    setAudioOptionButtons(choice);
  }
  if (typeof updateAudioButtonState === "function") {
    updateAudioButtonState(choice);
  }
}

const AMBIENT_LABELS = {
  rain: "rain",
  noise: "brown noise",
  wind: "wind",
  ocean: "ocean",
  piano: "piano",
  lofi: "lo-fi",
};

ambientChoiceButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const choice = button.dataset.ambient;
    saveAmbientChoice(choice);
    setAmbientChoiceButtons(choice);

    if (choice === "off") {
      stopAmbientAudio();
      ambientStatus.textContent = "Ambient sound turned off.";
    } else {
      startAmbientAudio(choice);
      ambientStatus.textContent =
        "Playing " +
        (AMBIENT_LABELS[choice] || choice) +
        " here. You can also start it from the Focus page.";
    }
  });
});

function updateAlarmButton() {
  const on = alarmToggleBtn.getAttribute("aria-pressed") === "true";
  alarmToggleBtn.textContent = "Alarm sound: " + (on ? "On" : "Off");
}

function loadAlarmSetting() {
  try {
    if (localStorage.getItem(LOCKIN_ALARM_KEY) === "off") {
      alarmToggleBtn.setAttribute("aria-pressed", "false");
    }
  } catch (error) {}
}

alarmToggleBtn.addEventListener("click", function () {
  const on = alarmToggleBtn.getAttribute("aria-pressed") === "true";
  const next = !on;
  alarmToggleBtn.setAttribute("aria-pressed", String(next));
  localStorage.setItem(LOCKIN_ALARM_KEY, next ? "on" : "off");
  updateAlarmButton();
});

ambientVolumeInput.addEventListener("input", function () {
  setAmbientVolume(Number(ambientVolumeInput.value));
});

function initFromSaved() {
  const raw = localStorage.getItem(LOCKIN_BG_KEY);

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (error) {
    saved = null;
  }

  if (saved && saved.theme) {
    currentTheme = saved.theme;
    let isKnownTheme = false;
    themeButtons.forEach(function (button) {
      if (button.dataset.theme === saved.theme) {
        isKnownTheme = true;
      }
    });
    if (!isKnownTheme) {
      currentTheme = "sage";
    }
  }
  setThemeButtons(currentTheme);
  document.body.setAttribute("data-theme", currentTheme);

  if (saved && saved.type === "photo" && saved.photo) {
    setOverlayMode(saved.overlayMode || "dark");
    overlayStrengthInput.value = saved.overlayStrength || 25;
    enterPhotoMode(saved.photo);
  }
}

initFromSaved();
setAmbientChoiceButtons(loadAmbientChoice());
ambientVolumeInput.value = String(loadAmbientVolume());
loadAlarmSetting();
updateAlarmButton();