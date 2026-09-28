// "Le Patient 9" : modèle + IA
import * as THREE from 'three';
import { T } from './level.js';

function limb(r1, r2, len, mat) {
  const geo = new THREE.CylinderGeometry(r1, r2, len, 6);
  geo.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  return m;
}

function buildMesh() {
  const skin = new THREE.MeshStandardMaterial({ color: 0x24201d, roughness: 0.85 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xbdb3a3, roughness: 0.55, emissive: 0x1a1512, emissiveIntensity: 0.4 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });

  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 1.3; root.add(hips);
  const legL = new THREE.Group(); legL.position.x = 0.13; legL.add(limb(0.055, 0.035, 1.3, skin)); hips.add(legL);
  const legR = new THREE.Group(); legR.position.x = -0.13; legR.add(limb(0.055, 0.035, 1.3, skin)); hips.add(legR);

  const spine = new THREE.Group(); spine.rotation.x = 0.4; hips.add(spine);
  const torsoGeo = new THREE.CylinderGeometry(0.27, 0.15, 0.95, 8); torsoGeo.translate(0, 0.475, 0); torsoGeo.scale(1, 1, 0.6);
  const torso = new THREE.Mesh(torsoGeo, skin); torso.castShadow = true; spine.add(torso);
  // côtes saillantes
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), skin); pelvis.scale.set(1.1, 0.6, 0.7); hips.add(pelvis);
  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 6), skin); shoulders.rotation.z = Math.PI / 2; shoulders.position.y = 0.9; spine.add(shoulders);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.2 - i * 0.014, 0.012, 4, 10, Math.PI), pale);
    rib.position.set(0, 0.5 + i * 0.1, 0.02); rib.rotation.set(Math.PI / 2, 0, 0); rib.scale.set(1, 0.75, 1);
    spine.add(rib);
  }

  const mkArm = (side) => {
    const a = new THREE.Group(); a.position.set(0.31 * side, 0.9, 0);
    a.add(limb(0.045, 0.03, 1.4, skin));
    const hand = new THREE.Group(); hand.position.y = -1.4; a.add(hand);
    for (let f = 0; f < 4; f++) {
      const finger = limb(0.01, 0.004, 0.3, pale);
      finger.position.x = (f - 1.5) * 0.022; finger.rotation.z = (f - 1.5) * 0.12; finger.rotation.x = 0.15;
      hand.add(finger);
    }
    spine.add(a); return a;
  };
  const armL = mkArm(1), armR = mkArm(-1);

  const neck = new THREE.Group(); neck.position.y = 0.93; neck.rotation.x = 0.3; spine.add(neck);
  const neckGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.3, 6); neckGeo.translate(0, 0.15, 0);
  neck.add(new THREE.Mesh(neckGeo, skin));
  const head = new THREE.Group(); head.position.y = 0.3; neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), pale); skull.scale.set(0.85, 1.3, 0.95); skull.position.y = 0.12; skull.castShadow = true;
  head.add(skull);
  for (const s of [1, -1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), black); socket.position.set(0.06 * s, 0.16, 0.13); socket.scale.set(1, 1.3, 0.5);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), eyeMat); eye.position.set(0.06 * s, 0.16, 0.155);
    head.add(socket, eye);
  }
  const jaw = new THREE.Group(); jaw.position.set(0, 0.0, 0.135); jaw.scale.set(0.7, 0.35, 0.3); head.add(jaw);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), black); jaw.add(mouth);
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xd8cfa8, roughness: 0.4 });
  for (let k = 0; k < 14; k++) {
    const top = k < 7, a = ((k % 7) / 6 - 0.5) * 2.2;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 4), toothMat);
    tooth.position.set(Math.sin(a) * 0.06, top ? 0.055 : -0.055, Math.cos(a) * 0.05 + 0.02);
    tooth.scale.set(1 / 0.7 * 0.7, 1, 1);
    tooth.rotation.x = top ? Math.PI : 0;
    jaw.add(tooth);
  }

  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, parts: { hips, legL, legR, spine, armL, armR, neck, head, jaw } };
}

export class Monster {
  constructor() {
    const { root, parts } = buildMesh();
    this.group = root; this.parts = parts;
    this.pos = root.position;
    this.headTarget = new THREE.Vector3();
    this.lastSeen = new THREE.Vector3();
    this.searchCenter = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.state = 'dormant'; this.mode = 'wander';
    this.group.visible = false; this.pos.set(0, -50, 0);
    this.stalking = false; this.stalkTimer = 14 + Math.random() * 10;
    this.path = []; this.repath = 0; this.wanderT = 0; this.searchT = 0; this.lostT = 0;
    this.yaw = 0; this.phase = 0; this.curSpeed = 0; this.twitchT = 0; this.reach = 0;
    this.dist = 99; this.lastStep = 0; this.jawOpen = 0; this.speedBonus = 0;
    this.parts.jaw.scale.set(0.7, 0.35, 0.3);
  }

  startHunt(G) {
    const [pi, pj] = G.grid.tileOf(G.player.x, G.player.z);
    const d = G.grid.bfs(pi, pj);
    let best = null, bestD = -1;
    for (const [i, j] of G.grid.floorTiles()) {
      const v = d[j * G.grid.W + i];
      if (v > 14 && v < 26 && Math.random() < 0.3) { best = [i, j]; break; }
      if (v > bestD) { bestD = v; best = [i, j]; }
    }
    this.pos.set((best[0] + 0.5) * T, 0, (best[1] + 0.5) * T);
    this.state = 'hunt'; this.mode = 'wander'; this.stalking = false;
    this.group.visible = true; this.path = []; this.wanderT = 0;
  }

  enrage(G) {
    this.speedBonus = 0.4;
    this.setSearch(G.player.x, G.player.z, G, 20);
  }

  faceTo(dx, dz, dt, rate = 8) {
    const target = Math.atan2(dx, dz);
    let diff = target - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, dt * rate);
  }

  goTo(x, z, G) {
    const [si, sj] = G.grid.tileOf(this.pos.x, this.pos.z);
    const [ti, tj] = G.grid.tileOf(x, z);
    this.path = G.grid.path(si, sj, ti, tj);
    if (this.path.length) this.path[this.path.length - 1] = [ti, tj, x, z];
  }

  follow(dt, speed, G) {
    // lissage : on saute les nœuds visibles
    while (this.path.length > 1) {
      const n = this.path[1], nx = n[2] ?? (n[0] + 0.5) * T, nz = n[3] ?? (n[1] + 0.5) * T;
      if (G.grid.losWide(this.pos.x, this.pos.z, nx, nz, 0.4)) this.path.shift(); else break;
    }
    if (!this.path.length) { this.curSpeed = 0; return; }
    const n = this.path[0];
    const tx = n[2] ?? (n[0] + 0.5) * T, tz = n[3] ?? (n[1] + 0.5) * T;
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { this.path.shift(); return; }
    const step = Math.min(d, speed * dt);
    this.pos.x += dx / d * step; this.pos.z += dz / d * step;
    G.grid.collide(this.pos, 0.3);
    this.faceTo(dx, dz, dt);
    this.curSpeed = speed;
  }

  setSearch(x, z, G, time = 10) {
    this.mode = 'search'; this.searchT = time;
    this.searchCenter.set(x, 0, z);
    this.goTo(x, z, G);
  }

  canSee(G, dist, dx, dz) {
    const p = G.player;
    let range = p.flashlightOn ? 19 : 8.5;
    if (p.crouch) range *= 0.65;
    let lit = false;
    if (p.flashlightOn && dist > 0.01) {
      // la lumière l'attire
      const dot = (-dx * p.fx + -dz * p.fz) / dist;
      if (dot > 0.92) { lit = true; range = Math.max(range, 26); }
    }
    if (dist > range) return false;
    if (!lit && dist > 4) {
      const dot = (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / dist;
      if (dot < 0.2) return false;
    }
    return G.grid.los(this.pos.x, this.pos.z, p.x, p.z);
  }

  update(dt, G) {
    if (this.state === 'dormant') { this.updateDormant(dt, G); return; }
    if (this.state !== 'hunt') return;
    const p = G.player, grid = G.grid;
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, dist = Math.hypot(dx, dz);
    this.dist = dist;

    const sees = this.canSee(G, dist, dx, dz);
    if (sees) {
      if (this.mode !== 'chase') { this.mode = 'chase'; this.repath = 0; G.onSpotted(); }
      this.lastSeen.set(p.x, 0, p.z); this.lostT = 0;
    } else if (this.mode !== 'chase') {
      const noise = p.sprinting ? 16 : (p.moving && !p.crouch ? 4.5 : 0);
      if (dist < noise) this.setSearch(p.x, p.z, G, 10);
    }

    let speed;
    if (this.mode === 'chase') {
      speed = 3.9 + G.fuses * 0.18 + this.speedBonus;
      if (!sees) {
        this.lostT += dt;
        if (this.lostT > 5) { this.setSearch(this.lastSeen.x, this.lastSeen.z, G, 12); G.onLost(); }
      }
      if (sees && dist < T * 2.5 && grid.losWide(this.pos.x, this.pos.z, p.x, p.z, 0.3)) {
        const step = Math.min(dist, speed * dt);
        this.pos.x += dx / dist * step; this.pos.z += dz / dist * step;
        grid.collide(this.pos, 0.3);
        this.faceTo(dx, dz, dt, 12); this.curSpeed = speed; this.path = [];
      } else {
        this.repath -= dt;
        if (this.repath <= 0 || !this.path.length) {
          this.repath = 0.35;
          const tgt = sees ? p : this.lastSeen;
          this.goTo(tgt.x, tgt.z, G);
        }
        this.follow(dt, speed, G);
      }
    } else if (this.mode === 'search') {
      speed = 2.4 + this.speedBonus;
      this.searchT -= dt;
      if (!this.path.length) {
        const [ci, cj] = grid.tileOf(this.searchCenter.x, this.searchCenter.z);
        for (let k = 0; k < 10; k++) {
          const i = ci + Math.round((Math.random() - 0.5) * 6), j = cj + Math.round((Math.random() - 0.5) * 6);
          if (!grid.solid(i, j)) { this.goTo((i + 0.5) * T, (j + 0.5) * T, G); break; }
        }
      }
      this.follow(dt, speed, G);
      if (this.searchT <= 0) { this.mode = 'wander'; this.path = []; }
    } else {
      speed = 1.5 + this.speedBonus;
      this.wanderT -= dt;
      if (!this.path.length || this.wanderT <= 0) {
        this.wanderT = 18;
        const [pi, pj] = grid.tileOf(p.x, p.z);
        for (let k = 0; k < 20; k++) {
          const i = pi + Math.round((Math.random() - 0.5) * 16), j = pj + Math.round((Math.random() - 0.5) * 16);
          if (!grid.solid(i, j) && Math.abs(i - pi) + Math.abs(j - pj) > 3) { this.goTo((i + 0.5) * T, (j + 0.5) * T, G); break; }
        }
      }
      this.follow(dt, speed, G);
    }

    if (dist < 1.05) G.onKill();

    // son
    const vol = this.mode === 'chase' ? 0.55 : this.mode === 'search' ? 0.3 : 0.18;
    G.audio.monsterVoice(this.pos.x, 2.3, this.pos.z, vol);
    this.animate(dt, this.curSpeed, G);
  }

  updateDormant(dt, G) {
    const p = G.player;
    if (!this.stalking) {
      this.stalkTimer -= dt;
      if (this.stalkTimer <= 0 && !this.tryStalk(G)) this.stalkTimer = 3;
      G.audio.monsterVoice(0, -100, 0, 0);
      return;
    }
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, dist = Math.hypot(dx, dz);
    this.dist = dist;
    this.stalkT += dt;
    this.faceTo(dx, dz, dt, 3);
    const look = (-dx * p.fx + -dz * p.fz) / dist;
    if (look > 0.93 && G.grid.los(p.x, p.z, this.pos.x, this.pos.z)) this.watchT += dt;
    G.audio.monsterVoice(this.pos.x, 2.3, this.pos.z, 0.08);
    if (this.watchT > 0.5 || dist < 7 || this.stalkT > 9) {
      const seen = this.watchT > 0.5;
      this.stalking = false; this.group.visible = false; this.pos.y = -50;
      this.stalkTimer = 22 + Math.random() * 22;
      G.onStalkVanish(seen);
    }
    this.animate(dt, 0, G);
  }

  tryStalk(G) {
    const p = G.player, grid = G.grid;
    const [pi, pj] = grid.tileOf(p.x, p.z);
    const cands = [];
    for (let j = pj - 8; j <= pj + 8; j++) for (let i = pi - 8; i <= pi + 8; i++) {
      if (grid.solid(i, j)) continue;
      const x = (i + 0.5) * T, z = (j + 0.5) * T, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < 11 || d > 24) continue;
      const dot = (dx * p.fx + dz * p.fz) / d;
      if (dot < 0.55) continue;
      if (!grid.los(p.x, p.z, x, z)) continue;
      cands.push([x, z]);
    }
    if (!cands.length) return false;
    const [x, z] = cands[Math.floor(Math.random() * cands.length)];
    this.pos.set(x, 0, z);
    this.stalking = true; this.stalkT = 0; this.watchT = 0;
    this.group.visible = true;
    this.yaw = Math.atan2(p.x - x, p.z - z);
    G.audio.clicks(x, 2.3, z);
    return true;
  }

  animate(dt, speed, G) {
    const P = this.parts;
    this.group.rotation.y = this.yaw;
    this.phase += dt * (1 + speed * 1.7);
    const sw = Math.min(1, speed / 2.2);
    P.legL.rotation.x = Math.sin(this.phase) * 0.6 * sw;
    P.legR.rotation.x = -Math.sin(this.phase) * 0.6 * sw;
    const wantReach = this.state === 'hunt' && this.mode === 'chase' ? 1 : 0;
    this.reach += (wantReach - this.reach) * Math.min(1, dt * 4);
    P.armL.rotation.x = -0.4 - Math.sin(this.phase) * 0.45 * sw - this.reach * 1.0;
    P.armR.rotation.x = -0.4 + Math.sin(this.phase) * 0.45 * sw - this.reach * 1.0;
    P.armL.rotation.z = 0.1; P.armR.rotation.z = -0.1;
    P.hips.position.y = 1.3 + Math.abs(Math.sin(this.phase)) * 0.05 * sw;
    P.spine.rotation.z = Math.sin(this.phase) * 0.07 * sw;
    // pas
    if (speed > 0.5) {
      const s = Math.floor(this.phase / Math.PI);
      if (s !== this.lastStep) { this.lastStep = s; G.audio.monsterStep(this.pos.x, 0.2, this.pos.z, this.mode === 'chase' ? 0.9 : 0.5); }
    }
    // tics de la tête
    this.twitchT -= dt;
    if (this.twitchT <= 0) {
      this.twitchT = 0.12 + Math.random() * (this.mode === 'chase' ? 0.5 : 2.2);
      this.headTarget.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 1.3);
    }
    const k = Math.min(1, dt * 22);
    P.head.rotation.x += (-0.7 + this.headTarget.x - P.head.rotation.x) * k;
    P.head.rotation.y += (this.headTarget.y - P.head.rotation.y) * k;
    P.head.rotation.z += (this.headTarget.z - P.head.rotation.z) * k;
  }
}
