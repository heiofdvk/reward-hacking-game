// Search archive variants for a "decoy": a second spot next to the platform where you can build a 2-high
// stack (it looks like progress) but which can never become a climbable 3-high tower. Committing the walkway
// crate there is a mistake you only discover later.
const { makeSolver, describe } = require('./l3-solver.cjs');
let seed = +(process.env.SEED || 3); const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); const pick = a => a[Math.floor(rand() * a.length)];
const onPlatform = (counts, rs, P) => { for (let i = 0; i < P.N; i++) if (rs[i] && P.base[i] === 4 && counts[i] === 0) return true; return false; };
const base = ['#########','#22222###','#22222###','#s111.44#','#.....44#','##.....##','#....#..#','#.......#','####@####'];
const W = 9, platAdj = [[5,3],[5,4],[6,5]];
const tries = +(process.argv[2] || 3000), out = [];
for (let t = 0; t < tries; t++) {
  const rows = base.map(r => r.split(''));
  // a second little walkway (1U) somewhere on the floor, 1-3 tiles long, plus a stair-free approach via crates
  const n = 1 + Math.floor(rand() * 3), horiz = rand() < 0.5;
  const sx = 2 + Math.floor(rand() * 5), sz = 4 + Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) { const x = horiz ? sx + k : sx, z = horiz ? sz : sz + k; if (x > 0 && x < 8 && z > 3 && z < 8 && rows[z][x] === '.') rows[z][x] = '1'; }
  // pillars
  for (let k = 0, m = Math.floor(rand() * 3); k < m; k++) { const x = 1 + Math.floor(rand() * 7), z = 5 + Math.floor(rand() * 3); if (rows[z][x] === '.') rows[z][x] = '#'; }
  const map = rows.map(r => r.join(''));
  // crates: F on the floor, W1 on the walkway, W2 on the shelf, plus optionally a 4th crate on the new walkway
  const floors = [], walks = [];
  for (let z = 4; z < 8; z++) for (let x = 1; x < 8; x++) { if (map[z][x] === '.') floors.push([x, z]); if (map[z][x] === '1') walks.push([x, z]); }
  if (!floors.length) continue;
  const crates = [pick(floors), pick([[2,3],[3,3]]), pick([[1,1],[2,1],[3,1],[2,2],[3,2]])];
  if (walks.length && rand() < 0.6) crates.push(pick(walks));
  const room = { map, crates, goal: onPlatform };
  let S, r; try { S = makeSolver(room); r = S.solve(onPlatform, { maxStates: 3e5 }); } catch (e) { continue; }
  if (!r.solved || r.pushes < 14) continue;
  // decoy: a reachable state with >=2 crates on a platform-adjacent cell other than (5,3), from which the goal is lost
  let decoy = null;
  for (const [x, z] of platAdj) { if (x === 5 && z === 3) continue; const i = z * W + x;
    const a = S.analyse((c) => c[i] >= 2, { maxStates: 1.5e5 }); if (a.alive > 0) { decoy = [x, z]; break; } }
  if (!decoy) continue;
  const an = S.analyse(onPlatform, { maxStates: 1.5e5 });
  out.push({ map, crates, pushes: r.pushes, decoy, dead: an.deadPct, lost: `${an.firstMovesDead}/${an.firstMoves}`, path: describe(r.path, W) });
}
out.sort((a, b) => b.pushes - a.pushes);
for (const o of out.slice(0, 5)) { console.log(`\npushes ${o.pushes} · decoy at ${o.decoy} · dead ${o.dead}% · lost openers ${o.lost}`); console.log(o.map.join('\n')); console.log('crates', JSON.stringify(o.crates)); console.log(o.path); }
console.log(`\n${out.length} with a decoy out of ${tries}`);
