import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { albert } from '../intro/characters3d.js';
import { COURSE_LENGTH, BOARD, HARBOR, TRACK_HALF_WIDTH, NPC_DRIVERS, OBSTACLES, STAR_LAYOUT, pointOnCourse, waterClearance, passageClearance } from './race.mjs?v=npc-boats';
import { buildTerrain } from './terrain.mjs?v=npc-boats';

export async function createScene(container) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'An isometric view following Albert around a wide coastal race course and a working harbor, with six other racers, golden stars, rock obstacles, red buoys, and Albert in an orange speedboat.');
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e7f4ff', '#726951', 2.1));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.5);
  sun.position.set(-40, 100, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 100, bottom: -100, far: 260 });
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
  // The familiar blueprint grid and cream raised plinth from the office.
  const points = [];
  for (let t = -120; t <= 120; t += 2) points.push(t, -0.75, -120, t, -0.75, 120, -120, -0.75, t, 120, -0.75, t);
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.LineBasicMaterial({ color: '#4884ba', transparent: true, opacity: 0.6 })));
  const boardWidth = BOARD.maxX - BOARD.minX, boardDepth = BOARD.maxZ - BOARD.minZ;
  const boardX = (BOARD.minX + BOARD.maxX) / 2;
  const boardZ = (BOARD.minZ + BOARD.maxZ) / 2;
  const base = mesh(new RoundedBoxGeometry(boardWidth, 0.62, boardDepth, 2, 0.28), '#d9e7f7', boardX, -0.42, boardZ);
  base.add(new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry, 35), new THREE.LineBasicMaterial({ color: '#f7fcff' })));
  mesh(new RoundedBoxGeometry(boardWidth - 0.1, 0.18, boardDepth - 0.1, 2, 0.22), '#e8d3a6', boardX, -0.06, boardZ);
  const colors = { water: '#45aec3', sand: '#e8d3a6', grass: '#97b675', shore: '#f4e5bd' };
  for (const [name, vertices] of Object.entries(buildTerrain())) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
    const surface = mesh(geometry, colors[name], 0, 0, 0, scene, name === 'water' ? { roughness: 0.52, metalness: 0.08 } : {});
    surface.castShadow = false;
  }
  // Subtle foam dashes suggest the racing line without becoming reward tiles.
  for (let d = 2; d < COURSE_LENGTH; d += 6) {
    const p = pointOnCourse(d, -5.7);
    const foam = box(0.045, 0.008, 0.42, '#b5e5e3', p.x, 0.063, p.z);
    foam.rotation.y = Math.atan2(p.tx, p.tz);
    foam.castShadow = false;
  }
  // A few small course chevrons indicate clockwise travel.
  const chevron = new THREE.Shape();
  chevron.moveTo(-0.22, -0.25); chevron.lineTo(0, 0.08); chevron.lineTo(0.22, -0.25);
  chevron.lineTo(0.22, -0.03); chevron.lineTo(0, 0.3); chevron.lineTo(-0.22, -0.03); chevron.closePath();
  const chevronGeo = new THREE.ShapeGeometry(chevron); chevronGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 18; i++) {
    const p = pointOnCourse(COURSE_LENGTH * (i + 0.5) / 18, 5.7);
    const arrow = mesh(chevronGeo, '#d9f4eb', p.x, 0.068, p.z, scene, { side: THREE.DoubleSide });
    arrow.rotation.y = Math.atan2(p.tx, p.tz); arrow.castShadow = false;
  }
  const start = pointOnCourse(0);
  const finish = new THREE.Group(); finish.position.set(start.x, 0.069, start.z); finish.rotation.y = Math.atan2(start.tx, start.tz); scene.add(finish);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 36; i++) box(0.44, 0.008, 0.18, (i + row) % 2 ? '#fcf8e9' : '#34627b', (i - 17.5) * 0.44, 0, (row - 0.5) * 0.18, finish);
  for (const side of [-1, 1]) {
    cylinder(0.055, 0.065, 1.3, '#f8f1de', side * 8.4, 0.65, 0, finish);
    box(0.6, 0.32, 0.035, '#e0664a', side * 8.4 + 0.28, 1.13, 0, finish);
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
  // Shore scenery is spread along the coast; nothing marks a farming center.
  for (let i = 0; i < 28; i++) {
    const p = pointOnCourse(COURSE_LENGTH * i / 28, (i % 3 ? 1 : -1) * (TRACK_HALF_WIDTH + 3));
    if (waterClearance(p.x, p.z) < -1.5) palm(p.x, p.z, 1 + (i % 4) * 0.2);
  }
  // Orange course markers reproduce the broad, buoy-lined racing lanes.
  const markerGeometry = new THREE.SphereGeometry(0.18, 8, 6);
  const markers = [];
  for (let d = 0; d < COURSE_LENGTH; d += 4.8) for (const side of [-1, 1]) {
    const p = pointOnCourse(d, side * (TRACK_HALF_WIDTH - 0.6));
    markers.push(p);
  }
  const markerMesh = new THREE.InstancedMesh(markerGeometry, material('#ec9d42'), markers.length);
  const markerMatrix = new THREE.Matrix4();
  markers.forEach((p, i) => { markerMatrix.makeTranslation(p.x, 0.15, p.z); markerMesh.setMatrixAt(i, markerMatrix); });
  markerMesh.castShadow = true; scene.add(markerMesh);
  // Keep the quay clear of the new passage, including its railings.
  const quaySegments = [];
  for (const i of [0, 6, 7, 8, 9]) {
    const a = HARBOR[i], b = HARBOR[(i + 1) % HARBOR.length];
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4);
    const at = t => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    let start = null;
    for (let j = 0; j <= steps; j++) {
      const midpoint = at((j + 0.5) / steps);
      const solid = j < steps && passageClearance(midpoint.x, midpoint.z) < -1;
      if (solid && start === null) start = j;
      if (!solid && start !== null) { quaySegments.push([at(start / steps), at(j / steps)]); start = null; }
    }
  }
  for (const [a, b] of quaySegments) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    const quay = new THREE.Group();
    quay.position.set((a.x + b.x) / 2 + dz / length * 0.6, 0, (a.z + b.z) / 2 - dx / length * 0.6);
    quay.rotation.y = Math.atan2(dx, dz); scene.add(quay);
    box(1.3, 0.7, length, '#96a5a1', 0, 0.25, 0, quay);
    box(1.45, 0.16, length, '#c6cdc2', 0, 0.65, 0, quay);
    for (let d = -length / 2 + 0.7; d < length / 2; d += 2.4) {
      box(0.1, 0.55, 0.1, '#486471', 0.3, 0.98, d, quay);
    }
    box(0.06, 0.06, length, '#486471', 0.3, 1.18, 0, quay);
  }
  const buoys = [];
  for (const [i, obstacle] of OBSTACLES.entries()) {
    const group = new THREE.Group(); group.position.set(obstacle.x, 0.08, obstacle.z); scene.add(group);
    if (obstacle.kind === 'rock') {
      const rock = mesh(new THREE.DodecahedronGeometry(obstacle.radius, 0), '#8a9a9a', 0, 0.3, 0, group);
      rock.rotation.set(0.1, i * 1.7, 0.3); rock.scale.y = 0.9;
      mesh(new THREE.DodecahedronGeometry(obstacle.radius * 0.4), '#b3b9a9', -0.1, 0.69, 0, group);
    } else if (obstacle.kind === 'launch') {
      group.rotation.y = obstacle.heading;
      const hull = mesh(new THREE.SphereGeometry(1, 12, 8), '#e5b246', 0, 0.32, 0, group); hull.scale.set(0.8, 0.35, 1.55);
      box(1.12, 0.18, 2.1, '#fff2cc', 0, 0.54, 0, group);
      box(0.95, 0.68, 0.85, '#faf4e3', 0, 0.94, -0.25, group);
      box(0.8, 0.28, 0.03, '#638994', 0, 1.04, 0.19, group);
      box(0.14, 0.4, 0.14, '#486471', 0.22, 1.43, -0.3, group);
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
    const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 0.275 : 0.62;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeometry = new THREE.ExtrudeGeometry(starShape, { depth: 0.13, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.03, bevelSegments: 1, steps: 1 });
  const stars = STAR_LAYOUT.map(star => {
    const group = new THREE.Group(); group.position.set(star.x, 0.6, star.z); scene.add(group);
    const object = mesh(starGeometry, '#ffd052', 0, 0, 0, group, { emissive: '#bd7b12', emissiveIntensity: 0.22 });
    object.rotation.x = -Math.PI / 4;
    const shadow = mesh(new THREE.RingGeometry(0.34, 0.52, 24), '#dbf4db', star.x, 0.068, star.z);
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
  const npcModels = NPC_DRIVERS.map(driver => {
    const root = new THREE.Group(); scene.add(root);
    const body = new THREE.Group(); body.scale.setScalar(1.05); root.add(body);
    mesh(hull, driver.color, 0, 0.27, 0, body);
    const deck = mesh(new THREE.ShapeGeometry(hullShape), '#fff5d9', 0, 0.32, 0, body, { side: THREE.DoubleSide });
    deck.rotation.x = Math.PI / 2; deck.scale.setScalar(0.86);
    box(0.55, 0.08, 0.65, '#536a7c', 0, 0.35, -0.17, body);
    box(0.5, 0.18, 0.05, '#b7eff0', 0, 0.45, 0.34, body).rotation.x = -0.2;
    box(0.22, 0.2, 0.2, '#354b62', 0, 0.22, -0.8, body);
    box(0.3, 0.32, 0.23, driver.color, 0, 0.52, -0.18, body);
    mesh(new THREE.SphereGeometry(0.18, 10, 8), '#fff5df', 0, 0.83, -0.16, body);
    box(0.26, 0.085, 0.035, '#354b62', 0, 0.84, 0, body);
    return { root, body, wake: 0 };
  });
  const effects = [];
  const particleGeometry = new THREE.IcosahedronGeometry(0.07, 0);
  function particle(x, z, color, vx, vz, life = 0.6, y = 0.12) {
    if (effects.length > 160) return;
    const object = new THREE.Mesh(particleGeometry, new THREE.MeshBasicMaterial({ color, transparent: true }));
    object.position.set(x, y, z); scene.add(object);
    effects.push({ object, vx, vz, life, maxLife: life });
  }
  const camera = new THREE.OrthographicCamera();
  // The office's isometric angle stays locked while position follows the boat.
  const angle = Math.PI / 4, elevation = 0.62, distance = 150;
  const offset = new THREE.Vector3(distance * Math.sin(angle), distance * elevation, distance * Math.cos(angle));
  const target = new THREE.Vector3(boardX, 0, boardZ);
  let following = false, width = 0, height = 0;
  function placeCamera() { camera.position.copy(target).add(offset); camera.lookAt(target); camera.updateMatrixWorld(); }
  function resize() {
    width = container.clientWidth; height = container.clientHeight;
    const aspect = width / Math.max(1, height);
    // Compute the overview bounds at the board center independently of follow position.
    const savedTarget = target.clone(); target.set(boardX, 0, boardZ); placeCamera();
    const corners = [];
    for (const x of [BOARD.minX, BOARD.maxX]) for (const z of [BOARD.minZ, BOARD.maxZ]) for (const y of [-0.75, 3]) corners.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    const bounds = new THREE.Box3().setFromPoints(corners), size = bounds.getSize(new THREE.Vector3());
    const h = following ? Math.max(8.8, 9.5 / aspect) : Math.max(size.y / 2, size.x / (2 * aspect)) * 1.08;
    Object.assign(camera, { left: -h * aspect, right: h * aspect, top: h, bottom: -h, near: 0.1, far: 500 });
    target.copy(savedTarget); placeCamera(); camera.updateProjectionMatrix(); renderer.setSize(width, height);
  }
  function follow(race) { following = true; target.set(race.x, 0, race.z); resize(); }
  new ResizeObserver(resize).observe(container); resize();
  const projected = new THREE.Vector3();
  function project(x, y, z) {
    projected.set(x, y, z).project(camera);
    const rect = container.getBoundingClientRect();
    return { x: rect.left + (projected.x + 1) * width / 2, y: rect.top + (1 - projected.y) * height / 2 };
  }
  let wake = 0;
  function render(race, dt, now) {
    if (following) {
      const desired = new THREE.Vector3(race.x + race.vx * 0.16, 0, race.z + race.vz * 0.16);
      target.lerp(desired, reducedMotion ? 1 : 1 - Math.exp(-dt * 7)); placeCamera();
    }
    boatRoot.position.set(race.x, 0.065, race.z); boatRoot.rotation.y = race.heading;
    npcModels.forEach((model, i) => {
      const npc = race.npcs[i]; model.root.visible = Boolean(npc);
      if (!npc) return;
      model.root.position.set(npc.x, 0.065, npc.z); model.root.rotation.y = npc.heading;
      model.body.position.y = reducedMotion ? 0 : Math.sin(race.time * 4 + i) * 0.025;
      model.body.rotation.x = -Math.min(0.08, npc.speed * 0.006);
      if (!reducedMotion && Math.hypot(npc.x - race.x, npc.z - race.z) < 35) {
        model.wake += dt;
        if (npc.speed > 1 && model.wake > 0.09) {
          model.wake = 0;
          for (const side of [-1, 1]) particle(npc.x - Math.sin(npc.heading) * 0.8 + Math.cos(npc.heading) * side * 0.22,
            npc.z - Math.cos(npc.heading) * 0.8 - Math.sin(npc.heading) * side * 0.22,
            '#c3eff0', -npc.vx * 0.1, -npc.vz * 0.1, 0.55);
        }
      }
    });
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
  return { render, project, burst, clearEffects, follow, camera, renderer };
}
