'use strict';

// ── Constants ────────────────────────────────────────────────────
const ROSCO_SIZE       = 600;   // logical px (matches --rosco-size in CSS)
const ROSCO_RADIUS     = 228;   // px from center to bubble center
const BUBBLE_SIZE      = 44;    // px diameter (matches --bubble-size in CSS)
const TIMER_START      = 150;   // seconds
const URGENT_THRESHOLD = 30;    // seconds at which tick sound + red timer kick in

// ── State ────────────────────────────────────────────────────────
let state = {};

function resetState() {
  state = {
    phase:         'start',   // 'start' | 'playing' | 'win' | 'loss'
    currentIndex:  0,
    timeRemaining: TIMER_START,
    timerInterval: null,
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

function soundTick() {
  playTone({ frequency: 1100, type: 'square', duration: 0.045, gain: 0.12 });
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
  const container   = $('rosco-container');
  const hud         = $('hud');
  const dashboard   = $('dashboard');
  const hudHeight   = hud.offsetHeight || 64;
  const dashHeight  = dashboard.offsetHeight || 130;
  const available   = Math.min(
    window.innerWidth - 32,
    window.innerHeight - hudHeight - dashHeight - 24
  );
  const scale = Math.min(1, available / ROSCO_SIZE);

  container.style.transform       = `scale(${scale})`;
  container.style.transformOrigin = 'top center';
  // Collapse the empty layout space that transform: scale leaves behind
  container.style.marginBottom    = `-${ROSCO_SIZE * (1 - scale)}px`;

  const scaledWidth = `${ROSCO_SIZE * scale}px`;
  hud.style.width       = scaledWidth;
  dashboard.style.width = scaledWidth;
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
  startWebcam();

  // Reset HUD
  $('count-correct').textContent = '0';
  $('count-wrong').textContent   = '0';
  $('timer-value').textContent   = TIMER_START;
  $('timer-display').classList.remove('urgent');

  // Reset dashboard
  clearFeedback();
  $('answer-input').value = '';
  $('btn-submit').disabled = false;
  $('btn-pass').disabled   = false;

  // Highlight first letter
  state.currentIndex = 0;
  setActiveLetter(0);

  // Focus input
  $('answer-input').focus();

  // Start timer
  state.timerInterval = setInterval(tickTimer, 1000);
}

function setActiveLetter(index) {
  // Remove active from previous
  document.querySelectorAll('.bubble.active').forEach(b => b.classList.remove('active'));

  // Activate new bubble
  const bubble = getBubble(index);
  if (bubble) bubble.classList.add('active');

  // Update dashboard
  const word = WORD_BANK[index];
  $('current-letter-label').textContent = word.letter;
  $('clue-text').textContent            = word.clue;

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

function normalizeAnswer(str) {
  return str
    .trim()
    .toUpperCase()
    .replace(/Ñ/g, '\x00')              // protect Ñ before NFD decomposition
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')    // strip other diacritics
    .replace(/\x00/g, 'Ñ')             // restore Ñ
    .replace(/[^A-ZÑ]/g, '');          // strip non-alpha (keeping Ñ)
}

function submitAnswer() {
  if (state.phase !== 'playing') return;

  const input    = $('answer-input');
  const raw      = input.value;
  const userAns  = normalizeAnswer(raw);
  const word     = WORD_BANK[state.currentIndex];
  const correct  = normalizeAnswer(word.answer);

  // Prevent blank submissions
  if (userAns === '') return;

  input.value = '';
  input.focus();

  // Briefly disable buttons to prevent spam
  $('btn-submit').disabled = true;
  setTimeout(() => {
    if (state.phase === 'playing') $('btn-submit').disabled = false;
  }, 350);

  const bubble = getBubble(state.currentIndex);

  if (userAns === correct) {
    // Correct
    word.status = 1;
    bubble.dataset.state = '1';
    bubble.classList.remove('active', 'wrong', 'flash-wrong');
    bubble.classList.add('correct');
    void bubble.offsetWidth; // reflow to restart animation
    bubble.classList.add('flash-correct');
    bubble.addEventListener('animationend', () => bubble.classList.remove('flash-correct'), { once: true });

    state.correctCount++;
    $('count-correct').textContent = state.correctCount;
    soundCorrect();
    showFeedback('¡Correcto!', 'correct', 1400);
  } else {
    // Wrong
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
    showFeedback(`Incorrecto — era: ${word.answer}`, 'wrong', 2200);
  }

  // Deactivate current bubble (color already set by data-state)
  bubble.classList.remove('active');

  // Check end conditions before advancing
  if (checkEndConditions()) return;

  // Advance to next pending letter
  const next = findNextPending(state.currentIndex);
  if (next === null) {
    // No pending left — all answered
    checkEndConditions();
    return;
  }
  setActiveLetter(next);
}

function passWord() {
  if (state.phase !== 'playing') return;

  const next = findNextPending(state.currentIndex);

  // Only one (or zero) pending letters remain — must answer or fail
  if (next === null || next === state.currentIndex) {
    showFeedback('¡Última letra! Debes responder o fallar.', 'wrong', 1800);
    return;
  }

  $('answer-input').value = '';
  $('answer-input').focus();
  clearFeedback();
  setActiveLetter(next);
}

function tickTimer() {
  if (state.phase !== 'playing') return;

  state.timeRemaining--;
  $('timer-value').textContent = state.timeRemaining;

  if (state.timeRemaining <= URGENT_THRESHOLD) {
    $('timer-display').classList.add('urgent');
    soundTick();
  }

  if (state.timeRemaining <= 0) {
    triggerLoss('timeout');
  }
}

function checkEndConditions() {
  if (state.correctCount === WORD_BANK.length) {
    triggerWin();
    return true;
  }

  // Check if any letters are still pending
  const pending = WORD_BANK.filter(e => e.status === 0).length;
  if (pending === 0 && state.correctCount < WORD_BANK.length) {
    triggerLoss('all_answered');
    return true;
  }

  return false;
}

function triggerWin() {
  state.phase = 'win';
  clearInterval(state.timerInterval);
  stopWebcam();
  soundWin();

  const timeLeft = state.timeRemaining;

  $('end-icon').textContent   = '🏆';
  $('end-title').textContent  = '¡Has ganado!';
  $('end-title').className    = 'win';
  $('end-summary').textContent =
    `¡Impresionante! Las 26 palabras correctas con ${timeLeft} segundo${timeLeft !== 1 ? 's' : ''} de sobra.`;

  persistResult();
  renderEndStats();
  setTimeout(() => showScreen('end'), 600);
}

function triggerLoss(reason) {
  state.phase = 'loss';
  clearInterval(state.timerInterval);
  stopWebcam();

  // Disable input
  $('answer-input').disabled   = true;
  $('btn-submit').disabled     = true;
  $('btn-pass').disabled       = true;

  soundGameOver();

  const pending = WORD_BANK.filter(e => e.status === 0).length;

  let summary;
  if (reason === 'timeout') {
    summary = `¡Se acabó el tiempo! Respondiste ${WORD_BANK.length - pending} de 26 palabras.`;
  } else {
    summary = `Respondiste las 26 palabras, pero solo acertaste ${state.correctCount}.`;
  }

  $('end-icon').textContent   = '💀';
  $('end-title').textContent  = 'Fin del juego';
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
      <span class="stat-label">Aciertos</span>
    </div>
    <div class="stat-block">
      <span class="stat-number wrong">${state.wrongCount}</span>
      <span class="stat-label">Errores</span>
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
    && best.score    === state.correctCount
    && best.timeLeft === state.timeRemaining
    && best.date     === data.history[data.history.length - 1]?.date;

  const personalHTML = best ? `
    <div id="end-personal">
      <span class="personal-name">Jugando como: <strong>${name}</strong></span>
      <span class="personal-best ${esRecord ? 'new-record' : ''}">
        ${esRecord
          ? '🏅 ¡Nuevo récord personal! ' + best.score + ' aciertos'
          : 'Mejor marca personal: ' + best.score + ' aciertos'}
      </span>
    </div>
  ` : '';

  $('end-stats').innerHTML = statsHTML + personalHTML;
}

// ── Feedback helpers ─────────────────────────────────────────────
let feedbackTimer = null;

function showFeedback(message, type, duration) {
  const el = $('feedback');
  clearTimeout(feedbackTimer);
  el.textContent = message;
  el.className   = type;

  feedbackTimer = setTimeout(() => {
    el.classList.add('hidden');
    setTimeout(() => { el.textContent = ''; el.className = ''; }, 300);
  }, duration);
}

function clearFeedback() {
  clearTimeout(feedbackTimer);
  const el = $('feedback');
  el.textContent = '';
  el.className   = '';
}

// ── Storage ──────────────────────────────────────────────────────
const STORAGE_KEYS = {
  playerName: 'ptw_player_name',
  scores:     'ptw_scores',
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
    const esMejor = !b
      || entry.score > b.score
      || (entry.score === b.score && entry.timeLeft > b.timeLeft);

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
    timeLeft: state.timeRemaining,
    outcome:  state.phase,          // 'win' | 'loss'
    score:    state.correctCount,   // campo canónico para tabla de líderes
    date:     new Date().toISOString(),
  });
}

// ── Webcam ────────────────────────────────────────────────────────
let webcamStream = null;

async function startWebcam() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    const video = $('webcam');
    video.srcObject = webcamStream;
    video.classList.add('active');
  } catch {
    // Permiso denegado o sin cámara — se ignora silenciosamente
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

// ── Event wiring ─────────────────────────────────────────────────
function bootstrap() {
  resetState();

  // Pre-rellenar nombre si ya existe en storage
  const savedName = loadPlayerName();
  if (savedName) $('input-player-name').value = savedName;

  $('btn-start').addEventListener('click', initGame);

  $('btn-submit').addEventListener('click', submitAnswer);

  $('btn-pass').addEventListener('click', passWord);

  $('btn-restart').addEventListener('click', () => {
    // Re-enable input in case it was disabled from a loss
    $('answer-input').disabled = false;
    stopWebcam();
    showScreen('start');
  });

  document.addEventListener('keydown', e => {
    if (state.phase !== 'playing') return;

    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    }

    if (e.key === ' ' || e.code === 'Space') {
      // Only trigger pass if the input is empty (prevent accidental passes while typing)
      if ($('answer-input').value.trim() === '') {
        e.preventDefault();
        passWord();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (state.phase === 'playing') resizeRosco();
  });
}

document.addEventListener('DOMContentLoaded', bootstrap);
