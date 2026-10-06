// Decides which detected face steers the game when several people are in view.
// The lock goes to the player close to the camera and facing it; after that the
// same person is followed by position, even if someone else comes closer, and
// the lock is only released once the player has been out of view for a while.

/** Smallest face accepted as the player, as a fraction of the frame width (about 1 m from a webcam). */
export const MIN_FACE_WIDTH = 0.08;
/** Head angles (degrees, relative to the camera) within which a face counts as facing the camera. */
export const MAX_FRONTAL_YAW = 25;
export const MAX_FRONTAL_PITCH = 30;
/** Release the lock after the player has been out of view this long (ms), so someone else can take over. */
export const RELEASE_AFTER_MS = 2000;

export class FaceLock {
  constructor() {
    /** Last known position and size of the locked player's face, or null. */
    this.target = null;
    this.lostSince = 0;
    /** Why nobody is locked although faces are visible: 'far' | 'turned' | null. */
    this.hint = null;
  }

  reset() {
    this.target = null;
    this.lostSince = 0;
    this.hint = null;
  }

  /**
   * faces: [{ cx, cy, width, yaw, pitch }] with normalized image coordinates and
   * camera-relative angles in degrees. Returns the index of the player's face, or -1.
   */
  pick(faces, now) {
    this.hint = null;
    if (this.target) {
      const index = this.follow(faces);
      if (index >= 0) return index;
      this.lostSince ||= now;
      if (now - this.lostSince < RELEASE_AFTER_MS) return -1;
      this.target = null;
    }
    return this.acquire(faces);
  }

  /** The face that continues the locked one: nearest to its last position, of a similar size. */
  follow(faces) {
    const { cx, cy, width } = this.target;
    const gate = Math.max(0.12, width * 0.9);
    let best = -1;
    let bestDistance = Infinity;
    faces.forEach((face, i) => {
      const distance = Math.hypot(face.cx - cx, face.cy - cy);
      const ratio = face.width / width;
      if (distance < gate && ratio > 0.6 && ratio < 1.7 && distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    if (best >= 0) this.lock(faces[best]);
    return best;
  }

  /** Locks the closest face that is near enough and facing the camera. */
  acquire(faces) {
    let best = -1;
    faces.forEach((face, i) => {
      if (face.width < MIN_FACE_WIDTH) {
        this.hint ??= 'far';
      } else if (Math.abs(face.yaw) > MAX_FRONTAL_YAW || Math.abs(face.pitch) > MAX_FRONTAL_PITCH) {
        this.hint = 'turned';
      } else if (best < 0 || face.width > faces[best].width) {
        best = i;
      }
    });
    if (best >= 0) {
      this.hint = null;
      this.lock(faces[best]);
    }
    return best;
  }

  lock(face) {
    this.target = { cx: face.cx, cy: face.cy, width: face.width };
    this.lostSince = 0;
  }
}
