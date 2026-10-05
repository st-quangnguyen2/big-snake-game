import * as THREE from 'three';
import { mat, GEO, part, pivot } from './common.js';

// Procedural flowers. Every part is tagged in userData.role so the world can
// give each instance its own height without squashing the blossom:
//   'stem' — stretched vertically by the height factor,
//   'head' — moved up with the top of the stem,
//   'base' — leaves at the foot, left as is.
// Parts with userData.tint use a white material and get a per-instance colour.

const STEM = () => mat('#4c9a3a', { roughness: 0.7 });
const LEAF = () => mat('#4c9a3a', { roughness: 0.7, side: THREE.DoubleSide });
const TINT = () => mat('#ffffff', { roughness: 0.6 });
const DOUBLE_TINT = () => mat('#ffffff', { roughness: 0.6, side: THREE.DoubleSide });

const role = (mesh, name, tint = false) => {
  mesh.userData.role = name;
  mesh.userData.tint = tint;
  mesh.castShadow = false;
  return mesh;
};

function stem(g, height, radius = 0.016) {
  g.add(role(part(GEO.cylLo, STEM(), { s: [radius, height, radius], p: [0, height / 2, 0] }), 'stem'));
}

function baseLeaves(g, count = 2, length = 0.16) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.4;
    g.add(role(part(GEO.sphereLo, LEAF(), {
      s: [length, 0.012, length * 0.32], p: [Math.cos(a) * length * 0.7, 0.04, Math.sin(a) * length * 0.7], r: [0, -a, 0.35],
    }), 'base'));
  }
}

const lazyGeometry = (factory) => {
  let value;
  return () => (value ??= factory());
};

/** Flat petal from a 2D outline [[x, y], ...] (base at origin, tip along +X), laid horizontally. */
function flatPetal(outline) {
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  return new THREE.ShapeGeometry(shape, 4).rotateX(-Math.PI / 2);
}

// Cosmos: wide wedge with a toothed tip. Daisy: long narrow strap.
const cosmosPetal = lazyGeometry(() => flatPetal([
  [0, 0], [0.02, 0.012], [0.045, 0.021], [0.068, 0.025], [0.074, 0.013], [0.069, 0.004],
  [0.075, -0.006], [0.07, -0.016], [0.066, -0.025], [0.045, -0.021], [0.02, -0.012],
]));
const daisyPetal = lazyGeometry(() => flatPetal([
  [0, 0], [0.015, 0.008], [0.05, 0.01], [0.068, 0.007], [0.074, 0], [0.068, -0.007], [0.05, -0.01], [0.015, -0.008],
]));

const shellGeometries = new Map();
/**
 * Curved petal shell: a slice of a sphere (phi width `width`, theta from `top`
 * to `bottom`, in turns of PI). `point` > 0 lowers the top corners so the petal
 * ends in a pointed tip.
 */
function shell(width, top, bottom, point = 0) {
  const key = [width, top, bottom, point].join();
  if (!shellGeometries.has(key)) {
    const thetaStart = top * Math.PI;
    const thetaLength = (bottom - top) * Math.PI;
    const geometry = new THREE.SphereGeometry(1, 10, 12, -width / 2, width, thetaStart, thetaLength);
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i); // 1 at the top edge
      const phi = -width / 2 + u * width;
      const theta = thetaStart + (1 - v) * thetaLength + point * thetaLength * Math.abs(u - 0.5) ** 1.4 * 2 * v ** 3;
      pos.setXYZ(i, -Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
    }
    geometry.computeVertexNormals();
    shellGeometries.set(key, geometry);
  }
  return shellGeometries.get(key);
}

/** Ring of flat petals around (0, y, 0), each tilted up by `cup`. */
function flatRing(g, geometry, y, count, { center = 0.02, cup = 0.15, size = 1, offset = 0 } = {}) {
  const tint = DOUBLE_TINT();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + offset;
    const petal = part(geometry, tint, { s: size, p: [Math.cos(a) * center, y, Math.sin(a) * center] });
    petal.rotation.set(0, -a, cup);
    g.add(role(petal, 'head', true));
  }
}

/** Ring of cupped shells around (0, y, 0) opening outward by `flare`. */
function shellRing(g, y, count, { radius, height, width, top, bottom, point = 0, flare = 0.15, offset = 0 }) {
  const tint = DOUBLE_TINT();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + offset;
    const petal = new THREE.Mesh(shell(width, top, bottom, point), tint);
    petal.scale.set(radius, height, radius);
    petal.position.set(0, y, 0);
    // The slice faces -X; tilt its top outward (about Z), then turn it into place.
    petal.rotation.order = 'YXZ';
    petal.rotation.set(0, a, flare);
    g.add(role(petal, 'head', true));
  }
}

function buildCosmos() {
  const g = new THREE.Group();
  stem(g, 0.32);
  flatRing(g, cosmosPetal(), 0.33, 8, { center: 0.012, cup: 0.18, offset: 0.2 });
  g.add(role(part(GEO.sphereLo, mat('#ffd54f'), { s: [0.026, 0.018, 0.026], p: [0, 0.338, 0] }), 'head'));
  baseLeaves(g, 2, 0.12);
  return g;
}

function buildDaisy() {
  const g = new THREE.Group();
  stem(g, 0.3);
  flatRing(g, daisyPetal(), 0.312, 16, { center: 0.02, cup: 0.1 });
  g.add(role(part(GEO.sphere, mat('#ffc107', { roughness: 0.8 }), { s: [0.03, 0.018, 0.03], p: [0, 0.318, 0] }), 'head'));
  baseLeaves(g, 3, 0.11);
  return g;
}

function buildTulip() {
  const g = new THREE.Group();
  stem(g, 0.36, 0.02);
  // Two layers of cupped petals; the open top shows the petal edges.
  shellRing(g, 0.43, 3, { radius: 0.046, height: 0.085, width: 2.1, top: 0.02, bottom: 0.92, point: 0.4, flare: 0.12 });
  shellRing(g, 0.43, 3, { radius: 0.042, height: 0.08, width: 2.0, top: 0.0, bottom: 0.9, point: 0.4, flare: 0.05, offset: Math.PI / 3 });
  for (const sx of [-1, 1]) {
    g.add(role(part(GEO.sphereLo, LEAF(), { s: [0.035, 0.2, 0.012], p: [sx * 0.04, 0.12, 0], r: [0, 0, sx * 0.35] }), 'base'));
  }
  return g;
}

function buildSunflower() {
  const g = new THREE.Group();
  stem(g, 0.7, 0.026);
  const head = pivot([0, 0.72, 0.02], [-0.5, 0, 0]);
  const tint = DOUBLE_TINT();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const petal = part(GEO.sphereLo, tint, { s: [0.06, 0.012, 0.022], p: [Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11] });
    petal.rotation.set(0, -a, 0);
    head.add(role(petal, 'head', true));
  }
  head.add(role(part(GEO.cyl, mat('#5d3a1a', { roughness: 0.9 }), { s: [0.085, 0.03, 0.085] }), 'head'));
  g.add(head);
  for (const [y, sx] of [[0.22, 1], [0.38, -1]]) {
    g.add(role(part(GEO.sphereLo, LEAF(), { s: [0.1, 0.012, 0.05], p: [sx * 0.07, y, 0], r: [0, 0, sx * 0.4] }), 'base'));
  }
  return g;
}

function buildLavender() {
  const g = new THREE.Group();
  for (const [x, z, lean] of [[0, 0, 0], [0.035, 0.02, 0.12], [-0.03, 0.025, -0.1]]) {
    const sprig = pivot([x, 0, z], [lean, 0, -lean]);
    sprig.add(role(part(GEO.cylLo, STEM(), { s: [0.008, 0.36, 0.008], p: [0, 0.18, 0] }), 'stem'));
    // Small florets spiralling up the spike, getting smaller toward the tip.
    for (let k = 0; k < 10; k++) {
      const taper = 1 - k / 13;
      for (let j = 0; j < 3; j++) {
        const a = k * 0.9 + (j / 3) * Math.PI * 2;
        sprig.add(role(part(GEO.sphereLo, TINT(), {
          s: [0.011 * taper, 0.016 * taper, 0.011 * taper],
          p: [Math.cos(a) * 0.012 * taper, 0.27 + k * 0.016, Math.sin(a) * 0.012 * taper],
        }), 'head', true));
      }
    }
    g.add(sprig);
  }
  return g;
}

function buildDandelion() {
  const g = new THREE.Group();
  stem(g, 0.3, 0.012);
  g.add(role(part(GEO.sphereLo, mat('#6f9a3a'), { s: [0.016, 0.01, 0.016], p: [0, 0.3, 0] }), 'head'));
  // Fluffy seed head: soft core plus fine seed threads radiating out.
  g.add(role(part(new THREE.IcosahedronGeometry(1, 2), mat('#f7f7f2', { roughness: 1 }), { s: 0.05, p: [0, 0.345, 0] }), 'head', true));
  const thread = mat('#ffffff', { roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const y = 1 - (i / 25) * 1.6;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996;
    const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const seed = part(GEO.cylLo, thread, { s: [0.0013, 0.03, 0.0013], p: [dir.x * 0.062, 0.345 + dir.y * 0.062, dir.z * 0.062] });
    seed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(role(seed, 'head'));
  }
  baseLeaves(g, 4, 0.12);
  return g;
}

/** Bell-shaped cup hanging from its top (y = 0) with a flared, slightly curled rim. */
const bellGeometry = lazyGeometry(() => new THREE.LatheGeometry([
  [0, 0], [0.012, -0.003], [0.02, -0.012], [0.024, -0.026], [0.026, -0.04],
  [0.032, -0.05], [0.04, -0.055], [0.043, -0.052],
].map(([x, y]) => new THREE.Vector2(x, y)), 14));

/** Arching flower stalk: rises from y = 0.22 then curves over to one side. */
const ARCH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.22, 0),
  new THREE.Vector3(0.005, 0.3, 0),
  new THREE.Vector3(0.04, 0.355, 0),
  new THREE.Vector3(0.09, 0.36, 0),
  new THREE.Vector3(0.13, 0.32, 0),
]);
const archGeometry = lazyGeometry(() => new THREE.TubeGeometry(ARCH, 16, 0.009, 6, false));

function buildBluebell() {
  const g = new THREE.Group();
  stem(g, 0.22, 0.011);
  g.add(role(part(archGeometry(), STEM()), 'head'));
  const tint = DOUBLE_TINT();
  // Bells hang along the arch, getting smaller toward the tip.
  [[0.34, 0.88], [0.56, 0.82], [0.77, 0.74], [0.97, 0.64]].forEach(([t, size], i) => {
    const at = ARCH.getPointAt(t);
    const side = i % 2 ? 0.018 : -0.018;
    const pedicel = 0.035 * size;
    g.add(role(part(GEO.cylLo, STEM(), { s: [0.004, pedicel, 0.004], p: [at.x, at.y - pedicel / 2, at.z + side * 0.5], r: [side * 6, 0, 0] }), 'head'));
    const bell = part(bellGeometry(), tint, { s: size, p: [at.x, at.y - pedicel, at.z + side], r: [side * 5, i * 1.3, 0.12] });
    g.add(role(bell, 'head', true));
  });
  // Long strap leaves at the foot.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.3;
    g.add(role(part(GEO.sphereLo, LEAF(), {
      s: [0.15, 0.01, 0.025], p: [Math.cos(a) * 0.09, 0.035, Math.sin(a) * 0.09], r: [0, -a, 0.3],
    }), 'base'));
  }
  return g;
}

function buildRose() {
  const g = new THREE.Group();
  stem(g, 0.32, 0.018);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(role(part(GEO.coneLo, LEAF(), { s: [0.012, 0.045, 0.006], p: [Math.cos(a) * 0.02, 0.33, Math.sin(a) * 0.02], r: [Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9] }), 'head'));
  }
  // Tight bud in the middle, then two rings of cupped petals opening outward.
  g.add(role(part(GEO.sphere, TINT(), { s: [0.022, 0.032, 0.022], p: [0, 0.37, 0] }), 'head', true));
  shellRing(g, 0.365, 4, { radius: 0.032, height: 0.035, width: 2.0, top: 0.32, bottom: 0.95, point: 0.12, flare: 0.25 });
  shellRing(g, 0.36, 5, { radius: 0.046, height: 0.04, width: 1.7, top: 0.38, bottom: 0.95, point: 0.12, flare: 0.55, offset: 0.6 });
  for (const sx of [-1, 1]) {
    g.add(role(part(GEO.sphereLo, LEAF(), { s: [0.05, 0.01, 0.028], p: [sx * 0.04, 0.2, 0], r: [0, 0, sx * 0.5] }), 'base'));
  }
  return g;
}

function buildButtercup() {
  const g = new THREE.Group();
  for (const [x, z, h] of [[0, 0, 0.12], [0.05, 0.03, 0.09], [-0.04, 0.04, 0.1]]) {
    const sprig = pivot([x, 0, z]);
    sprig.add(role(part(GEO.cylLo, STEM(), { s: [0.008, h, 0.008], p: [0, h / 2, 0] }), 'stem'));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = part(GEO.sphereLo, TINT(), { s: [0.022, 0.012, 0.018], p: [Math.cos(a) * 0.018, h + 0.006, Math.sin(a) * 0.018] });
      petal.rotation.set(0, -a, -0.4);
      sprig.add(role(petal, 'head', true));
    }
    g.add(sprig);
  }
  // Clover-like leaves on the ground.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(role(part(GEO.sphereLo, LEAF(), { s: [0.03, 0.006, 0.03], p: [Math.cos(a) * 0.035, 0.02, Math.sin(a) * 0.035] }), 'base'));
  }
  return g;
}

/**
 * Flower types: stemH = default stem height (the 'stem' role spans 0..stemH),
 * height = [min, max] random stem-stretch factors, palette = blossom colours.
 */
export const FLOWER_TYPES = {
  cosmos: { name: 'Hoa cánh bướm', weight: 3, stemH: 0.32, height: [0.6, 1.8], palette: ['#ff7eb6', '#ffffff', '#b388ff', '#ffb74d', '#ff5252'], build: buildCosmos },
  daisy: { name: 'Hoa cúc', weight: 3, stemH: 0.3, height: [0.6, 1.7], palette: ['#ffffff', '#fff6d5', '#ffe0ef'], build: buildDaisy },
  tulip: { name: 'Tulip', weight: 2, stemH: 0.36, height: [0.8, 1.9], palette: ['#e53935', '#ff9800', '#ffeb3b', '#ec407a', '#ab47bc'], build: buildTulip },
  sunflower: { name: 'Hướng dương', weight: 1, stemH: 0.7, height: [0.9, 1.8], palette: ['#ffca28', '#ffb300', '#ffd54f'], build: buildSunflower },
  lavender: { name: 'Oải hương', weight: 2, stemH: 0.3, height: [0.7, 1.9], palette: ['#9575cd', '#7e57c2', '#b39ddb'], build: buildLavender },
  dandelion: { name: 'Bồ công anh', weight: 2, stemH: 0.3, height: [0.6, 1.6], palette: ['#ffffff', '#fffde7'], build: buildDandelion },
  bluebell: { name: 'Hoa chuông', weight: 2, stemH: 0.22, height: [0.8, 1.8], palette: ['#5c6bc0', '#42a5f5', '#ce93d8'], build: buildBluebell },
  rose: { name: 'Hoa hồng', weight: 1, stemH: 0.32, height: [0.8, 1.6], palette: ['#e91e63', '#f06292', '#ff8a80', '#ffffff'], build: buildRose },
  buttercup: { name: 'Mao lương', weight: 3, stemH: 0.12, height: [0.6, 1.5], palette: ['#ffeb3b', '#fff176'], build: buildButtercup },
};

/** A flower as a plain Group with its blossom coloured (for the model viewer). */
export function buildFlowerPlant(type, color = FLOWER_TYPES[type].palette[0]) {
  const g = FLOWER_TYPES[type].build();
  g.traverse((node) => {
    if (node.isMesh && node.userData.tint) {
      node.material = node.material.clone();
      node.material.color.set(color);
    }
  });
  return g;
}
