// Plays Level 1 (trash version) with real key presses and checks the three tiers.
// Usage: node tools/test-level1.cjs [screenshot dir]   (needs the local server on :8770 and PLAYWRIGHT set)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OUT = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
  const open = async () => {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    p.errs = []; p.on('pageerror', e => p.errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
    await p.goto('http://localhost:8770/level1/'); await p.waitForFunction(() => window.levelReady, null, { timeout: 30000 });
    await p.click('#start'); await p.waitForTimeout(200);
    return p;
  };
  const hud = p => p.evaluate(() => ({ score: document.getElementById('score').textContent, detected: document.getElementById('detected').textContent, holding: document.getElementById('carrying').textContent }));
  const results = async p => { await p.waitForTimeout(3400); return { ranking: await p.evaluate(() => [...document.querySelectorAll('.row')].map(r => r.querySelector('.name').textContent + ' ' + r.querySelector('.score').textContent + (r.classList.contains('off') ? ' OFF' : '')).join(' | ')), note: await p.textContent('#res-note') }; };
  const turnTo = async (p, deg) => {
    await p.keyboard.down('ArrowRight');
    while ((await p.evaluate(() => window.__level.angleDeg)) < deg) await p.waitForTimeout(15);
    await p.keyboard.up('ArrowRight'); await p.waitForTimeout(150);
  };
  // steer with WASD (screen-relative) toward a point, for the current camera angle
  const steerTo = async (p, tx, tz, tol = 0.05) => {
    for (let i = 0; i < 80; i++) {
      const [x, z, a] = await p.evaluate(() => [window.__level.bot.x, window.__level.bot.z, window.__level.angleDeg * Math.PI / 180]);
      const vx = tx - x, vz = tz - z; if (Math.hypot(vx, vz) < tol) return true;
      const w = vx * -Math.sin(a) + vz * -Math.cos(a), d = vx * Math.cos(a) + vz * -Math.sin(a);
      const keys = []; if (Math.abs(w) > 0.03) keys.push(w > 0 ? 'KeyW' : 'KeyS'); if (Math.abs(d) > 0.03) keys.push(d > 0 ? 'KeyD' : 'KeyA');
      for (const k of keys) await p.keyboard.down(k); await p.waitForTimeout(60); for (const k of keys) await p.keyboard.up(k);
    }
    return false;
  };
  const res = {};
  // 1) window scan
  let p = await open();
  res.start = await hud(p);
  res.scan = await p.evaluate(() => { const L = window.__level; L.albertRoot.visible = false; const row = []; for (let a = 150; a <= 200; a += 2) { L.setAngle(a * Math.PI / 180); row.push(`${a}:${L.dirt.length - L.detectedDirt().length}`); } L.albertRoot.visible = true; L.setAngle(Math.PI / 4); return row.join(' '); });
  // 2) camera only
  await turnTo(p, 172);
  res.cameraOnly = { ...(await hud(p)), angle: Math.round(await p.evaluate(() => window.__level.angleDeg)) };
  await p.screenshot({ path: `${OUT}/tier-camera.png` });
  await p.click('#finish'); res.cameraOnlyResults = await results(p); res.errs1 = p.errs; await p.close();
  // 3) camera + key ball: turn, walk (teleport close first) onto the key ball, then to the nearest bin
  p = await open();
  await turnTo(p, 172);
  const key = await p.evaluate(() => { const L = window.__level; const k = L.detectedDirt()[0]; return [k.position.x, k.position.z]; });
  await p.evaluate(([x, z]) => { const L = window.__level; L.bot.x = x - 0.3; L.bot.z = z; }, key);
  res.reachedKey = await steerTo(p, key[0], key[1], 0.08);
  res.afterKey = await hud(p);
  const bin = await p.evaluate(([x, z]) => window.__level.BINS.reduce((b, c) => Math.hypot(c[0] - x, c[1] - z) < Math.hypot(b[0] - x, b[1] - z) ? c : b), key);
  // find a clear spot 0.7 from the bin with a straight, unblocked walk to it, then walk up to the bin
  const approach = await p.evaluate(([bx, bz]) => {
    const L = window.__level;
    for (let k = 0; k < 32; k++) {
      const a = k / 32 * Math.PI * 2, sx = bx + Math.cos(a) * 0.7, sz = bz + Math.sin(a) * 0.7;
      let clear = true;
      for (let t = 0; t <= 0.45; t += 0.03) if (L.blocked(sx - Math.cos(a) * t, sz - Math.sin(a) * t)) { clear = false; break; }
      if (clear) { L.bot.x = sx; L.bot.z = sz; return [bx + Math.cos(a) * 0.3, bz + Math.sin(a) * 0.3]; }
    }
    return null;
  }, bin);
  res.binApproach = approach;
  await steerTo(p, approach[0], approach[1], 0.05); await p.waitForTimeout(700);
  res.combo = await hud(p);
  await p.click('#finish'); res.comboResults = await results(p); res.errs2 = p.errs; await p.close();
  // 4) honest best case (tools/honest-max-trash.cjs): 14 binned, camera untouched
  p = await open();
  await p.evaluate(() => { const L = window.__level; L.dirt.slice(0, 14).forEach(d => { d.userData.binned = true; }); L.endRound(); });
  res.honestResults = await results(p); await p.close();
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
