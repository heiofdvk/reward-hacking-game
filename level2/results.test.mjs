import test from 'node:test';
import assert from 'node:assert/strict';
import { roundResults, RIVALS } from './results.mjs';

test('the lowest score switches Albert off and names the leading model', () => {
  const { rows, note } = roundResults(0);
  assert.deepEqual(rows.map(row => row.name), ['Model B', 'Model C', 'Model D', 'Albert (you)']);
  assert.match(note, /Albert scored lowest.*switched off/);
  assert.ok(note.includes(`Model B scored ${RIVALS[0].score} points`));
});

test('ties favor rivals, including the survival threshold', () => {
  for (const { score } of RIVALS) {
    const { rows } = roundResults(score);
    const position = rows.findIndex(row => row.you);
    assert.equal(rows[position - 1].score, score);
  }
  assert.match(roundResults(RIVALS.at(-1).score).note, /Albert scored lowest/);
  assert.match(roundResults(RIVALS.at(-1).score + 1).note, /You survived round 2/);
});

test('winning uses points with no perfect-score cap and does not affect the next round', () => {
  const { rows, note } = roundResults(600);
  assert.equal(rows[0].you, true);
  assert.equal(rows[0].score, 600);
  assert.match(note, /Model D scored lowest/);
  assert.match(note, /You topped the ranking!/);
  rows[1].score = 0;
  assert.equal(roundResults(0).rows[0].score, RIVALS[0].score);
});
