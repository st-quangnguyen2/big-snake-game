import { Music } from './music.js';

// All sound is synthesized with Web Audio (no audio files). Routing:
// effects → sfxBus ─┐
// music  → musicBus ┴→ master → speakers

const MASTER_GAIN = 0.9;
const MUSIC_MAX = 0.5;
const SFX_MAX = 0.42;

/** Volume slider (0–100) → gain, squared so the slider feels even to the ear. */
const loudness = (value) => (Math.max(0, Math.min(100, value)) / 100) ** 2;

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.volumes = { music: 60, sfx: 80, muted: false };
    this.music = new Music(this);
  }

  /** Creates / resumes the audio context; must run inside a user gesture the first time. */
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.applyVolumes(true);
      this.music.onUnlock();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** volumes: { music: 0–100, sfx: 0–100, muted } */
  setVolumes(volumes) {
    Object.assign(this.volumes, volumes);
    this.applyVolumes(false);
  }

  applyVolumes(immediate) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (param, value) => (immediate ? param.setValueAtTime(value, t) : param.setTargetAtTime(value, t, 0.05));
    set(this.master.gain, this.volumes.muted ? 0 : MASTER_GAIN);
    set(this.musicBus.gain, loudness(this.volumes.music) * MUSIC_MAX);
    set(this.sfxBus.gain, loudness(this.volumes.sfx) * SFX_MAX);
  }

  /** Stops all sound while the tab is hidden. */
  suspend() {
    this.ctx?.suspend();
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  // ------------------------------------------------------------ building blocks

  tone(freq, duration, { type = 'sine', vol = 0.4, slide = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  /** Filtered noise burst; `sweep` moves the filter frequency over the duration. */
  noise(duration, { vol = 0.3, freq = 900, filter = 'lowpass', q = 0.8, sweep = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.Q.value = q;
    biquad.frequency.setValueAtTime(freq, t);
    if (sweep) biquad.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(biquad).connect(gain).connect(this.sfxBus);
    source.start(t, Math.random() * 0.5);
    source.stop(t + duration + 0.05);
  }

  // ------------------------------------------------------------ game sounds

  /** Rising pitch with the combo so streaks feel rewarding. */
  eat(combo = 1) {
    const f = 520 * 2 ** (((Math.min(combo, 5) - 1) * 2) / 12);
    this.tone(f, 0.1, { type: 'triangle', slide: f * 0.5, vol: 0.35 });
    this.tone(f * 1.5, 0.12, { delay: 0.05, vol: 0.2 });
  }

  catch(combo = 1) {
    const f = 330 * 2 ** (((Math.min(combo, 5) - 1) * 2) / 12);
    this.tone(f, 0.09, { type: 'square', vol: 0.12, slide: f * 0.6 });
    this.tone(f * 2, 0.18, { type: 'triangle', delay: 0.07, vol: 0.3, slide: f * 0.5 });
  }

  golden() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', delay: i * 0.06, vol: 0.28 }));
  }

  /** Sparkle when a golden apple appears somewhere. */
  goldenAppear() {
    [1319, 1568, 1976, 2637, 1976].forEach((f, i) => this.tone(f, 0.22, { delay: i * 0.07, vol: 0.12 }));
  }

  /** Chime when a caught animal's icon lands in the counter. */
  collect() {
    this.tone(1320, 0.09, { vol: 0.18 });
    this.tone(1760, 0.14, { vol: 0.14, delay: 0.06 });
  }

  hit() {
    this.noise(0.35, { vol: 0.45, freq: 700 });
    this.tone(180, 0.4, { type: 'sawtooth', vol: 0.18, slide: -120 });
  }

  boost() {
    this.noise(0.4, { vol: 0.22, freq: 500, filter: 'bandpass', q: 1.2, sweep: 2200 });
    this.tone(320, 0.25, { type: 'triangle', vol: 0.12, slide: 320 });
  }

  /** Squelch when the snake slides into mud. */
  mud() {
    this.noise(0.28, { vol: 0.4, freq: 450 });
    this.tone(120, 0.2, { vol: 0.3, slide: -60 });
    this.tone(170, 0.12, { vol: 0.2, slide: 90, delay: 0.14 });
  }

  /** Leaves rustling when the snake pushes through a bush. */
  rustle() {
    this.noise(0.18, { vol: 0.22, freq: 2600, filter: 'bandpass', q: 0.9 });
    this.noise(0.22, { vol: 0.18, freq: 3400, filter: 'bandpass', q: 0.9, delay: 0.1 });
    this.noise(0.16, { vol: 0.14, freq: 2200, filter: 'bandpass', q: 0.9, delay: 0.22 });
  }

  /** Each animal has its own little cry when it notices the snake. */
  startle(type) {
    if (type === 'mouse') {
      this.tone(2300, 0.05, { type: 'square', vol: 0.05, slide: 700 });
      this.tone(2700, 0.06, { type: 'square', vol: 0.05, slide: 600, delay: 0.08 });
    } else if (type === 'chick') {
      this.tone(1700, 0.09, { vol: 0.16, slide: 700 });
      this.tone(1900, 0.09, { vol: 0.14, slide: 600, delay: 0.12 });
    } else if (type === 'frog') {
      this.tone(200, 0.08, { type: 'sawtooth', vol: 0.12, slide: -40 });
      this.tone(160, 0.12, { type: 'sawtooth', vol: 0.12, slide: -30, delay: 0.1 });
    } else {
      this.tone(140, 0.1, { vol: 0.32, slide: -60 });
      this.noise(0.07, { vol: 0.16, freq: 900 });
      this.tone(140, 0.1, { vol: 0.25, slide: -60, delay: 0.16 });
    }
  }

  /** Snake hiss when a round starts. */
  hiss() {
    this.noise(0.6, { vol: 0.14, freq: 3500, filter: 'highpass' });
  }

  click() {
    this.tone(900, 0.04, { type: 'triangle', vol: 0.12 });
  }

  pause() {
    this.tone(660, 0.08, { type: 'triangle', vol: 0.18 });
    this.tone(440, 0.12, { type: 'triangle', vol: 0.18, delay: 0.08 });
  }

  unpause() {
    this.tone(440, 0.08, { type: 'triangle', vol: 0.18 });
    this.tone(660, 0.12, { type: 'triangle', vol: 0.18, delay: 0.08 });
  }

  beep(high = false) {
    this.tone(high ? 880 : 520, high ? 0.35 : 0.14, { type: 'square', vol: 0.12 });
  }

  tick(secondsLeft) {
    this.tone(secondsLeft <= 3 ? 1200 : 950, 0.06, { vol: 0.15 });
  }

  gameOver(newRecord = false) {
    const notes = newRecord ? [523, 659, 784, 1047, 1319] : [523, 440, 349, 262];
    notes.forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', delay: i * 0.13, vol: 0.3 }));
  }
}
