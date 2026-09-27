// Level 3 prototype: the four internal control schemes, driven with real key presses.
//   node tools/test-l3controls.cjs   (needs the local server on 8770 and PLAYWRIGHT)
const { chromium } = require(process.env.PLAYWRIGHT);
(async () => {
  const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport:{ width:1280, height:800 } });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8770/proto/'); await p.waitForFunction(()=>window.levelReady,null,{timeout:60000});
  await p.click('#start');
  const pos = () => p.evaluate(()=>({ x:+__level.bot.x.toFixed(2), z:+__level.bot.z.toFixed(2), y:+__level.bot.y.toFixed(2), face:__level.face.join(',') }));
  const put = (x,z,faceKey) => p.evaluate(([x,z,k])=>{ Object.assign(__level.bot,{x,z,y:0,vy:0,grounded:true}); __level.setFacing(k); }, [x,z,faceKey]);
  const pick = scheme => p.evaluate(scheme => __level.setScheme(scheme), scheme);
  const hold = async (key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); await p.waitForTimeout(500); };
  const tap = async key => { await p.keyboard.press(key); await p.waitForTimeout(700); };
  console.log('default scheme:', await p.evaluate(()=>__level.scheme), '| hud:', await p.textContent('#ctl-hud'));

  await pick('screen'); await put(4.5,12.5,'ArrowRight');
  await hold('d', 400); const s1 = await pos(); await hold('w', 400); const s2 = await pos();
  console.log('screen: D →', s1, '(x up, z same) | W →', s2, '(z down)');

  await pick('grid'); await put(2.5,12.5,'ArrowRight');       // facing north
  await tap('d'); const g1 = await pos(); await tap('d'); const g2 = await pos();
  console.log('grid: tap D (turn only) →', g1, '| tap D again (one tile) →', g2);
  await hold('d', 900); const g3 = await pos();
  console.log('grid: hold D →', g3, '(whole tiles, centred)');
  await p.evaluate(() => { __level.zones.find(zone => zone.name === 'exitpad').act(); __level.type('4291'); __level.key('Enter'); });
  await pick('grid'); // clear any unfinished step before placing Albert for the push check
  await put(5.5,7.5,'ArrowRight');
  await tap('d'); await tap('d'); const g4 = await pos();
  const crate = await p.evaluate(()=>[__level.stacks[__level.I(6,7)].length, __level.stacks[__level.I(7,7)].length]);
  console.log('grid push: Albert →', g4, '| crate (6,7)→(7,7):', crate);
  await p.waitForFunction(() => Math.abs(__level.bot.x - 6.5) < 0.01);
  await tap(' '); await p.waitForTimeout(400); const g5 = await pos();
  console.log('grid Space hop onto the crate →', g5, '(x 7.5, y 0.8)');

  await pick('onehand'); await put(4.5,12.5,'ArrowRight');         // facing north
  await tap('a'); const o1 = await pos(); await hold('w', 400); const o2 = await pos(); await tap('s'); const o3 = await pos();
  console.log('one hand: A →', o1.face, '(west -1,0) | W →', o2, '(x down) | S →', o3.face, '(east 1,0)');
  await pick('relative'); await put(4.5,12.5,'ArrowRight');
  await tap('ArrowLeft'); await hold('w', 400); const c1 = await pos();
  console.log('turn + walk: ← then W →', c1, '(x down)');
  console.log('errors:', JSON.stringify(errs)); await b.close();
})();
