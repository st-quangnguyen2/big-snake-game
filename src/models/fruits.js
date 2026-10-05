import * as THREE from 'three';
import { mat, GEO, part, pivot, leaf, lathe } from './common.js';

// Procedural low-poly fruits. Every model is centred on the origin and fits
// roughly inside a sphere of its `radius` (used for collisions in the game).

const lazy = (factory) => {
  let value;
  return () => (value ??= factory());
};

const appleGeometry = lazy(() => lathe([
  [0, -0.33], [0.1, -0.355], [0.24, -0.31], [0.36, -0.17], [0.41, 0.0],
  [0.39, 0.17], [0.31, 0.3], [0.18, 0.355], [0.07, 0.32], [0, 0.28],
], 28));

const strawberryProfile = [
  [0, -0.36], [0.07, -0.34], [0.17, -0.24], [0.26, -0.07], [0.3, 0.08],
  [0.27, 0.2], [0.16, 0.27], [0, 0.285],
];
const strawberryGeometry = lazy(() => lathe(strawberryProfile, 22));

const bumpTexture = lazy(() => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const v = 90 + Math.floor(Math.random() * 90);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
});

const orangeMaterial = lazy(() => new THREE.MeshStandardMaterial({
  color: '#fb8a1e', roughness: 0.68, bumpMap: bumpTexture(), bumpScale: 4,
}));

const goldMaterial = lazy(() => new THREE.MeshStandardMaterial({
  color: '#ffc928', metalness: 0.85, roughness: 0.22, emissive: '#7a5400', emissiveIntensity: 0.6,
}));

const bananaGeometry = lazy(() => {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.42, 0.2, 0),
    new THREE.Vector3(-0.22, -0.06, 0),
    new THREE.Vector3(0.05, -0.15, 0),
    new THREE.Vector3(0.28, -0.07, 0),
    new THREE.Vector3(0.42, 0.15, 0),
  ]);
  const tubular = 36;
  const radial = 6;
  const geometry = new THREE.TubeGeometry(curve, tubular, 0.105, radial, false);
  // Taper the tube toward both tips so it reads as a banana, not a sausage.
  const pos = geometry.attributes.position;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, center);
    const k = 0.22 + 0.78 * Math.pow(Math.sin(Math.PI * t), 0.55);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(k).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geometry.computeVertexNormals();
  geometry.userData.start = curve.getPointAt(0);
  geometry.userData.end = curve.getPointAt(1);
  return geometry;
});

const melonGeometries = lazy(() => {
  const sector = (r, a0, a1) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.absarc(0, 0, r, a0, a1, false);
    shape.lineTo(0, 0);
    return shape;
  };
  const slab = (shape, depth) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 28 });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  const span = 1.25;
  const c = -Math.PI / 2;
  return {
    rind: slab(sector(0.64, c - span / 2, c + span / 2), 0.2),
    pith: slab(sector(0.575, c - span / 2 - 0.006, c + span / 2 + 0.006), 0.212),
    flesh: slab(sector(0.535, c - span / 2 - 0.012, c + span / 2 + 0.012), 0.224),
    span,
  };
});

export function buildApple() {
  const g = new THREE.Group();
  g.add(part(appleGeometry(), mat('#e8322f', { roughness: 0.32 })));
  g.add(part(GEO.cyl, mat('#6d4c41', { roughness: 0.8 }), { s: [0.024, 0.17, 0.024], p: [0.01, 0.37, 0], r: [0, 0, -0.18] }));
  g.add(leaf({ p: [0.03, 0.42, 0], yaw: 0.6, droop: -0.6, size: 1, bend: 2 }));
  return g;
}

export function buildGoldenApple() {
  const g = new THREE.Group();
  g.add(part(appleGeometry(), goldMaterial(), { s: 1.08 }));
  g.add(part(GEO.cyl, goldMaterial(), { s: [0.026, 0.18, 0.026], p: [0.01, 0.4, 0], r: [0, 0, -0.18] }));
  g.add(leaf({ p: [0.03, 0.45, 0], yaw: 0.6, droop: -0.6, size: 1, color: '#7cd85a' }));

  const halo = part(
    new THREE.TorusGeometry(0.62, 0.022, 8, 48),
    new THREE.MeshBasicMaterial({ color: '#fff1a6', transparent: true, opacity: 0.75 }),
    { r: [Math.PI / 2, 0, 0] },
  );
  halo.castShadow = false;
  g.add(halo);

  const sparkles = new THREE.Group();
  const sparkleMat = new THREE.MeshBasicMaterial({ color: '#fffbe0' });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const s = part(GEO.octa, sparkleMat, { s: [0.05, 0.09, 0.05], p: [Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62] });
    s.castShadow = false;
    sparkles.add(s);
  }
  g.add(sparkles);

  g.userData.animate = (t) => {
    sparkles.rotation.y = t * 1.6;
    halo.rotation.z = t * 0.8;
    const pulse = 1 + Math.sin(t * 6) * 0.06;
    halo.scale.set(pulse, pulse, pulse);
  };
  return g;
}

export function buildOrange() {
  const g = new THREE.Group();
  g.add(part(GEO.sphere, orangeMaterial(), { s: [0.4, 0.385, 0.4] }));
  for (let i = 0; i < 5; i++) {
    g.add(leaf({ p: [0, 0.383, 0], yaw: (i / 5) * Math.PI * 2, droop: 0.12, size: 0.3, color: '#5a7f2a' }));
  }
  g.add(part(GEO.cyl, mat('#6b5a2e', { roughness: 0.85 }), { s: [0.02, 0.09, 0.02], p: [0.006, 0.425, 0], r: [0, 0, -0.15] }));
  g.add(leaf({ p: [0.012, 0.462, 0], yaw: -0.4, droop: -0.1, size: 0.9, bend: 3.5, color: '#3f9d3a' }));
  g.add(leaf({ p: [0.012, 0.46, 0], yaw: 2.3, droop: -0.05, size: 0.75, bend: 3.5, color: '#4caf50' }));
  return g;
}

export function buildBanana() {
  const g = new THREE.Group();
  const geometry = bananaGeometry();
  const peel = mat('#ffd43b', { roughness: 0.5 });
  const tipMat = mat('#5d4a2a', { roughness: 0.8 });
  const { start, end } = geometry.userData;

  // Three bananas fanned out around a shared stem.
  for (const [angle, z] of [[-0.38, -0.1], [0, 0], [0.38, 0.1]]) {
    const joint = pivot([start.x, start.y, start.z + z * 0.3], [angle, 0, 0]);
    const banana = new THREE.Group();
    banana.position.set(-start.x, -start.y, -start.z);
    banana.add(part(geometry, peel));
    banana.add(part(GEO.sphereLo, tipMat, { s: 0.03, p: [end.x, end.y, end.z] }));
    joint.add(banana);
    g.add(joint);
  }
  g.add(part(GEO.cyl, mat('#7a8b3a', { roughness: 0.7 }), {
    s: [0.04, 0.14, 0.04], p: [start.x - 0.04, start.y + 0.06, start.z], r: [0, 0, 0.6],
  }));
  g.position.y = 0.02;
  return g;
}

export function buildStrawberry() {
  const g = new THREE.Group();
  g.add(part(strawberryGeometry(), mat('#e8283c', { roughness: 0.42 })));

  // Seeds follow the lathe profile so they sit on the surface.
  const seedMat = mat('#ffe27a', { roughness: 0.4 });
  const radiusAt = (y) => {
    for (let i = 0; i < strawberryProfile.length - 1; i++) {
      const [r0, y0] = strawberryProfile[i];
      const [r1, y1] = strawberryProfile[i + 1];
      if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
    }
    return 0;
  };
  for (let i = 0; i < 34; i++) {
    const y = -0.27 + (i / 34) * 0.46;
    const a = i * 2.39996; // golden angle spiral
    const r = radiusAt(y) * 0.985;
    g.add(part(GEO.sphereLo, seedMat, { s: [0.016, 0.024, 0.016], p: [Math.cos(a) * r, y, Math.sin(a) * r] }));
  }
  for (let i = 0; i < 7; i++) {
    g.add(leaf({ p: [0, 0.29, 0], yaw: (i / 7) * Math.PI * 2 + 0.2, droop: -0.5 - (i % 2) * 0.15, size: 0.85 + (i % 2) * 0.12, bend: -1.2, color: '#3f9d3a' }));
  }
  g.add(part(GEO.cyl, mat('#4f8f32', { roughness: 0.7 }), { s: [0.018, 0.1, 0.018], p: [0.005, 0.35, 0], r: [0, 0, -0.15] }));
  return g;
}

export function buildGrape() {
  const g = new THREE.Group();
  const shades = [mat('#7d3c98', { roughness: 0.22 }), mat('#8e44ad', { roughness: 0.22 }), mat('#6c2f86', { roughness: 0.22 })];
  const rows = [[0.2, 5, 0.17], [0.04, 4, 0.14], [-0.11, 3, 0.1], [-0.25, 1, 0]];
  let n = 0;
  rows.forEach(([y, count, ring], row) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + row * 0.6;
      g.add(part(GEO.sphere, shades[n++ % shades.length], { s: 0.115, p: [Math.cos(a) * ring, y, Math.sin(a) * ring] }));
    }
  });
  g.add(part(GEO.cyl, mat('#6d4c41', { roughness: 0.8 }), { s: [0.022, 0.16, 0.022], p: [0, 0.36, 0], r: [0, 0, 0.2] }));
  g.add(leaf({ p: [0, 0.4, 0], yaw: 2.2, droop: -0.1, size: 1.25, color: '#4caf50' }));
  return g;
}

export function buildWatermelon() {
  const g = new THREE.Group();
  const { rind, pith, flesh, span } = melonGeometries();
  const slice = new THREE.Group();
  slice.add(part(rind, mat('#2e8b3a', { roughness: 0.55 })));
  slice.add(part(pith, mat('#e3f4c4', { roughness: 0.6 })));
  slice.add(part(flesh, mat('#ff4d5e', { roughness: 0.45 })));

  const seedMat = mat('#1d1d1d', { roughness: 0.3 });
  const seeds = [[0.22, -0.3], [0.3, 0.05], [0.36, -0.32], [0.4, 0.3], [0.27, 0.32], [0.42, -0.05]];
  for (const side of [-1, 1]) {
    for (const [r, f] of seeds) {
      const a = -Math.PI / 2 + f * span * 0.75;
      slice.add(part(GEO.sphereLo, seedMat, {
        s: [0.022, 0.038, 0.012], p: [Math.cos(a) * r, Math.sin(a) * r, side * 0.113], r: [0, 0, a + Math.PI / 2],
      }));
    }
  }
  slice.position.y = 0.34;
  g.add(slice);
  return g;
}

export const FRUIT_TYPES = {
  apple: {
    name: { vi: 'Táo', en: 'Apple' }, emoji: '🍎', points: 10, growth: 1, radius: 0.42, color: '#e8322f', weight: 30,
    desc: { vi: 'Trái cây phổ biến nhất trên bản đồ.', en: 'The most common fruit on the map.' }, build: buildApple,
  },
  orange: {
    name: { vi: 'Cam', en: 'Orange' }, emoji: '🍊', points: 12, growth: 1, radius: 0.42, color: '#fb8a1e', weight: 22,
    desc: { vi: 'Vỏ sần, xuất hiện thường xuyên.', en: 'Dimpled peel, shows up often.' }, build: buildOrange,
  },
  banana: {
    name: { vi: 'Chuối', en: 'Banana' }, emoji: '🍌', points: 15, growth: 1, radius: 0.48, color: '#ffd43b', weight: 18,
    desc: { vi: 'Nải 3 quả.', en: 'A bunch of three.' }, build: buildBanana,
  },
  strawberry: {
    name: { vi: 'Dâu tây', en: 'Strawberry' }, emoji: '🍓', points: 15, growth: 1, radius: 0.36, color: '#e8283c', weight: 16,
    desc: { vi: 'Nhỏ, khó nhìn hơn một chút.', en: 'Small and a little harder to spot.' }, build: buildStrawberry,
  },
  grape: {
    name: { vi: 'Nho', en: 'Grapes' }, emoji: '🍇', points: 20, growth: 2, radius: 0.42, color: '#7d3c98', weight: 10,
    desc: { vi: 'Chùm nho, rắn dài thêm 2 đốt.', en: 'A bunch of grapes — the snake grows 2 segments.' }, build: buildGrape,
  },
  watermelon: {
    name: { vi: 'Dưa hấu', en: 'Watermelon' }, emoji: '🍉', points: 30, growth: 3, radius: 0.55, color: '#ff4d5e', weight: 6,
    desc: { vi: 'Hiếm, to, rắn dài thêm 3 đốt.', en: 'Rare and big — the snake grows 3 segments.' }, build: buildWatermelon,
  },
  golden: {
    name: { vi: 'Táo vàng', en: 'Golden apple' }, emoji: '⭐', points: 100, growth: 2, radius: 0.46, color: '#ffc928', weight: 0,
    special: true, lifetime: 10,
    desc: { vi: 'Xuất hiện ngẫu nhiên, chỉ tồn tại 10 giây.', en: 'Appears at random and only lasts 10 seconds.' }, build: buildGoldenApple,
  },
};
