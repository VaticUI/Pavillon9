// Génération procédurale du Pavillon 9 (labyrinthe de couloirs + salles)
export const T = 3;        // taille d'une case (m)
export const WALL_H = 3;   // hauteur sous plafond (m)
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateLevel(seed, cw = 11, ch = 11) {
  const rng = makeRng(seed);
  const W = cw * 2 + 1, H = ch * 2 + 1;
  const g = new Uint8Array(W * H).fill(1);
  const idx = (x, y) => y * W + x;

  // Recursive backtracker
  const visited = new Uint8Array(cw * ch);
  const stack = [[0, 0]];
  visited[0] = 1;
  g[idx(1, 1)] = 0;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const opts = DIRS.filter(([dx, dy]) => {
      const nx = cx + dx, ny = cy + dy;
      return nx >= 0 && ny >= 0 && nx < cw && ny < ch && !visited[ny * cw + nx];
    });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = opts[Math.floor(rng() * opts.length)];
    const nx = cx + dx, ny = cy + dy;
    visited[ny * cw + nx] = 1;
    g[idx(cx * 2 + 1 + dx, cy * 2 + 1 + dy)] = 0;
    g[idx(nx * 2 + 1, ny * 2 + 1)] = 0;
    stack.push([nx, ny]);
  }

  // Boucles : permet d'échapper à la créature
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (g[idx(x, y)] !== 1) continue;
    const horiz = !g[idx(x - 1, y)] && !g[idx(x + 1, y)] && g[idx(x, y - 1)] && g[idx(x, y + 1)];
    const vert = !g[idx(x, y - 1)] && !g[idx(x, y + 1)] && g[idx(x - 1, y)] && g[idx(x + 1, y)];
    if ((horiz || vert) && rng() < 0.11) g[idx(x, y)] = 0;
  }

  // Salles (dortoirs)
  const rooms = [];
  for (let r = 0; r < 4; r++) {
    const rx = 1 + 2 * (1 + Math.floor(rng() * (cw - 3)));
    const ry = 1 + 2 * (1 + Math.floor(rng() * (ch - 3)));
    for (let y = ry; y <= ry + 2; y++) for (let x = rx; x <= rx + 2; x++) g[idx(x, y)] = 0;
    rooms.push({ x: rx, y: ry });
  }

  const level = { seed, rng, W, H, g, rooms, start: [1, 1] };
  const grid = new Grid(level);
  const dist = grid.bfs(1, 1);
  const floors = grid.floorTiles();
  const deadEnds = floors.filter(([x, y]) => grid.openCount(x, y) === 1 && !(x === 1 && y === 1));

  // Sortie : le cul-de-sac le plus éloigné
  let exit = deadEnds[0] || floors[floors.length - 1];
  for (const d of deadEnds) if (dist[d[1] * W + d[0]] > dist[exit[1] * W + exit[0]]) exit = d;
  const open = DIRS.find(([dx, dy]) => !grid.solid(exit[0] + dx, exit[1] + dy));
  level.exit = exit;
  level.doorDir = [-open[0], -open[1]];

  // Fusibles : éloignés du départ et entre eux
  const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const used = new Set([`1,1`, `${exit[0]},${exit[1]}`]);
  const manh = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  const fuses = [];
  for (let minSep = 8; fuses.length < 5 && minSep >= 0; minSep--) {
    const cands = shuffled(deadEnds).concat(shuffled(floors));
    for (const c of cands) {
      if (fuses.length >= 5) break;
      const k = `${c[0]},${c[1]}`;
      if (used.has(k) || dist[c[1] * W + c[0]] < 7) continue;
      if (manh(c, exit) < 5) continue;
      if (fuses.some(f => manh(f, c) < minSep)) continue;
      fuses.push(c); used.add(k);
    }
  }
  level.fuses = fuses;

  const pickFree = (n, minDist = 3) => {
    const out = [];
    for (const c of shuffled(floors)) {
      if (out.length >= n) break;
      const k = `${c[0]},${c[1]}`;
      if (used.has(k) || dist[c[1] * W + c[0]] < minDist) continue;
      out.push(c); used.add(k);
    }
    return out;
  };
  level.batteries = pickFree(5, 4);
  level.notes = pickFree(5, 2);
  level.dist = dist;
  return level;
}

export class Grid {
  constructor(level) {
    this.W = level.W; this.H = level.H; this.g = level.g;
  }
  solid(i, j) { return i < 0 || j < 0 || i >= this.W || j >= this.H || this.g[j * this.W + i] === 1; }
  solidAt(x, z) { return this.solid(Math.floor(x / T), Math.floor(z / T)); }
  tileOf(x, z) { return [Math.floor(x / T), Math.floor(z / T)]; }
  openCount(i, j) { let n = 0; for (const [dx, dy] of DIRS) if (!this.solid(i + dx, j + dy)) n++; return n; }
  floorTiles() {
    const out = [];
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) if (!this.solid(i, j)) out.push([i, j]);
    return out;
  }
  los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
    const n = Math.ceil(d / 0.25);
    for (let k = 1; k < n; k++) if (this.solidAt(ax + dx * k / n, az + dz * k / n)) return false;
    return true;
  }
  losWide(ax, az, bx, bz, r) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz) || 1;
    const px = -dz / d * r, pz = dx / d * r;
    return this.los(ax, az, bx, bz) && this.los(ax + px, az + pz, bx + px, bz + pz) && this.los(ax - px, az - pz, bx - px, bz - pz);
  }
  bfs(si, sj) {
    const W = this.W, dist = new Int16Array(W * this.H).fill(-1);
    const q = [sj * W + si]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], ci = c % W, cj = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const ni = ci + dx, nj = cj + dy;
        if (this.solid(ni, nj)) continue;
        const n = nj * W + ni;
        if (dist[n] !== -1) continue;
        dist[n] = dist[c] + 1; q.push(n);
      }
    }
    return dist;
  }
  path(si, sj, ti, tj) {
    if (this.solid(ti, tj) || this.solid(si, sj)) return [];
    const W = this.W, start = sj * W + si, target = tj * W + ti;
    const prev = new Int32Array(W * this.H).fill(-1);
    prev[start] = start;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      if (c === target) break;
      const ci = c % W, cj = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const ni = ci + dx, nj = cj + dy;
        if (this.solid(ni, nj)) continue;
        const n = nj * W + ni;
        if (prev[n] !== -1) continue;
        prev[n] = c; q.push(n);
      }
    }
    if (prev[target] === -1) return [];
    const out = [];
    for (let c = target; c !== start; c = prev[c]) out.push([c % W, (c / W) | 0]);
    return out.reverse();
  }
  collide(pos, r) {
    const i0 = Math.floor(pos.x / T), j0 = Math.floor(pos.z / T);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      if (!this.solid(i, j)) continue;
      const cx = Math.max(i * T, Math.min(pos.x, i * T + T));
      const cz = Math.max(j * T, Math.min(pos.z, j * T + T));
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-10) {
        const d = Math.sqrt(d2);
        pos.x += dx / d * (r - d);
        pos.z += dz / d * (r - d);
      }
    }
  }
}
