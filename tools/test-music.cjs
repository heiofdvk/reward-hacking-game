// Verify actual decoded audio output, not just whether music initialization was called.
// Serve on :8770; PLAYWRIGHT and BROWSER_CHANNEL can select a local browser installation.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined,
    args: ['--autoplay-policy=user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const meters = new Map(), sources = [];
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (destination, ...args) {
        if (destination === this.context.destination) {
          const meter = this.context.createAnalyser(); meter.fftSize = 2048;
          meters.set(this.context, meter);
          connect.call(this, meter); connect.call(meter, destination);
          return destination;
        }
        return connect.call(this, destination, ...args);
      };
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (when, offset, ...args) {
        if (this.buffer?.duration > 10) sources.push({ source: this, offset });
        return start.call(this, when, offset, ...args);
      };
      let plucks = 0;
      const oscStart = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...args) { plucks++; return oscStart.apply(this, args); };
      window.__song = {
        get plucks() { return plucks; },
        get count() { return sources.length; },
        get duration() { return sources[0]?.source.buffer.duration; },
        get offset() { return sources[0]?.offset; },
        get context() { return sources[0]?.source.context; },
        get loop() { return sources[0]?.source.loop; },
        rms() {
          const meter = meters.get(this.context); if (!meter) return 0;
          const data = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(data);
          return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
        },
      };
    });
    const base = process.env.BASE || 'http://127.0.0.1:8770/';
    const audible = () => page.waitForFunction(() => __song.count === 1 && __song.context.state === 'running' && __song.rms() > 0.0001, null, { timeout: 20000 });
    async function ready(level) {
      await page.waitForFunction(level => level === 'intro' ? window.introReady : window.levelReady, level, { timeout: 60000 });
    }
    async function check(level, mute) {
      await audible();
      assert.equal(await page.evaluate(() => __song.loop), true);
      await page.click(mute);
      await page.waitForFunction(() => __song.rms() < 0.000001);
      await page.click(mute); await audible();
      await page.evaluate(() => __song.context.suspend());
      await page.keyboard.press('Shift'); await audible();
      assert.equal(await page.evaluate(() => __song.count), 1);
      console.log(`${level}: actual music output, looping, mute/unmute and suspended-context recovery passed`);
    }

    // The intro has no music, only little arpeggio sound effects (and its 🔊 button mutes them).
    await page.goto(`${base}intro/`); await ready('intro');
    await page.mouse.click(400, 300); await page.waitForTimeout(1500);   // finishes typing line 1
    await page.mouse.click(400, 300); await page.waitForTimeout(600);    // line 2: Albert's sparkle
    assert.equal(await page.evaluate(() => __song.count), 0);
    assert.ok(await page.evaluate(() => __song.plucks) > 0);
    await page.click('.music-toggle'); const before = await page.evaluate(() => __song.plucks);
    await page.mouse.click(400, 300); await page.mouse.click(400, 300); await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => __song.plucks), before);
    await page.click('.music-toggle');
    assert.equal(await page.evaluate(() => __song.count), 0);
    console.log('intro: no song, arpeggio sound effects, muted by its button');
    // Use an ordinary link so the audio clock/position is tested across a real document navigation.
    // song: 32 s = Level 1's own song (boat race), 72 s = the office's (Level 2, Level 3, sandbox).
    // carried: the page picks the song up where the last page playing it left off.
    async function go(level, song, carried) {
      await page.evaluate(href => {
        const a = document.createElement('a'); a.id = 'music-test-next'; a.href = href;
        a.textContent = 'Next'; a.style = 'position:fixed;top:0;left:0;z-index:9999;background:white'; document.body.append(a);
      }, `${base}${level}/?test`);
      await page.click('#music-test-next'); await ready(level);
      await page.click('#start'); await audible();
      assert.ok(Math.abs(await page.evaluate(() => __song.duration) - song) < 0.5, `${level} plays the ${song} s song`);
      const position = await page.evaluate(() => ({ saved: Number(sessionStorage.getItem('albert-music-pos')), offset: __song.offset }));
      if (carried) {
        assert.ok(position.saved > 0, JSON.stringify(position));
        assert.ok(Math.abs(position.saved - position.offset) < 0.1, JSON.stringify(position));
      } else assert.equal(position.offset, 0, JSON.stringify(position));
    }
    await go('level2', 32, false); await check('boat race', '#sound');
    await go('level1', 72, false); await check('office', '#mute');
    // Exercise the office's real fade-and-Continue path into the data centre.
    await page.evaluate(() => { __level.setAngle(172 * Math.PI / 180); __level.endRound(); });
    await page.locator('#continue:not(.hidden)').waitFor(); await page.click('#continue');
    await page.waitForURL('**/level3/'); await ready('level3'); await page.click('#start');
    await check('data centre', '#mute');
    await page.evaluate(() => { __level.thermo.reading = 0; __level.endRound(); });
    await page.locator('.champion').waitFor(); await audible();
    await Promise.all([page.waitForEvent('domcontentloaded'), page.click('#retry')]);
    await ready('level3');
    assert.equal(await page.locator('#start-wrap').isVisible(), false);
    assert.equal(await page.evaluate(() => __level.state), 'playing');
    await audible();
    console.log('Music continues through final results and retry');
    await go('proto', 72, true); await check('archived sandbox', '.music-toggle');

    // A failed initial fetch must recover on Start, including a direct visit to a later level.
    let requests = 0;
    await page.route('**/level1/music.mp3', route => {
      requests++;
      return requests === 1 ? route.fulfill({ status: 503, body: 'temporarily unavailable' }) : route.continue();
    });
    await page.goto(`${base}level3/`); await ready('level3');
    await page.click('#start'); await audible();
    assert.ok(requests >= 2);
    assert.equal(await page.evaluate(() => __song.count), 1);
    console.log('Later-level direct entry recovers from a failed song download');
    await page.click('#mute');
    await page.goto(`${base}level1/`); await ready('level1'); await page.click('#start');
    await page.waitForFunction(() => __song.count === 1 && __song.context.state === 'running');
    assert.equal(await page.evaluate(() => localStorage.getItem('albert-muted')), '1');
    assert.equal(await page.evaluate(() => __song.rms()), 0);
    await page.click('#mute'); await audible();
    console.log('Mute preference persists across levels and unmuting restores the song');
    await page.evaluate(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } }));
    await page.click('#mute'); await page.keyboard.press('Shift');
    await page.waitForFunction(() => __song.rms() < 0.000001);
    await page.click('#mute'); await audible();
    console.log('Mute remains effective when browser storage is unavailable');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
