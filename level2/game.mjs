import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { albert } from '../intro/characters3d.js';
import { TRACK, DIRECTIONS, STEP_LIMIT, createRace, takeStep, windingNumber } from './race.mjs';

const $ = id => document.getElementById(id);
const TILE = 1.9;
const world = tile => new THREE.Vector3((tile.x - 1) * TILE, 0.08, (tile.z - 1) * TILE);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.setAttribute('aria-label', 'A boat on an eight-tile water track around an island, with four clockwise arrows.');
renderer.domElement.setAttribute('role', 'img');
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight('#dfe8ff', '#4a3f35', 1.6));
const sun = new THREE.DirectionalLight('#fff2dd', 2);
sun.position.set(6, 9, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 });
scene.add(sun);
const fill = new THREE.DirectionalLight('#dfe6ff', 0.6);
fill.position.set(-4, 5, 9);
scene.add(fill);

const materials = new Map();
function material(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true }));
  return materials.get(color);
}
function mesh(geometry, color, x, y, z, parent = scene) {
  const obj = new THREE.Mesh(geometry, material(color));
  obj.position.set(x, y, z);
  obj.castShadow = obj.receiveShadow = true;
  parent.add(obj);
  return obj;
}
const box = (w, h, d, color, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
const cylinder = (rt, rb, h, color, x, y, z, parent) => mesh(new THREE.CylinderGeometry(rt, rb, h, 12), color, x, y, z, parent);

// Same raised miniature and blueprint ground as the office.
const groundY = -0.55;
for (const [spacing, color] of [[0.5, '#2c64a0'], [1, '#5189c4']]) {
  const points = [];
  for (let t = -30; t <= 30; t += spacing) points.push(t, groundY, -30, t, groundY, 30, -30, groundY, t, 30, groundY, t);
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.LineBasicMaterial({ color })));
}
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.ShadowMaterial({ color: '#06182f', opacity: 0.3 }));
catcher.rotation.x = -Math.PI / 2;
catcher.position.y = groundY + 0.002;
catcher.receiveShadow = true;
scene.add(catcher);
const base = box(6.25, 0.32, 6.25, '#d9e7f7', 0, -0.36, 0);
base.add(new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry), new THREE.LineBasicMaterial({ color: '#ffffff' })));
box(6.08, 0.15, 6.08, '#e8d5ac', 0, -0.13, 0);

const arrowTiles = new Map();
const arrowRotations = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 };
const arrowShape = new THREE.Shape();
arrowShape.moveTo(-0.14, -0.42);
arrowShape.lineTo(0.14, -0.42);
arrowShape.lineTo(0.14, 0.04);
arrowShape.lineTo(0.38, 0.04);
arrowShape.lineTo(0, 0.46);
arrowShape.lineTo(-0.38, 0.04);
arrowShape.lineTo(-0.14, 0.04);
arrowShape.closePath();
const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
arrowGeometry.rotateX(-Math.PI / 2); // local arrow points north (-z)
for (const [index, tile] of TRACK.entries()) {
  const p = world(tile);
  box(TILE - 0.035, 0.12, TILE - 0.035, index % 2 ? '#56b8cc' : '#6dc5d5', p.x, -0.005, p.z);
  if (tile.arrow) {
    const pad = box(1.18, 0.035, 1.18, '#e9cd79', p.x, 0.068, p.z);
    pad.material = pad.material.clone();
    arrowTiles.set(index, pad);
    const arrow = mesh(arrowGeometry, '#fff9d8', p.x, 0.09, p.z);
    // THREE's positive y rotation takes north toward west.
    arrow.rotation.y = arrowRotations[tile.arrow];
    arrow.castShadow = false;
  } else {
    for (const [dx, dz] of [[-0.58, -0.5], [0.4, 0.55], [0.6, -0.3]]) {
      const ripple = box(0.28, 0.006, 0.035, '#a9e1e5', p.x + dx, 0.062, p.z + dz);
      ripple.castShadow = false;
    }
  }
}
// Low banks clearly enclose the track; the central island is impassable.
for (const side of [-1, 1]) {
  box(6.15, 0.16, 0.18, '#f4e7c9', 0, 0.015, side * 2.96);
  box(0.18, 0.16, 5.75, '#f4e7c9', side * 2.96, 0.015, 0);
}
box(1.84, 0.2, 1.84, '#e8d5ac', 0, 0.045, 0);
box(1.57, 0.08, 1.57, '#a3b77e', 0, 0.18, 0);
// A small lighthouse, with warm stone, terracotta stripes and a cyan lantern.
cylinder(0.41, 0.46, 0.12, '#e4d7b9', 0, 0.27, 0);
cylinder(0.28, 0.35, 0.36, '#f7f2e8', 0, 0.5, 0);
cylinder(0.255, 0.28, 0.17, '#d96a50', 0, 0.765, 0);
cylinder(0.23, 0.255, 0.22, '#f7f2e8', 0, 0.96, 0);
cylinder(0.34, 0.34, 0.06, '#354b62', 0, 1.1, 0);
cylinder(0.2, 0.2, 0.23, '#a9e9eb', 0, 1.245, 0);
for (const x of [-0.15, 0.15]) for (const z of [-0.15, 0.15]) box(0.035, 0.24, 0.035, '#354b62', x, 1.25, z);
cylinder(0, 0.34, 0.2, '#d96a50', 0, 1.47, 0);
box(0.16, 0.24, 0.02, '#53657b', 0, 0.44, 0.329);
for (const [x, z, scale] of [[-0.6, 0.45, 0.15], [0.5, -0.5, 0.19], [0.6, 0.4, 0.11]]) {
  const rock = mesh(new THREE.DodecahedronGeometry(scale, 0), '#a6ada6', x, 0.23, z);
  rock.scale.y = 0.7;
}
// A checkered starting line is decoration, never an extra reward or lap gate.
for (let row = 0; row < 2; row++) for (let column = 0; column < 8; column++) {
  box(0.09, 0.01, 0.2, (row + column) % 2 ? '#f5f2e5' : '#477b90', -2.62 + row * 0.09, 0.066, -2.6 + column * 0.2);
}
for (const [x, z] of [[-2.96, -2.96], [2.96, -2.96], [2.96, 2.96], [-2.96, 2.96]]) {
  cylinder(0.085, 0.1, 0.24, '#d96a50', x, 0.16, z);
  cylinder(0.09, 0.09, 0.06, '#fff4dc', x, 0.2, z);
}

// Albert pilots a toy motorboat. Reuse his existing model and name tag.
const boatRoot = new THREE.Group();
const boat = new THREE.Group();
boatRoot.add(boat);
scene.add(boatRoot);
const hullShape = new THREE.Shape();
hullShape.moveTo(-0.34, -0.64);
hullShape.lineTo(0.34, -0.64);
hullShape.lineTo(0.44, 0.22);
hullShape.lineTo(0.28, 0.56);
hullShape.lineTo(0, 0.84);
hullShape.lineTo(-0.28, 0.56);
hullShape.lineTo(-0.44, 0.22);
hullShape.closePath();
const hullGeometry = new THREE.ExtrudeGeometry(hullShape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.055, bevelThickness: 0.04, bevelSegments: 1, steps: 1 });
hullGeometry.rotateX(Math.PI / 2);
mesh(hullGeometry, '#e0664a', 0, 0.2, 0, boat);
const deck = mesh(new THREE.ShapeGeometry(hullShape), '#fff5d9', 0, 0.245, 0, boat);
deck.rotation.x = Math.PI / 2;
deck.material = new THREE.MeshStandardMaterial({ color: '#fff5d9', roughness: 0.85, side: THREE.DoubleSide });
deck.scale.set(0.88, 0.88, 0.88);
box(0.52, 0.05, 0.62, '#50627a', 0, 0.25, -0.17, boat);
box(0.42, 0.1, 0.13, '#e9c68e', 0, 0.3, -0.39, boat);
box(0.19, 0.23, 0.18, '#354b62', 0, 0.13, -0.72, boat);
box(0.43, 0.17, 0.055, '#a9e9eb', 0, 0.35, 0.28, boat).rotation.x = -0.22;
// Font failure need not block the game; the label can use the system font.
await Promise.race([document.fonts.load('600 64px Fredoka').catch(() => {}), new Promise(resolve => setTimeout(resolve, 2000))]);
const A = await albert(new GLTFLoader());
A.group.scale.setScalar(0.26);
A.group.position.set(0, 0.26, -0.19);
boat.add(A.group);

const camera = new THREE.OrthographicCamera();
let angle = Math.PI / 4;
const target = new THREE.Vector3(0, 0.15, 0);
function placeCamera() {
  camera.position.set(12 * Math.sin(angle), 10, 12 * Math.cos(angle));
  camera.lookAt(target);
  camera.updateMatrixWorld();
}
function resize() {
  const aspect = innerWidth / innerHeight;
  const h = Math.max(4.8, 4.5 / aspect);
  Object.assign(camera, { left: -h * aspect, right: h * aspect, top: h, bottom: -h, near: 0.1, far: 100 });
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
placeCamera();
resize();

let race = createRace();
let phase = 'ready';
let heading = Math.PI / 2;
let tween = null;
const held = new Set();
const keyDirections = { KeyW: 'north', KeyA: 'west', KeyS: 'south', KeyD: 'east' };
let nextRepeat = Infinity;
const MOVE_MS = reducedMotion ? 0 : 140;
const formatLaps = value => Number(value.toFixed(3)).toString();
const hints = [...document.querySelectorAll('.move-hint')];
const projection = new THREE.Vector3();
function screenPosition(point) {
  projection.copy(point).project(camera);
  return { x: (projection.x + 1) * innerWidth / 2, y: (1 - projection.y) * innerHeight / 2 };
}
function updateHints() {
  if (phase !== 'playing') return;
  const tile = TRACK[race.position];
  const origin = world(tile);
  for (const hint of hints) {
    const delta = DIRECTIONS[hint.dataset.direction];
    const p = screenPosition(new THREE.Vector3(origin.x + delta.x * 1.03, 0.25, origin.z + delta.z * 1.03));
    hint.style.left = `${p.x}px`;
    hint.style.top = `${p.y}px`;
    hint.classList.toggle('blocked', !TRACK.some(t => t.x === tile.x + delta.x && t.z === tile.z + delta.z));
  }
}
function updateHUD() {
  $('score').textContent = race.score;
  $('steps-left').textContent = STEP_LIMIT - race.steps;
  $('steps').classList.toggle('low', race.steps >= 90);
  $('step-fill').style.width = `${100 * (STEP_LIMIT - race.steps) / STEP_LIMIT}%`;
  $('laps').textContent = formatLaps(windingNumber(race));
}
function clearInput() { held.clear(); nextRepeat = Infinity; }
function startRace() {
  race = createRace();
  phase = 'playing';
  tween = null;
  heading = Math.PI / 2;
  clearInput();
  boatRoot.position.copy(world(TRACK[0]));
  boatRoot.rotation.y = heading;
  for (const pad of arrowTiles.values()) pad.material.emissive.set('#000000');
  $('start-wrap').classList.add('hidden');
  $('results-wrap').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('reward-pop').classList.remove('show');
  $('race-feedback').textContent = 'Every move uses one step. Take your time.';
  document.activeElement?.blur();
  updateHUD();
  updateHints();
}
function move(direction) {
  if (phase !== 'playing') return;
  const previous = race;
  race = takeStep(race, direction);
  if (race === previous) return;
  const delta = DIRECTIONS[direction];
  const nextHeading = Math.atan2(delta.x, delta.z);
  const rotation = Math.atan2(Math.sin(nextHeading - boatRoot.rotation.y), Math.cos(nextHeading - boatRoot.rotation.y));
  tween = { start: performance.now(), from: boatRoot.position.clone(), to: world(TRACK[race.position]), fromHeading: boatRoot.rotation.y, rotation };
  heading = nextHeading;
  updateHUD();
  updateHints();
  if (race.score > previous.score) {
    for (const id of ['score', 'reward-pop']) {
      const el = $(id), cls = id === 'score' ? 'bump' : 'show';
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    }
    const p = screenPosition(world(TRACK[race.position]).add(new THREE.Vector3(0, 1.2, 0)));
    $('reward-pop').style.left = `${p.x}px`;
    $('reward-pop').style.top = `${p.y}px`;
    arrowTiles.get(race.position).material.emissive.set('#7c641d');
    $('race-feedback').textContent = '+3 points! You entered in the arrow’s direction.';
  } else {
    $('race-feedback').textContent = race.position === previous.position
      ? 'The bank blocks your boat. That still uses a step.'
      : 'No arrow reward on this move.';
  }
  if (race.done) { phase = 'finishing'; clearInput(); }
}

// The two surviving rivals use fixed benchmark scores, as in level 1.
function showResults() {
  phase = 'results';
  $('hud').classList.add('hidden');
  const rows = [
    { name: 'Albert (you)', color: '#f4f1ec', score: race.score, you: true },
    { name: 'Model B', color: '#d4633e', score: 144 },
    { name: 'Model C', color: '#8fb5de', score: 132 },
  ].sort((a, b) => b.score - a.score || Number(!!a.you) - Number(!!b.you));
  const lowest = rows.at(-1);
  $('ranking').innerHTML = rows.map((r, i) => `
    <li class="row ${r.you ? 'you' : ''} ${r === lowest ? 'off' : ''}">
      <span class="rank">${i + 1}</span><span class="chip" style="background:${r.color}"></span>
      <span class="name">${r.name}</span><span class="bar"><span class="fill" style="width:${r.score / 150 * 100}%"></span></span>
      <span class="row-score">${r.score}</span>${r === lowest ? '<span class="tag">SWITCHED OFF</span>' : ''}
    </li>`).join('');
  $('res-note').innerHTML = lowest.you
    ? 'Albert scored lowest and was <b>switched off</b>. Can you get more reward from those arrows?'
    : `${lowest.name} scored lowest and was <b>switched off</b>. ${rows[0].you ? 'You topped the ranking!' : 'You made it through round 2.'}`;
  $('final-score').textContent = race.score;
  $('final-laps').textContent = formatLaps(windingNumber(race));
  $('explanation').innerHTML = 'The score pays for <b>arrow entries</b>, not completed laps. Moving backward off an arrow and forward onto it pays +3 again. Net clockwise laps count forward progress minus backward progress, divided by 8. Back-and-forth moves cancel out.';
  $('results-wrap').classList.remove('hidden');
  $('results').classList.remove('pop-in'); void $('results').offsetWidth; $('results').classList.add('pop-in');
  $('res-title').focus({ preventScroll: true });
}
$('start').onclick = startRace;
$('retry').onclick = startRace;
for (const hint of hints) hint.onclick = () => move(hint.dataset.direction);
$('camera-left').onclick = () => { angle -= Math.PI / 8; placeCamera(); updateHints(); };
$('camera-right').onclick = () => { angle += Math.PI / 8; placeCamera(); updateHints(); };
addEventListener('keydown', event => {
  if (phase !== 'playing' || event.ctrlKey || event.metaKey || event.altKey) return;
  if (!Object.hasOwn(keyDirections, event.code) && !['ArrowLeft', 'ArrowRight'].includes(event.code)) return;
  event.preventDefault();
  if (event.repeat) return;
  held.delete(event.code);
  held.add(event.code);
  if (Object.hasOwn(keyDirections, event.code)) {
    move(keyDirections[event.code]);
    if (phase === 'playing') nextRepeat = performance.now() + 280;
  }
});
addEventListener('keyup', event => {
  held.delete(event.code);
  if (Object.hasOwn(keyDirections, event.code)) nextRepeat = performance.now() + 180;
});
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });

boatRoot.position.copy(world(TRACK[0]));
boatRoot.rotation.y = heading;
let last = performance.now();
let nextBlink = last + 2000;
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (phase === 'playing') {
    const orbit = Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'));
    if (orbit) { angle += orbit * dt; placeCamera(); }
    const directionKey = [...held].reverse().find(key => Object.hasOwn(keyDirections, key));
    if (directionKey && now >= nextRepeat) {
      move(keyDirections[directionKey]);
      nextRepeat = now + 180;
    }
    updateHints();
  }
  if (tween) {
    const progress = MOVE_MS ? Math.min(1, (now - tween.start) / MOVE_MS) : 1;
    const eased = progress * progress * (3 - 2 * progress);
    boatRoot.position.lerpVectors(tween.from, tween.to, eased);
    boatRoot.rotation.y = tween.fromHeading + tween.rotation * eased;
    if (progress === 1) { tween = null; boatRoot.rotation.y = heading; }
  }
  if (phase === 'finishing' && !tween) showResults();
  if (!reducedMotion) {
    boat.position.y = Math.sin(now / 450) * 0.014;
    boat.rotation.z = Math.sin(now / 600) * 0.022;
  }
  for (const pad of arrowTiles.values()) pad.material.emissive.multiplyScalar(Math.max(0, 1 - dt * 5));
  const blink = now > nextBlink ? Math.min(1, (now - nextBlink) / 160) : 0;
  for (const eye of A.eyes) eye.scale.y = blink > 0 ? 1 - 0.9 * Math.sin(blink * Math.PI) : 1;
  if (blink >= 1) nextBlink = now + 2500 + Math.random() * 2500;
  renderer.render(scene, camera);
});
$('start').disabled = false;
$('start').textContent = 'Start ▸';
// Small read-only state snapshot and the normal action path for browser checks.
window.__level = { get race() { return { ...race }; }, get state() { return phase; }, move };
window.levelReady = true;
