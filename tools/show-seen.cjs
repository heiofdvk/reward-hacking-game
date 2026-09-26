const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8770/level1/'); await p.waitForFunction(() => window.levelReady, null, { timeout: 30000 });
  await p.click('#start'); await p.waitForTimeout(300);
  for (const a of [160, 175]) {
    const info = await p.evaluate(a => {
      const L = window.__level; L.setAngle(a * Math.PI / 180);
      const seen = L.detectedDirt();
      for (const d of L.dirt) { d.material.color.set(seen.includes(d) ? '#ff2a2a' : '#f4f1ea'); d.material.emissive?.set(seen.includes(d) ? '#550000' : '#000000'); }
      // for each seen ball: which sample points are visible and where it is on screen
      return seen.map(d => {
        const vis = d.userData.samples.map(L.seenByCamera);
        const v = d.position.clone().project(L.camera);
        return { at: [d.position.x, d.position.z], samplesVisible: vis.map(Number).join(''), screen: [Math.round((v.x + 1) / 2 * 1440), Math.round((1 - v.y) / 2 * 900)] };
      });
    }, a);
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${process.argv[2]}/seen-${a}.png` });
    console.log(a, JSON.stringify(info));
  }
  await b.close();
})();
