import { useMemo, useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { engine, rocks, BASE_POSITION, BASE_RADIUS, sunElevation } from "../sim/game";
import { clamp, seeded, terrainHeight as terrainModel } from "../sim/physics";
import { useGame } from "../store";
import { rigCamera } from "../cameraRig";
import { roverView } from "../sim/controls";
import { Rover } from "./Models";
import { Spacecraft } from "./Spacecraft";
import { GltfModel } from "./GltfAssets";
import { Planet } from "./Planet";
import { isLunarLike, SURFACE_GRAVITY, type DestinationId } from "../data/destinations";
import { makeSurfaceTextures } from "./surfaceTextures";
import { hardwareTextures } from "./hardwareTextures";
import { panelSet, metalSet, regolithSet } from "./materials";
const terrainHeight = (x: number, z: number) =>
  terrainModel(x, z, engine.data.destination);
/** True body radii (m) — used for the horizon curvature drop d²/2R. */
const BODY_RADIUS: Partial<Record<DestinationId, number>> = {
  mars: 3_389_500,
  moon: 1_737_400,
  mercury: 2_439_700,
};
const radiusOf = (d: DestinationId) => BODY_RADIUS[d] ?? 3_389_500;
function groundColor(dest: DestinationId, x: number, z: number, h: number, c: THREE.Color) {
  if (dest === "moon")
    return c.setHSL(0.09, 0.015, 0.6 + h * 0.02 + Math.sin(x * 0.06 + z * 0.09) * 0.03);
  if (dest === "mercury")
    return c.setHSL(0.08, 0.06, 0.5 + h * 0.02 + Math.sin(x * 0.05 + z * 0.07) * 0.035);
  return c.setHSL(
    0.055 + Math.sin(x * 0.03 + z * 0.04) * 0.012,
    0.42,
    0.47 + h * 0.016 + Math.sin(x * 0.06 + z * 0.09) * 0.03,
  );
}
/** Detailed local terrain (the solver's height field). */
function Terrain() {
  const dest = engine.data.destination;
  const rego = useMemo(() => regolithSet(dest === "moon" ? "moon" : dest === "mercury" ? "mercury" : "mars"), [dest]);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(600, 600, 200, 200);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position,
      colors: number[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = terrainHeight(x, z);
      p.setY(i, h);
      groundColor(dest, x, z, h, color);
      colors.push(color.r, color.g, color.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [dest]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors map={rego.map} bumpMap={rego.bumpMap} bumpScale={1.4} roughness={1} />
    </mesh>
  );
}
/**
 * Far terrain from the local patch out to the true horizon (~60 km).
 * Every vertex drops by d²/2R with the body's real radius, so the horizon is a
 * genuine curved edge of a sphere instead of the edge of a square plane.
 */
function HorizonRing() {
  const dest = engine.data.destination;
  const rego = useMemo(() => regolithSet(dest === "moon" ? "moon" : dest === "mercury" ? "mercury" : "mars"), [dest]);
  const geometry = useMemo(() => {
    const R = radiusOf(dest), inner = 280, outer = 60000, rings = 70, seg = 220;
    const rand = seeded(77);
    const bumps = Array.from({ length: 18 }, () => ({ a: rand() * Math.PI * 2, f: 0.0004 + rand() * 0.003, amp: 6 + rand() * 40, p: rand() * 6 }));
    const pos: number[] = [], col: number[] = [], idx: number[] = [], uv: number[] = [];
    // Crater field (size-frequency: many small, few large), like orbital imagery of Mars, Moon and Mercury.
    const craters = Array.from({ length: isLunarLike(dest) ? 140 : 70 }, () => {
      const d = 500 + Math.pow(rand(), 0.7) * 45000, a = rand() * Math.PI * 2;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, r: 60 + Math.pow(rand(), 3) * 2600 };
    });
    const craterAt = (x: number, z: number) => {
      let h = 0, shade = 0;
      for (const c of craters) {
        const q = Math.hypot(x - c.x, z - c.z) / c.r;
        if (q > 2.2) continue;
        h += c.r * 0.06 * Math.exp(-(((q - 1) / 0.16) ** 2)) - c.r * 0.12 * Math.exp(-((q / 0.8) ** 4));
        shade += q < 1 ? -0.06 * (1 - q) : q < 1.25 ? 0.05 : 0;
      }
      return { h, shade };
    };
    const c = new THREE.Color();
    for (let i = 0; i <= rings; i++) {
      const r = inner * Math.pow(outer / inner, i / rings);
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        const near = Math.max(0, 1 - (r - inner) / 400);
        let far = 0;
        for (const b of bumps) far += Math.sin((x * Math.cos(b.a) + z * Math.sin(b.a)) * b.f + b.p) * b.amp;
        const farMix = clamp((r - inner) / 3000, 0, 1);
        const cr = craterAt(x, z);
        const h = terrainHeight(x, z) * near + (far * (isLunarLike(dest) ? 0.7 : 1) + cr.h) * farMix - (r * r) / (2 * R);
        pos.push(x, h, z);
        uv.push((x + 300) / 600, (300 - z) / 600); // same world mapping as the local patch
        groundColor(dest, x, z, far * 0.02, c);
        const fade = (1 - farMix * 0.12) * (1 + cr.shade * farMix);
        col.push(c.r * fade, c.g * fade, c.b * fade);
      }
    }
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < seg; j++) {
        const a = i * seg + j, b = i * seg + ((j + 1) % seg), c2 = (i + 1) * seg + j, d = (i + 1) * seg + ((j + 1) % seg);
        idx.push(a, b, c2, b, d, c2); // counter-clockwise seen from above → faces up
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [dest]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors map={rego.map} bumpMap={rego.bumpMap} bumpScale={1.4} roughness={1} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
    </mesh>
  );
}
/** Sun direction for the current local solar time (east → west arc, tilted). */
function sunDirection(solTime: number, out = new THREE.Vector3()) {
  const a = (solTime - 0.25) * Math.PI * 2;
  return out.set(-Math.cos(a) * 0.82, Math.sin(a), -0.45 - Math.cos(a) * 0.1).normalize();
}
/**
 * Physically-motivated sky: Mars has a butterscotch daytime sky (dust) and a
 * blue sunset halo (forward scattering); airless bodies have a black sky with
 * stars in daylight and a hard-edged Sun.
 */
function SurfaceSky() {
  const dest = engine.data.destination, airless = isLunarLike(dest);
  const mesh = useRef<THREE.Mesh>(null), stars = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      sun: { value: new THREE.Vector3(0, 1, 0) },
      airless: { value: airless ? 1 : 0 },
      sunSize: { value: dest === "mercury" ? 0.9994 : dest === "mars" ? 0.99998 : 0.99996 },
    },
    vertexShader: "varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
    fragmentShader: `uniform vec3 sun; uniform float airless; uniform float sunSize; varying vec3 vDir;
      void main(){
        vec3 d=normalize(vDir); float el=sun.y; float mu=dot(d,normalize(sun));
        float disk=smoothstep(sunSize-0.00002,sunSize,mu);
        if(airless>0.5){
          vec3 c=vec3(0.0)+vec3(1.0,0.97,0.9)*disk*8.0+vec3(1.0,0.9,0.75)*pow(max(mu,0.0),800.0)*0.6;
          gl_FragColor=vec4(c,1.0); return; }
        float day=smoothstep(-0.18,0.25,el);
        float h=clamp(d.y,0.0,1.0);
        vec3 zenith=mix(vec3(0.015,0.012,0.02),vec3(0.42,0.32,0.24),day);
        vec3 horizon=mix(vec3(0.03,0.025,0.03),vec3(0.80,0.62,0.45),day);
        vec3 c=mix(horizon,zenith,pow(h,0.55));
        // Blue forward-scattering halo around the Sun (strongest at sunset on Mars).
        float halo=pow(max(mu,0.0),18.0);
        float dusk=1.0-smoothstep(0.0,0.45,abs(el));
        c+=vec3(0.25,0.42,0.75)*halo*(0.35+1.4*dusk)*smoothstep(-0.2,0.05,el);
        c+=vec3(1.0,0.92,0.8)*pow(max(mu,0.0),900.0)*2.0;
        c+=vec3(1.0,0.95,0.85)*disk*6.0;
        // Below-horizon ground haze.
        c=mix(c,horizon*0.85,smoothstep(0.0,-0.08,d.y));
        gl_FragColor=vec4(c,1.0);
      }`,
  }), [airless, dest]);
  useEffect(() => () => mat.dispose(), [mat]);
  const sunV = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
    stars.current?.position.copy(camera.position);
    sunDirection(engine.data.solTime, sunV);
    mat.uniforms.sun.value.copy(sunV);
    if (stars.current) stars.current.visible = airless || sunV.y < 0.02;
  });
  return (
    <>
      <mesh ref={mesh} renderOrder={-10} material={mat} frustumCulled={false}>
        <sphereGeometry args={[40000, 48, 24]} />
      </mesh>
      <group ref={stars}>
        <Stars radius={30000} depth={6000} count={airless ? 2500 : 1800} factor={500} saturation={0.1} fade speed={0} />
      </group>
    </>
  );
}
function SunLighting() {
  const dest = engine.data.destination, airless = isLunarLike(dest);
  const sun = useRef<THREE.DirectionalLight>(null),
    amb = useRef<THREE.AmbientLight>(null),
    hemi = useRef<THREE.HemisphereLight>(null),
    target = useMemo(() => new THREE.Object3D(), []),
    dir = useMemo(() => new THREE.Vector3(), []);
  const quality = useGame((s) => s.settings.quality);
  useFrame(({ scene }) => {
    const d = engine.data, focus = d.stage === "landing" ? d.lander : { x: d.rover.x, z: d.rover.z };
    sunDirection(d.solTime, dir);
    const el = dir.y, day = clamp((el + 0.05) / 0.35, 0, 1);
    const gy = terrainHeight(focus.x, focus.z);
    target.position.set(focus.x, gy, focus.z);
    target.updateMatrixWorld();
    if (sun.current) {
      sun.current.position.set(focus.x + dir.x * 120, gy + Math.max(2, dir.y * 120), focus.z + dir.z * 120);
      // Solar constant scaled for distance (Mercury ~6.7×, Mars ~0.43× Earth) then compressed for display.
      const flux = dest === "mercury" ? 4.2 : dest === "mars" ? 2.4 : 3.2;
      sun.current.intensity = flux * day;
      sun.current.color.set(dest === "mars" ? (el < 0.2 ? "#ffd9b0" : "#fff1e0") : "#fffaf2");
    }
    if (amb.current) amb.current.intensity = airless ? 0.025 + 0.03 * day : 0.04 + 0.22 * day;
    if (hemi.current) hemi.current.intensity = airless ? 0.06 + 0.1 * day : 0.06 + 0.7 * day;
    if (scene.fog instanceof THREE.Fog) {
      const night = new THREE.Color("#0b0a0c"), dayC = new THREE.Color("#c19c7c");
      scene.fog.color.copy(night).lerp(dayC, day);
    }
  });
  return (
    <>
      <primitive object={target} />
      <ambientLight ref={amb} color={airless ? "#dbe0e7" : "#e4c9b3"} />
      <hemisphereLight ref={hemi} args={[airless ? "#cdd4dd" : "#d8c3ad", airless ? "#050608" : "#4a3528", 0.5]} />
      <directionalLight
        ref={sun}
        target={target}
        castShadow={quality !== "low"}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-far={400}
        shadow-bias={-0.0008}
      />
    </>
  );
}
/** NASA-style surface outpost: habitat, solar farm, DSN relay dish, charging pad and spare-parts depot. */
/** Mission emblem texture. A real logo can be supplied as /assets/base-logo.png (only with the owner's permission). */
function useBaseLogo() {
  const fallback = useMemo(() => {
    const el = document.createElement("canvas");
    el.width = el.height = 256;
    const g = el.getContext("2d")!;
    g.fillStyle = "#0b2a5a";
    g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#ffffff"; g.lineWidth = 6;
    g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    const grad = g.createRadialGradient(100, 110, 6, 128, 128, 60);
    grad.addColorStop(0, "#f2a070"); grad.addColorStop(1, "#a8452a");
    g.fillStyle = grad;
    g.beginPath(); g.arc(128, 128, 56, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#ffd58a"; g.lineWidth = 5;
    g.beginPath(); g.ellipse(128, 128, 98, 30, -0.4, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#ffffff"; g.font = "bold 34px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText("VYDEX", 128, 58);
    g.font = "bold 20px system-ui, sans-serif"; g.fillText("SURFACE BASE 1", 128, 214);
    for (let k = 0; k < 14; k++) { g.fillStyle = "#ffffff"; g.fillRect(40 + ((k * 53) % 180), 70 + ((k * 37) % 120), 2, 2); }
    const t = new THREE.CanvasTexture(el);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const [tex, setTex] = useStateSafe<THREE.Texture>(fallback);
  useEffect(() => {
    let alive = true;
    // Optional asset: separate LoadingManager so its absence is not reported as a failed model.
    new THREE.TextureLoader(new THREE.LoadingManager()).load("/assets/base-logo.png", (t) => { t.colorSpace = THREE.SRGBColorSpace; if (alive) setTex(t); }, undefined, () => {});
    return () => { alive = false; };
  }, [setTex]);
  return tex;
}
function useStateSafe<T>(initial: T) {
  return useState<T>(initial);
}
/** Geodesic glass dome: tinted panes + a real strut frame (edges of a subdivided icosahedron). */
function GeodesicDome({ r, detail = 3 }: { r: number; detail?: number }) {
  const { glass, frame } = useMemo(() => {
    const ico = new THREE.IcosahedronGeometry(r, detail);
    // Keep only the upper hemisphere.
    const pos = ico.attributes.position, keep: number[] = [];
    for (let i = 0; i < pos.count; i += 3) {
      const y = Math.min(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2));
      if (y > -0.02 * r) for (let k = 0; k < 3; k++) keep.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
    g.computeVertexNormals();
    const e = new THREE.EdgesGeometry(g, 1);
    ico.dispose();
    return { glass: g, frame: e };
  }, [r, detail]);
  useEffect(() => () => { glass.dispose(); frame.dispose(); }, [glass, frame]);
  return (
    <group>
      <mesh geometry={glass} castShadow>
        <meshPhysicalMaterial color="#7f98a6" roughness={0.06} metalness={0.15} transmission={0.35} transparent opacity={0.55} envMapIntensity={1.6} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={frame}>
        <lineBasicMaterial color="#d9dbd8" />
      </lineSegments>
    </group>
  );
}
/**
 * Analog research station (Mars-500 / C-Space style). Layout follows the aerial
 * reference: a glass geodesic hub with four pressurised corridors in a cross,
 * lab/hab modules with rooftop arrays, segmented domes, an arched greenhouse,
 * a red-ringed EVA airlock, a pressurised rover and outer inflatable domes.
 * All hull surfaces use weathered panel textures (seams, rivets, grime, dust).
 */
function MarsBaseComplex({ cx, cz, ground }: { cx: number; cz: number; ground: string }) {
  const logo = useBaseLogo();
  const y = (x: number, z: number) => terrainHeight(cx + x, cz + z);
  const hull = useMemo(() => panelSet({ base: "#eeede7", grid: [6, 3], dust: 0.55, vents: true, grime: 0.6, repeat: [2, 1], seed: 11 }), []);
  const ribbed = useMemo(() => panelSet({ base: "#f1f0ea", grid: [12, 1], dust: 0.45, rivets: false, grime: 0.4, repeat: [2, 1], seed: 5 }), []);
  const domeSkin = useMemo(() => panelSet({ base: "#ecebe5", grid: [16, 4], dust: 0.5, rivets: false, grime: 0.5, seed: 9 }), []);
  const metal = useMemo(() => metalSet("#8f9497"), []);
  const H = (props: { color?: string }) => <meshStandardMaterial {...hull} color={props.color ?? "#ffffff"} roughness={1} metalness={0.05} bumpScale={0.6} />;
  const win = <meshStandardMaterial color="#1f2d36" roughness={0.08} metalness={0.7} emissive="#ffcf8a" emissiveIntensity={0.1} envMapIntensity={1.5} />;
  const solar = <meshStandardMaterial {...useMemo(() => panelSet({ base: "#16244a", grid: [8, 4], dust: 0.15, rivets: false, grime: 0.1, roughness: 0.25, seed: 2 }), [])} color="#ffffff" metalness={0.5} roughness={1} />;
  /** Rectangular module: panelled hull, roof array, windows, door, roof railing, footings. */
  const Module = ({ x, z, w, d, h = 2.8, rot = 0 }: { x: number; z: number; w: number; d: number; h?: number; rot?: number }) => (
    <group position={[cx + x, y(x, z), cz + z]} rotation={[0, rot, 0]}>
      <mesh position={[0, h / 2 + 0.25, 0]} castShadow receiveShadow><boxGeometry args={[w, h, d]} /><H /></mesh>
      <mesh position={[0, h + 0.27, 0]}><boxGeometry args={[w + 0.12, 0.08, d + 0.12]} /><meshStandardMaterial {...metal} color="#d8d8d2" metalness={0.5} roughness={1} /></mesh>
      {Array.from({ length: Math.max(1, Math.floor(w / 1.7)) }, (_, k, ) => (
        <group key={k} position={[-w / 2 + 1 + k * 1.7, h + 0.55, 0]} rotation={[-0.3, 0, 0]}>
          <mesh castShadow><boxGeometry args={[1.45, 0.05, d * 0.72]} />{solar}</mesh>
          <mesh position={[0, -0.18, 0]}><boxGeometry args={[0.06, 0.35, 0.06]} /><meshStandardMaterial color="#8a8e90" metalness={0.7} /></mesh>
        </group>
      ))}
      {Array.from({ length: Math.max(1, Math.floor(w / 2.2)) }, (_, k) => (
        <group key={`w${k}`} position={[-w / 2 + 1.2 + k * 2.2, h * 0.62, d / 2 + 0.01]}>
          <mesh><planeGeometry args={[1.0, 0.55]} />{win}</mesh>
          <mesh position={[0, 0, -0.005]}><planeGeometry args={[1.12, 0.67]} /><meshStandardMaterial color="#b9b8b0" /></mesh>
        </group>
      ))}
      {/* Footings so the module sits on the regolith */}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.3), 0.12, sz * (d / 2 - 0.3)]}><boxGeometry args={[0.45, 0.3, 0.45]} /><meshStandardMaterial {...metal} color="#7d8183" metalness={0.6} roughness={1} /></mesh>
      )))}
      {/* Roof hand-rail */}
      {[-1, 1].map((sz) => (
        <mesh key={sz} position={[0, h + 0.6, sz * (d / 2 - 0.05)]}><boxGeometry args={[w, 0.04, 0.04]} /><meshStandardMaterial color="#cfcfc9" metalness={0.6} /></mesh>
      ))}
    </group>
  );
  /** Pressurised corridor: rounded tube with ribs, sitting on saddles. */
  const Corridor = ({ a, b, r = 0.95 }: { a: [number, number]; b: [number, number]; r?: number }) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    return (
      <group position={[cx + mx, y(mx, mz) + r + 0.35, cz + mz]} rotation={[0, -Math.atan2(dz, dx), 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow><cylinderGeometry args={[r, r, len, 32]} /><meshStandardMaterial {...ribbed} color="#ffffff" roughness={1} bumpScale={0.6} /></mesh>
        {Array.from({ length: Math.max(2, Math.round(len / 1.4)) }, (_, k, ) => (
          <mesh key={k} position={[-len / 2 + 0.5 + k * ((len - 1) / Math.max(1, Math.round(len / 1.4) - 1)), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[r + 0.02, 0.05, 8, 32]} /><meshStandardMaterial color="#d3d2cb" roughness={0.6} />
          </mesh>
        ))}
        {[-len / 3, len / 3].map((sx) => (
          <mesh key={sx} position={[sx, -r - 0.2, 0]}><boxGeometry args={[0.35, 0.45, r * 1.6]} /><meshStandardMaterial {...metal} color="#7d8183" metalness={0.6} roughness={1} /></mesh>
        ))}
      </group>
    );
  };
  /** Segmented dome module (soft-shell over a short drum, with collar rings and portholes). */
  const SegDome = ({ x, z, r }: { x: number; z: number; r: number }) => (
    <group position={[cx + x, y(x, z), cz + z]}>
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow><cylinderGeometry args={[r, r * 1.02, 1.7, 48]} /><meshStandardMaterial {...domeSkin} color="#ffffff" roughness={1} bumpScale={0.5} /></mesh>
      <mesh position={[0, 1.7, 0]} castShadow><sphereGeometry args={[r, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial {...domeSkin} color="#ffffff" roughness={1} bumpScale={0.5} /></mesh>
      {[0.18, 0.4, 0.62, 0.82].map((f) => (
        <mesh key={f} position={[0, 1.7 + Math.sin(f * Math.PI / 2) * r, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[Math.cos(f * Math.PI / 2) * r + 0.015, 0.04, 6, 64]} /><meshStandardMaterial color="#cdccc5" roughness={0.6} />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, k) => (
        <mesh key={k} position={[Math.cos(k * 0.628) * (r + 0.01), 1.0, Math.sin(k * 0.628) * (r + 0.01)]} rotation={[0, -k * 0.628 + Math.PI / 2, 0]}>
          <circleGeometry args={[0.22, 24]} />{win}
        </mesh>
      ))}
      <mesh position={[0, 1.7 + r * 0.98, 0]}><cylinderGeometry args={[r * 0.28, r * 0.28, 0.12, 24]} /><meshStandardMaterial color="#c8c7c0" /></mesh>
    </group>
  );
  // Arched greenhouse parameters.
  const gx = -1, gz = 12.5, gL = 11, gR = 3.2;
  return (
    <group>
      {/* Graded foundation pad and compacted tracks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, y(0, 0) + 0.02, cz]} receiveShadow>
        <circleGeometry args={[27, 64]} />
        <meshStandardMaterial color={ground} roughness={1} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {/* Central hub: panelled drum, window band, glass geodesic dome */}
      <group position={[cx, y(0, 0), cz]}>
        <mesh position={[0, 1.7, 0]} castShadow receiveShadow><cylinderGeometry args={[5.8, 6.0, 3.4, 64]} /><meshStandardMaterial {...hull} color="#ffffff" roughness={1} bumpScale={0.6} /></mesh>
        <mesh position={[0, 2.3, 0]}><cylinderGeometry args={[5.83, 5.83, 0.55, 64, 1, true]} />{win}</mesh>
        <mesh position={[0, 3.45, 0]}><cylinderGeometry args={[5.95, 5.95, 0.16, 64]} /><meshStandardMaterial {...metal} color="#d6d5cf" metalness={0.4} roughness={1} /></mesh>
        <group position={[0, 3.5, 0]}><GeodesicDome r={5.4} /></group>
        {/* Interior: hydroponics trays and warm light visible through the glass */}
        <mesh position={[0, 3.9, 0]}><cylinderGeometry args={[3.2, 3.2, 0.5, 32]} /><meshStandardMaterial color="#4f7a3e" roughness={0.9} /></mesh>
        <pointLight position={[0, 5.5, 0]} intensity={70} distance={20} color="#ffe2b8" />
        <mesh position={[0, 1.5, 6.03]}><circleGeometry args={[0.95, 48]} /><meshStandardMaterial map={logo} transparent roughness={0.5} /></mesh>
      </group>
      {/* Cross of corridors to the wings */}
      <Corridor a={[5.6, 0]} b={[10, 0]} />
      <Corridor a={[-5.6, 0]} b={[-10, 0]} />
      <Corridor a={[0, -5.6]} b={[0, -10]} />
      <Corridor a={[0, 5.6]} b={[0, 7.4]} />
      <Corridor a={[13.5, 3]} b={[13.5, 9]} r={0.8} />
      <Corridor a={[-13.5, -3]} b={[-13.5, -9.5]} r={0.8} />
      {/* Wing modules */}
      <Module x={14} z={0} w={8} d={4.2} />
      {/* West wing: imported NASA Habitat Demonstration Unit (both parts) */}
      <group position={[cx - 17, y(-17, 0), cz]} rotation={[0, Math.PI / 2, 0]}>
        <GltfModel id="hdu" />
      </group>
      <Module x={0} z={-14} w={4.4} d={7.5} />
      <Module x={8} z={-11} w={4.5} d={3.4} h={2.4} />
      <Module x={-7.5} z={10.5} w={4} d={3.2} h={2.4} rot={0.05} />
      {/* Segmented domes at the corridor ends */}
      <SegDome x={13.5} z={12} r={3.1} />
      <SegDome x={-13.5} z={-12.5} r={2.6} />
      {/* Arched greenhouse with ribs and window strips */}
      <group position={[cx + gx, y(gx, gz), cz + gz]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[gR, gR, gL, 64, 1, true, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial {...ribbed} color="#ffffff" roughness={1} side={THREE.DoubleSide} bumpScale={0.6} />
        </mesh>
        {Array.from({ length: 9 }, (_, k) => (
          <mesh key={k} position={[0, 0, -gL / 2 + 0.3 + k * (gL - 0.6) / 8]}>
            <torusGeometry args={[gR + 0.07, 0.11, 10, 48, Math.PI]} /><meshStandardMaterial color="#e3e2db" roughness={0.55} />
          </mesh>
        ))}
        {[-1, 1].map((side) => Array.from({ length: 8 }, (_, k) => (
          <mesh key={`${side}${k}`} position={[side * gR * 0.74, gR * 0.67, -gL / 2 + 0.95 + k * (gL - 1.9) / 7]} rotation={[0, side * Math.PI / 2, side * -0.78]}>
            <planeGeometry args={[1.05, 1.7]} />{win}
          </mesh>
        )))}
        {[-1, 1].map((end) => (
          <mesh key={end} position={[0, 0, end * gL / 2]} rotation={[0, end > 0 ? 0 : Math.PI, 0]}>
            <circleGeometry args={[gR, 48, 0, Math.PI]} /><H />
          </mesh>
        ))}
        <mesh position={[0, 1.7, -gL / 2 - 0.02]} rotation={[0, Math.PI, 0]}><circleGeometry args={[0.8, 48]} /><meshStandardMaterial map={logo} transparent roughness={0.5} /></mesh>
      </group>
      {/* EVA airlock with red-white hatch ring (as in the reference) */}
      <group position={[cx + 18.6, y(18.6, 0), cz]}>
        <mesh position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[1.25, 1.25, 1.6, 40]} /><H /></mesh>
        <mesh position={[0.82, 1.4, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.85, 0.14, 12, 40]} /><meshStandardMaterial color="#c8202a" roughness={0.45} /></mesh>
        <mesh position={[0.83, 1.4, 0]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[0.72, 40]} /><meshStandardMaterial {...metal} color="#cfd1cf" metalness={0.7} roughness={1} /></mesh>
        <mesh position={[0.9, 1.4, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.3, 0.04, 8, 24]} /><meshStandardMaterial color="#3b3f42" metalness={0.8} /></mesh>
        <mesh position={[1.7, 0.4, 0]} rotation={[0, 0, -0.32]}><boxGeometry args={[1.9, 0.08, 1.1]} /><meshStandardMaterial {...metal} color="#9a9ea0" metalness={0.7} roughness={1} /></mesh>
      </group>
      {/* Pressurised rover parked at the airlock */}
      <group position={[cx + 21, y(21, 5), cz + 5]} rotation={[0, -0.4, 0]}>
        <mesh position={[0, 1.15, 0]} castShadow><boxGeometry args={[3.6, 1.5, 2.0]} /><H /></mesh>
        <mesh position={[1.8, 1.3, 0]}><boxGeometry args={[0.05, 0.7, 1.7]} />{win}</mesh>
        {[-1.2, 0, 1.2].flatMap((x) => [-1, 1].map((sz) => (
          <mesh key={`${x}${sz}`} position={[x, 0.45, sz * 1.05]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.45, 0.45, 0.35, 24]} /><meshStandardMaterial color="#2e2e2c" roughness={0.9} /></mesh>
        )))}
      </group>
      {/* Utility: water/oxygen tanks, cable trays on the ground, lamp posts, antenna */}
      {[[9, 7], [10.4, 7]].map(([x, z], k) => (
        <mesh key={`t${k}`} position={[cx + x, y(x, z) + 1.0, cz + z]} castShadow><cylinderGeometry args={[0.55, 0.55, 2.0, 24]} /><meshStandardMaterial {...metal} color="#d4d4cd" metalness={0.5} roughness={1} /></mesh>
      ))}
      {[[[6, 0], [6, 7]], [[-6, 0], [-6, 9]]].map(([a, b], k) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return <mesh key={`cab${k}`} position={[cx + (a[0] + b[0]) / 2, y(a[0], a[1]) + 0.06, cz + (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]}><boxGeometry args={[len, 0.1, 0.25]} /><meshStandardMaterial color="#3c3f41" /></mesh>;
      })}
      {[[22, -10], [-22, 6], [6, 24], [-6, -24], [22, 14], [-20, -16]].map(([x, z], k) => (
        <group key={k} position={[cx + x, y(x, z), cz + z]}>
          <mesh position={[0, 1.8, 0]}><cylinderGeometry args={[0.05, 0.07, 3.6, 8]} /><meshStandardMaterial color="#d6d6d0" metalness={0.5} /></mesh>
          <mesh position={[0, 3.65, 0]}><boxGeometry args={[0.32, 0.12, 0.32]} /><meshStandardMaterial color="#fff4dc" emissive="#fff0d0" emissiveIntensity={0.6} /></mesh>
        </group>
      ))}
      {/* Outer inflatable domes */}
      {[[-46, -58, 10], [-22, -66, 7]].map(([x, z, r], k) => (
        <group key={`big${k}`} position={[cx + x, y(x, z), cz + z]} scale={[1, 0.58, 1]}>
          <mesh castShadow><sphereGeometry args={[r, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial {...domeSkin} color="#ffffff" roughness={1} /></mesh>
          {Array.from({ length: 8 }, (_, j) => (
            <mesh key={j} rotation={[0, (j / 8) * Math.PI, 0]}>
              <torusGeometry args={[r * 1.003, 0.1, 6, 64, Math.PI]} /><meshStandardMaterial color="#c9c8c1" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
function SolarTower({ position }: { position: [number, number, number] }) {
  const head = useRef<THREE.Group>(null);
  useFrame(() => {
    const a = (engine.data.solTime - 0.25) * Math.PI * 2;
    if (head.current) head.current.rotation.y = Math.atan2(-Math.cos(a) * 0.82, -0.45) + Math.PI;
  });
  return (
    <group position={position}>
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.3, 8, 12]} />
        <meshStandardMaterial color="#d9d9d4" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.9, 1.1, 0.6, 16]} />
        <meshStandardMaterial color="#6e7073" roughness={0.8} />
      </mesh>
      <group ref={head} position={[0, 8.6, 0]}>
        <mesh castShadow>
          <boxGeometry args={[3.2, 7.5, 0.08]} />
          <SolarPanelMat />
        </mesh>
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[3.3, 7.6, 0.03]} />
          <meshStandardMaterial color="#c9c8c1" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
function SolarPanelMat() {
  const map = useMemo(() => {
    const t = hardwareTextures().cells.clone();
    t.repeat.set(1, 2.4);
    t.needsUpdate = true;
    return t;
  }, []);
  return <meshStandardMaterial map={map} color="#ffffff" metalness={0.5} roughness={0.25} />;
}
function SurfaceBase() {
  const dest = engine.data.destination;
  const { x: bx, z: bz } = BASE_POSITION;
  const y = (dx: number, dz: number) => terrainHeight(bx + dx, bz + dz);
  const beacon = useRef<THREE.Mesh>(null), pad = useRef<THREE.Mesh>(null), flood = useRef<THREE.Group>(null), dish = useRef<THREE.Group>(null);
  const docked = useGame((s) => s.data.docked);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime(), d = engine.data;
    if (beacon.current) (beacon.current.material as THREE.MeshBasicMaterial).color.setScalar(Math.sin(t * 3) > 0.6 ? 1 : 0.15).multiply(new THREE.Color("#ff3b30"));
    if (pad.current) (pad.current.material as THREE.MeshBasicMaterial).opacity = d.docked ? 0.45 + 0.25 * Math.sin(t * 4) : 0.18;
    if (flood.current) flood.current.visible = sunElevation(d.solTime) < 0.08;
    if (dish.current) dish.current.rotation.y = d.transmitting && d.docked ? Math.sin(t * 0.3) * 0.05 : 0;
  });
  const white = "#ecebe5";
  return (
    <group>
      <MarsBaseComplex cx={bx - 17} cz={bz - 9} ground={dest === "mars" ? "#a0705a" : "#8d8d8f"} />
      {/* Landing pad around the touchdown point: sintered surface, yellow ring, edge lights */}
      <group position={[0, terrainHeight(0, 0) + 0.03, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[7.5, 64]} />
          <meshStandardMaterial color={dest === "mars" ? "#6d5a4e" : "#8b8c8f"} roughness={0.85} />
        </mesh>
        {[[5.6, 5.9], [3.1, 3.3]].map(([a, b], i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[a, b, 64]} />
            <meshBasicMaterial color="#f2b632" />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[4.4, 4.5, 64]} />
          <meshBasicMaterial color="#5fd3e8" transparent opacity={0.6} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(a) * 7.7, 0, Math.sin(a) * 7.7]}>
              <mesh position={[0, 0.25, 0]}>
                <cylinderGeometry args={[0.12, 0.15, 0.5, 10]} />
                <meshStandardMaterial color="#2c3134" />
              </mesh>
              <mesh position={[0, 0.55, 0]}>
                <sphereGeometry args={[0.11, 10, 8]} />
                <meshBasicMaterial color={i % 3 === 0 ? "#ffcf40" : "#4fc3ff"} />
              </mesh>
            </group>
          );
        })}
      </group>
      {/* Deep-space relay: lattice tower + 3.4 m dish + red beacon */}
      <group position={[bx - 2, y(-2, 9), bz + 9]}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.45, 4, Math.sin(a) * 0.45]}>
              <cylinderGeometry args={[0.05, 0.07, 8, 6]} />
              <meshStandardMaterial color="#c5c6c1" metalness={0.7} roughness={0.4} />
            </mesh>
          );
        })}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[0, 0.5 + i, 0]} rotation={[0, i * 0.7, 0]}>
            <torusGeometry args={[0.47, 0.025, 4, 3]} />
            <meshStandardMaterial color="#c5c6c1" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
        <group ref={dish} position={[0, 8.4, 0]} rotation={[0, 0, 0]}>
          <group rotation={[-0.9, 0.6, 0]}>
            <mesh>
              <sphereGeometry args={[1.9, 36, 12, 0, Math.PI * 2, 0, 0.55]} />
              <meshStandardMaterial color="#f2f1ec" side={THREE.DoubleSide} roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 1.2, 6]} />
              <meshStandardMaterial color="#c9c9c3" />
            </mesh>
          </group>
          <mesh ref={beacon} position={[0, 1.6, 0]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshBasicMaterial color="#ff3b30" />
          </mesh>
        </group>
      </group>
      {/* Rover service & charging pad */}
      <group position={[bx, y(0, 0) + 0.04, bz]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[BASE_RADIUS * 0.62, 6]} />
          <meshStandardMaterial color="#5c5b57" roughness={0.85} />
        </mesh>
        <mesh ref={pad} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[BASE_RADIUS * 0.5, BASE_RADIUS * 0.56, 6]} />
          <meshBasicMaterial color="#58f0b4" transparent opacity={0.2} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, (i * Math.PI) / 2]} position={[0, 0.035, 0]}>
            <planeGeometry args={[0.2, 3.2]} />
            <meshBasicMaterial color="#f1c04d" />
          </mesh>
        ))}
        {/* Charging mast with umbilical arm */}
        <mesh position={[3.6, 1.1, 0]}>
          <boxGeometry args={[0.5, 2.2, 0.5]} />
          <meshStandardMaterial color="#d8d6ce" roughness={0.5} />
        </mesh>
        <mesh position={[2.9, 1.9, 0]} rotation={[0, 0, Math.PI / 2.4]}>
          <cylinderGeometry args={[0.06, 0.06, 1.6, 8]} />
          <meshStandardMaterial color="#f08a24" />
        </mesh>
      </group>
      {/* Spare-parts depot: cargo pallets, spare wheels, containers */}
      <group position={[bx + 8, y(8, 6), bz + 6]} rotation={[0, -0.4, 0]}>
        {[[0, 0], [2.6, 0], [1.3, 2.2]].map(([dx, dz], i) => (
          <mesh key={i} position={[dx, 0.75, dz]} castShadow>
            <boxGeometry args={[2.3, 1.5, 1.8]} />
            <meshStandardMaterial color={i === 1 ? "#c6c3b8" : "#e1ded5"} roughness={0.7} />
          </mesh>
        ))}
        {[0, 1, 2].map((i) => (
          <mesh key={`w${i}`} position={[-1.8, 0.42, i * 0.5]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.42, 0.42, 0.36, 24]} />
            <meshStandardMaterial color="#a9a8a3" metalness={0.75} roughness={0.45} />
          </mesh>
        ))}
      </group>
      {/* Floodlights for night operations */}
      <group ref={flood}>
        {[[-4, -6], [6, 4], [-6, 8]].map(([dx, dz], i) => (
          <group key={i} position={[bx + dx, y(dx, dz), bz + dz]}>
            <mesh position={[0, 2, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 4, 6]} />
              <meshStandardMaterial color="#9a9a96" />
            </mesh>
            <mesh position={[0, 4, 0]}>
              <boxGeometry args={[0.5, 0.2, 0.3]} />
              <meshBasicMaterial color="#fff3d8" />
            </mesh>
            <pointLight position={[0, 3.8, 0]} intensity={60} distance={26} decay={1.6} color="#ffe9c4" />
          </group>
        ))}
      </group>
      <Html position={[bx, y(0, 0) + 6, bz]} center distanceFactor={22} zIndexRange={[1, 0]} style={{ pointerEvents: "none" }}>
        <div className="target-label base-label">
          <b>SURFACE BASE</b>
          <span>Relay · charging · spare parts</span>
          <small>{docked ? "ROVER DOCKED · CHARGING" : `Drive inside ${BASE_RADIUS} m to dock`}</small>
        </div>
      </Html>
    </group>
  );
}
/**
 * Entry / approach cinematic shown before the pilot takes control: the whole
 * planet as a sphere with the entry vehicle (heat shield + backshell) falling
 * toward it. Mars shows shock-layer plasma; airless bodies show the braking burn.
 */
function EntryView() {
  const dest = engine.data.destination, airless = isLunarLike(dest);
  const capsule = useRef<THREE.Group>(null), plasma = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const R = 40;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const f = (t % 14) / 14; // looping approach
    const alt = R + 18 * (1 - f) + 2.2;
    const ang = -0.6 + f * 0.9;
    const pos = new THREE.Vector3(Math.sin(ang) * alt, Math.cos(ang) * alt * 0.35 + 6 * (1 - f), Math.cos(ang) * alt);
    capsule.current?.position.copy(pos);
    capsule.current?.lookAt(0, 0, 0);
    if (plasma.current) {
      plasma.current.visible = !airless && f > 0.25 && f < 0.85;
      plasma.current.scale.setScalar(1 + Math.sin(t * 40) * 0.05);
    }
    // Pull back from a full-globe view to a chase view on the vehicle.
    const k = Math.min(1, f * 1.4);
    const far = new THREE.Vector3(70, 40, 110);
    const near = pos.clone().add(new THREE.Vector3(4, 2.5, 6));
    camera.position.lerpVectors(far, near, k * k * (3 - 2 * k));
    camera.lookAt(new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), pos, k));
  });
  return (
    <>
      <color attach="background" args={["#000"]} />
      <ambientLight intensity={0.06} />
      <directionalLight position={[-80, 40, 60]} intensity={1.5} color="#fff4e6" />
      <Stars radius={600} depth={200} count={3500} factor={4} saturation={0.1} fade speed={0} />
      <Planet kind={dest === "mercury" ? "mercury" : dest === "moon" ? "moon" : "mars"} radius={R} spin />
      {dest === "moon" && (
        <group position={[-260, 120, -380]}>
          <Planet kind="earth" radius={11} spin />
        </group>
      )}
      <group ref={capsule}>
        <EntryCapsule plasma={plasma} airless={airless} />
      </group>
    </>
  );
}
/**
 * MSL/Perseverance-style aeroshell: 70° sphere-cone heat shield (PICA, dark
 * brown) on the front, a conical backshell with a parachute canister on the
 * back. Built along +Z so lookAt() points the heat shield at the planet.
 */
function EntryCapsule({ plasma, airless }: { plasma: React.RefObject<THREE.Mesh | null>; airless: boolean }) {
  const R = 1.1;
  const shield = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    // Blunt spherical nose cap then a shallow 70° cone out to the shoulder.
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * 0.35;
      pts.push(new THREE.Vector2(Math.sin(a) * R * 0.75, 0.32 - (1 - Math.cos(a)) * R * 0.75));
    }
    pts.push(new THREE.Vector2(R, 0.04), new THREE.Vector2(R * 1.02, 0), new THREE.Vector2(R * 0.98, -0.04));
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  const back = useMemo(() => new THREE.LatheGeometry([
    new THREE.Vector2(R * 0.98, 0), new THREE.Vector2(R * 0.62, -0.95), new THREE.Vector2(R * 0.42, -1.05),
    new THREE.Vector2(R * 0.34, -1.25), new THREE.Vector2(R * 0.3, -1.45), new THREE.Vector2(0.001, -1.47),
  ], 64), []);
  useEffect(() => () => { shield.dispose(); back.dispose(); }, [shield, back]);
  return (
    <group rotation={[Math.PI / 2, 0, 0]} scale={0.6}>
      <mesh geometry={shield}>
        <meshStandardMaterial color="#3a2a1e" roughness={0.92} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={back}>
        <meshStandardMaterial color="#e9e7e0" roughness={0.55} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Backshell RCS thruster pods and cruise-stage interface ring */}
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.cos(k * Math.PI / 2) * R * 0.78, -0.45, Math.sin(k * Math.PI / 2) * R * 0.78]}>
          <boxGeometry args={[0.12, 0.18, 0.12]} />
          <meshStandardMaterial color="#8d918f" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R * 0.99, 0.035, 8, 64]} />
        <meshStandardMaterial color="#b4b6b1" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Shock-layer plasma hugging the heat shield (atmospheric entry only) */}
      <mesh ref={plasma} position={[0, 0.42, 0]} visible={!airless}>
        <sphereGeometry args={[R * 1.25, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
        <meshBasicMaterial color="#ffb070" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
function MarsTargets() {
  const observations = useGame((s) => s.data.observations);
  return (
    <>
      {engine.targets().map((t, i) => (
        <group key={t.id} position={[t.x, terrainHeight(t.x, t.z), t.z]}>
          {Array.from({ length: i === 1 ? 5 : 3 }, (_, j) => (
            <mesh key={j} position={[(j - 1) * 1.2, 0.6 + j * 0.3, (j % 2) * 0.7]} rotation={[0.1 * j, 0.7 * j, 0.06 * j]} castShadow receiveShadow>
              <dodecahedronGeometry args={[1.1 + j * 0.15, 1]} />
              <meshStandardMaterial color={i === 2 ? "#a88a66" : i === 1 ? "#7e5a45" : "#4b3e37"} roughness={0.95} flatShading />
            </mesh>
          ))}
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[4.6, 4.75, 48]} />
            <meshBasicMaterial color={observations.includes(t.id) ? "#a7cdab" : "#f9c389"} transparent opacity={0.7} />
          </mesh>
          <Html position={[0, 4.5, 0]} center distanceFactor={22} zIndexRange={[1, 0]} style={{ pointerEvents: "none" }}>
            <div className="target-label">
              <b>{t.id}</b>
              <span>{t.name}</span>
              <small>{observations.includes(t.id) ? "OBSERVATION STORED" : `${t.instrument.toUpperCase()} SITE`}</small>
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}
export default function World() {
  const destination = useGame((s) => s.data.destination);
  const airless = isLunarLike(destination);
  const gravity = SURFACE_GRAVITY[destination];
  const stage = useGame((s) => s.data.stage),
    landingStarted = useGame((s) => s.data.landingStarted),
    settings = useGame((s) => s.settings),
    design = useGame((s) => s.data.design);
  const predicted = useRef<THREE.Mesh>(null),
    rover = useRef<THREE.Group>(null),
    lander = useRef<THREE.Group>(null),
    cameraTarget = useRef(new THREE.Vector3()),
    orbit = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const landedDesign = useMemo(() => ({ ...design, parts: { ...design.parts, rover: false } }), [design]);
  useEffect(() => {
    camera.position.set(0, 8, 15);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = stage === "landing" ? 55 : 50;
      camera.far = 80000;
      camera.near = 0.1;
      camera.updateProjectionMatrix();
    }
    return () => {
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.far = 1200;
        camera.updateProjectionMatrix();
      }
    };
  }, [camera, stage]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const d = engine.data, r = d.rover, l = d.lander;
    if (stage === "landing" && !d.landingStarted) return; // EntryView drives the camera
    if (rover.current) {
      rover.current.position.set(r.x, terrainHeight(r.x, r.z), r.z);
      const view = roverView(r.heading);
      const pitch = Math.atan((terrainHeight(r.x + view.forwardX, r.z + view.forwardZ) - terrainHeight(r.x - view.forwardX, r.z - view.forwardZ)) / 2);
      const rightX = Math.cos(r.heading), rightZ = Math.sin(r.heading);
      const roll = Math.atan((terrainHeight(r.x + rightX, r.z + rightZ) - terrainHeight(r.x - rightX, r.z - rightZ)) / 2);
      rover.current.rotation.set(pitch, view.modelYaw, roll, "YXZ");
    }
    if (lander.current) {
      lander.current.position.set(l.x, l.y, l.z);
      lander.current.rotation.set(l.pitch, l.yaw, -l.roll, "YXZ");
    }
    if (predicted.current) {
      const impactTime = (l.vy + Math.sqrt(l.vy * l.vy + 2 * gravity * Math.max(0, l.y))) / gravity;
      const px = clamp(l.x + l.vx * impactTime, -145, 145), pz = clamp(l.z + l.vz * impactTime, -145, 145);
      predicted.current.position.set(px, terrainHeight(px, pz) + 0.1, pz);
    }
    const zoom = settings.flightZoom || 1;
    const smooth = settings.reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    if (stage === "landing") {
      const h = Math.max(0, l.y - terrainHeight(l.x, l.z));
      // Chase camera behind the vehicle in its own heading frame, ~10 m away:
      // the lander fills a useful part of the frame and its tilt is readable.
      const back = new THREE.Vector3(Math.sin(l.yaw), 0, Math.cos(l.yaw));
      if (settings.flightCamera === "overview") {
        tmp.set(l.x + 26 * zoom, l.y + 18 * zoom, l.z + 30 * zoom);
      } else if (settings.flightCamera === "cinematic") {
        const a = d.stageTime * 0.08;
        tmp.set(l.x + Math.sin(a) * 13 * zoom, l.y + 3 * zoom, l.z + Math.cos(a) * 13 * zoom);
      } else {
        tmp.set(l.x + back.x * 10 * zoom, l.y + (3.6 + Math.min(4, h * 0.01)) * zoom, l.z + back.z * 10 * zoom);
      }
      if (settings.flightCamera !== "overview") rigCamera(tmp, new THREE.Vector3(l.x, l.y, l.z));
      if (camera.position.distanceTo(tmp) > 120) camera.position.copy(tmp); // snap instead of a long swoop
      camera.position.lerp(tmp, smooth);
      cameraTarget.current.set(l.x, l.y - 1.2 - Math.min(3, h * 0.008), l.z);
      camera.lookAt(cameraTarget.current);
      return;
    }
    const h = terrainHeight(r.x, r.z);
    const view = roverView(r.heading);
    if (settings.camera === "orbit" && orbit.current) {
      cameraTarget.current.set(r.x, h + 1, r.z);
      const delta = cameraTarget.current.clone().sub(orbit.current.target);
      camera.position.add(delta);
      orbit.current.target.copy(cameraTarget.current);
      orbit.current.update();
      return;
    }
    if (settings.camera === "map") tmp.set(r.x, h + 65 * zoom, r.z + 0.1);
    else if (settings.flightCamera === "cinematic") tmp.set(r.x + Math.sin(d.stageTime * 0.05 + 0.65) * 12 * zoom, h + 5 * zoom, r.z + Math.cos(d.stageTime * 0.05 + 0.65) * 12 * zoom);
    else if (settings.flightCamera === "overview") tmp.set(r.x + 22 * zoom, h + 18 * zoom, r.z + 26 * zoom);
    else tmp.set(r.x + view.cameraX * 0.85 * zoom, Math.max(h + 3.6 * zoom, terrainHeight(r.x + view.cameraX, r.z + view.cameraZ) + 1.5), r.z + view.cameraZ * 0.85 * zoom);
    if (settings.camera !== "map") rigCamera(tmp, new THREE.Vector3(r.x, h + 1.2, r.z));
    camera.position.lerp(tmp, smooth);
    cameraTarget.current.set(r.x + view.lookX, h + 1.2, r.z + view.lookZ);
    camera.lookAt(cameraTarget.current);
  });
  if (stage === "landing" && !landingStarted) return <EntryView />;
  return (
    <>
      <color attach="background" args={[airless ? "#000000" : "#a88a70"]} />
      {!airless && <fog attach="fog" args={["#c19c7c", stage === "landing" ? 8000 : 900, stage === "landing" ? 140000 : 60000]} />}
      <SurfaceSky />
      <SunLighting />
      {destination === "moon" && (
        // Earth hangs fixed in the lunar sky: ~1.9° across (true size), ~22° up, ahead of the start heading.
        <group position={[1400, 2700, -6600]}>
          <Planet kind="earth" radius={120} spin />
        </group>
      )}
      <Terrain />
      <HorizonRing />
      {stage === "surface" && <RoverTracks />}
      {stage === "surface" && <RoverDust />}
      <Rocks />
      {settings.quality !== "low" && destination === "mars" && <Dust />}
      <LandingRegolith />
      <SurfaceBase />
      {destination === "mars" && <MarsTargets />}
      {stage === "landing" ? (
        <>
          <group ref={lander}>
            {airless ? (
              // Airless bodies: imported Apollo Lunar Module (footpads on the solver's contact height).
              <group position={[0, -0.8, 0]}>
                <GltfModel id="apolloLM" />
                <group position={[0, 1.55, 0]}><LanderFlame /></group>
              </group>
            ) : (
              <>
                <group position={[0, 0.6, 0]}>
                  {/* Solar wings stay folded through entry and powered descent; they open after touchdown. */}
                  <Spacecraft design={design} separated solarDeployed={false} />
                </group>
                <LanderFlame />
              </>
            )}
          </group>
          <mesh ref={predicted} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.4, 2.6, 32]} />
            <meshBasicMaterial color="#8ae0df" transparent opacity={0.8} />
          </mesh>
        </>
      ) : (
        <>
          {airless ? (
            <group position={[engine.data.lander.x, terrainHeight(engine.data.lander.x, engine.data.lander.z), engine.data.lander.z]}>
              <GltfModel id="apolloLM" />
            </group>
          ) : (
            <group position={[engine.data.lander.x, terrainHeight(engine.data.lander.x, engine.data.lander.z) + 1.4, engine.data.lander.z]}>
              <Spacecraft design={landedDesign} separated />
            </group>
          )}
          <group ref={rover}>
            <Rover design={design} moving />
          </group>
        </>
      )}
      {settings.camera === "orbit" && stage !== "landing" && (
        <OrbitControls
          ref={orbit}
          target={[engine.data.rover.x, terrainHeight(engine.data.rover.x, engine.data.rover.z) + 1, engine.data.rover.z]}
          minDistance={3}
          maxDistance={60}
          maxPolarAngle={Math.PI * 0.48}
          enablePan={false}
        />
      )}
    </>
  );
}

let rockGeo: THREE.BufferGeometry | null = null;
/** Weathered boulder: subdivided sphere displaced by layered noise, flattened base, smooth normals. */
function rockGeometry() {
  if (rockGeo) return rockGeo;
  const g = new THREE.IcosahedronGeometry(1, 4), p = g.attributes.position, v = new THREE.Vector3();
  const h = (x: number, y: number, z: number) => Math.sin(x * 2.1 + y * 1.3) * Math.cos(z * 1.7 - x) * 0.5 + 0.5;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let d = 1 + 0.22 * (h(v.x, v.y, v.z) - 0.5) + 0.1 * (h(v.x * 3.1, v.y * 2.7, v.z * 3.3) - 0.5) + 0.04 * (h(v.x * 7, v.y * 6, v.z * 8) - 0.5);
    // Faceted fracture planes like real basalt.
    d -= Math.max(0, v.x * 0.6 + v.z * 0.3 - 0.55) * 0.5 + Math.max(0, -v.z * 0.7 + v.y * 0.2 - 0.6) * 0.4;
    v.multiplyScalar(d);
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.25;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  rockGeo = g;
  return g;
}
function rockMat() {
  return panelSet({ base: "#8d7a6a", grid: [1, 1], dust: 0.4, rivets: false, grime: 1.4, roughness: 0.95, seed: 31 });
}
function Rocks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const obj = new THREE.Object3D();
    rocks.forEach((r, i) => {
      obj.position.set(r.x, terrainHeight(r.x, r.z) + r.size * 0.35, r.z);
      obj.scale.set(r.size, r.size * 0.65, r.size * 0.8);
      obj.rotation.set(0.2, r.rotation, 0.14);
      const shade = new THREE.Color().setHSL(
        0.045 + (i % 7) * 0.002,
        isLunarLike(engine.data.destination) ? 0.015 : 0.18,
        0.24 + (i % 5) * 0.025,
      );
      ref.current!.setColorAt(i, shade);
      obj.updateMatrix();
      ref.current!.setMatrixAt(i, obj.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, rocks.length]}
      castShadow
      receiveShadow
    >
      <primitive object={rockGeometry()} attach="geometry" />
      <meshStandardMaterial {...rockMat()} color="#c9b8a6" roughness={1} bumpScale={1.2} />
    </instancedMesh>
  );
}
function Dust() {
  const points = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const r = seeded(71);
    return new Float32Array(
      Array.from({ length: 150 }, () => [
        (r() - 0.5) * 100,
        r() * 8,
        (r() - 0.5) * 100,
      ]).flat(),
    );
  }, []);
  useFrame((_, dt) => {
    if (points.current) points.current.rotation.y += dt * 0.004;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        color="#edb68b"
        transparent
        opacity={0.18}
        depthWrite={false}
      />
    </points>
  );
}
function RoverDust() {
  const ref = useRef<THREE.Group>(null);
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        side: i % 2 === 0 ? -1 : 1,
        spread: 0.35 + (i % 6) * 0.18,
        lift: 0.08 + (i % 5) * 0.05,
        phase: i * 1.7,
      })),
    [],
  );
  useFrame(({ clock }) => {
    const r = engine.data.rover;
    const speed = Math.abs(r.speed);
    if (!ref.current) return;
    const active = speed > 0.08;
    ref.current.visible = active;
    if (!active) return;
    const t = clock.getElapsedTime();
    const intensity = Math.min(1, speed / 2.5);
    const backwardX = -Math.cos(r.heading);
    const backwardZ = -Math.sin(r.heading);
    ref.current.children.forEach((child, i) => {
      const p = particles[i];
      const age = (t * (0.32 + intensity * 0.45) + p.phase) % 1;
      const distance = 0.35 + age * (1.3 + intensity * 1.8);
      const sideX = Math.sin(r.heading) * p.side * (p.spread + age * 0.55);
      const sideZ = -Math.cos(r.heading) * p.side * (p.spread + age * 0.55);
      const x = r.x + backwardX * distance + sideX;
      const z = r.z + backwardZ * distance + sideZ;
      child.position.set(
        x,
        terrainHeight(x, z) + p.lift + age * (0.25 + intensity * 0.35),
        z,
      );
      const size = (0.08 + (1 - age) * 0.18) * intensity;
      child.scale.setScalar(size);
      child.rotation.y = t * 0.7 + p.phase;
    });
  });
  return (
    <group ref={ref} visible={false}>
      {particles.map((p) => (
        <mesh key={p.phase}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial
            color="#d3a27e"
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
function LandingRegolith() {
  const cloud = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 120;
  useFrame(({ clock }) => {
    const l = engine.data.lander;
    const active = engine.data.stage === "landing" && l.status === "flying" && l.throttle > .2;
    if (!cloud.current) return;
    cloud.current.visible = active;
    if (!active) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const age = (t * .38 + i / count) % 1;
      const angle = i * 2.399963;
      const radius = .6 + age * (5 + l.throttle * 7);
      const x = l.x + Math.cos(angle) * radius;
      const z = l.z + Math.sin(angle) * radius;
      const y = terrainHeight(x, z) + .05 + 2 * age - .81 * age * age;
      const size = .035 + age * .12;
      dummy.position.set(x, y, z);
      dummy.scale.set(size * 1.6, size * .6, size);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      cloud.current.setMatrixAt(i, dummy.matrix);
    }
    cloud.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={cloud} args={[undefined, undefined, count]} frustumCulled={false}>
    <sphereGeometry args={[1, 7, 5]} />
    <meshStandardMaterial color="#a8a8a6" roughness={1} transparent opacity={.38} depthWrite={false} />
  </instancedMesh>;
}
function RoverTracks() {
  const ref = useRef<THREE.InstancedMesh>(null),
    cursor = useRef(0),
    last = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    if (ref.current) ref.current.count = 0;
  }, []);
  useFrame(() => {
    const r = engine.data.rover;
    if (!ref.current) return;
    if (last.current < 0) {
      last.current = r.distance;
      return;
    }
    if (r.distance - last.current < 0.4 || Math.abs(r.speed) < 0.05) return;
    last.current = r.distance;
    for (const side of [-1, 1]) {
      const x = r.x + Math.cos(r.heading) * side * 1.04,
        z = r.z + Math.sin(r.heading) * side * 1.04;
      dummy.position.set(x, terrainHeight(x, z) + 0.024, z);
      dummy.rotation.set(-Math.PI / 2, -r.heading, 0, "YXZ");
      dummy.updateMatrix();
      ref.current.setMatrixAt(cursor.current % 240, dummy.matrix);
      cursor.current++;
    }
    ref.current.count = Math.min(240, cursor.current);
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, 240]}
      frustumCulled={false}
    >
      <planeGeometry args={[0.28, 0.52]} />
      <meshBasicMaterial
        color="#6b4b37"
        transparent
        opacity={0.24}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </instancedMesh>
  );
}

function LanderFlame() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) {
      const l = engine.data.lander;
      ref.current.visible = l.status === "flying" && l.throttle > 0.01;
      ref.current.scale.set(1, Math.max(0.01, l.throttle * 2.5), 1);
      ref.current.position.y = -0.58 - l.throttle * 1.2;
    }
  });
  return (
    <mesh ref={ref} position={[0, -0.8, 0]} rotation={[0, 0, Math.PI]}>
      <coneGeometry args={[0.3, 1.5, 16]} />
      <meshBasicMaterial
        color="#b7e7ff"
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </mesh>
  );
}

