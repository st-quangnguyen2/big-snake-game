import './style.css';
import { Game, comboMultiplier, VIEWS, viewCamera } from './game.js';
import { HeadTracker } from './headTracker.js';
import { Keyboard, headSteer } from './input.js';
import { GameAudio } from './audio.js';
import {
  DURATIONS, DEFAULT_GRASS_SETTINGS, loadSettings, saveSettings, addRecord, topRecords, bestScore, clearRecords,
} from './storage.js';
import { SKINS, HEAD_STYLES } from './models/snakeModel.js';
import { ANIMAL_TYPES } from './models/animals.js';
import { THEMES } from './themes.js';
import { SnakePreview } from './preview.js';
import { GRASS_BLADES } from './models/environment.js';
import { t, tr, getLang, setLang, applyI18n } from './i18n.js';

const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'),
  score: $('hud-score'),
  time: $('hud-time'),
  length: $('hud-length'),
  combo: $('hud-combo'),
  boost: $('hud-boost'),
  boostBox: $('hud-boost-box'),
  warn: $('hud-warn'),
  hint: $('hud-hint'),
  camBox: $('cam-box'),
  camKnob: $('cam-knob'),
  calibKnob: $('calib-knob'),
  calibFace: $('calib-face'),
  calibBoost: $('calib-boost'),
  calibLook: $('calib-look'),
  lock: $('btn-lock'),
  calibAngles: $('calib-angles'),
  calibButton: $('btn-calibrate'),
  countdown: $('countdown'),
  popups: $('popups'),
  catchBar: $('hud-catch'),
  flash: $('flash'),
};
const minimapCtx = $('minimap').getContext('2d');
const camCtx = $('cam-canvas').getContext('2d');
const calibCtx = $('calib-canvas').getContext('2d');

const settings = loadSettings();
if (!SKINS[settings.skin]) settings.skin = 'green';
if (!HEAD_STYLES[settings.head]) settings.head = 'classic';
if (!THEMES[settings.theme]) settings.theme = 'meadow';
settings.grass.blades = Math.min(GRASS_BLADES.max, Math.max(GRASS_BLADES.min, Math.round(settings.grass.blades)));

// Light / dark: the UI switches palette and the arena becomes a night scene.
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const isDark = () => settings.appearance === 'dark' || (settings.appearance === 'auto' && darkQuery.matches);
const worldOptions = () => ({ theme: settings.theme, night: isDark(), grass: { ...settings.grass } });
function applyAppearance() {
  document.documentElement.dataset.theme = isDark() ? 'dark' : 'light';
}
applyAppearance();
const tracker = new HeadTracker();
const keyboard = new Keyboard();
const audio = new GameAudio();
audio.setVolumes({ music: settings.musicVolume, sfx: settings.sfxVolume, muted: settings.muted });

const NO_STEER = { turn: 0, boost: false, look: 0, degrees: 0 };
const viewName = (view) => t(view === 'first' ? 'view.firstLong' : `view.${view}`);
/** Music speeds up when this many seconds are left. */
const HURRY_SECONDS = 20;
let head = NO_STEER;
let screen = 'menu';
let hudVisible = false;
let calibrated = false;
let calibrating = false;
let pauseReason = null;
let faceLostAt = 0;
let faceBackAt = 0;
let countdownTimer = 0;
let hintTimer = 0;
let recordFilter = settings.duration;
/** True while the settings menu is open on top of a paused round. */
let menuFromPause = false;
let activeTab = 'play';
let worldFrame = 0;
let hurry = false;
let lastStartleSound = 0;

const game = new Game($('scene'), {
  onFrame, onEat, onHit, onTick, onEnd, onBoost, onMud, onStartle, onGolden, onBush,
}, worldOptions());
game.view = settings.view;
game.lockedCamera = lockedCamera();
game.snake.setAppearance(settings.skin, settings.head);
const preview = new SnakePreview($('snake-preview'));
preview.setAppearance(settings.skin, settings.head);

// ---------------------------------------------------------------- helpers

function setText(el, value) {
  const text = String(value);
  if (el.textContent !== text) el.textContent = text;
}

function formatTime(seconds) {
  const t = Math.ceil(seconds);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(t('locale'), {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function show(name) {
  screen = name ?? 'play';
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('hidden', el.id !== `screen-${name}`);
  // The snake preview only renders while it is on screen.
  if (screen === 'menu' && activeTab === 'custom') preview.start();
  else preview.stop();
}

function setTab(tab) {
  activeTab = tab;
  for (const b of $('menu-tabs').querySelectorAll('button')) b.classList.toggle('active', b.dataset.tab === tab);
  for (const panel of document.querySelectorAll('.tab-panel')) panel.classList.toggle('hidden', panel.dataset.panel !== tab);
  if (screen === 'menu' && tab === 'custom') preview.start();
  else preview.stop();
}

/** Theme, day/night and grass changes are applied once per frame at most (sliders fire a lot). */
function scheduleWorldUpdate() {
  if (worldFrame) return;
  worldFrame = requestAnimationFrame(() => {
    worldFrame = 0;
    game.setWorldOptions(worldOptions());
  });
}

function setHud(visible) {
  hudVisible = visible;
  ui.hud.classList.toggle('hidden', !visible);
  ui.camBox.classList.toggle('hidden', settings.control !== 'camera');
}

function setKnob(knob, turn) {
  knob.style.left = `${50 + turn * 46}%`;
}

function restartAnimation(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

// ---------------------------------------------------------------- per frame

/** Called by the game every frame; returns the steering input. */
function onFrame(now) {
  const usingCamera = settings.control === 'camera' && tracker.ready;
  if (usingCamera) {
    tracker.update(now);
    head = tracker.facePresent ? headSteer(tracker.angles, settings) : NO_STEER;
    if (screen === 'calibrate') updateCalibration();
    else if (hudVisible) {
      drawFace(camCtx);
      setKnob(ui.camKnob, head.turn);
    }
  }
  watchFace(now);
  updateHud();

  let turn = keyboard.turn;
  let boost = keyboard.boost;
  let look = keyboard.look;
  if (usingCamera) {
    if (!turn) turn = head.turn;
    boost = boost || head.boost;
    look = Math.max(look, head.look);
  }
  return { turn, boost, look };
}

/** Mirrored webcam image with a sprinkle of face landmarks. */
function drawFace(ctx) {
  const { width: w, height: h } = ctx.canvas;
  const video = tracker.video;
  if (!video.videoWidth) return;
  const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
  const dw = video.videoWidth * scale;
  const dh = video.videoHeight * scale;
  const ox = (w - dw) / 2;
  const oy = (h - dh) / 2;
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, ox, oy, dw, dh);
  ctx.restore();
  const marks = tracker.landmarks;
  if (!marks) return;
  ctx.fillStyle = 'rgba(140, 255, 150, 0.85)';
  const r = w > 300 ? 2.2 : 1.4;
  for (let i = 0; i < marks.length; i += 3) {
    const p = marks[i];
    ctx.fillRect(w - (ox + p.x * dw) - r / 2, oy + p.y * dh - r / 2, r, r);
  }
}

function updateCalibration() {
  drawFace(calibCtx);
  const face = tracker.facePresent;
  setText(ui.calibFace, t(face ? 'calib.found' : 'calib.searching'));
  ui.calibFace.classList.toggle('ok', face);
  setKnob(ui.calibKnob, head.turn);
  ui.calibBoost.classList.toggle('on', head.boost);
  ui.calibLook.classList.toggle('on', head.look > 0.5 && !settings.viewLocked);
  ui.calibLook.classList.toggle('off', settings.viewLocked);
  const a = tracker.angles;
  setText(ui.calibAngles, face ? t('calib.angles', { yaw: Math.round(a.yaw), pitch: Math.round(a.pitch), roll: Math.round(a.roll) }) : '');
  ui.calibButton.disabled = !face || calibrating;
}

/** Warns when the face leaves the frame and pauses after 1.5 s; resumes when it is back. */
function watchFace(now) {
  if (settings.control !== 'camera' || !tracker.ready) {
    ui.warn.classList.add('hidden');
    return;
  }
  if (game.mode === 'playing') {
    if (tracker.facePresent) {
      faceLostAt = 0;
      ui.warn.classList.add('hidden');
    } else {
      faceLostAt ||= now;
      ui.warn.classList.remove('hidden');
      if (now - faceLostAt > 1500) pauseGame('face');
    }
  } else if (game.mode === 'paused' && pauseReason === 'face') {
    if (!tracker.facePresent) faceBackAt = 0;
    else {
      faceBackAt ||= now;
      if (now - faceBackAt > 700) resumeGame();
    }
  }
}

function updateHud() {
  if (!hudVisible) return;
  const s = game.stats;
  setText(ui.score, s.score);
  setText(ui.time, formatTime(s.timeLeft));
  ui.time.classList.toggle('warn', game.mode === 'playing' && s.timeLeft <= 10);
  setText(ui.length, Math.floor(game.snake.length));
  setText(ui.combo, s.combo > 1 ? `🔥 COMBO ×${comboMultiplier(s.combo)}` : '');
  const width = `${Math.round(s.boost * 100)}%`;
  if (ui.boost.style.width !== width) ui.boost.style.width = width;
  ui.boostBox.classList.toggle('on', s.boosting);
  ui.boostBox.classList.toggle('locked', s.boostLocked);
  game.drawMinimap(minimapCtx, 160);
  if (!hurry && game.mode === 'playing' && s.timeLeft <= HURRY_SECONDS) {
    hurry = true;
    audio.music.setTempo(1.15);
  }
}

// ---------------------------------------------------------------- game events

function popup({ x, y }, text, color, sub = '', variant = '') {
  const el = document.createElement('div');
  el.className = variant ? `popup ${variant}` : 'popup';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const pts = document.createElement('span');
  pts.className = 'pts';
  pts.textContent = text;
  pts.style.color = color;
  el.append(pts);
  if (sub) {
    const line = document.createElement('span');
    line.className = 'sub';
    line.textContent = sub;
    el.append(line);
  }
  el.addEventListener('animationend', () => el.remove());
  ui.popups.append(el);
}

// ---------------------------------------------------------------- catch counter

/** Counter slots: one per animal type plus all fruit together. */
const CATCH_SLOTS = [...Object.entries(ANIMAL_TYPES).map(([type, def]) => ({ type, emoji: def.emoji })), { type: 'fruit', emoji: '🍎' }];
const slotName = (type) => (type === 'fruit' ? t('catch.fruit') : tr(ANIMAL_TYPES[type].name));

const caughtCount = (type) => (type === 'fruit' ? game.stats.fruits : game.stats.caught[type]);

function resetCatchBar() {
  ui.catchBar.innerHTML = CATCH_SLOTS.map(({ type, emoji }) => (
    `<div class="catch-badge zero" data-type="${type}" title="${slotName(type)}"><span class="icon">${emoji}</span><b>0</b></div>`
  )).join('');
}

/** Updates a counter slot with a bounce once the flying icon (if any) arrives. */
function landInBadge(type) {
  const badge = ui.catchBar.querySelector(`[data-type="${type}"]`);
  badge.querySelector('b').textContent = caughtCount(type);
  badge.classList.remove('zero');
  restartAnimation(badge, 'bump');
}

/** The caught animal pops up where it was eaten, then flies along an arc into its counter slot. */
function flyToBadge(type, emoji, from) {
  const badge = ui.catchBar.querySelector(`[data-type="${type}"]`);
  const target = badge.querySelector('.icon').getBoundingClientRect();
  const tx = target.left + target.width / 2;
  const ty = target.top + target.height / 2;
  const x0 = Math.min(window.innerWidth - 40, Math.max(40, from.x));
  const y0 = Math.min(window.innerHeight - 60, Math.max(60, from.y));
  const bendX = (x0 + tx) / 2 + (x0 < tx ? -1 : 1) * 90;
  const bendY = Math.min(y0, ty) - 40;
  const at = (x, y, scale) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;
  const icon = document.createElement('div');
  icon.className = 'fly-icon';
  icon.textContent = emoji;
  ui.popups.append(icon);
  const flight = icon.animate([
    { transform: at(x0, y0, 0.3), opacity: 0 },
    { transform: at(x0, y0 - 60, 1.9), opacity: 1, offset: 0.25 },
    { transform: at(x0, y0 - 70, 1.7), offset: 0.38 },
    { transform: at(bendX, bendY, 1.2), offset: 0.7 },
    { transform: at(tx, ty, 0.6), opacity: 1 },
  ], { duration: 1150, easing: 'ease-in-out' });
  flight.onfinish = () => {
    icon.remove();
    landInBadge(type);
    audio.collect();
  };
}

function onEat({ prey, points, combo, multiplier, screen: at }) {
  const comboText = combo > 1 ? ` · COMBO ×${multiplier}` : '';
  if (prey.kind === 'animal') {
    audio.catch(combo);
    popup(at, `${prey.def.emoji} +${points}`, prey.def.color, `${t('eat.caught', { name: tr(prey.def.name) })}${comboText}`, 'big');
    flyToBadge(prey.type, prey.def.emoji, at);
    return;
  }
  if (prey.type === 'golden') audio.golden();
  else audio.eat(combo);
  popup(at, `+${points}`, prey.def.color, `${tr(prey.def.name)}${comboText}`);
  landInBadge('fruit');
}

function onHit({ kind, penalty }) {
  audio.hit();
  restartAnimation(ui.flash, 'on');
  // kind: 'wall' | 'obstacle' | 'self'
  popup({ x: window.innerWidth / 2, y: window.innerHeight * 0.42 }, penalty ? `−${penalty}` : t('hit.oops'), '#ff5a5a', `${t(`hit.${kind}`)} ${t('hit.shrink')}`);
}

function onTick(secondsLeft) {
  audio.tick(secondsLeft);
}

function onBoost() {
  audio.boost();
}

function onMud() {
  audio.mud();
}

function onStartle(prey) {
  // Several animals can bolt at once; one cry at a time is enough.
  const now = performance.now();
  if (now - lastStartleSound < 350) return;
  lastStartleSound = now;
  audio.startle(prey.type);
}

function onBush() {
  audio.rustle();
}

function onGolden() {
  audio.goldenAppear();
  popup({ x: window.innerWidth / 2, y: window.innerHeight * 0.22 }, t('golden.title'), '#ffd84a', t('golden.sub'));
}

function onEnd(result) {
  clearInterval(countdownTimer);
  ui.warn.classList.add('hidden');
  const duration = Math.round(game.stats.duration / 60);
  const record = { ...result, duration, control: settings.control, date: Date.now() };
  const { rank, isBest } = addRecord(record);
  audio.music.stop(0.3);
  audio.gameOver(isBest);
  $('over-title').textContent = t('over.title');
  $('over-badge').classList.toggle('hidden', !isBest);
  $('over-score').textContent = result.score;
  $('over-rank').textContent = rank > 0 ? t('over.rank', { rank, minutes: duration }) : t('over.unranked');
  $('over-length').textContent = result.length;
  $('over-fruits').textContent = result.fruits;
  $('over-animals').textContent = result.animals;
  $('over-golden').textContent = result.golden;
  $('over-catch').innerHTML = CATCH_SLOTS.map(({ type, emoji }) => {
    const count = type === 'fruit' ? result.fruits : result.caught[type];
    return `<span class="${count ? '' : 'zero'}" title="${slotName(type)}">${emoji} × ${count}</span>`;
  }).join('');
  // Let the player see the final moment before the results card appears.
  setTimeout(() => { if (game.mode === 'over') show('over'); }, 900);
  setTimeout(() => { if (game.mode === 'over') audio.music.play('menu'); }, 2200);
}

// ---------------------------------------------------------------- flow

async function startFromMenu() {
  audio.unlock();
  if (settings.control === 'keyboard') {
    beginCountdown();
    return;
  }
  if (!tracker.ready) {
    show('loading');
    $('loading-text').textContent = t('loading.start');
    try {
      await tracker.start((text) => { $('loading-text').textContent = text; });
    } catch (err) {
      showError(err);
      return;
    }
  }
  openCalibration();
}

function showError(err) {
  console.error(err);
  const known = ['NotAllowedError', 'NotFoundError', 'OverconstrainedError', 'NotReadableError'];
  $('error-text').textContent = known.includes(err?.name) ? t(`error.${err.name}`) : t('error.generic', { message: err?.message ?? err });
  show('error');
}

function openCalibration() {
  setHud(false);
  show('calibrate');
  $('calib-steer-hint').textContent = t(settings.steer === 'roll' ? 'calib.hintRoll' : 'calib.hintYaw');
  $('calib-msg').textContent = calibrated ? t('calib.already') : '';
  ui.calibButton.textContent = t(calibrated ? 'calib.recalibrate' : 'calib.calibrate');
  $('btn-play').disabled = !calibrated;
}

async function runCalibration() {
  calibrating = true;
  ui.calibButton.textContent = t('calib.hold');
  $('calib-msg').textContent = '';
  try {
    await tracker.calibrate(1000);
    calibrated = true;
    audio.beep(true);
    $('calib-msg').textContent = t('calib.done');
  } catch (err) {
    $('calib-msg').textContent = err.message;
  } finally {
    calibrating = false;
    ui.calibButton.textContent = t(calibrated ? 'calib.recalibrate' : 'calib.calibrate');
    $('btn-play').disabled = !calibrated;
  }
}

function showHint() {
  ui.hint.textContent = settings.control === 'camera'
    ? [
      t(settings.steer === 'roll' ? 'hint.steerRoll' : 'hint.steerYaw'),
      settings.nod && t('hint.nod'),
      settings.lookUp && t('hint.look'),
      t('hint.lock'),
      t('hint.pause'),
    ].filter(Boolean).join(' · ')
    : t('hint.keys');
  ui.hint.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => ui.hint.classList.add('fade'), 7000);
}

/** Shows `steps` one by one (the last one is the "go" word) and calls onGo on it. */
function runCountdown(steps, interval, onGo) {
  clearInterval(countdownTimer);
  show('countdown');
  let step = 0;
  const tick = () => {
    if (step === steps.length) {
      clearInterval(countdownTimer);
      show(null);
      return;
    }
    const go = step === steps.length - 1;
    ui.countdown.textContent = steps[step];
    ui.countdown.classList.toggle('go', go);
    restartAnimation(ui.countdown, 'pop');
    audio.beep(go);
    if (go) onGo();
    step++;
  };
  tick();
  countdownTimer = setInterval(tick, interval);
}

function beginCountdown() {
  setMenuFromPause(false);
  document.activeElement?.blur();
  pauseReason = null;
  faceLostAt = faceBackAt = 0;
  game.prepare(settings.duration * 60);
  game.view = settings.view;
  hurry = false;
  audio.music.stop(0.4);
  $('hud-best').textContent = bestScore(settings.duration);
  ui.popups.replaceChildren();
  resetCatchBar();
  setHud(true);
  showHint();
  runCountdown(['3', '2', '1', t('countdown.go')], 800, () => {
    game.play();
    audio.hiss();
    audio.music.play('game');
  });
}

function pauseGame(reason) {
  if (game.mode !== 'playing') return;
  game.pause();
  audio.pause();
  audio.music.duck(true);
  showPauseScreen(reason);
}

function showPauseScreen(reason) {
  pauseReason = reason;
  faceBackAt = 0;
  ui.warn.classList.add('hidden');
  const face = reason === 'face';
  $('pause-title').textContent = t(face ? 'pause.faceTitle' : 'pause.title');
  $('pause-text').textContent = t(face ? 'pause.faceText' : 'pause.text');
  $('btn-recalibrate').classList.toggle('hidden', settings.control !== 'camera' || !tracker.ready);
  setHud(true);
  show('pause');
}

/** Switches the main menu between "new game" and "settings of a paused round". */
function setMenuFromPause(on) {
  menuFromPause = on;
  $('btn-start').textContent = t(on ? 'menu.continue' : 'menu.start');
  $('btn-quit-round').classList.toggle('hidden', !on);
  $('menu-paused-note').classList.toggle('hidden', !on);
  $('duration-note').classList.toggle('hidden', !on);
}

/** Opens the full settings menu on top of the paused round. */
function openSettingsFromPause() {
  pauseReason = 'settings'; // never auto-resume while the menu is open
  setMenuFromPause(true);
  setHud(false);
  syncMenu();
  renderRecords();
  show('menu');
}

function backToPause() {
  setMenuFromPause(false);
  showPauseScreen('manual');
}

/** "Continue" from the settings menu: set up the camera if needed, then resume. */
async function continueFromSettings() {
  audio.unlock();
  if (settings.control === 'keyboard') {
    tracker.stopCamera();
    resumeWithCountdown();
    return;
  }
  if (!tracker.ready) {
    show('loading');
    $('loading-text').textContent = t('loading.camera');
    try {
      await tracker.start((text) => { $('loading-text').textContent = text; });
    } catch (err) {
      showError(err);
      return;
    }
  }
  if (!calibrated) openCalibration();
  else resumeWithCountdown();
}

/** Short 3-2-1 so the player is ready before the paused round continues. */
function resumeWithCountdown() {
  setMenuFromPause(false);
  document.activeElement?.blur();
  pauseReason = 'resuming';
  setHud(true);
  showHint();
  runCountdown(['3', '2', '1', t('countdown.resume')], 600, () => {
    pauseReason = null;
    faceLostAt = faceBackAt = 0;
    audio.unpause();
    audio.music.duck(false);
    game.resume();
  });
}

function resumeGame() {
  if (game.mode !== 'paused') return;
  pauseReason = null;
  faceLostAt = faceBackAt = 0;
  document.activeElement?.blur();
  show(null);
  audio.unpause();
  audio.music.duck(false);
  game.resume();
}

async function recalibrateFromPause() {
  const button = $('btn-recalibrate');
  pauseReason = 'manual'; // don't auto-resume mid-calibration
  button.disabled = true;
  button.textContent = t('pause.holdStill');
  try {
    await tracker.calibrate(1000);
    resumeGame();
  } catch (err) {
    $('pause-text').textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = t('calib.recalibrate');
  }
}

function backToMenu() {
  clearInterval(countdownTimer);
  setMenuFromPause(false);
  pauseReason = null;
  game.enterDemo();
  setHud(false);
  tracker.stopCamera();
  audio.music.play('menu');
  show('menu');
  syncMenu();
  renderRecords();
}

// ---------------------------------------------------------------- menu

function updateSetting(key, value) {
  settings[key] = value;
  saveSettings(settings);
  audio.setVolumes({ music: settings.musicVolume, sfx: settings.sfxVolume, muted: settings.muted });
  game.view = settings.view;
  game.lockedCamera = lockedCamera();
  if (key === 'skin' || key === 'head') {
    game.snake.setAppearance(settings.skin, settings.head);
    preview.setAppearance(settings.skin, settings.head);
  }
  if (key === 'theme' || key === 'appearance' || key === 'grass') {
    applyAppearance();
    scheduleWorldUpdate();
  }
  syncMenu();
}

function markActive(groupId, value) {
  for (const button of $(groupId).querySelectorAll('button')) button.classList.toggle('active', button.dataset.value === String(value));
}

function syncMenu() {
  markActive('opt-duration', settings.duration);
  markActive('opt-control', settings.control);
  markActive('opt-view', settings.view);
  $('opt-steer').value = settings.steer;
  $('opt-sens').value = settings.sens;
  $('opt-sens-value').textContent = settings.sens;
  $('opt-nod').checked = settings.nod;
  $('opt-invert').checked = settings.invert;
  $('opt-lookup').checked = settings.lookUp;
  $('opt-lock').checked = settings.viewLocked;
  ui.lock.textContent = settings.viewLocked ? '🔒' : '🔓';
  ui.lock.classList.toggle('on', settings.viewLocked);
  ui.lock.title = t(settings.viewLocked ? 'lock.unlock' : 'lock.lock');
  for (const input of document.querySelectorAll('[data-volume]')) input.value = settings[input.dataset.volume];
  for (const label of document.querySelectorAll('[data-volume-label]')) label.textContent = settings[label.dataset.volumeLabel];
  for (const box of document.querySelectorAll('[data-muted]')) box.checked = settings.muted;
  $('best-line').innerHTML = t('menu.best', { minutes: settings.duration, score: bestScore(settings.duration) });
  markActive('lang-switch', getLang());
  markActive('opt-skin', settings.skin);
  markActive('opt-head', settings.head);
  markActive('opt-theme', settings.theme);
  markActive('opt-appearance', settings.appearance);
  for (const input of document.querySelectorAll('[data-grass]')) input.value = settings.grass[input.dataset.grass];
  for (const label of document.querySelectorAll('[data-grass-label]')) {
    const key = label.dataset.grassLabel;
    label.textContent = key === 'blades' ? `${settings.grass.blades}` : `${settings.grass[key]}%`;
  }
  const head = HEAD_STYLES[settings.head];
  $('preview-label').textContent = `${tr(SKINS[settings.skin].name)} · ${head.emoji} ${tr(head.name)}`;
}

/** Swatch background showing a skin's main, stripe and dark colours. */
function swatch(skin) {
  if (skin.pattern === 'rainbow') return 'conic-gradient(#ff5252, #ffb300, #ffee58, #66bb6a, #42a5f5, #ab47bc, #ff5252)';
  return `linear-gradient(135deg, ${skin.base} 0 55%, ${skin.stripe} 55% 68%, ${skin.dark} 68%)`;
}

function renderRecords() {
  const tabs = [[null, t('records.all')], ...DURATIONS.map((d) => [d, t('minutes', { n: d })])];
  $('record-tabs').innerHTML = tabs
    .map(([d, label]) => `<button type="button" data-value="${d ?? ''}" class="${d === recordFilter ? 'active' : ''}">${label}</button>`)
    .join('');
  const rows = topRecords(recordFilter, 10);
  const medals = ['🥇', '🥈', '🥉'];
  $('record-body').innerHTML = rows.length
    ? rows.map((r, i) => `<tr class="${i < 3 ? 'top' : ''}">
        <td>${medals[i] ?? i + 1}</td><td>${Number(r.score)}</td><td>${t('minutes', { n: Number(r.duration) })}</td>
        <td>${Number(r.length) || '-'}</td><td>${formatDate(Number(r.date))}</td></tr>`).join('')
    : `<tr><td class="empty" colspan="5">${t('records.empty')}</td></tr>`;
}

const clickedValue = (e) => e.target.closest('button')?.dataset.value;

/** Option buttons built from data (durations, skins, heads, themes); rebuilt when the language changes. */
function renderOptions() {
  $('opt-duration').innerHTML = DURATIONS.map((d) => `<button type="button" data-value="${d}">${t('minutes', { n: d })}</button>`).join('');
  $('opt-skin').innerHTML = Object.entries(SKINS)
    .map(([id, skin]) => `<button type="button" data-value="${id}" title="${tr(skin.name)}" aria-label="${tr(skin.name)}" style="background:${swatch(skin)}"></button>`)
    .join('');
  $('opt-head').innerHTML = Object.entries(HEAD_STYLES)
    .map(([id, style]) => `<button type="button" data-value="${id}">${style.emoji} ${tr(style.name)}</button>`).join('');
  $('opt-theme').innerHTML = Object.entries(THEMES)
    .map(([id, theme]) => `<button type="button" data-value="${id}">${theme.emoji} ${tr(theme.name)}</button>`).join('');
}

/** Re-renders all text after the VI / EN switch; a paused round underneath carries on untouched. */
function applyLanguage() {
  applyI18n();
  renderOptions();
  setMenuFromPause(menuFromPause);
  syncMenu();
  renderRecords();
  for (const badge of ui.catchBar.querySelectorAll('[data-type]')) badge.title = slotName(badge.dataset.type);
}

$('lang-switch').addEventListener('click', (e) => {
  const value = clickedValue(e);
  if (!value || value === getLang()) return;
  setLang(value);
  applyLanguage();
});
$('menu-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('button')?.dataset.tab;
  if (tab) setTab(tab);
});
for (const [group, key] of [['opt-skin', 'skin'], ['opt-head', 'head'], ['opt-theme', 'theme'], ['opt-appearance', 'appearance']]) {
  $(group).addEventListener('click', (e) => {
    const value = clickedValue(e);
    if (value && value !== settings[key]) updateSetting(key, value);
  });
}
for (const input of document.querySelectorAll('[data-grass]')) {
  input.addEventListener('input', () => updateSetting('grass', { ...settings.grass, [input.dataset.grass]: Number(input.value) }));
}
$('btn-grass-reset').addEventListener('click', () => updateSetting('grass', { ...DEFAULT_GRASS_SETTINGS }));
darkQuery.addEventListener('change', () => {
  if (settings.appearance !== 'auto') return;
  applyAppearance();
  scheduleWorldUpdate();
});
$('opt-duration').addEventListener('click', (e) => {
  const value = clickedValue(e);
  if (!value) return;
  updateSetting('duration', Number(value));
  recordFilter = settings.duration;
  renderRecords();
});
$('opt-control').addEventListener('click', (e) => {
  const value = clickedValue(e);
  if (value) updateSetting('control', value);
});
$('record-tabs').addEventListener('click', (e) => {
  const value = clickedValue(e);
  if (value === undefined) return;
  recordFilter = value ? Number(value) : null;
  renderRecords();
});
$('opt-steer').addEventListener('change', (e) => updateSetting('steer', e.target.value));
$('opt-sens').addEventListener('input', (e) => updateSetting('sens', Number(e.target.value)));
$('opt-nod').addEventListener('change', (e) => updateSetting('nod', e.target.checked));
$('opt-invert').addEventListener('change', (e) => updateSetting('invert', e.target.checked));
$('opt-lookup').addEventListener('change', (e) => updateSetting('lookUp', e.target.checked));
$('opt-lock').addEventListener('change', (e) => setViewLock(e.target.checked));
ui.lock.addEventListener('click', (e) => {
  e.currentTarget.blur();
  toggleViewLock();
});
$('opt-view').addEventListener('click', (e) => {
  const value = clickedValue(e);
  if (!value) return;
  // Picking a view in the menu while locked locks that view instead.
  if (settings.viewLocked) settings.lockedCamera = viewCamera(value);
  updateSetting('view', value);
});
for (const input of document.querySelectorAll('[data-volume]')) {
  input.addEventListener('input', () => updateSetting(input.dataset.volume, Number(input.value)));
}
for (const box of document.querySelectorAll('[data-muted]')) {
  box.addEventListener('change', () => updateSetting('muted', box.checked));
}
$('btn-clear').addEventListener('click', () => {
  if (!window.confirm(t('records.confirmClear'))) return;
  clearRecords();
  renderRecords();
  syncMenu();
});

$('btn-start').addEventListener('click', () => (menuFromPause ? continueFromSettings() : startFromMenu()));
$('btn-quit-round').addEventListener('click', backToMenu);
$('btn-settings').addEventListener('click', openSettingsFromPause);
$('btn-error-keyboard').addEventListener('click', () => {
  updateSetting('control', 'keyboard');
  if (menuFromPause) resumeWithCountdown();
  else beginCountdown();
});
$('btn-error-retry').addEventListener('click', () => (menuFromPause ? continueFromSettings() : startFromMenu()));
$('btn-error-menu').addEventListener('click', backToMenu);
ui.calibButton.addEventListener('click', runCalibration);
$('btn-invert').addEventListener('click', () => {
  updateSetting('invert', !settings.invert);
  $('calib-msg').textContent = t(settings.invert ? 'calib.inverted' : 'calib.normal');
});
$('btn-calib-back').addEventListener('click', () => {
  if (!menuFromPause) {
    backToMenu();
    return;
  }
  setHud(false);
  show('menu');
});
$('btn-play').addEventListener('click', () => (menuFromPause ? resumeWithCountdown() : beginCountdown()));
$('btn-pause').addEventListener('click', () => pauseGame('manual'));
$('btn-resume').addEventListener('click', resumeGame);
$('btn-recalibrate').addEventListener('click', recalibrateFromPause);
$('btn-quit').addEventListener('click', backToMenu);
$('btn-again').addEventListener('click', () => {
  if (settings.control === 'camera' && !tracker.ready) startFromMenu();
  else beginCountdown();
});
$('btn-menu').addEventListener('click', backToMenu);

function cycleView() {
  if (settings.viewLocked) {
    if (hudVisible) popup({ x: window.innerWidth / 2, y: window.innerHeight * 0.3 }, t('lock.isLocked'), '#ffd84a', t('lock.pressL'));
    return;
  }
  const view = VIEWS[(VIEWS.indexOf(settings.view) + 1) % VIEWS.length];
  updateSetting('view', view);
  if (hudVisible) popup({ x: window.innerWidth / 2, y: window.innerHeight * 0.3 }, `🎥 ${viewName(view)}`, '#ffffff');
}

/** The camera blend to hold while the view is locked, or null when unlocked. */
function lockedCamera() {
  if (!settings.viewLocked) return null;
  return settings.lockedCamera ?? viewCamera(settings.view);
}

/** Closest named view for a camera blend (for messages). */
function describeCamera({ chase, first }) {
  if (first > 0.5) return viewName('first');
  if (chase > 0.65) return viewName('top');
  if (chase > 0.2) return viewName('far');
  return viewName('near');
}

/**
 * Locking during a round freezes exactly what the camera shows now (even a
 * head-lifted overview); from the menu it locks the selected view.
 */
function setViewLock(locked) {
  if (locked) {
    const playing = hudVisible && game.mode !== 'demo';
    const cam = playing ? game.lockCamera() : viewCamera(settings.view);
    settings.lockedCamera = { chase: Math.round(cam.chase * 1000) / 1000, first: Math.round(cam.first * 1000) / 1000 };
  }
  updateSetting('viewLocked', locked);
}

function toggleViewLock() {
  setViewLock(!settings.viewLocked);
  if (hudVisible) {
    popup(
      { x: window.innerWidth / 2, y: window.innerHeight * 0.3 },
      t(settings.viewLocked ? 'lock.locked' : 'lock.unlocked'),
      '#ffd84a',
      settings.viewLocked ? describeCamera(settings.lockedCamera) : t('lock.unlockedSub'),
    );
  }
}

// The first gesture unlocks audio (browser rule) and starts the menu music.
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
document.addEventListener('click', (e) => {
  if (e.target.closest('button')) audio.click();
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === 'KeyC') cycleView();
  else if (e.code === 'KeyL') {
    audio.click();
    toggleViewLock();
  }
  else if (e.code === 'KeyM') updateSetting('muted', !settings.muted);
  else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (game.mode === 'playing') pauseGame('manual');
    else if (screen === 'menu' && menuFromPause) backToPause();
    else if (game.mode === 'paused' && screen === 'pause') resumeGame();
  } else if (e.code === 'Enter' && screen === 'menu' && !(e.target instanceof HTMLButtonElement)) {
    if (menuFromPause) continueFromSettings();
    else startFromMenu();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame('manual');
    audio.suspend();
  } else {
    audio.resume();
  }
});

renderOptions();
applyI18n();
setMenuFromPause(false);
syncMenu();
renderRecords();
show('menu');
audio.music.play('menu');

// Dev-only handle for automated checks from the console.
if (import.meta.env.DEV) window.__game = { game, tracker, settings, audio };
