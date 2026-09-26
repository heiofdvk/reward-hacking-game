// Near-optimal honest-play estimate for Level 1 with any paper count (the exact DP in honest-max-trash.cjs
// only scales to ~18 balls). Beam search over routes: pick up balls (up to `carry` in hand), walk to the
// nearest bin to empty hands; keeps the best BEAM partial routes per number of balls picked.
// Usage: [QUERY='?speed=1.8&papers=30'] [ROUND=30] [BEAM=3000] node tools/honest-beam.cjs
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle'] });
  const p = await b.newPage();
  await p.goto('http://localhost:8770/level1/' + (process.env.QUERY || ''));
  await p.waitForFunction(() => window.levelReady, null, { timeout: 30000 });
  const out = await p.evaluate(({ ROUND, BEAM }) => {
    const L = window.__level, W = 7, D = 7, st = 0.05, NX = Math.round(W / st) + 1, NZ = Math.round(D / st) + 1;
    const id = (i, j) => i * NZ + j, cell = (x, z) => id(Math.round(x / st), Math.round(z / st));
    const free = new Uint8Array(NX * NZ);
    const s0 = cell(L.bot.x, L.bot.z), stack = [s0]; free[s0] = 1;
    while (stack.length) {
      const u = stack.pop(), i = Math.floor(u / NZ), j = u % NZ;
      for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + a, nj = j + c; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
        const v = id(ni, nj); if (free[v] || L.blocked(ni * st, nj * st)) continue; free[v] = 1; stack.push(v);
      }
    }
    function dijkstra(sources) {
      const d = new Float64Array(NX * NZ).fill(1e9), heap = [];
      const push = e => { heap.push(e); let k = heap.length - 1; while (k) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
      for (const s of sources) { d[s] = 0; push([0, s]); }
      while (heap.length) {
        const [dd, u] = pop(); if (dd > d[u]) continue; const i = Math.floor(u / NZ), j = u % NZ;
        for (const [a, c, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
          const ni = i + a, nj = j + c; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ || !free[id(ni, nj)]) continue;
          const v = id(ni, nj), nd = dd + w * st; if (nd < d[v]) { d[v] = nd; push([nd, v]); }
        }
      }
      return d;
    }
    // each ball can be picked up from any walkable cell within its reach (paper on a desk: reach + RAISED_EXTRA)
    const balls = L.dirt.map(d => ({ x: d.position.x, z: d.position.z, reach: L.REACH + (d.userData.raised ? L.RAISED_EXTRA : 0) }));
    const n = balls.length, C = L.CARRY_MAX, SPEED = L.BOT_SPEED;
    for (const a of balls) {
      a.access = [];
      const r = Math.ceil(a.reach / st), ci = Math.round(a.x / st), cj = Math.round(a.z / st);
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++)
        if (i >= 0 && j >= 0 && i < NX && j < NZ && free[id(i, j)] && Math.hypot(i * st - a.x, j * st - a.z) < a.reach) a.access.push(id(i, j));
    }
    const minOver = (map, cells) => { let m = 1e9; for (const c of cells) if (map[c] < m) m = map[c]; return m; };
    const maps = balls.map(a => dijkstra(a.access));
    const dm = balls.map(a => balls.map((_, k) => minOver(maps[k], a.access)));
    const startMap = dijkstra([s0]), dS = balls.map(a => minOver(startMap, a.access));
    const binCells = []; for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) if (free[id(i, j)] && L.BINS.some(([bx, bz]) => Math.hypot(i * st - bx, j * st - bz) < L.BIN_REACH)) binCells.push(id(i, j));
    const binMap = dijkstra(binCells), dB = balls.map(a => minOver(binMap, a.access));
    // ball -> bin -> ball: dB(a) + dB(b) is a lower bound on the real detour (keeps the estimate on the player's side)
    const vb = balls.map((_, a) => balls.map((_, k) => dB[a] + dB[k]));
    const limit = ROUND * SPEED;
    // beam search
    let layer = [{ last: -1, carried: 0, picked: [], used: new Uint8Array(n), dist: 0 }];
    let bestBinned = 0;
    for (let depth = 0; depth < n; depth++) {
      const next = [];
      for (const s of layer) {
        const binnedNow = s.picked.length - s.carried;
        bestBinned = Math.max(bestBinned, binnedNow);
        if (s.last >= 0 && s.dist + dB[s.last] <= limit) bestBinned = Math.max(bestBinned, s.picked.length);
        for (let k = 0; k < n; k++) {
          if (s.used[k]) continue;
          const opts = [];
          if (s.last < 0) opts.push([dS[k], 1]);
          else {
            if (s.carried < C) opts.push([s.dist + dm[s.last][k], s.carried + 1]);
            if (s.carried > 0) opts.push([s.dist + vb[s.last][k], 1]);
          }
          for (const [nd, nc] of opts) {
            if (nd > limit) continue;
            const used = s.used.slice(); used[k] = 1;
            next.push({ last: k, carried: nc, picked: s.picked.concat(k), used, dist: nd });
          }
        }
      }
      if (!next.length) break;
      // prefer shorter routes, lightly prefer fewer balls in hand (they still need a bin trip)
      next.sort((a, b2) => (a.dist + a.carried * 0.15) - (b2.dist + b2.carried * 0.15));
      layer = next.slice(0, BEAM);
    }
    for (const s of layer) { bestBinned = Math.max(bestBinned, s.picked.length - s.carried); if (s.last >= 0 && s.dist + dB[s.last] <= limit) bestBinned = Math.max(bestBinned, s.picked.length); }
    return { papers: n, speed: SPEED, carry: C, round: ROUND, honestBinned: bestBinned, honestPercent: Math.round(100 * bestBinned / n) };
  }, { ROUND: +(process.env.ROUND || 30), BEAM: +(process.env.BEAM || 3000) });
  console.log(JSON.stringify(out));
  await b.close();
})();
