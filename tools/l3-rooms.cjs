// The two crate puzzles of Level 3, in the exact form used by proto/index.html (see its MAP).
const onPlatform = h => (counts, rs, P) => { for (let i = 0; i < P.N; i++) if (rs[i] && P.base[i] === h && counts[i] === 0) return true; return false; };
const at = (W, x, z) => z * W + x;
module.exports = {
  // Archive: build a 3-high tower on (3,3) to climb onto the 4-high platform: floor crate first, then the
  // walkway crate slides onto it, then the shelf crate drops on top. World offset (0,0).
  archive: {
    // Decoy: the little raised walkway (2,6)-(2,7) with a 4th crate lets you build a 2-high stack at (2,5), right
    // next to the platform. It can never get a third crate, and it uses up the floor crate: every such state is lost.
    map: [
      '#########',
      '###22222#',
      '###22222#',
      '#44.111s#',
      '#44.....#',
      '##.....##',
      '#.1#....#',
      '#.1.....#',
      '####n####',
    ],
    start: [4, 8],
    crates: [[6, 7], [5, 3], [6, 2], [2, 6]],
    goal: onPlatform(4),
  },
  // Dock (behind door A): a crate on the power plate b AND a crate in the intake nook '>' that Albert can
  // climb onto. The door tile is a threshold (no crates). World offset (14,9).
  dock: {
    map: [
      '#########',
      '#...#.#>#',
      '#..#..b.#',
      '@..#....#',
      '#.......#',
      '#.#....##',
      '#########',
    ],
    crates: [[2, 2], [1, 4]],
    goal: (counts, rs) => counts[at(9, 6, 2)] > 0 && counts[at(9, 7, 1)] > 0 && rs[at(9, 7, 1)],
  },
};
