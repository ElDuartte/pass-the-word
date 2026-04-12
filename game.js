'use strict';

// ── Constants ────────────────────────────────────────────────────
const ROSCO_SIZE       = 1050;  // logical px (matches --rosco-size in CSS)
const ROSCO_RADIUS     = 397.5; // px from center to bubble center (scales with rosco)
const BUBBLE_SIZE      = 87;    // px diameter (matches --bubble-size in CSS)

// ── State ────────────────────────────────────────────────────────
let state = {};

function resetState() {
  state = {
    phase:         'start',   // 'start' | 'playing' | 'win' | 'loss'
    currentIndex:  0,
    correctCount:  0,
    wrongCount:    0,
  };
}

// ── Audio (Web Audio API — no external files) ────────────────────
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume in case browser suspended it
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone({ frequency, type = 'sine', duration = 0.2, gain = 0.28,
                    fadeIn = 0.01, fadeOut = 0.06, delay = 0 }) {
  try {
    const ctx      = getAudioContext();
    const osc      = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);

    gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
    gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + fadeIn);
    gainNode.gain.linearRampToValueAtTime(0,    ctx.currentTime + delay + duration - fadeOut);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime  + delay + duration);
  } catch (e) {
    // Audio not critical — fail silently
  }
}

function soundCorrect() {
  playTone({ frequency: 523.25, duration: 0.14, gain: 0.25 });                              // C5
  playTone({ frequency: 659.25, duration: 0.28, gain: 0.28, delay: 0.10 });                 // E5
}

function soundWrong() {
  playTone({ frequency: 220, type: 'sawtooth', duration: 0.25, gain: 0.22 });               // A3
  playTone({ frequency: 185, type: 'sawtooth', duration: 0.18, gain: 0.18, delay: 0.18 }); // lower
}

function soundGameOver() {
  [440, 370, 277].forEach((freq, i) => {
    playTone({ frequency: freq, duration: 0.55, gain: 0.3, fadeOut: 0.35, delay: i * 0.42 });
  });
}

function soundWin() {
  [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
    playTone({ frequency: freq, duration: 0.28, gain: 0.28, delay: i * 0.11 });
  });
  // Bonus high note
  playTone({ frequency: 659.25, duration: 0.5, gain: 0.3, delay: 4 * 0.11 });
}

// ── DOM helpers ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(`screen-${name}`).classList.add('active');
}

// ── Rosco builder ────────────────────────────────────────────────
function buildRosco() {
  const rosco = $('rosco');
  rosco.innerHTML = '';

  const cx = ROSCO_SIZE / 2;
  const cy = ROSCO_SIZE / 2;

  WORD_BANK.forEach((entry, i) => {
    // Start at the top (-90°), go clockwise
    const angleDeg = (i / WORD_BANK.length) * 360 - 90;
    const angleRad = angleDeg * (Math.PI / 180);

    const left = cx + ROSCO_RADIUS * Math.cos(angleRad) - BUBBLE_SIZE / 2;
    const top  = cy + ROSCO_RADIUS * Math.sin(angleRad) - BUBBLE_SIZE / 2;

    const div = document.createElement('div');
    // Base class only — status class added by submitAnswer() during play
    div.className          = 'bubble';
    div.textContent        = entry.letter;
    div.dataset.index      = i;
    div.dataset.state      = entry.status; // 0=pending, 1=correct, 2=wrong
    div.style.left         = `${left}px`;
    div.style.top          = `${top}px`;
    div.style.width        = `${BUBBLE_SIZE}px`;
    div.style.height       = `${BUBBLE_SIZE}px`;

    rosco.appendChild(div);
  });
}

function getBubble(index) {
  return $('rosco').querySelector(`.bubble[data-index="${index}"]`);
}

// ── Responsive scaling ───────────────────────────────────────────
function resizeRosco() {
  const container  = $('rosco-container');
  const hud        = $('hud');
  const playerBar  = $('player-bar');
  const keyHint    = $('key-hint');
  const hudHeight  = hud.offsetHeight || 64;
  const barHeight  = playerBar.offsetHeight || 28;
  const hintHeight = keyHint.offsetHeight || 32;
  const vv         = window.visualViewport;
  const vh         = vv ? vv.height : window.innerHeight;
  const vw         = vv ? vv.width : window.innerWidth;
  /* .screen padding 16×2, #screen-game padding-top, extra slack — no page scroll */
  const verticalChrome = 32 + 6 + 28;
  const horizontalChrome = 32;
  const available  = Math.min(
    vw - horizontalChrome,
    vh - hudHeight - barHeight - hintHeight - verticalChrome
  );
  const scale = Math.min(1, Math.max(0.05, available / ROSCO_SIZE));

  container.style.transform       = `scale(${scale})`;
  container.style.transformOrigin = 'top center';
  container.style.marginBottom    = `-${ROSCO_SIZE * (1 - scale)}px`;

  const scaledWidth = `${ROSCO_SIZE * scale}px`;
  hud.style.width        = scaledWidth;
  playerBar.style.width  = scaledWidth;
  keyHint.style.width    = scaledWidth;
}

// ── Webcam ───────────────────────────────────────────────────────
let webcamStream = null;

async function startWebcam() {
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const video = $('webcam');
    video.srcObject = webcamStream;
    video.classList.add('active');
  } catch {
    // Permission denied or no camera — play without it
  }
}

function stopWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
  }
  const video = $('webcam');
  video.srcObject = null;
  video.classList.remove('active');
}

// ── Game flow ────────────────────────────────────────────────────

function initGame() {
  // Reset word statuses
  WORD_BANK.forEach(e => { e.status = 0; });
  resetState();
  state.phase = 'playing';

  // Build the ring
  buildRosco();

  // Show game screen
  showScreen('game');
  resizeRosco();

  // Reset HUD
  $('count-correct').textContent = '0';
  $('count-wrong').textContent   = '0';

  // Player bar
  const name = loadPlayerName() || 'Anónimo';
  $('player-bar-name').textContent = name;
  updatePlayerRank();

  // Highlight first letter
  state.currentIndex = 0;
  setActiveLetter(0);

  // Start webcam
  startWebcam();
}

function setActiveLetter(index) {
  document.querySelectorAll('.bubble.active').forEach(b => b.classList.remove('active'));
  const bubble = getBubble(index);
  if (bubble) bubble.classList.add('active');
  state.currentIndex = index;
}

function findNextPending(fromIndex) {
  const len = WORD_BANK.length;
  for (let i = 1; i <= len; i++) {
    const idx = (fromIndex + i) % len;
    if (WORD_BANK[idx].status === 0) return idx;
  }
  return null; // All answered
}

function markLetter(isCorrect) {
  if (state.phase !== 'playing') return;

  const word   = WORD_BANK[state.currentIndex];
  const bubble = getBubble(state.currentIndex);

  if (isCorrect) {
    word.status = 1;
    bubble.dataset.state = '1';
    bubble.classList.remove('active', 'wrong', 'flash-wrong');
    bubble.classList.add('correct');
    void bubble.offsetWidth;
    bubble.classList.add('flash-correct');
    bubble.addEventListener('animationend', () => bubble.classList.remove('flash-correct'), { once: true });
    state.correctCount++;
    $('count-correct').textContent = state.correctCount;
    soundCorrect();
  } else {
    word.status = 2;
    bubble.dataset.state = '2';
    bubble.classList.remove('active', 'correct', 'flash-correct');
    bubble.classList.add('wrong');
    void bubble.offsetWidth;
    bubble.classList.add('flash-wrong');
    bubble.addEventListener('animationend', () => bubble.classList.remove('flash-wrong'), { once: true });
    state.wrongCount++;
    $('count-wrong').textContent = state.wrongCount;
    soundWrong();
  }

  bubble.classList.remove('active');
  updatePlayerRank();

  if (checkEndConditions()) return;

  const next = findNextPending(state.currentIndex);
  if (next === null) { checkEndConditions(); return; }
  setActiveLetter(next);
}

function checkEndConditions() {
  if (state.correctCount === WORD_BANK.length) {
    triggerWin();
    return true;
  }

  // Check if any letters are still pending
  const pending = WORD_BANK.filter(e => e.status === 0).length;
  if (pending === 0 && state.correctCount < WORD_BANK.length) {
    triggerLoss();
    return true;
  }

  return false;
}

function triggerWin() {
  state.phase = 'win';
  stopWebcam();
  soundWin();

  $('end-icon').textContent   = '🏆';
  $('end-title').textContent  = '¡Has ganado!';
  $('end-title').className    = 'win';
  $('end-summary').textContent = '¡Impresionante! Las 26 palabras correctas.';

  persistResult();
  renderEndStats();
  setTimeout(() => showScreen('end'), 600);
}

function triggerLoss() {
  state.phase = 'loss';
  stopWebcam();
  soundGameOver();

  const summary = `Respondiste las 26 palabras, pero solo acertaste ${state.correctCount}.`;

  $('end-icon').textContent   = '👍';
  $('end-title').textContent  = 'Bien hecho';
  $('end-title').className    = 'loss';
  $('end-summary').textContent = summary;

  persistResult();
  renderEndStats();
  setTimeout(() => showScreen('end'), 1200);
}

function renderEndStats() {
  const pending = WORD_BANK.filter(e => e.status === 0).length;

  // Estadísticas de la partida actual
  const statsHTML = `
    <div class="stat-block">
      <span class="stat-number correct">${state.correctCount}</span>
      <span class="stat-label">Bien</span>
    </div>
    <div class="stat-block">
      <span class="stat-number wrong">${state.wrongCount}</span>
      <span class="stat-label">Mal</span>
    </div>
    <div class="stat-block">
      <span class="stat-number pending">${pending}</span>
      <span class="stat-label">Pasadas</span>
    </div>
  `;

  // Datos personales guardados (persistResult() ya fue llamado antes)
  const name   = loadPlayerName() || 'Anónimo';
  const data   = loadScores();
  const best   = data ? data.best : null;

  // ¿Esta partida es el nuevo récord?
  const esRecord = best
    && best.score === state.correctCount
    && best.date === data.history[data.history.length - 1]?.date;

  const personalHTML = best ? `
    <div id="end-personal">
      <span class="personal-name">Jugando como: <strong>${name}</strong></span>
      <span class="personal-best ${esRecord ? 'new-record' : ''}">
        ${esRecord
          ? '🏅 ¡Nuevo récord personal! ' + best.score + ' bien'
          : 'Mejor marca personal: ' + best.score + ' bien'}
      </span>
    </div>
  ` : '';

  $('end-stats').innerHTML = statsHTML + personalHTML;

  // Leaderboard (uses the date of the entry just saved)
  const currentDate = data?.history[data.history.length - 1]?.date ?? null;
  renderLeaderboard('end-leaderboard', currentDate);
}

function renderLeaderboard(elId, currentDate) {
  const data = loadScores();
  const el   = $(elId);

  if (!data || !data.history.length) { el.innerHTML = ''; return; }

  const sorted = [...data.history]
    .sort((a, b) => b.score - a.score || new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const rows = sorted.map((entry, i) => {
    const isCurrent = entry.date === currentDate;
    const pos   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const fecha = new Date(entry.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    const outcomeClass = entry.outcome === 'win' ? 'lb-outcome-win' : 'lb-outcome-loss';
    const outcomeIcon  = entry.outcome === 'win' ? '✓' : '✗';
    return `<tr class="${isCurrent ? 'lb-current' : ''}">
        <td class="lb-pos">${pos}</td>
        <td>${entry.name || 'Anónimo'}</td>
        <td>${entry.score}</td>
        <td class="${outcomeClass}">${outcomeIcon}</td>
        <td>${fecha}</td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <p class="lb-title">Tabla de puntuaciones</p>
    <table class="lb-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Nombre</th>
          <th>✓</th>
          <th>Res.</th>
          <th>Fecha</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Pause ─────────────────────────────────────────────────────────
function pauseGame() {
  if (state.phase !== 'playing') return;
  state.phase = 'paused';
  renderLeaderboard('pause-leaderboard', null);
  $('pause-overlay').classList.add('active');
}

function resumeGame() {
  if (state.phase !== 'paused') return;
  state.phase = 'playing';
  $('pause-overlay').classList.remove('active');
}

// ── Rank helpers ──────────────────────────────────────────────────
function computeCurrentRank() {
  const data = loadScores();
  if (!data || !data.history.length) return null;
  const better = data.history.filter(e => e.score > state.correctCount).length;
  return better + 1;
}

function updatePlayerRank() {
  const rank = computeCurrentRank();
  $('player-bar-rank').textContent = rank !== null ? `#${rank}` : '';
}

// ── Storage ──────────────────────────────────────────────────────
const STORAGE_KEYS = {
  playerName: 'ptw_player_name',
  scores:     'ptw_scores',
  theme:      'ptw_theme',
};

function loadPlayerName() {
  try { return localStorage.getItem(STORAGE_KEYS.playerName) || ''; }
  catch { return ''; }
}

function savePlayerName(name) {
  try { localStorage.setItem(STORAGE_KEYS.playerName, name); }
  catch { /* cuota excedida o modo privado — no es crítico */ }
}

function loadScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.scores);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveScore(entry) {
  try {
    const data = loadScores() || { best: null, history: [] };

    // Determina si esta entrada es mejor que el récord actual
    const b = data.best;
    const esMejor = !b || entry.score > b.score;

    if (esMejor) data.best = entry;
    data.history.push(entry);

    localStorage.setItem(STORAGE_KEYS.scores, JSON.stringify(data));
  } catch { /* silencioso */ }
}

function persistResult() {
  const name = ($('input-player-name').value.trim()) || 'Anónimo';
  savePlayerName(name);

  const pending = WORD_BANK.filter(e => e.status === 0).length;
  saveScore({
    name,
    correct:  state.correctCount,
    wrong:    state.wrongCount,
    skipped:  pending,
    outcome:  state.phase,          // 'win' | 'loss'
    score:    state.correctCount,   // campo canónico para tabla de líderes
    date:     new Date().toISOString(),
  });
}

// ── Theme ───────────────────────────────────────────────────────
function applyTheme(theme) {
  const dark = theme === 'dark';
  const root = document.documentElement;
  if (dark) root.dataset.theme = 'dark';
  else root.removeAttribute('data-theme');

  const toggle = $('theme-toggle');
  if (toggle) toggle.setAttribute('aria-checked', dark ? 'true' : 'false');

  try {
    localStorage.setItem(STORAGE_KEYS.theme, dark ? 'dark' : 'light');
  } catch { /* silencioso */ }
}

function loadTheme() {
  try {
    const s = localStorage.getItem(STORAGE_KEYS.theme);
    if (s === 'light' || s === 'dark') return s;
  } catch { /* ignore */ }
  return 'light';
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

// ── Event wiring ─────────────────────────────────────────────────
function bootstrap() {
  resetState();

  applyTheme(loadTheme());

  // Pre-rellenar nombre si ya existe en storage
  const savedName = loadPlayerName();
  if (savedName) $('input-player-name').value = savedName;

  $('btn-start').addEventListener('click', initGame);

  $('btn-pause').addEventListener('click', pauseGame);

  $('btn-resume').addEventListener('click', resumeGame);

  $('theme-toggle').addEventListener('click', () => toggleTheme());

  $('btn-restart').addEventListener('click', () => showScreen('start'));

  $('btn-mark-correct').addEventListener('click', () => markLetter(true));
  $('btn-mark-wrong').addEventListener('click', () => markLetter(false));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.phase === 'paused') resumeGame();
      else if (state.phase === 'playing') pauseGame();
      return;
    }

    if (state.phase !== 'playing') return;

    if (e.key === 's' || e.key === 'S') { e.preventDefault(); markLetter(true);  }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); markLetter(false); }
  });

  const onViewportResize = () => {
    if (state.phase === 'playing' || state.phase === 'paused') resizeRosco();
  };
  window.addEventListener('resize', onViewportResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
