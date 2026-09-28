// Moteur audio 100 % procédural (Web Audio)
export class AudioSys {
  constructor() { this.ctx = null; this.volume = 0.8; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5;
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    this.master.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(3.5, 2.2);
    this.reverb.connect(this.master);
    this.noiseBuf = this.noise(2, false);
    this.brownBuf = this.noise(4, true);
    this.startAmbience();
    this.startMonsterVoice();
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  impulse(dur, decay) {
    const len = this.ctx.sampleRate * dur, b = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  noise(dur, brown) {
    const len = this.ctx.sampleRate * dur, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  // Sortie avec envoi réverbe
  out(wet = 0.3, dest) {
    const g = this.ctx.createGain();
    g.connect(dest || this.master);
    if (wet > 0) { const s = this.ctx.createGain(); s.gain.value = wet; g.connect(s).connect(this.reverb); }
    return g;
  }
  panner(x, y, z) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = 2; p.rolloffFactor = 1.3; p.maxDistance = 80;
    this.setPos(p, x, y, z);
    return p;
  }
  setPos(p, x, y, z) {
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
  }
  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  noiseSrc(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf || this.noiseBuf; return s; }
  osc(type, f) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  filt(type, f, q = 1) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }

  setListener(pos, fwd) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
      L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
  }

  startAmbience() {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.value = 0; g.gain.linearRampToValueAtTime(1, ctx.currentTime + 5);
    g.connect(this.master);
    [[41.2, 'sawtooth', 0.035], [41.9, 'sawtooth', 0.035], [61.7, 'sine', 0.05], [87.3, 'triangle', 0.012]].forEach(([f, type, v], i) => {
      const o = this.osc(type, f), lp = this.filt('lowpass', 150), og = ctx.createGain();
      og.gain.value = v; o.connect(lp).connect(og).connect(g); o.start();
      const lfo = this.osc('sine', 0.04 + i * 0.03), lg = ctx.createGain(); lg.gain.value = 70;
      lfo.connect(lg).connect(lp.frequency); lfo.start();
    });
    const n = this.noiseSrc(this.brownBuf); n.loop = true;
    const bp = this.filt('bandpass', 420, 0.8), ng = ctx.createGain(); ng.gain.value = 0.14;
    n.connect(bp).connect(ng).connect(g); n.start();
    const lfo = this.osc('sine', 0.06), lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg).connect(bp.frequency); lfo.start();
    const hum = this.osc('square', 50), hl = this.filt('lowpass', 280), hg = ctx.createGain(); hg.gain.value = 0.007;
    hum.connect(hl).connect(hg).connect(g); hum.start();

    // Couche de tension (cordes dissonantes) pilotée par la peur
    this.tension = ctx.createGain(); this.tension.gain.value = 0; this.tension.connect(this.master);
    const ts = ctx.createGain(); ts.gain.value = 0.4; this.tension.connect(ts).connect(this.reverb);
    [220, 233.1, 311.1, 329.6].forEach((f) => {
      const o = this.osc('sawtooth', f), bp2 = this.filt('bandpass', f * 2, 2), og = ctx.createGain(); og.gain.value = 0.25;
      const vib = this.osc('sine', 4 + Math.random() * 3), vg = ctx.createGain(); vg.gain.value = f * 0.01;
      vib.connect(vg).connect(o.frequency); vib.start();
      o.connect(bp2).connect(og).connect(this.tension); o.start();
    });
  }
  setTension(v) { if (this.ctx) this.tension.gain.setTargetAtTime(v * 0.08, this.ctx.currentTime, 0.4); }

  startMonsterVoice() {
    const ctx = this.ctx;
    this.mPan = this.panner(0, -100, 0);
    this.mGain = ctx.createGain(); this.mGain.gain.value = 0;
    const out = this.out(0.5); this.mPan.connect(out);
    this.mGain.connect(this.mPan);
    // râle
    const n = this.noiseSrc(this.brownBuf); n.loop = true;
    const bp = this.filt('bandpass', 260, 5), ng = ctx.createGain(); ng.gain.value = 2.2;
    n.connect(bp).connect(ng).connect(this.mGain); n.start();
    const l1 = this.osc('sine', 0.35), l1g = ctx.createGain(); l1g.gain.value = 130; l1.connect(l1g).connect(bp.frequency); l1.start();
    const o = this.osc('sawtooth', 52), lp = this.filt('lowpass', 190), og = ctx.createGain(); og.gain.value = 0.35;
    o.connect(lp).connect(og).connect(this.mGain); o.start();
    const l2 = this.osc('sine', 0.23), l2g = ctx.createGain(); l2g.gain.value = 9; l2.connect(l2g).connect(o.frequency); l2.start();
    // trémolo "gorge"
    const trem = this.osc('sine', 6.5), tg = ctx.createGain(); tg.gain.value = 0.5;
    trem.connect(tg).connect(ng.gain); trem.start();
  }
  monsterVoice(x, y, z, level) {
    if (!this.ctx) return;
    this.setPos(this.mPan, x, y, z);
    this.mGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.25);
  }

  footstep(v = 0.25, run = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.noiseSrc(), bp = this.filt('bandpass', 180 + Math.random() * 260, 1.3), g = this.out(0.25);
    this.env(g, t, 0.005, v, run ? 0.1 : 0.14);
    s.connect(bp).connect(g); s.start(t, Math.random() * 1.5, 0.2);
    const o = this.osc('sine', 75), og = this.out(0.1);
    this.env(og, t, 0.004, v * 0.8, 0.09);
    o.connect(og); o.start(t); o.stop(t + 0.15);
  }
  monsterStep(x, y, z, v = 0.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, p = this.panner(x, y, z), g = this.ctx.createGain();
    p.connect(this.out(0.4)); g.connect(p);
    this.env(g, t, 0.004, v, 0.18);
    const s = this.noiseSrc(), lp = this.filt('lowpass', 420);
    s.connect(lp).connect(g); s.start(t, Math.random(), 0.25);
    // craquement d'articulation
    if (Math.random() < 0.35) {
      const c = this.noiseSrc(), hp = this.filt('bandpass', 2500, 6), cg = this.ctx.createGain();
      this.env(cg, t + 0.05, 0.002, v * 0.8, 0.03); c.connect(hp).connect(cg).connect(p); c.start(t + 0.05, Math.random(), 0.06);
    }
  }
  heartbeat(v) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const thump = (tt, f, vv) => {
      const o = this.osc('sine', f), g = this.out(0);
      o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 0.5, tt + 0.16);
      this.env(g, tt, 0.01, vv, 0.2); o.connect(g); o.start(tt); o.stop(tt + 0.3);
    };
    thump(t, 62, v); thump(t + 0.17, 54, v * 0.7);
  }
  breath(v) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.noiseSrc(), bp = this.filt('bandpass', 900 + Math.random() * 400, 1.5), g = this.out(0.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    s.connect(bp).connect(g); s.start(t, Math.random(), 0.5);
  }
  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.osc('square', 1500), g = this.out(0.1);
    this.env(g, t, 0.001, 0.12, 0.025); o.connect(g); o.start(t); o.stop(t + 0.05);
  }
  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [440, 466.2, 659.3, 987.8].forEach((f, i) => {
      const o = this.osc('sine', f), g = this.out(0.8);
      this.env(g, t + i * 0.09, 0.01, 0.12, 1.4); o.connect(g); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1.6);
    });
  }
  paper() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const s = this.noiseSrc(), hp = this.filt('highpass', 2500), g = this.out(0.1);
      this.env(g, t + i * 0.07, 0.01, 0.12, 0.08); s.connect(hp).connect(g); s.start(t + i * 0.07, Math.random(), 0.12);
    }
  }
  locked() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.noiseSrc(), bp = this.filt('bandpass', 700, 3), g = this.out(0.5);
    this.env(g, t, 0.003, 0.5, 0.25); s.connect(bp).connect(g); s.start(t, 0, 0.3);
    const o = this.osc('triangle', 160), og = this.out(0.5); this.env(og, t, 0.003, 0.3, 0.3); o.connect(og); o.start(t); o.stop(t + 0.4);
  }
  powerUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.osc('sawtooth', 40), lp = this.filt('lowpass', 400), g = this.out(0.4);
    o.frequency.exponentialRampToValueAtTime(120, t + 2);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(lp).connect(g); o.start(t); o.stop(t + 3.6);
    setTimeout(() => this.bang(0.9, 0, 0, 0, true), 1800);
  }
  bang(v = 0.7, x, y, z, near = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = near ? this.out(0.6) : (() => { const p = this.panner(x, y, z); p.connect(this.out(1.2)); return p; })();
    const g = this.ctx.createGain(); g.connect(dest);
    this.env(g, t, 0.003, v, 0.6);
    const s = this.noiseSrc(), lp = this.filt('lowpass', 350); s.connect(lp).connect(g); s.start(t, 0, 0.8);
    const o = this.osc('sine', 55); o.frequency.exponentialRampToValueAtTime(30, t + 0.5); o.connect(g); o.start(t); o.stop(t + 0.8);
  }
  whisper(x, y, z) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, p = this.panner(x, y, z);
    p.connect(this.out(1.5));
    const n = 7 + Math.floor(Math.random() * 8);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const d = 0.08 + Math.random() * 0.2, s = this.noiseSrc();
      const f1 = this.filt('bandpass', 600 + Math.random() * 600, 7), f2 = this.filt('bandpass', 1500 + Math.random() * 1200, 9);
      const g = this.ctx.createGain(); g.connect(p);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.7, tt + d * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, tt + d);
      s.connect(f1).connect(g); s.connect(f2).connect(g); s.start(tt, Math.random(), d + 0.05);
      tt += d + Math.random() * 0.12;
    }
  }
  clicks(x, y, z) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, p = this.panner(x, y, z);
    p.connect(this.out(0.8));
    const n = 10 + Math.floor(Math.random() * 12);
    for (let i = 0; i < n; i++) {
      const tt = t + i * (0.035 + Math.random() * 0.03), s = this.noiseSrc(), bp = this.filt('bandpass', 1800 + Math.random() * 900, 8), g = this.ctx.createGain();
      g.connect(p); this.env(g, tt, 0.001, 1.2, 0.02); s.connect(bp).connect(g); s.start(tt, Math.random(), 0.04);
    }
  }
  stinger(v = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const b = this.osc('sine', 48), bg = this.out(0.5); b.frequency.exponentialRampToValueAtTime(28, t + 1.5);
    this.env(bg, t, 0.01, v * 1.2, 1.6); b.connect(bg); b.start(t); b.stop(t + 1.8);
    [880, 932.3, 1244.5, 1318.5, 1864.7].forEach((f) => {
      const o = this.osc('sawtooth', f * (1 + (Math.random() - 0.5) * 0.01)), bp = this.filt('bandpass', f, 3), g = this.out(0.9);
      this.env(g, t, 0.02, v * 0.2, 2.0); o.connect(bp).connect(g); o.start(t); o.stop(t + 2.2);
    });
  }
  distantScream(x, y, z) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, p = this.panner(x, y, z); p.connect(this.out(2.0));
    [300, 410].forEach((f) => {
      const o = this.osc('sawtooth', f), bp = this.filt('bandpass', f * 2, 2), g = this.ctx.createGain();
      o.frequency.linearRampToValueAtTime(f * 1.7, t + 0.6); o.frequency.linearRampToValueAtTime(f * 0.8, t + 2.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      o.connect(bp).connect(g).connect(p); o.start(t); o.stop(t + 2.6);
    });
  }
  scream() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const ws = this.ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); }
    ws.curve = curve;
    const g = this.out(0.6); ws.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    [380, 512, 745, 1020].forEach((f) => {
      const o = this.osc('sawtooth', f);
      o.frequency.linearRampToValueAtTime(f * 1.9, t + 0.25); o.frequency.linearRampToValueAtTime(f * 0.6, t + 1.6);
      const vib = this.osc('sine', 24 + Math.random() * 10), vg = this.ctx.createGain(); vg.gain.value = f * 0.08;
      vib.connect(vg).connect(o.frequency); vib.start(t); vib.stop(t + 1.8);
      const og = this.ctx.createGain(); og.gain.value = 0.25; o.connect(og).connect(ws); o.start(t); o.stop(t + 1.8);
    });
    const s = this.noiseSrc(), hp = this.filt('highpass', 900), sg = this.out(0.3);
    this.env(sg, t, 0.01, 0.6, 1.3); s.connect(hp).connect(sg); s.start(t, 0, 1.5);
    this.bang(1.0, 0, 0, 0, true);
  }
}
