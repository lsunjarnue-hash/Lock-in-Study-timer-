function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    return el.requestFullscreen();
  }
  if (el.webkitRequestFullscreen) {
    return el.webkitRequestFullscreen();
  }
  return null;
}

function leaveFullscreen() {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  }
  if (document.webkitExitFullscreen) {
    return document.webkitExitFullscreen();
  }
  return null;
}

function initFullscreen() {
  const button = document.getElementById("fullscreenBtn");
  const enterIcon = document.getElementById("fullscreenIconEnter");
  const exitIcon = document.getElementById("fullscreenIconExit");

  if (!button) {
    return;
  }

  function updateState() {
    const active = Boolean(fullscreenElement());
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Exit full screen" : "Enter full screen");
    if (enterIcon) {
      enterIcon.hidden = active;
    }
    if (exitIcon) {
      exitIcon.hidden = !active;
    }
  }

  button.addEventListener("click", function () {
    if (fullscreenElement()) {
      const result = leaveFullscreen();
      if (result && result.catch) {
        result.catch(function () {});
      }
    } else {
      const result = enterFullscreen();
      if (result && result.catch) {
        result.catch(function () {});
      }
    }
  });

  document.addEventListener("fullscreenchange", updateState);
  document.addEventListener("webkitfullscreenchange", updateState);

  updateState();
}

initFullscreen();
