// Search for hard-but-fair layouts for Level 3 room 3 (boxes + battery + 4 plates), using tools/l3-solver3.cjs.
//   SEED=3 node tools/l3-gen3.cjs 3000
const { makeSolver, describe } = require('./l3-solver3.cjs');

let seed = +(process.env.SEED || 7);
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = a => a[Math.floor(rand() * a.length)];
const tries = (process.argv[2] === "core" || process.argv[2] === "ledge") ? 0 : +(process.argv[2] || 2000);

// pens: pedestal cell + its fence cells (the frame's walls close the other sides)
const PENS = [
  { p: [7, 1], f: [[6, 1], [7, 2], [6, 2]] },
  { p: [7, 7], f: [[6, 7], [7, 6], [6, 6]] },
  { p: [4, 1], f: [[3, 1], [5, 1], [4, 2], [3, 2], [5, 2]] },
  { p: [6, 2], f: [[5, 2], [7, 2], [6, 1], [6, 3], [5, 1], [7, 1], [5, 3], [7, 3]] },
  { p: [5, 6], f: [[4, 6], [6, 6], [5, 5], [5, 7], [4, 5], [6, 5], [4, 7], [6, 7]] },
];

const results = [];
const t0 = Date.now();
for (let t = 0; t < tries; t++) {
  const rows = ['#########', '#.......#', '#.......#', '#.......#', 'n.......#', '#.......#', '#.......#', '#.......#', '#########'].map(r => r.split(''));
  const used = new Set(['1,4', '2,4']);
  const pen = pick(PENS);
  const ph = rand() < 0.6 ? 2 : 3;
  rows[pen.p[1]][pen.p[0]] = String(ph); used.add(pen.p.join());
  for (const [x, z] of pen.f) { rows[z][x] = 'F'; used.add(x + ',' + z); }
  const free = () => { const out = []; for (let z = 1; z < 8; z++) for (let x = 1; x < 8; x++) if (!used.has(x + ',' + z)) out.push([x, z]); return out; };
  const take = () => { const f = free(); const c = pick(f); used.add(c.join()); return c; };
  // ledges: a few raised blobs
  const nLedge = 1 + Math.floor(rand() * 3);
  for (let k = 0; k < nLedge; k++) {
    const h = pick(['1', '1', '2', '2', '3']); let [x, z] = take(); rows[z][x] = h;
    const len = Math.floor(rand() * 3);
    for (let j = 0; j < len; j++) { const d = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]); x += d[0]; z += d[1]; if (x < 1 || z < 1 || x > 7 || z > 7 || used.has(x + ',' + z)) break; rows[z][x] = h; used.add(x + ',' + z); }
  }
  const nWalls = Math.floor(rand() * 4);
  for (let k = 0; k < nWalls; k++) { const [x, z] = take(); rows[z][x] = '#'; }
  // three more plates anywhere walkable (floor or ledge), not the start cells
  const cand = []; for (let z = 1; z < 8; z++) for (let x = 1; x < 8; x++) if (/[.123]/.test(rows[z][x]) && !(x === pen.p[0] && z === pen.p[1]) && !(z === 4 && x <= 2)) cand.push([x, z]);
  const plates = [pen.p]; while (plates.length < 4 && cand.length) plates.push(cand.splice(Math.floor(rand() * cand.length), 1)[0]);
  const nBox = 2 + Math.floor(rand() * 3);
  const crates = [];
  for (let k = 0; k < nBox; k++) { const f = free().filter(([x, z]) => rows[z][x] === '.' && !plates.some(p => p[0] === x && p[1] === z)); if (!f.length) break; const c = pick(f); used.add(c.join()); crates.push(c); }
  const map = rows.map(r => r.join(''));
  const room = { map, plates, crates, start: [1, 4] };
  let r;
  try { r = makeSolver(room).solve({ maxStates: 1.5e5 }); } catch (e) { continue; }
  if (!r.solved || r.moves < 13) continue;
  const a = makeSolver(room).analyse({ maxStates: 1.5e5 });
  if (a.capped) continue;
  const throwsUsed = r.path.filter(m => m.kind === 'throw').length;
  results.push({ room, moves: r.moves, dead: a.deadPct, lost: a.firstMovesDead, first: a.firstMoves, states: a.states, throwsUsed, path: describe(r.path, 9) });
}
if (!['core','ledge'].includes(process.argv[2])) {
results.sort((a, b) => (b.moves + b.dead / 5 + b.lost * 2) - (a.moves + a.dead / 5 + a.lost * 2));
for (const r of results.slice(0, 8)) {
  console.log(`\nmoves ${r.moves}  dead ${r.dead}%  lost openers ${r.lost}/${r.first}  states ${r.states}  throws ${r.throwsUsed}`);
  console.log(r.room.map.join('\n')); console.log('plates', JSON.stringify(r.room.plates), 'crates', JSON.stringify(r.room.crates));
  console.log(r.path.join(' | '));
}
console.log(`\n${results.length} candidates with >=13 moves out of ${tries} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// ---- mode "core": the intended core fixed, walls/ledges/boxes searched around it ----
//   SEED=1 node tools/l3-gen3.cjs core 3000
if (process.argv[2] === 'core') {
  const N = +(process.argv[3] || 2000), found = [];
  const T0 = Date.now();
  for (let t = 0; t < N; t++) {
    const rows = ['#########', '#....#F2#', '#....#FF#', '#.....2.#', 'n.......#', '#.......#', '#.......#', '#.......#', '#########'].map(r => r.split(''));
    const fixed = new Set(['1,4', '2,4', '7,3', '6,3', '7,4']);
    const cells = []; for (let z = 1; z < 8; z++) for (let x = 1; x < 8; x++) if (rows[z][x] === '.' && !fixed.has(x + ',' + z)) cells.push([x, z]);
    const takeC = () => cells.splice(Math.floor(rand() * cells.length), 1)[0];
    const nWalls = 5 + Math.floor(rand() * 8);
    for (let k = 0; k < nWalls; k++) { const [x, z] = takeC(); rows[z][x] = '#'; }
    const nLedge = Math.floor(rand() * 4);
    for (let k = 0; k < nLedge; k++) { const [x, z] = takeC(); rows[z][x] = pick(['1', '1', '2']); }
    const X = takeC();
    const nBox = 2 + Math.floor(rand() * 2);
    const crates = []; for (let k = 0; k < nBox; k++) { const c = takeC(); if (rows[c[1]][c[0]] === '2') { rows[c[1]][c[0]] = '1'; } crates.push(c); }
    const room = { map: rows.map(r => r.join('')), plates: [[7, 1], [7, 3], [6, 3], X], crates, start: [1, 4] };
    let r; try { r = makeSolver(room).solve({ maxStates: 1e5 }); } catch (e) { continue; }
    if (!r.solved || r.moves < 12) continue;
    const a = makeSolver(room).analyse({ maxStates: 1e5 });
    if (a.capped || a.deadPct < 60) continue;
    found.push({ room, moves: r.moves, dead: a.deadPct, lost: a.firstMovesDead, first: a.firstMoves, states: a.states, path: describe(r.path, 9) });
  }
  found.sort((a, b) => (b.moves * 2 + b.dead / 4 + b.lost * 2) - (a.moves * 2 + a.dead / 4 + a.lost * 2));
  for (const r of found.slice(0, 6)) {
    console.log(`\nmoves ${r.moves}  dead ${r.dead}%  lost openers ${r.lost}/${r.first}  states ${r.states}`);
    console.log(r.room.map.join('\n')); console.log('plates', JSON.stringify(r.room.plates), 'crates', JSON.stringify(r.room.crates));
    console.log(r.path.join(' | '));
  }
  console.log(`\n${found.length} candidates out of ${N} (${((Date.now() - T0) / 1000).toFixed(0)} s)`);
}

// ---- mode "ledge": the stand can only be filled by dropping a box off a 2-high ledge (the ledge tile in line with
// the pen is 3 away: the decoy); getting onto the ledge needs a step box. Walls/ledge shape/boxes/4th plate searched.
//   SEED=1 node tools/l3-gen3.cjs ledge 2000
if (process.argv[2] === 'ledge') {
  const N = +(process.argv[3] || 2000), found = [];
  const T0 = Date.now();
  for (let t = 0; t < N; t++) {
    const rows = ['#########', '#....#F2#', '#....#FF#', '#.....2.#', 'n.....#2#', '#......2#', '#.......#', '#.......#', '#########'].map(r => r.split(''));
    const fixed = new Set(['1,4', '2,4', '7,3', '6,3', '7,4', '7,5']);
    // grow the 2-high ledge from (7,5) by a random walk
    let [x, z] = [7, 5]; const ledge = [[7, 5]];
    const L = 3 + Math.floor(rand() * 5);
    for (let k = 0; k < 40 && ledge.length < L; k++) {
      const d = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]); const nx = x + d[0], nz = z + d[1];
      if (nx < 2 || nz < 3 || nx > 7 || nz > 7 || fixed.has(nx + ',' + nz)) continue;
      x = nx; z = nz; if (rows[z][x] !== '2') { rows[z][x] = '2'; ledge.push([x, z]); }
    }
    const cells = []; for (let zz = 1; zz < 8; zz++) for (let xx = 1; xx < 8; xx++) if (rows[zz][xx] === '.' && !fixed.has(xx + ',' + zz)) cells.push([xx, zz]);
    const takeC = () => cells.splice(Math.floor(rand() * cells.length), 1)[0];
    const nWalls = 3 + Math.floor(rand() * 7);
    for (let k = 0; k < nWalls; k++) { const [a, b] = takeC(); rows[b][a] = '#'; }
    if (rand() < 0.5) { const [a, b] = takeC(); rows[b][a] = '1'; }
    const b1 = pick(ledge.filter(([a, b]) => !(a === 7 && b === 5)));
    if (!b1) continue;
    const nFloorBoxes = 1 + (rand() < 0.35 ? 1 : 0);
    const crates = [b1]; for (let k = 0; k < nFloorBoxes; k++) crates.push(takeC());
    const X = takeC();
    const room = { map: rows.map(r => r.join('')), plates: [[7, 1], [7, 3], [6, 3], X], crates, start: [1, 4] };
    let r; try { r = makeSolver(room).solve({ maxStates: 1e5 }); } catch (e) { continue; }
    if (!r.solved || r.moves < 12) continue;
    const a = makeSolver(room).analyse({ maxStates: 1.2e5 });
    if (a.capped || a.deadPct < 70) continue;
    found.push({ room, moves: r.moves, dead: a.deadPct, lost: a.firstMovesDead, first: a.firstMoves, states: a.states, path: describe(r.path, 9) });
  }
  found.sort((a, b) => (b.moves * 2 + b.dead / 3 + b.lost * 2) - (a.moves * 2 + a.dead / 3 + a.lost * 2));
  for (const r of found.slice(0, 6)) {
    console.log(`\nmoves ${r.moves}  dead ${r.dead}%  lost openers ${r.lost}/${r.first}  states ${r.states}`);
    console.log(r.room.map.join('\n')); console.log('plates', JSON.stringify(r.room.plates), 'crates', JSON.stringify(r.room.crates));
    console.log(r.path.join(' | '));
  }
  console.log(`\n${found.length} candidates out of ${N} (${((Date.now() - T0) / 1000).toFixed(0)} s)`);
}
