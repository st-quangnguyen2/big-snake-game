import * as THREE from 'three';
import { mat, GEO, part, pivot, buildEye, EyeRig } from './common.js';

// Procedural small animals. Each model faces +Z, stands on y = 0 and exposes
// `userData.animate(t, state)` where state = { moving: 0..1, hop: -1 | 0..1, panic: bool }.

const BLACK = () => mat('#16161a', { roughness: 0.2 });
const WHITE = () => mat('#ffffff', { roughness: 0.15 });
const HIGHLIGHT = new THREE.MeshBasicMaterial({ color: '#ffffff' });

/** Big dark cartoon eye with a thin white rim that shows when it glances. */
function darkEye(p, dir, size) {
  return buildEye({ p, dir, size, sclera: WHITE(), iris: BLACK(), irisScale: 0.82, highlight: HIGHLIGHT });
}

const mouseTailGeometry = (() => {
  let geometry;
  return () => (geometry ??= new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.02, -0.15),
    new THREE.Vector3(0.07, 0.07, -0.3),
    new THREE.Vector3(0.0, 0.12, -0.44),
    new THREE.Vector3(-0.07, 0.13, -0.54),
  ]), 20, 0.02, 6, false));
})();

export function buildMouse() {
  const fur = mat('#a3a6b4', { roughness: 0.85 });
  const furLight = mat('#dcdee6', { roughness: 0.85 });
  const pink = mat('#f4a3b5', { roughness: 0.6 });
  const whisker = mat('#f2f2f2', { roughness: 0.5 });

  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  body.add(part(GEO.sphere, fur, { s: [0.26, 0.22, 0.38], p: [0, 0.25, -0.02] }));
  body.add(part(GEO.sphere, furLight, { s: [0.2, 0.14, 0.3], p: [0, 0.17, 0.03] }));

  const head = pivot([0, 0.3, 0.32]);
  body.add(head);
  head.add(part(GEO.sphere, fur, { s: [0.19, 0.17, 0.2] }));
  head.add(part(GEO.sphere, fur, { s: [0.1, 0.09, 0.14], p: [0, -0.03, 0.17] }));
  const nose = part(GEO.sphere, pink, { s: 0.04, p: [0, -0.01, 0.31] });
  head.add(nose);
  const eyes = [];
  for (const sx of [-1, 1]) {
    head.add(part(GEO.sphere, fur, { s: [0.13, 0.13, 0.035], p: [sx * 0.13, 0.16, -0.04], r: [0, sx * -0.35, 0] }));
    head.add(part(GEO.sphere, pink, { s: [0.09, 0.09, 0.02], p: [sx * 0.135, 0.16, -0.012], r: [0, sx * -0.35, 0] }));
    const eye = darkEye([sx * 0.092, 0.05, 0.148], [sx * 0.5, 0.25, 0.83], 0.046);
    head.add(eye);
    eyes.push(eye);
    for (const k of [-1, 0, 1]) {
      head.add(part(GEO.cylLo, whisker, {
        s: [0.004, 0.17, 0.004], p: [sx * 0.15, -0.025 + k * 0.016, 0.22], r: [0, 0, sx * (Math.PI / 2 + k * 0.18)],
      }));
    }
  }

  const tail = pivot([0, 0.2, -0.38]);
  tail.add(part(mouseTailGeometry(), pink));
  body.add(tail);

  const feet = [];
  for (const [x, z] of [[-0.13, 0.17], [0.13, 0.17], [-0.13, -0.17], [0.13, -0.17]]) {
    const foot = part(GEO.sphere, pink, { s: [0.055, 0.035, 0.08], p: [x, 0.035, z] });
    foot.userData.z = z;
    feet.push(foot);
    g.add(foot);
  }

  const eyeRig = new EyeRig(eyes);
  g.userData.animate = (t, { moving = 0, panic = false } = {}) => {
    eyeRig.update(t, { alert: panic });
    const step = t * 24;
    body.position.y = Math.abs(Math.sin(step)) * 0.03 * moving;
    feet.forEach((foot, i) => {
      foot.position.z = foot.userData.z + Math.sin(step + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.06 * moving;
    });
    tail.rotation.y = Math.sin(t * 7) * 0.45;
    head.rotation.x = Math.sin(t * 3.1) * 0.06;
    nose.scale.setScalar(0.04 * (1 + Math.max(0, Math.sin(t * 18)) * 0.25));
  };
  return g;
}

export function buildChick() {
  const yellow = mat('#ffd93b', { roughness: 0.9 });
  const yellowDark = mat('#f2bd16', { roughness: 0.9 });
  const orange = mat('#ff8a1c', { roughness: 0.5 });
  const cheek = mat('#ff9ea8', { roughness: 0.8 });

  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  body.add(part(GEO.sphere, yellow, { s: [0.3, 0.28, 0.32], p: [0, 0.33, 0] }));
  body.add(part(GEO.cone, yellowDark, { s: [0.09, 0.16, 0.06], p: [0, 0.43, -0.3], r: [-1.05, 0, 0] }));

  const head = pivot([0, 0.63, 0.08]);
  body.add(head);
  head.add(part(GEO.sphere, yellow, { s: 0.21 }));
  for (const k of [-1, 0, 1]) {
    head.add(part(GEO.cone, yellowDark, { s: [0.028, 0.1, 0.028], p: [k * 0.03, 0.22, -0.02], r: [-0.2, 0, -k * 0.45] }));
  }
  head.add(part(GEO.cone, orange, { s: [0.06, 0.1, 0.05], p: [0, -0.015, 0.23], r: [Math.PI / 2, 0, 0] }));
  head.add(part(GEO.cone, orange, { s: [0.045, 0.07, 0.035], p: [0, -0.05, 0.2], r: [Math.PI / 2 + 0.35, 0, 0] }));
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = darkEye([sx * 0.09, 0.05, 0.17], [sx * 0.45, 0.2, 0.87], 0.046);
    head.add(eye);
    eyes.push(eye);
    head.add(part(GEO.sphereLo, cheek, { s: [0.045, 0.03, 0.02], p: [sx * 0.145, -0.04, 0.14], r: [0, sx * 0.6, 0] }));
  }

  const wings = [];
  for (const sx of [-1, 1]) {
    const wing = pivot([sx * 0.27, 0.42, -0.02]);
    wing.add(part(GEO.sphere, yellowDark, { s: [0.06, 0.16, 0.2], p: [sx * 0.02, -0.08, 0] }));
    wing.userData.side = sx;
    wings.push(wing);
    body.add(wing);
  }

  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = pivot([sx * 0.1, 0.13, 0.02]);
    leg.add(part(GEO.cylLo, orange, { s: [0.02, 0.13, 0.02], p: [0, -0.05, 0] }));
    for (const a of [-0.45, 0, 0.45]) {
      leg.add(part(GEO.sphereLo, orange, { s: [0.025, 0.012, 0.065], p: [Math.sin(a) * 0.04, -0.11, 0.04 + Math.cos(a) * 0.02], r: [0, a, 0] }));
    }
    legs.push(leg);
    g.add(leg);
  }

  const eyeRig = new EyeRig(eyes);
  g.userData.animate = (t, { moving = 0, panic = false } = {}) => {
    eyeRig.update(t, { alert: panic });
    const step = t * 16;
    body.rotation.z = Math.sin(step) * 0.12 * moving;
    body.position.y = Math.abs(Math.sin(step)) * 0.025 * moving;
    head.rotation.x = Math.sin(t * 2.4) * 0.08;
    const flap = panic ? 0.5 + Math.sin(t * 34) * 0.5 : 0.08 + Math.sin(t * 3) * 0.04;
    wings.forEach((wing) => { wing.rotation.z = wing.userData.side * flap; });
    legs.forEach((leg, i) => { leg.rotation.x = Math.sin(step + i * Math.PI) * 0.6 * moving; });
  };
  return g;
}

const _up = new THREE.Vector3(0, 1, 0);
const _normal = new THREE.Vector3();

/**
 * Soft cartoon colour patch on an ellipsoid surface: a flattened blob sunk
 * just enough that its edges stay buried and only a smooth spot shows.
 */
function surfacePatch(material, { center, radii, dir, size }) {
  const d = new THREE.Vector3(...dir).normalize();
  const [a, b, c] = radii;
  _normal.set(d.x / a, d.y / b, d.z / c).normalize();
  const sink = (size * size) / 0.7 + 0.008;
  const mesh = new THREE.Mesh(GEO.sphere, material);
  mesh.scale.set(size, sink + 0.012, size * 0.85);
  mesh.quaternion.setFromUnitVectors(_up, _normal);
  mesh.position.set(center[0] + a * d.x, center[1] + b * d.y, center[2] + c * d.z).addScaledVector(_normal, -sink);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildFrog() {
  const green = mat('#56b947', { roughness: 0.42 });
  const greenDark = mat('#38923a', { roughness: 0.45 });
  const belly = mat('#dff0b0', { roughness: 0.6 });
  const mouthMat = mat('#2b5a24', { roughness: 0.6 });

  const g = new THREE.Group();
  const body = pivot([0, 0, 0]);
  g.add(body);
  const back = { center: [0, 0.2, -0.02], radii: [0.36, 0.2, 0.38] };
  body.add(part(GEO.sphere, green, { s: back.radii, p: back.center }));
  // A few big, soft darker patches on the back — simple and kid friendly.
  for (const [dir, size] of [[[-0.45, 0.85, -0.25], 0.11], [[0.42, 0.85, 0.05], 0.085], [[0.1, 0.8, -0.6], 0.075], [[0.65, 0.5, -0.45], 0.065]]) {
    body.add(surfacePatch(greenDark, { ...back, dir, size }));
  }
  const throat = part(GEO.sphere, belly, { s: [0.3, 0.13, 0.3], p: [0, 0.14, 0.05] });
  body.add(throat);
  body.add(part(GEO.sphere, green, { s: [0.3, 0.16, 0.24], p: [0, 0.27, 0.2] }));
  const eyes = [];
  for (const sx of [-1, 1]) {
    body.add(part(GEO.sphere, green, { s: 0.105, p: [sx * 0.15, 0.39, 0.22] }));
    const eye = darkEye([sx * 0.155, 0.42, 0.255], [sx * 0.4, 0.55, 0.73], 0.085);
    body.add(eye);
    eyes.push(eye);
  }
  const mouth = part(new THREE.TorusGeometry(0.2, 0.011, 6, 24, 1.3), mouthMat, {
    p: [0, 0.43, 0.33], r: [0.35, 0, -Math.PI / 2 - 0.65],
  });
  body.add(mouth);

  const backLegs = [];
  for (const sx of [-1, 1]) {
    const leg = pivot([sx * 0.25, 0.13, -0.14]);
    leg.add(part(GEO.sphere, green, { s: [0.12, 0.09, 0.2], r: [0, sx * 0.35, 0] }));
    leg.add(part(GEO.sphere, greenDark, { s: [0.09, 0.03, 0.16], p: [sx * 0.07, -0.1, 0.1] }));
    backLegs.push(leg);
    g.add(leg);
    g.add(part(GEO.cylLo, green, { s: [0.035, 0.14, 0.035], p: [sx * 0.19, 0.08, 0.24], r: [0, 0, sx * 0.2] }));
    g.add(part(GEO.sphereLo, greenDark, { s: [0.06, 0.02, 0.06], p: [sx * 0.21, 0.015, 0.27] }));
  }

  const eyeRig = new EyeRig(eyes, { range: 0.35, pitchRange: 0.18 });
  g.userData.animate = (t, { hop = -1, panic = false } = {}) => {
    eyeRig.update(t, { alert: panic });
    if (hop >= 0) {
      const k = Math.sin(hop * Math.PI);
      backLegs.forEach((leg) => { leg.rotation.x = -k * 0.95; leg.position.y = 0.13 - k * 0.05; });
      body.rotation.x = -k * 0.25;
      throat.scale.y = 0.13;
    } else {
      backLegs.forEach((leg) => { leg.rotation.x = 0; leg.position.y = 0.13; });
      body.rotation.x = 0;
      throat.scale.y = 0.13 * (1 + Math.max(0, Math.sin(t * 7)) * 0.35);
    }
  };
  return g;
}

const earGeometries = new Map();
/**
 * Ellipsoid ear (base at y = 0) whose upper half curls forward (+Z) along a
 * circular arc, so a floppy ear stays one smooth surface without joints.
 */
function earGeometry({ w, h, d, z = 0, bend }) {
  const key = [w, h, d, z, bend].join();
  let geometry = earGeometries.get(key);
  if (geometry) return geometry;
  geometry = new THREE.SphereGeometry(1, 14, 20);
  geometry.scale(w, h, d);
  geometry.translate(0, h * 0.9, z);
  // Same arc for fur and inner pink so the two layers stay glued together.
  const y0 = 0.24;
  const radius = 0.273 / Math.max(bend, 1e-3);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y <= y0) continue;
    const theta = (y - y0) / radius;
    const r = radius - pos.getZ(i);
    pos.setY(i, y0 + r * Math.sin(theta));
    pos.setZ(i, radius - r * Math.cos(theta));
  }
  geometry.computeVertexNormals();
  earGeometries.set(key, geometry);
  return geometry;
}

export function buildRabbit() {
  const fur = mat('#f5f0e9', { roughness: 0.95 });
  const pink = mat('#f7a8b8', { roughness: 0.6 });

  const g = new THREE.Group();
  const body = pivot([0, 0, 0]);
  g.add(body);
  body.add(part(GEO.sphere, fur, { s: [0.28, 0.27, 0.36], p: [0, 0.3, -0.06] }));
  for (const sx of [-1, 1]) body.add(part(GEO.sphere, fur, { s: [0.15, 0.16, 0.2], p: [sx * 0.15, 0.22, -0.16] }));
  body.add(part(GEO.sphere, mat('#ffffff', { roughness: 1 }), { s: 0.095, p: [0, 0.33, -0.42] }));

  const head = pivot([0, 0.55, 0.24]);
  body.add(head);
  head.add(part(GEO.sphere, fur, { s: [0.2, 0.19, 0.21] }));
  head.add(part(GEO.sphere, pink, { s: 0.034, p: [0, -0.02, 0.205] }));
  const ears = [];
  const eyes = [];
  for (const sx of [-1, 1]) {
    head.add(part(GEO.sphere, fur, { s: [0.09, 0.075, 0.08], p: [sx * 0.07, -0.07, 0.14] }));
    const eye = darkEye([sx * 0.11, 0.04, 0.14], [sx * 0.62, 0.15, 0.77], 0.048);
    head.add(eye);
    eyes.push(eye);
    // One smooth bent ear per side, splayed outward in a V; the right one flops forward.
    const bend = sx > 0 ? 1.7 : 0.3;
    const ear = pivot([sx * 0.1, 0.14, -0.03], [-0.25, sx * 0.25, -sx * 0.34]);
    ear.add(part(earGeometry({ w: 0.072, h: 0.27, d: 0.05, bend }), fur));
    ear.add(part(earGeometry({ w: 0.044, h: 0.22, d: 0.03, z: 0.027, bend }), pink));
    ear.userData.side = sx;
    ears.push(ear);
    head.add(ear);
  }

  const backFeet = [];
  for (const sx of [-1, 1]) {
    g.add(part(GEO.sphere, fur, { s: [0.05, 0.04, 0.1], p: [sx * 0.1, 0.04, 0.18] }));
    const foot = part(GEO.sphere, fur, { s: [0.07, 0.04, 0.2], p: [sx * 0.16, 0.04, -0.08] });
    backFeet.push(foot);
    g.add(foot);
  }

  const eyeRig = new EyeRig(eyes);
  g.userData.animate = (t, { hop = -1, panic = false } = {}) => {
    eyeRig.update(t, { alert: panic });
    const k = hop >= 0 ? Math.sin(hop * Math.PI) : 0;
    ears.forEach((ear) => {
      ear.rotation.x = -0.25 - k * 0.55 + (hop < 0 ? Math.sin(t * 2 + ear.userData.side) * 0.05 : 0);
    });
    body.scale.z = 1 + k * 0.12;
    body.rotation.x = -k * 0.15;
    backFeet.forEach((foot) => { foot.rotation.x = k * 0.7; foot.position.z = -0.08 - k * 0.08; });
    head.rotation.y = hop < 0 ? Math.sin(t * 0.9) * 0.15 : 0;
  };
  return g;
}

export const ANIMAL_TYPES = {
  mouse: {
    name: { vi: 'Chuột', en: 'Mouse' }, emoji: '🐭', points: 40, growth: 2, radius: 0.42, color: '#a3a6b4', weight: 30,
    move: 'scurry', wanderSpeed: 1.4, fleeSpeed: 4.6, fleeRadius: 6,
    desc: { vi: 'Chạy lon ton rất nhanh, đổi hướng liên tục.', en: 'Scurries very fast and keeps changing direction.' }, build: buildMouse,
  },
  chick: {
    name: { vi: 'Gà con', en: 'Chick' }, emoji: '🐥', points: 35, growth: 2, radius: 0.42, color: '#ffd93b', weight: 28,
    move: 'scurry', wanderSpeed: 1.0, fleeSpeed: 3.6, fleeRadius: 5,
    desc: { vi: 'Chậm, vỗ cánh hoảng loạn khi bị đuổi.', en: 'Slow, flaps around in a panic when chased.' }, build: buildChick,
  },
  frog: {
    name: { vi: 'Ếch', en: 'Frog' }, emoji: '🐸', points: 50, growth: 2, radius: 0.42, color: '#56b947', weight: 24,
    move: 'hop', hopTime: 0.42, hopHeight: 0.55, wanderSpeed: 1.2, fleeSpeed: 4.2, fleeRadius: 5.5,
    desc: { vi: 'Nhảy từng cú, khó đoán hướng.', en: 'Moves in hops, hard to predict.' }, build: buildFrog,
  },
  rabbit: {
    name: { vi: 'Thỏ', en: 'Rabbit' }, emoji: '🐰', points: 70, growth: 3, radius: 0.45, color: '#f5f0e9', weight: 18,
    move: 'hop', hopTime: 0.55, hopHeight: 0.7, wanderSpeed: 1.5, fleeSpeed: 4.9, fleeRadius: 7,
    desc: { vi: 'Nhanh nhất và cảnh giác nhất — cần tăng tốc để bắt.', en: 'The fastest and most alert — boost to catch it.' }, build: buildRabbit,
  },
};
