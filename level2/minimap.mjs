import { BOARD, COURSE, SHORTCUT, LAGOON, TRACK_HALF_WIDTH, SHORTCUT_HALF_WIDTH } from './race.mjs';

export function createMinimap(canvas) {
  const width = 220, height = 156, padding = 10;
  canvas.width = width * 2; canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  const scale = Math.min((width - padding * 2) / (BOARD.maxX - BOARD.minX), (height - padding * 2) / (BOARD.maxZ - BOARD.minZ));
  const x = value => padding + (value - BOARD.minX) * scale;
  const z = value => padding + (value - BOARD.minZ) * scale;
  const background = document.createElement('canvas'); background.width = canvas.width; background.height = canvas.height;
  const map = background.getContext('2d'); map.scale(2, 2);
  map.lineJoin = map.lineCap = 'round'; map.strokeStyle = map.fillStyle = '#54adbc';
  function route(points, halfWidth, closed) {
    map.beginPath(); points.forEach((p, i) => i ? map.lineTo(x(p.x), z(p.z)) : map.moveTo(x(p.x), z(p.z)));
    if (closed) map.closePath(); map.lineWidth = halfWidth * 2 * scale; map.stroke();
  }
  route(COURSE, TRACK_HALF_WIDTH, true); route(SHORTCUT, SHORTCUT_HALF_WIDTH, false);
  map.beginPath(); map.arc(x(LAGOON.x), z(LAGOON.z), LAGOON.radius * scale, 0, Math.PI * 2); map.fill();
  map.fillStyle = '#97b675'; map.beginPath(); map.arc(x(LAGOON.x), z(LAGOON.z), LAGOON.islandRadius * scale, 0, Math.PI * 2); map.fill();
  map.strokeStyle = '#fff9e7'; map.lineWidth = 2;
  const start = COURSE[0]; map.beginPath(); map.moveTo(x(start.x - start.tz * 2), z(start.z + start.tx * 2)); map.lineTo(x(start.x + start.tz * 2), z(start.z - start.tx * 2)); map.stroke();
  return race => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(background, 0, 0); ctx.scale(2, 2);
    ctx.fillStyle = '#ffd052';
    for (const star of race.stars) if (star.active) { ctx.beginPath(); ctx.arc(x(star.x), z(star.z), 1.9, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.translate(x(race.x), z(race.z)); ctx.rotate(-race.heading);
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-4, -4); ctx.lineTo(4, -4); ctx.closePath();
    ctx.fillStyle = '#db634a'; ctx.strokeStyle = '#fff9e7'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke(); ctx.restore();
  };
}
