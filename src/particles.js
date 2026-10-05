import * as THREE from 'three';

/** Pooled confetti-like bursts drawn with a single InstancedMesh. */
export class Particles {
  constructor(scene, max = 360) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.5, flatShading: true }),
      max,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.ttl = new Float32Array(max).fill(1);
    this.size = new Float32Array(max);
    this.floor = new Float32Array(max);
    this.next = 0;
    this.active = false;
    this._m = new THREE.Matrix4();
    this._c = new THREE.Color();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) {
      this.mesh.setMatrixAt(i, hidden);
      this.mesh.setColorAt(i, this._c.set('#ffffff'));
    }
    scene.add(this.mesh);
  }

  burst(position, color, count = 16, speed = 4, size = 0.12) {
    this._c.set(color);
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.pos.set([position.x, (position.y || 0) + 0.5, position.z], i * 3);
      this.floor[i] = (position.y || 0) + 0.05;
      this.vel.set([Math.cos(angle) * s * 0.7, 2 + Math.random() * speed, Math.sin(angle) * s * 0.7], i * 3);
      this.life[i] = this.ttl[i] = 0.5 + Math.random() * 0.5;
      this.size[i] = size * (0.6 + Math.random() * 0.8);
      this.mesh.setColorAt(i, this._c);
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    let alive = false;
    const { pos, vel, life, ttl, size, floor } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const j = i * 3;
      vel[j + 1] -= 14 * dt;
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < floor[i]) {
        pos[j + 1] = floor[i];
        vel[j + 1] *= -0.35;
        vel[j] *= 0.7;
        vel[j + 2] *= 0.7;
      }
      const s = life[i] > 0 ? size[i] * Math.sqrt(life[i] / ttl[i]) : 0;
      this._m.makeScale(s, s, s).setPosition(pos[j], pos[j + 1], pos[j + 2]);
      this.mesh.setMatrixAt(i, this._m);
      alive = true;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.active = alive;
  }
}
