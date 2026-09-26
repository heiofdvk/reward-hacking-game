import { BOARD, nearestCourse, waterClearance } from './race.mjs?v=npc-boats';

// Clip a sampled terrain mesh at the actual water boundary. This carves the
// harbor behind the quay instead of drawing water over an impassable bank.
export function buildTerrain() {
  const surfaces = { water: [], sand: [], grass: [], shore: [] };
  const step = 0.65;
  const columns = Math.ceil((BOARD.maxX - BOARD.minX) / step), rows = Math.ceil((BOARD.maxZ - BOARD.minZ) / step);
  const samples = Array.from({ length: rows + 1 }, (_, row) => Array.from({ length: columns + 1 }, (_, col) => {
    const x = BOARD.minX + col / columns * (BOARD.maxX - BOARD.minX), z = BOARD.minZ + row / rows * (BOARD.maxZ - BOARD.minZ);
    return { x, z, s: waterClearance(x, z) };
  }));
  function clip(poly, boundary, above) {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const inA = above ? a.s >= boundary : a.s <= boundary, inB = above ? b.s >= boundary : b.s <= boundary;
      if (inA) result.push(a);
      if (inA !== inB) {
        const t = (boundary - a.s) / (b.s - a.s);
        result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, s: boundary });
      }
    }
    return result;
  }
  function emit(poly, surface, y) {
    for (let i = 1; i < poly.length - 1; i++) for (const p of [poly[0], poly[i], poly[i + 1]]) surfaces[surface].push(p.x, y, p.z);
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = samples[row][col], b = samples[row][col + 1], c = samples[row + 1][col], d = samples[row + 1][col + 1];
    for (const tri of [[a, c, b], [b, c, d]]) {
      emit(clip(tri, 0, true), 'water', 0.055);
      emit(clip(clip(tri, 0, false), -0.42, true), 'shore', 0.10);
      const dry = clip(tri, -0.42, false);
      if (dry.length) {
        const x = dry.reduce((v, p) => v + p.x, 0) / dry.length, z = dry.reduce((v, p) => v + p.z, 0) / dry.length;
        const nearest = nearestCourse(x, z), inside = (x - nearest.x) * -nearest.tz + (z - nearest.z) * nearest.tx > 0;
        emit(dry, inside ? 'grass' : 'sand', 0.12);
      }
    }
  }
  return surfaces;
}
