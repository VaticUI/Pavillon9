// Construction de la scène 3D à partir du niveau généré
import * as THREE from 'three';
import { T, WALL_H, DIRS, Grid } from './level.js';
import { writing } from './textures.js';

const PHRASES = ['IL TE VOIT', 'NE COURS PAS', 'ÉTEINS LA LUMIÈRE', 'PATIENT 9', 'PAS DE SORTIE', 'IL COMPTE',
  '9 9 9 9 9 9', 'AIDEZ-MOI', 'DERRIÈRE TOI', 'IL NE DORT JAMAIS', 'ON NE SORT PAS', 'CACHE-TOI'];

export function buildWorld(level, tex) {
  const group = new THREE.Group();
  const grid = new Grid(level);
  const { W, H } = level;
  const rng = level.rng;
  const cx = (i) => (i + 0.5) * T;

  // --- Murs (2 variantes instanciées)
  const wallGeo = new THREE.BoxGeometry(T, WALL_H, T);
  const variants = [[], []];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!grid.solid(i, j)) continue;
    let near = false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!grid.solid(i + di, j + dj)) near = true;
    if (near) variants[rng() < 0.2 ? 1 : 0].push([i, j]);
  }
  [tex.wall, tex.wallDamaged].forEach((map, v) => {
    const list = variants[v];
    if (!list.length) return;
    const im = new THREE.InstancedMesh(wallGeo, new THREE.MeshStandardMaterial({ map, roughness: 0.92 }), list.length);
    const m = new THREE.Matrix4();
    list.forEach(([i, j], k) => { m.makeTranslation(cx(i), WALL_H / 2, cx(j)); im.setMatrixAt(k, m); });
    im.castShadow = im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  });

  // --- Sol & plafond
  const floorTex = tex.floor.clone(); floorTex.repeat.set(W, H); floorTex.needsUpdate = true; floorTex.userData.owned = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * T, H * T), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(W * T / 2, 0, H * T / 2); floor.receiveShadow = true;
  const ceilTex = tex.ceiling.clone(); ceilTex.repeat.set(W * 1.5, H * 1.5); ceilTex.needsUpdate = true; ceilTex.userData.owned = true;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * T, H * T), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W * T / 2, WALL_H, H * T / 2); ceil.receiveShadow = true;
  group.add(floor, ceil);

  const floors = grid.floorTiles();
  const isSpecial = new Set([`1,1`, `${level.exit[0]},${level.exit[1]}`, ...level.fuses.map(f => `${f[0]},${f[1]}`)]);

  // --- Lampes
  const lamps = [];
  const lampTiles = [[1, 1]];
  const shuffled = floors.slice().sort(() => rng() - 0.5);
  for (const t of shuffled) {
    if (lampTiles.length >= 16) break;
    if (lampTiles.every(l => Math.abs(l[0] - t[0]) + Math.abs(l[1] - t[1]) > 4)) lampTiles.push(t);
  }
  lampTiles.forEach(([i, j], k) => {
    const mode = k === 0 ? 'steady' : k < 9 ? (rng() < 0.55 ? 'flicker' : 'steady') : 'dead';
    const mat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff0c8, emissiveIntensity: mode === 'dead' ? 0 : 2 });
    const fix = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.28), mat);
    fix.position.set(cx(i), WALL_H - 0.05, cx(j));
    if (mode === 'dead') {
      fix.position.y = WALL_H - 0.45; fix.rotation.z = 0.5 + rng() * 0.4; fix.rotation.y = rng() * Math.PI;
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      cable.position.set(cx(i), WALL_H - 0.22, cx(j)); group.add(cable);
    }
    group.add(fix);
    let light = null;
    if (mode !== 'dead') {
      light = new THREE.PointLight(0xffe2b0, 7, 11, 2);
      light.position.set(cx(i), WALL_H - 0.35, cx(j));
      group.add(light);
    }
    lamps.push({ mat, light, mode, base: 7, t: rng() * 10, off: 0, x: cx(i), z: cx(j) });
  });

  // --- Porte de sortie
  const [ei, ej] = level.exit, [ddx, ddz] = level.doorDir;
  const face = new THREE.Vector3(cx(ei) + ddx * T / 2, 0, cx(ej) + ddz * T / 2);
  const rotY = Math.atan2(ddx, ddz);
  const doorMat = new THREE.MeshStandardMaterial({ map: tex.door, roughness: 0.6, metalness: 0.4 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.12), doorMat);
  door.position.set(face.x - ddx * 0.05, 1.2, face.z - ddz * 0.05); door.rotation.y = rotY; door.castShadow = door.receiveShadow = true;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.6 });
  const frame = new THREE.Group();
  const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.55, 0.2), frameMat); f1.position.set(0.8, 1.27, 0);
  const f2 = f1.clone(); f2.position.x = -0.8;
  const f3 = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 0.2), frameMat); f3.position.set(0, 2.5, 0);
  frame.add(f1, f2, f3); frame.position.set(face.x - ddx * 0.05, 0, face.z - ddz * 0.05); frame.rotation.y = rotY;
  const signMat = new THREE.MeshBasicMaterial({ map: tex.exitOff });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), signMat);
  sign.position.set(face.x - ddx * 0.08, 2.75, face.z - ddz * 0.08); sign.rotation.y = rotY + Math.PI;
  const indMat = new THREE.MeshBasicMaterial({ color: 0xff2010 });
  const ind = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), indMat);
  const side = new THREE.Vector3(ddz, 0, -ddx);
  ind.position.set(face.x - ddx * 0.1 + side.x * 1.0, 1.5, face.z - ddz * 0.1 + side.z * 1.0);
  const doorLight = new THREE.PointLight(0xff2010, 2.5, 8, 2);
  doorLight.position.set(face.x - ddx * 0.7, 2.4, face.z - ddz * 0.7);
  group.add(door, frame, sign, ind, doorLight);
  const doorInfo = { pos: new THREE.Vector3(face.x - ddx * 0.2, 1.3, face.z - ddz * 0.2), signMat, indMat, light: doorLight };

  // --- Décor
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a8d8f, roughness: 0.45, metalness: 0.7 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.8, metalness: 0.3 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.85 });
  const boxMat = new THREE.MeshStandardMaterial({ map: tex.cardboard, roughness: 0.95 });
  const matMat = new THREE.MeshStandardMaterial({ map: tex.mattress, roughness: 0.95 });
  const bloodMat = new THREE.MeshBasicMaterial({ map: tex.blood, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, color: 0x999999 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 1, side: THREE.DoubleSide });
  const shadow = (o) => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

  const bed = () => {
    const b = new THREE.Group();
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 2.0), metal); fr.position.y = 0.5; b.add(fr);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.15, 1.9), matMat); m.position.y = 0.62; m.rotation.z = (rng() - 0.5) * 0.1; b.add(m);
    for (const [x, z] of [[0.43, 0.95], [-0.43, 0.95], [0.43, -0.95], [-0.43, -0.95]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5), metal); l.position.set(x, 0.25, z); b.add(l);
    }
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 0.04), metal); hb.position.set(0, 0.8, -1.0); b.add(hb);
    // sangles
    for (const z of [-0.3, 0.4]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.08), woodMat); s.position.set(0, 0.63, z); b.add(s); }
    return shadow(b);
  };
  const chair = () => {
    const c = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.45), woodMat); seat.position.y = 0.45; c.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.04), woodMat); back.position.set(0, 0.7, -0.21); c.add(back);
    for (const [x, z] of [[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45), rust); l.position.set(x, 0.225, z); c.add(l);
    }
    if (rng() < 0.5) { c.rotation.x = Math.PI / 2 * (rng() < 0.5 ? 1 : -1); c.position.y = 0.2; }
    return shadow(c);
  };
  const boxes = () => {
    const g = new THREE.Group();
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const s = 0.4 + rng() * 0.3;
      const b = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), boxMat);
      b.position.set((rng() - 0.5) * 0.4, s * 0.4 + (k > 1 ? 0.5 : 0), (rng() - 0.5) * 0.4); b.rotation.y = rng() * 3;
      g.add(b);
    }
    return shadow(g);
  };
  const wheelchair = () => {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.45), woodMat); seat.position.y = 0.5; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.04), woodMat); back.position.set(0, 0.78, -0.22); g.add(back);
    for (const s of [1, -1]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 16), metal); w.position.set(0.3 * s, 0.3, -0.05); w.rotation.y = Math.PI / 2; g.add(w);
    }
    return shadow(g);
  };

  const wallSlots = [];
  for (const [i, j] of floors) {
    if (i === 1 && j === 1) continue;
    const key = `${i},${j}`;
    const walls = DIRS.filter(([dx, dz]) => grid.solid(i + dx, j + dz));
    walls.forEach(d => wallSlots.push([i, j, d]));
    if (isSpecial.has(key)) continue;
    const r = rng();
    const place = (obj, towardWall = true) => {
      let ox = (rng() - 0.5) * 1.2, oz = (rng() - 0.5) * 1.2;
      if (towardWall && walls.length) { const [dx, dz] = walls[Math.floor(rng() * walls.length)]; ox = dx * 1.0 + (rng() - 0.5) * 0.8 * (1 - Math.abs(dx)); oz = dz * 1.0 + (rng() - 0.5) * 0.8 * (1 - Math.abs(dz)); }
      obj.position.x += cx(i) + ox; obj.position.z += cx(j) + oz;
      obj.rotation.y += rng() * Math.PI * 2;
      group.add(obj);
    };
    if (r < 0.06) place(chair());
    else if (r < 0.1) place(boxes());
    else if (r < 0.12) place(wheelchair());
    else if (r < 0.15 && walls.length === 2) {
      // brancard le long du couloir
      const b = bed(); const horiz = !grid.solid(i + 1, j);
      b.rotation.y = horiz ? Math.PI / 2 : 0;
      const [dx, dz] = walls[0]; b.position.set(cx(i) + dx * 0.8, 0, cx(j) + dz * 0.8);
      if ((horiz && dx !== 0) || (!horiz && dz !== 0)) b.position.set(cx(i), 0, cx(j));
      group.add(b);
    }
    if (rng() < 0.1) {
      const bl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bloodMat);
      const s = 0.8 + rng() * 1.4; bl.scale.set(s, s, 1);
      bl.rotation.x = -Math.PI / 2; bl.rotation.z = rng() * Math.PI * 2;
      bl.position.set(cx(i) + (rng() - 0.5) * 1.5, 0.01, cx(j) + (rng() - 0.5) * 1.5);
      group.add(bl);
    }
    if (rng() < 0.08) {
      for (let k = 0; k < 4; k++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), paperMat);
        p.rotation.x = -Math.PI / 2; p.rotation.z = rng() * 6;
        p.position.set(cx(i) + (rng() - 0.5) * 2, 0.012 + k * 0.001, cx(j) + (rng() - 0.5) * 2);
        group.add(p);
      }
    }
    if (rng() < 0.12 && walls.length === 2) {
      // tuyau au plafond
      const horiz = !grid.solid(i + 1, j) || !grid.solid(i - 1, j);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, T, 8), rust);
      pipe.rotation.z = horiz ? Math.PI / 2 : 0; pipe.rotation.x = horiz ? 0 : Math.PI / 2;
      pipe.position.set(cx(i) + (horiz ? 0 : 1.1), WALL_H - 0.2, cx(j) + (horiz ? 1.1 : 0));
      pipe.castShadow = true; group.add(pipe);
    }
  }
  // lits dans les dortoirs
  for (const room of level.rooms) {
    for (let k = 0; k < 3; k++) {
      const b = bed();
      b.position.set(cx(room.x) + 0.8 + k * 3, 0, cx(room.y) + 0.3 + rng() * 0.4);
      b.rotation.y = (rng() - 0.5) * 0.4;
      group.add(b);
    }
  }

  // Inscriptions murales
  const writeCount = 14;
  const wslots = wallSlots.sort(() => rng() - 0.5).slice(0, writeCount);
  wslots.forEach(([i, j, [dx, dz]], k) => {
    const map = writing(PHRASES[k % PHRASES.length]); map.userData.owned = true;
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, color: 0xaaaaaa });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), mat);
    p.position.set(cx(i) + dx * (T / 2 - 0.02), 1.3 + rng() * 0.8, cx(j) + dz * (T / 2 - 0.02));
    p.rotation.y = Math.atan2(-dx, -dz);
    p.rotation.z = (rng() - 0.5) * 0.15;
    group.add(p);
  });

  // --- Objets à ramasser
  const pickups = [];
  const glowMat = (color, opacity) => new THREE.SpriteMaterial({ map: tex.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

  level.fuses.forEach(([i, j]) => {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.5), rust); top.position.y = 0.8; g.add(top);
    for (const [x, z] of [[0.27, 0.22], [-0.27, 0.22], [0.27, -0.22], [-0.27, -0.22]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8), rust); l.position.set(x, 0.4, z); g.add(l);
    }
    shadow(g);
    const fuse = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff7a18, emissiveIntensity: 2.5, roughness: 0.2 }));
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 10), metal); c1.position.y = 0.095;
    const c2 = c1.clone(); c2.position.y = -0.095;
    fuse.add(glass, c1, c2); fuse.rotation.z = Math.PI / 2; fuse.position.y = 0.9;
    const glow = new THREE.Sprite(glowMat(0xff8a30, 0.7)); glow.scale.set(0.9, 0.9, 1); glow.position.y = 0.9;
    g.add(fuse, glow);
    g.position.set(cx(i) + (rng() - 0.5) * 0.6, 0, cx(j) + (rng() - 0.5) * 0.6);
    group.add(g);
    pickups.push({ type: 'fuse', obj: g, anim: fuse, pos: new THREE.Vector3(g.position.x, 0.9, g.position.z), taken: false });
  });
  level.batteries.forEach(([i, j]) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.5, emissive: 0x2a8a3a, emissiveIntensity: 0.5 }));
    b.rotation.z = Math.PI / 2; b.position.y = 0.03; b.castShadow = true;
    const glow = new THREE.Sprite(glowMat(0x60ff80, 0.25)); glow.scale.set(0.4, 0.4, 1); glow.position.y = 0.05;
    g.add(b, glow);
    g.position.set(cx(i) + (rng() - 0.5) * 1.5, 0, cx(j) + (rng() - 0.5) * 1.5); g.rotation.y = rng() * 6;
    group.add(g);
    pickups.push({ type: 'battery', obj: g, pos: new THREE.Vector3(g.position.x, 0.05, g.position.z), taken: false });
  });
  level.notes.forEach(([i, j]) => {
    const mat = new THREE.MeshStandardMaterial({ map: tex.note, roughness: 1, emissive: 0xffffff, emissiveMap: tex.note, emissiveIntensity: 0.12, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.35), mat);
    p.rotation.x = -Math.PI / 2; p.rotation.z = rng() * 6;
    p.position.set(cx(i) + (rng() - 0.5) * 1.4, 0.015, cx(j) + (rng() - 0.5) * 1.4);
    group.add(p);
    pickups.push({ type: 'note', obj: p, pos: p.position.clone(), taken: false });
  });

  return { group, grid, lamps, door: doorInfo, pickups };
}

export function disposeGroup(group) {
  group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        // les textures partagées (tex.*) ne sont pas libérées ; seules les clones/écritures le sont
        if (m.map && m.map.userData.owned) m.map.dispose();
        m.dispose();
      }
    }
  });
}
