// Outil de test : lance le jeu hors-écran, exécute des scénarios et enregistre des captures.
// Usage : electron tools/snap.js <dossier_sortie>
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const out = process.argv[2] || path.join(__dirname, 'snaps');
fs.mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 720, show: true, x: 40, y: 40, webPreferences: { backgroundThrottling: false, offscreen: false } });
  const logs = [];
  win.webContents.on('console-message', (e) => logs.push(`[${e.level}] ${e.message}`));
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await wait(2500);
  const snap = async (name) => { const img = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, name + '.png'), img.toPNG()); };
  const js = (code) => win.webContents.executeJavaScript(code);

  await snap('01_menu');
  await js('__p9.startGame()');
  await wait(2500);
  await snap('02_start');
  // tourner la caméra
  await js('(() => { const p = __p9.player, g = __p9.world.grid; let best = p.yaw, bd = 0; for (let a = 0; a < 6.28; a += 0.2) { let d = 0; while (d < 30 && !g.solidAt(p.pos.x - Math.sin(a) * d, p.pos.z - Math.cos(a) * d)) d += 0.25; if (d > bd) { bd = d; best = a; } } p.yaw = best; })()');
  await wait(600);
  await snap('03_turn');
  // monstre visible devant le joueur
  await js(`(() => { const p = __p9.player, m = __p9.monster; m.state = 'hunt'; m.mode = 'wander'; m.group.visible = true;
    const g = __p9.world.grid; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let d = 1; while (d < 12 && !g.solidAt(p.pos.x + fx * (d + 0.5), p.pos.z + fz * (d + 0.5))) d += 0.5;
    m.pos.set(p.pos.x + fx * Math.min(4, d - 0.6), 0, p.pos.z + fz * Math.min(4, d - 0.6)); m.yaw = Math.atan2(-fx, -fz); m.path = []; m.update = () => {}; m.group.rotation.y = m.yaw; })()`);
  await wait(500);
  await snap('04_monster');
  // IA réelle : on laisse tourner la traque pendant que le joueur avance
  await js(`(() => { const m = __p9.monster; delete m.update; m.startHunt({ grid: __p9.world.grid, player: { x: __p9.player.pos.x, z: __p9.player.pos.z } });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' })); })()`);
  await wait(4000);
  await js("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }))");
  logs.push('AI ' + await js('JSON.stringify({mode: __p9.monster.mode, state: __p9.monster.state, dist: __p9.monster.dist, stamina: __p9.player.stamina, gm: __p9.game.mode})'));
  await snap('04b_after_run');
  await js(`(() => { const p = __p9.player, m = __p9.monster, g = __p9.world.grid; for (let a = 0; a < 6.28; a += 0.3) { const x = p.pos.x + Math.sin(a) * 1.0, z = p.pos.z + Math.cos(a) * 1.0; if (!g.solidAt(x, z) && !g.solidAt(p.pos.x + Math.sin(a) * 1.8, p.pos.z + Math.cos(a) * 1.8)) { m.pos.set(x, 0, z); break; } } __p9.game.mode = 'playing'; __p9.killPlayer(); })()`);
  await wait(250);
  logs.push('HEAD ' + await js(`(() => { const THREE_V = __p9.camera.position.clone(); const h = new THREE_V.constructor(); __p9.monster.parts.head.getWorldPosition(h); const cam = __p9.camera.position; const p = h.clone().project(__p9.camera); return JSON.stringify({ head: h, cam, proj: p, grp: __p9.monster.group.position }); })()`));
  await snap('05_jumpscare');
  await wait(2000);
  await snap('06_death');
  const state = await js('JSON.stringify({mode: __p9.game.mode, fuses: __p9.world.pickups.filter(p=>p.type==="fuse").length})');
  logs.push('STATE ' + state);
  fs.writeFileSync(path.join(out, 'console.txt'), logs.join('\n'));
  app.quit();
});
