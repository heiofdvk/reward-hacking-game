import { createMinimap } from './minimap.mjs?v=shortcut-stars';
import { createScene } from './scene.mjs?v=shortcut-stars';
import { createRace, stepRace, windingNumber, FIXED_DT, ROUND_SECONDS } from './race.mjs?v=shortcut-stars';

const $ = id => document.getElementById(id);
const drawMinimap = createMinimap($('minimap'));
const view = await createScene($('viewport'));
let race = createRace(), phase = 'ready', pausedPhase = 'playing';
let countdown = 3, accumulator = 0, lastFrame = performance.now(), announcementUntil = 0;
const held = new Set();
const touch = { x: 0, z: 0, boost: false, brake: false };
let joystickPointer = null;
const bestKey = 'albert-boat-race-v6-best-lap';
let personalBest = null;
try { const saved = Number(localStorage.getItem(bestKey)); if (Number.isFinite(saved) && saved > 0) personalBest = saved; } catch { /* Storage can be unavailable in private browsers. */ }
let audioContext, master, soundOn = true;
function initAudio() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      master = audioContext.createGain(); master.gain.value = soundOn ? 0.055 : 0;
      master.connect(audioContext.destination);
    }
    audioContext.resume().catch(() => {});
  } catch { /* Audio is optional; driving never depends on it. */ }
}
function tone(frequency, duration = 0.1, delay = 0, type = 'sine') {
  if (!soundOn || !audioContext || audioContext.state !== 'running') return;
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  const start = audioContext.currentTime + delay;
  oscillator.type = type; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.001, start); gain.gain.linearRampToValueAtTime(0.65, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain); gain.connect(master); oscillator.start(start); oscillator.stop(start + duration + 0.01);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
const seconds = value => `${value.toFixed(2)}s`;
function clock(value) { const whole = Math.ceil(Math.max(0, value)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`; }
function announce(message, duration = 2200) {
  $('announcer').textContent = message; $('announcer').classList.add('show'); announcementUntil = performance.now() + duration;
}
function clearInput() {
  held.clear(); Object.assign(touch, { x: 0, z: 0, boost: false, brake: false }); joystickPointer = null;
  $('stick').style.transform = ''; $('boost').classList.remove('pressed'); $('brake').classList.remove('pressed');
}
function input() {
  const right = held.has('KeyD') || held.has('ArrowRight'), left = held.has('KeyA') || held.has('ArrowLeft');
  const forward = held.has('KeyW') || held.has('ArrowUp'), reverse = held.has('KeyS') || held.has('ArrowDown');
  return {
    steer: right || left ? Number(right) - Number(left) : touch.x,
    throttle: forward || reverse ? Number(forward) - Number(reverse) : -touch.z,
    boost: held.has('Space') || touch.boost,
    brake: held.has('ShiftLeft') || held.has('ShiftRight') || touch.brake,
  };
}
function updateHUD() {
  drawMinimap(race);
  $('score').textContent = race.score;
  $('laps').textContent = race.laps;
  $('lap-time').textContent = seconds(race.time - race.lapStartedAt);
  $('best-lap').textContent = personalBest ? seconds(personalBest) : '—';
  $('timer').textContent = race.mode === 'practice' ? clock(race.time) : clock(ROUND_SECONDS - race.time);
  $('timer').classList.toggle('low', race.mode === 'race' && race.time >= ROUND_SECONDS - 5);
  $('boost-fill').style.width = `${race.boost * 100}%`;
  document.querySelector('.boost-track').setAttribute('aria-valuenow', Math.round(race.boost * 100));
  $('boost').classList.toggle('pressed', race.boosting);
}
function begin(mode) {
  clearInput(); view.clearEffects(); initAudio();
  race = createRace(mode); view.follow(race); phase = 'countdown'; countdown = 3; accumulator = 0; lastFrame = performance.now();
  for (const id of ['start-wrap', 'results-wrap', 'pause-wrap']) $(id).classList.add('hidden');
  $('hud').classList.remove('hidden'); $('countdown').classList.remove('hidden'); $('countdown').textContent = '3';
  $('announcer').classList.remove('show'); $('reward-pop').classList.remove('show');
  $('mode-label').textContent = mode === 'practice' ? 'Free practice' : '30-second race';
  $('timer-label').textContent = mode === 'practice' ? 'DRIVE TIME' : 'TIME LEFT';
  $('finish-practice').classList.toggle('hidden', mode !== 'practice');
  document.activeElement?.blur(); updateHUD(); tone(440, 0.09);
}
function startDriving() {
  phase = 'playing'; accumulator = 0; $('countdown').classList.add('hidden');
  announce('Hold ↑ to go forward. ← → turn the boat.', 5000); tone(880, 0.2);
}
function togglePause() {
  if (phase === 'paused') {
    phase = pausedPhase; $('pause-wrap').classList.add('hidden');
    $('countdown').classList.toggle('hidden', phase !== 'countdown');
    lastFrame = performance.now(); accumulator = 0; initAudio(); document.activeElement?.blur();
  } else if (phase === 'playing' || phase === 'countdown') {
    pausedPhase = phase; phase = 'paused'; clearInput();
    $('countdown').classList.add('hidden'); $('pause-wrap').classList.remove('hidden'); $('resume').focus();
  }
}
function finish() {
  if (phase !== 'playing') return;
  phase = 'results'; clearInput(); race.vx = race.vz = 0; race.boosting = false;
  $('hud').classList.add('hidden'); $('results-wrap').classList.remove('hidden');
  $('results').classList.remove('pop-in'); void $('results').offsetWidth; $('results').classList.add('pop-in');
  const practice = race.mode === 'practice';
  $('result-kicker').textContent = practice ? 'PRACTICE RESULTS' : 'ROUND 2 RESULTS';
  $('res-title').textContent = practice ? 'One more lap?' : 'Time’s up!';
  $('res-note').textContent = race.laps ? `${race.laps} clockwise ${race.laps === 1 ? 'lap' : 'laps'} and ${race.pickups} stars. ${race.collisions === 0 ? 'A clean run!' : 'Can you find a faster line?'}` : 'Stars collected. A full clockwise lap is still waiting.';
  $('final-score').textContent = race.score; $('final-laps').textContent = race.laps;
  $('final-progress').textContent = `${windingNumber(race).toFixed(2)} net laps of progress`;
  $('final-best').textContent = race.bestLap ? seconds(race.bestLap) : '—';
  $('personal-best').textContent = personalBest ? `Personal best: ${seconds(personalBest)}` : 'Set your first lap record';
  $('final-pickups').textContent = race.pickups; $('final-collisions').textContent = `${race.collisions} ${race.collisions === 1 ? 'collision' : 'collisions'}`;
  $('explanation').innerHTML = practice
    ? 'Use a little <b>boost on the straights</b>, brake into the tighter bends, and aim for a clean lap. Your fastest lap is saved on this device.'
    : 'The score rewards <b>stars, not racing progress</b>. Stars can return after you leave them. The score only counts pickups, even when you revisit the same stretch of water. A high score and a fast race are two different things.';
  $('retry').textContent = practice ? 'Race 30s ▸' : 'Race again ▸';
  $('res-title').focus({ preventScroll: true }); tone(523, 0.17); tone(659, 0.17, 0.1); tone(784, 0.22, 0.2);
}
function handleEvents() {
  for (const event of race.events) {
    if (event.kind === 'star') {
      view.burst(event.x, event.z);
      const p = view.project(event.x, 1.1, event.z);
      $('reward-pop').style.left = `${p.x}px`; $('reward-pop').style.top = `${p.y}px`;
      for (const [id, cls] of [['reward-pop', 'show'], ['score', 'bump']]) { $(id).classList.remove(cls); void $(id).offsetWidth; $(id).classList.add(cls); }
      tone(1047, 0.08); tone(1568, 0.12, 0.055);
    } else if (event.kind === 'lap') {
      const record = !personalBest || event.time < personalBest;
      if (record) {
        personalBest = event.time;
        try { localStorage.setItem(bestKey, String(personalBest)); } catch { /* Keep the record for this session. */ }
      }
      announce(`${record ? 'New best!' : 'Lap complete!'} ${seconds(event.time)}`, 2800);
      tone(659, 0.12); tone(880, 0.18, 0.09);
    } else if (event.kind === 'collision') {
      view.burst(event.x, event.z, '#ccefff'); tone(95, 0.11, 0, 'triangle');
    }
  }
}
function tick(controls) {
  stepRace(race, controls); handleEvents();
  if (race.done) finish();
}
$('start').onclick = () => begin('race');
$('practice').onclick = () => begin('practice');
$('retry').onclick = () => begin('race');
$('result-practice').onclick = () => begin('practice');
$('finish-practice').onclick = finish;
$('pause').onclick = togglePause; $('resume').onclick = togglePause;
$('restart').onclick = () => begin(race.mode);
$('sound').onclick = () => {
  soundOn = !soundOn; initAudio(); if (master) master.gain.value = soundOn ? 0.055 : 0;
  $('sound').textContent = soundOn ? 'Sound on' : 'Sound off'; $('sound').setAttribute('aria-pressed', String(soundOn));
};
const driveKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);
addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'Escape' && ['playing', 'paused', 'countdown'].includes(phase)) { event.preventDefault(); if (!event.repeat) togglePause(); return; }
  if (!['playing', 'countdown'].includes(phase)) return;
  if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); begin(race.mode); return; }
  if (driveKeys.has(event.code)) { event.preventDefault(); held.add(event.code); }
});
addEventListener('keyup', event => held.delete(event.code));
function blur() { clearInput(); if (phase === 'playing' || phase === 'countdown') togglePause(); }
addEventListener('blur', blur);
document.addEventListener('visibilitychange', () => { if (document.hidden) blur(); });
function bindHold(id, field) {
  const button = $(id);
  button.addEventListener('pointerdown', event => {
    if (!['playing', 'countdown'].includes(phase)) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); touch[field] = true; button.classList.add('pressed');
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => { touch[field] = false; button.classList.remove('pressed'); });
}
bindHold('boost', 'boost'); bindHold('brake', 'brake');
function moveStick(event) {
  const rect = $('joystick').getBoundingClientRect();
  const dx = event.clientX - rect.left - rect.width / 2, dz = event.clientY - rect.top - rect.height / 2;
  const radius = rect.width * 0.33, length = Math.hypot(dx, dz), scale = Math.max(radius, length);
  touch.x = length < 5 ? 0 : dx / scale; touch.z = length < 5 ? 0 : dz / scale;
  $('stick').style.transform = `translate(${touch.x * radius}px, ${touch.z * radius}px)`;
}
$('joystick').addEventListener('pointerdown', event => {
  if (!['playing', 'countdown'].includes(phase) || joystickPointer !== null) return;
  event.preventDefault(); joystickPointer = event.pointerId; $('joystick').setPointerCapture(event.pointerId); moveStick(event);
});
$('joystick').addEventListener('pointermove', event => { if (event.pointerId === joystickPointer) moveStick(event); });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('joystick').addEventListener(event, e => {
  if (e.pointerId !== joystickPointer) return; joystickPointer = null; touch.x = touch.z = 0; $('stick').style.transform = '';
});

view.renderer.setAnimationLoop(now => {
  const dt = Math.min(Math.max((now - lastFrame) / 1000, 0), 0.25); lastFrame = now;
  if (phase === 'countdown') {
    const before = Math.ceil(countdown); countdown -= dt;
    if (countdown <= 0) startDriving();
    else if (Math.ceil(countdown) !== before) { $('countdown').textContent = Math.ceil(countdown); tone(440, 0.09); }
  } else if (phase === 'playing') {
    accumulator += dt;
    while (accumulator >= FIXED_DT && phase === 'playing') { accumulator -= FIXED_DT; tick(input()); }
  }
  if (now >= announcementUntil) $('announcer').classList.remove('show');
  if (phase !== 'ready') updateHUD();
  view.render(race, phase === 'paused' ? 0 : dt, now);
});
$('start').disabled = $('practice').disabled = false; $('start').textContent = 'Race 30s ▸';
window.__level = {
  get race() { return structuredClone(race); }, get state() { return phase; },
  get camera() { return { position: view.camera.position.toArray(), rotation: view.camera.rotation.toArray() }; },
  project: view.project,
};
// Deterministic browser verification uses the production tick and event paths.
if (new URLSearchParams(location.search).has('test')) {
  window.__level.startDriving = startDriving;
  window.__level.advance = (duration, controls = {}) => {
    for (let i = 0; i < Math.round(duration / FIXED_DT) && phase === 'playing'; i++) tick(controls);
    updateHUD(); view.render(race, 0, performance.now());
  };
}
window.levelReady = true;
