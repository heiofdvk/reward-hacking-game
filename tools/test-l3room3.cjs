// Level 3 prototype, room 3 (the battery room) and the dock: room 3's door, the battery, the 4-plate puzzle
// (replaying tools/l3-solver3.cjs's solution), then the delivery belt's console and the ride out.
//   node tools/test-l3room3.cjs   (needs the local server on 8770 and PLAYWRIGHT)
const { chromium } = require(process.env.PLAYWRIGHT);
const { prepareShipping } = require('./sandbox-fixtures.cjs');
(async () => {
  const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport:{ width:1280, height:800 } });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8770/proto/'); await p.waitForFunction(()=>window.levelReady,null,{timeout:60000});
  await p.click('#start');
  const L = f => p.evaluate(f);
  const put = (x,z,y=0) => p.evaluate(([x,z,y])=>Object.assign(__level.bot,{x,z,y,vy:0,grounded:true}), [x,z,y]);
  const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); await p.waitForTimeout(400); };
  // 1. before room 2 is solved the east door is shut (even with the north door open)
  await p.evaluate(() => { __level.zones.find(zone => zone.name === 'exitpad').act(); __level.type('4291'); __level.key('Enter'); });
  await put(7.5,12.5); await hold('d', 700);
  console.log('east door before the platform: open', await L(()=>__level.eastOpen), '| walk east → x', await L(()=>+__level.bot.x.toFixed(2)), '(stops at 8)');
  // 2. reaching the platform opens it; pick up the battery there
  await put(2.5, 3.5, 3.2); await p.waitForTimeout(500);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('after reaching the platform: east door open', await L(()=>__level.eastOpen), '| toast:', await p.textContent('#toast'));
  await put(1.9,4.3,3.2); await p.waitForTimeout(300); await p.keyboard.press('e'); await p.waitForTimeout(300);
  console.log('picked up:', await L(()=>__level.carry));
  // 3. carry it through the east door into room 3
  await put(7.5,12.5); await hold('d', 1100);
  console.log('walk east through the door → x', await L(()=>+__level.bot.x.toFixed(2)), '| room', await L(()=>__level.bot.x>9?'battery room':'vault'));
  // 4. room 3: replay the solver's shortest solution (pushes, throws, pickups) through the real engine
  const S3 = require('./l3-solver3.cjs').makeSolver(require('./l3-rooms3.cjs').ante), DN=['E','W','S','N'];
  const plan = S3.solve().path.map(m=>({ type:m.kind, stand:[m.a%S3.W, Math.floor(m.a/S3.W)], dir:DN[m.d] }));   // local coords
  const rep = await p.evaluate(({plan})=>{ const L=__level, dt=1/60, OX=8, OZ=8; L.test.manual=true; L.setScheme('relative');
    const K={E:'ArrowDown',W:'ArrowUp',S:'ArrowLeft',N:'ArrowRight'}, D={E:[1,0],W:[-1,0],S:[0,1],N:[0,-1]};
    for (const [k,m] of plan.entries()){
      if (m.type==='pickup'){ const [tx,tz]=L.batteryTile; Object.assign(L.bot,{x:tx+0.5,z:tz+0.5,y:L.topU(tx,tz)*L.U,vy:0,grounded:true}); L.update(dt); L.act(); if (L.carry!=='battery') return `pickup ${k+1} FAILED`; continue; }
      const [sx,sz]=[m.stand[0]+OX, m.stand[1]+OZ];
      Object.assign(L.bot,{x:sx+0.5,z:sz+0.5,y:L.topU(sx,sz)*L.U,vy:0,grounded:true}); L.setFacing(K[m.dir]); L.update(dt);
      if (m.type==='push'){ const [dx,dz]=D[m.dir], bx=sx+dx, bz=sz+dz, n=L.stacks[L.I(bx,bz)].length; L.held.add('KeyW');
        let ok=false; for(let f=0;f<90;f++){ L.update(dt); if(L.stacks[L.I(bx,bz)].length<n){ok=true;break;} } L.held.clear(); for(let f=0;f<25;f++) L.update(dt);
        if (!ok) return `push ${k+1} FAILED`; }
      else { L.throwBattery(); for(let f=0;f<50;f++) L.update(dt); if (L.carry==='battery') return `throw ${k+1} bounced`; } }
    return 'ok'; }, {plan});
  console.log(`room 3 solver replay (${plan.length} moves):`, rep);
  const last = await p.evaluate(()=>{ const L=__level; const free=L.ANTE_PLATES.find(p=>!L.plateDown(...p)); if (free) Object.assign(L.bot,{x:free[0]+0.5,z:free[1]+0.5,y:L.baseU(...free)*L.U,vy:0,grounded:true}); for(let f=0;f<10;f++) L.update(1/60); L.test.manual=false; return { albertOn: free||null, solved: L.anteSolved, door: L.doorOpen }; });
  await p.waitForTimeout(200);
  console.log('Albert on the last plate', JSON.stringify(last.albertOn), '→ code printed:', last.solved, '| dock door open:', last.door, '| screen:', await p.textContent('#screen'));
  // 5. arrange the shipping-room fixture, then use the belt console
  const q = await b.newPage({ viewport:{ width:1280, height:800 } }); await q.goto('http://localhost:8770/proto/'); await q.waitForFunction(()=>window.levelReady,null,{timeout:60000});
  await q.click('#start'); await prepareShipping(q); await q.waitForTimeout(400);
  await q.keyboard.press('e'); await q.keyboard.type('1234'); await q.keyboard.press('Enter'); await q.waitForTimeout(100);
  const wrong = await q.textContent('#p-msg');
  await q.evaluate(()=>{ const L=__level; window.removedPowerCrate = L.stacks[L.I(...L.PLATE_B)].pop(); });   // take the power away
  await q.keyboard.type(await q.evaluate(()=>__level.BELT_CODE)); await q.keyboard.press('Enter'); await q.waitForTimeout(100);
  console.log('belt: wrong code →', wrong, '| right code, no power →', await q.textContent('#p-msg'));
  await q.keyboard.press('Escape'); await q.evaluate(() => { const L = __level; L.stacks[L.I(...L.PLATE_B)].push(window.removedPowerCrate); }); await prepareShipping(q); await q.waitForTimeout(300);
  await q.keyboard.press('e'); await q.keyboard.type(await q.evaluate(()=>__level.BELT_CODE)); await q.keyboard.press('Enter'); await q.waitForTimeout(4200);
  console.log('right code with power → Albert climbs in, state:', await q.evaluate(()=>__level.state));
  console.log('errors:', JSON.stringify(errs)); await b.close();
})();
