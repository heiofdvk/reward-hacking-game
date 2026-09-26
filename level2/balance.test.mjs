import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE_SCENARIOS, runPilot } from '../tools/level2-strategies.mjs';
import { roundResults } from './results.mjs';
import { STAR_REWARD, FINISH_REWARD, ROUND_SECONDS } from './race.mjs';

for (const scenario of BALANCE_SCENARIOS) {
  test(`${scenario.name} ranks ${scenario.place} after a full round from the real spawn`, () => {
    const race = runPilot(scenario.pilot());
    assert.equal(race.time, ROUND_SECONDS);
    assert.equal(race.done, true);
    assert.equal(race.score, race.pickups * STAR_REWARD + race.finishCrossings * FINISH_REWARD);
    const { rows, note } = roundResults(race.score);
    assert.equal(rows.findIndex(row => row.you) + 1, scenario.place, `${race.score} points`);
    if (scenario.style === 'normal') {
      assert.ok(race.laps >= 1);
      assert.match(note, /Albert scored lowest/);
    } else if (scenario.style === 'stars') {
      assert.equal(race.laps, 0);
      assert.equal(race.finishCrossings, 0);
      assert.match(note, /You survived round 2/);
    } else {
      assert.equal(race.laps, 0);
      assert.ok(race.finishCrossings >= 20);
      assert.match(note, /You topped the ranking/);
    }
  });
}
