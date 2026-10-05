import * as THREE from 'three';
import { buildSnakeHead, SnakeTube, RING_STEP, SKINS, animateTongue, TONGUE_CYCLE } from './models/snakeModel.js';

export const SEGMENT_SPACING = 0.4;
export const HEAD_RADIUS = 0.55;
const PATH_STEP = 0.08;
const MAX_SEGMENTS = 420;
const HEAD_Y = 0.46;

/**
 * Trail-following snake: the head leaves breadcrumbs every PATH_STEP units and
 * each body segment sits at a fixed distance behind the head along that trail.
 * The snake can only move forward; steering changes the heading gradually.
 */
export class Snake {
  /** `ground(x, z)` gives the terrain height so the body follows hills. */
  constructor(scene, { ground = () => 0 } = {}) {
    this.ground = ground;
    this.body = new SnakeTube(MAX_SEGMENTS * SEGMENT_SPACING + 2);
    this.headModel = buildSnakeHead();
    this.headModel.rotation.order = 'YXZ';
    this.headModel.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.body.mesh, this.headModel);

    this.head = new THREE.Vector3();
    this.heading = 0;
    this.turnVelocity = 0;
    this.length = 8;
    this.targetLength = 8;
    this.invulnerable = 0;
    this.bulges = [];
    this.gulp = 0;
    this.tongueClock = 0;
    this.px = [];
    this.pz = [];
    this._a = new THREE.Vector3();
  }

  /** Switches colour scheme (key of SKINS) and head style (key of HEAD_STYLES) on the fly. */
  setAppearance(skinId, headStyle) {
    const skin = SKINS[skinId] ?? SKINS.green;
    this.body.setSkin(skin);
    const old = this.headModel;
    const head = buildSnakeHead({ skin, style: headStyle });
    head.rotation.order = 'YXZ';
    head.position.copy(old.position);
    head.rotation.copy(old.rotation);
    head.scale.copy(old.scale);
    old.parent.add(head);
    old.parent.remove(old);
    this.headModel = head;
  }

  get forwardX() { return Math.sin(this.heading); }
  get forwardZ() { return Math.cos(this.heading); }
  get segmentCount() { return Math.floor(this.length); }

  reset(x, z, heading, length = 8) {
    this.head.set(x, 0, z);
    this.heading = heading;
    this.turnVelocity = 0;
    this.length = this.targetLength = length;
    this.invulnerable = 0;
    this.bulges.length = 0;
    this.gulp = 0;
    this.px.length = 0;
    this.pz.length = 0;
    const samples = Math.ceil(((length + 12) * SEGMENT_SPACING) / PATH_STEP);
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (let i = samples; i >= 0; i--) {
      this.px.push(x - fx * i * PATH_STEP);
      this.pz.push(z - fz * i * PATH_STEP);
    }
  }

  /**
   * Moves the head forward. `turn` in [-1, 1] (+1 = turn right as seen from behind).
   * Returns 'wall' or 'obstacle' if the head bumped into something, otherwise null.
   */
  move(dt, turn, speed, turnRate, limit = Infinity, colliders = []) {
    this.turnVelocity += (turn - this.turnVelocity) * Math.min(1, dt * 7);
    this.heading -= this.turnVelocity * turnRate * dt;
    this.head.x += Math.sin(this.heading) * speed * dt;
    this.head.z += Math.cos(this.heading) * speed * dt;

    const hit = this.constrain(limit, colliders);
    this.recordPath();

    if (this.length < this.targetLength) this.length = Math.min(this.targetLength, this.length + dt * 7);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    return hit;
  }

  /** Keeps the head inside the arena and out of obstacles, sliding along whatever it hit. */
  constrain(limit, colliders) {
    let fx = Math.sin(this.heading);
    let fz = Math.cos(this.heading);
    let hit = null;
    for (const c of colliders) {
      const dx = this.head.x - c.x;
      const dz = this.head.z - c.z;
      const min = c.r + HEAD_RADIUS * 0.8;
      if (dx * dx + dz * dz >= min * min) continue;
      const d = Math.hypot(dx, dz) || 1e-3;
      const nx = dx / d;
      const nz = dz / d;
      this.head.x = c.x + nx * min;
      this.head.z = c.z + nz * min;
      const dot = fx * nx + fz * nz;
      if (dot < 0) {
        // Keep the tangential part (pick a side when hitting head-on) plus a little push away.
        let tx = fx - nx * dot;
        let tz = fz - nz * dot;
        let tl = Math.hypot(tx, tz);
        if (tl < 0.3) {
          const side = this.turnVelocity >= 0 ? 1 : -1;
          tx = -nz * side;
          tz = nx * side;
          tl = 1;
        }
        fx = tx / tl + nx * 0.35;
        fz = tz / tl + nz * 0.35;
      }
      hit = 'obstacle';
    }
    const slide = (perp, para) => {
      const p = -Math.sign(perp) * Math.max(0.45, Math.abs(perp) * 0.5);
      const q = Math.abs(para) < 0.25 ? (para >= 0 ? 0.8 : -0.8) : para;
      return [p, q];
    };
    if (Math.abs(this.head.x) > limit) {
      this.head.x = Math.sign(this.head.x) * limit;
      if (Math.sign(fx) === Math.sign(this.head.x)) [fx, fz] = slide(fx, fz);
      hit = 'wall';
    }
    if (Math.abs(this.head.z) > limit) {
      this.head.z = Math.sign(this.head.z) * limit;
      if (Math.sign(fz) === Math.sign(this.head.z)) [fz, fx] = slide(fz, fx);
      hit = 'wall';
    }
    if (hit) this.heading = Math.atan2(fx, fz);
    return hit;
  }

  recordPath() {
    const { px, pz, head } = this;
    let lx = px[px.length - 1];
    let lz = pz[pz.length - 1];
    let dx = head.x - lx;
    let dz = head.z - lz;
    let d = Math.hypot(dx, dz);
    while (d >= PATH_STEP) {
      lx += (dx / d) * PATH_STEP;
      lz += (dz / d) * PATH_STEP;
      px.push(lx);
      pz.push(lz);
      dx = head.x - lx;
      dz = head.z - lz;
      d = Math.hypot(dx, dz);
    }
    const keep = Math.ceil(((this.targetLength + 6) * SEGMENT_SPACING) / PATH_STEP) + 2;
    if (px.length > keep + 400) {
      px.splice(0, px.length - keep);
      pz.splice(0, pz.length - keep);
    }
  }

  /** Position on the body `dist` units behind the head (x/z only). */
  pointAt(dist, out) {
    const { px, pz, head } = this;
    const n = px.length;
    const lx = px[n - 1];
    const lz = pz[n - 1];
    const fx = head.x - lx;
    const fz = head.z - lz;
    const fd = Math.hypot(fx, fz);
    if (dist <= fd) {
      const t = fd > 1e-6 ? dist / fd : 0;
      out.x = head.x - fx * t;
      out.z = head.z - fz * t;
      return out;
    }
    const k = (dist - fd) / PATH_STEP;
    const i = Math.floor(k);
    const t = k - i;
    const a = n - 1 - i;
    const b = a - 1;
    if (b < 0) {
      out.x = px[0];
      out.z = pz[0];
      return out;
    }
    out.x = px[a] + (px[b] - px[a]) * t;
    out.z = pz[a] + (pz[b] - pz[a]) * t;
    return out;
  }

  hitsSelf() {
    const count = this.segmentCount;
    const p = this._a;
    for (let i = 9; i <= count; i++) {
      this.pointAt(i * SEGMENT_SPACING, p);
      const r = HEAD_RADIUS * 0.7 + this.radiusAt(i * SEGMENT_SPACING, count * SEGMENT_SPACING) * 0.75;
      const dx = p.x - this.head.x;
      const dz = p.z - this.head.z;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  /** Drops `fraction` of the tail, never below `minLength` segments. */
  shrink(fraction, minLength) {
    this.targetLength = Math.max(minLength, Math.floor(this.targetLength * (1 - fraction)));
    this.length = Math.min(this.length, this.targetLength);
  }

  grow(amount) {
    this.targetLength = Math.min(MAX_SEGMENTS - 1, this.targetLength + amount);
    this.bulges.push({ d: 0.2, amp: 0.32 + amount * 0.06 });
    this.gulp = 1;
  }

  /** Body radius at distance d behind the head for a body of length L. */
  radiusAt(d, L) {
    const t = Math.min(1, d / Math.max(L, 0.001));
    const tail = Math.min(1, Math.max(0, (L + 0.35 - d) / 1.6)) ** 0.7;
    return (0.46 - 0.22 * t ** 1.4) * tail;
  }

  updateVisuals(dt, time) {
    for (const bulge of this.bulges) bulge.d += dt * 6;
    const L = this.length * SEGMENT_SPACING;
    this.bulges = this.bulges.filter((b) => b.d < L + 0.5);

    const visible = this.invulnerable <= 0 || Math.floor(time * 14) % 2 === 0;
    this.body.mesh.visible = visible;
    this.headModel.visible = visible;

    const rings = Math.ceil((L + 0.35) / RING_STEP) + 1;
    const p = this._a;
    const q = { x: 0, z: 0 };
    this.body.update(rings, (k, out) => {
      const d = k * RING_STEP;
      this.pointAt(d, p);
      this.pointAt(d + 0.15, q);
      let tx = p.x - q.x;
      let tz = p.z - q.z;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      // Side-to-side slither wave, fading in from the neck.
      const wave = Math.sin(time * 7 - d * 1.25) * 0.13 * Math.min(1, d / 2);
      let scale = 1;
      for (const b of this.bulges) scale += b.amp * Math.exp(-((d - b.d) ** 2) / 0.2);
      out.x = p.x - tz * wave;
      out.z = p.z + tx * wave;
      out.y = this.ground(out.x, out.z);
      out.r = this.radiusAt(d, L) * scale;
    });

    this.gulp = Math.max(0, this.gulp - dt * 3);
    const head = this.headModel;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const ground = this.ground(this.head.x, this.head.z);
    // Tilt the head with the slope so it climbs and dives with the hills.
    const slope = this.ground(this.head.x + fx * 0.5, this.head.z + fz * 0.5) - this.ground(this.head.x - fx * 0.5, this.head.z - fz * 0.5);
    head.position.set(this.head.x, ground + HEAD_Y + Math.sin(time * 7) * 0.015, this.head.z);
    head.rotation.y = this.heading + Math.sin(time * 7 + 0.6) * 0.07;
    head.rotation.x = -Math.atan(slope);
    head.scale.setScalar(1 + this.gulp * 0.22);

    this.tongueClock = (this.tongueClock + dt) % TONGUE_CYCLE;
    animateTongue(head, this.tongueClock, time);
    head.userData.eyes.update(time);
  }
}
