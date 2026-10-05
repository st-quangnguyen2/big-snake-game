import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, GEO, part } from './common.js';

// Scenery models. All stand on y = 0. In the game they are instanced via
// `instanceGroup`, which turns every mesh of a template into an InstancedMesh.

const flat = (color, extra = {}) => mat(color, { flatShading: true, roughness: 0.8, ...extra });

export function buildPineTree() {
  const g = new THREE.Group();
  g.add(part(GEO.cylLo, flat('#7a5236'), { s: [0.18, 1.2, 0.18], p: [0, 0.6, 0] }));
  g.add(part(GEO.coneLo, flat('#2f8f4e'), { s: [1.1, 1.4, 1.1], p: [0, 1.6, 0] }));
  g.add(part(GEO.coneLo, flat('#37a058'), { s: [0.85, 1.2, 0.85], p: [0, 2.3, 0], r: [0, 0.4, 0] }));
  g.add(part(GEO.coneLo, flat('#41b062'), { s: [0.55, 1.0, 0.55], p: [0, 2.9, 0], r: [0, 0.9, 0] }));
  return g;
}

export function buildRoundTree() {
  const g = new THREE.Group();
  g.add(part(GEO.cylLo, flat('#86593a'), { s: [0.2, 1.4, 0.2], p: [0, 0.7, 0] }));
  g.add(part(GEO.icosa, flat('#5cb848'), { s: 1.05, p: [0, 2.0, 0] }));
  g.add(part(GEO.icosa, flat('#4fa83f'), { s: 0.72, p: [0.62, 1.7, 0.15], r: [0.5, 0.3, 0] }));
  g.add(part(GEO.icosa, flat('#67c454'), { s: 0.66, p: [-0.5, 1.82, -0.3], r: [0.2, 0.8, 0.4] }));
  return g;
}

const rockGeometry = (() => {
  let geometry;
  return () => {
    if (geometry) return geometry;
    geometry = new THREE.DodecahedronGeometry(1, 0);
    const pos = geometry.attributes.position;
    const v = new THREE.Vector3();
    // Deterministic jitter so all rocks share one lumpy shape.
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = Math.sin(v.x * 12.9 + v.y * 78.2 + v.z * 37.7) * 43758.5;
      v.multiplyScalar(0.82 + (n - Math.floor(n)) * 0.3);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
    return geometry;
  };
})();

export function buildRock() {
  const g = new THREE.Group();
  g.add(part(rockGeometry(), flat('#9aa0a6'), { s: [0.75, 0.5, 0.6], p: [0, 0.28, 0] }));
  g.add(part(rockGeometry(), flat('#868c93'), { s: [0.38, 0.3, 0.36], p: [0.6, 0.16, 0.2], r: [0.4, 1, 0] }));
  return g;
}

/** Big boulder used as an obstacle inside the arena (collision radius ≈ 1.15). */
export function buildBoulder() {
  const g = new THREE.Group();
  g.add(part(rockGeometry(), flat('#9aa0a6'), { s: [1.05, 0.8, 0.95], p: [0, 0.5, 0] }));
  g.add(part(rockGeometry(), flat('#878d94'), { s: [0.45, 0.35, 0.42], p: [0.75, 0.2, 0.45], r: [0.4, 1, 0] }));
  g.add(part(rockGeometry(), flat('#a9afb5'), { s: [0.3, 0.22, 0.28], p: [-0.7, 0.12, -0.5], r: [1, 0.3, 0] }));
  g.add(part(GEO.icosa, flat('#6fae4a'), { s: [0.5, 0.14, 0.42], p: [-0.12, 1.18, 0.05], r: [0.1, 0.5, 0] }));
  return g;
}

let stumpRingGeometry;
/** Tree stump obstacle with growth rings, roots and a little mushroom (collision radius ≈ 0.75). */
export function buildStump() {
  stumpRingGeometry ??= new THREE.TorusGeometry(1, 0.05, 4, 24);
  const bark = flat('#7a5236');
  const wood = mat('#e2c08d', { roughness: 0.8 });
  const ring = mat('#b88a55', { roughness: 0.8 });
  const g = new THREE.Group();
  g.add(part(GEO.cyl, bark, { s: [0.62, 0.7, 0.62], p: [0, 0.35, 0] }));
  g.add(part(GEO.cyl, wood, { s: [0.56, 0.02, 0.56], p: [0, 0.705, 0] }));
  for (const r of [0.4, 0.22]) g.add(part(stumpRingGeometry, ring, { s: [r, r, 0.4], p: [0, 0.715, 0], r: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    g.add(part(GEO.sphereLo, bark, { s: [0.34, 0.14, 0.17], p: [Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6], r: [0, -a, 0] }));
  }
  g.add(part(GEO.cylLo, mat('#f6efe2'), { s: [0.05, 0.16, 0.05], p: [0.78, 0.08, 0.32] }));
  g.add(part(GEO.sphere, mat('#e53935', { roughness: 0.5 }), { s: [0.13, 0.08, 0.13], p: [0.78, 0.17, 0.32] }));
  for (const [x, z] of [[0.74, 0.28], [0.83, 0.35], [0.76, 0.4]]) {
    g.add(part(GEO.sphereLo, mat('#ffffff'), { s: 0.022, p: [x, 0.23, z] }));
  }
  return g;
}

/** Wobbly mud puddle lying flat on y = 0 (slows the snake down). */
export function buildMudPuddle(radius = 2.4, seed = 1) {
  const blob = (r, wobble, phase) => {
    const shape = new THREE.Shape();
    const n = 32;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + wobble * (Math.sin(a * 3 + phase) * 0.6 + Math.sin(a * 5 + phase * 2.3) * 0.4);
      if (i === 0) shape.moveTo(Math.cos(a) * r * k, Math.sin(a) * r * k);
      else shape.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k);
    }
    return new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2);
  };
  const g = new THREE.Group();
  const outer = new THREE.Mesh(blob(radius, 0.12, seed), mat('#7a5634', { roughness: 0.6 }));
  outer.position.y = 0.02;
  const inner = new THREE.Mesh(blob(radius * 0.72, 0.16, seed + 1.7), mat('#5c3d22', { roughness: 0.12, metalness: 0.05 }));
  inner.position.y = 0.035;
  outer.receiveShadow = true;
  inner.receiveShadow = true;
  g.add(outer, inner);
  for (let i = 0; i < 4; i++) {
    const a = seed * 2.1 + i * 1.7;
    const d = radius * (0.2 + 0.12 * i);
    g.add(part(GEO.sphereLo, mat('#4a2f1a', { roughness: 0.2 }), { s: [0.09, 0.03, 0.09], p: [Math.cos(a) * d, 0.04, Math.sin(a) * d] }));
  }
  return g;
}

// ------------------------------------------------------------------ berry bush

/** Leafy lobes of a berry bush (positions relative to the bush centre on the ground). */
export const BERRY_BUSH_LOBES = [
  { p: [0, 0.62, 0], s: [0.75, 0.62, 0.75], color: '#4caf50' },
  { p: [0.55, 0.45, 0.2], s: [0.5, 0.45, 0.5], color: '#43a047' },
  { p: [-0.5, 0.42, 0.25], s: [0.5, 0.42, 0.48], color: '#5cb85c' },
  { p: [0.05, 0.4, -0.55], s: [0.52, 0.42, 0.5], color: '#4caf50' },
  { p: [0.1, 0.38, 0.6], s: [0.45, 0.38, 0.45], color: '#56b84a' },
];
export const BERRY_BUSH_RADIUS = 1.1;

let lobeGeometry;
export function getLobeGeometry() {
  return (lobeGeometry ??= new THREE.IcosahedronGeometry(1, 1));
}

let berryGeometry;
/** Berries scattered over a unit lobe; scaled with the lobe so they sit on its surface. */
export function getBerryClusterGeometry() {
  if (berryGeometry) return berryGeometry;
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39996;
    const y = 0.75 - (i / 9) * 1.0;
    const r = Math.sqrt(1 - y * y);
    const berry = new THREE.SphereGeometry(0.085, 8, 6);
    berry.translate(Math.cos(a) * r * 1.02, y * 1.02, Math.sin(a) * r * 1.02);
    parts.push(berry);
  }
  berryGeometry = mergeGeometries(parts);
  return berryGeometry;
}

export const berryMaterial = () => mat('#e53935', { roughness: 0.3 });
export const lobeMaterial = (color) => flat(color);

/** Single berry bush (used by the model viewer; the game instances the same parts). */
export function buildBerryBush() {
  const g = new THREE.Group();
  for (const lobe of BERRY_BUSH_LOBES) {
    const leaves = part(getLobeGeometry(), flat(lobe.color), { s: lobe.s, p: lobe.p });
    const berries = part(getBerryClusterGeometry(), berryMaterial(), { s: lobe.s, p: lobe.p });
    g.add(leaves, berries);
  }
  return g;
}

// ------------------------------------------------------------------ big trees

const BIG_TREE_CANOPY = [
  { p: [0, 5.7, 0], s: 2.6 },
  { p: [1.8, 5.0, 0.6], s: 1.8 },
  { p: [-1.7, 5.1, -0.4], s: 1.9 },
  { p: [0.3, 5.2, -1.8], s: 1.7 },
  { p: [-0.4, 6.8, 0.5], s: 1.7 },
  { p: [0.5, 4.9, 1.7], s: 1.6 },
];
export const BIG_TREE_CANOPY_RADIUS = 3.8;
export const BIG_TREE_TRUNK_RADIUS = 1.0;

const BIG_TREE_STYLES = {
  oak: { leaves: ['#3f9c3a', '#4caf50', '#57b84c'] },
  blossom: { leaves: ['#f8a5c2', '#f78fb3', '#fbb9d0'], dots: '#ffffff' },
  apple: { leaves: ['#46a43e', '#53b148', '#3d9536'], fruit: '#e53935' },
};

/** Scatter of small spheres over the lower half of a canopy lobe (flowers or apples). */
function lobeDots(radius, count, size, seed) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996 + seed;
    const y = 0.35 - (i / count) * 1.1;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const dot = new THREE.SphereGeometry(size, 8, 6);
    dot.translate(Math.cos(a) * r * radius * 1.01, y * radius * 1.01, Math.sin(a) * r * radius * 1.01);
    parts.push(dot);
  }
  return mergeGeometries(parts);
}

/** Merges meshes that share a material into one mesh each (fewer draw calls). */
function mergeByMaterial(meshes) {
  const groups = new Map();
  for (const mesh of meshes) {
    mesh.updateMatrix();
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.deleteAttribute('uv');
    geometry.applyMatrix4(mesh.matrix);
    if (!groups.has(mesh.material)) groups.set(mesh.material, []);
    groups.get(mesh.material).push(geometry);
  }
  return [...groups].map(([material, geometries]) => {
    const merged = new THREE.Mesh(mergeGeometries(geometries), material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    return merged;
  });
}

/**
 * Large tree that stands inside the arena. Its trunk is an obstacle; the canopy
 * meshes are listed in userData.canopy so the game can fade them out when the
 * snake (or the camera) is underneath.
 */
export function buildBigTree(style = 'oak') {
  const look = BIG_TREE_STYLES[style];
  const bark = flat('#7a5236');
  const wood = [part(new THREE.CylinderGeometry(0.55, 0.85, 4.4, 9), bark, { p: [0, 2.2, 0] })];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    wood.push(part(GEO.sphereLo, bark, { s: [0.55, 0.22, 0.25], p: [Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85], r: [0, -a, 0] }));
  }
  for (const [a, tilt, len] of [[0.4, 0.9, 2.0], [2.6, 0.8, 1.8], [4.5, 0.95, 1.9]]) {
    const branch = part(GEO.cylLo, bark, { s: [0.2, len, 0.2] });
    branch.position.set(Math.cos(a) * len * 0.35, 3.6 + len * 0.3, Math.sin(a) * len * 0.35);
    branch.rotation.set(0, -a, 0);
    branch.rotateZ(-tilt);
    wood.push(branch);
  }
  const leaves = [];
  BIG_TREE_CANOPY.forEach((lobe, i) => {
    leaves.push(part(getLobeGeometry(), flat(look.leaves[i % look.leaves.length]), { s: lobe.s, p: lobe.p, r: [i, i * 2, 0] }));
    const extra = look.fruit ?? look.dots;
    if (extra && i > 0) {
      leaves.push(part(lobeDots(lobe.s, look.fruit ? 5 : 14, look.fruit ? 0.2 : 0.09, i), mat(extra, { roughness: 0.35 }), { p: lobe.p }));
    }
  });
  const g = new THREE.Group();
  mergeByMaterial(wood).forEach((mesh) => g.add(mesh));
  const canopy = mergeByMaterial(leaves);
  canopy.forEach((mesh) => g.add(mesh));
  g.userData.canopy = canopy;
  return g;
}

export function buildBush() {
  const g = new THREE.Group();
  g.add(part(GEO.icosa, flat('#4ea83d'), { s: [0.6, 0.48, 0.6], p: [0, 0.38, 0] }));
  g.add(part(GEO.icosa, flat('#5ebd4b'), { s: [0.42, 0.36, 0.42], p: [0.45, 0.28, 0.1], r: [0.3, 0.5, 0] }));
  g.add(part(GEO.icosa, flat('#46993a'), { s: [0.4, 0.34, 0.4], p: [-0.4, 0.26, -0.12], r: [0.6, 0.2, 0] }));
  return g;
}

let bladeGeometry;
/** Flat tapered grass blade, 1 unit tall, curving forward (+Z) toward the tip. */
function getBladeGeometry() {
  if (!bladeGeometry) {
    bladeGeometry = new THREE.PlaneGeometry(0.07, 1, 1, 4);
    bladeGeometry.translate(0, 0.5, 0);
    const pos = bladeGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setX(i, pos.getX(i) * Math.pow(1 - y, 0.8));
      pos.setZ(i, 0.22 * y * y);
    }
    bladeGeometry.computeVertexNormals();
  }
  return bladeGeometry;
}

/** Blades per grass clump: allowed range and default. */
export const GRASS_BLADES = { min: 16, max: 32, default: 28 };

const tuftGeometries = new Map();
/**
 * One clump of `count` blades merged into three geometries (one per shade).
 * The layout comes from a fixed seed, so adding blades keeps the existing ones. Tall blades in the middle, shorter ones around the edge, all
 * curving outward. Each vertex carries aBlade = (root x, root z, blade height,
 * random seed) so the grass shader can bend every blade around its own root.
 */
function getTuftGeometries(count) {
  if (tuftGeometries.has(count)) return tuftGeometries.get(count);
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const perShade = [[], [], []];
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(rand()) * 0.09;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = (0.35 + 0.5 * (1 - r / 0.09) ** 0.7) * (0.75 + 0.25 * rand());
    // The blade curves toward its local +Z; point that outward from the clump centre.
    const yaw = Math.atan2(x, z) + (rand() - 0.5) * 0.8;
    const blade = getBladeGeometry().clone();
    blade.scale(0.8 + rand() * 0.4, h, h);
    blade.rotateY(yaw);
    blade.translate(x, 0, z);
    const data = new Float32Array(blade.attributes.position.count * 4);
    const bladeSeed = rand();
    for (let v = 0; v < blade.attributes.position.count; v++) data.set([x, z, h, bladeSeed], v * 4);
    blade.setAttribute('aBlade', new THREE.BufferAttribute(data, 4));
    blade.deleteAttribute('uv');
    perShade[i % 3].push(blade);
  }
  const geometries = perShade.map((list) => mergeGeometries(list));
  tuftGeometries.set(count, geometries);
  return geometries;
}

export function buildGrassTuft(count = GRASS_BLADES.default) {
  const g = new THREE.Group();
  const shades = ['#6cc04a', '#5aae3c', '#7fd056'].map((c) => mat(c, { side: THREE.DoubleSide, roughness: 0.85 }));
  getTuftGeometries(count).forEach((geometry, i) => {
    const mesh = new THREE.Mesh(geometry, shades[i]);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    g.add(mesh);
  });
  return g;
}

/** One 2-unit fence section along +X: post at x=0 plus two rails. */
export function buildFenceSection(length = 2) {
  const g = new THREE.Group();
  const wood = flat('#a8744a');
  const woodDark = flat('#8d5f3a');
  g.add(part(GEO.cylLo, woodDark, { s: [0.13, 1.05, 0.13], p: [0, 0.52, 0] }));
  g.add(part(GEO.coneLo, woodDark, { s: [0.14, 0.16, 0.14], p: [0, 1.12, 0] }));
  g.add(part(GEO.box, wood, { s: [length, 0.12, 0.07], p: [length / 2, 0.42, 0] }));
  g.add(part(GEO.box, wood, { s: [length, 0.12, 0.07], p: [length / 2, 0.82, 0] }));
  return g;
}

const groundTextures = new Map();
/** Two-tone checkered ground with a little speckle; `colors` = [light, dark] squares. */
export function groundTexture(colors = ['#86cf5f', '#79c453']) {
  const key = colors.join();
  let texture = groundTextures.get(key);
  if (!texture) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        ctx.fillStyle = colors[(x + y) % 2];
        ctx.fillRect(x * half, y * half, half, half);
      }
    }
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(30,60,20,0.07)';
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 3);
    }
    // Short painted grass strokes so the ground between tufts never looks bare.
    ctx.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const len = 3 + Math.random() * 5;
      ctx.strokeStyle = Math.random() < 0.55 ? 'rgba(20,50,10,0.16)' : 'rgba(255,255,220,0.13)';
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    groundTextures.set(key, texture);
  }
  return texture.clone();
}

/**
 * Converts a template group into InstancedMeshes placed at `transforms`
 * ([{ x, z, y?, rot, scale?, sx?, sy?, sz? }]; sx/sy/sz override the uniform scale).
 * Returns a Group holding one InstancedMesh per part.
 */
export function instanceGroup(template, transforms, { castShadow = true, receiveShadow = true } = {}) {
  const out = new THREE.Group();
  template.updateMatrixWorld(true);
  const placement = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const final = new THREE.Matrix4();
  template.traverse((node) => {
    if (!node.isMesh) return;
    const mesh = new THREE.InstancedMesh(node.geometry, node.material, transforms.length);
    transforms.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot ?? 0);
      pos.set(t.x, t.y ?? 0, t.z);
      const uniform = t.scale ?? 1;
      scl.set(t.sx ?? uniform, t.sy ?? uniform, t.sz ?? uniform);
      placement.compose(pos, q, scl);
      final.multiplyMatrices(placement, node.matrixWorld);
      mesh.setMatrixAt(i, final);
    });
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.computeBoundingSphere();
    out.add(mesh);
  });
  return out;
}
