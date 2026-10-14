const LOCKIN_BG_KEY = "lockinBackground";

function createBackgroundBlobs() {
  if (document.querySelector(".bg-blobs")) {
    return;
  }
  const container = document.createElement("div");
  container.className = "bg-blobs";
  container.setAttribute("aria-hidden", "true");

  for (let i = 1; i <= 4; i += 1) {
    const blob = document.createElement("span");
    blob.className = "blob blob-" + i;
    container.appendChild(blob);
  }

  document.body.insertBefore(container, document.body.firstChild);
}

function applyOverlay(mode, strength) {
  const overlay = document.getElementById("photoOverlay");
  const alpha = strength / 100;

  if (mode === "dark") {
    overlay.style.backgroundColor = "rgba(12, 14, 20, " + alpha + ")";
  } else if (mode === "light") {
    overlay.style.backgroundColor = "rgba(248, 248, 244, " + alpha + ")";
  } else {
    overlay.style.backgroundColor = "transparent";
  }
}

function applySavedBackground() {
  const raw = localStorage.getItem(LOCKIN_BG_KEY);

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (error) {
    return;
  }
  if (!saved) {
    return;
  }

  if (saved.theme) {
    document.body.setAttribute("data-theme", saved.theme);
  }

  if (saved.type === "photo" && saved.photo) {
    document.body.style.backgroundImage = 'url("' + saved.photo + '")';
    document.body.classList.add("has-photo");
  } else {
    document.body.classList.remove("has-photo");
  }

  const mode = saved.overlayMode || "none";
  const strength = saved.overlayStrength || 0;
  applyOverlay(mode, strength);
}

createBackgroundBlobs();
applySavedBackground();