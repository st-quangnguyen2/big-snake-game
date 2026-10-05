import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildWorld, ARENA_HALF, COLLIDERS, MUD, BUSHES, MAX_PUSHERS, groundHeight, slopeAlong, inMud, inBush,
} from './world.js';
import { Snake, SEGMENT_SPACING, HEAD_RADIUS } from './snake.js';
import { Prey } from './prey.js';
import { Particles } from './particles.js';
import { FRUIT_TYPES } from './models/fruits.js';
import { ANIMAL_TYPES } from './models/animals.js';

export const MAX_COMBO = 5;
/** Points lost per crash (never below zero); the snake also loses HIT_SHRINK of its length. */
const HIT_PENALTY = 10;
const HIT_SHRINK = 0.2;
export const comboMultiplier = (combo) => 1 + (Math.max(1, combo) - 1) * 0.5;
/** Camera views: chase presets (0 = close, 1 = high overview) plus a first-person view. */
export const VIEWS = ['near', 'far', 'top', 'first'];
const CHASE_HEIGHT = { near: 0, far: 0.4, top: 0.85, first: 0 };

/** Camera blend of a named view: chase lift (0 = close … 1 = overview) and first-person weight. */
export function viewCamera(view) {
  return { chase: CHASE_HEIGHT[view], first: view === 'first' ? 1 : 0 };
}

const START_LENGTH = 8;
const BASE_SPEED = 5.4;
const MAX_SPEED = 7.6;
const BOOST_FACTOR = 1.65;
const TURN_RATE = 2.2;
const MUD_SLOWDOWN = 0.6;
/** Speed change per unit of slope (uphill slower, downhill faster). */
const SLOPE_EFFECT = 1.2;
const FRUIT_COUNT = 11;
const ANIMAL_COUNT = 5;
const COMBO_WINDOW = 2.6;
const INVULNERABLE_TIME = 2.2;
const BOOST_DRAIN = 0.45;
const BOOST_REGEN = 0.16;
const DEMO_MAX_LENGTH = 40;

const TAU = Math.PI * 2;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function pickWeighted(table) {
  const entries = Object.entries(table).filter(([, def]) => def.weight > 0);
  let roll = Math.random() * entries.reduce((sum, [, def]) => sum + def.weight, 0);
  for (const [type, def] of entries) {
    roll -= def.weight;
    if (roll <= 0) return type;
  }
  return entries[0][0];
}

/**
 * Owns the Three.js scene and the game rules. Modes:
 * demo (attract mode behind the menu) → ready (countdown) → playing ⇄ paused → over.
 */
export class Game {
  /** worldOptions: { theme, night, grass } (see buildWorld). */
  constructor(container, hooks = {}, worldOptions = {}) {
    this.hooks = hooks;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.worldOptions = worldOptions;
    this.world = buildWorld(this.scene, worldOptions);
    this.scene.environmentIntensity = this.world.environmentIntensity;

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    this.snake = new Snake(this.scene, { ground: groundHeight });
    this.particles = new Particles(this.scene);
    this.prey = [];
    this.respawns = [];
    this.mode = 'demo';
    this.stats = this.freshStats(0);
    this.clock = 0;
    this.camHeading = 0;
    this.orbit = 0;
    this.shake = 0;
    this.snapCamera = true;
    this.trailTimer = 0;
    this.splashTimer = 0;
    this.wasInMud = false;
    this.wasBoosting = false;
    this.view = 'near';
    /** When set ({ chase, first }), the camera stays at this blend and ignores view / look changes. */
    this.lockedCamera = null;
    this.camView = 0;
    this.firstPerson = 0;
    this.headInBush = -1;
    this.pushers = Array.from({ length: MAX_PUSHERS }, () => ({ x: 0, z: 0, r: 0 }));
    this._camTarget = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._v = new THREE.Vector3();

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.enterDemo();
    this.last = performance.now();
    renderer.setAnimationLoop((now) => this.frame(now));
  }

  freshStats(duration) {
    return {
      duration,
      timeLeft: duration,
      score: 0,
      hits: 0,
      combo: 0,
      comboTimer: 0,
      fruits: 0,
      animals: 0,
      /** Animals caught this round, per type. */
      caught: Object.fromEntries(Object.keys(ANIMAL_TYPES).map((type) => [type, 0])),
      golden: 0,
      maxLength: START_LENGTH,
      boost: 1,
      boosting: false,
      boostLocked: false,
    };
  }

  /** Rebuilds the world for a new theme or day/night; grass changes are applied in place. */
  setWorldOptions(options) {
    const next = { ...this.worldOptions, ...options };
    const rebuild = next.theme !== this.worldOptions.theme || next.night !== this.worldOptions.night;
    const grassChanged = JSON.stringify(next.grass) !== JSON.stringify(this.worldOptions.grass);
    this.worldOptions = next;
    if (rebuild) {
      this.world.dispose();
      this.world = buildWorld(this.scene, next);
      this.scene.environmentIntensity = this.world.environmentIntensity;
    } else if (grassChanged) {
      this.world.setGrass(next.grass);
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ modes

  enterDemo() {
    this.mode = 'demo';
    this.stats = this.freshStats(0);
    this.snake.reset(0, 0, Math.random() * TAU, 14);
    this.resetArena();
  }

  /** Sets up a fresh round; call play() when the countdown ends. */
  prepare(durationSeconds) {
    this.mode = 'ready';
    this.stats = this.freshStats(durationSeconds);
    this.lastSecond = Math.ceil(durationSeconds);
    this.goldenTimer = 18 + Math.random() * 12;
    this.snake.reset(0, -ARENA_HALF * 0.45, 0, START_LENGTH);
    this.camHeading = 0;
    this.snapCamera = true;
    this.resetArena();
  }

  play() {
    if (this.mode === 'ready') this.mode = 'playing';
  }

  pause() {
    if (this.mode === 'playing') this.mode = 'paused';
  }

  resume() {
    if (this.mode === 'paused') this.mode = 'playing';
  }

  finish(reason) {
    this.mode = 'over';
    const s = this.stats;
    this.hooks.onEnd?.({
      reason,
      score: s.score,
      hits: s.hits,
      length: s.maxLength,
      fruits: s.fruits,
      animals: s.animals,
      caught: { ...s.caught },
      golden: s.golden,
    });
  }

  // ------------------------------------------------------------ prey

  resetArena() {
    for (const p of this.prey) this.scene.remove(p.root);
    this.prey = [];
    this.respawns = [];
    for (let i = 0; i < FRUIT_COUNT; i++) this.spawn('fruit');
    for (let i = 0; i < ANIMAL_COUNT; i++) this.spawn('animal');
  }

  spawn(kind, type = pickWeighted(kind === 'fruit' ? FRUIT_TYPES : ANIMAL_TYPES)) {
    const prey = new Prey(kind, type);
    this.findSpot(prey.position);
    this.scene.add(prey.root);
    this.prey.push(prey);
    return prey;
  }

  /** Random free spot away from the head, the body and other prey. */
  findSpot(out) {
    const range = ARENA_HALF - 2;
    const head = this.snake.head;
    const p = this._p;
    for (let attempt = 0; attempt < 40; attempt++) {
      out.set((Math.random() * 2 - 1) * range, 0, (Math.random() * 2 - 1) * range);
      if (Math.hypot(out.x - head.x, out.z - head.z) < 7) continue;
      if (COLLIDERS.some((c) => Math.hypot(c.x - out.x, c.z - out.z) < c.r + 1.2)) continue;
      if (BUSHES.some((b) => Math.hypot(b.x - out.x, b.z - out.z) < b.r + 0.6)) continue;
      if (this.prey.some((q) => Math.hypot(q.position.x - out.x, q.position.z - out.z) < 1.6)) continue;
      let onBody = false;
      for (let i = 4; i <= this.snake.segmentCount && !onBody; i += 4) {
        this.snake.pointAt(i * SEGMENT_SPACING, p);
        onBody = Math.hypot(p.x - out.x, p.z - out.z) < 1.2;
      }
      if (!onBody) return out;
    }
    return out;
  }

  removePrey(index) {
    const [prey] = this.prey.splice(index, 1);
    this.scene.remove(prey.root);
    return prey;
  }

  // ------------------------------------------------------------ loop

  frame(now) {
    // Clamp to [0, 50 ms]: never step backwards, and survive long stalls without tunnelling.
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    const input = this.hooks.onFrame?.(now) ?? { turn: 0, boost: false };
    const animating = this.mode !== 'paused';
    if (animating) this.clock += dt;

    if (this.mode === 'demo') this.step(dt, this.autopilot(), false);
    else if (this.mode === 'playing') this.step(dt, input, true);
    else if (this.mode === 'ready' || this.mode === 'over') this.updatePrey(dt, false, false);

    if (animating) {
      this.snake.updateVisuals(dt, this.clock);
      this.particles.update(dt);
      this.updatePushers();
    }
    this.updateCamera(dt, this.mode === 'playing' || this.mode === 'ready' ? input.look ?? 0 : 0);
    this.world.update(this.snake.head.x, this.snake.head.z, this.clock, animating ? dt : 0, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  /** Snake head, body, the fading trail behind the tail, animals and fruit part the grass and bushes. */
  updatePushers() {
    const list = this.pushers;
    let n = 0;
    const add = (x, z, r) => {
      if (n >= list.length) return;
      const p = list[n++];
      p.x = x;
      p.z = z;
      p.r = r;
    };
    add(this.snake.head.x, this.snake.head.z, 0.7);
    for (const prey of this.prey) add(prey.position.x, prey.position.z, prey.kind === 'animal' ? 0.5 : 0.45);
    const count = this.snake.segmentCount;
    const length = count * SEGMENT_SPACING;
    // Grass behind the tail stands back up gradually.
    for (let k = 1; k <= 4; k++) {
      this.snake.pointAt(length + k * 0.7, this._p);
      add(this._p.x, this._p.z, 0.5 - k * 0.1);
    }
    const step = Math.max(2, Math.ceil(count / Math.max(1, list.length - n)));
    for (let i = 2; i <= count && n < list.length; i += step) {
      this.snake.pointAt(i * SEGMENT_SPACING, this._p);
      add(this._p.x, this._p.z, 0.55);
    }
    this.world.setPushers(list, n);
  }

  step(dt, input, scoring) {
    const s = this.stats;
    let boosting = false;
    if (scoring) {
      // Once the boost bar runs dry it must refill to 30% before boosting again.
      if (s.boostLocked && s.boost > 0.3) s.boostLocked = false;
      boosting = input.boost && !s.boostLocked && s.boost > 0;
      s.boost = Math.min(1, Math.max(0, s.boost + (boosting ? -BOOST_DRAIN : BOOST_REGEN) * dt));
      if (s.boost <= 0) s.boostLocked = true;
      s.boosting = boosting;
    }

    const { head, heading } = this.snake;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const muddy = inMud(head.x, head.z);
    const slope = slopeAlong(head.x, head.z, fx, fz);
    const terrain = Math.min(1.3, Math.max(0.7, 1 - slope * SLOPE_EFFECT)) * (muddy ? MUD_SLOWDOWN : 1);
    const growthSpeed = BASE_SPEED + (this.snake.length - START_LENGTH) * 0.025;
    const speed = Math.min(MAX_SPEED, growthSpeed) * (boosting ? BOOST_FACTOR : 1) * terrain;
    const crash = this.snake.move(dt, input.turn, speed, TURN_RATE * (boosting ? 0.85 : 1), ARENA_HALF, COLLIDERS);

    if (scoring && boosting && !this.wasBoosting) this.hooks.onBoost?.();
    this.wasBoosting = boosting;
    if (boosting) {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.05;
        this.snake.pointAt(0.9, this._p);
        this._p.y = groundHeight(this._p.x, this._p.z) - 0.2;
        this.particles.burst(this._p, '#ffffff', 2, 1.2, 0.07);
      }
    }
    if (muddy) {
      if (!this.wasInMud && scoring) this.hooks.onMud?.();
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) {
        this.splashTimer = 0.09;
        this._p.set(head.x, groundHeight(head.x, head.z) - 0.3, head.z);
        this.particles.burst(this._p, '#6b4a2b', 3, 2.2, 0.08);
      }
    }
    this.wasInMud = muddy;

    const bush = inBush(head.x, head.z);
    if (bush >= 0 && bush !== this.headInBush) {
      const b = BUSHES[bush];
      this._p.set(b.x, groundHeight(b.x, b.z) + 0.3, b.z);
      this.particles.burst(this._p, '#4caf50', 14, 3.2, 0.1);
      this.particles.burst(this._p, '#e53935', 4, 2.5, 0.07);
      if (scoring) this.hooks.onBush?.();
    }
    this.headInBush = bush;

    if (scoring && this.snake.invulnerable <= 0) {
      if (crash) this.hit(crash);
      else if (this.snake.hitsSelf()) this.hit('self');
    }

    this.updatePrey(dt, true, scoring);
    if (!scoring) return;

    if (s.comboTimer > 0) {
      s.comboTimer -= dt;
      if (s.comboTimer <= 0) s.combo = 0;
    }
    this.goldenTimer -= dt;
    if (this.goldenTimer <= 0) {
      if (!this.prey.some((p) => p.type === 'golden')) {
        this.spawn('fruit', 'golden');
        this.hooks.onGolden?.();
      }
      this.goldenTimer = 22 + Math.random() * 16;
    }
    s.timeLeft = Math.max(0, s.timeLeft - dt);
    const second = Math.ceil(s.timeLeft);
    if (second !== this.lastSecond) {
      this.lastSecond = second;
      if (second > 0 && second <= 10) this.hooks.onTick?.(second);
    }
    if (s.timeLeft <= 0) this.finish('time');
  }

  updatePrey(dt, canEat, scoring) {
    const ctx = { head: this.snake.head, limit: ARENA_HALF, colliders: COLLIDERS, ground: groundHeight };
    for (let i = this.prey.length - 1; i >= 0; i--) {
      const prey = this.prey[i];
      prey.update(dt, ctx);
      if (prey.startledNow && scoring) this.hooks.onStartle?.(prey);
      if (prey.expired) {
        this.removePrey(i);
        this.particles.burst(prey.position, prey.def.color, 10, 2.5);
        continue;
      }
      if (!canEat || prey.age < 0.2) continue;
      const r = HEAD_RADIUS + prey.radius;
      const dx = prey.position.x - this.snake.head.x;
      const dz = prey.position.z - this.snake.head.z;
      if (dx * dx + dz * dz < r * r) this.eat(i, scoring);
    }
    for (const r of this.respawns) r.t -= dt;
    const due = this.respawns.filter((r) => r.t <= 0);
    if (due.length) {
      this.respawns = this.respawns.filter((r) => r.t > 0);
      due.forEach((r) => this.spawn(r.kind));
    }
  }

  eat(index, scoring) {
    const prey = this.removePrey(index);
    if (prey.type !== 'golden') this.respawns.push({ kind: prey.kind, t: 0.6 + Math.random() * 1.6 });
    this.particles.burst(prey.position, prey.def.color, prey.kind === 'animal' ? 22 : 16, 4.5);
    // Catching an animal also throws golden sparkles.
    if (prey.kind === 'animal') this.particles.burst(prey.position, '#ffd84a', 16, 6, 0.09);

    if (!scoring) {
      if (this.snake.targetLength < DEMO_MAX_LENGTH) this.snake.grow(prey.def.growth);
      return;
    }
    const s = this.stats;
    s.combo = s.comboTimer > 0 ? Math.min(MAX_COMBO, s.combo + 1) : 1;
    s.comboTimer = COMBO_WINDOW;
    const multiplier = comboMultiplier(s.combo);
    const points = Math.round(prey.def.points * multiplier);
    s.score += points;
    if (prey.kind === 'animal') {
      s.animals++;
      s.caught[prey.type]++;
    }
    else s.fruits++;
    if (prey.type === 'golden') s.golden++;
    this.snake.grow(prey.def.growth);
    s.maxLength = Math.max(s.maxLength, Math.floor(this.snake.targetLength));
    this.hooks.onEat?.({ prey, points, combo: s.combo, multiplier, screen: this.toScreen(prey.position, 1.2) });
  }

  /**
   * Crashes never end the round (it always lasts the chosen time): they cost
   * points, combo and part of the tail, then give a short grace period.
   */
  hit(kind) {
    const s = this.stats;
    const penalty = Math.min(s.score, HIT_PENALTY);
    s.score -= penalty;
    s.hits += 1;
    s.combo = 0;
    s.comboTimer = 0;
    this.snake.pointAt(this.snake.length * SEGMENT_SPACING, this._p);
    this._p.y = groundHeight(this._p.x, this._p.z);
    this.particles.burst(this._p, '#3fb54a', 14, 3.5);
    this.snake.shrink(HIT_SHRINK, START_LENGTH);
    this.snake.invulnerable = INVULNERABLE_TIME;
    this.shake = 0.5;
    const head = this.snake.head;
    this._p.set(head.x, groundHeight(head.x, head.z), head.z);
    this.particles.burst(this._p, '#ff5252', 18, 5);
    this.hooks.onHit?.({ kind, penalty });
  }

  /** Attract-mode steering: chase the nearest prey, keep clear of the fence. */
  autopilot() {
    const { head, heading } = this.snake;
    let best = null;
    let bestDist = Infinity;
    for (const p of this.prey) {
      const d = Math.hypot(p.position.x - head.x, p.position.z - head.z);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    let desired = best ? Math.atan2(best.position.x - head.x, best.position.z - head.z) : heading;
    const aheadX = head.x + Math.sin(heading) * 5;
    const aheadZ = head.z + Math.cos(heading) * 5;
    if (Math.abs(aheadX) > ARENA_HALF - 3 || Math.abs(aheadZ) > ARENA_HALF - 3) desired = Math.atan2(-head.x, -head.z);
    for (const c of COLLIDERS) {
      const nearX = head.x + Math.sin(heading) * 2.5;
      const nearZ = head.z + Math.cos(heading) * 2.5;
      if (Math.hypot(nearX - c.x, nearZ - c.z) < c.r + 1.6) {
        // Swerve to whichever side of the obstacle the snake is already on.
        const side = Math.sign(Math.sin(heading) * (c.z - head.z) - Math.cos(heading) * (c.x - head.x)) || 1;
        desired = heading + side * 1.2;
      }
    }
    return { turn: Math.max(-1, Math.min(1, -wrapAngle(desired - heading) * 1.6)), boost: false };
  }

  // ------------------------------------------------------------ camera & helpers

  /** Freezes the camera at exactly what it shows now (e.g. a head-lifted overview). */
  lockCamera() {
    this.lockedCamera = { chase: this.camView, first: this.firstPerson };
    return this.lockedCamera;
  }

  /** look: 0..1 extra lift toward the overview (chin up / held key). */
  updateCamera(dt, look = 0) {
    const head = this.snake.head;
    const camera = this.camera;
    if (this.mode === 'demo') {
      if (camera.fov !== 60) {
        camera.fov = 60;
        camera.updateProjectionMatrix();
      }
      this.orbit += dt * 0.06;
      camera.position.set(Math.sin(this.orbit) * 44, 26, Math.cos(this.orbit) * 44);
      camera.lookAt(0, 0, 0);
      this.snapCamera = true;
      return;
    }
    // First person blends in when chosen; raising the chin still lifts to the overview.
    const lock = this.lockedCamera;
    const firstTarget = lock ? lock.first : this.view === 'first' ? 1 - look : 0;
    this.firstPerson += (firstTarget - this.firstPerson) * (1 - Math.exp(-dt * 5));
    const fp = this.firstPerson;
    if (this.mode !== 'paused') {
      const turnRate = THREE.MathUtils.lerp(3.2, 10, fp);
      this.camHeading += wrapAngle(this.snake.heading - this.camHeading) * (1 - Math.exp(-dt * turnRate));
    }
    const chaseTarget = lock ? lock.chase : Math.max(CHASE_HEIGHT[this.view], look);
    this.camView += (chaseTarget - this.camView) * (1 - Math.exp(-dt * 4));
    const v = this.camView;
    const grown = this.snake.length - START_LENGTH;
    const back = THREE.MathUtils.lerp(8.5 + Math.min(4, grown * 0.03), 11, v);
    const height = THREE.MathUtils.lerp(6.2 + Math.min(3, grown * 0.02), 30, v);
    const ahead = THREE.MathUtils.lerp(4.5, 2.5, v);
    const ground = groundHeight(head.x, head.z);
    const fx = Math.sin(this.camHeading);
    const fz = Math.cos(this.camHeading);
    this._camTarget.set(head.x - fx * back, ground + height, head.z - fz * back);
    this._look.set(head.x + fx * ahead, ground + 0.6, head.z + fz * ahead);
    if (fp > 0.001) {
      // Eyes just above and behind the head, so the top of the head shows at the bottom.
      this._p.set(head.x - fx * 1.5, ground + 1.9, head.z - fz * 1.5);
      this._camTarget.lerp(this._p, fp);
      const ax = head.x + fx * 9;
      const az = head.z + fz * 9;
      this._p.set(ax, groundHeight(ax, az) + 0.3, az);
      this._look.lerp(this._p, fp);
    }
    const fov = THREE.MathUtils.lerp(60, 74, fp);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (this.snapCamera) {
      camera.position.copy(this._camTarget);
      this.snapCamera = false;
    } else {
      camera.position.lerp(this._camTarget, 1 - Math.exp(-dt * THREE.MathUtils.lerp(6, 18, fp)));
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const k = this.shake * 0.6;
      camera.position.x += (Math.random() - 0.5) * k;
      camera.position.y += (Math.random() - 0.5) * k;
    }
    camera.lookAt(this._look);
  }

  /** Projects a world position to CSS pixels. */
  toScreen(position, lift = 0) {
    const v = this._v.set(position.x, position.y + lift, position.z).project(this.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }

  /** Heading-up minimap of the whole arena. */
  drawMinimap(ctx, size) {
    const c = size / 2;
    const scale = (c - 6) / (ARENA_HALF * Math.SQRT2);
    const fx = Math.sin(this.camHeading);
    const fz = Math.cos(this.camHeading);
    // Screen-right as seen from behind the snake is (-cos, +sin).
    const map = (x, z) => [c + (x * -fz + z * fx) * scale, c - (x * fx + z * fz) * scale];

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c - 1, 0, TAU);
    ctx.fillStyle = 'rgba(16, 44, 24, 0.72)';
    ctx.fill();
    ctx.clip();

    ctx.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => {
      const [x, y] = map(sx * ARENA_HALF, sz * ARENA_HALF);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(120, 200, 90, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 160, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const m of MUD) {
      const [x, y] = map(m.x, m.z);
      ctx.beginPath();
      ctx.arc(x, y, m.r * scale, 0, TAU);
      ctx.fillStyle = 'rgba(122, 86, 52, 0.85)';
      ctx.fill();
    }
    for (const b of BUSHES) {
      const [x, y] = map(b.x, b.z);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, b.r * scale), 0, TAU);
      ctx.fillStyle = '#2f8f3a';
      ctx.fill();
    }
    for (const c of COLLIDERS) {
      const [x, y] = map(c.x, c.z);
      if (c.kind === 'tree') {
        ctx.beginPath();
        ctx.arc(x, y, 3.8 * scale, 0, TAU);
        ctx.fillStyle = 'rgba(47, 143, 58, 0.55)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, c.r * scale), 0, TAU);
      ctx.fillStyle = c.kind === 'boulder' ? '#c3c8cd' : '#a8744a';
      ctx.fill();
    }

    for (const p of this.prey) {
      const [x, y] = map(p.position.x, p.position.z);
      const golden = p.type === 'golden';
      ctx.beginPath();
      ctx.arc(x, y, golden ? 5 : p.kind === 'animal' ? 4 : 3, 0, TAU);
      ctx.fillStyle = p.def.color;
      ctx.fill();
      if (p.kind === 'animal' || golden) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = golden ? '#fff6c0' : '#ffffff';
        ctx.stroke();
      }
    }

    const p = this._p;
    ctx.beginPath();
    for (let i = 0; i <= this.snake.segmentCount; i += 2) {
      this.snake.pointAt(i * SEGMENT_SPACING, p);
      const [x, y] = map(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#3fb54a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    const [hx, hy] = map(this.snake.head.x, this.snake.head.z);
    ctx.beginPath();
    ctx.moveTo(hx, hy - 7);
    ctx.lineTo(hx + 5, hy + 4);
    ctx.lineTo(hx - 5, hy + 4);
    ctx.closePath();
    ctx.fillStyle = '#ffd84a';
    ctx.fill();
    ctx.restore();
  }
}
