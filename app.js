'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 95; // ~596.9

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  mode: 'countdown',   // 'countdown' | 'stopwatch'
  running: false,
  intervalId: null,

  // countdown
  totalSeconds: 0,
  remainingSeconds: 0,

  // stopwatch
  elapsedMs: 0,
  lapStartMs: 0,
  startTimestamp: 0,  // performance.now() anchor
  laps: [],
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const timeDisplay    = $('timeDisplay');
const ringFill       = $('ringFill');
const lapBadge       = $('lapBadge');
const startBtn       = $('startBtn');
const resetBtn       = $('resetBtn');
const lapBtn         = $('lapBtn');
const countdownInput = $('countdownInput');
const inputHours     = $('inputHours');
const inputMinutes   = $('inputMinutes');
const inputSeconds   = $('inputSeconds');
const finishOverlay  = $('finishOverlay');
const lapsContainer  = $('lapsContainer');
const lapsList       = $('lapsList');

// ── Audio ──────────────────────────────────────────────────────────────────
const ctx = window.AudioContext ? new AudioContext() : null;

function beep(freq = 880, dur = 0.18, type = 'sine') {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.3, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.start(); o.stop(ctx.currentTime + dur);
}

function playFinish() {
  if (!ctx) return;
  [0, 0.18, 0.36].forEach((t, i) =>
    setTimeout(() => beep([660, 784, 1047][i], 0.22, 'triangle'), t * 1000));
}

function playTick() { beep(1200, 0.06, 'square'); }

// ── Helpers ────────────────────────────────────────────────────────────────
function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

function formatSeconds(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function formatMs(ms) {
  const total = Math.floor(ms / 10);
  const cs = total % 100;
  const s  = Math.floor(total / 100) % 60;
  const m  = Math.floor(total / 6000) % 60;
  const h  = Math.floor(total / 360000);
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs)}`;
  return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

function setRing(fraction, cls = '') {
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
  ringFill.style.strokeDashoffset = offset;
  ringFill.className = 'ring-fill' + (cls ? ' ' + cls : '');
}

function setTimeClass(cls) {
  timeDisplay.className = 'time-display' + (cls ? ' ' + cls : '');
}

// ── Countdown logic ────────────────────────────────────────────────────────
function cdTick() {
  state.remainingSeconds--;
  renderCountdown();
  if (state.remainingSeconds <= 0) finishCountdown();
  else if (state.remainingSeconds <= 3) playTick();
}

function renderCountdown() {
  const rem  = state.remainingSeconds;
  const tot  = state.totalSeconds;
  const frac = tot > 0 ? rem / tot : 0;
  timeDisplay.textContent = formatSeconds(rem);

  let ringCls = '', timeCls = '';
  if (frac <= 0.1 || rem <= 5) { ringCls = 'danger'; timeCls = 'danger'; }
  else if (frac <= 0.25)       { ringCls = 'warning'; timeCls = 'warning'; }
  setRing(frac, ringCls);
  setTimeClass(timeCls);
}

function finishCountdown() {
  clearInterval(state.intervalId);
  state.running = false;
  state.remainingSeconds = 0;
  renderCountdown();
  setRing(0, 'done');
  setTimeClass('');
  timeDisplay.textContent = '00:00';
  playFinish();
  finishOverlay.style.display = 'flex';
  startBtn.textContent = '开始';
  startBtn.classList.remove('running');
}

// ── Stopwatch logic ────────────────────────────────────────────────────────
let rafId = null;

function swFrame() {
  const now = performance.now();
  state.elapsedMs = state.elapsedMs + (now - state.startTimestamp);
  state.startTimestamp = now;
  renderStopwatch();
  if (state.running) rafId = requestAnimationFrame(swFrame);
}

function renderStopwatch() {
  timeDisplay.textContent = formatMs(state.elapsedMs);
  setRing(1, ''); // ring stays full for stopwatch
}

function recordLap() {
  const lapMs = state.elapsedMs - state.lapStartMs;
  state.laps.unshift({ total: state.elapsedMs, lap: lapMs });
  state.lapStartMs = state.elapsedMs;
  renderLaps();

  lapBadge.textContent = `第 ${state.laps.length} 圈`;
  lapBadge.classList.add('visible');
}

function renderLaps() {
  if (state.laps.length === 0) {
    lapsContainer.style.display = 'none';
    return;
  }
  lapsContainer.style.display = 'block';

  const times = state.laps.map(l => l.lap);
  const fastest = Math.min(...times);
  const slowest = times.length > 1 ? Math.max(...times) : Infinity;

  lapsList.innerHTML = state.laps.map((l, i) => {
    const num = state.laps.length - i;
    const cls = l.lap === fastest ? 'fastest' : l.lap === slowest ? 'slowest' : '';
    return `<li class="lap-item ${cls}">
      <span class="lap-num">${pad(num)}</span>
      <span>${formatMs(l.lap)}</span>
      <span>${formatMs(l.total)}</span>
    </li>`;
  }).join('');
}

// ── Controls ───────────────────────────────────────────────────────────────
function getInputSeconds() {
  const h = parseInt(inputHours.value)   || 0;
  const m = parseInt(inputMinutes.value) || 0;
  const s = parseInt(inputSeconds.value) || 0;
  return h * 3600 + m * 60 + s;
}

function startStop() {
  if (ctx && ctx.state === 'suspended') ctx.resume();

  if (state.mode === 'countdown') {
    if (!state.running) {
      // start
      if (state.remainingSeconds === 0) {
        const secs = getInputSeconds();
        if (secs === 0) return;
        state.totalSeconds = secs;
        state.remainingSeconds = secs;
      }
      state.running = true;
      startBtn.textContent = '暂停';
      startBtn.classList.add('running');
      countdownInput.style.display = 'none';
      renderCountdown();
      state.intervalId = setInterval(cdTick, 1000);
    } else {
      // pause
      clearInterval(state.intervalId);
      state.running = false;
      startBtn.textContent = '继续';
      startBtn.classList.remove('running');
    }
  } else {
    // stopwatch
    if (!state.running) {
      state.running = true;
      state.startTimestamp = performance.now();
      startBtn.textContent = '暂停';
      startBtn.classList.add('running');
      lapBtn.style.display = 'inline-block';
      rafId = requestAnimationFrame(swFrame);
    } else {
      // pause
      cancelAnimationFrame(rafId);
      const now = performance.now();
      state.elapsedMs += now - state.startTimestamp;
      state.running = false;
      startBtn.textContent = '继续';
      startBtn.classList.remove('running');
      renderStopwatch();
    }
  }
}

function reset() {
  if (state.mode === 'countdown') {
    clearInterval(state.intervalId);
    state.running = false;
    state.remainingSeconds = 0;
    state.totalSeconds = 0;
    timeDisplay.textContent = '00:00';
    setRing(1, '');
    setTimeClass('');
    startBtn.textContent = '开始';
    startBtn.classList.remove('running');
    countdownInput.style.display = 'block';
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  } else {
    cancelAnimationFrame(rafId);
    state.running = false;
    state.elapsedMs = 0;
    state.lapStartMs = 0;
    state.laps = [];
    timeDisplay.textContent = '00:00.00';
    setRing(1, '');
    startBtn.textContent = '开始';
    startBtn.classList.remove('running');
    lapBtn.style.display = 'none';
    lapBadge.classList.remove('visible');
    renderLaps();
  }
}

function switchMode(mode) {
  if (state.mode === mode) return;
  reset();
  state.mode = mode;

  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode));

  if (mode === 'countdown') {
    countdownInput.style.display = 'block';
    lapsContainer.style.display = 'none';
    lapBtn.style.display = 'none';
    lapBadge.classList.remove('visible');
    timeDisplay.textContent = '00:00';
  } else {
    countdownInput.style.display = 'none';
    timeDisplay.textContent = '00:00.00';
    setRing(1, '');
  }
}

// ── Event listeners ────────────────────────────────────────────────────────
startBtn.addEventListener('click', startStop);
resetBtn.addEventListener('click', reset);
lapBtn.addEventListener('click', recordLap);
$('dismissBtn').addEventListener('click', () => {
  finishOverlay.style.display = 'none';
  reset();
  countdownInput.style.display = 'block';
});

document.querySelectorAll('.tab').forEach(btn =>
  btn.addEventListener('click', () => switchMode(btn.dataset.mode)));

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.running) return;
    const secs = parseInt(btn.dataset.seconds);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    inputHours.value   = h;
    inputMinutes.value = m;
    inputSeconds.value = s;
    state.remainingSeconds = 0;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    timeDisplay.textContent = formatSeconds(secs);
    setRing(1, '');
    setTimeClass('');
  });
});

document.querySelectorAll('.spin-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.running) return;
    const target = btn.dataset.target;
    const dir    = btn.dataset.dir;
    const inp    = target === 'hours' ? inputHours : target === 'minutes' ? inputMinutes : inputSeconds;
    const max    = target === 'hours' ? 23 : 59;
    let val = parseInt(inp.value) || 0;
    val = dir === 'up' ? Math.min(max, val + 1) : Math.max(0, val - 1);
    inp.value = val;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  });
});

[inputHours, inputMinutes, inputSeconds].forEach(inp => {
  inp.addEventListener('change', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    if (!state.running && state.remainingSeconds === 0) {
      const secs = getInputSeconds();
      timeDisplay.textContent = formatSeconds(secs);
    }
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
ringFill.style.strokeDasharray = CIRCUMFERENCE;
ringFill.style.strokeDashoffset = 0;
timeDisplay.textContent = '00:00';
