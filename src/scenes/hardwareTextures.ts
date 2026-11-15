import * as THREE from "three";
import { seeded } from "../sim/physics";

/** Procedural spacecraft surface textures, generated once and shared. */
let cache: {
  mli: THREE.CanvasTexture;
  mliSilver: THREE.CanvasTexture;
  cells: THREE.CanvasTexture;
  cellsBack: THREE.CanvasTexture;
  radiator: THREE.CanvasTexture;
} | null = null;

function canvas(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, color = true) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  draw(el.getContext("2d")!);
  const t = new THREE.CanvasTexture(el);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Crinkled multi-layer insulation: gold (Kapton) or silver (aluminized). */
function foil(base: [number, number, number], seed: number) {
  return canvas(256, 256, (c) => {
    const r = seeded(seed);
    c.fillStyle = `rgb(${base.join(",")})`;
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 520; i++) {
      const x = r() * 256, y = r() * 256, w = 6 + r() * 40, h = 4 + r() * 26, a = r() * Math.PI;
      const k = r() > 0.5 ? 1.35 : 0.62;
      c.save();
      c.translate(x, y);
      c.rotate(a);
      const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, `rgba(${base.map((v) => Math.min(255, v * k)).join(",")},0)`);
      g.addColorStop(0.5, `rgba(${base.map((v) => Math.min(255, v * k)).join(",")},0.55)`);
      g.addColorStop(1, `rgba(${base.map((v) => Math.min(255, v * k)).join(",")},0)`);
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    // Tape seams.
    c.strokeStyle = `rgba(${base.map((v) => v * 0.7).join(",")},0.6)`;
    c.lineWidth = 2;
    for (const p of [64, 192]) {
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p + 6, 256); c.stroke();
    }
  });
}

export function hardwareTextures() {
  if (cache) return cache;
  const mli = foil([196, 150, 62], 11);
  const mliSilver = foil([178, 182, 186], 23);
  // Triple-junction GaAs cells: dark blue-violet with silver busbars, cover-glass sheen.
  const cells = canvas(512, 512, (c) => {
    c.fillStyle = "#0c1830";
    c.fillRect(0, 0, 512, 512);
    const n = 12, s = 512 / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const g = c.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
        g.addColorStop(0, "#1b2f63");
        g.addColorStop(0.55, "#13204a");
        g.addColorStop(1, "#22346e");
        c.fillStyle = g;
        c.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
        c.fillStyle = "rgba(190,200,215,0.55)";
        for (let k = 1; k < 4; k++) c.fillRect(x * s + 2, y * s + (k * s) / 4, s - 4, 1);
        c.fillRect(x * s + s / 2, y * s + 2, 1.5, s - 4);
        // Chipped cover-glass corners like real cells.
        c.fillStyle = "#0a1226";
        c.beginPath(); c.moveTo(x * s + 2, y * s + 2); c.lineTo(x * s + 8, y * s + 2); c.lineTo(x * s + 2, y * s + 8); c.fill();
      }
  });
  const cellsBack = canvas(256, 256, (c) => {
    c.fillStyle = "#c9c6bd";
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = "#8e8b84";
    c.lineWidth = 3;
    for (let i = 0; i <= 256; i += 32) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke();
    }
  });
  const radiator = canvas(256, 256, (c) => {
    c.fillStyle = "#e8eae8";
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = "#c7cbcc";
    for (let i = 0; i < 256; i += 16) c.fillRect(i, 0, 3, 256);
  });
  cache = { mli, mliSilver, cells, cellsBack, radiator };
  return cache;
}

/** Bell nozzle profile (Rao-style parabolic approximation) for LatheGeometry. */
export function bellProfile(throat: number, exit: number, length: number, segments = 18) {
  const pts: THREE.Vector2[] = [];
  // Converging section (chamber to throat).
  pts.push(new THREE.Vector2(throat * 1.7, length * 0.32));
  pts.push(new THREE.Vector2(throat * 1.25, length * 0.22));
  pts.push(new THREE.Vector2(throat, length * 0.12));
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r = throat + (exit - throat) * (1 - Math.pow(1 - t, 1.9));
    pts.push(new THREE.Vector2(r, length * 0.12 - t * length * 1.12));
  }
  return pts;
}

/** Paraboloid dish profile for LatheGeometry (focal length f, aperture radius R). */
export function dishProfile(R: number, depth: number, segments = 20) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const r = (i / segments) * R;
    pts.push(new THREE.Vector2(r, (depth * r * r) / (R * R)));
  }
  return pts;
}
