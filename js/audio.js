const LOCKIN_AMBIENT_KEY = "lockinAmbient";
const LOCKIN_AMBIENT_VOLUME_KEY = "lockinAmbientVolume";
const AMBIENT_TYPES = ["rain", "noise", "wind", "ocean", "piano", "lofi"];

let ambientContext = null;
let ambientSource = null;
let ambientGain = null;
let ambientType = null;
let ambientPlaying = false;
let ambientLfos = [];
let pianoIntervalId = null;
let lofiIntervalId = null;
let lofiStep = 0;
let lofiNoiseBuffer = null;

function loadAmbientChoice() {
  try {
    const choice = localStorage.getItem(LOCKIN_AMBIENT_KEY);
    if (AMBIENT_TYPES.includes(choice)) {
      return choice;
    }
  } catch (error) {}
  return "off";
}

function saveAmbientChoice(choice) {
  localStorage.setItem(LOCKIN_AMBIENT_KEY, choice);
}

function loadAmbientVolume() {
  try {
    const value = Number(localStorage.getItem(LOCKIN_AMBIENT_VOLUME_KEY));
    if (value >= 0 && value <= 100) {
      return value;
    }
  } catch (error) {}
  return 50;
}

function saveAmbientVolume(percent) {
  localStorage.setItem(LOCKIN_AMBIENT_VOLUME_KEY, String(percent));
}

function baseGainFor(type) {
  if (type === "rain") return 0.3;
  if (type === "noise") return 0.6;
  if (type === "wind") return 0.35;
  if (type === "piano") return 0.9;
  if (type === "lofi") return 0.7;
  return 0.45;
}

function setAmbientVolume(percent) {
  const value = Math.max(0, Math.min(100, percent));
  saveAmbientVolume(value);

  if (ambientGain && ambientType) {
    ambientGain.gain.value = baseGainFor(ambientType) * (value / 100);
  }

  const sliders = ["ambientVolume", "audioMenuVolume"];
  sliders.forEach(function (id) {
    const slider = document.getElementById(id);
    if (slider && Number(slider.value) !== value) {
      slider.value = String(value);
    }
  });
}

function ensureAmbientContext() {
  if (!ambientContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    ambientContext = new AudioContextClass();
  }
  if (ambientContext.state === "suspended") {
    ambientContext.resume();
  }
}

function createAmbientBuffer(type) {
  const usesBrown = type === "noise" || type === "ocean";
  const seconds = 2;
  const frameCount = ambientContext.sampleRate * seconds;
  const buffer = ambientContext.createBuffer(1, frameCount, ambientContext.sampleRate);
  const data = buffer.getChannelData(0);

  if (usesBrown) {
    let last = 0;
    for (let i = 0; i < frameCount; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return buffer;
}

function addLfo(rate, depth, targetParam) {
  const lfo = ambientContext.createOscillator();
  const lfoGain = ambientContext.createGain();
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain);
  lfoGain.connect(targetParam);
  lfo.start();
  ambientLfos.push(lfo);
}

function stopAmbientAudio() {
  if (pianoIntervalId !== null) {
    clearInterval(pianoIntervalId);
    pianoIntervalId = null;
  }

  if (lofiIntervalId !== null) {
    clearInterval(lofiIntervalId);
    lofiIntervalId = null;
  }
  lofiStep = 0;

  ambientLfos.forEach(function (lfo) {
    try {
      lfo.stop();
    } catch (error) {}
    lfo.disconnect();
  });
  ambientLfos = [];

  if (ambientSource) {
    try {
      ambientSource.stop();
    } catch (error) {}
    ambientSource.disconnect();
    ambientSource = null;
  }
  if (ambientGain) {
    ambientGain.disconnect();
    ambientGain = null;
  }
  ambientType = null;
  ambientPlaying = false;
}

const PIANO_NOTES = [
  261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25,
];

function playPianoNote() {
  const now = ambientContext.currentTime;
  const frequency = PIANO_NOTES[Math.floor(Math.random() * PIANO_NOTES.length)];
  const peak = 0.18 + Math.random() * 0.1;

  const osc = ambientContext.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = frequency;

  const shimmer = ambientContext.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.value = frequency * 2;

  const noteGain = ambientContext.createGain();
  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

  const shimmerGain = ambientContext.createGain();
  shimmerGain.gain.value = 0.25;

  osc.connect(noteGain);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(noteGain);
  noteGain.connect(ambientGain);

  osc.start(now);
  shimmer.start(now);
  osc.stop(now + 2);
  shimmer.stop(now + 2);
}

function startPiano() {
  ambientGain = ambientContext.createGain();
  ambientGain.gain.value = baseGainFor("piano") * (loadAmbientVolume() / 100);
  ambientGain.connect(ambientContext.destination);

  playPianoNote();
  pianoIntervalId = setInterval(playPianoNote, 1100);
}

const LOFI_STEP_MS = 187.5;
const LOFI_CHORDS = [
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [130.81, 164.81, 196.0, 246.94],
  [196.0, 246.94, 293.66, 349.23],
];

function lofiNoise() {
  if (!lofiNoiseBuffer) {
    const frameCount = Math.floor(ambientContext.sampleRate * 0.5);
    lofiNoiseBuffer = ambientContext.createBuffer(1, frameCount, ambientContext.sampleRate);
    const data = lofiNoiseBuffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return lofiNoiseBuffer;
}

function playLofiKick(time) {
  const osc = ambientContext.createOscillator();
  const gain = ambientContext.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.7, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  osc.connect(gain);
  gain.connect(ambientGain);
  osc.start(time);
  osc.stop(time + 0.35);
}

function playLofiSnare(time) {
  const src = ambientContext.createBufferSource();
  src.buffer = lofiNoise();
  const filter = ambientContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.7;
  const gain = ambientContext.createGain();
  gain.gain.setValueAtTime(0.32, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ambientGain);
  src.start(time);
  src.stop(time + 0.2);
}

function playLofiHat(time) {
  const src = ambientContext.createBufferSource();
  src.buffer = lofiNoise();
  const filter = ambientContext.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7000;
  const gain = ambientContext.createGain();
  const peak = 0.06 + Math.random() * 0.03;
  gain.gain.setValueAtTime(peak, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ambientGain);
  src.start(time);
  src.stop(time + 0.06);
}

function playLofiChord(frequencies, time) {
  const hold = (LOFI_STEP_MS / 1000) * 15;
  const filter = ambientContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1400;

  const gain = ambientContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.11, time + 0.6);
  gain.gain.setValueAtTime(0.11, time + hold - 1.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + hold);

  filter.connect(gain);
  gain.connect(ambientGain);

  frequencies.forEach(function (frequency) {
    const osc = ambientContext.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    osc.detune.value = (Math.random() - 0.5) * 8;
    osc.connect(filter);
    osc.start(time);
    osc.stop(time + hold + 0.1);
  });
}

function startLofiCrackle() {
  const src = ambientContext.createBufferSource();
  src.buffer = lofiNoise();
  src.loop = true;
  const filter = ambientContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 3500;
  filter.Q.value = 0.4;
  const gain = ambientContext.createGain();
  gain.gain.value = 0.05;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ambientGain);
  src.start();
  ambientSource = src;
}

function lofiTick() {
  const now = ambientContext.currentTime;
  const stepInBar = lofiStep % 16;
  const bar = Math.floor(lofiStep / 16);

  if (stepInBar === 0) {
    playLofiChord(LOFI_CHORDS[bar % LOFI_CHORDS.length], now);
  }
  if (stepInBar === 0 || stepInBar === 8) {
    playLofiKick(now);
  }
  if (stepInBar === 4 || stepInBar === 12) {
    playLofiSnare(now);
  }
  if (stepInBar % 2 === 0) {
    playLofiHat(now);
  }

  lofiStep += 1;
}

function startLofi() {
  ambientGain = ambientContext.createGain();
  ambientGain.gain.value = baseGainFor("lofi") * (loadAmbientVolume() / 100);
  ambientGain.connect(ambientContext.destination);

  startLofiCrackle();

  lofiStep = 0;
  lofiTick();
  lofiIntervalId = setInterval(lofiTick, LOFI_STEP_MS);
}

function startAmbientAudio(type) {
  ensureAmbientContext();
  stopAmbientAudio();

  if (type === "piano") {
    startPiano();
    ambientType = type;
    ambientPlaying = true;
    return;
  }

  if (type === "lofi") {
    startLofi();
    ambientType = type;
    ambientPlaying = true;
    return;
  }

  const buffer = createAmbientBuffer(type);
  const source = ambientContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ambientContext.createBiquadFilter();
  if (type === "rain") {
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    filter.Q.value = 0.6;
  } else {
    filter.type = "lowpass";
    filter.frequency.value = 500;
  }
  if (type === "wind") {
    filter.frequency.value = 600;
  }

  ambientGain = ambientContext.createGain();
  ambientGain.gain.value = baseGainFor(type) * (loadAmbientVolume() / 100);

  source.connect(filter);
  filter.connect(ambientGain);
  ambientGain.connect(ambientContext.destination);
  source.start();

  if (type === "wind") {
    addLfo(0.08, 200, filter.frequency);
  }
  if (type === "ocean") {
    addLfo(0.07, 0.15, ambientGain.gain);
  }

  ambientSource = source;
  ambientType = type;
  ambientPlaying = true;
}

let audioMenuBtn = null;
let audioMenuPanel = null;

function isAudioMenuOpen() {
  return audioMenuBtn !== null && audioMenuBtn.getAttribute("aria-expanded") === "true";
}

function setAudioMenuOpen(open) {
  if (!audioMenuBtn || !audioMenuPanel) {
    return;
  }
  audioMenuBtn.setAttribute("aria-expanded", String(open));
  audioMenuPanel.hidden = !open;
}

function setAudioOptionButtons(choice) {
  document.querySelectorAll(".audio-option").forEach(function (button) {
    button.classList.toggle("is-active", button.dataset.ambient === choice);
  });
}

function updateAudioButtonState(choice) {
  if (audioMenuBtn) {
    audioMenuBtn.classList.toggle("is-playing", choice !== "off");
  }
}

function initAudioMenu() {
  audioMenuBtn = document.getElementById("audioMenuBtn");
  audioMenuPanel = document.getElementById("audioMenuPanel");

  if (!audioMenuBtn || !audioMenuPanel) {
    audioMenuBtn = null;
    audioMenuPanel = null;
    return;
  }

  audioMenuBtn.addEventListener("click", function (event) {
    event.stopPropagation();
    setAudioMenuOpen(!isAudioMenuOpen());
  });

  document.querySelectorAll(".audio-option").forEach(function (button) {
    button.addEventListener("click", function () {
      const choice = button.dataset.ambient;
      saveAmbientChoice(choice);
      setAudioOptionButtons(choice);
      updateAudioButtonState(choice);

      if (choice === "off") {
        stopAmbientAudio();
      } else {
        startAmbientAudio(choice);
      }

      setAudioMenuOpen(false);
    });
  });

  document.addEventListener("click", function (event) {
    if (isAudioMenuOpen() && !event.target.closest(".audio-menu")) {
      setAudioMenuOpen(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isAudioMenuOpen()) {
      event.stopImmediatePropagation();
      setAudioMenuOpen(false);
    }
  });

  let touchStartY = null;
  audioMenuPanel.addEventListener("touchstart", function (event) {
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  audioMenuPanel.addEventListener("touchend", function (event) {
    if (touchStartY === null) {
      return;
    }
    if (event.changedTouches[0].clientY - touchStartY > 40) {
      setAudioMenuOpen(false);
    }
    touchStartY = null;
  });

  const savedChoice = loadAmbientChoice();
  setAudioOptionButtons(savedChoice);
  updateAudioButtonState(savedChoice);

  const menuVolume = document.getElementById("audioMenuVolume");
  if (menuVolume) {
    menuVolume.value = String(loadAmbientVolume());
    menuVolume.addEventListener("input", function () {
      setAmbientVolume(Number(menuVolume.value));
    });
  }
}

initAudioMenu();