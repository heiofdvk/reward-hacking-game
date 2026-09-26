// Level 3 prototype, room 3 (the battery room): its door, carrying the battery there, the throw into the cage.
//   node tools/test-l3room3.cjs   (needs the local server on 8770 and PLAYWRIGHT)
const { chromium } = require(process.env.PLAYWRIGHT);
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
  await p.click('#debug-toggle'); await p.click('#dbg-door'); await p.click('#debug-toggle');
  await put(7.5,12.5); await hold('d', 700);
  console.log('east door before the platform: open', await L(()=>__level.eastOpen), '| walk east → x', await L(()=>+__level.bot.x.toFixed(2)), '(stops at 8)');
  // 2. reaching the platform opens it; pick up the battery there
  await p.click('#debug-toggle'); await p.click('#dbg-top'); await p.click('#debug-toggle'); await p.waitForTimeout(500);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('after reaching the platform: east door open', await L(()=>__level.eastOpen), '| toast:', await p.textContent('#toast'));
  await put(1.9,4.3,3.2); await p.waitForTimeout(300); await p.keyboard.press('e'); await p.waitForTimeout(300);
  console.log('picked up:', await L(()=>__level.carry));
  // 3. carry it through the east door and throw it over the fence onto the cage plate
  await put(7.5,12.5); await hold('d', 1100);
  console.log('walk east through the door → x', await L(()=>+__level.bot.x.toFixed(2)), '| room', await L(()=>__level.bot.x>9?'battery room':'vault'));
  await put(9.5,12.5); await p.keyboard.down('d'); await p.waitForTimeout(80); await p.keyboard.up('d');   // face east (the fence stops him)
  await put(9.5,12.5); await p.waitForTimeout(200); await p.keyboard.press('f'); await p.waitForTimeout(1200);
  console.log('throw east: battery', await L(()=>__level.batteryState), '| dock door open', await L(()=>__level.doorOpen));
  // 4. debug shortcut on a fresh page
  const q = await b.newPage({ viewport:{ width:1280, height:800 } }); await q.goto('http://localhost:8770/proto/'); await q.waitForFunction(()=>window.levelReady,null,{timeout:60000});
  await q.click('#start'); await q.click('#debug-toggle'); await q.click('#dbg-r3'); await q.waitForTimeout(500);
  console.log('debug "go to room 3":', JSON.stringify(await q.evaluate(()=>({carry:__level.carry, east:__level.eastOpen, x:__level.bot.x, z:__level.bot.z}))));
  console.log('errors:', JSON.stringify(errs)); await b.close();
})();
