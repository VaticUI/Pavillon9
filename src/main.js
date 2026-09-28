// PAVILLON 9 — jeu d'horreur à la première personne
import * as THREE from 'three';
import { AudioSys } from './audio.js';
import { makeTextures } from './textures.js';
import { generateLevel, T, WALL_H } from './level.js';
import { buildWorld, disposeGroup } from './world.js';
import { Monster } from './monster.js';

const NOTES = [
  "Jour 3.\n\nLes infirmières disent que le patient 9 ne dort jamais. Il reste debout, face au mur, et il compte. Personne ne sait jusqu'à combien.",
  "Jour 11.\n\nIl a arrêté de manger. Il a arrêté de parler. Mais la nuit, on l'entend marcher dans les couloirs — alors que sa porte est verrouillée de l'extérieur.",
  "Ne l'éclairez pas.\n\nLa lumière l'attire. J'ai éteint ma lampe et je me suis accroupie. Il est passé à côté de moi. Je sentais son souffle sur ma nuque.",
  "Le Dr Morel a fait couper le courant du pavillon. Il dit que dans le noir, il se perd.\n\nIl avait tort. Dans le noir, c'est NOUS qui nous perdons.",
  "S'il te voit, cours. Casse sa ligne de vue, tourne, tourne encore.\n\nMais ne cours pas trop longtemps. Lui ne se fatigue jamais.",
];

// ---------- Paramètres
const settings = { sens: 1, bright: 1, vol: 0.8, quality: 0.5 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('p9-settings') || '{}')); } catch (e) { /* stockage indisponible */ }
const saveSettings = () => { try { localStorage.setItem('p9-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } };

// ---------- Rendu
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.075);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 80);
camera.rotation.order = 'YXZ';
scene.add(camera);

const ambient = new THREE.AmbientLight(0x7080a0, 0.05);
scene.add(ambient);

const flash = new THREE.SpotLight(0xfff0da, 40, 32, 0.52, 0.25, 1.6);
flash.castShadow = true;
flash.map = (() => {
  // "cookie" de lampe torche : point chaud, anneau, bords doux
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, '#f2f2f2'); g.addColorStop(0.3, '#9a9a9a');
  g.addColorStop(0.38, '#b8b8b8'); g.addColorStop(0.5, '#5a5a5a'); g.addColorStop(0.8, '#1c1c1c'); g.addColorStop(1, '#000000');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; x.beginPath(); x.arc(128 + (Math.random() - 0.5) * 200, 128 + (Math.random() - 0.5) * 200, 2 + Math.random() * 10, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); return t;
})();
flash.shadow.mapSize.set(1024, 1024);
flash.shadow.camera.near = 0.2; flash.shadow.camera.far = 32;
flash.shadow.bias = -0.0004;
scene.add(flash, flash.target);
const spill = new THREE.PointLight(0xfff0da, 0.5, 5, 2);
scene.add(spill);

// Post-traitement (basse résolution + grain + vignette + aberration)
let rt = null;
const post = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 },
    fear: { value: 0 }, flash: { value: 0 }, exposure: { value: 1 }, fade: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 res; uniform float time, fear, flash, exposure, fade;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      uv.x += sin(uv.y * 28.0 + time * 7.0) * 0.004 * fear;
      vec2 dir = uv - 0.5;
      float ab = 0.004 + fear * 0.02;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ab).b;
      col *= exposure;
      col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
      col = pow(col, vec3(1.0 / 2.2));
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 0.72) * vec3(1.03, 0.98, 0.9);
      float n = hash(floor(vUv * res) + fract(time * 13.1) * vec2(91.7, 33.3)) - 0.5;
      col += n * (0.06 + fear * 0.14);
      float d = length(dir * vec2(1.0, 0.85));
      col *= 1.0 - smoothstep(0.3 - fear * 0.12, 0.9, d) * 0.97;
      col = mix(col, vec3(0.5, 0.0, 0.0), flash);
      col *= 1.0 - fade;
      gl_FragColor = vec4(col, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const rw = Math.max(320, Math.floor(w * settings.quality)), rh = Math.max(180, Math.floor(h * settings.quality));
  if (rt) rt.dispose();
  rt = new THREE.WebGLRenderTarget(rw, rh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
  post.uniforms.tDiffuse.value = rt.texture;
  post.uniforms.res.value.set(rw, rh);
}
addEventListener('resize', resize);
resize();

// ---------- Monde
const audio = new AudioSys();
audio.volume = settings.vol;
const tex = makeTextures();
const monster = new Monster();
scene.add(monster.group);
let world = null, level = null;

const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
  stamina: 100, exhausted: false, battery: 100, flashlightOn: true,
  fuses: 0, notes: 0, bob: 0, crouchK: 0, lastStep: 0,
};
const game = { mode: 'boot', time: 0, playTime: 0, fear: 0, hbTimer: 0, eventTimer: 30, flicker: 0, flashTimer: 0,
  red: 0, fade: 0, dieT: 0, powered: false, schedule: [], breathT: 0, interact: null, seenOnce: false };

function newWorld() {
  if (world) { scene.remove(world.group); disposeGroup(world.group); }
  level = generateLevel((Math.random() * 1e9) | 0);
  world = buildWorld(level, tex);
  scene.add(world.group);
  monster.reset();
  const [si, sj] = level.start;
  player.pos.set((si + 0.5) * T, 0, (sj + 0.5) * T);
  const open = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dz]) => !world.grid.solid(si + dx, sj + dz));
  player.yaw = Math.atan2(-open[0], -open[1]);
  // regarder vers le plus long couloir visible
  let bd = 0;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
    let d = 0;
    while (d < 40 && !world.grid.solidAt(player.pos.x - Math.sin(a) * d, player.pos.z - Math.cos(a) * d)) d += 0.5;
    if (d > bd) { bd = d; player.yaw = a; }
  }
  player.pitch = 0;
}

// ---------- UI
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), menu: $('menu'), pause: $('pause'), death: $('death'), win: $('win'), note: $('note'),
  noteText: $('noteText'), prompt: $('prompt'), sub: $('subtitle'), fuses: $('fuseCount'), batt: $('batt'), stam: $('stam'),
};
const screens = ['menu', 'pause', 'death', 'win', 'note'];
function show(name) {
  for (const s of screens) ui[s].classList.toggle('hidden', s !== name);
  ui.hud.classList.toggle('hidden', !(name === null || name === 'note'));
}
let subTimeout = 0;
function subtitle(text, dur = 4) {
  ui.sub.textContent = text; ui.sub.style.opacity = 1;
  clearTimeout(subTimeout);
  subTimeout = setTimeout(() => { ui.sub.style.opacity = 0; }, dur * 1000);
}
const at = (delay, fn) => game.schedule.push({ t: game.playTime + delay, fn });
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- Entrées
const keys = new Set();
let locked = false;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.repeat) return;
  if (game.mode === 'playing') {
    if (e.code === 'KeyF') toggleFlashlight();
    if (e.code === 'KeyE') doInteract();
  } else if (game.mode === 'note' && (e.code === 'KeyE' || e.code === 'Space')) closeNote();
  if (e.code === 'Escape' && game.mode === 'playing' && !locked) pauseGame();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousemove', (e) => {
  if (!locked || (game.mode !== 'playing')) return;
  const s = 0.0022 * settings.sens;
  player.yaw -= e.movementX * s;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * s));
});
function lock() {
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked) {
    if (game.mode === 'playing') pauseGame();
    else if (game.mode === 'note') { closeNote(); pauseGame(); }
  }
});
canvas.addEventListener('click', () => { if (game.mode === 'playing' && !locked) lock(); });

// ---------- Flux de jeu
function startGame() {
  audio.init(); audio.setVolume(settings.vol);
  newWorld();
  Object.assign(player, { stamina: 100, exhausted: false, battery: 100, flashlightOn: true, fuses: 0, notes: 0, crouchK: 0 });
  player.vel.set(0, 0, 0);
  Object.assign(game, { mode: 'playing', playTime: 0, fear: 0, eventTimer: 35, red: 0, fade: 1, powered: false, schedule: [], seenOnce: false, flicker: 0 });
  ui.fuses.textContent = '0';
  show(null);
  lock();
  at(0.5, () => subtitle('Pavillon 9 — 02h47.', 3.5));
  at(4.5, () => subtitle('Le courant est coupé. La porte de sortie ne s\'ouvrira pas sans le générateur.', 5));
  at(10, () => subtitle('Trouve les 5 fusibles.', 4));
  at(15, () => subtitle('[F] Lampe   [Maj] Courir   [C] S\'accroupir   [E] Interagir', 5));
}
function pauseGame() { game.mode = 'paused'; show('pause'); keys.clear(); }
function resumeGame() { game.mode = 'playing'; show(null); lock(); }
function toMenu() {
  game.mode = 'menu'; show('menu');
  if (document.pointerLockElement) document.exitPointerLock();
  newWorld();
  game.fade = 1;
}

function toggleFlashlight() {
  if (player.battery <= 0) { audio.click(); subtitle('La pile est vide.', 2); return; }
  player.flashlightOn = !player.flashlightOn; audio.click();
}

function doInteract() {
  const it = game.interact;
  if (!it) return;
  if (it === 'door') {
    if (!game.powered) { audio.locked(); subtitle(`La porte est verrouillée. Il manque ${5 - player.fuses} fusible${5 - player.fuses > 1 ? 's' : ''}.`, 3); return; }
    winGame(); return;
  }
  it.taken = true; it.obj.visible = false;
  if (it.type === 'fuse') {
    player.fuses++; ui.fuses.textContent = player.fuses; audio.pickup();
    subtitle(`Fusible récupéré (${player.fuses}/5).`, 3);
    if (player.fuses === 1) {
      at(2.5, () => {
        monster.startHunt(ctx());
        audio.distantScream(monster.pos.x, 2, monster.pos.z);
        subtitle('... quelque chose s\'est réveillé.', 4);
      });
    }
    if (player.fuses === 5) powerOn();
  } else if (it.type === 'battery') {
    player.battery = Math.min(100, player.battery + 50); audio.click(); audio.pickup();
    subtitle('Pile récupérée.', 2);
  } else if (it.type === 'note') {
    audio.paper();
    ui.noteText.textContent = NOTES[player.notes % NOTES.length];
    player.notes++;
    game.mode = 'note'; show('note'); keys.clear();
  }
}
function closeNote() { audio.paper(); game.mode = 'playing'; show(null); }

function powerOn() {
  game.powered = true;
  audio.powerUp();
  world.door.signMat.map = tex.exitOn; world.door.signMat.needsUpdate = true;
  world.door.indMat.color.set(0x30ff60);
  world.door.light.color.set(0x40ff70);
  for (const l of world.lamps) if (l.light) l.off = 1.5;
  at(0.3, () => subtitle('Le courant est rétabli. La porte de sortie est ouverte.', 4));
  at(4.5, () => { subtitle('Il sait où tu es. COURS.', 4); audio.distantScream(monster.pos.x, 2, monster.pos.z); monster.enrage(ctx()); });
}

function winGame() {
  game.mode = 'won';
  if (document.pointerLockElement) document.exitPointerLock();
  audio.monsterVoice(0, -100, 0, 0); audio.setTension(0);
  $('winStats').textContent = `Temps : ${fmtTime(game.playTime)}  —  Notes lues : ${player.notes}/5`;
  game.fade = 0;
  const f = () => { game.fade = Math.min(1, game.fade + 0.02); if (game.fade < 1) requestAnimationFrame(f); else show('win'); };
  f();
}

function killPlayer() {
  if (game.mode !== 'playing') return;
  game.mode = 'dying'; game.dieT = 0; game.red = 0.3;
  // direction d'arrivée de la créature (espace libre garanti)
  const mdx = monster.pos.x - player.pos.x, mdz = monster.pos.z - player.pos.z, md = Math.hypot(mdx, mdz);
  game.killDir = md > 0.05 && md < 2 ? new THREE.Vector3(mdx / md, 0, mdz / md) : null;
  clearTimeout(subTimeout); ui.hud.classList.add('hidden');
  audio.scream();
  player.flashlightOn = true;
  monster.parts.jaw.scale.set(0.8, 1.3, 0.4);
  $('deathStats').textContent = `Fusibles : ${player.fuses}/5  —  Survécu ${fmtTime(game.playTime)}`;
}

// Contexte partagé avec l'IA
function ctx() {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const moving = player.vel.lengthSq() > 0.5;
  return {
    grid: world.grid, audio, fuses: player.fuses,
    player: { x: player.pos.x, z: player.pos.z, fx, fz, flashlightOn: player.flashlightOn && player.battery > 0,
      crouch: player.crouchK > 0.5, sprinting: player.sprinting && moving, moving },
    onSpotted: () => {
      audio.stinger(game.seenOnce ? 0.35 : 0.6); game.seenOnce = true;
      if (Math.random() < 0.5) subtitle('Il t\'a vu.', 2);
    },
    onLost: () => {},
    onKill: killPlayer,
    onStalkVanish: (seen) => { game.flicker = 0.35; if (seen) audio.stinger(0.35); },
  };
}

// ---------- Boucle
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  game.time += dt;
  if (!world) return;
  if (game.mode === 'playing') updatePlaying(dt);
  else if (game.mode === 'dying') updateDying(dt);
  else if (game.mode === 'menu') updateMenu(dt);
  if (game.mode !== 'won' && game.mode !== 'dead') game.fade = Math.max(0, game.fade - dt * 0.8);
  if (game.mode === 'dead') game.fade = Math.min(0.85, game.fade + dt);
  updateLamps(dt);
  updateFlashlight(dt);
  for (const p of world.pickups) if (p.anim && !p.taken) { p.anim.rotation.y += dt * 1.2; p.anim.position.y = 0.9 + Math.sin(game.time * 2) * 0.02; }
  render();
}

function updateMenu(dt) {
  const [si, sj] = level.start;
  camera.position.set((si + 0.5) * T, 1.55, (sj + 0.5) * T);
  camera.rotation.set(Math.sin(game.time * 0.13) * 0.12 - 0.05, player.yaw + Math.sin(game.time * 0.08) * 0.7, 0);
  player.flashlightOn = true; player.battery = 100;
  game.fear = 0.15;
}

function updatePlaying(dt) {
  game.playTime += dt;
  for (let i = game.schedule.length - 1; i >= 0; i--) if (game.schedule[i].t <= game.playTime) { const s = game.schedule.splice(i, 1)[0]; s.fn(); }

  // --- déplacement
  const crouch = keys.has('KeyC') || keys.has('ControlLeft');
  player.crouchK += ((crouch ? 1 : 0) - player.crouchK) * Math.min(1, dt * 8);
  let ix = 0, iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  const moving = ix || iz;
  const wantSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && iz > 0 && !crouch;
  player.sprinting = wantSprint && !player.exhausted && player.stamina > 0;
  const speed = player.sprinting ? 5.6 : crouch ? 1.5 : 2.9;
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  let wx = fx * iz + rx * ix, wz = fz * iz + rz * ix;
  const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl;
  const k = Math.min(1, dt * 10);
  player.vel.x += ((moving ? wx * speed : 0) - player.vel.x) * k;
  player.vel.z += ((moving ? wz * speed : 0) - player.vel.z) * k;
  player.pos.x += player.vel.x * dt; player.pos.z += player.vel.z * dt;
  world.grid.collide(player.pos, 0.35);
  world.grid.collide(player.pos, 0.35);

  // --- endurance
  if (player.sprinting && moving) player.stamina -= dt * 18;
  else player.stamina += dt * (moving ? 9 : 15);
  player.stamina = Math.max(0, Math.min(100, player.stamina));
  if (player.stamina <= 0) player.exhausted = true;
  if (player.exhausted && player.stamina > 35) player.exhausted = false;
  if (player.stamina < 45) {
    game.breathT -= dt;
    if (game.breathT <= 0) { game.breathT = player.exhausted ? 0.55 : 0.9; audio.breath(0.05 + (45 - player.stamina) / 45 * 0.12); }
  }

  // --- caméra & pas
  const hs = Math.hypot(player.vel.x, player.vel.z);
  player.bob += hs * dt * 2.1;
  const eye = 1.6 - player.crouchK * 0.65;
  camera.position.set(player.pos.x, eye + Math.sin(player.bob * 2) * 0.035 * Math.min(1, hs / 3), player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, Math.sin(player.bob) * 0.006 * hs);
  const step = Math.floor(player.bob / Math.PI);
  if (step !== player.lastStep && hs > 0.5) { player.lastStep = step; audio.footstep(player.sprinting ? 0.35 : crouch ? 0.07 : 0.18, player.sprinting); }

  // --- pile
  if (player.flashlightOn && player.battery > 0) {
    player.battery -= dt * 0.75;
    if (player.battery <= 0) { player.battery = 0; player.flashlightOn = false; audio.click(); subtitle('La pile est morte...', 3); }
  }

  // --- interaction
  const cf = new THREE.Vector3(); camera.getWorldDirection(cf);
  let best = null, bestDot = 0.72;
  const v = new THREE.Vector3();
  for (const p of world.pickups) {
    if (p.taken) continue;
    v.subVectors(p.pos, camera.position);
    const d = v.length();
    if (d > 2.3) continue;
    const dot = v.dot(cf) / d;
    if (dot > bestDot) { bestDot = dot; best = p; }
  }
  v.subVectors(world.door.pos, camera.position);
  if (v.length() < 2.6 && v.dot(cf) / v.length() > 0.55) best = best || 'door';
  game.interact = best;
  const labels = { fuse: '[E] Prendre le fusible', battery: '[E] Prendre la pile', note: '[E] Lire la note' };
  ui.prompt.textContent = best ? (best === 'door' ? (game.powered ? '[E] S\'échapper' : '[E] Ouvrir la porte') : labels[best.type]) : '';

  // --- créature
  const G = ctx();
  monster.update(dt, G);

  // --- peur
  let target = 0;
  if (monster.state === 'hunt') {
    target = Math.max(0, 1 - monster.dist / 20) * 0.8;
    if (monster.mode === 'chase') target = Math.max(target, 0.55) + 0.25 * Math.max(0, 1 - monster.dist / 10);
  } else if (monster.stalking) target = 0.3;
  game.fear += (Math.min(1, target) - game.fear) * Math.min(1, dt * 2);
  audio.setTension(monster.state === 'hunt' && monster.mode === 'chase' ? 0.5 + game.fear * 0.5 : game.fear * 0.3);
  game.hbTimer -= dt;
  if (game.fear > 0.18 && game.hbTimer <= 0) { game.hbTimer = 1.15 - game.fear * 0.8; audio.heartbeat(0.12 + game.fear * 0.4); }

  // --- événements aléatoires
  game.eventTimer -= dt;
  if (game.eventTimer <= 0) {
    game.eventTimer = (monster.state === 'hunt' ? 18 : 28) + Math.random() * 25;
    const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 12;
    const ex = player.pos.x + Math.cos(a) * d, ez = player.pos.z + Math.sin(a) * d;
    const r = Math.random();
    if (r < 0.3) audio.bang(0.8, ex, 1.5, ez);
    else if (r < 0.55) audio.whisper(player.pos.x + Math.cos(a) * 2.5, 1.7, player.pos.z + Math.sin(a) * 2.5);
    else if (r < 0.75) { for (const l of world.lamps) if (l.light) l.off = 0.4 + Math.random() * 1.2; game.flicker = 0.8; }
    else if (r < 0.9) audio.clicks(ex, 2.2, ez);
    else {
      const alive = world.lamps.filter(l => l.light && l.mode !== 'dead');
      if (alive.length > 3) { const l = alive[Math.floor(Math.random() * alive.length)]; l.mode = 'dying'; audio.bang(0.3, l.x, 2.8, l.z); }
    }
  }

  audio.setListener(camera.position, cf);

  // HUD
  ui.batt.style.width = player.battery + '%';
  ui.batt.classList.toggle('low', player.battery < 20);
  ui.stam.style.width = player.stamina + '%';
  ui.stam.classList.toggle('low', player.exhausted);
}

const _v = new THREE.Vector3();
function updateDying(dt) {
  game.dieT += dt;
  const t = game.dieT;
  const cf = new THREE.Vector3();
  if (game.killDir) cf.copy(game.killDir); else { camera.getWorldDirection(cf); cf.y = 0; cf.normalize(); }
  const dist = Math.max(0.8, 1.6 - t * 5);
  // on place la tête de la créature face à la caméra
  monster.group.visible = true;
  monster.yaw = Math.atan2(-cf.x, -cf.z);
  monster.group.rotation.y = monster.yaw;
  monster.group.position.set(0, 0, 0);
  monster.group.updateMatrixWorld(true);
  monster.parts.head.getWorldPosition(_v);
  const target = camera.position.clone().addScaledVector(cf, dist);
  monster.group.position.set(target.x - _v.x, target.y - _v.y - 0.12, target.z - _v.z);
  const P = monster.parts;
  P.head.rotation.set(-0.7, 0, Math.sin(t * 40) * 0.2);
  P.armL.rotation.set(-1.2, 0, 1.1); P.armR.rotation.set(-1.2, 0, -1.1);
  monster.group.updateMatrixWorld(true);
  P.head.children[0].getWorldPosition(_v);
  camera.lookAt(_v);
  const shake = Math.max(0, 1 - t / 1.4) * 0.05;
  camera.rotation.x += (Math.random() - 0.5) * shake;
  camera.rotation.y += (Math.random() - 0.5) * shake;
  game.red = t < 0.12 ? 0.3 : Math.max(0, game.red - dt * 0.8);
  game.fear = 1;
  if (t > 1.5) {
    game.mode = 'dead'; game.fade = 1;
    monster.group.visible = false;
    audio.monsterVoice(0, -100, 0, 0); audio.setTension(0);
    if (document.pointerLockElement) document.exitPointerLock();
    show('death');
  }
}

function updateLamps(dt) {
  for (const l of world.lamps) {
    if (!l.light) continue;
    l.t += dt;
    let f = 1;
    if (l.mode === 'flicker') {
      const s = Math.sin(l.t * 3.1) + Math.sin(l.t * 7.7) + Math.sin(l.t * 13.3);
      f = s > 2.1 ? 0.05 : (Math.random() < 0.02 ? 0.2 : 1);
    } else if (l.mode === 'dying') {
      f = Math.random() < 0.5 ? 0 : 1;
      l.dieT = (l.dieT || 0) + dt;
      if (l.dieT > 1.5) { l.mode = 'dead'; l.light.intensity = 0; l.mat.emissiveIntensity = 0; continue; }
    } else if (l.mode === 'dead') { continue; }
    if (l.off > 0) { l.off -= dt; f = Math.random() < 0.6 ? 0 : f * 0.4; }
    // proximité de la créature
    if (monster.state === 'hunt' && Math.hypot(monster.pos.x - l.x, monster.pos.z - l.z) < 5 && Math.random() < 0.4) f *= 0.1;
    l.light.intensity = l.base * f;
    l.mat.emissiveIntensity = 2 * f;
  }
}

const smoothDir = new THREE.Vector3(0, 0, -1);
function updateFlashlight(dt) {
  const cf = new THREE.Vector3(); camera.getWorldDirection(cf);
  smoothDir.lerp(cf, Math.min(1, dt * 14)).normalize();
  const right = new THREE.Vector3().crossVectors(cf, camera.up).normalize();
  flash.position.copy(camera.position).addScaledVector(right, 0.22).add(new THREE.Vector3(0, -0.22, 0));
  flash.target.position.copy(flash.position).addScaledVector(smoothDir, 6);
  spill.position.copy(camera.position).addScaledVector(cf, 0.6);
  let on = player.flashlightOn && (player.battery > 0 || game.mode === 'dying');
  let f = 1;
  if (game.flicker > 0) { game.flicker -= dt; if (Math.random() < 0.6) f = 0; }
  if (player.battery < 15 && player.battery > 0 && Math.random() < 0.08) f = 0.2;
  if (game.fear > 0.5 && Math.random() < (game.fear - 0.5) * 0.12) f = 0;
  const lv = on ? f : 0;
  flash.intensity = 40 * lv * (player.battery < 15 && game.mode !== 'dying' ? 0.6 : 1);
  spill.intensity = 0.5 * lv;
  ambient.intensity = 0.045 * settings.bright;
}

function render() {
  post.uniforms.time.value = game.time;
  post.uniforms.fear.value = game.fear;
  post.uniforms.flash.value = game.red;
  post.uniforms.exposure.value = 0.85 + settings.bright * 0.3;
  post.uniforms.fade.value = game.fade;
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}

// ---------- Menus
$('btnPlay').onclick = startGame;
$('btnResume').onclick = resumeGame;
$('btnMenu').onclick = toMenu;
$('btnRetry').onclick = startGame;
$('btnMenu2').onclick = toMenu;
$('btnMenu3').onclick = toMenu;
$('btnQuit').onclick = () => window.close();
for (const [btn, panel] of [['btnControls', 'panelControls'], ['btnOptions', 'panelOptions']]) {
  $(btn).onclick = () => {
    const el = $(panel), wasHidden = el.classList.contains('hidden');
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    if (wasHidden) el.classList.remove('hidden');
  };
}
const bindRange = (id, key, fn) => {
  const el = $(id); el.value = settings[key];
  el.oninput = () => { settings[key] = parseFloat(el.value); saveSettings(); fn && fn(); };
};
bindRange('optSens', 'sens');
bindRange('optBright', 'bright');
bindRange('optVol', 'vol', () => audio.setVolume(settings.vol));
bindRange('optQuality', 'quality', resize);
document.addEventListener('click', () => audio.init(), { once: true });

newWorld();
game.mode = 'menu'; game.fade = 1;
show('menu');
requestAnimationFrame(loop);
window.__p9 = { game, player, monster, camera, get world() { return world; }, startGame, killPlayer };
