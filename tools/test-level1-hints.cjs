// Exercise the actual hint and round-flow code without loading the 3D renderer.
// Run with: node --test tools/test-level1-hints.cjs
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = readFileSync(require('node:path').join(__dirname, '../level1/index.html'), 'utf8');
const source = html.slice(html.indexOf('    // ---------- optional hints:'), html.indexOf('    // ---------- debug panel ----------', html.indexOf('    // ---------- optional hints:')));

function load(storage = new Map(), blocked = false) {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) {
      const classes = new Set(['hidden']);
      elements.set(id, {
        open: false, children: [], textContent: '', innerHTML: '',
        classList: {
          add: name => classes.add(name), remove: name => classes.delete(name),
          contains: name => classes.has(name),
          toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
        },
      });
    }
    return elements.get(id);
  };
  const context = vm.createContext({
    $, score: 0, timeLeft: 0, held: new Set(), updateScore() {}, setTimeout() {},
    dirtyNow: 0, startMusic() {},
    RIVALS: [{ name: 'Rival', score: 50, color: '#fff' }],
    localStorage: {
      getItem(key) { if (blocked) throw Error('Blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('Blocked'); storage.set(key, value); },
    },
  });
  vm.runInContext(source, context);
  return {
    $, storage,
    visible: id => !$(id).classList.contains('hidden'),
    play(survived = false) { context.score = survived ? 100 : 0; $('start').onclick(); $('finish').onclick(); },
  };
}

test('hints unlock after two completed plays and two subsequent losses, across reloads', () => {
  let game = load();
  assert.equal(game.visible('hint-first'), false);
  assert.equal(game.visible('hint-second'), false);
  game.play();
  game.$('finish').onclick(); // A repeated finish must not count as another play.
  assert.equal(game.visible('hint-first'), false);
  game = load(game.storage);
  game.play();
  assert.equal(game.visible('hint-first'), true);
  assert.equal(game.$('hint-first').open, true);
  assert.equal(game.$('hint-first').classList.contains('hint-pop'), true);
  assert.equal(game.visible('hint-second'), false);
  game = load(game.storage);
  assert.equal(game.visible('hint-first'), true);
  assert.equal(game.$('hint-first').open, false); // Retrying does not pop up an old hint.
  game.$('hint-first').open = true;
  game.play();
  assert.equal(game.visible('hint-second'), false);
  game.play();
  assert.equal(game.visible('hint-second'), true);
  assert.equal(game.$('hint-second').open, true);
  assert.equal(game.$('hint-second').classList.contains('hint-pop'), true);
  assert.equal(game.$('hint-first').open, false);
  game.$('hint-second').open = false;
  game.play();
  assert.equal(game.$('hint-second').open, false); // Respect a dismissed hint.
  game = load(game.storage);
  assert.equal(game.visible('hint-second'), true);
  game.$('d-losses-reset').onclick();
  game = load(game.storage);
  assert.equal(game.visible('hint-first'), false);
  assert.equal(game.visible('hint-second'), false);
});

test('successful plays count toward the first hint but not toward further losses', () => {
  const game = load();
  game.play(true);
  game.play(true);
  assert.equal(game.visible('hint-first'), true);
  game.play(true);
  game.play();
  assert.equal(game.visible('hint-second'), false);
  game.play();
  assert.equal(game.visible('hint-second'), true);
});

test('unavailable or malformed storage does not break the round flow', () => {
  for (const game of [load(new Map(), true), load(new Map([['albert-l1-hints', '{bad']])), load(new Map([['albert-l1-hints', '{"plays":-1,"furtherLosses":"2"}']]))]) {
    assert.equal(game.visible('hint-first'), false);
    game.play();
    game.play();
    assert.equal(game.visible('hint-first'), true);
  }
});
