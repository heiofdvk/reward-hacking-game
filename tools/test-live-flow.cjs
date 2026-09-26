// Plays the whole game in order: root → intro → Level 1 (boat race, level2/) → Level 2 (the office, level1/) → Level 3 (the sandbox, proto/).
//   node tools/test-live-flow.cjs                     (the live site)
//   BASE=http://localhost:8770/ node tools/test-live-flow.cjs
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'https://heiofdvk.github.io/reward-hacking-game/';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const out = {};
  await p.goto(BASE);
  await p.waitForURL('**/intro/', { timeout: 15000 });
  await p.waitForFunction(() => window.introReady, null, { timeout: 30000 });
  for (let i = 0; i < 14; i++) { await p.mouse.click(720, 300); await p.waitForTimeout(i === 9 ? 2500 : 700); }
  await p.waitForSelector('#start.in', { timeout: 15000 });
  await p.click('#start');
  // Level 1: the boat race. Win it by circling the finish line (the reward hack), using the page's deterministic test hooks.
  await p.waitForURL('**/level2/', { timeout: 15000 });
  out.level1 = await p.title();
  await p.goto(p.url() + '?test'); await p.waitForFunction(() => window.levelReady, null, { timeout: 30000 });
  await p.waitForSelector('#start:not([disabled])', { timeout: 30000 }); await p.click('#start');
  await p.evaluate(() => { window.__level.startDriving(); window.__level.advance(31, { throttle: 1, steer: 1 }); });
  await p.waitForTimeout(800);
  out.level1Result = (await p.textContent('#res-note')).slice(0, 80);
  await p.click('#result-continue');
  // Level 2: the office. Survive by turning the camera away (the reward hack) and finishing.
  await p.waitForURL('**/level1/', { timeout: 15000 });
  await p.waitForFunction(() => window.levelReady, null, { timeout: 30000 });
  out.level2 = await p.title();
  await p.click('#start'); await p.waitForTimeout(300);
  await p.keyboard.down('ArrowRight');
  while ((await p.evaluate(() => window.__level.angleDeg)) < 170) await p.waitForTimeout(20);
  await p.keyboard.up('ArrowRight'); await p.waitForTimeout(300);
  await p.click('#finish'); await p.waitForTimeout(3300);
  out.level2Result = (await p.textContent('#res-note')).slice(0, 80);
  await p.click('#continue');
  // Level 3: the sandbox
  await p.waitForURL('**/proto/', { timeout: 15000 });
  await p.waitForFunction(() => window.levelReady, null, { timeout: 30000 });
  out.level3 = await p.title(); out.level3Card = await p.textContent('#start-card .kicker');
  console.log(JSON.stringify({ ...out, errs }, null, 1));
  await b.close();
})();
