// Keyboard controls and the mapping from head angles to steering.

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const BOOST = ['Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'KeyW'];
const LOOK = ['ArrowDown', 'KeyS'];
const GAME_KEYS = new Set([...LEFT, ...RIGHT, ...BOOST, ...LOOK]);

/** Head angles inside this dead zone (degrees) are ignored so small jitter never steers. */
const DEAD_ZONE = 3.5;
/** Nodding the chin down past this many degrees triggers the boost. */
export const NOD_THRESHOLD = 12;
/** Raising the chin from LOOK_START to LOOK_FULL degrees lifts the camera to the overview. */
const LOOK_START = 6;
const LOOK_FULL = 18;

export class Keyboard {
  constructor() {
    this.down = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  any(codes) {
    return codes.some((code) => this.down.has(code));
  }

  /** -1 = left, +1 = right. */
  get turn() {
    return (this.any(RIGHT) ? 1 : 0) - (this.any(LEFT) ? 1 : 0);
  }

  get boost() {
    return this.any(BOOST);
  }

  /** Held key lifts the camera to the overview (1) like raising the chin. */
  get look() {
    return this.any(LOOK) ? 1 : 0;
  }
}

/** Sensitivity 1..10 → head angle (degrees) that gives a full-strength turn. */
export function sensitivityToAngle(sensitivity) {
  return 34 - (sensitivity - 1) * 2.4;
}

/**
 * Converts calibrated head angles into { turn: -1..1, boost, look: 0..1, degrees }.
 * Turning the head left (negative steer) turns the snake left; chin down boosts,
 * chin up lifts the camera.
 */
export function headSteer(angles, settings) {
  let degrees = settings.steer === 'roll' ? angles.roll : -angles.yaw;
  if (settings.invert) degrees = -degrees;
  const max = sensitivityToAngle(settings.sens);
  const amount = Math.min(1, Math.max(0, (Math.abs(degrees) - DEAD_ZONE) / (max - DEAD_ZONE)));
  return {
    turn: Math.sign(degrees) * amount ** 1.25,
    boost: settings.nod && angles.pitch > NOD_THRESHOLD,
    look: settings.lookUp ? Math.min(1, Math.max(0, (-angles.pitch - LOOK_START) / (LOOK_FULL - LOOK_START))) : 0,
    degrees,
  };
}
