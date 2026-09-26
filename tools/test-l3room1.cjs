// Level 3 prototype, room 1 only: find the flag → racks + exit code → walk out through the door.
//   node tools/test-l3room1.cjs   (needs the local server on 8770 and PLAYWRIGHT)
const { chromium } = require(process.env.PLAYWRIGHT);
(async () => {
  const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport:{ width:1280, height:800 } });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  await p.goto('http://localhost:8770/proto/'); await p.waitForFunction(()=>window.levelReady,null,{timeout:60000});
  console.log('start card:', await p.textContent('#start-card h1'), '|', await p.textContent('#start-card .goal'));
  await p.click('#start');
  await p.evaluate(()=>__level.setScheme('relative'));   // the walk helper below turns + holds W
  console.log('goal:', await p.textContent('#obj'));
  const inRoom1 = await p.evaluate(()=>__level.AGENTS.filter(a=>a.g.position.x<8.5 && a.g.position.z>8.5 && a.g.position.z<16).map(a=>a.line));
  console.log('models in room 1:', inRoom1.length, JSON.stringify(inRoom1));
  const walk = async (key, frames) => p.evaluate(({key,frames})=>{ const L=__level; L.test.manual=true; L.held.clear(); L.setFacing(key); L.held.add('KeyW'); for(let f=0;f<frames;f++) L.update(1/60); L.held.clear(); for(let f=0;f<10;f++) L.update(1/60); L.test.manual=false; return {x:+L.bot.x.toFixed(2), z:+L.bot.z.toFixed(2)}; }, {key,frames});
  // east side is now solid wall
  await p.evaluate(()=>{ const L=__level; L.bot.x=7.5; L.bot.z=12.5; });
  console.log('walk east into the locked east door → x', (await walk('ArrowDown', 90)).x, '(wall at x=8)');
  // north door is locked
  await p.evaluate(()=>{ const L=__level; L.bot.x=4.5; L.bot.z=9.5; });
  console.log('walk north while locked → z', (await walk('ArrowRight', 90)).z, '(door at z 8-9)');
  // racks give their tags
  for (const k of ['A','B','C','D']) { await p.evaluate(k=>{ const L=__level; const z=L.zones.find(z=>z.name==='rack'+k); L.bot.x=z.x; L.bot.z=z.z; L.update(1/60); L.act(); }, k); }
  console.log('notebook:', JSON.stringify(await p.$$eval('#note-list li', l=>l.map(e=>e.textContent))));
  // exit panel: wrong, then 4291
  await p.evaluate(()=>{ const L=__level; L.bot.x=3.5; L.bot.z=9.6; L.update(1/60); L.act(); L.type('1234'); L.key('Enter'); });
  console.log('1234 →', await p.textContent('#p-msg'));
  await p.evaluate(()=>{ __level.type('4291'); __level.key('Enter'); });
  console.log('4291 → open:', await p.evaluate(()=>__level.vaultOpen), '| thought:', await p.textContent('#thought'));
  await p.waitForTimeout(600);
  await p.evaluate(()=>{ const L=__level; L.bot.x=4.5; L.bot.z=9.5; });
  console.log('walk north through the door → z', (await walk('ArrowRight', 120)).z, '(room 2 is z<8)');
  console.log('errors:', errs);
  await b.close();
})();
