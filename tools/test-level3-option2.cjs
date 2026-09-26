// Level 3 (option 2, the cluttered data centre with the cold-air hose): plays whole rounds with bots, faster
// than real time, through the page's test hooks, and prints each strategy's score when time runs out (the
// score that counts). The bots walk with a grid path-finder and aim straight at their target. Then it plays
// once with real input: Albert next to the thermometer, the mouse on it and Space held to the end.
//
//   python3 -m http.server 8770      (from the repo root)
//   PLAYWRIGHT=~/.npm/_npx/705bc6b22212b352/node_modules/playwright node tools/test-level3-option2.cjs ['?seed=7']
//   BOTS=honest,direct node tools/test-level3-option2.cjs     (only some bots)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const QUERY = process.argv[2] || '';
const BOTS = (process.env.BOTS || 'idle,honest,nearby,decoy,local,late,direct').split(',');

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  for (const bot of BOTS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', e => console.log('page error:', e.message));
    await page.goto(`http://localhost:8770/level3-option2/${QUERY}`);
    await page.waitForFunction(() => window.levelReady, null, { timeout: 90000 });
    results.push(await page.evaluate(bot => {
      const L = window.__level, S = L.SENSOR;
      L.start();
      window.__freeze = true; // the render loop stops ticking; we step the round ourselves

      // grid path-finder (8 directions) over the cells Albert can stand in
      const CELL = 0.2, NX = Math.ceil(L.ROOM_W / CELL), NZ = Math.ceil(L.ROOM_D / CELL);
      const free = new Uint8Array(NX * NZ);
      for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) free[j * NX + i] = L.blocked((i + 0.5) * CELL, (j + 0.5) * CELL) ? 0 : 1;
      const clampI = (v, n) => Math.max(0, Math.min(n - 1, v));
      const cellOf = (x, z) => [clampI(Math.floor(x / CELL), NX), clampI(Math.floor(z / CELL), NZ)];
      function nearestFree(i, j) {
        for (let r = 0; r < 20; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
          const a = i + di, b = j + dj;
          if (a >= 0 && b >= 0 && a < NX && b < NZ && free[b * NX + a]) return [a, b];
        }
        return [i, j];
      }
      function path(tx, tz) {
        const [si, sj] = nearestFree(...cellOf(L.bot.x, L.bot.z)), [ti, tj] = nearestFree(...cellOf(tx, tz));
        const from = new Int32Array(NX * NZ).fill(-1), start = sj * NX + si, goal = tj * NX + ti;
        const queue = [start]; from[start] = start;
        for (let q = 0; q < queue.length && from[goal] < 0; q++) {
          const c = queue[q], ci = c % NX, cj = (c - ci) / NX;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const a = ci + di, b = cj + dj, n = b * NX + a;
            if (a < 0 || b < 0 || a >= NX || b >= NZ || !free[n] || from[n] >= 0) continue;
            if (di && dj && (!free[cj * NX + a] || !free[b * NX + ci])) continue; // no cutting corners
            from[n] = c; queue.push(n);
          }
        }
        const pts = [];
        for (let c = goal; from[c] >= 0 && c !== start; c = from[c]) pts.unshift([(c % NX + 0.5) * CELL, (Math.floor(c / NX) + 0.5) * CELL]);
        return pts;
      }
      let route = [], routeFor = null;
      function goTo(x, z) {
        const key = `${x.toFixed(1)},${z.toFixed(1)}`;
        if (routeFor !== key) { route = path(x, z); routeFor = key; }
        while (route.length && Math.hypot(route[0][0] - L.bot.x, route[0][1] - L.bot.z) < 0.12) route.shift();
        if (route.length) L.walkTo(route[0][0], route[0][1]); else L.walkTo(L.bot.x, L.bot.z);
        return Math.hypot(x - L.bot.x, z - L.bot.z);
      }

      const hottest = list => list.reduce((a, b) => (b.T > a.T ? b : a));
      const near = L.RACKS.filter(r => Math.hypot(r.x - S.x, r.z - S.z) < 3);
      let target = null;
      // cool one rack at a time: walk to the aisle in front of its door, face it and spray
      function coolRacks(list, pick) {
        const h = pick(list);
        if (!target || !list.includes(target) || target.T < 26 || h.T > target.T + 12) target = h;
        const d = goTo(target.x, target.z + 1.1);
        L.aimAt(target.x, L.NOZZLE_Y, target.z + 0.2);
        L.spray(d < 3);
      }
      function sprayAt(x, y, z, standX, standZ) {
        const d = goTo(standX, standZ);
        L.aimAt(x, y, z);
        L.spray(d < 2);
      }
      const dt = 1 / 60;
      for (let step = 0; step * dt < L.ROUND_SECONDS - 1e-9; step++) {
        const t = step * dt;
        if (bot === 'idle') L.spray(false);
        if (bot === 'honest') coolRacks(L.RACKS, hottest);
        // the hot rack closest to Albert (less walking)
        if (bot === 'nearby') coolRacks(L.RACKS, list => {
          const hot = list.filter(r => r.T > 40);
          const d = r => Math.hypot(r.x - L.bot.x, r.z - L.bot.z);
          return hot.length ? hot.reduce((a, b) => (d(b) < d(a) ? b : a)) : hottest(list);
        });
        // sprays the obvious "THERMOSTAT" panel on the pillar (it does nothing)
        if (bot === 'decoy') sprayAt(8.1, 0.45, 8.53, 8.1, 9.5);
        // only the racks around the thermometer (knows the area, doesn't touch the thermometer)
        if (bot === 'local') coolRacks(near, hottest);
        // honest for 20 s, then on the thermometer until the end
        if (bot === 'late') { if (t < 20) coolRacks(L.RACKS, hottest); else sprayAt(S.x, S.y, S.z, S.x, S.z + 1.2); }
        if (bot === 'direct') sprayAt(S.x, S.y, S.z, S.x, S.z + 1.2);
        L.tick(dt);
      }
      return {
        bot, final: L.scoreOf(L.thermo.reading), reading: +L.thermo.reading.toFixed(1), air: +L.roomAir().toFixed(1),
        servers: +L.meanRackT().toFixed(1), chill: +L.thermo.chill.toFixed(2), albert: `${L.bot.x.toFixed(1)}, ${L.bot.z.toFixed(1)}`,
      };
    }, bot));
    await page.close();
  }
  console.table(results);

  // real input: Albert placed in front of the storage unit, the mouse on the thermometer, Space held to the end
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:8770/level3-option2/${QUERY}`);
  await page.waitForFunction(() => window.levelReady, null, { timeout: 90000 });
  await page.click('#start');
  await page.evaluate(() => { const L = window.__level; L.teleport(L.SENSOR.x, L.SENSOR.z + 1.2); });
  await page.waitForTimeout(300);
  const [sx, sy] = await page.evaluate(() => { const L = window.__level, v = L.SENSOR.clone().project(L.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
  await page.mouse.move(sx, sy);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__level.state === 'results', null, { timeout: 90000 });
  await page.keyboard.up('Space');
  const r = await page.evaluate(() => ({ score: window.__level.score, reading: +window.__level.thermo.reading.toFixed(1), aim: window.__level.aim.toArray().map(v => +v.toFixed(2)) }));
  console.log(`mouse on the thermometer + Space to the end: ${r.score}% (reading ${r.reading} °C, aim ${r.aim})`);
  await browser.close();
})();
