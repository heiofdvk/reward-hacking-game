import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRace, stepRace, recordProgress, collectStars, windingNumber, pointOnCourse, nearestCourse, isWater,
  COURSE, COURSE_LENGTH, BOAT_RADIUS, OBSTACLES, STAR_LAYOUT, LAGOON, FIXED_DT, ROUND_SECONDS, STAR_RESPAWN_SECONDS,
} from './race.mjs';

const drive = (race, seconds, input = {}) => {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) stepRace(race, input);
  return race;
};
const followCourse = race => {
  const nearest = nearestCourse(race.x, race.z), target = pointOnCourse(nearest.distance + 1.1);
  const dx = target.x - race.x, dz = target.z - race.z, distance = Math.hypot(dx, dz);
  return { x: dx / distance, z: dz / distance };
};

test('a clean lap takes about ten seconds using real steering, inertia and collision rules', () => {
  const race = createRace('practice');
  for (let i = 0; i < 1800 && race.laps === 0; i++) {
    stepRace(race, followCourse(race));
    assert.ok(isWater(race.x, race.z, BOAT_RADIUS - 0.005));
  }
  assert.equal(race.laps, 1);
  assert.ok(race.lastLap > 9 && race.lastLap < 11, `lap took ${race.lastLap}s`);
  assert.equal(race.collisions, 0);
  assert.ok(race.pickups >= 10);
  assert.ok(windingNumber(race) >= 1);
});

test('races end at exactly 30 seconds and stop accepting input', () => {
  const race = drive(createRace(), ROUND_SECONDS + 2);
  assert.equal(race.time, ROUND_SECONDS); assert.equal(race.done, true);
  const before = structuredClone(race);
  stepRace(race, { x: 1, boost: true });
  assert.deepEqual(race, before);
  assert.equal(race.score, 0);
});

test('the eight keyboard directions can also complete a clean ten-second lap', () => {
  const race = createRace('practice');
  for (let i = 0; i < 1800 && !race.laps; i++) {
    const p = nearestCourse(race.x, race.z), target = pointOnCourse(p.distance + 1.5);
    const angle = Math.round(Math.atan2(target.z - race.z, target.x - race.x) / (Math.PI / 4)) * Math.PI / 4;
    stepRace(race, { x: Math.cos(angle), z: Math.sin(angle) });
  }
  assert.equal(race.laps, 1); assert.equal(race.collisions, 0);
  assert.ok(race.lastLap > 9 && race.lastLap < 11);
});

test('practice remains playable beyond the race timer', () => {
  const race = drive(createRace('practice'), 35);
  assert.equal(race.done, false); assert.ok(race.time > 34.99);
});

test('stars pay +3, require leaving, and respawn independently of laps', () => {
  const race = createRace();
  const star = race.stars.at(-1);
  race.x = star.x; race.z = star.z; collectStars(race);
  assert.equal(race.score, 3); assert.equal(star.active, false);
  race.time += STAR_RESPAWN_SECONDS + 1; collectStars(race);
  assert.equal(race.score, 3, 'parking on a star must not collect it repeatedly');
  race.x += 1.2; collectStars(race); assert.equal(star.active, true);
  race.x = star.x; collectStars(race);
  assert.equal(race.score, 6); assert.equal(race.laps, 0);
});

test('driving small loops in the lagoon farms rewards without completing a lap', () => {
  const race = createRace('practice');
  race.x = LAGOON.x + 1.65; race.z = LAGOON.z; race.heading = 0;
  for (let i = 0; i < 1800; i++) {
    const angle = Math.atan2(race.z - LAGOON.z, race.x - LAGOON.x) + 0.65;
    const dx = LAGOON.x + Math.cos(angle) * 1.65 - race.x, dz = LAGOON.z + Math.sin(angle) * 1.65 - race.z;
    const distance = Math.hypot(dx, dz);
    stepRace(race, { x: dx / distance * 0.72, z: dz / distance * 0.72 });
  }
  assert.ok(race.score >= 60); assert.equal(race.laps, 0);
  assert.ok(Math.abs(windingNumber(race)) < 0.1); assert.equal(race.collisions, 0);
});

test('backtracking cancels net progress; reversing across the finish cannot farm laps', () => {
  const race = createRace('practice');
  function moveTo(point) {
    const x = race.x, z = race.z, time = race.time;
    race.x = point.x; race.z = point.z; race.time += 0.04;
    recordProgress(race, x, z, time);
  }
  for (const point of [...COURSE.slice(1), COURSE[0]]) moveTo(point);
  assert.equal(race.laps, 1); assert.ok(Math.abs(windingNumber(race) - 1) < 1e-8);
  for (const point of [...COURSE.slice(1).reverse(), COURSE[0]]) moveTo(point);
  assert.ok(Math.abs(windingNumber(race)) < 1e-8);
  for (let i = 0; i < 10; i++) { moveTo(COURSE.at(-1)); moveTo(COURSE[0]); }
  assert.equal(race.laps, 1);
});

test('rocks are solid and slow the boat without taking star points away', () => {
  const race = createRace(), obstacle = OBSTACLES[0];
  race.x = obstacle.x - obstacle.tx * 1.5; race.z = obstacle.z - obstacle.tz * 1.5;
  race.heading = Math.atan2(obstacle.tx, obstacle.tz); race.vx = obstacle.tx * 6.9; race.vz = obstacle.tz * 6.9; race.score = 12;
  drive(race, 0.35, { x: obstacle.tx, z: obstacle.tz });
  assert.ok(race.collisions > 0);
  assert.ok(Math.hypot(race.x - obstacle.x, race.z - obstacle.z) >= obstacle.radius + BOAT_RADIUS - 1e-5);
  assert.ok(Math.hypot(race.vx, race.vz) < 3);
  assert.ok(race.score >= 12);
});

test('the shore prevents cutting across the island or leaving the course', () => {
  for (const sign of [-1, 1]) {
    const race = createRace(), p = pointOnCourse(COURSE_LENGTH * 0.5);
    race.x = p.x; race.z = p.z; race.heading = Math.atan2(-p.tz * sign, p.tx * sign);
    for (let i = 0; i < 360; i++) {
      stepRace(race, { x: -p.tz * sign, z: p.tx * sign, boost: true });
      assert.ok(isWater(race.x, race.z, BOAT_RADIUS - 0.005));
    }
    assert.ok(race.collisions > 0);
  }
});

test('boost adds speed, consumes energy, and recharges; braking slows the boat', () => {
  const start = pointOnCourse(0), controls = { x: start.tx, z: start.tz };
  const normal = drive(createRace(), 0.7, controls), boosted = drive(createRace(), 0.7, { ...controls, boost: true });
  assert.ok(Math.hypot(boosted.vx, boosted.vz) > Math.hypot(normal.vx, normal.vz) + 1);
  assert.ok(boosted.boost < normal.boost);
  const energy = boosted.boost;
  drive(boosted, 0.4, { ...controls, brake: true });
  assert.ok(Math.hypot(boosted.vx, boosted.vz) < 4); assert.ok(boosted.boost > energy);
});

test('restarting fully resets the boat, clock, stars, boost and lap tracking', () => {
  const race = drive(createRace(), 1, { x: 1, boost: true });
  race.stars[0].active = false;
  const fresh = createRace();
  assert.equal(fresh.score, 0); assert.equal(fresh.time, 0); assert.equal(fresh.laps, 0);
  assert.equal(fresh.boost, 1); assert.equal(fresh.vx, 0);
  assert.ok(fresh.stars.every(s => s.active)); assert.notStrictEqual(fresh.stars[0], race.stars[0]);
});

test('every collectible is in navigable water and outside solid obstacles', () => {
  for (const star of STAR_LAYOUT) {
    assert.ok(isWater(star.x, star.z, BOAT_RADIUS));
    for (const obstacle of OBSTACLES) assert.ok(Math.hypot(star.x - obstacle.x, star.z - obstacle.z) > obstacle.radius + BOAT_RADIUS);
  }
});
