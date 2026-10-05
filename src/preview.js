import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Snake } from './snake.js';
import { groundTexture } from './models/environment.js';

/** Small live 3D preview of the player's snake (colour + head style) for the menu. */
export class SnakePreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    this.scene.add(new THREE.HemisphereLight('#e3f4ff', '#5d8a46', 1.0));
    const sun = new THREE.DirectionalLight('#fff2da', 2.2);
    sun.position.set(3, 7, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    this.scene.add(sun);

    const texture = groundTexture();
    texture.repeat.set(1.4, 1.4);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.3, 48), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
    disc.rotation.x = -Math.PI / 2;
    disc.receiveShadow = true;
    this.scene.add(disc);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    this.camera.position.set(0, 3.6, 5.1);
    this.camera.lookAt(0, 0.2, 0.2);

    this.snake = new Snake(this.scene);
    this.radius = 1.7;
    this.angle = 0;
    this.time = 0;
    this.running = false;
    this.snake.reset(this.radius, 0, Math.PI, 14);
    for (let i = 0; i < 300; i++) this.advance(1 / 60);
    this.snake.updateVisuals(0, 0);
  }

  /** Head runs around a circle; the body follows using the game's trail logic. */
  advance(dt) {
    this.angle += (dt * 2.4) / this.radius;
    const x = Math.cos(this.angle) * this.radius;
    const z = Math.sin(this.angle) * this.radius;
    const head = this.snake.head;
    this.snake.heading = Math.atan2(x - head.x, z - head.z);
    head.set(x, 0, z);
    this.snake.recordPath();
  }

  setAppearance(skin, headStyle) {
    this.snake.setAppearance(skin, headStyle);
    this.snake.updateVisuals(0, this.time);
    if (!this.running) this.render();
  }

  render() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Animates only while visible, so the menu costs nothing during play. */
  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.time += dt;
      this.advance(dt);
      this.snake.updateVisuals(dt, this.time);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }
}
