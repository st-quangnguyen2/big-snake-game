import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { t } from './i18n.js';

// Head pose from the webcam with MediaPipe Face Landmarker. The facial
// transformation matrix gives the head rotation directly; we express it
// relative to a calibrated "looking straight" pose as yaw / pitch / roll.

const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const MODEL_URL = import.meta.env.VITE_FACE_MODEL_URL
  || 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const RAD2DEG = 180 / Math.PI;
const MIN_CALIBRATION_SAMPLES = 8;

/** One Euro filter: smooth when the head is still, responsive when it moves. */
class OneEuroFilter {
  constructor(minCutoff = 1.2, beta = 0.05, derivativeCutoff = 1) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.derivativeCutoff = derivativeCutoff;
    this.reset();
  }

  reset() {
    this.x = null;
    this.dx = 0;
    this.t = null;
  }

  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x, t) {
    if (this.t === null) {
      this.t = t;
      this.x = x;
      return x;
    }
    const dt = Math.max(1e-3, t - this.t);
    this.t = t;
    const ad = OneEuroFilter.alpha(this.derivativeCutoff, dt);
    this.dx = ad * ((x - this.x) / dt) + (1 - ad) * this.dx;
    const a = OneEuroFilter.alpha(this.minCutoff + this.beta * Math.abs(this.dx), dt);
    this.x = a * x + (1 - a) * this.x;
    return this.x;
  }
}

function averageQuaternion(samples) {
  const ref = samples[0];
  const sum = new Quaternion(0, 0, 0, 0);
  for (const q of samples) {
    const sign = q.dot(ref) < 0 ? -1 : 1;
    sum.x += q.x * sign;
    sum.y += q.y * sign;
    sum.z += q.z * sign;
    sum.w += q.w * sign;
  }
  return sum.normalize();
}

export class HeadTracker {
  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.landmarker = null;
    this.stream = null;
    this.delegate = null;
    this.facePresent = false;
    this.landmarks = null;
    /** Filtered head angles in degrees relative to the calibrated pose. */
    this.angles = { yaw: 0, pitch: 0, roll: 0 };
    this.neutral = new Quaternion();
    this.filters = { yaw: new OneEuroFilter(), pitch: new OneEuroFilter(), roll: new OneEuroFilter() };
    this.lastVideoTime = -1;
    this.lastTimestamp = 0;
    this.lastSeen = 0;
    this.calibration = null;
    this._m = new Matrix4();
    this._q = new Quaternion();
    this._rel = new Quaternion();
    this._p = new Vector3();
    this._s = new Vector3();
    this._e = new Euler();
  }

  get ready() {
    return Boolean(this.landmarker && this.stream);
  }

  async start(onStatus = () => {}) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error(t('tracker.insecure'));
    }
    if (!this.stream) {
      onStatus(t('tracker.permission'));
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
    }
    if (!this.landmarker) {
      try {
        onStatus(t('tracker.runtime'));
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        onStatus(t('tracker.model'));
        this.landmarker = await this.create(fileset, 'GPU').catch((err) => {
          console.warn('GPU delegate unavailable, falling back to CPU', err);
          return this.create(fileset, 'CPU');
        });
      } catch (err) {
        this.stopCamera();
        throw err;
      }
    }
  }

  create(fileset, delegate) {
    this.delegate = delegate;
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });
  }

  /** Releases the webcam (the loaded model is kept for a quick restart). */
  stopCamera() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.facePresent = false;
    this.landmarks = null;
    this.lastVideoTime = -1;
  }

  /** Call once per animation frame; runs detection only on new video frames. */
  update(now = performance.now()) {
    if (!this.ready) return;
    this.checkCalibration(now);
    if (this.video.readyState < 2 || this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;
    // detectForVideo needs strictly increasing timestamps.
    const timestamp = Math.max(now, this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;

    let result;
    try {
      result = this.landmarker.detectForVideo(this.video, timestamp);
    } catch (err) {
      console.warn('Face detection failed', err);
      return;
    }

    const matrices = result.facialTransformationMatrixes;
    if (!matrices?.length) {
      this.landmarks = null;
      // Ignore single dropped frames before declaring the face lost.
      if (now - this.lastSeen > 250) this.facePresent = false;
      return;
    }

    this._m.fromArray(matrices[0].data);
    this._m.decompose(this._p, this._q, this._s);
    this.calibration?.samples.push(this._q.clone());
    this._rel.copy(this.neutral).invert().multiply(this._q);
    this._e.setFromQuaternion(this._rel, 'YXZ');
    const t = timestamp / 1000;
    this.angles.yaw = this.filters.yaw.filter(this._e.y * RAD2DEG, t);
    this.angles.pitch = this.filters.pitch.filter(this._e.x * RAD2DEG, t);
    this.angles.roll = this.filters.roll.filter(this._e.z * RAD2DEG, t);
    this.landmarks = result.faceLandmarks?.[0] ?? null;
    this.facePresent = true;
    this.lastSeen = now;
  }

  /** Records the current head pose as "straight ahead". */
  calibrate(durationMs = 1000, timeoutMs = 5000) {
    this.calibration?.reject(new Error(t('tracker.cancelled')));
    return new Promise((resolve, reject) => {
      this.calibration = { samples: [], start: performance.now(), durationMs, timeoutMs, resolve, reject };
    });
  }

  checkCalibration(now) {
    const c = this.calibration;
    if (!c) return;
    const elapsed = now - c.start;
    if (elapsed >= c.durationMs && c.samples.length >= MIN_CALIBRATION_SAMPLES) {
      this.neutral.copy(averageQuaternion(c.samples));
      Object.values(this.filters).forEach((f) => f.reset());
      this.calibration = null;
      c.resolve();
    } else if (elapsed > c.timeoutMs) {
      this.calibration = null;
      c.reject(new Error(t('tracker.noFace')));
    }
  }
}
