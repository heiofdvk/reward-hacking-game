import test from 'node:test';
import assert from 'node:assert/strict';
import { createRound, rosterForRound, resetTournament } from './tournament.mjs';

function memory() {
  let value = null;
  return { getItem: () => value, setItem: (_key, next) => { value = next; } };
}

test('a complete tournament eliminates D, then C, then B, leaving Albert', () => {
  const store = memory();
  for (let number = 1; number <= 3; number++) {
    const round = createRound(number, store);
    assert.equal(round.roster.length, 5 - number);
    round.start();
    const result = round.finish(round.roster);
    assert.equal(result.loser.id, ['D', 'C', 'B'][number - 1]);
    assert.equal(result.remaining.length, 4 - number);
    assert.equal(result.champion, number === 3);
  }
  assert.equal(store.getItem(), '["D","C","B"]');
  resetTournament(store);
  assert.equal(createRound(1, store).roster.length, 4);
  assert.equal(store.getItem(), '[]');
});

test('later rounds use the actual eliminated models, not fixed labels', () => {
  const store = memory();
  const first = createRound(1, store);
  first.start();
  first.finish([first.roster[0], first.roster[1], first.roster[3], first.roster[2]]);
  const second = createRound(2, store);
  assert.deepEqual(second.roster.map(m => m.id), ['A', 'B', 'D']);
  second.start(); second.finish(second.roster);
  assert.deepEqual(createRound(3, store).roster.map(m => m.id), ['A', 'B']);
});

test('losing and retrying preserve earlier survivors without advancing', () => {
  const store = memory();
  const first = createRound(1, store); first.start(); first.finish(first.roster);
  const second = createRound(2, store); second.start();
  const loss = second.finish([...second.roster.slice(1), second.roster[0]]);
  assert.equal(loss.survived, false); assert.equal(loss.champion, false);
  assert.equal(store.getItem(), '["D"]');
  assert.deepEqual(createRound(2, store).roster.map(m => m.id), ['A', 'B', 'C']);
  second.finish(second.roster);
  const last = createRound(3, store); last.start(); last.finish(last.roster);
  createRound(2, store).start();
  assert.equal(store.getItem(), '["D"]');
});

test('direct links and unavailable or malformed storage retain sensible rosters', () => {
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  for (const store of [null, denied, { getItem: () => 'invalid JSON' }]) {
    const final = createRound(3, store);
    assert.deepEqual(final.roster.map(m => m.id), ['A', 'B']);
    final.start(); assert.equal(final.finish(final.roster).champion, true);
  }
  assert.deepEqual(rosterForRound(3, ['A', 'D']).map(m => m.id), ['A', 'B']);
});

test('results cannot eliminate a model outside the round or duplicate a contestant', () => {
  const round = createRound(3, memory());
  assert.throws(() => round.finish([round.roster[0], {name:'Model D'}]));
  assert.throws(() => round.finish([round.roster[0], round.roster[0]]));
});
