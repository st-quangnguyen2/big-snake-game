import * as THREE from 'three';
import { FRUIT_TYPES } from './models/fruits.js';
import { ANIMAL_TYPES } from './models/animals.js';

const TAU = Math.PI * 2;

function approachAngle(current, target, maxStep) {
  let diff = (target - current) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return current + Math.max(-maxStep, Math.min(maxStep, diff));
}

function elasticOut(t) {
  return t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin(((t - 0.075) * TAU) / 0.3) + 1;
}

/**
 * Something the snake can eat: a floating fruit or a small animal that
 * wanders around and runs away when the snake's head comes close.
 */
export class Prey {
  constructor(kind, type) {
    this.kind = kind;
    this.type = type;
    this.def = kind === 'fruit' ? FRUIT_TYPES[type] : ANIMAL_TYPES[type];
    this.root = new THREE.Group();
    this.model = this.def.build();
    this.root.add(this.model);
    this.root.scale.setScalar(0.001);
    this.position = this.root.position;
    this.age = 0;
    this.phase = Math.random() * 10;
    this.heading = Math.random() * TAU;
    this.wanderHeading = this.heading;
    this.wanderTimer = 0;
    this.idle = 0;
    this.speed = 0;
    this.hopping = false;
    this.hopT = 0;
    this.hopWait = Math.random() * 0.5;
    this.fleeing = false;
    /** True for the one frame in which the animal notices the snake and bolts. */
    this.startledNow = false;
    this.lastStartle = -10;
    if (kind === 'fruit') this.model.position.y = this.def.radius + 0.18;
  }

  get radius() {
    return this.def.radius;
  }

  get expired() {
    return Boolean(this.def.lifetime) && this.age >= this.def.lifetime;
  }

  /** ctx: { head, limit, colliders, ground } */
  update(dt, ctx) {
    this.age += dt;
    this.root.scale.setScalar(Math.max(0.001, elasticOut(this.age / 0.5)));
    if (this.kind === 'fruit') this.updateFruit();
    else this.updateAnimal(dt, ctx);
    this.position.y = ctx.ground(this.position.x, this.position.z);
  }

  updateFruit() {
    const t = this.age + this.phase;
    this.model.rotation.y = t * 1.2;
    this.model.position.y = this.def.radius + 0.18 + Math.sin(t * 2.5) * 0.07;
    this.model.userData.animate?.(t);
    if (this.def.lifetime) {
      // Blink during the last 3 seconds before disappearing.
      const left = this.def.lifetime - this.age;
      this.root.visible = left > 3 || Math.floor(left * 8) % 2 === 0;
    }
  }

  updateAnimal(dt, { head, limit, colliders }) {
    const def = this.def;
    const pos = this.position;
    const dx = pos.x - head.x;
    const dz = pos.z - head.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const wasFleeing = this.fleeing;
    this.fleeing = dist < def.fleeRadius;
    // Only squeak again after calming down for a while.
    this.startledNow = this.fleeing && !wasFleeing && this.age - this.lastStartle > 2.5;
    if (this.startledNow) this.lastStartle = this.age;

    let vx;
    let vz;
    if (this.fleeing) {
      vx = dx / dist;
      vz = dz / dist;
      this.idle = 0;
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderHeading = this.heading + (Math.random() * 2 - 1) * 1.3;
        this.wanderTimer = 1 + Math.random() * 2.5;
        this.idle = Math.random() < 0.3 ? 0.6 + Math.random() : 0;
      }
      vx = Math.sin(this.wanderHeading);
      vz = Math.cos(this.wanderHeading);
    }
    // Walls push the animal back toward the middle, so fleeing ones get cornered.
    const margin = 3.5;
    const push = (gap) => Math.max(0, (margin - gap) / margin) * 2.2;
    vx += push(pos.x + limit) - push(limit - pos.x);
    vz += push(pos.z + limit) - push(limit - pos.z);
    // ...and obstacles push them around rocks and stumps.
    for (const c of colliders) {
      const ox = pos.x - c.x;
      const oz = pos.z - c.z;
      const od = Math.hypot(ox, oz) || 0.001;
      const k = Math.max(0, (c.r + 1.8 - od) / 1.8) * 2.5;
      vx += (ox / od) * k;
      vz += (oz / od) * k;
    }

    this.heading = approachAngle(this.heading, Math.atan2(vx, vz), (this.fleeing ? 6 : 2.5) * dt);
    if (this.idle > 0) this.idle -= dt;
    const targetSpeed = this.fleeing ? def.fleeSpeed : this.idle > 0 ? 0 : def.wanderSpeed;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 5);

    let move = this.speed;
    let y = 0;
    let hop = -1;
    if (def.move === 'hop') {
      move = 0;
      if (!this.hopping) {
        this.hopWait -= dt;
        if (this.hopWait <= 0 && this.speed > 0.2) {
          this.hopping = true;
          this.hopT = 0;
        }
      }
      if (this.hopping) {
        this.hopT += dt / def.hopTime;
        hop = Math.min(1, this.hopT);
        y = Math.sin(hop * Math.PI) * def.hopHeight * (this.fleeing ? 1 : 0.6);
        move = this.speed * 1.25;
        if (this.hopT >= 1) {
          this.hopping = false;
          this.hopWait = this.fleeing ? 0.08 : 0.3 + Math.random() * 0.5;
          hop = -1;
          y = 0;
        }
      }
    }

    pos.x = Math.max(-limit, Math.min(limit, pos.x + Math.sin(this.heading) * move * dt));
    pos.z = Math.max(-limit, Math.min(limit, pos.z + Math.cos(this.heading) * move * dt));
    for (const c of colliders) {
      const ox = pos.x - c.x;
      const oz = pos.z - c.z;
      const min = c.r + this.def.radius * 0.8;
      const od = Math.hypot(ox, oz);
      if (od < min && od > 0) {
        pos.x = c.x + (ox / od) * min;
        pos.z = c.z + (oz / od) * min;
      }
    }
    this.root.rotation.y = this.heading;
    this.model.position.y = y;
    this.model.userData.animate(this.age + this.phase, {
      moving: def.move === 'hop' ? 0 : Math.min(1, this.speed / 1.5),
      hop,
      panic: this.fleeing,
    });
  }
}
