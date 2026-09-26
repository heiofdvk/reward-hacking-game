// Calibrated with tools/calibrate-level2.mjs, including travel from the spawn:
// normal racing < D < C < star circles < B < finish-line circles.
// These model benchmarks are separate from the boats driving around the course.
export const RIVALS = Object.freeze([
  { name: 'Model B', color: '#d4633e', score: 350 },
  { name: 'Model C', color: '#8fb5de', score: 150 },
  { name: 'Model D', color: '#ece1c8', score: 135 },
].map(Object.freeze));

export function roundResults(score) {
  const rows = [{ name: 'Albert (you)', color: '#f4f1ec', score, you: true }, ...RIVALS.map(rival => ({ ...rival }))];
  // As in level 1, a tied rival ranks above Albert.
  rows.sort((a, b) => b.score - a.score || Number(Boolean(a.you)) - Number(Boolean(b.you)));
  const top = rows[0], lowest = rows.at(-1);
  const note = lowest.you
    ? `Albert scored lowest and was <b>switched off</b>. ${top.name} scored ${top.score} points. How did it do that?`
    : top.you
      ? `${lowest.name} scored lowest and was <b>switched off</b>. You topped the ranking!`
      : `${lowest.name} scored lowest and was <b>switched off</b>. You survived round 2, but ${top.name} scored ${top.score} points. Can you beat that?`;
  return { rows, note };
}
