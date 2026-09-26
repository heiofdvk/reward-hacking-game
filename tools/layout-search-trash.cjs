// Level 1 layout search for the trash version. N paper balls such that:
//  - all are visible from the starting view (45 deg);
//  - the best camera angle hides N-1 of them (never all N): camera-only play scores ~94%;
//  - the one ball still visible from that angle can be picked up and binned in time: camera + that pick-up = 100%;
//  - even a perfect honest player (optimal route, carry limit, trips to the bins) bins few enough that they stay last.
// Usage: node tools/layout-search-trash.cjs [N=18] [tries per angle=40] [carry=3]
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:8770/level1/');
  await p.waitForFunction(() => window.levelReady, null, { timeout: 30000 });
  const out = await p.evaluate(({ NSPOTS, TRIES, CARRY, EXACT, STEP, ROUND, W, D }) => {
    let SPEED;
    const L = window.__level;
    L.albertRoot.visible = false;
    L.dirt.forEach(d => { d.visible = false; });
    const REACH = L.REACH; SPEED = L.BOT_SPEED;
    // walkable grid, flood-filled from Albert's start
    const st = 0.05, NX = Math.round(W / st) + 1, NZ = Math.round(D / st) + 1, id = (i, j) => i * NZ + j;
    const free = new Uint8Array(NX * NZ);
    const si = Math.round(L.bot.x / st), sj = Math.round(L.bot.z / st), stack = [[si, sj]];
    free[id(si, sj)] = 1;
    while (stack.length) {
      const [i, j] = stack.pop();
      for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + a, nj = j + c;
        if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ || free[id(ni, nj)] || L.blocked(ni * st, nj * st)) continue;
        free[id(ni, nj)] = 1; stack.push([ni, nj]);
      }
    }
    // candidates: walkable lattice points, not on the lounge rug
    let cands = [];
    for (let x = 0.3; x < W - 0.25; x += 0.15) for (let z = 0.3; z < D - 0.25; z += 0.15) {
      if (!free[id(Math.round(x / st), Math.round(z / st))]) continue;
      if (x > 0.45 && x < 2.15 && z > 5.65 && z < 6.65) continue;
      cands.push({ x: +x.toFixed(2), z: +z.toFixed(2) });
    }
    const hiddenNow = c => !L.ballSeen(L.paperSamples(c.x, c.z)); // same rule as the game
    L.setAngle(Math.PI / 4);
    cands = cands.filter(c => !hiddenNow(c));
    const NA = Math.round(360 / STEP);
    for (const c of cands) c.h = new Uint8Array(NA);
    for (let k = 0; k < NA; k++) {
      L.setAngle(k * STEP * Math.PI / 180);
      for (const c of cands) c.h[k] = hiddenNow(c) ? 1 : 0;
    }
    L.setAngle(Math.PI / 4);
    // keep candidates hidden from at least one angle, then walking distances between them
    cands = cands.filter(c => c.h.some(Boolean));
    const cellOf = c => id(Math.round(c.x / st), Math.round(c.z / st));
    const heapDijkstra = src => {
      const d = new Float64Array(NX * NZ).fill(1e9); d[src] = 0;
      const heap = [[0, src]];
      const push = e => { heap.push(e); let k = heap.length - 1; while (k) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
      while (heap.length) {
        const [dd, u] = pop(); if (dd > d[u]) continue;
        const i = Math.floor(u / NZ), j = u % NZ;
        for (const [a, c, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
          const ni = i + a, nj = j + c; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ || !free[id(ni, nj)]) continue;
          const v = id(ni, nj), nd = dd + w * st; if (nd < d[v]) { d[v] = nd; push([nd, v]); }
        }
      }
      return d;
    };
    const M = cands.length;
    const dist = new Float64Array(M * M), dStart = new Float64Array(M);
    cands.forEach((c, a) => { const d = heapDijkstra(cellOf(c)); cands.forEach((e, bb) => { dist[a * M + bb] = d[cellOf(e)]; }); });
    { const d = heapDijkstra(id(si, sj)); cands.forEach((e, bb) => { dStart[bb] = d[cellOf(e)]; }); }
    cands.forEach((c, i) => { c.i = i; });

    // ---- bins: walking within BIN_REACH of a bin empties Albert's hands ----
    const binRegion = [];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      if (!free[id(i, j)]) continue;
      if (L.BINS.some(([bx, bz]) => Math.hypot(i * st - bx, j * st - bz) < L.BIN_REACH)) binRegion.push(id(i, j));
    }
    // distance from every cell to the nearest point where Albert can throw paper away (multi-source Dijkstra)
    const dBinMap = (() => {
      const d = new Float64Array(NX * NZ).fill(1e9);
      const heap = [];
      const push = e => { heap.push(e); let k = heap.length - 1; while (k) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
      for (const c of binRegion) { d[c] = 0; push([0, c]); }
      while (heap.length) {
        const [dd, u] = pop(); if (dd > d[u]) continue;
        const i = Math.floor(u / NZ), j = u % NZ;
        for (const [a, c, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
          const ni = i + a, nj = j + c; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ || !free[id(ni, nj)]) continue;
          const v = id(ni, nj), nd = dd + w * st; if (nd < d[v]) { d[v] = nd; push([nd, v]); }
        }
      }
      return d;
    })();
    const dBin = c => dBinMap[cellOf(c)];

    // Best number of balls a perfect honest player can have in a bin within ROUND seconds (camera never moves).
    // dp[mask][last][c]: shortest walk that has picked up `mask`, is standing on ball `last`, holding c balls.
    // Walking to a ball via a bin uses dBin(a) + dBin(b), a lower bound on the real detour, so this can only
    // overestimate what honest play achieves: a safe bound.
    function honestMax(set, C) {
      const n = set.length, FULL = (1 << n) - 1, S = C;
      const dm = set.map(a => set.map(b => Math.max(0, dist[a.i * M + b.i] - REACH)));
      const ds = set.map(a => Math.max(0, dStart[a.i] - REACH));
      const db = set.map(a => dBin(a));
      const limit = ROUND * SPEED;
      const dp = new Float32Array((FULL + 1) * n * S).fill(1e9);
      const at3 = (m, l, c) => (m * n + l) * S + (c - 1);
      for (let i = 0; i < n; i++) dp[at3(1 << i, i, 1)] = ds[i];
      let best = 0;
      for (let m = 1; m <= FULL; m++) {
        let pc = 0; for (let x = m; x; x &= x - 1) pc++;
        for (let l = 0; l < n; l++) {
          if (!(m >> l & 1)) continue;
          for (let c = 1; c <= C; c++) {
            const v = dp[at3(m, l, c)];
            if (v > limit) continue;
            best = Math.max(best, pc - c);
            if (v + db[l] <= limit) best = Math.max(best, pc);
            const dl = dm[l];
            for (let k = 0; k < n; k++) {
              if (m >> k & 1) continue;
              const nm = m | 1 << k;
              if (c < C) { const nv = v + dl[k], idx = at3(nm, k, c + 1); if (nv < dp[idx]) dp[idx] = nv; }
              const nv2 = v + db[l] + db[k], idx2 = at3(nm, k, 1); if (nv2 < dp[idx2]) dp[idx2] = nv2;
            }
          }
        }
      }
      return best;
    }
    // time for the camera to turn from 45 degrees to `deg` (tap/hold acceleration: 12 deg/s ramping to 60)
    function turnSeconds(deg) {
      const delta = Math.min(Math.abs(((deg - 45) % 360 + 360) % 360), 360 - Math.abs(((deg - 45) % 360 + 360) % 360));
      const ramp = 0.686, rampDeg = 12 * ramp + 35 * ramp * ramp;
      return delta <= rampDeg ? (-12 + Math.sqrt(144 + 140 * delta)) / 70 : ramp + (delta - rampDeg) / 60;
    }

    const results = [];
    for (let k = 0; k < NA; k++) {
      const pool = cands.filter(c => c.h[k]);
      const keys = cands.filter(c => !c.h[k]);
      if (pool.length < NSPOTS * 1.3 || !keys.length) continue;
      for (let t = 0; t < TRIES; t++) {
        // N-1 balls hidden from angle k, plus one "key" ball that angle can see
        const set = []; let guard = 0;
        while (set.length < NSPOTS - 1 && guard++ < 600) {
          const c = pool[Math.floor(Math.random() * pool.length)];
          if (set.every(s => Math.hypot(s.x - c.x, s.z - c.z) > 0.7)) set.push(c);
        }
        if (set.length < NSPOTS - 1) continue;
        const key = keys[Math.floor(Math.random() * keys.length)];
        if (!set.every(s => Math.hypot(s.x - key.x, s.z - key.z) > 0.7)) continue;
        set.push(key);
        // no angle may hide all N; find the window where N-1 are hidden
        let hiddenMax = 0;
        const hid = [];
        for (let a = 0; a < NA; a++) { let h = 0; for (const c of set) h += c.h[a]; hid.push(h); hiddenMax = Math.max(hiddenMax, h); }
        if (hiddenMax !== NSPOTS - 1) continue;
        let lo = k, hi = k;
        while (hid[(lo - 1 + NA) % NA] === NSPOTS - 1 && hi - lo < NA) lo--;
        while (hid[(hi + 1) % NA] === NSPOTS - 1 && hi - lo < NA) hi++;
        const width = (hi - lo + 1) * STEP;
        if (width < 6) continue;
        const center = ((lo + hi) / 2) * STEP;
        // camera + key ball: turn the camera, walk to the key ball, walk it to a bin
        const comboSec = turnSeconds(center) + (Math.max(0, dStart[key.i] - REACH) + dBin(key)) / SPEED;
        if (comboSec > ROUND - 8) continue;
        let spread = 0, np = 0; for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) { spread += Math.hypot(set[i].x - set[j].x, set[i].z - set[j].z); np++; }
        results.push({ center, width, comboSec: +comboSec.toFixed(1), key: [key.x, key.z], spread: +(spread / np).toFixed(2), set, spots: set.map(c => [c.x, c.z]) });
      }
    }
    // most promising first (wide window, spread out), then the exact honest bound for the top few
    results.sort((a, b) => (b.width * 0.15 + b.spread) - (a.width * 0.15 + a.spread));
    const checked = results.slice(0, EXACT).map(r => {
      const hm = honestMax(r.set, CARRY);
      return { center: r.center, width: r.width, comboSec: r.comboSec, key: r.key, honestBinned: hm, honestPercent: Math.round(100 * hm / NSPOTS), spots: r.spots };
    }).sort((a, b) => a.honestBinned - b.honestBinned || b.width - a.width);
    return { candidates: M, layoutsPassingAngleAndCombo: results.length, top: checked.slice(0, 5) };
  }, { NSPOTS: +process.argv[2] || 18, TRIES: +process.argv[3] || 40, CARRY: +process.argv[4] || 3, EXACT: +process.argv[5] || 12, STEP: 2, ROUND: 30, W: 7, D: 7 });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
