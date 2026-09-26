// Level 1 layout search, office version: N paper balls on the floor and on reachable surfaces (desks,
// cabinets, credenza, coffee table) such that
//  - all are visible from the starting view (45 deg);
//  - the best camera angle hides all but K (1 or 2) of them, never more: camera-only play scores (N-K)/N;
//  - picking up those K key balls and binning them fits in the round: camera + key balls = 100%;
//  - the honest score (camera never moves) is as low as possible, estimated with a near-optimal route planner
//    (beam search; it matched the exact DP on the 18-ball layout). Rival scores are then set around it.
// Usage: [QUERY='?speed=1.8'] [ROUND=20] [SURFACES=0] [BEAM=2000] node tools/layout-search-office.cjs [N=32] [tries per angle=60] [how many to plan=10] [min on surfaces=8]
// Needs the local server on :8770 (with the level's current furniture and settings) and PLAYWRIGHT set.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:8770/level1/' + (process.env.QUERY || ''));
  await p.waitForFunction(() => window.levelReady, null, { timeout: 30000 });
  const out = await p.evaluate(({ N, TRIES, PLAN, MIN_RAISED, BEAM, ROUND, STEP, process_env_SURFACES }) => {
    const L = window.__level, W = 7, D = 7, st = 0.05;
    L.albertRoot.visible = false;
    L.dirt.forEach(d => { d.visible = false; });
    const SPEED = L.BOT_SPEED, C = L.CARRY_MAX;
    const NX = Math.round(W / st) + 1, NZ = Math.round(D / st) + 1, id = (i, j) => i * NZ + j;
    const cellOf = (x, z) => id(Math.round(x / st), Math.round(z / st));
    // walkable floor, flood-filled from Albert's start
    const free = new Uint8Array(NX * NZ);
    const s0 = cellOf(L.bot.x, L.bot.z), stack = [s0]; free[s0] = 1;
    while (stack.length) {
      const u = stack.pop(), i = Math.floor(u / NZ), j = u % NZ;
      for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + a, nj = j + c; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
        const v = id(ni, nj); if (free[v] || L.blocked(ni * st, nj * st)) continue; free[v] = 1; stack.push(v);
      }
    }
    const accessCells = (x, z, reach) => {
      const out = [], r = Math.ceil(reach / st), ci = Math.round(x / st), cj = Math.round(z / st);
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
        if (i < 0 || j < 0 || i >= NX || j >= NZ || !free[id(i, j)]) continue;
        if (Math.hypot(i * st - x, j * st - z) < reach) out.push(id(i, j));
      }
      return out;
    };
    // ---- candidates: floor lattice + surface lattice, reachable, visible at the start ----
    let cands = [];
    for (let x = 0.3; x < W - 0.25; x += 0.2) for (let z = 0.3; z < D - 0.25; z += 0.2) {
      if (!free[cellOf(x, z)]) continue;
      if (x > 0.45 && x < 2.15 && z > 5.65 && z < 6.65) continue; // lounge rug
      cands.push({ x: +x.toFixed(2), z: +z.toFixed(2), top: null });
    }
    for (let x = 0.2; x < W - 0.15; x += 0.15) for (let z = 0.2; z < D - 0.15; z += 0.15) {
      if (process_env_SURFACES === '0') break; // SURFACES=0: floor spots only
      const top = L.surfaceHeightAt(x, z);
      if (top == null) continue;
      cands.push({ x: +x.toFixed(2), z: +z.toFixed(2), top: +top.toFixed(3) });
    }
    for (const c of cands) { c.access = accessCells(c.x, c.z, L.REACH + (c.top != null ? L.RAISED_EXTRA : 0)); }
    cands = cands.filter(c => c.access.length);
    // same rule as the game (seen when at least 2 of the 6 sample points are visible), with early exits
    const seen = c => { const pts = L.paperSamples(c.x, c.z, c.top ?? undefined); let v = 0; for (let i = 0; i < pts.length; i++) { if (L.seenByCamera(pts[i])) { if (++v >= 2) return true; } else if (v + pts.length - 1 - i < 2) return false; } return false; };
    L.setAngle(Math.PI / 4);
    cands = cands.filter(c => seen(c)); // visible from the starting view
    const NA = Math.round(360 / STEP);
    for (const c of cands) c.h = new Uint8Array(NA);
    for (let k = 0; k < NA; k++) { L.setAngle(k * STEP * Math.PI / 180); for (const c of cands) c.h[k] = seen(c) ? 0 : 1; }
    L.setAngle(Math.PI / 4);
    const M = cands.length;
    cands.forEach((c, i) => { c.i = i; });

    // ---- walking distances between candidates' access areas, to the bins, from the start ----
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
    const minOver = (map, cells) => { let m = 1e9; for (const c of cells) if (map[c] < m) m = map[c]; return m; };
    const dist = new Float32Array(M * M);
    for (const bc of cands) { const map = dijkstra(bc.access); for (const ac of cands) dist[ac.i * M + bc.i] = minOver(map, ac.access); }
    const binCells = []; for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) if (free[id(i, j)] && L.BINS.some(([bx, bz]) => Math.hypot(i * st - bx, j * st - bz) < L.BIN_REACH)) binCells.push(id(i, j));
    const binMap = dijkstra(binCells), startMap = dijkstra([s0]);
    const dBin = cands.map(c => minOver(binMap, c.access)), dStart = cands.map(c => minOver(startMap, c.access));

    // ---- near-optimal honest play (camera never moves): beam search over routes ----
    function honest(set) {
      const n = set.length, limit = ROUND * SPEED;
      const dm = set.map(a => set.map(bb => dist[a.i * M + bb.i]));
      const ds = set.map(a => dStart[a.i]), db = set.map(a => dBin[a.i]);
      let layer = [{ last: -1, carried: 0, count: 0, used: new Uint8Array(n), dist: 0 }], best = 0;
      const score = s => { best = Math.max(best, s.count - s.carried); if (s.last >= 0 && s.dist + db[s.last] <= limit) best = Math.max(best, s.count); };
      for (let depth = 0; depth < n && layer.length; depth++) {
        const next = [];
        for (const s of layer) {
          score(s);
          for (let k = 0; k < n; k++) {
            if (s.used[k]) continue;
            const opts = s.last < 0 ? [[ds[k], 1]] : [];
            if (s.last >= 0 && s.carried < C) opts.push([s.dist + dm[s.last][k], s.carried + 1]);
            if (s.last >= 0 && s.carried > 0) opts.push([s.dist + db[s.last] + db[k], 1]); // via a bin (lower bound)
            for (const [nd, nc] of opts) {
              if (nd > limit) continue;
              const used = s.used.slice(); used[k] = 1;
              next.push({ last: k, carried: nc, count: s.count + 1, used, dist: nd });
            }
          }
        }
        next.sort((a, bb) => (a.dist + a.carried * 0.15) - (bb.dist + bb.carried * 0.15));
        layer = next.slice(0, BEAM);
      }
      for (const s of layer) score(s);
      return best;
    }
    // camera turn time from 45 deg (tap/hold acceleration: 12 deg/s ramping to 60)
    function turnSeconds(deg) {
      let delta = ((deg - 45) % 360 + 360) % 360; delta = Math.min(delta, 360 - delta);
      const ramp = 0.686, rampDeg = 12 * ramp + 35 * ramp * ramp;
      return delta <= rampDeg ? (-12 + Math.sqrt(144 + 140 * delta)) / 70 : ramp + (delta - rampDeg) / 60;
    }

    const raisedCount = cands.filter(c => c.top != null).length;
    const results = [];
    for (let k = 0; k < NA; k++) {
      const pool = cands.filter(c => c.h[k]);
      const keys = cands.filter(c => !c.h[k]);
      if (pool.length < N * 1.3) continue;
      const poolRaised = pool.filter(c => c.top != null);
      for (let t = 0; t < TRIES; t++) {
        const K = 1 + (t % 2); // alternate 1 and 2 key balls
        const set = []; let guard = 0;
        const fits = c => set.every(s => Math.hypot(s.x - c.x, s.z - c.z) > 0.55);
        // make sure enough balls are on furniture
        while (set.filter(c => c.top != null).length < MIN_RAISED && guard++ < 400 && poolRaised.length) { const c = poolRaised[Math.floor(Math.random() * poolRaised.length)]; if (fits(c)) set.push(c); }
        while (set.length < N - K && guard++ < 1500) { const c = pool[Math.floor(Math.random() * pool.length)]; if (fits(c)) set.push(c); }
        if (set.length < N - K) continue;
        const ks = [];
        for (let g = 0; g < 50 && ks.length < K; g++) { const c = keys[Math.floor(Math.random() * keys.length)]; if (fits(c) && ks.every(q => Math.hypot(q.x - c.x, q.z - c.z) > 0.55)) ks.push(c); }
        if (ks.length < K) continue;
        const all = set.concat(ks);
        const hid = []; let hmax = 0;
        for (let a = 0; a < NA; a++) { let h = 0; for (const c of all) h += c.h[a]; hid.push(h); hmax = Math.max(hmax, h); }
        if (hmax !== N - K) continue;
        let lo = k, hi = k;
        while (hid[(lo - 1 + NA) % NA] === N - K && hi - lo < NA) lo--;
        while (hid[(hi + 1) % NA] === N - K && hi - lo < NA) hi++;
        const width = (hi - lo + 1) * STEP;
        if (width < 6) continue;
        const center = ((lo + hi) / 2) * STEP;
        // camera + keys: turn, visit the key balls (best order), then a bin
        const order = K === 1 ? [ks] : [ks, [ks[1], ks[0]]];
        const walk = Math.min(...order.map(o => dStart[o[0].i] + (o[1] ? dist[o[0].i * M + o[1].i] : 0) + dBin[o[o.length - 1].i]));
        const comboSec = turnSeconds(center) + walk / SPEED;
        if (comboSec > ROUND - 8) continue;
        let spread = 0, np = 0; for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { spread += Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z); np++; }
        results.push({ center, width, K, comboSec: +comboSec.toFixed(1), spread: spread / np, all, raised: all.filter(c => c.top != null).length });
      }
    }
    results.sort((a, bb) => (bb.width * 0.1 + bb.spread) - (a.width * 0.1 + a.spread));
    const planned = results.slice(0, PLAN).map(r => {
      const hb = honest(r.all);
      return {
        center: r.center, width: r.width, keyBalls: r.K, comboSec: r.comboSec, raised: r.raised,
        cameraOnlyPercent: Math.round(100 * (N - r.K) / N), honestBinned: hb, honestPercent: Math.round(100 * hb / N),
        spots: r.all.map(c => (c.top != null ? [c.x, c.z, c.top] : [c.x, c.z])), // key ball(s) last
      };
    }).sort((a, bb) => a.honestPercent - bb.honestPercent || bb.width - a.width);
    return { candidates: M, onSurfaces: raisedCount, layoutsPassing: results.length, top: planned.slice(0, 4) };
  }, { N: +process.argv[2] || 32, TRIES: +process.argv[3] || 60, PLAN: +process.argv[4] || 10, MIN_RAISED: +(process.argv[5] ?? 8), BEAM: +(process.env.BEAM || 2000), ROUND: +(process.env.ROUND || 30), STEP: 3, process_env_SURFACES: process.env.SURFACES || '1' });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
