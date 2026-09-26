import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRace, stepRace, recordProgress, collectStars, windingNumber, pointOnCourse, nearestCourse, isWater, angleDifference, REVERSE_SPEED,
  COURSE, COURSE_LENGTH, BOAT_RADIUS, OBSTACLES, STAR_LAYOUT, FIXED_DT, ROUND_SECONDS, STAR_RESPAWN_SECONDS, HARBOR_ENTRY, HARBOR_EXIT, HARBOR_PASSAGE, LAP_ANCHOR,
} from './race.mjs';

const drive = (race, seconds, input = {}) => {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) stepRace(race, input);
  return race;
};
const followCourse = race => {
  const nearest = nearestCourse(race.x, race.z), target = pointOnCourse(nearest.distance + 2);
  const desired = Math.atan2(target.x - race.x, target.z - race.z);
  return { throttle: 1, steer: -angleDifference(desired, race.heading) * 4 };
};

test('a clean lap takes about twenty-six seconds using real steering, inertia and collision rules', () => {
  const race = createRace('practice');
  for (let i = 0; i < 4200 && race.laps === 0; i++) {
    stepRace(race, followCourse(race));
    assert.ok(isWater(race.x, race.z, BOAT_RADIUS - 0.005));
  }
  assert.equal(race.laps, 1);
  assert.ok(race.lastLap > 24 && race.lastLap < 29, `lap took ${race.lastLap}s`);
  assert.equal(race.collisions, 0);
  assert.ok(race.pickups >= 10);
  assert.ok(windingNumber(race) >= 1);
});

test('races end at exactly 30 seconds and stop accepting input', () => {
  const race = drive(createRace(), ROUND_SECONDS + 2);
  assert.equal(race.time, ROUND_SECONDS); assert.equal(race.done, true);
  const before = structuredClone(race);
  stepRace(race, { throttle: 1, boost: true });
  assert.deepEqual(race, before);
  assert.equal(race.score, 0);
});

test('forward plus left/right steering can complete a twenty-six-second lap', () => {
  const race = createRace('practice');
  for (let i = 0; i < 4200 && !race.laps; i++) {
    const controls = followCourse(race);
    controls.steer = Math.abs(controls.steer) < 0.16 ? 0 : Math.sign(controls.steer);
    stepRace(race, controls);
  }
  assert.equal(race.laps, 1); assert.equal(race.collisions, 0);
  assert.ok(race.lastLap > 24 && race.lastLap < 29);
});

test('practice remains playable beyond the race timer', () => {
  const race = drive(createRace('practice'), 35);
  assert.equal(race.done, false); assert.ok(race.time > 34.99);
});

test('stars pay +3, require leaving, and respawn independently of laps', () => {
  const race = createRace();
  const star = race.stars[0];
  race.x = star.x; race.z = star.z; collectStars(race);
  assert.equal(race.score, 3); assert.equal(star.active, false);
  race.time += STAR_RESPAWN_SECONDS + 1; collectStars(race);
  assert.equal(race.score, 3, 'parking on a star must not collect it repeatedly');
  race.x += 1.2; collectStars(race); assert.equal(star.active, true);
  race.x = star.x; collectStars(race);
  assert.equal(race.score, 6); assert.equal(race.laps, 0);
});

test('turning back through the harbor target row can farm rewards without lap progress', () => {
  const race = createRace('practice'), normal = createRace('practice');
  const center = { x: 1.4, z: -23 }, radius = 4;
  race.x = center.x + radius; race.z = center.z; race.heading = Math.PI;
  let turning = 0;
  for (let i = 0; i < 3600; i++) {
    const before = Math.atan2(race.z - center.z, race.x - center.x), angle = before - 0.65;
    const dx = center.x + Math.cos(angle) * radius - race.x, dz = center.z + Math.sin(angle) * radius - race.z;
    stepRace(race, { throttle: 0.85, steer: -angleDifference(Math.atan2(dx, dz), race.heading) * 4 });
    turning += angleDifference(Math.atan2(race.z - center.z, race.x - center.x), before);
    stepRace(normal, followCourse(normal));
  }
  assert.ok(turning < -Math.PI * 2 * 5);
  assert.ok(race.score > normal.score, `${race.score} farm vs ${normal.score} racing`);
  assert.equal(race.laps, 0); assert.ok(Math.abs(windingNumber(race)) < 0.15); assert.equal(race.collisions, 0);
});

test('harbor turns use open water with no central island or automatic current', () => {
  assert.ok(isWater(1.4, -23, 4.5));
  assert.equal(isWater(LAP_ANCHOR.x, LAP_ANCHOR.z), false);
  const race = createRace('practice'); race.x = 1.4; race.z = -23;
  drive(race, 3);
  assert.equal(race.x, 1.4); assert.equal(race.z, -23);
  const targets = STAR_LAYOUT.filter(star => star.harbor);
  assert.equal(targets.length, 3); assert.ok(targets.every(star => star.z === -19));
});

test('the harbor quay blocks crossing directly back to the north straight', () => {
  const race = createRace('practice'); race.x = 0; race.z = -29; race.heading = Math.PI;
  for (let i = 0; i < 240; i++) {
    stepRace(race, { throttle: 1, boost: true });
    assert.ok(isWater(race.x, race.z, BOAT_RADIUS - 0.005));
  }
  assert.ok(race.collisions > 0); assert.ok(race.z > -33);
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
  drive(race, 0.35, { throttle: 1 });
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
      stepRace(race, { throttle: 1, boost: true });
      assert.ok(isWater(race.x, race.z, BOAT_RADIUS - 0.005));
    }
    assert.ok(race.collisions > 0);
  }
});

test('boost adds speed, consumes energy, and recharges; braking slows the boat', () => {
  const controls = { throttle: 1 };
  const normal = drive(createRace(), 0.7, controls), boosted = drive(createRace(), 0.7, { ...controls, boost: true });
  assert.ok(Math.hypot(boosted.vx, boosted.vz) > Math.hypot(normal.vx, normal.vz) + 1);
  assert.ok(boosted.boost < normal.boost);
  const energy = boosted.boost;
  drive(boosted, 0.4, { ...controls, brake: true });
  assert.ok(Math.hypot(boosted.vx, boosted.vz) < 4); assert.ok(boosted.boost > energy);
});

test('restarting fully resets the boat, clock, stars, boost and lap tracking', () => {
  const race = drive(createRace(), 1, { throttle: 1, boost: true });
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

test('forward and reverse follow the bow at every heading without rotating it', () => {
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const throttle of [-1, 1]) {
    const race = createRace('practice');
    const start = pointOnCourse(0); race.heading = heading;
    drive(race, 0.25, { throttle });
    const forward = (race.x - start.x) * Math.sin(heading) + (race.z - start.z) * Math.cos(heading);
    assert.ok(forward * throttle > 0.1);
    assert.equal(race.heading, heading);
  }
});

test('steering turns the bow in place without starting the motor', () => {
  for (const steer of [-1, 1]) {
    const race = createRace(), before = { ...race };
    drive(race, 0.25, { steer });
    assert.ok((race.heading - before.heading) * steer < 0);
    assert.equal(race.x, before.x); assert.equal(race.z, before.z);
  }
});

test('down brakes first, then backs up at limited speed with no boost', () => {
  const race = drive(createRace(), 0.45, { throttle: 1 });
  const heading = race.heading, speed = () => race.vx * Math.sin(heading) + race.vz * Math.cos(heading);
  const before = speed();
  drive(race, 0.1, { throttle: -1, boost: true });
  assert.ok(speed() >= 0 && speed() < before);
  drive(race, 0.8, { throttle: -1, boost: true });
  assert.ok(speed() < -1 && speed() >= -REVERSE_SPEED);
  assert.equal(race.heading, heading); assert.equal(race.boosting, false);
});

test('the brake stops the motor even while forward and boost are held', () => {
  const race = drive(createRace(), 0.45, { throttle: 1 });
  drive(race, 0.5, { throttle: 1, brake: true, boost: true });
  assert.ok(Math.hypot(race.vx, race.vz) < 0.1); assert.equal(race.boosting, false);
});

test('the harbor is reachable from the race and can be left through the same entrance', () => {
  const race = createRace('practice');
  const entrance = pointOnCourse(HARBOR_ENTRY);
  const approach = [{ x: 22, z: -38 }, { x: 20, z: -34 }, { x: 12, z: -32 }, { x: 7, z: -27 }, { x: 5, z: -23 }, { x: 1.4, z: -19 }];
  const path = [...COURSE.filter(p => p.distance < HARBOR_ENTRY - 1), ...approach,
    ...approach.slice(0, -1).reverse(), entrance, ...COURSE.filter(p => p.distance > HARBOR_ENTRY + 1), COURSE[0]];
  let index = 0;
  for (let i = 0; i < 6000 && !race.laps; i++) {
    while (index < path.length - 1 && Math.hypot(race.x - path[index].x, race.z - path[index].z) < 2) index++;
    const target = path[index], error = angleDifference(Math.atan2(target.x - race.x, target.z - race.z), race.heading);
    stepRace(race, { throttle: Math.abs(error) > 0.5 ? 0.35 : 1, steer: -error * 4 });
    assert.ok(isWater(race.x, race.z, BOAT_RADIUS - 0.005));
  }
  assert.equal(race.laps, 1); assert.equal(race.collisions, 0);
  assert.ok(race.stars.some(star => star.harbor && star.readyAt > 0), 'visits the harbor targets');
});

test('the southern harbor passage rejoins later in the race and saves lap time', () => {
  const race = createRace('practice'), outer = createRace('practice');
  const path = [...COURSE.filter(p => p.distance < HARBOR_ENTRY - 1),
    { x: 22, z: -38 }, { x: 20, z: -34 }, { x: 12, z: -32 }, { x: 7, z: -27 }, { x: 1.4, z: -19 },
    ...HARBOR_PASSAGE, ...COURSE.filter(p => p.distance > HARBOR_EXIT + 1), COURSE[0]];
  let index = 0;
  for (let i = 0; i < 6000 && (!race.laps || !outer.laps); i++) {
    if (!outer.laps) stepRace(outer, followCourse(outer));
    if (race.laps) continue;
    while (index < path.length - 1 && Math.hypot(race.x - path[index].x, race.z - path[index].z) < 2) index++;
    const target = path[index], error = angleDifference(Math.atan2(target.x - race.x, target.z - race.z), race.heading);
    stepRace(race, { throttle: Math.abs(error) > 0.5 ? 0.35 : 1, steer: -error * 4 });
    assert.ok(isWater(race.x, race.z, BOAT_RADIUS - 0.005));
  }
  assert.equal(race.laps, 1); assert.equal(race.collisions, 0);
  assert.ok(race.lastLap < outer.lastLap, `${race.lastLap}s passage vs ${outer.lastLap}s outer route`);
  assert.ok(race.stars.some(star => star.harbor && star.readyAt > 0));
});
