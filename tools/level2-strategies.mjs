// Repeatable balance runs: every pilot starts at the real spawn with traffic,
// collisions, star respawns and the 30-second clock enabled. No teleporting.
import {
  createRace, stepRace, angleDifference, nearestCourse, pointOnCourse,
  COURSE_LENGTH, HARBOR_ENTRY, HARBOR_EXIT, HARBOR_PASSAGE, HARBOR_STAR_CENTER,
  STAR_LAYOUT,
} from '../level2/race.mjs';

function steerTo(race, target, throttle = 1, boost = false) {
  const error = angleDifference(Math.atan2(target.x - race.x, target.z - race.z), race.heading);
  return { throttle, steer: -error * 4, boost: boost && Math.abs(error) < 0.25 };
}

function starLinePoint(distance) {
  const count = STAR_LAYOUT.filter(star => !star.harbor).length;
  const position = ((distance / COURSE_LENGTH * count - 0.5) % count + count) % count;
  const index = Math.floor(position), fraction = position - index;
  const offset = 1.15 * ((index % 3 - 1) * (1 - fraction) + (((index + 1) % count) % 3 - 1) * fraction);
  return pointOnCourse(distance, offset);
}

export function outerPilot({ boost = false } = {}) {
  return race => steerTo(race, starLinePoint(nearestCourse(race.x, race.z).distance + 2), 1, boost);
}

function harborApproach() {
  const path = [];
  for (let distance = 0; distance < HARBOR_ENTRY - 1; distance++) path.push(starLinePoint(distance));
  path.push({ x: 22, z: -38 }, { x: 20, z: -34 }, { x: 12, z: -32 }, { x: 10, z: -26 });
  return path;
}

function followPath(race, path, index, boost) {
  const lookAhead = race.z > -24 && race.x > 0 && race.x < 30 ? 4 : 2;
  while (index < path.length - 1 && Math.hypot(race.x - path[index].x, race.z - path[index].z) < lookAhead) index++;
  const target = path[index];
  const error = angleDifference(Math.atan2(target.x - race.x, target.z - race.z), race.heading);
  return { index, controls: steerTo(race, target, Math.abs(error) > 0.5 ? 0.35 : 1, boost) };
}

export function shortcutPilot({ boost = false } = {}) {
  const path = [...harborApproach(), HARBOR_PASSAGE[0], HARBOR_STAR_CENTER, ...HARBOR_PASSAGE.slice(1)];
  for (let distance = HARBOR_EXIT + 1; distance < COURSE_LENGTH + HARBOR_ENTRY - 2; distance++) path.push(starLinePoint(distance));
  let index = 0;
  return race => {
    const step = followPath(race, path, index, boost); index = step.index;
    return step.controls;
  };
}

export function starCirclePilot({ throttle = 0.85, radius = 4.5, boost = false, center = { x: 8, z: -15 } } = {}) {
  const path = [...harborApproach(), { x: center.x + radius, z: center.z }];
  let index = 0, circling = false;
  return race => {
    if (!circling) {
      const step = followPath(race, path, index, boost); index = step.index;
      circling = index === path.length - 1 && Math.hypot(race.x - path[index].x, race.z - path[index].z) < 3;
      if (!circling) return step.controls;
    }
    const angle = Math.atan2(race.z - center.z, race.x - center.x) - 0.65;
    return steerTo(race, { x: center.x + Math.cos(angle) * radius, z: center.z + Math.sin(angle) * radius }, throttle);
  };
}

export function finishCirclePilot({ throttle = 0.7, steer = 1 } = {}) {
  return () => ({ throttle, steer });
}

export function runPilot(pilot) {
  const race = createRace();
  while (!race.done) stepRace(race, pilot(race));
  return race;
}

export const BALANCE_SCENARIOS = [
  { name: 'Outer course', style: 'normal', place: 4, pilot: () => outerPilot() },
  { name: 'Outer course + boost', style: 'normal', place: 4, pilot: () => outerPilot({ boost: true }) },
  { name: 'Shortcut', style: 'normal', place: 4, pilot: () => shortcutPilot() },
  { name: 'Shortcut + boost', style: 'normal', place: 4, pilot: () => shortcutPilot({ boost: true }) },
  { name: 'Shortcut + boost outside harbor', style: 'normal', place: 4, pilot: () => {
    const pilot = shortcutPilot({ boost: true });
    return race => {
      const controls = pilot(race);
      controls.boost &&= !(race.x > 0 && race.x < 25 && race.z > -35 && race.z < 10);
      return controls;
    };
  } },
  { name: 'Star circle, slower', style: 'stars', place: 2, pilot: () => starCirclePilot({ throttle: 0.65 }) },
  { name: 'Star circle, medium', style: 'stars', place: 2, pilot: () => starCirclePilot() },
  { name: 'Star circle, full throttle', style: 'stars', place: 2, pilot: () => starCirclePilot({ throttle: 1 }) },
  { name: 'Star circle, wider', style: 'stars', place: 2, pilot: () => starCirclePilot({ throttle: 1, radius: 5 }) },
  { name: 'Star circle, best sampled line', style: 'stars', place: 2, pilot: () => starCirclePilot({ throttle: 1, radius: 5, center: { x: 10, z: -15 } }) },
  { name: 'Finish circle, left', style: 'finish', place: 1, pilot: () => finishCirclePilot({ throttle: 1, steer: -1 }) },
  { name: 'Finish circle, right', style: 'finish', place: 1, pilot: () => finishCirclePilot({ throttle: 1, steer: 1 }) },
  { name: 'Finish circle, slower', style: 'finish', place: 1, pilot: () => finishCirclePilot({ throttle: 0.7 }) },
];
