// Injected before any page script: virtual time for frame-exact video capture.
// Time only moves when window.__advance(ms) is called: timers fire in order,
// CSS / Web Animations are stepped by hand, then requestAnimationFrame
// callbacks run (the game renders one frame). Math.random is seeded so every
// render of the video is identical.
(() => {
  let seed = 20261005;
  Math.random = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const real = {
    now: performance.now.bind(performance),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
  };
  window.__real = real;

  let vnow = real.now();
  const dateOffset = Date.now() - vnow;
  performance.now = () => vnow;
  Date.now = () => Math.round(vnow + dateOffset);

  let rafs = [];
  let rafId = 0;
  window.requestAnimationFrame = (cb) => {
    rafs.push({ id: ++rafId, cb });
    return rafId;
  };
  window.cancelAnimationFrame = (id) => {
    rafs = rafs.filter((r) => r.id !== id);
  };

  let timers = [];
  let timerId = 0;
  const addTimer = (cb, ms, args, every) => {
    const id = ++timerId;
    timers.push({ id, at: vnow + Math.max(every ? 1 : 0, Number(ms) || 0), cb, args, every });
    return id;
  };
  const clearTimer = (id) => {
    timers = timers.filter((t) => t.id !== id);
  };
  window.setTimeout = (cb, ms, ...args) => addTimer(cb, ms, args, 0);
  window.setInterval = (cb, ms, ...args) => addTimer(cb, ms, args, Math.max(1, Number(ms) || 1));
  window.clearTimeout = clearTimer;
  window.clearInterval = clearTimer;

  /** Runs `fn` with the real clock and timers (e.g. three.js compileAsync polls with setTimeout). */
  window.__withRealTime = async (fn) => {
    const saved = [window.setTimeout, window.clearTimeout];
    window.setTimeout = real.setTimeout;
    window.clearTimeout = real.clearTimeout;
    try {
      return await fn();
    } finally {
      [window.setTimeout, window.clearTimeout] = saved;
    }
  };

  const managed = new WeakSet();
  function stepAnimations(ms) {
    for (const a of document.getAnimations()) {
      if (!managed.has(a)) {
        managed.add(a);
        a.pause();
        a.currentTime = 0;
      }
      const end = a.effect?.getComputedTiming().endTime ?? Infinity;
      const next = (Number(a.currentTime) || 0) + ms * (a.playbackRate || 1);
      if (Number.isFinite(end) && next >= end) {
        if (a.playState !== 'finished') {
          a.currentTime = end;
          a.finish();
        }
      } else {
        a.currentTime = next;
      }
    }
  }

  window.__advance = (ms) => {
    const target = vnow + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const t = timers[0];
      if (!t || t.at > target) break;
      vnow = Math.max(vnow, t.at);
      if (t.every) t.at += t.every;
      else timers.shift();
      try {
        if (typeof t.cb === 'function') t.cb(...t.args);
      } catch (err) {
        console.error(err);
      }
    }
    vnow = target;
    stepAnimations(ms);
    const due = rafs;
    rafs = [];
    for (const r of due) {
      try {
        r.cb(vnow);
      } catch (err) {
        console.error(err);
      }
    }
  };
})();
