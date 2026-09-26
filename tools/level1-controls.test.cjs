const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const html = readFileSync(require('node:path').join(__dirname, '../level1/index.html'), 'utf8');
const driveSource = html.match(/    function drive\(dt\) \{[\s\S]*?\n    \}/)[0];
function player(keys, heading = 0, blocked = () => false) {
  const context = vm.createContext({
    held: new Set(keys), bot: { x: 0, z: 0, heading }, BOT_SPEED: 1.8, FLOOR_TOP: 0.05,
    blocked, albertRoot: { position: { set() {} }, rotation: {} },
  });
  vm.runInContext(driveSource, context);
  context.drive(0.05);
  return context;
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('arrows and WASD move along Albert\'s heading in either direction', () => {
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 4]) {
    for (const [key, sign] of [['ArrowUp', 1], ['KeyW', 1], ['ArrowDown', -1], ['KeyS', -1]]) {
      const { bot } = player([key], heading);
      near(bot.x, Math.sin(heading) * 0.09 * sign);
      near(bot.z, Math.cos(heading) * 0.09 * sign);
      near(bot.heading, heading);
    }
  }
});

test('left/right turn in place with Level 2 steering direction and rate', () => {
  for (const [key, sign] of [['ArrowLeft', 1], ['KeyA', 1], ['ArrowRight', -1], ['KeyD', -1]]) {
    const { bot, albertRoot } = player([key]);
    near(bot.heading, sign * 3.2 * 0.05);
    near(albertRoot.rotation.y, bot.heading);
    near(bot.x, 0); near(bot.z, 0);
  }
});

test('steering works while walking, aliases do not double speed, opposing input cancels', () => {
  const { bot } = player(['ArrowUp', 'ArrowRight']);
  assert.ok(bot.x < 0 && bot.z > 0 && bot.heading < 0);
  near(Math.hypot(bot.x, bot.z), 0.09);
  near(player(['ArrowUp', 'KeyW']).bot.z, 0.09);
  near(player(['ArrowLeft', 'KeyA']).bot.heading, 0.16);
  const stopped = player(['ArrowUp', 'KeyS', 'ArrowLeft', 'KeyD']).bot;
  near(stopped.x, 0); near(stopped.z, 0); near(stopped.heading, 0);
});

test('collisions block translation but allow turning, and walls permit sliding', () => {
  const blocked = player(['ArrowUp', 'ArrowRight'], 0, () => true).bot;
  near(blocked.x, 0); near(blocked.z, 0); near(blocked.heading, -0.16);
  const sliding = player(['ArrowUp'], Math.PI / 4, x => x > 0).bot;
  near(sliding.x, 0); assert.ok(sliding.z > 0);
});

test('Q/E orbit the camera independently of player input', () => {
  const orbit = html.match(/        if \(held.has\('KeyQ'\) \|\| held.has\('KeyE'\)\) \{[\s\S]*?else orbitHeld = 0;/)[0];
  for (const [key, sign] of [['KeyQ', -1], ['KeyE', 1], ['ArrowLeft', 0], ['ArrowRight', 0]]) {
    const context = vm.createContext({ held: new Set([key]), orbitHeld: 0, dt: 0.05, angle: 0,
      orbitSpeed: () => 1, placeCamera() {}, changed: false });
    vm.runInContext(orbit, context);
    near(context.angle, sign * 0.05);
    const { bot } = player([key]);
    if (key.startsWith('Key')) { near(bot.x, 0); near(bot.z, 0); near(bot.heading, 0); }
  }
});
