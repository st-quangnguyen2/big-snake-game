// Promo-video director. Runs inside the game page (opened with ?film, after
// shim.js). setup() starts a round; every step() advances exactly one video
// frame. Scenes follow the 60-second script; sounds the game makes are logged
// with their video time so renderAudio() can mix the soundtrack afterwards.
window.__promo = (() => {
  const FPS = 30;
  const DT = 1000 / FPS;
  const { game: G, settings: S, audio: A } = window.__game;
  const lang = document.documentElement.lang === 'vi' ? 'vi' : 'en';
  const L = (vi, en) => (lang === 'vi' ? vi : en);
  let tr;
  let SKINS;
  let HEAD_STYLES;
  let THEMES;

  let frame = 0;
  let recording = false;
  const now = () => frame / FPS;
  const events = [];
  const sceneLog = [];

  // ------------------------------------------------------------ sound log
  const SFX = ['eat', 'catch', 'golden', 'goldenAppear', 'collect', 'hit', 'boost', 'mud', 'rustle', 'startle', 'hiss', 'tick', 'gameOver'];
  for (const name of SFX) A[name] = (...args) => { if (recording) events.push({ t: now(), kind: 'sfx', name, args }); };
  for (const name of ['click', 'pause', 'unpause', 'beep', 'unlock', 'suspend', 'resume']) A[name] = () => {};
  for (const name of ['play', 'stop', 'setTempo', 'duck']) A.music[name] = () => {};
  const music = (name, ...args) => events.push({ t: now(), kind: 'music', name, args });

  // ------------------------------------------------------------ input
  const input = { turn: 0, boost: false, look: 0 };
  const gameOnFrame = G.hooks.onFrame;
  G.hooks.onFrame = (t) => {
    gameOnFrame(t);
    return { ...input };
  };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function steerTo(x, z, gain = 1.8) {
    const { head, heading } = G.snake;
    return Math.max(-1, Math.min(1, -wrap(Math.atan2(x - head.x, z - head.z) - heading) * gain));
  }
  const smooth = (a, b, t) => {
    const k = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  /** 0 → 1 (from a to b), hold, 1 → 0 (from c to d). */
  const pulse = (t, a, b, c, d) => smooth(a, b, t) * (1 - smooth(c, d, t));

  // ------------------------------------------------------------ world & camera
  async function world(options) {
    G.setWorldOptions(options);
    await compile();
  }
  const compile = () => window.__withRealTime(() => G.renderer.compileAsync(G.scene, G.camera));

  /** Moves the snake for a new shot and keeps prey out of the first stretch of its path. */
  function place(x, z, heading, length = 14) {
    G.snake.reset(x, z, heading, length);
    G.camHeading = heading;
    G.snapCamera = true;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const inLane = (p) => {
      const dx = p.position.x - x;
      const dz = p.position.z - z;
      const along = dx * fx + dz * fz;
      return Math.hypot(dx, dz) < 4 || (along > -2 && along < 30 && Math.abs(dx * fz - dz * fx) < 3);
    };
    for (let i = G.prey.length - 1; i >= 0; i--) {
      const p = G.prey[i];
      if (p.extra || !inLane(p)) continue;
      G.removePrey(i);
      for (let attempt = 0; attempt < 8; attempt++) {
        const q = G.spawn(p.kind);
        if (!inLane(q)) break;
        G.removePrey(G.prey.indexOf(q));
      }
    }
  }

  const CHASE = { near: 0, far: 0.4, top: 0.85, first: 0 };
  function cut({ hud = 'full', view = 'near', film = null, timeScale = 1, autopilot = false } = {}) {
    document.body.dataset.hud = hud;
    G.view = view;
    G.lockedCamera = null;
    G.camView = CHASE[view];
    G.firstPerson = view === 'first' ? 1 : 0;
    G.film.camera = film;
    G.film.timeScale = timeScale;
    G.film.autopilot = autopilot;
    G.snapCamera = true;
    Object.assign(input, { turn: 0, boost: false, look: 0 });
  }

  // ------------------------------------------------------------ overlay
  const style = document.createElement('style');
  style.textContent = `
    #promo { position: fixed; inset: 0; z-index: 60; pointer-events: none; font-family: 'Baloo 2', system-ui, sans-serif; color: #fff; }
    .film-panel, #hud-hint, #hud-warn { display: none !important; }
    .pf-black { position: absolute; inset: 0; background: #000; opacity: 0; }
    .pf-cap { position: absolute; left: 50%; bottom: 7%; padding: 10px 30px 7px; border-radius: 22px; background: rgba(10, 30, 17, 0.84);
      font-size: 42px; font-weight: 800; line-height: 1.15; white-space: nowrap; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3); transform: translateX(-50%); }
    .pf-cap b { color: #ffd84a; }
    .pf-cap.small { bottom: 18.5%; padding: 7px 20px 5px; border-radius: 16px; font-size: 24px; font-weight: 700; background: rgba(10, 30, 17, 0.72); }
    .pf-chip { position: absolute; left: 50%; top: 6%; padding: 6px 26px 3px; border-radius: 999px; background: #ffd84a; color: #17331f;
      font-size: 32px; font-weight: 800; white-space: nowrap; box-shadow: 0 5px 0 #e2b317, 0 12px 28px rgba(0, 0, 0, 0.28); transform: translateX(-50%); }
    .pf-side { position: absolute; left: 0; top: 0; bottom: 0; width: 48%;
      background: linear-gradient(90deg, rgba(7, 22, 13, 0.94) 0%, rgba(7, 22, 13, 0.82) 62%, rgba(7, 22, 13, 0) 100%); }
    .pf-face { position: absolute; padding: 34px 16px 14px; border-radius: 28px; background: rgba(8, 24, 14, 0.88);
      border: 2px solid rgba(140, 255, 150, 0.35); box-shadow: 0 16px 44px rgba(0, 0, 0, 0.38); }
    .pf-face svg { display: block; width: 100%; height: auto; }
    .pf-face .tag { position: absolute; top: 9px; left: 18px; font-size: 15px; font-weight: 800; letter-spacing: 1.5px; color: #8cff96; }
    .pf-face .tag::before { content: ''; display: inline-block; width: 9px; height: 9px; margin: 0 7px 1px 0; border-radius: 50%; background: #ff5a5a; box-shadow: 0 0 8px #ff5a5a; }
    .pf-face .corner { position: absolute; width: 26px; height: 26px; border: 3px solid rgba(140, 255, 150, 0.8); }
    .pf-face .c1 { top: 30px; left: 12px; border-right: 0; border-bottom: 0; border-radius: 8px 0 0 0; }
    .pf-face .c2 { top: 30px; right: 12px; border-left: 0; border-bottom: 0; border-radius: 0 8px 0 0; }
    .pf-face .c3 { bottom: 64px; left: 12px; border-right: 0; border-top: 0; border-radius: 0 0 0 8px; }
    .pf-face .c4 { bottom: 64px; right: 12px; border-left: 0; border-top: 0; border-radius: 0 0 8px 0; }
    .pf-gauge { position: relative; height: 12px; margin: 12px 10px 0; border-radius: 6px; background: rgba(255, 255, 255, 0.14); }
    .pf-gauge::before, .pf-gauge::after { position: absolute; top: 50%; transform: translateY(-50%); font-size: 14px; color: rgba(255, 255, 255, 0.5); }
    .pf-gauge::before { content: '◀'; left: -2px; } .pf-gauge::after { content: '▶'; right: -2px; }
    .pf-knob { position: absolute; top: 50%; left: 50%; width: 24px; height: 24px; border-radius: 50%; background: #ffd84a;
      box-shadow: 0 0 14px rgba(255, 216, 74, 0.9); transform: translate(-50%, -50%); }
    .pf-face .lbl { margin-top: 10px; text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 1px; color: rgba(255, 255, 255, 0.38); }
    .pf-face .lbl.on { color: #ffd84a; text-shadow: 0 0 14px rgba(255, 216, 74, 0.7); }
    .pf-nos { position: absolute; left: 50%; top: 12%; display: flex; gap: 26px; transform: translateX(-50%); }
    .pf-no { position: relative; display: grid; place-items: center; width: 104px; height: 104px; border-radius: 28px; background: #fffdf5;
      font-size: 62px; box-shadow: 0 6px 0 #d9d2b8, 0 14px 30px rgba(0, 0, 0, 0.3); }
    .pf-no::after { content: ''; position: absolute; width: 112px; height: 10px; border-radius: 5px; background: #ff4d4d; transform: rotate(-45deg);
      box-shadow: 0 0 0 4px #fffdf5; }
    .pf-logo { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.05) 25%, rgba(0, 0, 0, 0.5) 100%); }
    .pf-logo .icon { font-size: 130px; line-height: 1; filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.35)); }
    .pf-logo .name { margin-top: 4px; font-size: 112px; font-weight: 800; line-height: 1; letter-spacing: 1px;
      text-shadow: 0 7px 0 #2a8a37, 0 16px 36px rgba(0, 0, 0, 0.45); }
    .pf-logo .tagline { margin-top: 26px; padding: 8px 34px 4px; border-radius: 999px; background: #ffd84a; color: #17331f;
      font-size: 44px; font-weight: 800; box-shadow: 0 6px 0 #e2b317, 0 16px 34px rgba(0, 0, 0, 0.32); }
    .pf-confetti { position: absolute; top: -30px; width: 14px; height: 22px; border-radius: 3px; }
    .pf-logo.dim { background: radial-gradient(ellipse at center, rgba(6, 18, 10, 0.72) 25%, rgba(4, 10, 6, 0.9) 100%); }
    .pf-top { position: absolute; left: 0; right: 0; top: 0; height: 44%;
      background: linear-gradient(180deg, rgba(7, 22, 13, 0.94) 0%, rgba(7, 22, 13, 0.8) 62%, rgba(7, 22, 13, 0) 100%); }
    /* 9:16: keep text clear of the app buttons and captions at the bottom of TikTok / Reels / Shorts. */
    #promo.tall .pf-cap { bottom: 22%; width: max-content; max-width: 88%; font-size: 38px; text-align: center; white-space: normal; }
    #promo.tall .pf-chip { top: 9%; font-size: 30px; }
    #promo.tall .pf-logo .icon { font-size: 110px; }
    #promo.tall .pf-logo .name { font-size: 80px; }
    #promo.tall .pf-logo .tagline { font-size: 34px; }
  `;
  document.head.append(style);
  const layer = document.createElement('div');
  layer.id = 'promo';
  if (innerHeight > innerWidth) layer.classList.add('tall');
  const black = document.createElement('div');
  black.className = 'pf-black';
  layer.append(black);
  document.body.append(layer);

  const el = (cls, html = '') => {
    const e = document.createElement('div');
    e.className = cls;
    e.innerHTML = html;
    return e;
  };
  const POP = 'cubic-bezier(0.2, 1.5, 0.4, 1)';
  const popIn = (e, from = 'translate(-50%, 34px) scale(0.86)', to = 'translate(-50%, 0) scale(1)', delay = 0) =>
    e.animate([{ transform: from, opacity: 0 }, { transform: to, opacity: 1 }], { duration: 420, delay, easing: POP, fill: 'both' });

  // ------------------------------------------------------------ cues
  /** A timed overlay inside the current scene: shown at `at`, faded out at `until` (scene seconds). */
  const cue = (at, until, make) => ({ at, until, make, node: null, done: false, leaving: false });
  const cap = (html, at, until = 99, cls = '') => cue(at, until, () => {
    const e = el(`pf-cap ${cls}`, html);
    popIn(e);
    return e;
  });
  const chip = (html, at, until = 99) => cue(at, until, () => {
    const e = el('pf-chip', html);
    popIn(e, 'translate(-50%, -20px) scale(0.7)');
    return e;
  });

  function runCues(scene, t) {
    for (const c of scene.cues) {
      if (!c.node && !c.done && t >= c.at) {
        c.node = c.make();
        layer.append(c.node);
      }
      if (c.node && !c.leaving && t >= c.until - 0.25) {
        c.leaving = true;
        c.node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards', composite: 'replace' });
      }
      if (c.node && t >= c.until) {
        c.node.remove();
        c.node = null;
        c.done = true;
      }
    }
  }

  // ------------------------------------------------------------ the player's face (illustration)
  const DOTS = [
    [-30, -2], [-14, -2], [-22, -10], [-22, 6], [14, -2], [30, -2], [22, -10], [22, 6],
    [0, 8], [0, 20], [-16, 32], [0, 40], [16, 32], [0, 30],
    [-44, 18], [-36, 42], [-18, 58], [0, 62], [18, 58], [36, 42], [44, 18],
    [-34, -20], [-22, -25], [-10, -21], [10, -21], [22, -25], [34, -20], [-20, -42], [0, -46], [20, -42], [-42, 0], [42, 0],
  ];
  function makeFace(width, label = '') {
    const root = el('pf-face', `
      <div class="tag">CAMERA · AI</div>
      <span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span>
      <svg viewBox="0 0 240 250">
        <defs><radialGradient id="pfskin" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#ffdcbc"/><stop offset="1" stop-color="#eeb48a"/></radialGradient></defs>
        <path d="M14 252 C 24 202 70 186 120 186 C 170 186 216 202 226 252 Z" fill="#3fb54a"/>
        <path d="M94 188 Q120 212 146 188" stroke="#2a8a37" stroke-width="7" fill="none" stroke-linecap="round"/>
        <rect x="101" y="150" width="38" height="44" rx="14" fill="#e3a77d"/>
        <g class="head">
          <ellipse class="earL" cx="-58" cy="6" rx="11" ry="17" fill="#f0bd95"/>
          <ellipse class="earR" cx="58" cy="6" rx="11" ry="17" fill="#f0bd95"/>
          <ellipse class="skull" cx="0" cy="0" rx="58" ry="66" fill="url(#pfskin)"/>
          <path class="hair" d="M-61 -6 C -64 -60 -30 -80 2 -78 C 42 -78 66 -54 61 -6 C 52 -30 32 -46 4 -47 C -24 -47 -48 -32 -61 -6 Z" fill="#3b2a1f"/>
          <g class="feat">
            <path d="M-34 -19 q12 -8 24 0" stroke="#3b2a1f" stroke-width="5" fill="none" stroke-linecap="round"/>
            <path d="M10 -19 q12 -8 24 0" stroke="#3b2a1f" stroke-width="5" fill="none" stroke-linecap="round"/>
            <ellipse cx="-22" cy="-2" rx="7" ry="9" fill="#17331f"/><ellipse cx="22" cy="-2" rx="7" ry="9" fill="#17331f"/>
            <circle cx="-20" cy="-5" r="2.4" fill="#fff"/><circle cx="24" cy="-5" r="2.4" fill="#fff"/>
            <path d="M0 6 q-6 13 2 15" stroke="#d4926a" stroke-width="4" fill="none" stroke-linecap="round"/>
            <path d="M-17 32 q17 14 34 0" stroke="#a5503a" stroke-width="5" fill="none" stroke-linecap="round"/>
            <circle cx="-36" cy="18" r="9" fill="#ff8f8f" opacity="0.35"/><circle cx="36" cy="18" r="9" fill="#ff8f8f" opacity="0.35"/>
            <g class="dots">${DOTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.3" fill="#8cff96"/>`).join('')}</g>
          </g>
        </g>
      </svg>
      <div class="pf-gauge"><div class="pf-knob"></div></div>
      <div class="lbl">${label}</div>`);
    root.style.width = `${width}px`;
    const q = (s) => root.querySelector(s);
    const parts = { head: q('.head'), feat: q('.feat'), skull: q('.skull'), hair: q('.hair'), earL: q('.earL'), earR: q('.earR'), knob: q('.pf-knob'), lbl: q('.lbl'), dots: q('.dots') };
    let blink = 0;
    return {
      root,
      /** yaw: -1 (turned to screen-left) … 1; pitch: -1 (chin up) … 1 (nodding down). */
      pose(yaw, pitch = 0, active = false) {
        const ay = Math.abs(yaw);
        parts.head.setAttribute('transform', `translate(${120 + yaw * 7} ${104 + pitch * 7}) rotate(${yaw * -5})`);
        parts.feat.setAttribute('transform', `translate(${yaw * 22} ${pitch * 15}) scale(${1 - ay * 0.1} ${1 - Math.abs(pitch) * 0.08})`);
        parts.skull.setAttribute('rx', 58 - ay * 5);
        parts.hair.setAttribute('transform', `translate(${yaw * 7} ${pitch * 5})`);
        parts.earL.setAttribute('opacity', yaw < 0 ? 1 + yaw * 0.95 : 1);
        parts.earR.setAttribute('opacity', yaw > 0 ? 1 - yaw * 0.95 : 1);
        parts.earL.setAttribute('cx', -58 + yaw * 8);
        parts.earR.setAttribute('cx', 58 + yaw * 8);
        parts.knob.style.left = `${50 + yaw * 44}%`;
        parts.lbl.classList.toggle('on', active);
        blink = (blink + 1) % 18;
        parts.dots.setAttribute('opacity', blink < 9 ? 0.95 : 0.7);
      },
    };
  }

  /** A face card placed in the scene; removed when the scene ends. */
  function faceCard(width, label, place) {
    const face = makeFace(width, label);
    Object.assign(face.root.style, place);
    face.root.classList.add('pf-scene');
    layer.append(face.root);
    face.root.animate([{ opacity: 0, transform: `${place.transform ?? ''} scale(0.9)` }, { opacity: 1, transform: `${place.transform ?? ''} scale(1)` }],
      { duration: 380, easing: POP, fill: 'both' });
    face.pose(0, 0);
    return face;
  }

  function logo(at, dim = false) {
    return cue(at, 99, () => {
      const e = el(dim ? 'pf-logo dim' : 'pf-logo', `<div class="icon">🐍</div><div class="name">Big Snake 3D</div><div class="tagline">${L('Chơi bằng cái đầu!', 'Use your head!')}</div>`);
      e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'both' });
      e.querySelector('.icon').animate([
        { transform: 'scale(0) rotate(-30deg)' }, { transform: 'scale(1.18) rotate(8deg)', offset: 0.6 }, { transform: 'scale(1) rotate(0)' },
      ], { duration: 650, easing: 'ease-out', fill: 'both' });
      e.querySelector('.name').animate([{ transform: 'translateY(40px) scale(0.8)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 520, delay: 160, easing: POP, fill: 'both' });
      e.querySelector('.tagline').animate([{ transform: 'translateY(30px) scale(0.7)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 480, delay: 620, easing: POP, fill: 'both' });
      return e;
    });
  }

  function noControllers(at) {
    return cue(at, 99, () => {
      const e = el('pf-nos', ['🎮', '⌨️', '🖱️'].map((icon) => `<div class="pf-no">${icon}</div>`).join(''));
      [...e.children].forEach((c, i) => c.animate([{ transform: 'scale(0) rotate(-20deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, delay: i * 140, easing: POP, fill: 'both' }));
      e.style.transform = 'translateX(-50%)';
      return e;
    });
  }

  function confetti(at) {
    return cue(at, 99, () => {
      const box = el('');
      box.style.cssText = 'position:absolute;inset:0;overflow:hidden';
      const colors = ['#ffd84a', '#3fb54a', '#ff7eb6', '#42a5f5', '#ff9800', '#ffffff', '#b388ff'];
      for (let i = 0; i < 90; i++) {
        const c = el('pf-confetti');
        c.style.left = `${Math.random() * 100}%`;
        c.style.background = colors[i % colors.length];
        const drift = (Math.random() - 0.5) * 260;
        const spin = (Math.random() - 0.5) * 1440;
        c.animate([{ transform: 'translate(0, 0) rotate(0)' }, { transform: `translate(${drift}px, ${innerHeight + 80}px) rotate(${spin}deg)` }],
          { duration: 1800 + Math.random() * 1400, delay: Math.random() * 500, easing: 'cubic-bezier(0.25, 0.6, 0.5, 1)', fill: 'both' });
        box.append(c);
      }
      return box;
    });
  }

  // ------------------------------------------------------------ scenes
  const once = (scene, key, when, fn) => {
    if (when && !scene.flags[key]) {
      scene.flags[key] = true;
      return fn();
    }
    return undefined;
  };
  const FRUIT_TRAIL = ['apple', 'orange', 'banana', 'grape', 'watermelon'];
  const trail = (types, from = 4) => types.forEach((type, i) => G.spawnAhead('fruit', type, from + i * 2.5));

  const SCENES = [
    {
      name: 'hook',
      async setup() {
        place(0, -11, 0, 14);
        cut({ hud: 'none', view: 'near' });
        G.camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.21, 0, innerWidth, innerHeight);
        const side = el('pf-side pf-scene');
        layer.append(side);
        this.face = faceCard(340, '', { left: '6.5%', top: '50%', transform: 'translateY(-54%)' });
        this.cues = [cap(L('Quay đầu. <b>Rắn rẽ theo.</b>', 'Turn your head. <b>The snake follows.</b>'), 0.3)];
      },
      update(t) {
        black.style.opacity = String(1 - smooth(0, 0.4, t));
        const yaw = -pulse(t, 0.35, 0.65, 1.35, 1.65) + pulse(t, 1.9, 2.2, 2.9, 3.2);
        this.face.pose(yaw, 0, Math.abs(yaw) > 0.5);
        input.turn = yaw;
      },
      end: (t) => t >= 3.5,
      teardown() {
        G.camera.clearViewOffset();
      },
    },
    {
      name: 'handsfree',
      setup() {
        place(-12, -10, 0.3, 16);
        cut({ hud: 'clean', view: 'near', autopilot: true });
        this.face = faceCard(190, '', { left: '2.5%', top: '5%' });
        this.cues = [
          noControllers(0.25),
          cap(L('Không tay cầm. Không bàn phím.', 'No controller. No keyboard.'), 0.35),
          cap(L('🧠 AI nhận diện khuôn mặt — chạy ngay trên máy bạn', '🧠 Face-tracking AI — runs right on your device'), 1.3, 99, 'small'),
        ];
      },
      update() {
        const yaw = Math.max(-1, Math.min(1, G.snake.turnVelocity * 1.3));
        this.face.pose(yaw, 0, Math.abs(yaw) > 0.4);
      },
      end: (t) => t >= 3.7,
    },
    {
      name: 'title',
      setup() {
        cut({ hud: 'none', film: 'flyover', autopilot: true });
        G.filmTime = 52;
        this.cues = [logo(0.15)];
      },
      end: (t) => t >= 3.6,
    },
    {
      name: 'combo',
      setup() {
        place(-22, 0, Math.PI / 2, 12);
        cut({ hud: 'full', view: 'near' });
        this.cues = [cap(L('Ăn liên tục — nhân điểm tới <b>×3</b>', 'Chain your bites — up to <b>×3</b> points'), 0.8)];
      },
      update(t) {
        once(this, 'trail1', t >= 0.05, () => trail(FRUIT_TRAIL));
        once(this, 'trail2', t >= 2.9, () => trail(['strawberry', 'apple', 'orange', 'banana', 'grape']));
      },
      end: (t) => t >= 6,
    },
    {
      name: 'rabbit',
      setup() {
        place(0, -17, 0, 14);
        cut({ hud: 'full', view: 'near' });
        this.before = G.stats.caught.rabbit;
        this.caughtAt = null;
        this.face = faceCard(190, L('⚡ CÚI ĐẦU', '⚡ NOD'), { left: '2.5%', top: '30%' });
        this.cues = [
          cap(L('Thỏ chạy nhanh lắm đấy…', 'Rabbits are fast…'), 0.3, 1.6),
          cap(L('<b>Cúi đầu</b> để tăng tốc!', '<b>Nod</b> to boost!'), 1.65),
        ];
      },
      update(t) {
        once(this, 'spawn', t >= 0.1, () => { this.rabbit = G.spawnAhead('animal', 'rabbit', 9); });
        const alive = this.rabbit && G.prey.includes(this.rabbit);
        input.turn = alive ? steerTo(this.rabbit.position.x, this.rabbit.position.z) : 0;
        input.boost = alive && t >= 1.65;
        if (this.caughtAt === null && G.stats.caught.rabbit > this.before) this.caughtAt = t;
        const nod = this.caughtAt === null ? smooth(1.5, 1.75, t) : 1 - smooth(this.caughtAt + 0.2, this.caughtAt + 0.5, t);
        this.face.pose(0, nod, nod > 0.5);
      },
      end(t) {
        return (this.caughtAt !== null && t >= this.caughtAt + 1.5) || t >= 9;
      },
    },
    {
      name: 'golden',
      setup() {
        place(14, -8, -Math.PI / 2, 14);
        cut({ hud: 'full', view: 'near' });
        this.before = G.stats.golden;
        this.eatenAt = null;
        this.cues = [cap(L('Táo vàng = <b>100 điểm</b>', 'Golden apple = <b>100 points</b>'), 0.7)];
      },
      update(t) {
        once(this, 'spawn', t >= 0.25, () => { this.apple = G.spawnAhead('fruit', 'golden', 10); });
        const alive = this.apple && G.prey.includes(this.apple);
        input.turn = alive ? steerTo(this.apple.position.x, this.apple.position.z) : 0;
        if (this.eatenAt === null && G.stats.golden > this.before) this.eatenAt = t;
      },
      end(t) {
        return (this.eatenAt !== null && t >= this.eatenAt + 1.3) || t >= 6;
      },
    },
    {
      name: 'world',
      setup() {
        place(-10, 5.5, Math.PI, 16);
        cut({ hud: 'none', film: 'side', timeScale: 0.5 });
        this.cues = [cap(L('Cỏ rẽ lối. Hoa nghiêng mình.', 'Grass parts. Flowers bow.'), 0.5, 6.85)];
      },
      update(t) {
        once(this, 'shotB', t >= 3.5, () => {
          place(0.5, -12, Math.PI / 2, 16);
          G.snapCamera = true;
        });
        input.turn = t < 3.5 ? steerTo(-10, -2) : steerTo(6, -12);
      },
      end: (t) => t >= 7,
    },
    {
      name: 'themes',
      setup() {
        place(6, -2, 0, 18);
        cut({ hud: 'clean', view: 'near' });
        this.face = faceCard(190, L('👀 NGẨNG ĐẦU', '👀 CHIN UP'), { left: '2.5%', top: '5%' });
        const steps = [
          [2.2, { theme: 'autumn', night: false }], [3.22, { theme: 'winter', night: false }], [4.24, { theme: 'desert', night: false }],
          [5.26, { theme: 'candy', night: false }], [6.28, { theme: 'meadow', night: true }],
        ];
        this.steps = steps;
        const name = (o) => (o.night ? `🌙 ${L('Ban đêm', 'Night')}` : `${THEMES[o.theme].emoji} ${tr(THEMES[o.theme].name)}`);
        this.cues = [
          cap(L('<b>Ngẩng đầu</b> — nhìn toàn cảnh', '<b>Chin up</b> — see the whole arena'), 0.3, 2.15),
          cap(L('5 thế giới · <b>Ngày & đêm</b>', '5 worlds · <b>Day & night</b>'), 2.25),
          ...steps.map(([at, o], i) => chip(name(o), at, steps[i + 1]?.[0] ?? 99)),
        ];
      },
      async update(t) {
        const look = smooth(0.4, 1.5, t);
        input.look = look;
        // Lap around the middle of the arena so the overview stays centred on it.
        const a = Math.atan2(G.snake.head.z + 2, G.snake.head.x - 1) + 0.9;
        input.turn = steerTo(1 + Math.cos(a) * 5, -2 + Math.sin(a) * 5);
        once(this, 'hudOff', t >= 2.1, () => { document.body.dataset.hud = 'none'; });
        if (t < 2.1) this.face.pose(0, -look, look > 0.5);
        once(this, 'hideFace', t >= 2.1, () => this.face.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }));
        for (const [at, options] of this.steps) {
          const promise = once(this, `w${at}`, t >= at, () => world(options));
          if (promise) await promise;
        }
      },
      end: (t) => t >= 8,
    },
    {
      name: 'style',
      async setup() {
        await world({ theme: 'meadow', night: false });
        place(-22, 0, Math.PI / 2, 12);
        cut({ hud: 'none', film: 'side' });
        this.looks = [['fire', 'king'], ['ocean', 'cool'], ['candy', 'party'], ['galaxy', 'dragon'], ['tiger', 'cat'], ['rainbow', 'bow']];
        const label = ([s, h]) => `${tr(SKINS[s].name)} · ${HEAD_STYLES[h].emoji} ${tr(HEAD_STYLES[h].name)}`;
        this.cues = [
          cap(L('Rắn của bạn, <b>phong cách của bạn</b>', 'Your snake, <b>your style</b>'), 0.3),
          ...this.looks.map((look, i) => chip(label(look), 0.5 + i, i < this.looks.length - 1 ? 1.5 + i : 99)),
        ];
      },
      update(t) {
        this.looks.forEach(([skin, head], i) => once(this, `look${i}`, t >= 0.5 + i, () => {
          G.snake.setAppearance(skin, head);
          const p = G.snake.head.clone();
          p.y += 0.6;
          p.y += 0.5;
          G.particles.burst(p, SKINS[skin].base, 12, 3.5, 0.09);
          G.particles.burst(p, '#ffd84a', 8, 4.5, 0.06);
          A.collect();
        }));
      },
      end: (t) => t >= 6.4,
      teardown() {
        G.snake.setAppearance('green', 'classic');
      },
    },
    {
      name: 'climax',
      setup() {
        place(-22, 0, Math.PI / 2, 16);
        cut({ hud: 'full', view: 'near' });
        G.stats.timeLeft = 3.95;
        G.lastSecond = 4;
        music('tempo', 1.15);
        this.overAt = null;
        this.cues = [];
      },
      update(t) {
        once(this, 'trail', t >= 0.05, () => trail(FRUIT_TRAIL));
        if (this.overAt === null && G.mode === 'over') {
          this.overAt = t;
          this.cues.push(confetti(t + 0.95));
        }
        once(this, 'sparkle', this.overAt !== null && t >= this.overAt + 0.95, () => A.goldenAppear());
      },
      end(t) {
        return this.overAt !== null && t >= this.overAt + 3.2;
      },
    },
    {
      name: 'logo',
      async setup() {
        document.getElementById('screen-over').classList.add('hidden');
        await world({ theme: 'meadow', night: true });
        cut({ hud: 'none', film: 'flyover' });
        G.filmTime = 160;
        this.cues = [logo(0.2)];
      },
      update(t) {
        black.style.opacity = String(smooth(3.1, 4, t));
      },
      end: (t) => t >= 4,
    },
  ];

  /** 15-second vertical cut: hook → nod & catch → themes → record + logo. */
  const SHORT = [
    {
      name: 'hook',
      setup() {
        place(0, -11, 0, 14);
        cut({ hud: 'none', view: 'near' });
        G.camera.setViewOffset(innerWidth, innerHeight, 0, -innerHeight * 0.17, innerWidth, innerHeight);
        layer.append(el('pf-top pf-scene'));
        this.face = faceCard(300, '', { left: '50%', top: '5%', transform: 'translateX(-50%)' });
        this.cues = [cap(L('Quay đầu. <b>Rắn rẽ theo.</b>', 'Turn your head. <b>The snake follows.</b>'), 0.25)];
      },
      update(t) {
        black.style.opacity = String(1 - smooth(0, 0.3, t));
        const yaw = -pulse(t, 0.3, 0.55, 1.2, 1.45) + pulse(t, 1.6, 1.85, 2.5, 2.75);
        this.face.pose(yaw, 0, Math.abs(yaw) > 0.5);
        input.turn = yaw;
      },
      end: (t) => t >= 3,
      teardown() {
        G.camera.clearViewOffset();
      },
    },
    {
      name: 'rabbit',
      setup() {
        place(0, -17, 0, 14);
        cut({ hud: 'full', view: 'near' });
        this.before = G.stats.caught.rabbit;
        this.caughtAt = null;
        this.face = faceCard(170, L('⚡ CÚI ĐẦU', '⚡ NOD'), { left: '3%', top: '16%' });
        this.cues = [cap(L('<b>Cúi đầu</b> để tăng tốc!', '<b>Nod</b> to boost!'), 0.2)];
      },
      update(t) {
        once(this, 'spawn', t >= 0.05, () => { this.rabbit = G.spawnAhead('animal', 'rabbit', 8); });
        const alive = this.rabbit && G.prey.includes(this.rabbit);
        input.turn = alive ? steerTo(this.rabbit.position.x, this.rabbit.position.z) : 0;
        input.boost = alive && t >= 0.5;
        if (this.caughtAt === null && G.stats.caught.rabbit > this.before) this.caughtAt = t;
        const nod = this.caughtAt === null ? smooth(0.35, 0.6, t) : 1 - smooth(this.caughtAt + 0.2, this.caughtAt + 0.5, t);
        this.face.pose(0, nod, nod > 0.5);
      },
      end(t) {
        return (this.caughtAt !== null && t >= this.caughtAt + 1.3) || t >= 5.5;
      },
    },
    {
      name: 'themes',
      setup() {
        place(6, -2, 0, 18);
        cut({ hud: 'none', view: 'near' });
        G.camView = 1;
        this.steps = [
          [0.5, { theme: 'autumn', night: false }], [1.05, { theme: 'winter', night: false }], [1.6, { theme: 'desert', night: false }],
          [2.15, { theme: 'candy', night: false }], [2.7, { theme: 'meadow', night: true }],
        ];
        const name = (o) => (o.night ? `🌙 ${L('Ban đêm', 'Night')}` : `${THEMES[o.theme].emoji} ${tr(THEMES[o.theme].name)}`);
        this.cues = [
          cap(L('5 thế giới · <b>Ngày & đêm</b>', '5 worlds · <b>Day & night</b>'), 0.15),
          chip(name({ theme: 'meadow', night: false }), 0, 0.5),
          ...this.steps.map(([at, o], i) => chip(name(o), at, this.steps[i + 1]?.[0] ?? 99)),
        ];
      },
      async update(t) {
        input.look = 1;
        const a = Math.atan2(G.snake.head.z + 2, G.snake.head.x - 1) + 0.9;
        input.turn = steerTo(1 + Math.cos(a) * 5, -2 + Math.sin(a) * 5);
        for (const [at, options] of this.steps) {
          const promise = once(this, `w${at}`, t >= at, () => world(options));
          if (promise) await promise;
        }
      },
      end: (t) => t >= 3.4,
    },
    {
      name: 'finale',
      async setup() {
        await world({ theme: 'meadow', night: false });
        place(-22, 0, Math.PI / 2, 16);
        cut({ hud: 'full', view: 'near' });
        G.stats.timeLeft = 2.2;
        G.lastSecond = 3;
        music('tempo', 1.15);
        this.cues = [confetti(3.15), logo(4.25, true)];
      },
      update(t) {
        once(this, 'trail', t >= 0.05, () => trail(FRUIT_TRAIL, 3));
        once(this, 'sparkle', t >= 3.15, () => A.goldenAppear());
        // Clear the results card and HUD so the logo stands alone.
        once(this, 'clear', t >= 4.1, () => {
          document.getElementById('screen-over').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
          document.getElementById('hud').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
        });
        black.style.opacity = String(smooth(5.55, 6, t));
      },
      end: (t) => t >= 6,
    },
  ];

  // ------------------------------------------------------------ engine
  let index = -1;
  let scene = null;
  let sceneFrame = 0;

  async function nextScene() {
    if (scene) {
      scene.teardown?.();
      for (const c of scene.cues) c.node?.remove();
      layer.querySelectorAll('.pf-scene').forEach((e) => e.remove());
    }
    scene = SCENES[++index] ?? null;
    if (!scene) return false;
    scene.flags = {};
    scene.cues = [];
    sceneFrame = 0;
    sceneLog.push({ name: scene.name, t: now() });
    await scene.setup?.();
    await compile();
    return true;
  }

  return {
    async setup({ only, edit } = {}) {
      if (edit === 'short') SCENES.splice(0, SCENES.length, ...SHORT);
      ({ tr } = await import('/src/i18n.js'));
      ({ SKINS, HEAD_STYLES } = await import('/src/models/snakeModel.js'));
      ({ THEMES } = await import('/src/themes.js'));
      if (only) {
        const keep = new Set(only);
        for (let i = SCENES.length - 1; i >= 0; i--) if (!keep.has(SCENES[i].name)) SCENES.splice(i, 1);
      }
      await document.fonts.ready;
      S.duration = 5;
      document.querySelector('#opt-control [data-value=keyboard]').click();
      document.querySelector('#opt-duration [data-value="5"]')?.click();
      document.getElementById('btn-start').click();
      for (let i = 0; i < 40 && G.mode !== 'playing'; i++) window.__advance(100);
      await world({ theme: 'meadow', night: false });
      recording = true;
      music('start', 'game');
      return { mode: G.mode, lang };
    },

    async step() {
      if (!scene && !(await nextScene())) return { done: true };
      const t = sceneFrame / FPS;
      runCues(scene, t);
      await scene.update?.(t);
      window.__advance(DT);
      sceneFrame++;
      frame++;
      const result = { done: false, scene: scene.name, frame };
      if (scene.end(sceneFrame / FPS) && !(await nextScene())) result.last = true;
      return result;
    },

    info: () => ({ frames: frame, seconds: now(), scenes: sceneLog, events: events.length, log: events }),

    /** Mixes music and the logged game sounds offline; returns the WAV size (fetch with wavChunk). */
    async renderAudio() {
      const { GameAudio } = await import('/src/audio.js');
      const total = now();
      const sr = 48000;
      const off = new OfflineAudioContext(2, Math.ceil(sr * (total + 0.3)), sr);
      let vt = 0;
      const ctx = new Proxy(off, {
        get(target, prop) {
          if (prop === 'currentTime') return vt;
          if (prop === 'state') return 'running';
          const v = Reflect.get(target, prop, target);
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
      const audio = new GameAudio();
      audio.ctx = ctx;
      audio.master = off.createGain();
      audio.master.connect(off.destination);
      audio.musicBus = off.createGain();
      audio.musicBus.connect(audio.master);
      audio.sfxBus = off.createGain();
      audio.sfxBus.connect(audio.master);
      audio.noiseBuffer = off.createBuffer(1, sr, sr);
      const noise = audio.noiseBuffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
      audio.volumes = { music: 74, sfx: 86, muted: false };
      audio.applyVolumes(true);

      // The music cuts out when time runs out (the game-over jingle plays) and the logo gets the calm menu tune.
      const over = events.find((e) => e.name === 'gameOver');
      const list = [...events];
      if (over) {
        list.push({ t: Math.max(0, over.t - 0.05), kind: 'music', name: 'stop', args: [0.25] });
        list.push({ t: over.t + 1.0, kind: 'music', name: 'start', args: ['menu'] });
      }
      list.sort((a, b) => a.t - b.t);
      let i = 0;
      for (vt = 0; vt <= total + 0.2; vt = Math.round((vt + 0.02) * 1000) / 1000) {
        while (i < list.length && list[i].t <= vt) {
          const e = list[i++];
          const keep = vt;
          vt = e.t;
          if (e.kind === 'sfx') audio[e.name](...e.args);
          else if (e.name === 'start') audio.music.start(e.args[0]);
          else if (e.name === 'tempo') audio.music.setTempo(e.args[0]);
          else if (e.name === 'stop') audio.music.release(e.args[0] ?? 0.4);
          vt = keep;
        }
        if (audio.music.bus) audio.music.schedule();
      }
      audio.master.gain.setValueAtTime(0.9, Math.max(0, total - 1.2));
      audio.master.gain.linearRampToValueAtTime(0.0001, total);
      const buffer = await off.startRendering();

      const channels = buffer.numberOfChannels;
      const length = buffer.length;
      const bytes = new DataView(new ArrayBuffer(44 + length * channels * 2));
      const text = (offset, s) => [...s].forEach((ch, k) => bytes.setUint8(offset + k, ch.charCodeAt(0)));
      text(0, 'RIFF');
      bytes.setUint32(4, 36 + length * channels * 2, true);
      text(8, 'WAVE');
      text(12, 'fmt ');
      bytes.setUint32(16, 16, true);
      bytes.setUint16(20, 1, true);
      bytes.setUint16(22, channels, true);
      bytes.setUint32(24, sr, true);
      bytes.setUint32(28, sr * channels * 2, true);
      bytes.setUint16(32, channels * 2, true);
      bytes.setUint16(34, 16, true);
      text(36, 'data');
      bytes.setUint32(40, length * channels * 2, true);
      const data = [...Array(channels)].map((_, c) => buffer.getChannelData(c));
      let offset = 44;
      // The synth mix is quiet and spiky; lift it to a normal video level with a soft limiter.
      const GAIN = 8;
      for (let n = 0; n < length; n++) {
        for (let c = 0; c < channels; c++) {
          const s = Math.tanh(data[c][n] * GAIN) * 0.92;
          bytes.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          offset += 2;
        }
      }
      this.wav = new Uint8Array(bytes.buffer);
      return { bytes: this.wav.length, seconds: total, events: events.length };
    },

    wavChunk(start, size) {
      const part = this.wav.subarray(start, start + size);
      let s = '';
      for (let k = 0; k < part.length; k += 0x8000) s += String.fromCharCode(...part.subarray(k, k + 0x8000));
      return btoa(s);
    },
  };
})();
