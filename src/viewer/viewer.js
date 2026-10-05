import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FRUIT_TYPES } from '../models/fruits.js';
import { ANIMAL_TYPES } from '../models/animals.js';
import { buildSnakeHead, animateTongue, TONGUE_CYCLE, SKINS, HEAD_STYLES } from '../models/snakeModel.js';
import {
  buildPineTree, buildRoundTree, buildRock, buildBush, buildGrassTuft,
  buildFenceSection, buildBoulder, buildStump, buildMudPuddle, buildBerryBush, buildBigTree, groundTexture,
} from '../models/environment.js';
import { Snake } from '../snake.js';
import { Prey } from '../prey.js';
import { buildWorld, groundHeight, COLLIDERS, DEFAULT_GRASS } from '../world.js';
import { THEMES } from '../themes.js';
import { FLOWER_TYPES, buildFlowerPlant } from '../models/flowers.js';
import './viewer.css';

// ---------------------------------------------------------------- renderer

const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
viewport.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
viewport.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = skyTexture();
scene.fog = new THREE.Fog('#cfe9f7', 40, 110);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotateSpeed = 1.4;
controls.maxPolarAngle = Math.PI * 0.495;

const hemi = new THREE.HemisphereLight('#d9efff', '#4f7a3c', 0.8);
scene.add(hemi);
/** The viewer's own sky, lights and ground; hidden while a full game world is shown. */
const viewerSky = { background: scene.background, fog: scene.fog };
const sun = new THREE.DirectionalLight('#fff0d6', 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.MeshStandardMaterial({ color: '#68ad4c', roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.002;
ground.receiveShadow = true;
scene.add(ground);

const pedestal = (() => {
  const top = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.9 });
  const side = new THREE.MeshStandardMaterial({ color: '#c79b62', roughness: 0.8 });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.04, 0.14, 64), [side, top, side]);
  mesh.position.y = -0.07;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);
  return group;
})();

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#5fb2f0');
  gradient.addColorStop(0.6, '#bfe4fa');
  gradient.addColorStop(1, '#e9f6ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------------------------------------------------------------- helpers

function animalState(def, t) {
  if (def.move === 'hop') {
    const cycle = def.hopTime + 0.5;
    const phase = t % cycle;
    const hop = phase < def.hopTime ? phase / def.hopTime : -1;
    return { moving: 0, hop, panic: false, y: hop >= 0 ? Math.sin(hop * Math.PI) * def.hopHeight * 0.5 : 0 };
  }
  return { moving: 1, hop: -1, panic: t % 5 > 3.2, y: 0 };
}

/** Animal walking (or hopping) around a small circle. */
function circlingAnimal(def, { radius = 0.75, cx = 0, cz = 0, offset = 0 } = {}) {
  const walker = new THREE.Group();
  const model = def.build();
  walker.add(model);
  let angle = offset;
  const place = () => {
    walker.position.set(cx + Math.cos(angle) * radius, walker.position.y, cz + Math.sin(angle) * radius);
    walker.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
  };
  place();
  model.userData.animate(0, { moving: 0, hop: -1 });
  return {
    object: walker,
    update(dt, t, animate) {
      if (!animate) return;
      const st = animalState(def, t + offset);
      const speed = def.move === 'hop' ? (st.hop >= 0 ? 2.0 : 0) : def === ANIMAL_TYPES.chick ? 0.7 : 1.0;
      angle += (dt * speed) / radius;
      walker.position.y = st.y;
      place();
      model.userData.animate(t + offset, st);
    },
  };
}

/** Fruit floating, spinning and bobbing as it does in the game. */
function floatingFruit(def, offset = 0) {
  const holder = new THREE.Group();
  const model = def.build();
  holder.add(model);
  model.position.y = def.radius + 0.18;
  return {
    object: holder,
    update(dt, t, animate) {
      if (!animate) return;
      model.rotation.y = (t + offset) * 1.2;
      model.position.y = def.radius + 0.18 + Math.sin((t + offset) * 2.5) * 0.07;
      model.userData.animate?.(t + offset);
    },
  };
}

/** Snake driven along a figure-eight using the real game trail logic. */
function figureEightSnake({ size = 3, length = 22, speed = 3.2, center = [0, 0], ground } = {}) {
  const holder = new THREE.Group();
  const snake = new Snake(holder, ground ? { ground } : undefined);
  const lemniscate = (u, out) => {
    const s = Math.sin(u);
    const c = Math.cos(u);
    const d = 1 + s * s;
    return out.set(center[0] + (size * c) / d, 0, center[1] + (size * s * c) / d);
  };
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  let u = 0;
  lemniscate(0, p);
  lemniscate(0.01, q);
  snake.reset(p.x, p.z, Math.atan2(q.x - p.x, q.z - p.z), length);
  const advance = (dt) => {
    lemniscate(u, p);
    lemniscate(u + 0.001, q);
    u += (speed * dt * 0.001) / p.distanceTo(q);
    lemniscate(u, p);
    snake.heading = Math.atan2(p.x - snake.head.x, p.z - snake.head.z);
    snake.head.copy(p);
    snake.recordPath();
  };
  for (let i = 0; i < 400; i++) advance(1 / 60);

  let clock = 0;
  let gulpTimer = 1;
  snake.updateVisuals(0, 0);
  return {
    object: holder,
    snake,
    update(dt, t, animate) {
      if (!animate) return;
      clock += dt;
      advance(dt);
      gulpTimer -= dt;
      if (gulpTimer <= 0) {
        gulpTimer = 3.5;
        snake.bulges.push({ d: 0.2, amp: 0.42 });
        snake.gulp = 1;
      }
      snake.updateVisuals(dt, clock);
    },
  };
}

function combine(parts, extra = {}) {
  const object = new THREE.Group();
  parts.forEach((p) => object.add(p.object));
  return {
    object,
    update: (dt, t, a) => parts.forEach((p) => p.update?.(dt, t, a)),
    ...extra,
  };
}

function label(html, y = 1.25) {
  const div = document.createElement('div');
  div.className = 'model-label';
  div.innerHTML = html;
  const obj = new CSS2DObject(div);
  obj.position.y = y;
  return obj;
}

// ---------------------------------------------------------------- catalogue

const ITEMS = [];
const add = (category, id, name, emoji, make, info = {}) => ITEMS.push({ category, id, name, emoji, make, info });

add('Rắn', 'snake', 'Rắn của người chơi', '🐍', () => {
  const s = figureEightSnake();
  return { ...s, radius: 3.6, center: new THREE.Vector3(0, 0.4, 0), view: new THREE.Vector3(0.4, 0.75, 1), pedestalRadius: 4.4 };
}, {
  desc: 'Luôn bò về phía trước, không thể lùi — đầu người chơi chỉ điều khiển rẽ trái/phải. Mỗi lần ăn, một "ngụm" chạy dọc thân và thân dài thêm. Bụng màu sáng, lưng có sọc vàng.',
  stats: [['Tốc độ', '5.4 → 7.6 đv/giây'], ['Tăng tốc', '× 1.65'], ['Độ dài ban đầu', '8 đốt'], ['Va chạm', '−10 điểm, ngắn lại 20%']],
});

add('Rắn', 'snake-head', 'Đầu rắn (cận cảnh)', '👀', () => {
  const head = buildSnakeHead();
  head.position.y = 0.46;
  let phase = 0;
  return {
    object: head,
    radius: 1.15,
    center: new THREE.Vector3(0, 0.42, 0.1),
    view: new THREE.Vector3(0.9, 0.6, 1),
    update(dt, t, animate) {
      if (!animate) return;
      phase = (phase + dt) % TONGUE_CYCLE;
      animateTongue(head, phase, t);
      head.userData.eyes.update(t);
      head.userData.skull.rotation.z = Math.sin(t * 1.3) * 0.05;
    },
  };
}, { desc: 'Mắt vàng với đồng tử dọc, liếc nhìn xung quanh (rắn không có mí nên không chớp mắt). Lưỡi chẻ đôi thè ra mỗi 1.8 giây.' });

add('Rắn', 'snake-heads', 'Các kiểu đầu', '🎭', () => {
  const styles = Object.entries(HEAD_STYLES);
  const parts = styles.map(([id, style], i) => {
    const head = buildSnakeHead({ skin: SKINS.green, style: id });
    head.position.set((i - (styles.length - 1) / 2) * 1.6, 0.46, 0);
    head.rotation.y = 0.35;
    head.add(label(`<span>${style.emoji} ${style.name}</span>`, 1.15));
    let phase = i * 0.37;
    return {
      object: head,
      update(dt, t, animate) {
        if (!animate) return;
        phase = (phase + dt) % TONGUE_CYCLE;
        animateTongue(head, phase, t);
        head.userData.eyes.update(t + i);
      },
    };
  });
  return combine(parts, { radius: 6.8, center: new THREE.Vector3(0, 0.6, 0), view: new THREE.Vector3(0, 0.45, 1), pedestal: false, shift: false });
}, { desc: 'Tám kiểu đầu người chơi chọn trong menu Tuỳ biến: cổ điển, dễ thương, ngầu, nhà vua, tiệc tùng, rồng, nơ xinh và mèo con.' });

add('Rắn', 'snake-skins', 'Các màu rắn', '🌈', () => {
  const parts = Object.entries(SKINS).map(([id, skin], i) => {
    const holder = new THREE.Group();
    const snake = new Snake(holder);
    snake.setAppearance(id, 'classic');
    const x0 = ((i % 3) - 1) * 4.4 - 1.6;
    const z0 = (Math.floor(i / 3) - 1) * 3.2;
    snake.reset(x0, z0, Math.PI / 2, 12);
    for (let k = 0; k < 120; k++) snake.move(1 / 60, Math.sin(k / 12) * 0.9, 3, 2.5);
    snake.updateVisuals(0, 0);
    const anchor = new THREE.Object3D();
    anchor.position.set(snake.head.x, 0, snake.head.z);
    anchor.add(label(`<span>${skin.name}</span>`, 1.25));
    holder.add(anchor);
    let clock = i;
    return {
      object: holder,
      update(dt, t, animate) {
        if (!animate) return;
        clock += dt;
        snake.updateVisuals(dt, clock);
      },
    };
  });
  return combine(parts, { radius: 7.6, center: new THREE.Vector3(0, 0.4, 0), view: new THREE.Vector3(0, 1.2, 1), pedestal: false, shift: false });
}, { desc: 'Chín màu da với hoa văn riêng: sọc, kim cương, chấm bi, vằn hổ và cầu vồng.' });

for (const [id, def] of Object.entries(FRUIT_TYPES)) {
  add('Trái cây', id, def.name, def.emoji, () => ({ ...floatingFruit(def), radius: 1.0, center: new THREE.Vector3(0, 0.55, 0) }), {
    desc: def.desc,
    stats: [['Điểm', def.points], ['Dài thêm', `+${def.growth} đốt`], ['Bán kính va chạm', def.radius], ...(def.lifetime ? [['Tồn tại', `${def.lifetime} giây`]] : [])],
  });
}

for (const [id, def] of Object.entries(ANIMAL_TYPES)) {
  add('Động vật nhỏ', id, def.name, def.emoji, () => ({ ...circlingAnimal(def), radius: 1.55, center: new THREE.Vector3(0, 0.35, 0) }), {
    desc: def.desc,
    stats: [
      ['Điểm', def.points], ['Dài thêm', `+${def.growth} đốt`],
      ['Di chuyển', def.move === 'hop' ? 'Nhảy' : 'Chạy'],
      ['Tốc độ chạy trốn', `${def.fleeSpeed} đv/giây`], ['Phát hiện rắn từ', `${def.fleeRadius} đv`],
    ],
  });
}

const envItem = (id, name, emoji, build, radius, centerY, desc) => add('Môi trường', id, name, emoji, () => ({
  object: build(), radius, center: new THREE.Vector3(0, centerY, 0),
}), { desc });

envItem('pine', 'Cây thông', '🌲', buildPineTree, 2.7, 1.7, 'Trang trí ngoài hàng rào.');
envItem('round-tree', 'Cây tán tròn', '🌳', buildRoundTree, 2.6, 1.6, 'Trang trí ngoài hàng rào.');
envItem('bush', 'Bụi cây', '🌿', buildBush, 1.1, 0.35, 'Đặt sát hàng rào.');
envItem('rock', 'Tảng đá nhỏ', '🪨', buildRock, 1.1, 0.3, 'Đặt rải rác bên ngoài hàng rào.');
envItem('boulder', 'Tảng đá lớn (vật cản)', '⛰️', buildBoulder, 1.7, 0.6, 'Vật cản trong đấu trường — rắn đâm vào sẽ mất 10 điểm và ngắn lại; thú nhỏ chạy vòng qua.');
envItem('stump', 'Gốc cây (vật cản)', '🪵', buildStump, 1.2, 0.35, 'Vật cản có vân gỗ và một cây nấm nhỏ — rắn đâm vào sẽ bị phạt như đâm hàng rào.');
envItem('berry-bush', 'Bụi quả mọng', '🫐', buildBerryBush, 1.4, 0.55, 'Rắn bò xuyên qua được: bụi tách ra hai bên rồi rung bật lại, lá bay tung và có tiếng xào xạc.');
envItem('tree-oak', 'Cây sồi to', '🌳', () => buildBigTree('oak'), 6.4, 4.0, 'Cây to trong đấu trường: thân cây là vật cản, tán cây tự mờ đi khi rắn bò bên dưới.');
envItem('tree-blossom', 'Cây hoa anh đào', '🌸', () => buildBigTree('blossom'), 6.4, 4.0, 'Cây to trong đấu trường với tán hoa hồng.');
envItem('tree-apple', 'Cây táo', '🍎', () => buildBigTree('apple'), 6.4, 4.0, 'Cây to trong đấu trường, có táo đỏ treo dưới tán.');
envItem('mud', 'Vũng bùn', '🟤', () => buildMudPuddle(1.6, 2), 1.9, 0.05, 'Rắn bò qua sẽ chậm lại 40% và bắn bùn tung toé.');
add('Môi trường', 'flowers', 'Các loại hoa', '🌸', () => {
  const types = Object.entries(FLOWER_TYPES);
  const parts = types.map(([id, def], i) => {
    const holder = new THREE.Group();
    const a = (i / types.length) * Math.PI * 2;
    holder.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
    // A small clump in two colours of the palette.
    for (let k = 0; k < 3; k++) {
      const f = buildFlowerPlant(id, def.palette[k % def.palette.length]);
      f.position.set((k - 1) * 0.12, 0, (k % 2) * 0.1);
      f.rotation.y = k * 2.1;
      f.scale.setScalar(0.9 + k * 0.12);
      holder.add(f);
    }
    holder.add(label(`<span>${def.name}</span>`, def.stemH + 0.35));
    return { object: holder };
  });
  return combine(parts, { radius: 1.7, center: new THREE.Vector3(0, 0.3, 0) });
}, { desc: 'Chín loại hoa mọc thành từng khóm trong đấu trường, mỗi bông cao thấp khác nhau và ngả ra khi rắn bò qua.' });
add('Môi trường', 'grass', 'Cụm cỏ', '🌱', () => {
  const parts = [16, 24, 32].map((count, i) => {
    const tuft = buildGrassTuft(count);
    tuft.position.x = (i - 1) * 0.6;
    tuft.add(label(`<span>${count} phiến</span>`, 1.0));
    return { object: tuft };
  });
  return combine(parts, { radius: 1.0, center: new THREE.Vector3(0, 0.4, 0) });
}, { desc: 'Mỗi bụi có 16–32 phiến (chỉnh ở menu Tuỳ biến → Cỏ): phiến giữa cao, phiến ngoài thấp và xoè ra. Gốc tối, ngọn sáng; trong game cỏ uốn cong quanh gốc khi rắn bò qua.' });
envItem('fence', 'Hàng rào gỗ', '🚧', () => {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = buildFenceSection();
    s.position.x = i * 2 - 3;
    g.add(s);
  }
  const end = buildFenceSection(0);
  end.position.x = 3;
  g.add(end);
  return g;
}, 3.8, 0.6, 'Bao quanh đấu trường — đâm vào sẽ mất 1 mạng.');

add('Tổng quan', 'lineup', 'Tất cả con mồi', '📏', () => {
  const entries = [...Object.values(FRUIT_TYPES), ...Object.values(ANIMAL_TYPES)];
  const spacing = 1.3;
  const parts = entries.map((def, i) => {
    const x = (i - (entries.length - 1) / 2) * spacing;
    const isAnimal = Object.values(ANIMAL_TYPES).includes(def);
    let partItem;
    if (isAnimal) {
      const model = def.build();
      model.rotation.y = 0.35;
      partItem = {
        object: model,
        update(dt, t, animate) {
          if (!animate) return;
          const st = animalState(def, t + i);
          model.position.y = st.y;
          model.userData.animate(t + i, st);
        },
      };
    } else {
      partItem = floatingFruit(def, i);
    }
    partItem.object.position.x = x;
    partItem.object.position.z = -(x * x) * 0.025;
    partItem.object.add(label(`<span>${def.emoji} ${def.name}</span><b>${def.points}đ</b>`, 1.35));
    return partItem;
  });
  const head = buildSnakeHead();
  head.position.set(-((entries.length - 1) / 2) * spacing - 1.5, 0.46, -1.6);
  head.rotation.y = 0.9;
  head.add(label('<span>🐍 Đầu rắn</span><b>để so sánh</b>', 1.0));
  parts.push({ object: head });
  return combine(parts, { radius: 7.8, center: new THREE.Vector3(-0.7, 0.6, -0.6), view: new THREE.Vector3(0, 0.38, 1), pedestal: false, shift: false });
}, { desc: 'Toàn bộ con mồi xếp cạnh nhau ở đúng tỉ lệ trong game, kèm điểm số. Đầu rắn đặt bên trái để so sánh kích thước.' });

const sceneOptions = { theme: 'meadow', night: false };

add('Tổng quan', 'diorama', 'Cảnh mẫu trong game', '🏞️', () => {
  // The real game arena (hills, big trees, berry bushes, mud, rocks, dense grass,
  // flowers) with a snake slithering through it and prey around.
  const holder = new THREE.Group();
  let world = null;
  const build = () => {
    world?.dispose();
    world = buildWorld(scene, { ...sceneOptions, grass: DEFAULT_GRASS });
    scene.environmentIntensity = world.environmentIntensity;
  };
  build();

  const center = [1, 1];
  const snakePart = figureEightSnake({ size: 5.5, length: 30, speed: 3.4, center, ground: groundHeight });
  holder.add(snakePart.object);
  const snake = snakePart.snake;

  const prey = [
    ['fruit', 'apple', -2.5, 4.5], ['fruit', 'watermelon', 5.5, -2], ['fruit', 'strawberry', 2, 6],
    ['fruit', 'golden', -3, -3], ['fruit', 'banana', 7, 3.5],
    ['animal', 'rabbit', -4, 0], ['animal', 'chick', 5, 5], ['animal', 'frog', 3, -4], ['animal', 'mouse', -1, 7],
  ].map(([kind, type, x, z]) => {
    const p = new Prey(kind, type);
    p.position.set(x, 0, z);
    p.age = 1;
    holder.add(p.root);
    return p;
  });

  const pushers = Array.from({ length: 48 }, () => ({ x: 0, z: 0, r: 0 }));
  const tmp = new THREE.Vector3();
  const ctx = { head: snake.head, limit: 9, colliders: COLLIDERS, ground: groundHeight };
  let clock = 0;
  return {
    object: holder,
    ownWorld: true,
    radius: 9,
    center: new THREE.Vector3(center[0], 0.8, center[1]),
    view: new THREE.Vector3(0.7, 0.6, 1),
    pedestal: false,
    shift: false,
    setOptions(next) {
      Object.assign(sceneOptions, next);
      build();
    },
    update(dt, t, animate) {
      if (!animate) return;
      clock += dt;
      snakePart.update(dt, t, animate);
      for (const p of prey) {
        p.update(dt, ctx);
        // Eaten prey just pops back somewhere nearby so the scene stays lively.
        if (Math.hypot(p.position.x - snake.head.x, p.position.z - snake.head.z) < 0.9) {
          p.position.set(center[0] + (Math.random() - 0.5) * 14, 0, center[1] + (Math.random() - 0.5) * 14);
          p.age = 0;
        }
      }
      let n = 0;
      const add = (x, z, r) => { Object.assign(pushers[n++], { x, z, r }); };
      add(snake.head.x, snake.head.z, 0.7);
      for (const p of prey) add(p.position.x, p.position.z, p.kind === 'animal' ? 0.5 : 0.45);
      for (let i = 2; i <= snake.segmentCount && n < pushers.length; i += 3) {
        snake.pointAt(i * 0.4, tmp);
        add(tmp.x, tmp.z, 0.55);
      }
      world.setPushers(pushers, n);
      world.update(snake.head.x, snake.head.z, clock, dt, camera);
    },
    dispose() {
      world.dispose();
    },
  };
}, { desc: 'Một góc của chính đấu trường trong game: đồi, cây to, bụi quả, bùn, đá, cỏ rậm và hoa rẽ ra khi rắn và thú đi qua. Dùng ô chọn phía trên để xem các theme sân và ban đêm.' });

// ---------------------------------------------------------------- UI

const list = document.getElementById('item-list');
const optRotate = document.getElementById('opt-rotate');
const optAnim = document.getElementById('opt-anim');
let current = null;
let currentIndex = -1;

function renderList() {
  let lastCategory = '';
  ITEMS.forEach((item, index) => {
    if (item.category !== lastCategory) {
      lastCategory = item.category;
      const h = document.createElement('div');
      h.className = 'cat';
      h.textContent = item.category;
      list.appendChild(h);
    }
    const btn = document.createElement('button');
    btn.className = 'item';
    btn.dataset.index = index;
    btn.innerHTML = `<span class="emoji">${item.emoji}</span><span>${item.name}</span>`;
    btn.addEventListener('click', () => select(index));
    list.appendChild(btn);
  });
}

function setViewerEnvironment(visible) {
  hemi.visible = visible;
  sun.visible = visible;
  ground.visible = visible;
  if (visible) {
    scene.background = viewerSky.background;
    scene.fog = viewerSky.fog;
    scene.environmentIntensity = 0.3;
  }
}

function disposeCurrent() {
  if (!current) return;
  current.instance.object.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); });
  scene.remove(current.instance.object);
  current.instance.dispose?.();
  if (current.instance.ownWorld) setViewerEnvironment(true);
  current = null;
}

function select(index) {
  if (index === currentIndex) return;
  disposeCurrent();
  currentIndex = index;
  const item = ITEMS[index];
  const instance = item.make();
  if (instance.ownWorld) setViewerEnvironment(false);
  document.getElementById('scene-opts').classList.toggle('hidden', !instance.setOptions);
  scene.add(instance.object);
  instance.object.traverse((o) => {
    if (o.isMesh && o.castShadow !== false) o.castShadow = true;
  });
  current = { item, instance };
  frame(instance);
  showInfo(item);
  list.querySelectorAll('.item').forEach((b) => b.classList.toggle('active', Number(b.dataset.index) === index));
  history.replaceState(null, '', `#${item.id}`);
}

function frame(instance) {
  const r = instance.radius ?? 1;
  const center = instance.center ?? new THREE.Vector3(0, r * 0.4, 0);
  const dir = (instance.view ?? new THREE.Vector3(0.9, 0.55, 1.2)).clone().normalize();
  const aspect = camera.aspect || 1;
  const fit = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = fit * (aspect < 1 ? 1 / aspect : 1) * 0.92;
  camera.position.copy(center).addScaledVector(dir, dist);
  controls.target.copy(center);
  controls.minDistance = r * 0.5;
  controls.maxDistance = dist * 3;
  controls.update();

  const s = Math.max(2, r * 1.35);
  const cam = sun.shadow.camera;
  cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s;
  cam.near = 0.5; cam.far = s * 6 + 20;
  cam.updateProjectionMatrix();
  sun.position.set(center.x + s * 0.9, s * 2.4 + 3, center.z + s * 1.1);
  sun.target.position.copy(center);

  applyViewOffset();
  pedestal.visible = instance.pedestal !== false;
  const pr = instance.pedestalRadius ?? Math.max(1.1, r * 0.95);
  pedestal.scale.set(pr, 1, pr);
}

/** Nudges single models up/right so the info card does not cover them. */
function applyViewOffset() {
  const { clientWidth: w, clientHeight: h } = viewport;
  if (current?.instance.shift === false || w < 760) camera.clearViewOffset();
  else camera.setViewOffset(w, h, -Math.min(170, w * 0.14), h * 0.07, w, h);
}

function showInfo(item) {
  document.getElementById('info-emoji').textContent = item.emoji;
  document.getElementById('info-cat').textContent = item.category;
  document.getElementById('info-name').textContent = item.name;
  document.getElementById('info-desc').textContent = item.info.desc ?? '';
  const stats = document.getElementById('info-stats');
  stats.innerHTML = '';
  for (const [k, v] of item.info.stats ?? []) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    stats.append(dt, dd);
  }
}

document.getElementById('btn-reset').addEventListener('click', () => current && frame(current.instance));
const themeSelect = document.getElementById('opt-scene-theme');
themeSelect.innerHTML = Object.entries(THEMES).map(([id, t]) => `<option value="${id}">${t.emoji} ${t.name}</option>`).join('');
themeSelect.addEventListener('change', () => current?.instance.setOptions?.({ theme: themeSelect.value }));
document.getElementById('opt-scene-night').addEventListener('change', (e) => current?.instance.setOptions?.({ night: e.target.checked }));
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const next = (currentIndex + (e.key === 'ArrowDown' ? 1 : -1) + ITEMS.length) % ITEMS.length;
    select(next);
    list.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  }
});

function resize() {
  const { clientWidth: w, clientHeight: h } = viewport;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  applyViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();

renderList();
const fromHash = () => ITEMS.findIndex((i) => i.id === location.hash.slice(1));
window.addEventListener('hashchange', () => { const i = fromHash(); if (i >= 0) select(i); });
select(Math.max(0, fromHash()));

let last = performance.now();
let animTime = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const animate = optAnim.checked;
  if (animate) animTime += dt;
  controls.autoRotate = optRotate.checked;
  current?.instance.update?.(dt, animTime, animate);
  controls.update(dt);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});

// Dev-only handle for inspecting close-ups from the console.
if (import.meta.env.DEV) window.__viewer = { camera, controls, scene, select, get current() { return current; } };
