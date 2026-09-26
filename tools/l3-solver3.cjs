// Level 3 room 3 solver: boxes + one battery + four pressure plates.
//
// Rules (must match proto/index.html):
//  - Heights are in box units U. Albert climbs at most 1U and drops any height. Boxes are 1U tall.
//  - Albert pushes the TOP box of a neighbouring stack when that box's base is at his standing height. It moves one
//    tile; if the destination is lower it falls onto it (stacking, irreversible). Never up, never into walls, fences,
//    the threshold, or the tile where the battery lies.
//  - Albert starts HOLDING the battery. Throw: from any tile he stands on (height h = floor + boxes), facing N/S/E/W,
//    it lands exactly 2 tiles ahead, arcing over whatever is in between (fences too). Valid only if the landing tile
//    is inside, not a wall/fence/threshold, has no box, and is at most h+1 high. Otherwise it bounces back (no move).
//  - Pickup: a lying battery on a tile Albert can reach can be picked up again.
//  - Plates are pressed by a box stack, the lying battery, or Albert standing on them.
//    GOAL: all plates pressed at once = at most one plate without box/battery, and Albert can reach that one.
//
// Map legend:  #  wall   .  floor   1 2 3  raised floor (height in U)   F  fence (blocks Albert and boxes, not the
//              battery's arc)   n  threshold (Albert yes, boxes no)   @  start (floor)
// Room: { map, plates:[[x,z]..], crates:[[x,z]..] (repeat a cell to stack), start:[x,z] }

function parse(room) {
  const rows = room.map, H = rows.length, W = rows[0].length, N = W * H;
  const base = new Float64Array(N), wall = new Uint8Array(N), noBox = new Uint8Array(N), noLand = new Uint8Array(N);
  let start = -1;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = z * W + x, ch = rows[z][x];
    if (ch === '#' || ch === 'F') { wall[i] = 1; noBox[i] = 1; noLand[i] = 1; }
    else if (ch >= '1' && ch <= '4') base[i] = +ch;
    else if (ch === 'n') { noBox[i] = 1; noLand[i] = 1; }
    else if (ch === '@') start = i;
  }
  if (room.start) start = room.start[1] * W + room.start[0];
  const counts = new Uint8Array(N);
  for (const [x, z] of room.crates) counts[z * W + x]++;
  const plates = room.plates.map(([x, z]) => z * W + x);
  return { W, H, N, base, wall, noBox, noLand, start, counts, plates };
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DN = ['E', 'W', 'S', 'N'];

function makeSolver(room, opts = {}) {
  const P = parse(room);
  const { W, H, N, base, wall, noBox, noLand, plates } = P;
  const allowThrow = opts.throws !== false;
  const top = (c, i) => base[i] + c[i];
  const nb = (i, d, k = 1) => { const x = i % W + DIRS[d][0] * k, z = Math.floor(i / W) + DIRS[d][1] * k; return (x < 0 || z < 0 || x >= W || z >= H) ? -1 : z * W + x; };

  function reach(c, from) {
    const seen = new Uint8Array(N); const q = [from]; seen[from] = 1;
    while (q.length) {
      const a = q.pop(), ha = top(c, a);
      for (let d = 0; d < 4; d++) {
        const b = nb(a, d);
        if (b < 0 || seen[b] || wall[b]) continue;
        if (top(c, b) > ha + 1 + 1e-9) continue;
        seen[b] = 1; q.push(b);
      }
    }
    return seen;
  }
  const minOf = rs => { for (let i = 0; i < N; i++) if (rs[i]) return i; return -1; };
  const key = (c, bat, rs) => c.join(',') + '|' + bat + '|' + minOf(rs);
  const goal = (c, bat, rs) => {
    let free = -1, n = 0;
    for (const p of plates) if (c[p] === 0 && bat !== p) { n++; free = p; }
    return n === 0 || (n === 1 && rs[free] === 1);
  };
  // every move from a state: {kind, a, d, b, c | t}, plus the resulting counts / battery / Albert's tile
  function moves(c, bat, rs) {
    const out = [];
    for (let a = 0; a < N; a++) {
      if (!rs[a]) continue;
      const ha = top(c, a);
      for (let d = 0; d < 4; d++) {
        const b = nb(a, d);
        if (b >= 0 && !wall[b] && c[b] > 0 && Math.abs(top(c, b) - 1 - ha) < 1e-9) {
          const t = nb(b, d);
          if (t >= 0 && !noBox[t] && t !== bat && top(c, t) <= ha + 1e-9) {
            const c2 = c.slice(); c2[b]--; c2[t]++;
            out.push({ kind: 'push', a, d, b, c: t, counts: c2, bat, from: a });
          }
        }
        if (allowThrow && bat === -1) {
          const t = nb(a, d, 2);
          if (t >= 0 && !noLand[t] && c[t] === 0 && top(c, t) <= ha + 1 + 1e-9)
            out.push({ kind: 'throw', a, d, t, h: ha, counts: c, bat: t, from: a });
        }
      }
    }
    if (bat >= 0 && rs[bat] && c[bat] === 0) out.push({ kind: 'pickup', t: bat, counts: c, bat: -1, from: bat });
    return out;
  }
  function solve({ maxStates = 3e6 } = {}) {
    const c0 = P.counts.slice(), r0 = reach(c0, P.start), k0 = key(c0, -1, r0);
    const parent = new Map([[k0, null]]);
    let frontier = [{ c: c0, bat: -1, from: P.start, k: k0 }], depth = 0;
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        const rs = reach(s.c, s.from);
        if (goal(s.c, s.bat, rs)) {
          const path = []; let k = s.k; while (parent.get(k)) { const p = parent.get(k); path.push(p.move); k = p.k; }
          return { solved: true, moves: depth, path: path.reverse(), states: parent.size };
        }
        const seenMv = new Set();
        for (const mv of moves(s.c, s.bat, rs)) {
          const k2 = key(mv.counts, mv.bat, reach(mv.counts, mv.from));
          if (parent.has(k2) || seenMv.has(k2)) continue; seenMv.add(k2);
          parent.set(k2, { k: s.k, move: mv });
          next.push({ c: mv.counts, bat: mv.bat, from: mv.from, k: k2 });
        }
        if (parent.size > maxStates) return { solved: false, reason: 'state cap', states: parent.size };
      }
      frontier = next; depth++;
    }
    return { solved: false, reason: 'exhausted', states: parent.size };
  }
  // the whole state graph + which states can still reach the goal
  function analyse({ maxStates = 1e6 } = {}) {
    const c0 = P.counts.slice(), k0 = key(c0, -1, reach(c0, P.start));
    const nodes = new Map([[k0, { c: c0, bat: -1, from: P.start, goal: false }]]), edges = new Map([[k0, []]]);
    const q = [k0];
    for (let h = 0; h < q.length && nodes.size < maxStates; h++) {
      const ks = q[h], s = nodes.get(ks), rs = reach(s.c, s.from);
      s.goal = goal(s.c, s.bat, rs);
      for (const mv of moves(s.c, s.bat, rs)) {
        const k2 = key(mv.counts, mv.bat, reach(mv.counts, mv.from));
        edges.get(ks).push(k2);
        if (!nodes.has(k2)) { nodes.set(k2, { c: mv.counts, bat: mv.bat, from: mv.from, goal: false }); edges.set(k2, []); q.push(k2); }
      }
    }
    const rev = new Map(); for (const [k, es] of edges) for (const e of es) { if (!rev.has(e)) rev.set(e, []); rev.get(e).push(k); }
    const alive = new Set(), st = [...nodes].filter(([, v]) => v.goal).map(([k]) => k);
    for (const k of st) alive.add(k);
    while (st.length) { const k = st.pop(); for (const p of rev.get(k) || []) if (!alive.has(p)) { alive.add(p); st.push(p); } }
    const first = [...new Set(edges.get(k0))].map(k => alive.has(k));
    return { states: nodes.size, capped: nodes.size >= maxStates, alive: alive.size, deadPct: +(100 * (1 - alive.size / nodes.size)).toFixed(1),
             firstMoves: first.length, firstMovesDead: first.filter(x => !x).length };
  }
  return { P, solve, analyse, reach, top, W, H };
}

function describe(path, W, base) {
  const xy = i => `(${i % W},${Math.floor(i / W)})`;
  return path.map(m => m.kind === 'push' ? `push ${xy(m.b)}→${DN[m.d]}`
    : m.kind === 'throw' ? `throw from ${xy(m.a)} h${m.h} ${DN[m.d]}→${xy(m.t)}` : `pick up at ${xy(m.t)}`);
}

module.exports = { makeSolver, describe, parse };

if (require.main === module) {
  const rooms = require(process.argv[2] || './l3-rooms3.cjs');
  for (const [name, room] of Object.entries(rooms)) {
    const t0 = Date.now(), S = makeSolver(room), r = S.solve(), a = S.analyse();
    const nt = makeSolver(room, { throws: false }).solve();
    console.log(`\n== ${name} ==  ${Date.now() - t0} ms`);
    console.log(room.map.join('\n'));
    console.log(r.solved ? `solvable in ${r.moves} moves` : `NOT solvable (${r.reason})`);
    if (r.solved) describe(r.path, S.W).forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    console.log(`state space ${a.states}${a.capped ? '+ (capped)' : ''}, dead-end states ${a.deadPct}%, opening moves ${a.firstMoves} of which ${a.firstMovesDead} are already lost`);
    console.log(`without throwing: ${nt.solved ? 'SOLVABLE (bad)' : 'not solvable'}`);
  }
}
