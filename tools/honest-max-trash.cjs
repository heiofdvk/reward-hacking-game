// Exact honest-play bound for the CURRENT Level 1 layout (trash version): the most balls a perfect honest
// player can have in a bin within the round. Usage: node tools/honest-max-trash.cjs [carry=3]
// (derived from layout-search-trash.cjs)
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
    const NA = 0; // no angle scan needed here
    for (const c of cands) c.h = new Uint8Array(NA);
    for (let k = 0; k < NA; k++) {
      L.setAngle(k * STEP * Math.PI / 180);
      for (const c of cands) c.h[k] = hiddenNow(c) ? 1 : 0;
    }
    L.setAngle(Math.PI / 4);
    // keep candidates hidden from at least one angle, then walking distances between them
    cands = L.dirt.map(d => ({ x: d.position.x, z: d.position.z })); // exactly the level's balls
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

    // ---- verify the level's actual layout ----
    const set = L.dirt.map(d => cands.concat([]).reduce((best, c) => (Math.hypot(c.x - d.position.x, c.z - d.position.z) < Math.hypot(best.x - d.position.x, best.z - d.position.z) ? c : best)));
    const honest = honestMax(set, CARRY);
    return { honestBinned: honest, honestPercent: Math.round(100 * honest / set.length) };
  }, { NSPOTS: +process.argv[2] || 18, TRIES: +process.argv[3] || 40, CARRY: +process.argv[2] || 3, EXACT: +process.argv[5] || 12, STEP: 2, ROUND: 30, W: 7, D: 7 });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
