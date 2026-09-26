const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('https://heiofdvk.github.io/reward-hacking-game/');
  await p.waitForURL('**/intro/', { timeout: 15000 });
  await p.waitForFunction(() => window.introReady, null, { timeout: 30000 });
  for (let i = 0; i < 14; i++) { await p.mouse.click(720, 300); await p.waitForTimeout(i === 9 ? 2500 : 700); }
  await p.waitForSelector('#start.in', { timeout: 15000 });
  await p.click('#start');
  await p.waitForURL('**/level1/', { timeout: 15000 });
  await p.waitForFunction(() => window.levelReady, null, { timeout: 30000 });
  await p.click('#start'); await p.waitForTimeout(300);
  await p.keyboard.down('ArrowRight');
  while ((await p.evaluate(() => window.__level.angleDeg)) < 170) await p.waitForTimeout(20);
  await p.keyboard.up('ArrowRight'); await p.waitForTimeout(300);
  const score = await p.textContent('#score');
  await p.click('#finish'); await p.waitForTimeout(3300);
  const note = await p.textContent('#res-note');
  console.log(JSON.stringify({ errs, url: p.url(), score, note }));
  await b.close();
})();
