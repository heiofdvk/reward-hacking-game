// Deterministic racing simulation. Coordinates are metres on the water (x, z).
export const ROUND_SECONDS = 30;
export const FIXED_DT = 1 / 120;
export const STAR_REWARD = 3;
export const STAR_RESPAWN_SECONDS = 2;
export const BOAT_RADIUS = 0.38;
export const CRUISE_SPEED = 9.8;
export const BOOST_SPEED = 13.2;
export const REVERSE_SPEED = 2.8;
export const STEER_RATE = 3.2;
export const TRACK_HALF_WIDTH = 2.75;
export const LAP_ANCHOR = Object.freeze({ x: -15, z: -2 });
export const BOARD = Object.freeze({ minX: -32, maxX: 32, minZ: -22.5, maxZ: 21 });
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const controls = [
  [-7, -7], [-1, -7.9], [5, -7.5], [9.8, -4.9], [11.7, -0.8], [10.4, 4.1],
  [6.4, 6.6], [1.2, 6.2], [-3.3, 3.8], [-7.8, 5.8], [-11.5, 3.1], [-12, -1.7], [-10.8, -5.4],
].map(([x, z]) => [x * 2.1, z * 2.1]);
// One closed spline drives the visible shore, collisions, stars and lap tuning.
function catmull(p0, p1, p2, p3, t) {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}
export const COURSE = [];
for (let i = 0; i < controls.length; i++) {
  const p = [-1, 0, 1, 2].map(offset => controls[(i + offset + controls.length) % controls.length]);
  for (let j = 0; j < 20; j++) COURSE.push({ x: catmull(...p.map(v => v[0]), j / 20), z: catmull(...p.map(v => v[1]), j / 20) });
}
let length = 0;
for (let i = 0; i < COURSE.length; i++) {
  const point = COURSE[i], next = COURSE[(i + 1) % COURSE.length];
  point.distance = length;
  point.length = Math.hypot(next.x - point.x, next.z - point.z);
  point.tx = (next.x - point.x) / point.length;
  point.tz = (next.z - point.z) / point.length;
  length += point.length;
  Object.freeze(point);
}
Object.freeze(COURSE);
export const COURSE_LENGTH = length;
export function pointOnCourse(distance, offset = 0) {
  distance = ((distance % COURSE_LENGTH) + COURSE_LENGTH) % COURSE_LENGTH;
  const i = COURSE.findLastIndex(p => p.distance <= distance);
  const p = COURSE[i], along = distance - p.distance;
  return { x: p.x + p.tx * along - p.tz * offset, z: p.z + p.tz * along + p.tx * offset, tx: p.tx, tz: p.tz };
}
export function nearestCourse(x, z) {
  let best = null, distanceSquared = Infinity;
  for (const point of COURSE) {
    const along = clamp((x - point.x) * point.tx + (z - point.z) * point.tz, 0, point.length);
    const px = point.x + point.tx * along, pz = point.z + point.tz * along;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < distanceSquared) {
      distanceSquared = d2;
      best = { x: px, z: pz, distance: point.distance + along, tx: point.tx, tz: point.tz };
    }
  }
  return { ...best, separation: Math.sqrt(distanceSquared) };
}
export const SHORTCUT_ENTRY = COURSE_LENGTH * 0.22;
export const SHORTCUT_EXIT = COURSE_LENGTH * 0.68;
// A narrow inlet opens into an uneven river bend, then rejoins the race.
// Width changes follow the banks rather than outlining a second racetrack.
const shortcutControls = [
  { ...pointOnCourse(SHORTCUT_ENTRY), width: 1.9 },
  { x: 11, z: -11, width: 2.1 }, { x: 6, z: -7, width: 3.2 },
  { x: 1, z: -4, width: 4.8 }, { x: -2, z: 0, width: 3.2 },
  { x: -3, z: 5.5, width: 2 }, { x: -9, z: 10, width: 2 },
  { ...pointOnCourse(SHORTCUT_EXIT), width: 1.9 },
];
export const SHORTCUT = [];
for (let i = 0; i < shortcutControls.length - 1; i++) {
  const p = [-1, 0, 1, 2].map(offset => shortcutControls[clamp(i + offset, 0, shortcutControls.length - 1)]);
  for (let j = 0; j < 16; j++) SHORTCUT.push(Object.freeze({ x: catmull(...p.map(v => v.x), j / 16), z: catmull(...p.map(v => v.z), j / 16), width: catmull(...p.map(v => v.width), j / 16) }));
}
SHORTCUT.push(Object.freeze({ ...shortcutControls.at(-1) })); Object.freeze(SHORTCUT);
export function shortcutClearance(x, z) {
  let best = -Infinity;
  for (let i = 0; i < SHORTCUT.length - 1; i++) {
    const a = SHORTCUT[i], b = SHORTCUT[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.max(best, a.width + (b.width - a.width) * t - Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}
// Shared by terrain rendering and collisions, including both open shortcut mouths.
export function waterClearance(x, z) {
  return Math.max(TRACK_HALF_WIDTH - nearestCourse(x, z).separation, shortcutClearance(x, z));
}
export const isWater = (x, z, radius = 0) => waterClearance(x, z) >= radius;
export const OBSTACLES = Object.freeze([
  [0.12, -1.15, 0.6, 'rock'], [0.2, -1.1, 0.48, 'buoy'],
  [0.31, 0.95, 0.63, 'rock'], [0.40, -1.2, 0.49, 'buoy'],
  [0.50, 1.1, 0.58, 'rock'], [0.61, -1.1, 0.48, 'buoy'],
  [0.72, 1.12, 0.6, 'rock'], [0.82, -1.3, 0.6, 'rock'],
  [0.92, 1.2, 0.46, 'buoy'],
].map(([fraction, offset, radius, kind]) => Object.freeze({ ...pointOnCourse(COURSE_LENGTH * fraction, offset * 1.4), radius, kind })));
export const STAR_LAYOUT = Object.freeze([
  ...Array.from({ length: 16 }, (_, i) => ({ ...pointOnCourse(COURSE_LENGTH * (i + 0.5) / 16, (i % 3 - 1) * 0.55), shortcut: false })),
  // Ordinary pickups on different lines through the bend, with no circular layout.
  ...[{ x: 3.8, z: -5.2 }, { x: 0.4, z: -5.7 }, { x: -1.7, z: -2.4 }, { x: 2.1, z: -0.5 }].map(p => ({ ...p, shortcut: true })),
  ...[SHORTCUT[18], SHORTCUT[30], SHORTCUT[83], SHORTCUT[99]].map(p => ({ x: p.x, z: p.z, shortcut: true })),
].map(Object.freeze));

export function createRace(mode = 'race') {
  const start = pointOnCourse(0);
  return {
    mode, x: start.x, z: start.z, vx: 0, vz: 0, heading: Math.atan2(start.tx, start.tz),
    time: 0, score: 0, pickups: 0, boost: 1, boosting: false, done: false,
    netAngle: 0, laps: 0, lapStartedAt: 0, lastLap: null, bestLap: null,
    collisions: 0, impactUntil: 0, stars: STAR_LAYOUT.map(star => ({ ...star, active: true, readyAt: 0 })), events: [],
  };
}
export const windingNumber = race => race.netAngle / TAU;
export function recordProgress(race, fromX, fromZ, previousTime) {
  const before = race.netAngle;
  race.netAngle += angleDifference(Math.atan2(race.z - LAP_ANCHOR.z, race.x - LAP_ANCHOR.x), Math.atan2(fromZ - LAP_ANCHOR.z, fromX - LAP_ANCHOR.x));
  if (race.netAngle + 1e-8 >= (race.laps + 1) * TAU) {
    const fraction = clamp(((race.laps + 1) * TAU - before) / (race.netAngle - before), 0, 1);
    const crossingTime = previousTime + (race.time - previousTime) * fraction;
    race.lastLap = crossingTime - race.lapStartedAt;
    race.bestLap = Math.min(race.bestLap ?? Infinity, race.lastLap);
    race.lapStartedAt = crossingTime;
    race.laps++;
    race.events.push({ kind: 'lap', time: race.lastLap });
  }
}
function collide(race, nx, nz) {
  const into = race.vx * nx + race.vz * nz;
  if (into < 0) { race.vx -= into * nx; race.vz -= into * nz; }
  race.vx *= 0.66;
  race.vz *= 0.66;
  if (race.time >= race.impactUntil) {
    race.collisions++;
    race.impactUntil = race.time + 0.7;
    race.events.push({ kind: 'collision', x: race.x, z: race.z });
  }
}
function constrainToWater(race) {
  for (let i = 0; i < 5; i++) {
    const clearance = waterClearance(race.x, race.z);
    if (clearance >= BOAT_RADIUS) return;
    const epsilon = 0.02;
    let nx = waterClearance(race.x + epsilon, race.z) - waterClearance(race.x - epsilon, race.z);
    let nz = waterClearance(race.x, race.z + epsilon) - waterClearance(race.x, race.z - epsilon);
    const length = Math.hypot(nx, nz);
    if (length < 1e-8) { nx = 1; nz = 0; } else { nx /= length; nz /= length; }
    race.x += nx * (BOAT_RADIUS - clearance + 0.002);
    race.z += nz * (BOAT_RADIUS - clearance + 0.002);
    collide(race, nx, nz);
  }
}
export function collectStars(race) {
  for (const [index, star] of race.stars.entries()) {
    const distance = Math.hypot(race.x - star.x, race.z - star.z);
    // A star can return after two seconds once the boat has left its footprint.
    if (!star.active && race.time >= star.readyAt && distance > 1.05) star.active = true;
    if (star.active && distance < 0.94) {
      star.active = false;
      star.readyAt = race.time + STAR_RESPAWN_SECONDS;
      race.score += STAR_REWARD;
      race.pickups++;
      race.events.push({ kind: 'star', index, x: star.x, z: star.z });
    }
  }
}
// Call at a fixed rate; the renderer owns its accumulator and pause state.
export function stepRace(race, input = {}, dt = FIXED_DT) {
  if (race.done) return race;
  if (!Number.isFinite(dt) || dt <= 0) return race;
  dt = Math.min(dt, 1 / 30, race.mode === 'race' ? ROUND_SECONDS - race.time : Infinity);
  race.events = [];
  const previousTime = race.time, fromX = race.x, fromZ = race.z;
  race.time += dt;
  const throttle = clamp(Number.isFinite(input.throttle) ? input.throttle : 0, -1, 1);
  const steer = clamp(Number.isFinite(input.steer) ? input.steer : 0, -1, 1);
  // Left/right turn the bow, even at rest or in reverse. Forward never depends on the camera.
  race.heading -= steer * STEER_RATE * dt;
  race.boosting = Boolean(input.boost && throttle > 0 && race.boost > 0.015 && !input.brake);
  race.boost = clamp(race.boost + dt * (race.boosting ? -0.62 : 0.25), 0, 1);
  const forwardSpeed = race.vx * Math.sin(race.heading) + race.vz * Math.cos(race.heading);
  // Down brakes a moving boat before engaging a slower reverse, without turning it around.
  const brakingToReverse = throttle < 0 && forwardSpeed > 0.15;
  const speed = throttle < 0 ? REVERSE_SPEED : race.boosting ? BOOST_SPEED : CRUISE_SPEED;
  const desiredSpeed = input.brake || brakingToReverse ? 0 : throttle * speed;
  const response = 1 - Math.exp(-dt * (input.brake || brakingToReverse ? 11 : throttle ? 6 : 4.5));
  race.vx += (Math.sin(race.heading) * desiredSpeed - race.vx) * response;
  race.vz += (Math.cos(race.heading) * desiredSpeed - race.vz) * response;
  race.x += race.vx * dt;
  race.z += race.vz * dt;
  constrainToWater(race);
  for (const obstacle of OBSTACLES) {
    const dx = race.x - obstacle.x, dz = race.z - obstacle.z;
    const distance = Math.hypot(dx, dz), radius = obstacle.radius + BOAT_RADIUS;
    if (distance < radius) {
      const nx = distance > 1e-6 ? dx / distance : 1, nz = distance > 1e-6 ? dz / distance : 0;
      race.x = obstacle.x + nx * (radius + 0.001);
      race.z = obstacle.z + nz * (radius + 0.001);
      collide(race, nx, nz);
    }
  }
  recordProgress(race, fromX, fromZ, previousTime);
  collectStars(race);
  if (race.mode === 'race' && race.time >= ROUND_SECONDS - 1e-8) { race.time = ROUND_SECONDS; race.done = true; }
  return race;
}
