// Textures générées sur canvas : aucun fichier externe
import * as THREE from 'three';

const R = Math.random;
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function grain(ctx, w, h, amt) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(im, 0, 0);
}

// Taches radiales, dessinées en "wrap" pour que la texture reste raccordable
function blotches(ctx, w, h, n, rgb, aMax, rMin, rMax, yMin = 0, yMax = 1) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = (yMin + R() * (yMax - yMin)) * h, r = rMin + R() * (rMax - rMin), a = R() * aMax;
    for (const ox of [-w, 0, w]) {
      const g = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y - r, r * 2, r * 2);
    }
  }
}

function drips(ctx, w, h, n, rgb, aMin = 0.1, aMax = 0.45, y0Max = 0.5) {
  for (let i = 0; i < n; i++) {
    let x = R() * w;
    const y0 = R() * h * y0Max, len = 20 + R() * h * 0.6;
    ctx.strokeStyle = `rgba(${rgb},${aMin + R() * (aMax - aMin)})`;
    ctx.lineWidth = 1 + R() * 3;
    ctx.beginPath(); ctx.moveTo(x, y0);
    for (let y = y0; y < y0 + len; y += 4) { x += (R() - 0.5) * 0.9; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

function toTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function wall(damaged) {
  const S = 512, c = mk(S, S), x = c.getContext('2d');
  x.fillStyle = '#6f7766'; x.fillRect(0, 0, S, S * 0.58);
  const ty = S * 0.62;
  x.fillStyle = '#3c4a46'; x.fillRect(0, ty, S, S - ty);
  // carreaux inférieurs
  for (let j = ty; j < S; j += 48) for (let i = 0; i < S; i += 64) {
    x.fillStyle = `rgba(${R() < 0.1 ? '10,10,8' : '255,255,255'},${R() * 0.06})`;
    x.fillRect(i, j, 64, 48);
  }
  x.strokeStyle = 'rgba(18,22,20,0.85)'; x.lineWidth = 2;
  for (let i = 0; i <= S; i += 64) { x.beginPath(); x.moveTo(i, ty); x.lineTo(i, S); x.stroke(); }
  for (let j = ty; j <= S; j += 48) { x.beginPath(); x.moveTo(0, j); x.lineTo(S, j); x.stroke(); }
  // rambarde
  x.fillStyle = '#2b2f2a'; x.fillRect(0, S * 0.58, S, S * 0.04);
  x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, S * 0.58, S, 3);

  blotches(x, S, S, 45, '70,50,25', 0.35, 10, 70);
  blotches(x, S, S, 18, '15,15,10', 0.55, 20, 100);
  drips(x, S, S, 45, '55,38,20');
  if (damaged) {
    blotches(x, S, S, 8, '90,5,5', 0.6, 10, 40, 0.2, 0.8);
    drips(x, S, S, 14, '80,4,4', 0.3, 0.7, 0.6);
    // griffures
    for (let k = 0; k < 3; k++) {
      const bx = R() * S * 0.8, by = S * (0.15 + R() * 0.4);
      for (let f = 0; f < 4; f++) {
        x.strokeStyle = `rgba(20,12,8,${0.5 + R() * 0.3})`; x.lineWidth = 2 + R() * 2;
        x.beginPath(); x.moveTo(bx + f * 12, by); x.lineTo(bx + f * 12 + 30 + R() * 20, by + 120 + R() * 60); x.stroke();
      }
    }
  }
  // peinture écaillée
  for (let i = 0; i < 90; i++) {
    x.fillStyle = `rgba(${R() < 0.5 ? '170,170,150' : '40,40,30'},${R() * 0.35})`;
    x.fillRect(R() * S, R() * S * 0.57, 2 + R() * 10, 2 + R() * 6);
  }
  let g = x.createLinearGradient(0, S * 0.75, 0, S);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,6,4,0.7)');
  x.fillStyle = g; x.fillRect(0, S * 0.75, S, S * 0.25);
  g = x.createLinearGradient(0, 0, 0, S * 0.25);
  g.addColorStop(0, 'rgba(12,10,6,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S * 0.25);
  grain(x, S, S, 30);
  return toTex(c);
}

function floor() {
  const S = 512, c = mk(S, S), x = c.getContext('2d'), n = 8, ts = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = (i + j) % 2 ? 118 : 88, k = (R() - 0.5) * 14;
    x.fillStyle = `rgb(${v + k + 6},${v + k + 4},${v + k - 6})`;
    x.fillRect(i * ts, j * ts, ts, ts);
  }
  x.strokeStyle = 'rgba(15,12,8,0.8)'; x.lineWidth = 2;
  for (let i = 0; i <= S; i += ts) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); }
  blotches(x, S, S, 40, '50,38,20', 0.45, 15, 90);
  blotches(x, S, S, 20, '10,8,5', 0.5, 20, 120);
  // fissures
  for (let k = 0; k < 10; k++) {
    let px = R() * S, py = R() * S;
    x.strokeStyle = `rgba(10,8,5,${0.4 + R() * 0.4})`; x.lineWidth = 1 + R();
    x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 12; s++) { px += (R() - 0.5) * 30; py += (R() - 0.5) * 30; x.lineTo(px, py); }
    x.stroke();
  }
  grain(x, S, S, 26);
  return toTex(c);
}

function ceiling() {
  const S = 256, c = mk(S, S), x = c.getContext('2d');
  x.fillStyle = '#5a5850'; x.fillRect(0, 0, S, S);
  blotches(x, S, S, 25, '95,75,30', 0.4, 10, 60);
  blotches(x, S, S, 10, '15,12,8', 0.5, 10, 60);
  x.strokeStyle = 'rgba(20,20,15,0.8)'; x.lineWidth = 3;
  for (let i = 0; i <= S; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); }
  // dalle manquante
  x.fillStyle = 'rgba(5,5,5,0.9)'; x.fillRect(64 * Math.floor(R() * 4) + 2, 64 * Math.floor(R() * 4) + 2, 60, 60);
  grain(x, S, S, 24);
  return toTex(c);
}

function blood() {
  const S = 256, c = mk(S, S), x = c.getContext('2d');
  const cx = S / 2, cy = S / 2;
  for (let i = 0; i < 14; i++) {
    const r = 10 + R() * 40, a = R() * Math.PI * 2, d = R() * 30;
    x.fillStyle = R() < 0.5 ? 'rgba(70,0,0,0.9)' : 'rgba(100,6,6,0.85)';
    x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, Math.PI * 2); x.fill();
  }
  for (let i = 0; i < 60; i++) {
    const a = R() * Math.PI * 2, d = 40 + R() * 80, r = 1 + R() * 5;
    x.fillStyle = `rgba(85,0,0,${0.6 + R() * 0.4})`;
    x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, Math.PI * 2); x.fill();
  }
  // traînée
  x.strokeStyle = 'rgba(60,0,0,0.7)'; x.lineWidth = 18; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx, cy); x.quadraticCurveTo(cx + 40, cy + 60, cx + 20 + R() * 40, S - 10); x.stroke();
  const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function writing(text) {
  const c = mk(1024, 256), x = c.getContext('2d');
  const size = Math.min(110, 1700 / text.length);
  x.font = `bold ${size}px "Courier New", monospace`;
  x.textBaseline = 'middle';
  const total = x.measureText(text).width;
  let px = (1024 - total) / 2;
  for (const ch of text) {
    const w = x.measureText(ch).width;
    x.save();
    x.translate(px + w / 2, 128 + (R() - 0.5) * 16);
    x.rotate((R() - 0.5) * 0.3);
    x.scale(1 + (R() - 0.5) * 0.25, 1 + (R() - 0.5) * 0.35);
    x.fillStyle = `rgba(${90 + R() * 30},4,4,0.92)`;
    x.fillText(ch, -w / 2, 0);
    x.restore();
    if (ch !== ' ' && R() < 0.5) {
      x.strokeStyle = 'rgba(80,3,3,0.8)'; x.lineWidth = 2 + R() * 3;
      x.beginPath(); x.moveTo(px + w * R(), 128 + size * 0.3); x.lineTo(px + w * R(), 128 + size * 0.3 + 20 + R() * 70); x.stroke();
    }
    px += w * 1.05;
  }
  const t = toTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function note() {
  const c = mk(256, 320), x = c.getContext('2d');
  x.fillStyle = '#cbbf9f'; x.fillRect(0, 0, 256, 320);
  blotches(x, 256, 320, 12, '120,95,50', 0.35, 10, 60);
  x.strokeStyle = 'rgba(60,80,140,0.25)'; x.lineWidth = 1;
  for (let y = 40; y < 310; y += 18) { x.beginPath(); x.moveTo(12, y); x.lineTo(244, y); x.stroke(); }
  x.strokeStyle = 'rgba(25,25,40,0.8)'; x.lineWidth = 1.5;
  for (let y = 36; y < 290; y += 18) {
    let px = 18 + R() * 10; x.beginPath(); x.moveTo(px, y);
    const end = 120 + R() * 110;
    while (px < end) { px += 3; x.lineTo(px, y + Math.sin(px * 0.8) * 3 * R()); }
    x.stroke();
  }
  x.fillStyle = 'rgba(90,0,0,0.6)'; x.beginPath(); x.ellipse(200, 270, 14, 18, 0.4, 0, Math.PI * 2); x.fill();
  return toTex(c);
}

function glow() {
  const c = mk(128, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return toTex(c);
}

function door() {
  const c = mk(256, 512), x = c.getContext('2d');
  x.fillStyle = '#4a3a33'; x.fillRect(0, 0, 256, 512);
  x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 6;
  x.strokeRect(24, 24, 208, 200); x.strokeRect(24, 260, 208, 228);
  x.fillStyle = '#1a1a1a'; x.fillRect(40, 60, 176, 110); // hublot
  x.fillStyle = 'rgba(200,200,200,0.08)'; x.fillRect(40, 60, 176, 110);
  blotches(x, 256, 512, 30, '110,55,20', 0.6, 10, 50);
  drips(x, 256, 512, 20, '70,30,10');
  x.fillStyle = '#777'; x.fillRect(30, 300, 196, 18); // barre anti-panique
  x.fillStyle = 'rgba(160,20,20,0.9)'; x.font = 'bold 34px "Courier New"'; x.fillText('ISOLEMENT', 36, 250);
  grain(x, 256, 512, 30);
  return toTex(c);
}

function exitSign(on) {
  const c = mk(256, 96), x = c.getContext('2d');
  x.fillStyle = on ? '#0a3a12' : '#0c0f0c'; x.fillRect(0, 0, 256, 96);
  x.font = 'bold 56px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = on ? '#6dff8a' : '#1f2a1f'; x.fillText('SORTIE', 128, 50);
  return toTex(c);
}

function cardboard() {
  const S = 128, c = mk(S, S), x = c.getContext('2d');
  x.fillStyle = '#7a6143'; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(180,160,110,0.5)'; x.fillRect(0, S / 2 - 6, S, 12);
  blotches(x, S, S, 10, '30,20,10', 0.5, 5, 30);
  grain(x, S, S, 30);
  return toTex(c);
}

function mattress() {
  const S = 256, c = mk(S, S), x = c.getContext('2d');
  x.fillStyle = '#8c887a'; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(40,40,30,0.4)';
  for (let i = 0; i < S; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); }
  blotches(x, S, S, 14, '100,80,30', 0.5, 15, 60);
  blotches(x, S, S, 5, '80,0,0', 0.8, 15, 50);
  grain(x, S, S, 30);
  return toTex(c);
}

export function makeTextures() {
  return {
    wall: wall(false), wallDamaged: wall(true), floor: floor(), ceiling: ceiling(),
    blood: blood(), note: note(), glow: glow(), door: door(),
    exitOff: exitSign(false), exitOn: exitSign(true),
    cardboard: cardboard(), mattress: mattress(),
  };
}
