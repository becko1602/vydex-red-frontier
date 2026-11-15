import { useEffect, useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../store";
import { SunBody } from "./SunBody";
import type { SolarBodyId } from "../data/solarSystem";
const files: Partial<Record<SolarBodyId, string>> = {
  mars: "/assets/planets/mars.jpg",
  earth: "/assets/planets/earth.jpg",
  sun: "/assets/planets/sun.jpg",
  moon: "/assets/planets/moon.jpg",
  venus: "/assets/planets/venus.jpg",
  jupiter: "/assets/planets/jupiter.jpg",
  saturn: "/assets/planets/saturn.jpg",
};
const planetTints: Record<SolarBodyId, string> = {
  sun: "#ffd34f",
  mercury: "#9b8e82",
  venus: "#d9a85d",
  earth: "#4b91ba",
  mars: "#b9573e",
  moon: "#aaa9a3",
  jupiter: "#bd9675",
  saturn: "#c5a96f",
  uranus: "#74c7c9",
  neptune: "#4d79c7",
};
// Optional image loading leaves a colored sphere visible if an asset cannot load.
function useLocalMap(url: string | null, color = true) {
  const [map, setMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    setMap(null);
    if (!url) return;
    let active = true;
    let texture: THREE.Texture | undefined;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        texture = t;
        t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 4;
        if (active) setMap(t);
        else t.dispose();
      },
      undefined,
      () => {
        /* Keep the material fallback. */
      },
    );
    return () => {
      active = false;
      texture?.dispose();
    };
  }, [url, color]);
  return map;
}
export function Planet({
  kind,
  radius = 1,
  spin = true,
}: {
  kind: SolarBodyId;
  radius?: number;
  spin?: boolean;
}) {
  const map = useLocalMap(kind === "sun" ? null : files[kind] ?? null);
  const venusClouds = useMemo(() => {
    if (kind !== "venus") return null;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d")!,
      im = ctx.createImageData(512, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 512; x++) {
        const v =
            7 * Math.sin(y * 0.13 + Math.sin(x * 0.018) * 2) +
            4 * Math.cos(x * 0.03 - y * 0.05),
          i = (y * 512 + x) * 4;
        im.data[i] = 216 + v;
        im.data[i + 1] = 195 + v;
        im.data[i + 2] = 153 + v;
        im.data[i + 3] = 255;
      }
    ctx.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [kind]);
  useEffect(() => () => venusClouds?.dispose(), [venusClouds]);
  const bump = useLocalMap(
    kind === "mars" ? "/assets/planets/mars-bump.jpg" : null,
    false,
  );
  const clouds = useLocalMap(
    kind === "earth" ? "/assets/planets/earth-clouds.png" : null,
  );
  const globe = useRef<THREE.Group>(null),
    cloud = useRef<THREE.Mesh>(null);
  const reduced = useGame((s) => s.settings.reducedMotion);
  useFrame((_, dt) => {
    const ui = useGame.getState();
    if (
      !spin ||
      reduced ||
      ui.paused ||
      ui.drawer ||
      ui.workshop.info ||
      ui.tutorial.hold
    )
      return;
    if (globe.current) globe.current.rotation.y += dt * 0.025;
    if (cloud.current) cloud.current.rotation.y += dt * 0.006;
  });
  const proc = useMemo(() => (map || kind === "sun" || !["mercury", "uranus", "neptune"].includes(kind) ? null : proceduralPlanet(kind)), [kind, map]);
  useEffect(() => () => proc?.dispose(), [proc]);
  const ringTex = useMemo(() => (kind === "saturn" ? saturnRingTexture() : null), [kind]);
  useEffect(() => () => ringTex?.dispose(), [ringTex]);
  if (kind === "sun") return <SunBody radius={radius} />;
  // Obliquity (axial tilt), degrees → radians.
  const tilt = ({ earth: 23.4, mars: 25.2, saturn: 26.7, uranus: 97.8, neptune: 28.3, jupiter: 3.1, venus: 177.4, mercury: 0.03, moon: 6.7 } as Record<string, number>)[kind] ?? 0;
  const atmo = ({ earth: "#6bbefc", mars: "#d89a77", venus: "#f2d39a", jupiter: "#e8d3b4", saturn: "#efe0b6", uranus: "#a6e6ec", neptune: "#6f9cf0" } as Record<string, string>)[kind];
  return (
    <group rotation={[0, 0, (tilt * Math.PI) / 180]}>
    <group ref={globe} rotation={[0, -0.6, 0]}>
      <mesh>
        <sphereGeometry args={[radius, 96, 64]} />
        <meshStandardMaterial
          key={`${map ? 1 : 0}${proc ? 1 : 0}${bump ? 1 : 0}`}
          map={map ?? proc}
          color={map || proc ? "#ffffff" : planetTints[kind]}
          roughness={kind === "earth" ? 0.7 : 0.96}
          metalness={0}
          bumpMap={kind === "mars" && map ? bump : null}
          bumpScale={radius * 0.009}
        />
      </mesh>
      {kind === "venus" && venusClouds && (
        <mesh scale={1.003}>
          <sphereGeometry args={[radius, 64, 40]} />
          <meshStandardMaterial map={venusClouds} roughness={1} />
        </mesh>
      )}
      {kind === "earth" && clouds && (
        <mesh ref={cloud} scale={1.009}>
          <sphereGeometry args={[radius, 64, 40]} />
          <meshStandardMaterial map={clouds} transparent opacity={0.75} depthWrite={false} roughness={1} />
        </mesh>
      )}
      {atmo && (
        <mesh scale={kind === "earth" ? 1.025 : kind === "mars" ? 1.012 : 1.02}>
          <sphereGeometry args={[radius, 64, 40]} />
          <shaderMaterial
            transparent
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={{ tint: { value: new THREE.Color(atmo) } }}
            vertexShader={"varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}"}
            fragmentShader={"uniform vec3 tint; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.4);gl_FragColor=vec4(tint*rim*0.9,rim*0.55);}"}
          />
        </mesh>
      )}
      {kind === "saturn" && ringTex && (
        <SaturnRing radius={radius} map={ringTex} />
      )}
      {kind === "uranus" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.64, radius * 2.0, 128, 1]} />
          <meshBasicMaterial color="#7d8a8c" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
    </group>
  );
}

function SaturnRing({ radius, map }: { radius: number; map: THREE.Texture }) {
  const geo = useMemo(() => {
    const inner = radius * 1.24, outer = radius * 2.27, g = new THREE.RingGeometry(inner, outer, 180, 1);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - inner) / (outer - inner), 0.5);
    return g;
  }, [radius]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial map={map} transparent side={THREE.DoubleSide} roughness={0.9} depthWrite={false} />
    </mesh>
  );
}
/** Saturn's rings: C ring (faint), B ring (bright), Cassini division, A ring with Encke gap. */
function saturnRingTexture() {
  const el = document.createElement("canvas");
  el.width = 1024;
  el.height = 4;
  const g = el.getContext("2d")!;
  const R0 = 1.24, R1 = 2.27;
  for (let x = 0; x < 1024; x++) {
    const r = R0 + (x / 1023) * (R1 - R0);
    let a = 0, c = [200, 185, 150];
    if (r < 1.53) { a = 0.18 + 0.05 * Math.sin(r * 400); c = [150, 135, 115]; }
    else if (r < 1.95) { a = 0.85 + 0.1 * Math.sin(r * 300); c = [222, 205, 168]; }
    else if (r < 2.03) { a = 0.06; c = [90, 80, 70]; }
    else if (r < 2.27) { a = r > 2.21 && r < 2.215 ? 0.05 : 0.6 + 0.08 * Math.sin(r * 250); c = [196, 182, 150]; }
    g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Banded procedural maps for bodies without bundled imagery. */
function proceduralPlanet(kind: SolarBodyId) {
  const w = 1024, h = 512, el = document.createElement("canvas");
  el.width = w; el.height = h;
  const g = el.getContext("2d")!, im = g.createImageData(w, h);
  let seed = kind.length * 97;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const craters = kind === "mercury" ? Array.from({ length: 260 }, () => ({ x: rnd() * w, y: rnd() * h, r: 2 + Math.pow(rnd(), 3) * 40 })) : [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, lat = y / h;
      let r = 0, gg = 0, b = 0;
      if (kind === "mercury") {
        const n = Math.sin(x * 0.05) * Math.sin(y * 0.07) * 8 + Math.sin(x * 0.23 + y * 0.17) * 5;
        r = 138 + n; gg = 128 + n; b = 118 + n;
      } else if (kind === "uranus") {
        const band = Math.sin(lat * 40) * 3;
        r = 168 + band; gg = 222 + band; b = 226 + band;
      } else {
        const band = Math.sin(lat * 34 + Math.sin(x * 0.01) * 0.6) * 9;
        r = 62 + band; gg = 110 + band; b = 205 + band;
        const dx = x - w * 0.35, dy = y - h * 0.62;
        if ((dx * dx) / 900 + (dy * dy) / 260 < 1) { r -= 30; gg -= 40; b -= 40; } // Great Dark Spot
      }
      im.data[i] = r; im.data[i + 1] = gg; im.data[i + 2] = b; im.data[i + 3] = 255;
    }
  g.putImageData(im, 0, 0);
  for (const c of craters) {
    const grad = g.createRadialGradient(c.x, c.y, c.r * 0.2, c.x, c.y, c.r);
    grad.addColorStop(0, "rgba(60,55,50,0.35)");
    grad.addColorStop(0.8, "rgba(80,75,70,0.15)");
    grad.addColorStop(0.95, "rgba(220,215,205,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(c.x, c.y, c.r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
