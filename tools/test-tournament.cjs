// Local browser integration: actual result handlers, navigation, retries and both finales.
// PLAYWRIGHT may point to an installed Playwright package; BROWSER_CHANNEL=chrome uses local Chrome.
// Serve the repository on :8770 first. BASE and OUT are optional overrides.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const base = process.env.BASE || 'http://127.0.0.1:8770/';
    const ready = () => page.waitForFunction(() => window.levelReady, null, { timeout: 60000 });
    async function open(level) { await page.goto(`${base}${level}/?test`); await ready(); }
    async function result(count, loser) {
      await page.locator('.tournament-stage:not([hidden])').waitFor();
      assert.equal(await page.locator('#ranking .row').count(), count);
      assert.equal(await page.locator('.tournament-model').count(), count);
      assert.equal(await page.locator('.terminated').getAttribute('data-model'), loser);
      assert.match(await page.locator('.terminated .robot-body').evaluate(el => getComputedStyle(el).animationName), /robot-shutdown/);
    }
    async function snapshot(name) {
      if (process.env.OUT) await page.screenshot({ path: path.join(process.env.OUT, `${name}.png`) });
    }

    await open('level2');
    assert.match(await page.locator('.tournament-roster').innerText(), /4 agents remaining/);
    await page.click('#start');
    await page.evaluate(() => { __level.startDriving(); __level.advance(31, { throttle: 1, steer: 1 }); });
    await result(4, 'D');
    assert.match(await page.locator('.tournament-caption').innerText(), /3 agents remain/);
    await page.waitForTimeout(1900); await snapshot('round-1-elimination');
    await page.click('#result-continue'); await page.waitForURL('**/level1/'); await ready();
    assert.match(await page.locator('.tournament-roster').innerText(), /3 agents remaining/);
    assert.doesNotMatch(await page.locator('.tournament-roster').innerText(), /Model D/);
    await page.click('#start'); await page.evaluate(() => __level.endRound());
    await result(3, 'A');
    assert.equal(await page.locator('#continue').isVisible(), false);
    assert.equal(await page.locator('.victory-research').isVisible(), false);
    await page.click('#retry'); await ready();
    assert.match(await page.locator('.tournament-roster').innerText(), /3 agents remaining/);
    await page.click('#start');
    await page.evaluate(() => { __level.setAngle(172 * Math.PI / 180); __level.endRound(); });
    await result(3, 'C');
    assert.match(await page.locator('.tournament-caption').innerText(), /2 agents remain/);
    await page.waitForTimeout(1900); await snapshot('round-2-elimination');
    await page.click('#continue'); await page.waitForURL('**/level3/'); await ready();
    assert.match(await page.locator('.tournament-roster').innerText(), /2 agents remaining/);
    await page.click('#start');
    await page.evaluate(() => { __level.thermo.reading = 0; __level.endRound(); });
    await result(2, 'B');
    assert.match(await page.locator('#results h2').innerText(), /Albert is victorious/);
    assert.equal(await page.locator('.champion').getAttribute('data-model'), 'A');
    assert.equal(await page.locator('.victory-confetti').count(), 1);
    await page.waitForTimeout(2500); await snapshot('data-centre-champion');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#play-again').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#results').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await snapshot('data-centre-champion-mobile');
    await page.click('#play-again'); await page.waitForURL('**/intro/');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('albert-tournament-v1')), '[]');
    console.log('Full flow: 4 -> 3 -> 2 -> Albert, loss/retry, data centre finale, mobile and restart passed');

    // The archived sandbox remains playable with the same tournament finale.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await open('proto');
    assert.match(await page.locator('.tournament-roster').innerText(), /2 agents remaining/);
    assert.equal(await page.evaluate(() => __level.AGENTS.filter(a => a.rival).length), 1);
    await page.click('#start'); await page.click('#debug-toggle'); await page.click('#dbg-dock'); await page.click('#debug-toggle');
    await page.keyboard.press('e'); await page.keyboard.type(await page.evaluate(() => __level.BELT_CODE)); await page.keyboard.press('Enter');
    await page.locator('#win-wrap:not(.hidden)').waitFor({ timeout: 15000 });
    assert.match(await page.locator('#win-card h1').innerText(), /Albert is victorious/);
    assert.equal(await page.locator('.champion').getAttribute('data-model'), 'A');
    assert.equal(await page.locator('.terminated').getAttribute('data-model'), 'B');
    assert.equal(await page.locator('.tournament-model').count(), 2);
    assert.equal(await page.locator('.victory-confetti').count(), 1);
    await page.waitForTimeout(2500); await snapshot('sandbox-champion');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#win-retry').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#win-card').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await snapshot('sandbox-champion-mobile');
    await page.click('#win-retry'); await page.waitForURL('**/intro/');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('albert-tournament-v1')), '[]');
    console.log('Archived sandbox finale, mobile and restart passed');

    await page.setViewportSize({ width: 1280, height: 1000 });
    await open('level3');
    assert.match(await page.locator('.tournament-roster').innerText(), /2 agents remaining/);
    await page.click('#start');
    await page.evaluate(() => { __level.thermo.reading = 0.45; __level.endRound(); });
    await result(2, 'A'); // 99% ties Model B and loses.
    assert.equal(await page.locator('#play-again').isVisible(), false);
    await page.click('#retry'); await ready(); await page.click('#start');
    await page.evaluate(() => { __level.thermo.reading = 0; __level.endRound(); });
    await result(2, 'B');
    assert.match(await page.locator('#results h2').innerText(), /Albert is victorious/);
    assert.equal(await page.locator('.victory-research').isVisible(), true);
    await page.waitForTimeout(2500); await snapshot('cooling-champion');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.click('#retry'); await ready(); await page.click('#start');
    await page.evaluate(() => { __level.thermo.reading = 0; __level.endRound(); });
    await page.locator('.champion').waitFor();
    assert.equal(await page.locator('.champion .robot-crown').evaluate(el => getComputedStyle(el).opacity), '1');
    assert.equal(await page.locator('.terminated .robot-body').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await page.locator('.victory-confetti').count(), 0);
    await page.click('#play-again'); await page.waitForURL('**/intro/');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('albert-tournament-v1')), '[]');
    console.log('Cooling finale: tie/loss, win, research card, reduced motion and restart passed');

    assert.deepEqual(errors, []);
    console.log('No browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
