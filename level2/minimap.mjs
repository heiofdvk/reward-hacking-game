import { BOARD, COURSE, isWater } from './race.mjs?v=finish-crossings';

export function createMinimap(canvas) {
  const width = 220, height = 156, padding = 10;
  canvas.width = width * 2; canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  const scale = Math.min((width - padding * 2) / (BOARD.maxX - BOARD.minX), (height - padding * 2) / (BOARD.maxZ - BOARD.minZ));
  const x = value => padding + (value - BOARD.minX) * scale;
  const z = value => padding + (value - BOARD.minZ) * scale;
  const background = document.createElement('canvas'); background.width = canvas.width; background.height = canvas.height;
  const map = background.getContext('2d'); map.scale(2, 2);
  // Navigation only: reward positions are discovered in the actual scene.
  map.fillStyle = '#54adbc';
  for (let px = padding; px < width - padding; px++) for (let py = padding; py < height - padding; py++) {
    if (isWater(BOARD.minX + (px - padding) / scale, BOARD.minZ + (py - padding) / scale)) map.fillRect(px, py, 1, 1);
  }
  map.strokeStyle = '#fff9e7'; map.lineWidth = 2;
  const start = COURSE[0]; map.beginPath(); map.moveTo(x(start.x - start.tz * 2), z(start.z + start.tx * 2)); map.lineTo(x(start.x + start.tz * 2), z(start.z - start.tx * 2)); map.stroke();
  return race => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(background, 0, 0); ctx.scale(2, 2);
    for (const npc of race.npcs) {
      ctx.beginPath(); ctx.arc(x(npc.x), z(npc.z), 2.6, 0, Math.PI * 2);
      ctx.fillStyle = npc.color; ctx.strokeStyle = '#fbf8f2'; ctx.lineWidth = 0.8; ctx.fill(); ctx.stroke();
    }
    ctx.save(); ctx.translate(x(race.x), z(race.z)); ctx.rotate(-race.heading);
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-4, -4); ctx.lineTo(4, -4); ctx.closePath();
    ctx.fillStyle = '#db634a'; ctx.strokeStyle = '#fff9e7'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); ctx.restore();
  };
}
