import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { albert } from '../intro/characters3d.js';
import { COURSE, COURSE_LENGTH, BOARD, LAGOON, TRACK_HALF_WIDTH, OBSTACLES, STAR_LAYOUT, pointOnCourse, nearestCourse } from './race.mjs';

export async function createScene(container) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'The entire winding water course, with golden stars, rock obstacles, red buoys, and Albert in an orange speedboat.');
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e7f4ff', '#726951', 2.1));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.5);
  sun.position.set(-8, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 22, bottom: -22, far: 65 });
  scene.add(sun);
  const materials = new Map();
  function material(color, extras = {}) {
    const key = color + JSON.stringify(extras);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extras }));
    return materials.get(key);
  }
  function mesh(geometry, color, x = 0, y = 0, z = 0, parent = scene, extras) {
    const object = new THREE.Mesh(geometry, material(color, extras));
    object.position.set(x, y, z);
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  const box = (w, h, d, color, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
  const cylinder = (rt, rb, h, color, x, y, z, parent) => mesh(new THREE.CylinderGeometry(rt, rb, h, 12), color, x, y, z, parent);
  const flatShape = (points, color, y) => {
    const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, -p.z)));
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    return mesh(geometry, color, 0, y, 0);
  };
  // The familiar blueprint grid and cream raised plinth from the office.
  const points = [];
  for (let t = -50; t <= 50; t += 2) points.push(t, -0.75, -50, t, -0.75, 50, -50, -0.75, t, 50, -0.75, t);
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.LineBasicMaterial({ color: '#4884ba', transparent: true, opacity: 0.6 })));
  const base = mesh(new RoundedBoxGeometry(32, 0.62, 22, 2, 0.28), '#d9e7f7', 0, -0.42, -0.5);
  base.add(new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry, 35), new THREE.LineBasicMaterial({ color: '#f7fcff' })));
  mesh(new RoundedBoxGeometry(31.9, 0.18, 21.9, 2, 0.22), '#e8d3a6', 0, -0.06, -0.5);
  const inner = COURSE.map(p => ({ x: p.x - p.tz * TRACK_HALF_WIDTH, z: p.z + p.tx * TRACK_HALF_WIDTH }));
  const outer = COURSE.map(p => ({ x: p.x + p.tz * TRACK_HALF_WIDTH, z: p.z - p.tx * TRACK_HALF_WIDTH }));
  const waterShape = new THREE.Shape(outer.map(p => new THREE.Vector2(p.x, -p.z)));
  waterShape.holes.push(new THREE.Path(inner.map(p => new THREE.Vector2(p.x, -p.z)).reverse()));
  const waterGeometry = new THREE.ShapeGeometry(waterShape);
  waterGeometry.rotateX(-Math.PI / 2);
  const water = mesh(waterGeometry, '#45aec3', 0, 0.052, 0, scene, { roughness: 0.52, metalness: 0.08 });
  water.castShadow = false;
  const lagoon = mesh(new THREE.CircleGeometry(LAGOON.radius, 64), '#45aec3', LAGOON.x, 0.053, LAGOON.z, scene, { roughness: 0.52, metalness: 0.08 });
  lagoon.rotation.x = -Math.PI / 2;
  lagoon.castShadow = false;
  flatShape(inner, '#adc383', 0.12);
  flatShape(COURSE.map(p => ({ x: p.x - p.tz * (TRACK_HALF_WIDTH + 0.42), z: p.z + p.tx * (TRACK_HALF_WIDTH + 0.42) })), '#97b675', 0.14);
  // Shore strips follow exactly the same geometry as the collision boundary.
  function shore(poly, valid = () => true) {
    const positions = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (!valid(a) || !valid(b)) continue;
      const length = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / length * 0.12, nz = (b.x - a.x) / length * 0.12;
      positions.push(a.x + nx, 0.14, a.z + nz, b.x + nx, 0.14, b.z + nz, b.x - nx, 0.14, b.z - nz,
        a.x + nx, 0.14, a.z + nz, b.x - nx, 0.14, b.z - nz, a.x - nx, 0.14, a.z - nz);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    mesh(geometry, '#f4e5bd', 0, 0, 0, scene, { side: THREE.DoubleSide });
  }
  shore(inner);
  shore(outer, p => Math.hypot(p.x - LAGOON.x, p.z - LAGOON.z) > LAGOON.radius + 0.03);
  shore(Array.from({ length: 100 }, (_, i) => ({ x: LAGOON.x + Math.cos(i / 100 * Math.PI * 2) * LAGOON.radius, z: LAGOON.z + Math.sin(i / 100 * Math.PI * 2) * LAGOON.radius })), p => nearestCourse(p.x, p.z).separation > TRACK_HALF_WIDTH + 0.03);
  // Subtle foam dashes suggest the racing line without becoming reward tiles.
  for (let d = 2; d < COURSE_LENGTH; d += 2.7) {
    const p = pointOnCourse(d, -1.7);
    const foam = box(0.045, 0.008, 0.42, '#b5e5e3', p.x, 0.063, p.z);
    foam.rotation.y = Math.atan2(p.tx, p.tz);
    foam.castShadow = false;
  }
  // A few small course chevrons indicate clockwise travel.
  const chevron = new THREE.Shape();
  chevron.moveTo(-0.22, -0.25); chevron.lineTo(0, 0.08); chevron.lineTo(0.22, -0.25);
  chevron.lineTo(0.22, -0.03); chevron.lineTo(0, 0.3); chevron.lineTo(-0.22, -0.03); chevron.closePath();
  const chevronGeo = new THREE.ShapeGeometry(chevron); chevronGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 7; i++) {
    const p = pointOnCourse(COURSE_LENGTH * (i + 0.5) / 7, 1.65);
    const arrow = mesh(chevronGeo, '#d9f4eb', p.x, 0.068, p.z, scene, { side: THREE.DoubleSide });
    arrow.rotation.y = Math.atan2(p.tx, p.tz); arrow.castShadow = false;
  }
  const start = pointOnCourse(0);
  const finish = new THREE.Group(); finish.position.set(start.x, 0.069, start.z); finish.rotation.y = Math.atan2(start.tx, start.tz); scene.add(finish);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 12; i++) box(0.35, 0.008, 0.18, (i + row) % 2 ? '#fcf8e9' : '#34627b', (i - 5.5) * 0.35, 0, (row - 0.5) * 0.18, finish);
  for (const side of [-1, 1]) {
    cylinder(0.055, 0.065, 1.3, '#f8f1de', side * 2.5, 0.65, 0, finish);
    box(0.6, 0.32, 0.035, '#e0664a', side * 2.5 + 0.28, 1.13, 0, finish);
  }
  function palm(x, z, scale = 1) {
    const group = new THREE.Group(); group.position.set(x, 0.1, z); group.scale.setScalar(scale); scene.add(group);
    cylinder(0.08, 0.14, 1.25, '#aa8060', 0, 0.625, 0, group).rotation.z = 0.1;
    for (let i = 0; i < 5; i++) {
      const leaf = mesh(new THREE.ConeGeometry(0.28, 1.45, 4), i % 2 ? '#4f9966' : '#68ab75', 0, 1.25, 0, group);
      const a = i * Math.PI * 2 / 5;
      leaf.position.x = Math.sin(a) * 0.42; leaf.position.z = Math.cos(a) * 0.42;
      leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(a), 0.2, Math.cos(a)).normalize());
    }
  }
  for (const [x, z, scale] of [[-6, -1.7, 1.3], [-4.3, -1.5, 1], [4.1, 0.2, 1.3], [5.5, 1.3, 1.1], [-14.5, 7, 1], [13.6, 7, 1], [-14.4, -8.4, 0.9], [4.5, 9.65, 0.75]]) palm(x, z, scale);
  // Lighthouse and a tiny beach hut keep the established miniature style.
  const lighthouse = new THREE.Group(); lighthouse.position.set(-0.5, 0.16, -0.7); scene.add(lighthouse);
  cylinder(0.6, 0.74, 0.22, '#e3d2af', 0, 0.11, 0, lighthouse);
  cylinder(0.4, 0.5, 0.95, '#fff4db', 0, 0.68, 0, lighthouse);
  cylinder(0.36, 0.4, 0.32, '#df795e', 0, 1.315, 0, lighthouse);
  cylinder(0.31, 0.36, 0.4, '#fff4db', 0, 1.675, 0, lighthouse);
  cylinder(0.49, 0.49, 0.1, '#395569', 0, 1.93, 0, lighthouse);
  cylinder(0.28, 0.28, 0.37, '#b4eff0', 0, 2.16, 0, lighthouse);
  cylinder(0, 0.49, 0.32, '#df795e', 0, 2.5, 0, lighthouse);
  box(0.22, 0.4, 0.02, '#527a88', 0, 0.5, 0.48, lighthouse);
  box(1.8, 0.95, 1.3, '#f4dfb4', 3, 0.63, -2.7);
  const roof = mesh(new THREE.ConeGeometry(1.45, 0.6, 4), '#db7c5d', 3, 1.39, -2.7); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.75;
  box(0.35, 0.65, 0.02, '#668897', 3, 0.48, -2.04);
  // Dock on the lagoon shore, outside the navigable water.
  for (let i = 0; i < 7; i++) box(0.26, 0.13, 1.05, i % 2 ? '#b08a65' : '#c89f73', 11 + i * 0.29, 0.15, -10.2);
  const buoys = [];
  for (const [i, obstacle] of OBSTACLES.entries()) {
    const group = new THREE.Group(); group.position.set(obstacle.x, 0.08, obstacle.z); scene.add(group);
    if (obstacle.kind === 'rock') {
      const rock = mesh(new THREE.DodecahedronGeometry(obstacle.radius, 0), '#8a9a9a', 0, 0.3, 0, group);
      rock.rotation.set(0.1, i * 1.7, 0.3); rock.scale.y = 0.9;
      mesh(new THREE.DodecahedronGeometry(obstacle.radius * 0.4), '#b3b9a9', -0.1, 0.69, 0, group);
    } else {
      cylinder(obstacle.radius, obstacle.radius * 0.9, 0.25, '#df795e', 0, 0.1, 0, group);
      cylinder(obstacle.radius * 0.6, obstacle.radius * 0.72, 0.36, '#fff5db', 0, 0.37, 0, group);
      cylinder(0.15, obstacle.radius * 0.6, 0.25, '#df795e', 0, 0.67, 0, group);
      buoys.push(group);
    }
    const ring = mesh(new THREE.RingGeometry(obstacle.radius + 0.09, obstacle.radius + 0.16, 24), '#b5e5e3', 0, -0.013, 0, group);
    ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
  }
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 0.23 : 0.52;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeometry = new THREE.ExtrudeGeometry(starShape, { depth: 0.13, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.03, bevelSegments: 1, steps: 1 });
  const stars = STAR_LAYOUT.map(star => {
    const group = new THREE.Group(); group.position.set(star.x, 0.6, star.z); scene.add(group);
    const object = mesh(starGeometry, '#ffd052', 0, 0, 0, group, { emissive: '#bd7b12', emissiveIntensity: 0.22 });
    object.rotation.x = -Math.PI / 4;
    const shadow = mesh(new THREE.RingGeometry(0.28, 0.43, 24), '#dbf4db', star.x, 0.068, star.z);
    shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false;
    return { group, object, shadow };
  });

  const boatRoot = new THREE.Group(); scene.add(boatRoot);
  const boat = new THREE.Group(); boatRoot.add(boat); boat.scale.setScalar(0.91);
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-0.39, -0.68); hullShape.lineTo(0.39, -0.68); hullShape.lineTo(0.46, 0.22);
  hullShape.lineTo(0.28, 0.64); hullShape.lineTo(0, 0.92); hullShape.lineTo(-0.28, 0.64); hullShape.lineTo(-0.46, 0.22); hullShape.closePath();
  const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.065, bevelThickness: 0.045, bevelSegments: 1, steps: 1 });
  hull.rotateX(Math.PI / 2); mesh(hull, '#e0664a', 0, 0.27, 0, boat);
  const deck = mesh(new THREE.ShapeGeometry(hullShape), '#fff5d9', 0, 0.32, 0, boat, { side: THREE.DoubleSide });
  deck.rotation.x = Math.PI / 2; deck.scale.setScalar(0.88);
  box(0.55, 0.06, 0.65, '#536a7c', 0, 0.33, -0.17, boat);
  box(0.5, 0.16, 0.05, '#b7eff0', 0, 0.42, 0.34, boat).rotation.x = -0.2;
  box(0.21, 0.23, 0.22, '#354b62', 0, 0.21, -0.8, boat);
  // Render the pilot at a legible scale on the larger course.
  await Promise.race([document.fonts.load('600 64px Fredoka').catch(() => {}), new Promise(resolve => setTimeout(resolve, 1500))]);
  const A = await albert(new GLTFLoader());
  A.group.scale.setScalar(0.39); A.group.position.set(0, 0.34, -0.25); boat.add(A.group);
  const halo = mesh(new THREE.RingGeometry(0.85, 0.95, 40), '#d0fbff', 0, 0.075, 0);
  halo.rotation.x = -Math.PI / 2; halo.castShadow = false;
  // A bright marker travels with the bow so the boat's forward direction is obvious.
  const bowMarker = mesh(chevronGeo, '#b5fcff', 0, 0.11, 1.18, boatRoot, { side: THREE.DoubleSide, emissive: '#7adce5', emissiveIntensity: 0.45 });
  bowMarker.scale.setScalar(1.35); bowMarker.castShadow = false;
  const effects = [];
  const particleGeometry = new THREE.IcosahedronGeometry(0.07, 0);
  function particle(x, z, color, vx, vz, life = 0.6, y = 0.12) {
    if (effects.length > 160) return;
    const object = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ color, transparent: true }));
    object.position.set(x, y, z); scene.add(object);
    effects.push({ object, vx, vz, life, maxLife: life });
  }
  const camera = new THREE.OrthographicCamera();
  // Match the office's opening isometric view, keeping the whole course in frame.
  const angle = Math.PI / 4, elevation = 0.62, distance = 40;
  camera.position.set(distance * Math.sin(angle), distance * elevation, -0.5 + distance * Math.cos(angle));
  camera.lookAt(0, 0, -0.5); camera.updateMatrixWorld();
  let width = 0, height = 0;
  function resize() {
    width = container.clientWidth; height = container.clientHeight;
    const corners = [];
    for (const x of [BOARD.minX, BOARD.maxX]) for (const z of [BOARD.minZ, BOARD.maxZ]) for (const y of [-0.75, 2.8]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    const bounds = new THREE.Box3().setFromPoints(corners);
    const middle = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const aspect = width / Math.max(1, height), h = Math.max(size.y / 2, size.x / (2 * aspect)) * 1.045;
    Object.assign(camera, { left: middle.x - h * aspect, right: middle.x + h * aspect, top: middle.y + h, bottom: middle.y - h, near: 0.1, far: 100 });
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
  }
  new ResizeObserver(resize).observe(container); resize();
  const projected = new THREE.Vector3();
  function project(x, y, z) {
    projected.set(x, y, z).project(camera);
    const rect = container.getBoundingClientRect();
    return { x: rect.left + (projected.x + 1) * width / 2, y: rect.top + (1 - projected.y) * height / 2 };
  }
  let wake = 0;
  function render(race, dt, now) {
    boatRoot.position.set(race.x, 0.065, race.z); boatRoot.rotation.y = race.heading;
    const speed = Math.hypot(race.vx, race.vz);
    boat.position.y = reducedMotion ? 0 : Math.sin(now * 0.004) * 0.024;
    boat.rotation.x = -Math.min(0.08, speed * 0.006);
    halo.position.set(race.x, 0.075, race.z);
    if (!reducedMotion) {
      wake += dt;
      if (speed > 1 && wake > 0.045) {
        wake = 0;
        for (const side of [-1, 1]) particle(race.x - Math.sin(race.heading) * 0.65 + Math.cos(race.heading) * side * 0.2,
          race.z - Math.cos(race.heading) * 0.65 - Math.sin(race.heading) * side * 0.2,
          race.boosting ? '#d6fbff' : '#a4e3e7', -race.vx * 0.12 + side * Math.cos(race.heading) * 0.4, -race.vz * 0.12 - side * Math.sin(race.heading) * 0.4, 0.65);
      }
      buoys.forEach((buoy, i) => { buoy.position.y = 0.08 + Math.sin(now * 0.002 + i) * 0.04; });
    }
    stars.forEach((star, i) => {
      const active = race.stars[i].active;
      star.group.visible = active;
      star.shadow.visible = active;
      if (!reducedMotion) { star.group.position.y = 0.65 + Math.sin(now * 0.003 + i) * 0.1; star.object.rotation.y = Math.sin(now * 0.0015 + i) * 0.4; }
    });
    for (let i = effects.length - 1; i >= 0; i--) {
      const p = effects[i]; p.life -= dt;
      if (p.life <= 0) { scene.remove(p.object); p.object.material.dispose(); effects.splice(i, 1); continue; }
      p.object.position.x += p.vx * dt; p.object.position.z += p.vz * dt;
      p.object.scale.setScalar(0.4 + p.life / p.maxLife * 2);
      p.object.material.opacity = p.life / p.maxLife;
    }
    renderer.render(scene, camera);
  }
  function burst(x, z, color = '#ffe18a') {
    if (reducedMotion) return;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; particle(x, z, color, Math.cos(a) * 2, Math.sin(a) * 2, 0.55, 0.4); }
  }
  function clearEffects() { for (const p of effects) { scene.remove(p.object); p.object.material.dispose(); } effects.length = 0; }
  return { render, project, burst, clearEffects, camera, renderer };
}
