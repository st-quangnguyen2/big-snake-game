import * as THREE from 'three';
import { mat, GEO, part, pivot, buildEye, EyeRig } from './common.js';

// ------------------------------------------------------------------ skins

const PATTERNS = { bands: 0, diamonds: 1, spots: 2, tiger: 3, rainbow: 4 };

/** Snake colour schemes. `pattern` selects the body pattern drawn by the skin shader. */
export const SKINS = {
  green: { name: 'Xanh lá', base: '#3fb54a', dark: '#2a8a37', stripe: '#f6d73b', belly: '#cdeb94', pattern: 'bands' },
  ocean: { name: 'Xanh biển', base: '#2f8fe0', dark: '#1b5ea8', stripe: '#a5ecff', belly: '#d8f2ff', pattern: 'diamonds' },
  fire: { name: 'Đỏ lửa', base: '#e53935', dark: '#9e1f1b', stripe: '#ffc107', belly: '#ffe3b8', pattern: 'tiger' },
  grape: { name: 'Tím mộng mơ', base: '#8e44ad', dark: '#5b2a78', stripe: '#ffc4e1', belly: '#efdcf7', pattern: 'spots' },
  candy: { name: 'Hồng kẹo', base: '#ff7eb6', dark: '#e2559a', stripe: '#ffffff', belly: '#ffe6f2', pattern: 'bands' },
  tiger: { name: 'Cam hổ', base: '#ff9800', dark: '#3b2a1a', stripe: '#ffd180', belly: '#fff3e0', pattern: 'tiger' },
  lemon: { name: 'Vàng chanh', base: '#c6d837', dark: '#7c8a12', stripe: '#ffffff', belly: '#f9fbe7', pattern: 'spots' },
  galaxy: { name: 'Ngân hà', base: '#283593', dark: '#121858', stripe: '#ffe082', belly: '#9fa8da', pattern: 'spots' },
  rainbow: { name: 'Cầu vồng', base: '#ff5252', dark: '#ffffff', stripe: '#ffffff', belly: '#fff8e1', pattern: 'rainbow' },
};

/** Head styles: eyes and a fun accessory. */
export const HEAD_STYLES = {
  classic: { name: 'Cổ điển', emoji: '🐍' },
  cute: { name: 'Dễ thương', emoji: '🥰' },
  cool: { name: 'Ngầu', emoji: '😎' },
  king: { name: 'Nhà vua', emoji: '👑' },
  party: { name: 'Tiệc tùng', emoji: '🥳' },
  dragon: { name: 'Rồng', emoji: '🐉' },
  bow: { name: 'Nơ xinh', emoji: '🎀' },
  cat: { name: 'Mèo con', emoji: '🐱' },
};

// ------------------------------------------------------------------ head

const lazy = (factory) => {
  let value;
  return () => (value ??= factory());
};
const crownGeometry = lazy(() => new THREE.CylinderGeometry(0.2, 0.23, 0.15, 12, 1, true));
const hatRingGeometry = lazy(() => new THREE.TorusGeometry(1, 0.12, 6, 20));

function addSunglasses(skull) {
  const lens = mat('#15151a', { roughness: 0.08, metalness: 0.6 });
  const frame = mat('#222228', { roughness: 0.3 });
  for (const sx of [-1, 1]) {
    skull.add(part(GEO.sphere, lens, { s: [0.17, 0.12, 0.05], p: [sx * 0.29, 0.2, 0.43], r: [0, sx * 0.45, 0] }));
    skull.add(part(GEO.box, frame, { s: [0.03, 0.03, 0.42], p: [sx * 0.45, 0.22, 0.2], r: [0, sx * 0.25, 0] }));
  }
  skull.add(part(GEO.box, frame, { s: [0.24, 0.035, 0.035], p: [0, 0.24, 0.5] }));
}

function addCrown(skull) {
  const gold = mat('#ffc928', { roughness: 0.25, metalness: 0.8, side: THREE.DoubleSide });
  const crown = pivot([0, 0.38, -0.05], [-0.12, 0, 0.08]);
  crown.add(part(crownGeometry(), gold));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    crown.add(part(GEO.cone, gold, { s: [0.045, 0.13, 0.045], p: [Math.cos(a) * 0.21, 0.13, Math.sin(a) * 0.21] }));
    crown.add(part(GEO.sphereLo, mat(i % 2 ? '#e53935' : '#2196f3', { roughness: 0.15 }), { s: 0.03, p: [Math.cos(a + 0.6) * 0.225, 0.0, Math.sin(a + 0.6) * 0.225] }));
  }
  skull.add(crown);
}

function addPartyHat(skull) {
  const hat = pivot([0.06, 0.36, -0.04], [-0.15, 0, -0.3]);
  hat.add(part(GEO.cone, mat('#42a5f5', { roughness: 0.5 }), { s: [0.17, 0.48, 0.17], p: [0, 0.24, 0] }));
  hat.add(part(hatRingGeometry(), mat('#ffd54f'), { s: [0.13, 0.13, 0.5], p: [0, 0.12, 0], r: [Math.PI / 2, 0, 0] }));
  hat.add(part(hatRingGeometry(), mat('#ff6fae'), { s: [0.075, 0.075, 0.4], p: [0, 0.3, 0], r: [Math.PI / 2, 0, 0] }));
  hat.add(part(GEO.sphere, mat('#ffffff', { roughness: 0.9 }), { s: 0.07, p: [0, 0.5, 0] }));
  skull.add(hat);
}

function addHorns(skull, skin) {
  const horn = mat('#f5e6c8', { roughness: 0.5 });
  const spike = mat(skin.dark, { roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const base = pivot([sx * 0.2, 0.3, -0.12], [-1.0, 0, sx * -0.35]);
    base.add(part(GEO.cone, horn, { s: [0.07, 0.3, 0.07], p: [0, 0.14, 0] }));
    skull.add(base);
  }
  for (let i = 0; i < 4; i++) {
    skull.add(part(GEO.cone, spike, { s: [0.05, 0.14 - i * 0.02, 0.05], p: [0, 0.37 - i * 0.03, -0.25 - i * 0.14], r: [-0.4, 0, 0] }));
  }
}

function addBow(skull) {
  const pink = mat('#ff4f9a', { roughness: 0.45 });
  const bow = pivot([0.24, 0.33, 0.02], [0.2, 0.4, -0.35]);
  for (const sx of [-1, 1]) bow.add(part(GEO.sphere, pink, { s: [0.13, 0.09, 0.05], p: [sx * 0.11, 0, 0], r: [0, 0, sx * 0.35] }));
  bow.add(part(GEO.sphere, mat('#ff86bd', { roughness: 0.45 }), { s: 0.055 }));
  for (const [x, y] of [[-0.13, 0.02], [0.12, -0.03], [-0.08, -0.04]]) {
    bow.add(part(GEO.sphereLo, mat('#ffffff'), { s: 0.018, p: [x, y, 0.045] }));
  }
  skull.add(bow);
}

function addCatEars(skull, skin) {
  const outer = mat(skin.base, { roughness: 0.4 });
  const inner = mat('#ffb3c7', { roughness: 0.5 });
  const whisker = mat('#2b2b2b', { roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const ear = pivot([sx * 0.2, 0.3, 0.02], [-0.2, 0, sx * -0.3]);
    ear.add(part(GEO.coneLo, outer, { s: [0.12, 0.2, 0.06], p: [0, 0.1, 0] }));
    ear.add(part(GEO.coneLo, inner, { s: [0.07, 0.14, 0.03], p: [0, 0.08, 0.03] }));
    skull.add(ear);
    for (const k of [-1, 0, 1]) {
      skull.add(part(GEO.cylLo, whisker, { s: [0.006, 0.24, 0.006], p: [sx * 0.33, 0.0 + k * 0.035, 0.6], r: [0, 0, sx * (Math.PI / 2 + k * 0.15)] }));
    }
  }
}

/**
 * Snake head in the given skin and style. Faces +Z; userData holds the skull
 * (for tilting), tongue and an EyeRig.
 */
export function buildSnakeHead({ skin = SKINS.green, style = 'classic' } = {}) {
  const base = skin.pattern === 'rainbow' ? '#ff5252' : skin.base;
  const skinMat = mat(base, { roughness: 0.38 });
  const dark = mat(skin.pattern === 'rainbow' ? '#ffb300' : skin.dark, { roughness: 0.45 });
  const belly = mat(skin.belly, { roughness: 0.5 });
  const white = mat('#ffffff', { roughness: 0.15 });
  const black = mat('#111111', { roughness: 0.2 });
  const tongueMat = mat('#e0284f', { roughness: 0.4 });
  const cartoonEyes = style === 'cute' || style === 'cat';

  const g = new THREE.Group();
  const skull = new THREE.Group();
  g.add(skull);
  skull.add(part(GEO.sphere, skinMat, { s: [0.54, 0.35, 0.74], p: [0, 0, 0] }));
  skull.add(part(GEO.sphere, skinMat, { s: [0.4, 0.26, 0.44], p: [0, -0.03, 0.4] }));
  skull.add(part(GEO.sphere, belly, { s: [0.48, 0.22, 0.64], p: [0, -0.13, 0.12] }));
  skull.add(part(GEO.sphere, dark, { s: [0.13, 0.045, 0.24], p: [0, 0.325, -0.1] }));
  const eyes = [];
  for (const sx of [-1, 1]) {
    skull.add(part(GEO.sphere, dark, { s: [0.08, 0.04, 0.13], p: [sx * 0.21, 0.29, -0.26], r: [0, sx * 0.4, 0] }));
    if (!cartoonEyes) {
      // Brow ridge gives the classic head its snake look.
      skull.add(part(GEO.sphere, skinMat, { s: [0.13, 0.05, 0.15], p: [sx * 0.27, 0.27, 0.29], r: [0, 0, sx * -0.25] }));
    }
    const eye = cartoonEyes
      ? buildEye({
        p: [sx * 0.3, 0.18, 0.32], dir: [sx * 0.5, 0.25, 0.83], size: 0.165,
        sclera: white, iris: black, irisScale: 0.78, highlight: white,
      })
      : buildEye({
        p: [sx * 0.31, 0.16, 0.3], dir: [sx * Math.sin(0.6), 0, Math.cos(0.6)], size: 0.135,
        sclera: white, iris: mat(style === 'dragon' ? '#ff5722' : '#ffd84a', { roughness: 0.25 }),
        irisScale: 0.72, pupil: black, pupilScale: [0.17, 0.56], highlight: white,
      });
    skull.add(eye);
    eyes.push(eye);
    if (style === 'cat') skull.add(part(GEO.sphereLo, mat('#ff8fb1'), { s: [0.05, 0.035, 0.03], p: [sx * 0.04, 0.12, 0.8] }));
    else skull.add(part(GEO.sphereLo, black, { s: 0.022, p: [sx * 0.1, 0.1, 0.8] }));
    if (cartoonEyes) {
      skull.add(part(GEO.sphereLo, mat('#ff8fb1', { roughness: 0.8 }), { s: [0.08, 0.045, 0.03], p: [sx * 0.36, -0.02, 0.46], r: [0, sx * 0.6, 0] }));
    }
  }

  if (style === 'cool') addSunglasses(skull);
  else if (style === 'king') addCrown(skull);
  else if (style === 'party') addPartyHat(skull);
  else if (style === 'dragon') addHorns(skull, skin);
  else if (style === 'bow') addBow(skull);
  else if (style === 'cat') addCatEars(skull, skin);

  const tongue = pivot([0, -0.08, 0.74]);
  tongue.add(part(GEO.box, tongueMat, { s: [0.045, 0.018, 0.32], p: [0, 0, 0.16] }));
  for (const sx of [-1, 1]) {
    tongue.add(part(GEO.box, tongueMat, { s: [0.03, 0.016, 0.13], p: [sx * 0.035, 0, 0.36], r: [0, sx * 0.45, 0] }));
  }
  g.add(tongue);

  g.userData.skull = skull;
  g.userData.tongue = tongue;
  // Real snakes have no eyelids, so only the cartoon styles blink.
  g.userData.eyes = new EyeRig(eyes, { blink: cartoonEyes, range: 0.3, pitchRange: 0.15 });
  return g;
}

export const TONGUE_CYCLE = 1.8;

/** Flicks the forked tongue once per TONGUE_CYCLE seconds; `phase` in [0, TONGUE_CYCLE). */
export function animateTongue(headModel, phase, time) {
  const flick = phase < 0.28 ? Math.sin((phase / 0.28) * Math.PI) : 0;
  const tongue = headModel.userData.tongue;
  tongue.visible = flick > 0.02;
  tongue.scale.set(1, 1, Math.max(0.05, flick));
  tongue.rotation.x = Math.sin(time * 60) * 0.12 * flick;
}

// ------------------------------------------------------------------ body

export const RING_STEP = 0.2;
const RADIAL = 16;

/**
 * Skin drawn in the fragment shader from the distance along the body (aDist)
 * and the angle around it (aCos / aSin, interpolated without a seam). The
 * pattern (bands, diamonds, spots, tiger stripes, rainbow) and colours are
 * uniforms, so a skin can be switched without rebuilding anything.
 */
function createSkinMaterial() {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.04 });
  const uniforms = {
    uBase: { value: new THREE.Color() },
    uDark: { value: new THREE.Color() },
    uStripe: { value: new THREE.Color() },
    uBelly: { value: new THREE.Color() },
    uPattern: { value: 0 },
  };
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDist;\nattribute vec2 aRound;\nvarying float vDist;\nvarying vec2 vRound;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvRound = aRound;\nvDist = aDist;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vDist;
varying vec2 vRound;
uniform vec3 uBase, uDark, uStripe, uBelly;
uniform int uPattern;
float inBand(float x, float a, float b) {
  return smoothstep(a - 0.015, a + 0.015, x) * (1.0 - smoothstep(b - 0.015, b + 0.015, x));
}
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 hue2rgb(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float up = vRound.y;                         // 1 on the spine, -1 on the belly
  float fromTop = atan(vRound.x, vRound.y);    // angle away from the spine
  float around = atan(vRound.y, vRound.x) / 6.2831853 + 0.5;
  vec3 skin = uBase;
  if (uPattern == 0) {
    float band = fract(vDist / 1.3);
    skin = mix(skin, uDark, inBand(band, 0.05, 0.35));
    skin = mix(skin, uStripe, inBand(band, 0.11, 0.29));
    skin = mix(skin, uDark, inBand(band, 0.6, 0.85) * smoothstep(0.55, 0.8, up));
  } else if (uPattern == 1) {
    float band = fract(vDist / 1.1) - 0.5;
    float d = abs(band) * 2.2 + abs(fromTop) * 0.75;
    skin = mix(skin, uStripe, 1.0 - smoothstep(0.62, 0.68, d));
    skin = mix(skin, uDark, 1.0 - smoothstep(0.46, 0.52, d));
  } else if (uPattern == 2) {
    vec2 grid = vec2(vDist / 0.55, around * 10.0);
    vec2 cell = floor(grid);
    cell.y = mod(cell.y, 10.0);
    vec2 local = fract(grid) - 0.5;
    float present = step(0.35, hash2(cell));
    float r = 0.24 + 0.12 * hash2(cell + 7.1);
    skin = mix(skin, uStripe, (1.0 - smoothstep(r - 0.05, r, length(local))) * present);
  } else if (uPattern == 3) {
    float wobble = sin(around * 6.2831853 * 3.0 + vDist * 1.7) * 0.07;
    float stripe = fract((vDist + wobble) / 0.6);
    skin = mix(skin, uStripe, 0.35 * smoothstep(0.2, 0.9, up));
    skin = mix(skin, uDark, inBand(stripe, 0.08, 0.3) * smoothstep(-0.6, -0.2, up));
  } else {
    skin = hue2rgb(fract(vDist / 6.0)) * 0.75 + 0.2;
    skin = mix(skin, vec3(1.0), inBand(fract(vDist / 1.2), 0.0, 0.08) * 0.6);
  }
  skin = mix(skin, uBelly, smoothstep(-0.05, -0.5, up));
  diffuseColor.rgb = skin;
}`);
  };
  return material;
}

/**
 * Smooth tapered body tube rebuilt every frame from ring centres.
 * Ring k always sits at distance k * RING_STEP behind the head, so the skin
 * pattern (aDist) is static and slides with the body.
 */
export class SnakeTube {
  constructor(maxLength = 180) {
    this.maxRings = Math.ceil(maxLength / RING_STEP) + 2;
    const verts = this.maxRings * RADIAL;
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(verts * 3);
    this.normals = new Float32Array(verts * 3);
    this.cos = Float32Array.from({ length: RADIAL }, (_, j) => Math.cos((j / RADIAL) * Math.PI * 2));
    this.sin = Float32Array.from({ length: RADIAL }, (_, j) => Math.sin((j / RADIAL) * Math.PI * 2));
    const dist = new Float32Array(verts);
    const round = new Float32Array(verts * 2);
    for (let k = 0; k < this.maxRings; k++) {
      dist.fill(k * RING_STEP, k * RADIAL, (k + 1) * RADIAL);
      for (let j = 0; j < RADIAL; j++) {
        round[(k * RADIAL + j) * 2] = this.cos[j];
        round[(k * RADIAL + j) * 2 + 1] = this.sin[j];
      }
    }
    const index = new Uint32Array((this.maxRings - 1) * RADIAL * 6);
    let n = 0;
    for (let k = 0; k < this.maxRings - 1; k++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = k * RADIAL + j;
        const b = k * RADIAL + ((j + 1) % RADIAL);
        const c = a + RADIAL;
        const d = b + RADIAL;
        index[n++] = a; index[n++] = b; index[n++] = c;
        index[n++] = b; index[n++] = d; index[n++] = c;
      }
    }
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
    geometry.setAttribute('aRound', new THREE.BufferAttribute(round, 2));
    geometry.setDrawRange(0, 0);
    this.geometry = geometry;
    this.mesh = new THREE.Mesh(geometry, createSkinMaterial());
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.cx = new Float32Array(this.maxRings);
    this.cy = new Float32Array(this.maxRings);
    this.cz = new Float32Array(this.maxRings);
    this.cr = new Float32Array(this.maxRings);
    this.setSkin(SKINS.green);
  }

  setSkin(skin) {
    const u = this.mesh.material.userData.uniforms;
    u.uBase.value.set(skin.base);
    u.uDark.value.set(skin.dark);
    u.uStripe.value.set(skin.stripe);
    u.uBelly.value.set(skin.belly);
    u.uPattern.value = PATTERNS[skin.pattern] ?? 0;
  }

  /**
   * centreAt(k, out) must fill { x, z, r } for ring k (r = radius, 0 closes the tail)
   * and may set out.y to the ground height under it.
   */
  update(ringCount, centreAt) {
    const rings = Math.min(ringCount, this.maxRings);
    const { cx, cy, cz, cr, cos, sin, positions: P, normals: N } = this;
    const tmp = { x: 0, y: 0, z: 0, r: 0 };
    for (let k = 0; k < rings; k++) {
      tmp.y = 0;
      centreAt(k, tmp);
      cx[k] = tmp.x; cy[k] = tmp.y; cz[k] = tmp.z; cr[k] = tmp.r;
    }
    for (let k = 0; k < rings; k++) {
      const k0 = Math.max(0, k - 1);
      const k1 = Math.min(rings - 1, k + 1);
      let tx = cx[k1] - cx[k0];
      let tz = cz[k1] - cz[k0];
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      // side = up x tangent (tangent points toward the tail)
      const sx = tz;
      const sz = -tx;
      const r = cr[k];
      const y = cy[k] + Math.max(r * 0.92, 0.02);
      for (let j = 0; j < RADIAL; j++) {
        const i = (k * RADIAL + j) * 3;
        const nx = sx * cos[j];
        const ny = sin[j];
        const nz = sz * cos[j];
        P[i] = cx[k] + nx * r;
        P[i + 1] = y + ny * r * 0.88;
        P[i + 2] = cz[k] + nz * r;
        N[i] = nx; N[i + 1] = ny; N[i + 2] = nz;
      }
    }
    const g = this.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.position.updateRanges.length = 0;
    g.attributes.normal.updateRanges.length = 0;
    g.attributes.position.addUpdateRange(0, rings * RADIAL * 3);
    g.attributes.normal.addUpdateRange(0, rings * RADIAL * 3);
    g.setDrawRange(0, Math.max(0, rings - 1) * RADIAL * 6);
  }
}
