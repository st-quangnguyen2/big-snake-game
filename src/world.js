import * as THREE from 'three';
import {
  buildPineTree, buildRoundTree, buildRock, buildBush, buildGrassTuft,
  buildFenceSection, buildBoulder, buildStump, buildMudPuddle, buildBigTree, groundTexture, instanceGroup,
  BERRY_BUSH_LOBES, BERRY_BUSH_RADIUS, BIG_TREE_CANOPY_RADIUS, BIG_TREE_TRUNK_RADIUS,
  getLobeGeometry, getBerryClusterGeometry, lobeMaterial, berryMaterial,
} from './models/environment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FLOWER_TYPES } from './models/flowers.js';
import { THEMES, NIGHT } from './themes.js';

/** Furthest the snake's head may go from the centre on each axis. */
export const ARENA_HALF = 26;
/** Fence line; the arena floor spans ±FENCE. */
export const FENCE = 27;
/** Max number of things (snake parts, animals, fruit) that push grass and bushes aside. */
export const MAX_PUSHERS = 48;

// ------------------------------------------------------------------ terrain

/** Gentle hills: gaussian bumps that fade out before the fence. */
const HILLS = [
  { x: -14, z: 10, r: 7.5, h: 2.6 },
  { x: 13, z: 14, r: 6.5, h: 2.0 },
  { x: 16, z: -12, r: 8.5, h: 3.0 },
  { x: -13, z: -15, r: 7, h: 2.0 },
  { x: 1, z: 5, r: 5.5, h: 1.2 },
];

/** Big trees standing inside the arena; their trunks are obstacles. */
export const TREES = [
  { style: 'oak', x: -8, z: 14, rot: 0.3 },
  { style: 'blossom', x: 14, z: 2, rot: 1.7 },
  { style: 'apple', x: -20, z: -12, rot: 4.1 },
  { style: 'oak', x: 6, z: -21, rot: 2.8 },
];

/** Berry bushes the snake can push through. */
export const BUSHES = [
  { x: -10, z: -2 }, { x: 4, z: 10 }, { x: -3, z: -14 }, { x: 12, z: -16 }, { x: 20, z: 12 },
  { x: -21, z: 8 }, { x: 8, z: 22 }, { x: -13, z: 21 }, { x: 17, z: -7 }, { x: -17, z: -21 },
].map((b, i) => ({ ...b, r: BERRY_BUSH_RADIUS, rot: i * 1.3 }));

/** Solid obstacles (circle colliders) the snake must steer around. */
export const COLLIDERS = [
  ...TREES.map((t) => ({ kind: 'tree', x: t.x, z: t.z, r: BIG_TREE_TRUNK_RADIUS, rot: t.rot })),
  { kind: 'boulder', x: -6, z: 2, r: 1.15, rot: 0.4 },
  { kind: 'boulder', x: 9, z: -3, r: 1.15, rot: 2.1 },
  { kind: 'boulder', x: -19, z: -3, r: 1.15, rot: 4.0 },
  { kind: 'boulder', x: 19, z: 5, r: 1.15, rot: 1.2 },
  { kind: 'boulder', x: 4, z: 18, r: 1.15, rot: 5.3 },
  { kind: 'stump', x: 11, z: 9, r: 0.75, rot: 0.8 },
  { kind: 'stump', x: -9, z: -7, r: 0.75, rot: 2.6 },
  { kind: 'stump', x: -19, z: 19, r: 0.75, rot: 4.4 },
  { kind: 'stump', x: 20, z: -20, r: 0.75, rot: 1.9 },
  { kind: 'stump', x: -3, z: -20, r: 0.75, rot: 3.3 },
];

/** Mud puddles: slow the snake down while its head is inside. */
export const MUD = [
  { x: 6, z: -12, r: 2.6 },
  { x: -16, z: 3, r: 2.3 },
  { x: -2, z: 13, r: 2.2 },
  { x: 18, z: 18, r: 2.4 },
  { x: 21, z: -4, r: 2.0 },
];

/** Terrain height at (x, z); 0 at the fence. */
export function groundHeight(x, z) {
  let h = 0;
  for (const hill of HILLS) {
    const dx = x - hill.x;
    const dz = z - hill.z;
    h += hill.h * Math.exp(-(dx * dx + dz * dz) / (hill.r * hill.r));
  }
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const fade = Math.min(1, Math.max(0, (FENCE - 0.5 - edge) / 6.5));
  return h * fade * fade * (3 - 2 * fade);
}

/** Uphill slope along a direction (rise per unit), used to slow / speed the snake. */
export function slopeAlong(x, z, dx, dz) {
  return (groundHeight(x + dx * 0.5, z + dz * 0.5) - groundHeight(x - dx * 0.5, z - dz * 0.5));
}

export function inMud(x, z) {
  return MUD.some((m) => (x - m.x) ** 2 + (z - m.z) ** 2 < m.r * m.r * 0.8);
}

// ------------------------------------------------------------------ helpers

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function skyTexture([top, middle, bottom]) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.6, middle);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Index of the berry bush containing (x, z), or -1. */
export function inBush(x, z) {
  return BUSHES.findIndex((b) => (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r);
}

/** Blocked for decoration: obstacles, bushes and mud. */
function isFree(x, z, margin) {
  return !COLLIDERS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + margin)
    && !BUSHES.some((b) => Math.hypot(x - b.x, z - b.z) < b.r * 0.8 + margin)
    && !MUD.some((m) => Math.hypot(x - m.x, z - m.z) < m.r + margin * 0.5);
}

/**
 * Material for grass blades and flowers that bend away from "pushers" (snake
 * parts, animals, fruit) and sway in the wind. Each plant is rotated around its
 * root along an arc (the bend grows toward the tip), so blades keep their length
 * like real grass being pressed down. Every plant gets a little random
 * stiffness and direction so a parted clump splays naturally. Grass also gets
 * darker roots, lighter tips and a slight per-blade colour variation.
 * Flowers pass their root in the per-instance attribute `aRoot`.
 */
function bendMaterial(material, shared, { flower = false } = {}) {
  const bend = material.clone();
  const own = { uBendMax: { value: flower ? 0.85 : 1.35 }, uPlantHeight: { value: 0.9 } };
  bend.defines = { ...bend.defines, [flower ? 'BEND_FLOWER' : 'BEND_GRASS']: '' };
  bend.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, own);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform sampler2D uPushField;   // push vector (xz) per cell, encoded as 0..1
uniform float uFieldSize;       // world size covered by the field
uniform float uBendMax;
uniform float uPlantHeight;
varying float vBendH;
varying vec3 vTint;
#ifdef BEND_FLOWER
attribute vec3 aRoot;
#else
attribute vec4 aBlade;   // blade root x, z (clump space), blade height, random seed
#endif
float bendHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
vec3 rotateAround(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}`)
      .replace('#include <project_vertex>', `
vec4 worldPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
#ifdef BEND_FLOWER
vec3 root = (modelMatrix * vec4(aRoot, 1.0)).xyz;
float plantH = uPlantHeight;
float seed = 0.0;
#else
vec3 root = (modelMatrix * instanceMatrix * vec4(aBlade.x, 0.0, aBlade.y, 1.0)).xyz;
float plantH = length((modelMatrix * instanceMatrix * vec4(0.0, aBlade.z, 0.0, 0.0)).xyz);
float seed = aBlade.w;
#endif
vec3 rel = worldPos.xyz - root;
float hRel = clamp(rel.y / plantH, 0.0, 1.0);
// One lookup in the push field instead of looping over every pusher.
vec2 push = texture2D(uPushField, root.xz / uFieldSize + 0.5).xy * 2.0 - 1.0;
float rnd = fract(bendHash(root.xz) + seed);
float amount = min(length(push), 1.0) * (0.75 + 0.5 * rnd);
vec2 pushDir = length(push) > 0.0001 ? normalize(push) : vec2(1.0, 0.0);
float jitter = (rnd - 0.5);
pushDir = vec2(pushDir.x * cos(jitter) - pushDir.y * sin(jitter), pushDir.x * sin(jitter) + pushDir.y * cos(jitter));
float gust = sin(uTime * 1.6 + root.x * 0.3 + root.z * 0.22) * 0.7 + sin(uTime * 2.9 + root.z * 0.5 + rnd * 6.0) * 0.3;
vec2 bendVec = pushDir * amount * uBendMax + vec2(0.8, 0.45) * gust * 0.12;
float angle = length(bendVec);
if (angle > 0.0001) {
  vec2 bd = bendVec / angle;
  // axis = up x bend direction, so the plant tips over toward bendVec
  rel = rotateAround(rel, vec3(bd.y, 0.0, -bd.x), angle * (0.3 + 0.7 * hRel));
}
worldPos.xyz = root + rel;
vBendH = hRel;
vTint = mix(vec3(0.86, 0.94, 0.86), vec3(1.12, 1.1, 0.86), rnd);
vec4 mvPosition = viewMatrix * worldPos;
gl_Position = projectionMatrix * mvPosition;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBendH;\nvarying vec3 vTint;')
      .replace('#include <color_fragment>', `#include <color_fragment>
#ifdef BEND_GRASS
diffuseColor.rgb *= vTint * mix(0.5, 1.12, vBendH);
#endif`);
  };
  return bend;
}

/**
 * All berry bushes as two InstancedMeshes (leaf lobes + berries). When the snake
 * or an animal passes, the lobes spread apart and squash, then spring back.
 */
class BushField {
  constructor(root, theme) {
    const lobes = BERRY_BUSH_LOBES.length;
    const count = BUSHES.length * lobes;
    this.leaves = new THREE.InstancedMesh(getLobeGeometry(), lobeMaterial('#ffffff'), count);
    this.berries = new THREE.InstancedMesh(getBerryClusterGeometry(), berryMaterial(), count);
    for (const mesh of [this.leaves, this.berries]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      root.add(mesh);
    }
    const color = new THREE.Color();
    this.parts = [];
    BUSHES.forEach((bush, b) => {
      const ground = groundHeight(bush.x, bush.z);
      const cos = Math.cos(bush.rot);
      const sin = Math.sin(bush.rot);
      BERRY_BUSH_LOBES.forEach((lobe, l) => {
        const [px, py, pz] = lobe.p;
        this.parts.push({
          bush,
          x: bush.x + px * cos + pz * sin,
          y: ground + py,
          z: bush.z - px * sin + pz * cos,
          s: lobe.s,
          ox: 0, oy: 0, oz: 0, vx: 0, vy: 0, vz: 0, squash: 0,
          phase: b * 1.7 + l,
        });
        this.leaves.setColorAt(b * lobes + l, color.set(themeColor(theme, lobe.color)));
      });
    });
    this.leaves.instanceColor.needsUpdate = true;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.update(0, 0, [], 0);
  }

  update(dt, time, pushers, count) {
    const step = Math.min(dt, 1 / 30);
    this.parts.forEach((part, i) => {
      // Push direction: away from every nearby pusher, strongest at the bush centre.
      let tx = 0;
      let tz = 0;
      let strength = 0;
      for (let k = 0; k < count; k++) {
        const p = pushers[k];
        const reach = part.bush.r + p.r + 0.3;
        const d = Math.hypot(p.x - part.bush.x, p.z - part.bush.z);
        if (d >= reach) continue;
        const weight = 1 - d / reach;
        const ax = part.x - p.x;
        const az = part.z - p.z;
        const al = Math.hypot(ax, az) || 1;
        tx += (ax / al) * weight;
        tz += (az / al) * weight;
        strength = Math.max(strength, weight);
      }
      const tl = Math.hypot(tx, tz);
      if (tl > 1) {
        tx /= tl;
        tz /= tl;
      }
      // Damped spring toward the pushed-aside offset, so lobes jiggle back when released.
      part.vx += ((tx * 0.75 - part.ox) * 70 - part.vx * 7) * step;
      part.vy += ((-strength * 0.25 - part.oy) * 70 - part.vy * 7) * step;
      part.vz += ((tz * 0.75 - part.oz) * 70 - part.vz * 7) * step;
      part.ox += part.vx * step;
      part.oy += part.vy * step;
      part.oz += part.vz * step;
      part.squash += (strength - part.squash) * Math.min(1, step * 10);
      const breathe = 1 + Math.sin(time * 1.6 + part.phase) * 0.015;
      this._p.set(part.x + part.ox, part.y + part.oy, part.z + part.oz);
      this._s.set(part.s[0] * breathe, part.s[1] * (1 - part.squash * 0.3) * breathe, part.s[2] * breathe);
      this._q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, part.phase);
      this._m.compose(this._p, this._q, this._s);
      this.leaves.setMatrixAt(i, this._m);
      this.berries.setMatrixAt(i, this._m);
    });
    this.leaves.instanceMatrix.needsUpdate = true;
    this.berries.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ themes

const recolorCache = new Map();
const themeColor = (theme, hex) => theme.recolor[hex] ?? hex;

/** Swaps the materials of `object` (in place) through the theme's recolor table. */
function themed(object, theme) {
  if (!Object.keys(theme.recolor).length) return object;
  const swap = (material) => {
    const next = material.color && theme.recolor[`#${material.color.getHexString()}`];
    if (!next) return material;
    const key = `${material.uuid}|${next}`;
    let recolored = recolorCache.get(key);
    if (!recolored) {
      recolored = material.clone();
      recolored.color.set(next);
      recolorCache.set(key, recolored);
    }
    return recolored;
  };
  object.traverse((node) => {
    if (node.isMesh) node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
  });
  return object;
}

/** Stars, a moon and fireflies for night mode. Returns an update(time) function. */
function addNightSky(root, rand) {
  const stars = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) {
    const a = rand() * Math.PI * 2;
    const elevation = 0.15 + rand() * 1.3;
    stars.set([Math.cos(a) * Math.cos(elevation) * 260, Math.sin(elevation) * 260, Math.sin(a) * Math.cos(elevation) * 260], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  root.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, fog: false })));

  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff4d2', fog: false }));
  moon.position.set(-120, 120, -170);
  root.add(moon);

  const count = 80;
  const base = Array.from({ length: count }, () => ({
    x: (rand() * 2 - 1) * (FENCE - 1),
    z: (rand() * 2 - 1) * (FENCE - 1),
    h: 0.6 + rand() * 1.6,
    phase: rand() * 10,
  }));
  const positions = new Float32Array(count * 3);
  const fireflyGeometry = new THREE.BufferGeometry();
  fireflyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const fireflies = new THREE.Points(fireflyGeometry, new THREE.PointsMaterial({
    color: '#f4ff8a', size: 0.32, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  fireflies.frustumCulled = false;
  root.add(fireflies);
  return (time) => {
    base.forEach((f, i) => {
      positions[i * 3] = f.x + Math.sin(time * 0.5 + f.phase) * 1.2;
      positions[i * 3 + 1] = groundHeight(f.x, f.z) + f.h + Math.sin(time * 1.3 + f.phase * 2) * 0.3;
      positions[i * 3 + 2] = f.z + Math.cos(time * 0.4 + f.phase) * 1.2;
    });
    fireflyGeometry.attributes.position.needsUpdate = true;
    fireflies.material.opacity = 0.65 + Math.sin(time * 3) * 0.25;
  };
}

/** Random flower placements: patches of one kind (mostly one colour) plus scattered singles. */
function flowerPlacements(rand) {
  const types = Object.entries(FLOWER_TYPES);
  const total = types.reduce((sum, [, t]) => sum + t.weight, 0);
  const pick = () => {
    let r = rand() * total;
    for (const [id, t] of types) {
      r -= t.weight;
      if (r <= 0) return id;
    }
    return types[0][0];
  };
  const list = [];
  const add = (type, x, z, color) => {
    if (Math.max(Math.abs(x), Math.abs(z)) > FENCE - 0.8 || !isFree(x, z, 0.35)) return;
    const [min, max] = FLOWER_TYPES[type].height;
    list.push({
      type, x, z, y: groundHeight(x, z), color,
      rot: rand() * Math.PI * 2, tiltX: (rand() - 0.5) * 0.3, tiltZ: (rand() - 0.5) * 0.3,
      scale: 0.85 + rand() * 0.4, h: min + rand() * (max - min),
    });
  };
  for (let c = 0; c < 60; c++) {
    const type = pick();
    const colors = FLOWER_TYPES[type].palette.length;
    const main = Math.floor(rand() * colors);
    const cx = (rand() * 2 - 1) * (FENCE - 2);
    const cz = (rand() * 2 - 1) * (FENCE - 2);
    const count = 4 + Math.floor(rand() * 8);
    for (let k = 0; k < count; k++) {
      const a = rand() * Math.PI * 2;
      const r = rand() ** 0.7 * 1.7;
      add(type, cx + Math.cos(a) * r, cz + Math.sin(a) * r, rand() < 0.75 ? main : Math.floor(rand() * colors));
    }
  }
  for (let k = 0; k < 110; k++) {
    const type = pick();
    add(type, (rand() * 2 - 1) * (FENCE - 1), (rand() * 2 - 1) * (FENCE - 1), Math.floor(rand() * FLOWER_TYPES[type].palette.length));
  }
  return list;
}

/**
 * All flowers as a few InstancedMeshes per kind. Template parts are merged per
 * material + role; 'stem' parts stretch with each flower's height, 'head' parts
 * ride on top, and tinted parts get the flower's colour.
 */
function buildFlowerField(root, theme, shared, rand) {
  const byType = new Map();
  for (const p of flowerPlacements(rand)) {
    if (!byType.has(p.type)) byType.set(p.type, []);
    byType.get(p.type).push(p);
  }
  const placement = new THREE.Matrix4();
  const roleMatrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const materials = [];
  byType.forEach((list, type) => {
    const def = FLOWER_TYPES[type];
    const template = themed(def.build(), theme);
    template.updateMatrixWorld(true);
    const groups = new Map();
    template.traverse((node) => {
      if (!node.isMesh) return;
      const key = `${node.material.uuid}|${node.userData.role}`;
      if (!groups.has(key)) groups.set(key, { material: node.material, role: node.userData.role, tint: false, geometries: [] });
      const group = groups.get(key);
      group.tint ||= node.userData.tint;
      const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
      geometry.deleteAttribute('uv');
      group.geometries.push(geometry.applyMatrix4(node.matrixWorld));
    });
    for (const group of groups.values()) {
      const geometry = mergeGeometries(group.geometries);
      const aRoot = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      geometry.setAttribute('aRoot', aRoot);
      const material = bendMaterial(group.material, shared, { flower: true });
      materials.push(material);
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((p, i) => {
        euler.set(p.tiltX, p.rot, p.tiltZ);
        quaternion.setFromEuler(euler);
        placement.compose(position.set(p.x, p.y, p.z), quaternion, scale.setScalar(p.scale));
        if (group.role === 'stem') roleMatrix.makeScale(1, p.h, 1);
        else if (group.role === 'head') roleMatrix.makeTranslation(0, def.stemH * (p.h - 1), 0);
        else roleMatrix.identity();
        mesh.setMatrixAt(i, placement.multiply(roleMatrix));
        aRoot.setXYZ(i, p.x, p.y, p.z);
        if (group.tint) mesh.setColorAt(i, color.set(def.palette[p.color]));
      });
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
  });
  return materials;
}

/** Soft "meadow patches": 0..1 noise that makes regions of taller or shorter grass. */
function patchNoise(x, z) {
  const n = 0.5
    + 0.28 * Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.17 - 0.4)
    + 0.22 * Math.sin((x + z) * 0.11 + 2.0)
    + 0.12 * Math.cos(x * 0.47 - z * 0.39);
  return Math.min(1, Math.max(0, n));
}

const GRASS_CHUNKS = 4;
const FIELD_RES = 128;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Grid of "push" vectors over the arena, rebuilt on the CPU each frame from the
 * pushers and sampled once per vertex by the grass / flower shader.
 */
class PushField {
  constructor() {
    this.size = FENCE * 2;
    this.cell = this.size / FIELD_RES;
    this.px = new Float32Array(FIELD_RES * FIELD_RES);
    this.pz = new Float32Array(FIELD_RES * FIELD_RES);
    this.data = new Uint8Array(FIELD_RES * FIELD_RES * 4).fill(128);
    this.texture = new THREE.DataTexture(this.data, FIELD_RES, FIELD_RES, THREE.RGBAFormat);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
  }

  /** Same falloff the per-pusher loop used: full push near the centre, fading by r + 1. */
  update(pushers, count) {
    const { px, pz, data, cell } = this;
    px.fill(0);
    pz.fill(0);
    const half = FENCE;
    for (let n = 0; n < count; n++) {
      const p = pushers[n];
      const reach = p.r + 1;
      const i0 = Math.max(0, Math.floor((p.x - reach + half) / cell));
      const i1 = Math.min(FIELD_RES - 1, Math.floor((p.x + reach + half) / cell));
      const j0 = Math.max(0, Math.floor((p.z - reach + half) / cell));
      const j1 = Math.min(FIELD_RES - 1, Math.floor((p.z + reach + half) / cell));
      for (let j = j0; j <= j1; j++) {
        const cz = -half + (j + 0.5) * cell;
        for (let i = i0; i <= i1; i++) {
          const cx = -half + (i + 0.5) * cell;
          const dx = cx - p.x;
          const dz = cz - p.z;
          const dist = Math.hypot(dx, dz);
          const k = 1 - smoothstep(p.r * 0.6, reach, dist);
          if (k <= 0) continue;
          const idx = j * FIELD_RES + i;
          px[idx] += dist > 0.001 ? (dx / dist) * k : k;
          pz[idx] += dist > 0.001 ? (dz / dist) * k : 0;
        }
      }
    }
    for (let idx = 0; idx < px.length; idx++) {
      let x = px[idx];
      let z = pz[idx];
      const len = Math.hypot(x, z);
      if (len > 1) {
        x /= len;
        z /= len;
      }
      data[idx * 4] = Math.round((x * 0.5 + 0.5) * 255);
      data[idx * 4 + 1] = Math.round((z * 0.5 + 0.5) * 255);
    }
    this.texture.needsUpdate = true;
  }
}

/** Default grass look; all values are percentages (100 = normal) except blades per clump. */
export const DEFAULT_GRASS = { height: 100, density: 100, size: 100, variety: 50, blades: 28 };

function grassTransforms(options) {
  const { height, density, size, variety } = { ...DEFAULT_GRASS, ...options };
  const rand = seeded(77);
  const count = Math.round(2600 * (density / 100));
  const v = variety / 100;
  const list = [];
  for (let guard = 0; list.length < count && guard < count * 20; guard++) {
    const x = (rand() * 2 - 1) * (FENCE - 0.6);
    const z = (rand() * 2 - 1) * (FENCE - 0.6);
    if (!isFree(x, z, 0.3)) continue;
    const patch = patchNoise(x, z);
    // `variety` blends uniform tufts into a field of random sizes grouped in patches.
    const regional = THREE.MathUtils.lerp(1, 0.35 + patch * 1.4, v);
    const jitter = 1 + (rand() * 2 - 1) * 0.4 * v;
    const h = (height / 100) * regional * jitter * (0.9 + rand() * 0.3);
    const w = (size / 100) * THREE.MathUtils.lerp(1, 0.6 + patch * 0.8, v) * (0.9 + rand() * 0.4);
    list.push({ x, z, y: groundHeight(x, z), rot: rand() * Math.PI * 2, sx: w, sy: h, sz: w });
  }
  return list;
}

// ------------------------------------------------------------------ world

/**
 * Sky, lights, hilly arena with obstacles, mud, fence, trees, bushes and grass,
 * all inside one root group so the whole world can be rebuilt for another
 * theme or day/night.
 * options: { theme: key of THEMES, night: bool, grass: DEFAULT_GRASS-like }.
 */
export function buildWorld(scene, { theme: themeId = 'meadow', night = false, grass: grassOptions = DEFAULT_GRASS } = {}) {
  const theme = THEMES[themeId] ?? THEMES.meadow;
  const rand = seeded(2024);
  const root = new THREE.Group();
  scene.add(root);
  const owned = [];
  const look = night ? NIGHT : theme;
  scene.background = skyTexture(look.sky);
  owned.push(scene.background);
  scene.fog = new THREE.Fog(look.fog, night ? 40 : 55, night ? 120 : 140);

  root.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], night ? NIGHT.hemiIntensity : 0.85));
  const sun = new THREE.DirectionalLight(night ? NIGHT.sun : '#fff0d6', night ? NIGHT.sunIntensity : 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  root.add(sun, sun.target);
  const updateNight = night ? addNightSky(root, rand) : null;

  const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: theme.outer, roughness: 0.95 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  root.add(outer);
  owned.push(outer.geometry, outer.material);

  // Arena floor, displaced into hills.
  const texture = groundTexture(theme.ground);
  texture.repeat.set((FENCE * 2) / 5, (FENCE * 2) / 5);
  const floorGeometry = new THREE.PlaneGeometry(FENCE * 2, FENCE * 2, 108, 108).rotateX(-Math.PI / 2);
  const fp = floorGeometry.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setY(i, groundHeight(fp.getX(i), fp.getZ(i)));
  floorGeometry.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
  floor.receiveShadow = true;
  root.add(floor);
  owned.push(floorGeometry, floor.material, texture);

  // Fence: 2-unit sections along each side (north/south run along +X, east/west along -Z).
  const sections = [];
  for (let k = 0; k < FENCE; k++) {
    const t = -FENCE + k * 2;
    sections.push({ x: t, z: -FENCE, rot: 0 }, { x: t, z: FENCE, rot: 0 });
    sections.push({ x: -FENCE, z: t + 2, rot: Math.PI / 2 }, { x: FENCE, z: t + 2, rot: Math.PI / 2 });
  }
  root.add(instanceGroup(themed(buildFenceSection(), theme), sections));
  root.add(instanceGroup(themed(buildFenceSection(0), theme), [{ x: FENCE, z: -FENCE }]));

  // Obstacles and mud sit on the terrain.
  const onGround = (c) => ({ x: c.x, z: c.z, y: groundHeight(c.x, c.z) - 0.05, rot: c.rot });
  root.add(instanceGroup(themed(buildBoulder(), theme), COLLIDERS.filter((c) => c.kind === 'boulder').map(onGround)));
  root.add(instanceGroup(themed(buildStump(), theme), COLLIDERS.filter((c) => c.kind === 'stump').map(onGround)));
  MUD.forEach((m, i) => {
    const puddle = themed(buildMudPuddle(m.r, i + 1), theme);
    puddle.position.set(m.x, 0, m.z);
    puddle.traverse((node) => {
      if (!node.isMesh) return;
      if (node.geometry.type !== 'ShapeGeometry') {
        // Pebbles: just lift them onto the ground.
        node.position.y += groundHeight(m.x + node.position.x, m.z + node.position.z);
        return;
      }
      // Conform the flat mud blobs to the hills underneath (each puddle has its own geometry).
      const pos = node.geometry.attributes.position;
      for (let j = 0; j < pos.count; j++) pos.setY(j, pos.getY(j) + groundHeight(m.x + pos.getX(j), m.z + pos.getZ(j)));
      node.geometry.computeVertexNormals();
      owned.push(node.geometry);
    });
    root.add(puddle);
  });

  const trees = TREES.map((t) => {
    const tree = themed(buildBigTree(t.style), theme);
    tree.position.set(t.x, groundHeight(t.x, t.z) - 0.1, t.z);
    tree.rotation.y = t.rot;
    // Each tree gets its own canopy materials so it can fade on its own.
    tree.userData.canopy.forEach((mesh) => {
      mesh.material = mesh.material.clone();
      mesh.material.transparent = true;
      owned.push(mesh.material);
    });
    tree.userData.opacity = 1;
    root.add(tree);
    return tree;
  });
  const bushes = new BushField(root, theme);

  // Scenery outside the fence, between FENCE + min and FENCE + max.
  const outside = (count, min, max) => Array.from({ length: count }, () => {
    let x;
    let z;
    do {
      x = (rand() * 2 - 1) * (FENCE + max);
      z = (rand() * 2 - 1) * (FENCE + max);
    } while (Math.max(Math.abs(x), Math.abs(z)) < FENCE + min);
    return { x, z, rot: rand() * Math.PI * 2, scale: 0.8 + rand() * 0.7 };
  });
  root.add(instanceGroup(themed(buildPineTree(), theme), outside(110, 3, 45)));
  root.add(instanceGroup(themed(buildRoundTree(), theme), outside(70, 3, 45)));
  root.add(instanceGroup(themed(buildRock(), theme), outside(45, 1.5, 30)));
  root.add(instanceGroup(themed(buildBush(), theme), outside(40, 1.2, 3)));

  // Grass and flowers share the wind clock and the list of things pushing them aside.
  let pushersRef = [];
  let pusherCount = 0;
  const pushField = new PushField();
  owned.push(pushField.texture);
  const grassUniforms = {
    uTime: { value: 0 },
    uPushField: { value: pushField.texture },
    uFieldSize: { value: pushField.size },
  };
  owned.push(...buildFlowerField(root, theme, grassUniforms, rand));

  // Interactive grass (rebuilt on its own when the grass settings change).
  const grassMaterials = new Map();
  let grass = null;
  const setGrass = (options) => {
    if (grass) {
      root.remove(grass);
      grass.traverse((node) => node.isInstancedMesh && node.dispose());
    }
    const template = themed(buildGrassTuft(options.blades ?? DEFAULT_GRASS.blades), theme);
    // 4×4 chunks so the camera only draws the grass it can actually see.
    const chunks = new Map();
    const chunkSize = (FENCE * 2) / GRASS_CHUNKS;
    for (const t of grassTransforms(options)) {
      const key = Math.min(GRASS_CHUNKS - 1, Math.floor((t.x + FENCE) / chunkSize)) * GRASS_CHUNKS
        + Math.min(GRASS_CHUNKS - 1, Math.floor((t.z + FENCE) / chunkSize));
      if (!chunks.has(key)) chunks.set(key, []);
      chunks.get(key).push(t);
    }
    grass = new THREE.Group();
    for (const list of chunks.values()) grass.add(instanceGroup(template, list, { castShadow: false }));
    grass.traverse((node) => {
      if (!node.isMesh) return;
      if (!grassMaterials.has(node.material)) grassMaterials.set(node.material, bendMaterial(node.material, grassUniforms));
      node.material = grassMaterials.get(node.material);
    });
    root.add(grass);
  };
  setGrass(grassOptions);

  return {
    /** Suggested scene.environmentIntensity (reflections are dimmer at night). */
    environmentIntensity: night ? 0.1 : 0.3,
    /**
     * Keeps the shadow-casting sun centred on the action, animates the wind,
     * bushes and fireflies, and fades tree canopies that would hide the snake.
     */
    update(x, z, time, dt, camera) {
      sun.position.set(x + 14, 32, z + 10);
      sun.target.position.set(x, 0, z);
      grassUniforms.uTime.value = time;
      bushes.update(dt, time, pushersRef, pusherCount);
      updateNight?.(time);
      for (const tree of trees) {
        const t = tree.position;
        const under = Math.hypot(x - t.x, z - t.z) < BIG_TREE_CANOPY_RADIUS + 1;
        const camInCanopy = Math.hypot(camera.position.x - t.x, camera.position.z - t.z) < BIG_TREE_CANOPY_RADIUS + 1
          && camera.position.y > t.y + 3 && camera.position.y < t.y + 8.5;
        const target = under || camInCanopy ? 0.25 : 1;
        tree.userData.opacity += (target - tree.userData.opacity) * Math.min(1, dt * 6);
        const opacity = tree.userData.opacity;
        for (const mesh of tree.userData.canopy) {
          mesh.material.opacity = opacity;
          mesh.material.depthWrite = opacity > 0.98;
        }
      }
    },
    /** pushers: [{ x, z, r }] — the first `count` (≤ MAX_PUSHERS) part the grass and bushes. */
    setPushers(pushers, count = pushers.length) {
      count = Math.min(MAX_PUSHERS, count);
      pushField.update(pushers, count);
      pushersRef = pushers;
      pusherCount = count;
    },
    setGrass,
    dispose() {
      scene.remove(root);
      root.traverse((node) => node.isInstancedMesh && node.dispose());
      grassMaterials.forEach((m) => m.dispose());
      owned.forEach((o) => o.dispose());
    },
  };
}
