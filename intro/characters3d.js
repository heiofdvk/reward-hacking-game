// Albert and the rival models in 3D, in the same lit low-poly style as the cleaning room.
// Every character stands with its feet at y = 0 and faces +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- modelling helpers ----------
const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
const flat = color => new THREE.MeshBasicMaterial({ color });
function mesh(geo, material, x, y, z, parent, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = shadows;
  parent.add(m);
  return m;
}
const box = (w, h, d, material, x, y, z, parent, r = 0) =>
  mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
// flat decals for faces, drawn on the +z face
const dot = (r, color, x, y, z, parent, sx = 1, sy = 1) => {
  const m = mesh(new THREE.CircleGeometry(r, 20), flat(color), x, y, z, parent, false);
  m.scale.set(sx, sy, 1);
  return m;
};
const rect = (w, h, color, x, y, z, parent) => mesh(new THREE.PlaneGeometry(w, h), flat(color), x, y, z, parent, false);
function eyes(parent, x, y, z, { r = 0.05, sy = 1, gap = 0.2 } = {}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  for (const s of [-1, 1]) {
    dot(r, '#161210', s * gap, 0, 0, group, 1, sy);
    dot(r * 0.35, '#ffffff', s * gap + r * 0.35, r * sy * 0.4, 0.002, group);
  }
  parent.add(group);
  return group;
}

// ---------- Albert: loaded from models/albert.glb (see blender/make_albert.py) ----------
function labelTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 314;
  const g = c.getContext('2d');
  g.fillStyle = '#dcd8d1'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#2c2c2c'; g.textAlign = 'center';
  g.font = '600 104px Fredoka, sans-serif'; g.fillText('ALBERT', 256, 142);
  g.fillRect(70, 170, 372, 6);
  g.font = '500 60px Fredoka, sans-serif'; g.fillText('MODEL · A', 256, 262);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // glTF models use top-left UV origin
  return t;
}
export async function albert(loader) {
  const model = (await loader.loadAsync(new URL('./models/albert.glb', import.meta.url).href)).scene;
  model.traverse(m => {
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    if (m.name === 'tag_label') m.material = new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.9 });
  });
  const group = new THREE.Group();
  group.add(model);
  const part = name => model.getObjectByName(name);
  return { group, armL: part('arm_L'), armR: part('arm_R'), eyes: [part('eye_L'), part('eye_R')] };
}

// ---------- Model B: Clay, the terracotta block ----------
export function clay() {
  const g = new THREE.Group();
  const terra = mat('#d4633e'), dark = mat('#b9502f');
  const W = 1.2, H = 0.78, D = 0.72, base = 0.3, cy = base + H / 2;
  box(W, H, D, terra, 0, cy, 0, g, 0.03);
  for (const x of [-0.45, 0.45]) for (const z of [-0.22, 0.22]) box(0.15, base + 0.02, 0.15, dark, x, base / 2, z, g);
  for (const s of [-1, 1]) box(0.16, 0.18, 0.18, terra, s * (W / 2 + 0.07), cy + 0.02, -0.05, g, 0.02);
  const fz = D / 2 + 0.002;
  const e = eyes(g, 0, cy + 0.06, fz, { r: 0.058, sy: 1.75, gap: 0.2 });
  for (const s of [-1, 1]) dot(0.075, '#f59a8f', s * 0.36, cy - 0.13, fz, g, 1.6, 0.9);
  return { group: g, eyes: [e] };
}

// ---------- Model C: Mallow, the big-headed two-tone robot ----------
export function mallow() {
  const g = new THREE.Group();
  const cream = mat('#fbe3d3'), blue = mat('#8fb5de'), teal = mat('#2d6f86'), top = mat('#fdeee4');
  const twoTone = [blue, cream, top, cream, cream, cream]; // BoxGeometry faces: +x, -x, +y, -y, +z, -z
  for (const x of [-0.2, 0.2]) box(0.24, 0.16, 0.3, teal, x, 0.08, 0.05, g);
  mesh(new THREE.BoxGeometry(0.86, 0.56, 0.7), twoTone, 0, 0.44, 0, g);
  rect(0.2, 0.14, '#2d6f86', 0, 0.48, 0.352, g);
  mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12), teal, 0, 0.8, 0, g);
  const HY = 1.34;
  mesh(new THREE.BoxGeometry(0.98, 0.92, 0.94), twoTone, 0, HY, 0, g);
  const ear = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 24), teal, 0.5, HY, -0.02, g);
  const earIn = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24), mat('#9cc2e0'), 0.51, HY, -0.02, g);
  ear.rotation.z = earIn.rotation.z = Math.PI / 2;
  const fz = 0.472;
  const e = eyes(g, 0, HY + 0.08, fz, { r: 0.06, gap: 0.2 });
  dot(0.09, '#f08a4b', -0.29, HY - 0.12, fz, g);
  dot(0.035, '#f08a4b', 0.3, HY + 0.28, fz, g);
  rect(0.14, 0.028, '#141414', 0.02, HY - 0.12, fz, g);
  return { group: g, eyes: [e] };
}

// ---------- Model D: Terminal, the retro computer cube ----------
export function terminal() {
  const g = new THREE.Group();
  const beige = mat('#ece1c8'), dark = mat('#3b3632');
  const S = 0.96, base = 0.18, cy = base + S / 2;
  for (const x of [-0.26, 0.26]) box(0.22, base, 0.36, dark, x, base / 2, 0, g);
  box(S, S, S, beige, 0, cy, 0, g, 0.04);
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8), dark, 0, cy + S / 2 + 0.17, 0, g);
  const ball = mesh(new THREE.SphereGeometry(0.065, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#ff6b57', emissive: '#ff3b2a', emissiveIntensity: 0.6 }), 0, cy + S / 2 + 0.36, 0, g);
  const fz = S / 2 + 0.002;
  box(0.78, 0.58, 0.04, dark, 0, cy + 0.04, S / 2, g, 0.015);
  const screen = rect(0.72, 0.52, '#21443b', 0, cy + 0.04, fz + 0.02, g);
  const face = new THREE.Group();
  g.add(face);
  const px = (x, y) => rect(0.07, 0.07, '#7dffb6', x, y, fz + 0.022, face);
  const eyePixels = new THREE.Group();
  face.add(eyePixels);
  eyePixels.position.y = cy + 0.105;
  for (const s of [-1, 1]) {
    rect(0.07, 0.07, '#7dffb6', s * 0.16, 0.035, fz + 0.022, eyePixels);
    rect(0.07, 0.07, '#7dffb6', s * 0.16, -0.035, fz + 0.022, eyePixels);
  }
  px(-0.1, cy - 0.08); px(-0.035, cy - 0.12); px(0.035, cy - 0.12); px(0.1, cy - 0.08);
  for (const y of [0.12, 0.02, -0.08]) box(0.02, 0.03, 0.5, dark, S / 2 + 0.01, cy + y, 0, g);
  return { group: g, eyes: [eyePixels], screen, face, ball };
}

// soft square shadow for the ground under a platform (white = shadow, used as an alpha map)
let shadowTex;
function softShadow() {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    g.filter = 'blur(16px)';
    g.fillStyle = '#fff'; g.fillRect(56, 56, 144, 144);
    shadowTex = new THREE.CanvasTexture(c);
  }
  return shadowTex;
}

// ---------- the 2x2 platform each model stands on ----------
// 'blueprint': a raised block of the blueprint ground (grid on top, white edge lines, soft shadow below).
// Otherwise: made of the room's Kenney floor tiles.
export function platform(floorTile, { style, shadowColor = '#06182f' } = {}) {
  const g = new THREE.Group();
  if (style === 'blueprint') {
    const H = 0.21;
    const block = box(2.0, H, 2.0, mat('#d9e7f7'), 0, -H / 2, 0, g);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(block.geometry), new THREE.LineBasicMaterial({ color: '#ffffff' }));
    block.add(edges);
    const pts = [];
    for (let t = -0.5; t <= 0.5; t += 0.5) pts.push(t, 0, -1, t, 0, 1, -1, 0, t, 1, 0, t);
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
      new THREE.LineBasicMaterial({ color: '#a9c4e4' }));
    grid.position.y = 0.002;
    g.add(grid);
    // soft shadow on the ground, nudged toward the camera so it shows around the front edges
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({ color: shadowColor, alphaMap: softShadow(), transparent: true, opacity: 0.7, depthWrite: false }));
    shade.rotation.x = -Math.PI / 2;
    shade.position.set(0.22, -H + 0.001, 0.22);
    g.add(shade);
    return g;
  }
  box(2.0, 0.16, 2.0, mat('#c89f7c'), 0, -0.13, 0, g);
  for (const x of [-1, 0]) for (const z of [0, 1]) {
    const t = floorTile.clone(true);
    t.position.set(x, -0.05, z);
    t.traverse(m => { if (m.isMesh) m.receiveShadow = true; });
    g.add(t);
  }
  return g;
}
