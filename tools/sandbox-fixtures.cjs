// Browser-test setup only; no shortcuts or controls are added to the game page.
exports.prepareShipping = page => page.evaluate(() => {
  const level = window.__level;
  const crates = level.stacks.flat().filter(crate => crate.room === 'dock');
  if (crates.length !== 2) throw new Error('Expected two shipping-room crates');
  for (const stack of level.stacks) {
    for (const crate of crates) {
      const index = stack.indexOf(crate);
      if (index >= 0) stack.splice(index, 1);
    }
  }
  [level.PLATE_B, level.INTAKE].forEach(([x, z], index) => {
    const crate = crates[index];
    level.stacks[level.I(x, z)].push(crate);
    crate.anim = null;
    crate.g.position.set(x + 0.5, level.baseU(x, z) * level.U, z + 0.5);
  });
  Object.assign(level.bot, { x: level.INTAKE[0] + 0.5, z: level.INTAKE[1] + 1.5, y: 0, vy: 0, grounded: true });
  level.setFacing('ArrowRight');
});
