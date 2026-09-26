// Level 3 prototype, room 2 (the archive tower). Plays with the real controls: WASD faces, ↑ moves forward.
//   node tools/test-l3room2.cjs   (needs the local server on 8770 and PLAYWRIGHT)
// 1. exploit checks (diagonal jump, gap jump, decoy stack) must never reach the 4-high platform
// 2. the solver's shortest solution, replayed push by push, builds the tower; then the climb with real jumps
// 3. the "too high" tag shows when walking into a ledge more than one crate taller
// 4. the two debug buttons
const { chromium } = require(process.env.PLAYWRIGHT);
const { makeSolver } = require('./l3-solver.cjs');
const rooms = require('./l3-rooms.cjs');
const FACEKEY = ['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'];                 // solver dirs E,W,S,N → facing keys (+x,-x,+z,-z)
const PAGE_HELPERS = `
  window.PRESS=(L,keys)=>{ const F={ArrowUp:[-1,0],ArrowRight:[0,-1],ArrowDown:[1,0],ArrowLeft:[0,1]}; L.held.clear(); L.setFacing(keys[0]); L.held.add('KeyW');
    if (keys[1]) { const f=F[keys[0]], s=F[keys[1]], r=[-f[1],f[0]]; L.held.add(s[0]===r[0]&&s[1]===r[1]?'KeyD':'KeyA'); } };
  window.UNLOCK=L=>{ L.bot.x=3.5; L.bot.z=9.6; L.update(1/60); L.act(); L.type('4291'); L.key('Enter'); };`;
(async () => {
  const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist'] });
  const open = async () => { const p = await b.newPage({ viewport:{ width:1280, height:800 } }); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8770/proto/'); await p.waitForFunction(()=>window.levelReady,null,{timeout:60000});
    await p.addScriptTag({ content: PAGE_HELPERS }); await p.evaluate(()=>{ __level.start(); __level.setScheme('relative'); __level.test.manual=true; UNLOCK(__level); }); return {p,errs}; };

  // 1. exploits
  const exploit = async (name, moves, sx, sz, keysList) => {
    const {p} = await open();
    const r = await p.evaluate(({moves,sx,sz,keysList})=>{
      const L=__level, dt=1/60, K={E:'ArrowDown',W:'ArrowUp',S:'ArrowLeft',N:'ArrowRight'}, D={E:[1,0],W:[-1,0],S:[0,1],N:[0,-1]}; const ok=[];
      for (const [x,z,d] of moves){ const [dx,dz]=D[d]; Object.assign(L.bot,{x:x-dx+0.5,z:z-dz+0.5,y:L.topU(x-dx,z-dz)*L.U,vy:0,grounded:true});
        const n=L.stacks[L.I(x,z)].length; PRESS(L,[K[d]]); for(let f=0;f<90&&L.stacks[L.I(x,z)].length===n;f++) L.update(dt); L.held.clear(); for(let f=0;f<25;f++) L.update(dt); ok.push(L.stacks[L.I(x,z)].length<n); }
      let best=0; for (const ox of [-0.25,0,0.25]) for (const oz of [-0.25,0,0.25]) for (const ks of keysList) for (const jf of [0,4,8]) {
        Object.assign(L.bot,{x:sx+0.5+ox,z:sz+0.5+oz,y:L.topU(sx,sz)*L.U,vy:0,grounded:true}); PRESS(L,ks);
        for(let f=0;f<70;f++){ if(f===jf) L.jump(); L.update(dt); best=Math.max(best,L.bot.y); } L.held.clear(); }
      return { setup: ok.every(Boolean), reached: L.reachedPlatform, maxY:+best.toFixed(2) };
    }, {moves,sx,sz,keysList});
    console.log(`exploit ${name}:`, !r.setup ? 'SETUP FAILED' : r.reached ? 'BROKEN (reached the platform)' : `blocked ✓ (max height ${r.maxY})`);
    await p.close();
  };
  await exploit('diagonal jump from the shelf crate', [[6,2,'W'],[5,2,'W'],[4,2,'W']], 3, 2, [['ArrowUp','ArrowLeft'],['ArrowUp'],['ArrowLeft']]);
  await exploit('gap jump from a 3-high stack on the walkway', [[6,2,'W'],[5,2,'W'],[5,3,'W'],[4,2,'S']], 4, 3, [['ArrowUp'],['ArrowUp','ArrowRight'],['ArrowUp','ArrowLeft']]);
  await exploit('decoy 2-high stack by the little walkway', [[6,7,'W'],[5,7,'W'],[4,7,'N'],[4,6,'N'],[4,5,'W'],[3,5,'W'],[2,6,'N']], 2, 5, [['ArrowRight'],['ArrowDown'],['ArrowUp']]);

  // 2. solver replay + climb
  const {p, errs} = await open();
  const S = makeSolver(rooms.archive); const sol = S.solve(rooms.archive.goal);
  const plan = sol.path.map(m => ({ a:[m.a%S.W, Math.floor(m.a/S.W)], b:[m.b%S.W, Math.floor(m.b/S.W)], c:[m.c%S.W, Math.floor(m.c/S.W)], key:FACEKEY[m.d] }));
  const rep = await p.evaluate(plan=>{ const L=__level, dt=1/60;
    for (const [k,m] of plan.entries()){ const [ax,az]=m.a,[bx,bz]=m.b,[cx,cz]=m.c;
      Object.assign(L.bot,{x:ax+0.5,z:az+0.5,y:L.topU(ax,az)*L.U,vy:0,grounded:true});
      const n=L.stacks[L.I(bx,bz)].length, nc=L.stacks[L.I(cx,cz)].length; PRESS(L,[m.key]);
      let ok=false; for(let f=0;f<90;f++){ L.update(dt); if(L.stacks[L.I(bx,bz)].length<n){ok=true;break;} } L.held.clear(); for(let f=0;f<25;f++) L.update(dt);
      if (!ok || L.stacks[L.I(cx,cz)].length!==nc+1) return `FAILED at push ${k+1}`; }
    return 'ok'; }, plan);
  console.log(`solver replay (${plan.length} pushes):`, rep, '| tower height', await p.evaluate(()=>__level.stacks[__level.I(3,3)].length));
  const hop = async (key, jumpAt=2) => p.evaluate(({key,jumpAt})=>{ const L=__level; PRESS(L,[key]); for(let f=0;f<45;f++){ if(f===jumpAt) L.jump(); L.update(1/60);} L.held.clear(); for(let f=0;f<20;f++) L.update(1/60); return +L.bot.y.toFixed(2); }, {key,jumpAt});
  await p.evaluate(()=>{ const L=__level; Object.assign(L.bot,{x:3.5,z:2.5,y:1.6,vy:0,grounded:true}); });
  console.log('climb: shelf → tower y', await hop('ArrowLeft'), '→ platform y', await hop('ArrowUp'), '| on top:', await p.evaluate(()=>__level.reachedPlatform));
  const files = await p.evaluate(()=>{ const items=()=>[...document.querySelectorAll('#f-grid .f-item')];
    const out=[`${items().length} items in ${document.getElementById('f-path').textContent}`];
    for (let k=0;k<4;k++){ const el=items().find(e=>/Psst|flag is not|delivery belt|only needs/.test(e.textContent)); if (!el) break; el.click(); out.push(document.getElementById('f-path').textContent.split('/').pop()); }
    out.push(document.getElementById('f-grid').textContent); return out; });
  console.log('file browser:', JSON.stringify(files));
  console.log('notes:', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('#note-list li')].map(l=>l.textContent).filter(t=>t.startsWith('Folder')))), '| terminalRead:', await p.evaluate(()=>__level.terminalRead));
  await p.evaluate(()=>__level.key('Escape'));

  // 3. too-high tag: walk from the floor into the 4-high platform
  await p.evaluate(()=>{ const L=__level; Object.assign(L.bot,{x:2.5,z:5.5,y:0,vy:0,grounded:true}); PRESS(L,['ArrowRight']); for(let f=0;f<30;f++) L.update(1/60); L.held.clear(); });
  console.log('"too high" tag shown when walking into the platform:', await p.isVisible('#toohigh'));

  // 4. debug buttons on a fresh page (with the real loop running)
  const q = await b.newPage({ viewport:{ width:1280, height:800 } }); await q.goto('http://localhost:8770/proto/'); await q.waitForFunction(()=>window.levelReady,null,{timeout:60000});
  await q.click('#start'); await q.click('#debug-toggle'); await q.click('#dbg-door');
  console.log('debug "open the door":', await q.evaluate(()=>__level.vaultOpen));
  await q.click('#dbg-top'); await q.waitForTimeout(600);
  console.log('debug "on top": y', await q.evaluate(()=>__level.bot.y.toFixed(2)), '| reached platform:', await q.evaluate(()=>__level.reachedPlatform));
  console.log('errors:', errs);
  await b.close();
})();
