// Background music: a tiny step sequencer that schedules synthesized notes a
// little ahead of time (Web Audio clock), so playback stays steady even when
// the main thread is busy rendering.

const LOOKAHEAD = 0.15;
const TICK_MS = 25;

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Tracks are 16th-note grids. `play(m, step, time, sixteenth)` is called for
 * every step and triggers instruments on the Music instance `m`.
 */
const TRACKS = {
  /** Calm, bell-like loop for the menu: C – G – Am – F. */
  menu: {
    bpm: 92,
    bars: 4,
    chords: [[48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [41, 60, 65, 69]],
    bells: [[79, 76, 72], [74, 79, 83], [76, 72, 69], [77, 72, 74]],
    play(m, step, t, sd) {
      const bar = Math.floor(step / 16);
      const s = step % 16;
      const chord = this.chords[bar];
      if (s === 0) m.note(chord[0], t, sd * 15, { type: 'sine', vol: 0.22 });
      if (s === 8) m.note(chord[0] + 7, t, sd * 7, { type: 'sine', vol: 0.12 });
      if (s % 2 === 0) {
        const arpeggio = [chord[1], chord[2], chord[3], chord[2]];
        m.note(arpeggio[(s / 2) % 4] + 12, t, sd * 3, { type: 'triangle', vol: 0.045 });
      }
      if (s === 0 || s === 8) m.kick(t, 0.25);
      if (s === 4 || s === 12) m.hat(t, 0.04);
      const slot = [0, 6, 10].indexOf(s);
      if (slot >= 0) m.bell(this.bells[bar][slot], t, 0.06);
    },
  },

  /** Bouncy chiptune-style loop while playing: C – Am – F – G, 8 bars. */
  game: {
    bpm: 118,
    bars: 8,
    chords: [[48, 64, 67, 72], [45, 64, 69, 72], [41, 65, 69, 72], [43, 62, 67, 71]],
    melody: [
      [76, 79, 84, 79, 81, 79, 76, null],
      [72, 76, 81, 76, 79, 76, 72, null],
      [77, 81, 84, 81, 79, 77, 76, 74],
      [74, 79, 83, 79, 81, 83, 84, null],
      [76, null, 76, 79, 84, null, 83, 81],
      [81, null, 81, 84, 88, null, 86, 84],
      [81, 79, 77, 81, 79, 77, 76, 74],
      [79, null, 74, null, 79, 81, 83, null],
    ],
    play(m, step, t, sd) {
      const bar = Math.floor(step / 16);
      const s = step % 16;
      const chord = this.chords[bar % 4];
      if (s === 0 || s === 8 || (s === 11 && bar % 2 === 1)) m.kick(t, 0.5);
      if (s === 4 || s === 12) m.snare(t, 0.16);
      if (s % 2 === 0) m.hat(t, s % 4 === 2 ? 0.07 : 0.035);
      if (s === 0 || s === 3 || s === 8 || s === 11) {
        m.note(chord[0] + (s === 3 || s === 11 ? 12 : 0), t, sd * 2.2, { type: 'triangle', vol: 0.3 });
      }
      if (s === 4 || s === 12) for (const n of chord.slice(1)) m.note(n, t, sd * 1.4, { type: 'square', vol: 0.025 });
      if (s % 2 === 0) {
        const n = this.melody[bar][s / 2];
        if (n) {
          m.note(n, t, sd * 1.8, { type: 'triangle', vol: 0.13 });
          m.note(n + 12, t, sd * 1.2, { type: 'sine', vol: 0.03 });
        }
      }
    },
  },
};

export class Music {
  constructor(audio) {
    this.audio = audio;
    this.wanted = null;
    this.name = null;
    this.track = null;
    this.bus = null;
    this.timer = 0;
    this.step = 0;
    this.nextTime = 0;
    this.tempo = 1;
  }

  get ctx() {
    return this.audio.ctx;
  }

  /** Called once the audio context exists (after the first user gesture). */
  onUnlock() {
    if (this.wanted) this.start(this.wanted);
  }

  /** Switches to a track; does nothing if it is already playing. */
  play(name) {
    this.wanted = name;
    if (!this.ctx || (this.name === name && this.timer)) return;
    this.start(name);
  }

  stop(fade = 0.6) {
    this.wanted = null;
    this.release(fade);
  }

  /** 1 = normal speed; the game speeds up for the final seconds. */
  setTempo(factor) {
    this.tempo = factor;
  }

  /** Quieter music while the game is paused. */
  duck(on) {
    if (!this.bus) return;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(on ? 0.3 : 1, t, 0.15);
  }

  start(name) {
    this.release(0.5);
    const ctx = this.ctx;
    this.track = TRACKS[name];
    this.name = name;
    this.step = 0;
    this.tempo = 1;
    this.bus = ctx.createGain();
    this.bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
    this.bus.connect(this.audio.musicBus);
    this.nextTime = ctx.currentTime + 0.12;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  release(fade) {
    clearInterval(this.timer);
    this.timer = 0;
    this.name = null;
    const bus = this.bus;
    this.bus = null;
    if (!bus) return;
    const t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), t);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => bus.disconnect(), (fade + 0.3) * 1000);
  }

  schedule() {
    const ctx = this.ctx;
    if (!this.bus || ctx.state !== 'running') return;
    // After the tab was throttled, skip ahead instead of firing a burst of old notes.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    const sixteenth = 60 / (this.track.bpm * this.tempo) / 4;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.track.play(this, this.step, this.nextTime, sixteenth);
      this.step = (this.step + 1) % (this.track.bars * 16);
      this.nextTime += sixteenth;
    }
  }

  // ------------------------------------------------------------ instruments

  note(midi, time, duration, { type = 'triangle', vol = 0.1, attack = 0.008 } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq(midi), time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(this.bus);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  bell(midi, time, vol = 0.08) {
    this.note(midi, time, 1.2, { type: 'sine', vol });
    this.note(midi + 12, time, 0.6, { type: 'sine', vol: vol * 0.35 });
  }

  kick(time, vol = 0.5) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(gain).connect(this.bus);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  snare(time, vol = 0.16) {
    this.noiseHit(time, 0.14, vol, 'bandpass', 1800);
    this.note(55, time, 0.06, { type: 'triangle', vol: vol * 0.8, attack: 0.002 });
  }

  hat(time, vol = 0.06) {
    this.noiseHit(time, 0.04, vol, 'highpass', 7000);
  }

  noiseHit(time, duration, vol, type, frequency) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.audio.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter).connect(gain).connect(this.bus);
    source.start(time, Math.random() * 0.5);
    source.stop(time + duration + 0.02);
  }
}
