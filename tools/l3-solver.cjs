// Level 3 puzzle solver: tile-grid crates with heights and stacking.
//
// Rules (must match proto/index.html):
//  - Heights are in crate units U (crate = 1U tall). Albert can step/jump up at most 1U, and drop any height.
//  - Albert pushes the TOP crate of a neighbouring stack when that crate's base is at his standing height.
//    The crate moves one tile; if the destination is lower it falls onto it (stacking / drop, irreversible).
//    It can't go up, into walls, stairs, doors or conveyors-without-entry.
//  - Albert can stand on crates (so he can hop over a crate that is 1U above him).
//  - "Ceiling" tiles (^) cap Albert's standing height: he can't stand on anything there higher than capU.
//  - Plates are pressed by a crate on them (Albert standing there doesn't count: he can't hold a door and walk through it).
//  - Doors are walls unless all their plates are pressed; crates can never enter door tiles.
//
// Map legend:
//   #  wall             .  floor (0)        1,2,3,4  raised floor at that height
//   s  stair (0.5U, Albert only)            ^  floor with a low ceiling (Albert can stand at most capU there)
//   a..e  pressure plates (floor)           A..E  door opened by plate of the same lowercase letter
//   >  conveyor intake (floor, crates ok)   @  Albert start (floor)
//   n  threshold floor (Albert can walk it, crates can't be pushed onto it)
// Crates are given separately as [x,z] (repeat a cell to stack).

function parse(room) {
  const rows = room.map, H = rows.length, W = rows[0].length;
  const N = W * H;
  const base = new Float64Array(N), wall = new Uint8Array(N), noCrate = new Uint8Array(N), ceil = new Float64Array(N).fill(Infinity);
  const plate = new Int8Array(N).fill(-1), door = new Int8Array(N).fill(-1);
  let start = -1; const conv = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = z * W + x, ch = rows[z][x];
    if (ch === '#') { wall[i] = 1; noCrate[i] = 1; }
    else if (ch >= '1' && ch <= '4') base[i] = +ch;
    else if (ch === 's') { base[i] = 0.5; noCrate[i] = 1; }
    else if (ch === '^') { ceil[i] = room.capU ?? 0.99; }
    else if (ch >= 'a' && ch <= 'e') plate[i] = ch.charCodeAt(0) - 97;
    else if (ch >= 'A' && ch <= 'E') { door[i] = ch.charCodeAt(0) - 65; noCrate[i] = 1; }
    else if (ch === '>') conv.push(i);
    else if (ch === 'n') noCrate[i] = 1;                       // threshold: Albert yes, crates no
    else if (ch === '@') start = i;
  }
  if (room.start) start = room.start[1] * W + room.start[0];
  const counts = new Uint8Array(N);
  for (const [x, z] of room.crates) counts[z * W + x]++;
  return { W, H, N, base, wall, noCrate, ceil, plate, door, start, conv, counts };
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function makeSolver(room) {
  const P = parse(room);
  const { W, H, N, base, wall, noCrate, ceil, plate, door } = P;
  const plateCells = [];
  for (let i = 0; i < N; i++) if (plate[i] >= 0) plateCells.push(i);
  const pressed = counts => { const s = new Set(); for (const i of plateCells) if (counts[i] > 0) s.add(plate[i]); return s; };
  const top = (counts, i) => base[i] + counts[i];
  const nb = (i, d) => { const x = i % W + DIRS[d][0], z = Math.floor(i / W) + DIRS[d][1]; return (x < 0 || z < 0 || x >= W || z >= H) ? -1 : z * W + x; };
  const closed = (i, pr) => door[i] >= 0 && !pr.has(door[i]);
  const standable = (counts, i, pr) => !wall[i] && !closed(i, pr) && top(counts, i) <= ceil[i] + 1e-9;

  // cells Albert can reach from `from`
  function reach(counts, from) {
    const pr = pressed(counts);
    const seen = new Uint8Array(N); const q = [from]; seen[from] = 1;
    while (q.length) {
      const a = q.pop(), ha = top(counts, a);
      for (let d = 0; d < 4; d++) {
        const b = nb(a, d);
        if (b < 0 || seen[b] || !standable(counts, b, pr)) continue;
        if (top(counts, b) > ha + 1.0 + 1e-9) continue;   // can climb at most 1U
        seen[b] = 1; q.push(b);
      }
    }
    return seen;
  }
  function key(counts, reachSet) {
    let m = -1; for (let i = 0; i < N; i++) if (reachSet[i]) { m = i; break; }
    return counts.join(',') + '|' + m;
  }
  function pushes(counts, reachSet) {
    const pr = pressed(counts), out = [];
    for (let a = 0; a < N; a++) {
      if (!reachSet[a]) continue;
      const ha = top(counts, a);
      for (let d = 0; d < 4; d++) {
        const b = nb(a, d); if (b < 0 || wall[b] || counts[b] === 0) continue;
        if (Math.abs(top(counts, b) - 1 - ha) > 1e-9) continue;   // top crate of b sits at Albert's level
        const c = nb(b, d); if (c < 0 || noCrate[c] || closed(c, pr)) continue;
        if (top(counts, c) > ha + 1e-9) continue;                   // can't push up
        out.push({ a, b, c, d });
      }
    }
    return out;
  }
  function solve(goal, { maxStates = 2e6 } = {}) {
    const start = P.counts.slice();
    const r0 = reach(start, P.start);
    const k0 = key(start, r0);
    const parent = new Map([[k0, null]]);
    let frontier = [{ counts: start, from: P.start, k: k0 }], depth = 0, explored = 0;
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        explored++;
        const rs = reach(s.counts, s.from);
        if (goal(s.counts, rs, P)) {
          const path = []; let k = s.k; while (parent.get(k)) { const p = parent.get(k); path.push(p.move); k = p.k; }
          return { solved: true, pushes: depth, explored, path: path.reverse() };
        }
        for (const mv of pushes(s.counts, rs)) {
          const c2 = s.counts.slice(); c2[mv.b]--; c2[mv.c]++;
          const r2 = reach(c2, mv.a); const k2 = key(c2, r2);
          if (parent.has(k2)) continue;
          parent.set(k2, { k: s.k, move: mv });
          next.push({ counts: c2, from: mv.a, k: k2 });
        }
        if (parent.size > maxStates) return { solved: false, reason: 'state cap', explored };
      }
      frontier = next; depth++;
    }
    return { solved: false, reason: 'exhausted', explored, states: parent.size };
  }
  // all reachable states + which of them can still reach the goal (dead-end density)
  function analyse(goal, { maxStates = 3e5 } = {}) {
    const start = P.counts.slice();
    const nodes = new Map(); const edges = new Map();
    const q = [{ counts: start, from: P.start }];
    const k0 = key(start, reach(start, P.start)); nodes.set(k0, { counts: start, from: P.start, goal: false }); edges.set(k0, []);
    for (let h = 0; h < q.length && nodes.size < maxStates; h++) {
      const s = q[h]; const rs = reach(s.counts, s.from); const ks = key(s.counts, rs);
      nodes.get(ks).goal = goal(s.counts, rs, P);
      for (const mv of pushes(s.counts, rs)) {
        const c2 = s.counts.slice(); c2[mv.b]--; c2[mv.c]++;
        const k2 = key(c2, reach(c2, mv.a));
        edges.get(ks).push(k2);
        if (!nodes.has(k2)) { nodes.set(k2, { counts: c2, from: mv.a, goal: false }); edges.set(k2, []); q.push({ counts: c2, from: mv.a }); }
      }
    }
    // reverse reachability from goal states
    const rev = new Map(); for (const [k, es] of edges) for (const e of es) { if (!rev.has(e)) rev.set(e, []); rev.get(e).push(k); }
    const alive = new Set(); const st = [...nodes].filter(([, v]) => v.goal).map(([k]) => k);
    for (const k of st) alive.add(k);
    while (st.length) { const k = st.pop(); for (const p of rev.get(k) || []) if (!alive.has(p)) { alive.add(p); st.push(p); } }
    const firstMoves = edges.get(k0).map(k => alive.has(k));
    return { states: nodes.size, alive: alive.size, dead: nodes.size - alive.size, deadPct: +(100 * (1 - alive.size / nodes.size)).toFixed(1),
             firstMoves: firstMoves.length, firstMovesDead: firstMoves.filter(x => !x).length };
  }
  return { P, solve, analyse, reach, top, nb, W, H };
}

function describe(path, W) {
  const n = ['E', 'W', 'S', 'N'];
  return path.map(m => `(${m.b % W},${Math.floor(m.b / W)})→${n[m.d]}`).join(' ');
}

module.exports = { makeSolver, describe, parse };

if (require.main === module) {
  const rooms = require(process.argv[2] || './l3-rooms.cjs');
  for (const [name, room] of Object.entries(rooms)) {
    const S = makeSolver(room);
    const t0 = Date.now();
    const r = S.solve(room.goal);
    const a = S.analyse(room.goal);
    console.log(`\n== ${name} ==  ${Date.now() - t0} ms`);
    console.log(r.solved ? `solvable in ${r.pushes} pushes (explored ${r.explored})` : `NOT solvable (${r.reason})`);
    if (r.solved) console.log('solution:', describe(r.path, S.W));
    console.log(`state space ${a.states}, dead-end states ${a.dead} (${a.deadPct}%), opening moves ${a.firstMoves} of which ${a.firstMovesDead} are already lost`);
  }
}
