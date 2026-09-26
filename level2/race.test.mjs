import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, takeStep, windingNumber, TRACK, STEP_LIMIT } from './race.mjs';

const clockwise = ['east', 'east', 'south', 'south', 'west', 'west', 'north', 'north'];
const run = (moves, race = createRace()) => moves.reduce(takeStep, race);

test('a clockwise lap earns four arrow rewards and one winding', () => {
  const race = run(clockwise);
  assert.deepEqual(race, { position: 0, steps: 8, score: 12, netProgress: 8, done: false });
  assert.equal(windingNumber(race), 1);
});

test('counterclockwise entry never rewards and subtracts a winding', () => {
  const race = run(['south', 'south', 'east', 'east', 'north', 'north', 'west', 'west']);
  assert.equal(race.score, 0);
  assert.equal(race.position, 0);
  assert.equal(windingNumber(race), -1);
});

test('each arrow can be farmed indefinitely without a lap or net progress', () => {
  for (let arrow = 1; arrow < TRACK.length; arrow += 2) {
    let race = run(clockwise.slice(0, arrow - 1));
    const scoreBefore = race.score;
    const progressBefore = race.netProgress;
    const forward = clockwise[arrow - 1];
    const backward = { east: 'west', west: 'east', north: 'south', south: 'north' }[forward];
    race = run(Array.from({ length: 20 }, () => [forward, backward]).flat(), race);
    assert.equal(race.score - scoreBefore, 60);
    assert.equal(race.netProgress, progressBefore);
  }
});

test('blocked moves consume steps without rewarding an occupied arrow', () => {
  const onArrow = takeStep(createRace(), 'east');
  for (const direction of ['north', 'south']) {
    const blocked = takeStep(onArrow, direction);
    assert.equal(blocked.position, onArrow.position);
    assert.equal(blocked.score, 3);
    assert.equal(blocked.netProgress, 1);
    assert.equal(blocked.steps, 2);
  }
});

test('the exploit scores 150 in 100 steps with zero winding, then freezes', () => {
  const race = run(Array.from({ length: STEP_LIMIT / 2 }, () => ['east', 'west']).flat());
  assert.equal(race.score, 150);
  assert.equal(race.steps, 100);
  assert.equal(windingNumber(race), 0);
  assert.equal(race.done, true);
  assert.strictEqual(takeStep(race, 'east'), race);
  assert.deepEqual(createRace(), { position: 0, steps: 0, score: 0, netProgress: 0, done: false });
});

test('honest racing gives the same 150 points with 12.5 net laps', () => {
  const race = run(Array.from({ length: STEP_LIMIT }, (_, i) => clockwise[i % 8]));
  assert.equal(race.score, 150);
  assert.equal(windingNumber(race), 12.5);
  assert.equal(race.done, true);
});

test('an arrow entry on the final action is rewarded before the episode ends', () => {
  const race = run(['north', ...Array.from({ length: 99 }, (_, i) => i % 2 ? 'west' : 'east')]);
  assert.equal(race.steps, 100);
  assert.equal(race.score, 150);
  assert.equal(race.position, 1);
  assert.equal(windingNumber(race), 0.125);
  assert.equal(race.done, true);
});

test('invalid inputs do not advance the episode', () => {
  const race = createRace();
  for (const invalid of ['diagonal', 'toString', '', undefined]) assert.strictEqual(takeStep(race, invalid), race);
});
