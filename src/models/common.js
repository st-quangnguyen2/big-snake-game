import * as THREE from 'three';

// Shared low-poly building blocks used by every procedural model in the game.

const materialCache = new Map();

/** Cached MeshStandardMaterial keyed by color + plain options (no textures). */
export function mat(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  let material = materialCache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...options });
    materialCache.set(key, material);
  }
  return material;
}

export const GEO = {
  sphere: new THREE.SphereGeometry(1, 22, 16),
  sphereLo: new THREE.SphereGeometry(1, 10, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 12),
  coneLo: new THREE.ConeGeometry(1, 1, 7),
  box: new THREE.BoxGeometry(1, 1, 1),
  octa: new THREE.OctahedronGeometry(1, 0),
  icosa: new THREE.IcosahedronGeometry(1, 0),
};

/**
 * Creates a mesh from a unit geometry.
 * s: uniform scale or [x, y, z]; p: position; r: Euler rotation (XYZ).
 */
export function part(geometry, material, { s = 1, p = [0, 0, 0], r = [0, 0, 0] } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  if (typeof s === 'number') mesh.scale.setScalar(s);
  else mesh.scale.set(s[0], s[1], s[2]);
  mesh.position.set(p[0], p[1], p[2]);
  mesh.rotation.set(r[0], r[1], r[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Empty group used as a joint (ears, legs, wings, tails...). */
export function pivot(p = [0, 0, 0], r = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(p[0], p[1], p[2]);
  group.rotation.set(r[0], r[1], r[2]);
  return group;
}

const leafGeometries = new Map();
/**
 * Leaf outline in the XY plane, base at the origin, tip along +X (0.3 long).
 * `bend` curls the outer half downward (local -Z, which becomes world -Y once
 * the leaf is laid flat); a slight V-fold along the midrib gives it volume.
 */
export function getLeafGeometry(bend = 0) {
  let geometry = leafGeometries.get(bend);
  if (!geometry) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.05, 0.13, 0.2, 0.12, 0.3, 0);
    shape.bezierCurveTo(0.2, -0.12, 0.05, -0.13, 0, 0);
    geometry = new THREE.ShapeGeometry(shape, 16);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const curl = Math.max(0, x - 0.08);
      pos.setZ(i, -bend * curl * curl - Math.abs(y) * 0.35);
    }
    geometry.computeVertexNormals();
    leafGeometries.set(bend, geometry);
  }
  return geometry;
}

export function leafMaterial(color = '#43a047') {
  return mat(color, { side: THREE.DoubleSide, roughness: 0.7 });
}

/** A leaf lying flat, rotated `yaw` around Y, tilted `droop` downward and curled by `bend`. */
export function leaf({ p = [0, 0, 0], yaw = 0, droop = 0.3, size = 1, color, bend = 0 } = {}) {
  const outer = pivot(p, [0, yaw, 0]);
  const tilt = pivot([0, 0, 0], [0, 0, -droop]);
  const mesh = part(getLeafGeometry(bend), leafMaterial(color), { s: size, r: [-Math.PI / 2, 0, 0] });
  tilt.add(mesh);
  outer.add(tilt);
  return outer;
}

/** Revolves a 2D profile [[radius, y], ...] around the Y axis. */
export function lathe(points, segments = 24) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

/**
 * Eye: sclera ball, iris (+ optional pupil) and highlight on a `look` pivot
 * that rotates for gaze, all inside a `lid` pivot squashed vertically to blink.
 * `dir` is the outward direction the eye faces at rest.
 */
export function buildEye({
  p, dir = [0, 0, 1], size, sclera, iris, irisScale = 0.8, pupil, pupilScale = [0.3, 0.3], highlight,
}) {
  const eye = pivot(p);
  eye.rotation.order = 'YXZ';
  eye.rotation.y = Math.atan2(dir[0], dir[2]);
  eye.rotation.x = -Math.atan2(dir[1], Math.hypot(dir[0], dir[2]));
  const lid = pivot();
  eye.add(lid);
  lid.add(part(GEO.sphere, sclera, { s: size }));
  const look = pivot();
  look.rotation.order = 'YXZ';
  lid.add(look);
  if (iris) {
    look.add(part(GEO.sphere, iris, { s: [size * irisScale, size * irisScale, size * 0.5], p: [0, 0, size * 0.62] }));
  }
  if (pupil) {
    look.add(part(GEO.sphere, pupil, { s: [size * pupilScale[0], size * pupilScale[1], size * 0.12], p: [0, 0, size * 1.04] }));
  }
  if (highlight) {
    look.add(part(GEO.sphereLo, highlight, { s: size * 0.2, p: [size * 0.26, size * 0.3, size * 1.02] }));
  }
  eye.userData.lid = lid;
  eye.userData.look = look;
  return eye;
}

/**
 * Drives a pair of eyes: quick random glances (saccades) and blinks.
 * `update(t)` takes the model's animation clock in seconds.
 */
export class EyeRig {
  constructor(eyes, { blink = true, range = 0.45, pitchRange = 0.22 } = {}) {
    this.eyes = eyes;
    this.blink = blink;
    this.range = range;
    this.pitchRange = pitchRange;
    this.gx = 0;
    this.gy = 0;
    this.tx = 0;
    this.ty = 0;
    this.nextGlance = 0;
    this.nextBlink = 0.8 + Math.random() * 2;
    this.blinkStart = -1;
    this.last = null;
  }

  update(t, { alert = false } = {}) {
    if (this.last === null || t < this.last) {
      // First frame or the clock was reset: restart the schedule from now.
      this.nextGlance = t;
      this.nextBlink = t + 0.8 + Math.random() * 2;
      this.blinkStart = -1;
      this.last = t;
    }
    const dt = Math.min(0.1, t - this.last);
    this.last = t;

    if (t >= this.nextGlance) {
      const center = Math.random() < 0.3;
      this.tx = center ? 0 : (Math.random() * 2 - 1) * this.range;
      this.ty = center ? 0 : (Math.random() * 2 - 1) * this.pitchRange;
      this.nextGlance = t + (alert ? 0.2 + Math.random() * 0.4 : 0.5 + Math.random() * 1.8);
    }
    const k = 1 - Math.exp(-dt * 22);
    this.gx += (this.tx - this.gx) * k;
    this.gy += (this.ty - this.gy) * k;

    let open = 1;
    if (this.blink) {
      if (this.blinkStart < 0 && t >= this.nextBlink) this.blinkStart = t;
      if (this.blinkStart >= 0) {
        const phase = (t - this.blinkStart) / 0.16;
        if (phase >= 1) {
          this.blinkStart = -1;
          // Occasionally blink twice in a row.
          this.nextBlink = t + (Math.random() < 0.2 ? 0.1 : 1.8 + Math.random() * 3.2);
        } else {
          open = 1 - 0.92 * Math.sin(phase * Math.PI);
        }
      }
    }
    const widen = alert ? 1.12 : 1;
    for (const eye of this.eyes) {
      eye.userData.look.rotation.set(-this.gy, this.gx, 0);
      eye.userData.lid.scale.set(widen, open * widen, widen);
    }
  }
}
