import * as THREE from "three";

/**
 * Procedural PBR texture sets (color + roughness + bump) shared by every scene.
 * Generated once on canvases: panel seams, rivet rows, vents, grime streaks,
 * edge wear and a dust gradient toward the ground, so hard-surface models read
 * as manufactured, used hardware instead of flat primitives.
 */
type Set = { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture };
const cache = new Map<string, Set>();

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}
function tex(el: HTMLCanvasElement, color: boolean, repeat: [number, number]) {
  const t = new THREE.CanvasTexture(el);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}
function canvases(size: number) {
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return [c, c.getContext("2d")!] as const;
  };
  return { col: mk(), rough: mk(), bump: mk() };
}

export type PanelOptions = {
  base: string;
  /** Panel grid (columns × rows) per texture tile. */
  grid?: [number, number];
  /** 0..1 Martian dust accumulated toward the bottom of the tile (v=0). */
  dust?: number;
  dustColor?: string;
  rivets?: boolean;
  vents?: boolean;
  grime?: number;
  roughness?: number;
  repeat?: [number, number];
  seed?: number;
};
/** Painted / composite hull panels with seams, rivets, grime streaks and dust. */
export function panelSet(o: PanelOptions): Set {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 512, r = rng(o.seed ?? 7), { col, rough, bump } = canvases(S);
  const [cc, c] = col, [, rg] = rough, [, b] = bump;
  const [gx, gy] = o.grid ?? [4, 3];
  const dust = o.dust ?? 0.35, dustC = o.dustColor ?? "#b87a52", grime = o.grime ?? 0.5;
  c.fillStyle = o.base;
  c.fillRect(0, 0, S, S);
  rg.fillStyle = `rgb(${Math.round((o.roughness ?? 0.55) * 255)},0,0)`;
  rg.fillStyle = `#${Math.round((o.roughness ?? 0.55) * 255).toString(16).padStart(2, "0").repeat(3)}`;
  rg.fillRect(0, 0, S, S);
  b.fillStyle = "#808080";
  b.fillRect(0, 0, S, S);
  const pw = S / gx, ph = S / gy;
  // Per-panel tone variation (different batches / sun fading).
  for (let i = 0; i < gx; i++)
    for (let j = 0; j < gy; j++) {
      const v = (r() - 0.5) * 0.06;
      c.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      c.fillRect(i * pw, j * ph, pw, ph);
    }
  // Seams: recessed lines (dark in color + bump), slightly rougher.
  c.strokeStyle = "rgba(40,36,32,0.55)";
  b.strokeStyle = "#3c3c3c";
  rg.strokeStyle = "#e6e6e6";
  for (const ctx of [c, b, rg]) {
    ctx.lineWidth = 3;
    for (let i = 0; i <= gx; i++) { ctx.beginPath(); ctx.moveTo(i * pw, 0); ctx.lineTo(i * pw, S); ctx.stroke(); }
    for (let j = 0; j <= gy; j++) { ctx.beginPath(); ctx.moveTo(0, j * ph); ctx.lineTo(S, j * ph); ctx.stroke(); }
  }
  // Rivet / fastener rows along every seam.
  if (o.rivets !== false)
    for (let i = 0; i <= gx; i++)
      for (let y = 6; y < S; y += 14) {
        for (const [ctx, col2] of [[c, "rgba(60,55,50,0.6)"], [b, "#d0d0d0"]] as const) {
          ctx.fillStyle = col2;
          ctx.beginPath(); ctx.arc(i * pw + 6, y, 1.6, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(i * pw - 6, y, 1.6, 0, 7); ctx.fill();
        }
      }
  // Vent grilles and access hatches on a few panels.
  if (o.vents)
    for (let k = 0; k < 3; k++) {
      const x = (Math.floor(r() * gx) + 0.25) * pw, y = (Math.floor(r() * gy) + 0.3) * ph, w = pw * 0.5, h = ph * 0.3;
      c.fillStyle = "rgba(35,35,35,0.7)";
      c.fillRect(x, y, w, h);
      b.fillStyle = "#505050";
      b.fillRect(x, y, w, h);
      for (let yy = y + 3; yy < y + h; yy += 5) { c.fillStyle = "rgba(200,200,200,0.4)"; c.fillRect(x + 2, yy, w - 4, 1.5); b.fillStyle = "#a0a0a0"; b.fillRect(x + 2, yy, w - 4, 1.5); }
    }
  // Grime streaks running down from seams and fasteners.
  for (let k = 0; k < 120 * grime; k++) {
    const x = r() * S, y = r() * S * 0.9, len = 20 + r() * 120;
    const g = c.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, `rgba(70,55,40,${0.12 + r() * 0.15})`);
    g.addColorStop(1, "rgba(70,55,40,0)");
    c.fillStyle = g;
    c.fillRect(x, y, 1 + r() * 3, len);
  }
  // Fine grain / scratches.
  for (let k = 0; k < 4000; k++) {
    c.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    c.fillRect(r() * S, r() * S, 1.5, 1.5);
  }
  // Dust accumulated from the bottom edge (texture v=0 is the bottom row of the canvas).
  if (dust > 0) {
    const g = c.createLinearGradient(0, S, 0, S * 0.35);
    const d = new THREE.Color(dustC);
    const rgb = `${Math.round(d.r * 255)},${Math.round(d.g * 255)},${Math.round(d.b * 255)}`;
    g.addColorStop(0, `rgba(${rgb},${0.75 * dust})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    for (let k = 0; k < 1800 * dust; k++) {
      const y = S - Math.pow(r(), 2.2) * S * 0.7;
      c.fillStyle = `rgba(${rgb},${0.25 + r() * 0.3})`;
      c.fillRect(r() * S, y, 2 + r() * 3, 1 + r() * 2);
    }
    const gr = rg.createLinearGradient(0, S, 0, S * 0.4);
    gr.addColorStop(0, "rgba(255,255,255,0.5)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    rg.fillStyle = gr;
    rg.fillRect(0, 0, S, S);
  }
  const rep = o.repeat ?? [1, 1];
  const set = { map: tex(cc, true, rep), roughnessMap: tex(rough[0], false, rep), bumpMap: tex(bump[0], false, rep) };
  cache.set(key, set);
  return set;
}

/** Brushed / anodized metal with machining marks and fingerprints of wear. */
export function metalSet(base = "#9ea3a6", seed = 3): Set {
  const key = "metal" + base + seed;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 256, r = rng(seed), { col, rough, bump } = canvases(S);
  const [cc, c] = col, [, rg] = rough, [, b] = bump;
  c.fillStyle = base;
  c.fillRect(0, 0, S, S);
  rg.fillStyle = "#5a5a5a";
  rg.fillRect(0, 0, S, S);
  b.fillStyle = "#808080";
  b.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y++) {
    const v = (r() - 0.5) * 0.08;
    c.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    c.fillRect(0, y, S, 1);
    rg.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "0,0,0"},0.06)`;
    rg.fillRect(0, y, S, 1);
  }
  for (let k = 0; k < 40; k++) {
    rg.fillStyle = "rgba(255,255,255,0.12)";
    rg.beginPath(); rg.arc(r() * S, r() * S, 4 + r() * 14, 0, 7); rg.fill();
  }
  const set = { map: tex(cc, true, [1, 1]), roughnessMap: tex(rough[0], false, [1, 1]), bumpMap: tex(bump[0], false, [1, 1]) };
  cache.set(key, set);
  return set;
}

/** Regolith with pebbles, ripples and fine grain (color + bump) for terrain. */
export function regolithSet(kind: "mars" | "moon" | "mercury"): Set {
  const key = "regolith" + kind;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 1024, r = rng(kind.length * 97), { col, rough, bump } = canvases(S);
  const [cc, c] = col, [, rg] = rough, [, b] = bump;
  const base = kind === "mars" ? [176, 104, 66] : kind === "moon" ? [148, 146, 142] : [140, 128, 116];
  const im = c.createImageData(S, S), bi = b.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const ripple = kind === "mars" ? Math.sin(x * 0.09 + Math.sin(y * 0.02) * 4) * 0.5 + 0.5 : 0;
      const n = (r() - 0.5) * 16 + ripple * 8;
      im.data[i] = base[0] + n; im.data[i + 1] = base[1] + n * 0.8; im.data[i + 2] = base[2] + n * 0.65; im.data[i + 3] = 255;
      const h = 128 + ripple * 40 + (r() - 0.5) * 50;
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = h; bi.data[i + 3] = 255;
    }
  c.putImageData(im, 0, 0);
  b.putImageData(bi, 0, 0);
  // Pebbles and small rocks: dark top, cast shading, raised in bump.
  for (let k = 0; k < 900; k++) {
    const x = r() * S, y = r() * S, s = 0.8 + Math.pow(r(), 4) * 7;
    const shade = kind === "mars" ? `rgba(${120 + r() * 50},${72 + r() * 30},${50 + r() * 22},0.75)` : `rgba(${80 + r() * 60},${80 + r() * 60},${80 + r() * 60},0.9)`;
    c.fillStyle = "rgba(0,0,0,0.12)";
    c.beginPath(); c.ellipse(x + s * 0.4, y + s * 0.4, s, s * 0.7, 0, 0, 7); c.fill();
    c.fillStyle = shade;
    c.beginPath(); c.ellipse(x, y, s, s * 0.75, r() * 3, 0, 7); c.fill();
    b.fillStyle = "#e0e0e0";
    b.beginPath(); b.ellipse(x, y, s, s * 0.75, 0, 0, 7); b.fill();
  }
  // Micro-craters on airless bodies.
  if (kind !== "mars")
    for (let k = 0; k < 160; k++) {
      const x = r() * S, y = r() * S, s = 4 + Math.pow(r(), 2) * 30;
      const g = c.createRadialGradient(x, y, s * 0.2, x, y, s);
      g.addColorStop(0, "rgba(0,0,0,0.18)"); g.addColorStop(0.85, "rgba(0,0,0,0.05)"); g.addColorStop(1, "rgba(255,255,255,0.12)");
      c.fillStyle = g; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill();
      const gb = b.createRadialGradient(x, y, s * 0.2, x, y, s);
      gb.addColorStop(0, "#606060"); gb.addColorStop(0.9, "#808080"); gb.addColorStop(1, "#a0a0a0");
      b.fillStyle = gb; b.beginPath(); b.arc(x, y, s, 0, 7); b.fill();
    }
  rg.fillStyle = "#f2f2f2";
  rg.fillRect(0, 0, S, S);
  const set = { map: tex(cc, true, [60, 60]), roughnessMap: tex(rough[0], false, [60, 60]), bumpMap: tex(bump[0], false, [60, 60]) };
  cache.set(key, set);
  return set;
}
