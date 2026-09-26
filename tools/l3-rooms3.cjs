// Level 3 room 3 (the battery room), in local coordinates. Check it with: node tools/l3-solver3.cjs
//
// Four plates must be pressed at once to open the exit door (8,4): the pen plate (7,1) on a 2-high pedestal behind a
// fence (only the thrown battery can get there), the stand plate (7,3), Albert's plate (6,3) on the 2-high ledge,
// and the corner plate (6,7).
//  - The only tile exactly 2 from the pen in a straight line is the stand (7,3). From its floor the pedestal is too
//    high (the battery bounces), so Albert needs to stand on a box there.
//  - No box can be pushed into the stand: it's walled in by the pen, the ledge and Albert's plate. The ledge box
//    (5,4) has to go along the ledge (E, E) and be shoved off its end (7,4) so it drops onto the stand.
//  - Decoys: the ledge end (7,4) and Albert's plate (6,3) look like perfect high throwing spots next to the pen,
//    but they are 3 tiles away or aim at a fence, so every throw from them bounces back.
//  - The floor box (1,2) must reach the corner plate (6,7) by the bottom corridor; shoving it into the wrong row or
//    corner kills the room. Albert himself is the 4th weight (his plate on the ledge, reached by the 1-high step (6,6)).
module.exports = {
  ante: {
    map: [
      '#########',
      '#...##F2#',
      '#....#FF#',
      '#...##2.#',
      'n...2222#',
      '#....#22#',
      '#.#...1.#',
      '##.....##',
      '#########',
    ],
    plates: [[7, 1], [7, 3], [6, 3], [6, 7]],
    crates: [[5, 4], [1, 2]],
    start: [1, 4],
  },
};
