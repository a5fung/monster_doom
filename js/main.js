// ===== main.js — Game state machine, loop, DOM wiring =====

// Game states
const STATE = { MENU: 0, PLAYING: 1, WIN: 2, LOSE: 3 };

let gameState = STATE.MENU;
let currentDifficulty = 'easy';
let currentStage = 1;

let player = null;
let monsters = [];
let doorUnlocked = false;
let keyExists = false;

let prevTime = 0;
let animId = null;

// Notification system
let notifTimer = null;

// ---- DOM references ----
const canvas       = document.getElementById('gameCanvas');
const menuScreen   = document.getElementById('menuScreen');
const winScreen    = document.getElementById('winScreen');
const loseScreen   = document.getElementById('loseScreen');
const hudLayer     = document.getElementById('hudLayer');
const mobileCtls   = document.getElementById('mobileControls');
const diffBtns     = document.querySelectorAll('.diff-btn');
const diffDesc     = document.getElementById('diffDesc');
const startBtn     = document.getElementById('startBtn');
const retryBtn     = document.getElementById('retryBtn');
const menuFromWin  = document.getElementById('menuFromWin');
const menuFromLose = document.getElementById('menuFromLose');
const notifEl      = document.getElementById('notification');

// ---- Difficulty descriptions ----
const DIFF_DESCS = {
  easy:    '3 monsters \u2014 150 HP \u2014 Relaxed',
  hard:    '6 monsters \u2014 100 HP \u2014 Challenging',
  extreme: '10 monsters \u2014 75 HP \u2014 Brutal'
};

// ---- Init renderer ----
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
rendererInit(canvas);

// ---- Notification helper ----
function showNotification(text, durationMs) {
  if (!notifEl) return;
  notifEl.textContent = text;
  notifEl.classList.add('show');
  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => notifEl.classList.remove('show'), durationMs);
}

// ---- Screen helpers ----
function showScreen(id) {
  ['menuScreen','winScreen','loseScreen'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.remove('visible');
  });
  const el = document.getElementById(id);
  if (el) el.classList.add('visible');
}

function hideAllScreens() {
  ['menuScreen','winScreen','loseScreen'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.remove('visible');
  });
}

// ---- Difficulty buttons ----
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDifficulty = btn.dataset.diff;
    if (diffDesc) diffDesc.textContent = DIFF_DESCS[currentDifficulty];
  });
});

// ---- Start game ----
function startGame() {
  // Re-init map (restore any modified cells)
  mapInit();

  // Create player
  player = new Player(currentDifficulty);

  // Create monsters
  const diff = DIFFICULTIES[currentDifficulty];
  const count = diff.monsters;
  monsters = [];
  for (let i = 0; i < count && i < SPAWNS_STAGE1.length; i++) {
    const sp = SPAWNS_STAGE1[i];
    monsters.push(new Monster(sp.col, sp.row, currentDifficulty));
  }

  doorUnlocked = false;
  keyExists = true;

  // Reset controls
  controls.reset();

  // UI state
  hideAllScreens();
  if (hudLayer) hudLayer.classList.add('visible');
  if (mobileCtls) mobileCtls.style.display = ''; // CSS handles show/hide via media query
  const notifEl2 = document.getElementById('notification');
  if (notifEl2) notifEl2.classList.remove('show');

  // Reset HUD key indicator
  const hudKey = document.getElementById('hudKey');
  if (hudKey) hudKey.classList.remove('collected');

  gameState = STATE.PLAYING;

  if (animId) cancelAnimationFrame(animId);
  prevTime = performance.now();
  animId = requestAnimationFrame(gameLoop);
}

// ---- Win / Lose triggers (called from player.js) ----
function triggerWin() {
  if (gameState !== STATE.PLAYING) return;
  gameState = STATE.WIN;
  if (hudLayer) hudLayer.classList.remove('visible');
  showScreen('winScreen');
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (document.exitPointerLock) document.exitPointerLock();
}

function triggerLose() {
  if (gameState !== STATE.PLAYING) return;
  gameState = STATE.LOSE;
  if (hudLayer) hudLayer.classList.remove('visible');
  showScreen('loseScreen');
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (document.exitPointerLock) document.exitPointerLock();
}

// ---- Main game loop ----
function gameLoop(now) {
  if (gameState !== STATE.PLAYING) return;

  const delta = Math.min((now - prevTime) / 1000, 0.1);
  prevTime = now;

  // 1. Flush input accumulators
  controls.flush();

  // 2. Check door unlock
  if (player.hasKey && !doorUnlocked) {
    doorUnlocked = true;
  }

  // 3. Update player
  player.update(delta, controls, doorUnlocked, monsters);
  if (gameState !== STATE.PLAYING) return; // win/lose triggered

  // 4. Update monsters
  for (const m of monsters) {
    m.update(delta, player, doorUnlocked);
  }
  if (gameState !== STATE.PLAYING) return;

  // 5. Player shooting (every frame; internal cooldown gates it)
  if (controls.isShootPressed()) {
    player.shoot(monsters, doorUnlocked);
  }

  // 6. Clear single-shot flags
  controls.clearSingleShot();

  // 7. Build Z-buffer
  buildZBuffer(player, doorUnlocked);

  // 8. Render frame
  renderFrame(player, monsters, doorUnlocked, keyExists && !player.hasKey);

  animId = requestAnimationFrame(gameLoop);
}

// ---- Button wiring ----
if (startBtn) startBtn.addEventListener('click', startGame);
if (retryBtn) retryBtn.addEventListener('click', startGame);
if (menuFromWin) menuFromWin.addEventListener('click', goToMenu);
if (menuFromLose) menuFromLose.addEventListener('click', goToMenu);

function goToMenu() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (document.exitPointerLock) document.exitPointerLock();
  if (hudLayer) hudLayer.classList.remove('visible');
  gameState = STATE.MENU;
  showScreen('menuScreen');

  // Draw static frame on canvas so background isn't black
  if (mainCtx) {
    mainCtx.fillStyle = '#111';
    mainCtx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// ---- Initial state ----
showScreen('menuScreen');
if (diffDesc) diffDesc.textContent = DIFF_DESCS[currentDifficulty];

// Draw initial dark background
{
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
