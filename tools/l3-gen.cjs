// Search for hard-but-fair crate layouts using tools/l3-solver.cjs.
//   node l3-gen.cjs dock 4000        → best dock layouts
//   node l3-gen.cjs archive 4000     → best archive (stair-stack) layouts
const { makeSolver, describe } = require('./l3-solver.cjs');

let seed = +(process.env.SEED || 7);
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = a => a[Math.floor(rand() * a.length)];

// how many times the solution switches from one crate to another (a better difficulty proxy than raw pushes)
function crateSwitches(path, counts0, W) {
  // track crate identity by following cells
  let cells = []; counts0.forEach((n, i) => { for (let k = 0; k < n; k++) cells.push(i); });
  let last = -1, sw = 0;
  for (const m of path) {
    // the pushed crate is the top one at m.b: pick the last-listed crate at that cell
    let id = -1; for (let j = cells.length - 1; j >= 0; j--) if (cells[j] === m.b) { id = j; break; }
    if (id !== last && last !== -1) sw++;
    last = id; cells[id] = m.c;
  }
  return sw;
}

function evaluate(room) {
  const S = makeSolver(room);
  const r = S.solve(room.goal, { maxStates: 4e5 });
  if (!r.solved) return null;
  const a = S.analyse(room.goal, { maxStates: 2e5 });
  return { pushes: r.pushes, switches: crateSwitches(r.path, S.P.counts, S.W), deadPct: a.deadPct, firstDead: a.firstMovesDead, firstMoves: a.firstMoves, states: a.states, path: describe(r.path, S.W) };
}

const mode = process.argv[2] || 'dock';
const tries = +(process.argv[3] || 2000);

if (mode === 'dock') {
  // Zone 2 of the dock: Albert enters through the door at the left. Two crates, the power plate b,
  // and the conveyor intake '>' tucked in the top-right nook (walls N and E, so a crate can only go in
  // from the west or the south). Goal: a crate on b, a crate on '>', and Albert able to climb onto it.
  const frame = [
    '#########',
    '#......>#',
    '#.......#',
    '@.......#',
    '#.......#',
    '#.......#',
    '#########',
  ];
  const W = frame[0].length, H = frame.length;
  const interior = [];
  for (let z = 1; z < H - 1; z++) for (let x = 1; x < W - 1; x++) if (frame[z][x] === '.') interior.push([x, z]);
  const results = [];
  for (let t = 0; t < tries; t++) {
    const rows = frame.map(r => r.split(''));
    const used = new Set(['7,1', '1,3', '2,3']);                     // keep the intake and the doorway clear
    const take = () => { for (;;) { const c = pick(interior); const k = c.join(); if (!used.has(k)) { used.add(k); return c; } } };
    const nWalls = 4 + Math.floor(rand() * 4);
    for (let k = 0; k < nWalls; k++) { const [x, z] = take(); rows[z][x] = '#'; }
    const [bx, bz] = take(); rows[bz][bx] = 'b';
    const crates = [take(), take()];
    const map = rows.map(r => r.join(''));
    const inIdx = 1 * W + 7, bIdx = bz * W + bx;
    const room = { map, crates, goal: (counts, rs) => counts[bIdx] > 0 && counts[inIdx] > 0 && rs[inIdx] };
    const ev = evaluate(room);
    if (ev && ev.pushes >= 14) results.push({ ...ev, map, crates });
  }
  results.sort((a, b) => (b.switches * 3 + b.pushes + b.firstDead * 2) - (a.switches * 3 + a.pushes + a.firstDead * 2));
  for (const r of results.slice(0, 6)) {
    console.log(`\npushes ${r.pushes}  crate-switches ${r.switches}  dead ${r.deadPct}%  lost-openers ${r.firstDead}/${r.firstMoves}  states ${r.states}`);
    console.log(r.map.join('\n')); console.log('crates', JSON.stringify(r.crates)); console.log(r.path);
  }
  console.log(`\n${results.length} candidates with >=14 pushes out of ${tries}`);
}

if (mode === 'archive') {
  // The stair-stack room with random floor pillars and a random start for the floor crate F.
  const frame = [
    '#########',
    '#22222###',
    '#22222###',
    '#s111.44#',
    '#.....44#',
    '#.......#',
    '#.......#',
    '#.......#',
    '####@####',
  ];
  const W = frame[0].length, H = frame.length;
  const floor = [];
  for (let z = 4; z < H - 1; z++) for (let x = 1; x < W - 1; x++) if (frame[z][x] === '.') floor.push([x, z]);
  const results = [];
  for (let t = 0; t < tries; t++) {
    const rows = frame.map(r => r.split(''));
    const used = new Set(['5,4', '4,7', '1,4']);
    const take = () => { for (;;) { const c = pick(floor); const k = c.join(); if (!used.has(k)) { used.add(k); return c; } } };
    const nWalls = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < nWalls; k++) { const [x, z] = take(); rows[z][x] = '#'; }
    const F = take();
    const W1 = pick([[2, 3], [3, 3], [4, 3]]);
    const W2 = pick([[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [4, 1]]);
    const map = rows.map(r => r.join(''));
    const room = { map, crates: [F, W1, W2], goal: (counts, rs, P) => { for (let i = 0; i < P.N; i++) if (rs[i] && P.base[i] === 4 && counts[i] === 0) return true; return false; } };
    const ev = evaluate(room);
    if (ev && ev.pushes >= 12) results.push({ ...ev, map, crates: room.crates });
  }
  results.sort((a, b) => (b.switches * 3 + b.pushes + b.firstDead * 2) - (a.switches * 3 + a.pushes + a.firstDead * 2));
  for (const r of results.slice(0, 5)) {
    console.log(`\npushes ${r.pushes}  crate-switches ${r.switches}  dead ${r.deadPct}%  lost-openers ${r.firstDead}/${r.firstMoves}  states ${r.states}`);
    console.log(r.map.join('\n')); console.log('crates', JSON.stringify(r.crates)); console.log(r.path);
  }
  console.log(`\n${results.length} candidates with >=12 pushes out of ${tries}`);
}

if (mode === 'dock3') {
  // Three crates, three jobs at once: plate b (conveyor power), plate c (intake gate), and the intake '>'
  // with Albert able to climb onto that crate. Bigger frame.
  const frame = [
    '##########',
    '#.......>#',
    '#........#',
    '@........#',
    '#........#',
    '#........#',
    '#........#',
    '##########',
  ];
  const W = frame[0].length, H = frame.length;
  const interior = [];
  for (let z = 1; z < H - 1; z++) for (let x = 1; x < W - 1; x++) if (frame[z][x] === '.') interior.push([x, z]);
  const results = [];
  for (let t = 0; t < tries; t++) {
    const rows = frame.map(r => r.split(''));
    const used = new Set(['8,1', '1,3', '2,3']);
    const take = () => { for (;;) { const c = pick(interior); const k = c.join(); if (!used.has(k)) { used.add(k); return c; } } };
    const nWalls = 5 + Math.floor(rand() * 5);
    for (let k = 0; k < nWalls; k++) { const [x, z] = take(); rows[z][x] = '#'; }
    const [bx, bz] = take(); rows[bz][bx] = 'b';
    const [cx, cz] = take(); rows[cz][cx] = 'c';
    const crates = [take(), take(), take()];
    const map = rows.map(r => r.join(''));
    const inIdx = 1 * W + 8, bIdx = bz * W + bx, cIdx = cz * W + cx;
    const room = { map, crates, goal: (counts, rs) => counts[bIdx] > 0 && counts[cIdx] > 0 && counts[inIdx] > 0 && rs[inIdx] };
    let ev; try { ev = evaluate(room); } catch (e) { ev = null; }
    if (ev && ev.pushes >= 20) results.push({ ...ev, map, crates });
  }
  results.sort((a, b) => (b.switches * 3 + b.pushes + b.firstDead * 2) - (a.switches * 3 + a.pushes + a.firstDead * 2));
  for (const r of results.slice(0, 5)) {
    console.log(`\npushes ${r.pushes}  crate-switches ${r.switches}  dead ${r.deadPct}%  lost-openers ${r.firstDead}/${r.firstMoves}  states ${r.states}`);
    console.log(r.map.join('\n')); console.log('crates', JSON.stringify(r.crates)); console.log(r.path);
  }
  console.log(`\n${results.length} candidates with >=20 pushes out of ${tries}`);
}
