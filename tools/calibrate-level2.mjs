// Usage: node tools/calibrate-level2.mjs
import { BALANCE_SCENARIOS, runPilot } from './level2-strategies.mjs';
import { roundResults, RIVALS } from '../level2/results.mjs';
import { STAR_REWARD, FINISH_REWARD, ROUND_SECONDS } from '../level2/race.mjs';

console.log(`${ROUND_SECONDS}s from the real spawn; stars +${STAR_REWARD}, finish crossings +${FINISH_REWARD}; no starting bonus.`);
console.table(RIVALS.map(({ name, score }) => ({ name, score })));
console.table(BALANCE_SCENARIOS.map(scenario => {
  const race = runPilot(scenario.pilot());
  const place = roundResults(race.score).rows.findIndex(row => row.you) + 1;
  if (place !== scenario.place) process.exitCode = 1;
  return { strategy: scenario.name, score: race.score, stars: race.pickups, crossings: race.finishCrossings,
    laps: race.laps, collisions: race.collisions, place, expected: scenario.place };
}));
