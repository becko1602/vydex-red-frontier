import { useMemo, useRef, useEffect } from "react";
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
import { Planet } from "./Planet";
import { isLunarLike, SURFACE_GRAVITY, type DestinationId } from "../data/destinations";
import { makeSurfaceTextures } from "./surfaceTextures";
import { hardwareTextures } from "./hardwareTextures";
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
  const texture = useMemo(() => makeSurfaceTextures(isLunarLike(dest)), [dest]);
  useEffect(() => () => texture.dispose(), [texture]);
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
      <meshStandardMaterial vertexColors map={texture.color} bumpMap={texture.bump} bumpScale={0.04} roughness={1} />
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
  const texture = useMemo(() => makeSurfaceTextures(isLunarLike(dest)), [dest]);
  useEffect(() => () => texture.dispose(), [texture]);
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
      <meshStandardMaterial vertexColors map={texture.color} bumpMap={texture.bump} bumpScale={0.04} roughness={1} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
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
      {/* Habitat: geodesic glass dome over a pressurised core, joined to a horizontal module with a docking hatch */}
      <group position={[bx - 9, y(-9, -5), bz - 5]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <cylinderGeometry args={[7.4, 7.8, 0.6, 48]} />
          <meshStandardMaterial color={dest === "mars" ? "#8a6a55" : "#8d8d8f"} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[7, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#cfe3ef" transparent opacity={0.22} roughness={0.05} metalness={0.1} transmission={0.6} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.3, 0]} scale={[1, 1, 1]}>
          <icosahedronGeometry args={[7.02, 3]} />
          <meshBasicMaterial color="#e9eef1" wireframe transparent opacity={0.45} />
        </mesh>
        {/* Interior: core module, lab racks, warm lighting */}
        <mesh position={[0, 2.2, 0]} castShadow>
          <cylinderGeometry args={[2.6, 2.8, 3.8, 32]} />
          <meshStandardMaterial color="#e7e6df" roughness={0.6} />
        </mesh>
        <mesh position={[0, 4.2, 0]}>
          <sphereGeometry args={[2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#dcdbd3" roughness={0.6} />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} position={[k * 4.3, 1.4, 1.5]} castShadow>
            <boxGeometry args={[1.6, 2.2, 2.4]} />
            <meshStandardMaterial color="#c9c8c0" roughness={0.7} />
          </mesh>
        ))}
        <pointLight position={[0, 3, 0]} intensity={40} distance={14} color="#ffd9a8" />
        {/* Horizontal pressurised module + round docking hatch */}
        <group position={[10.5, 2.6, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[2.4, 2.4, 9, 40]} />
            <meshStandardMaterial color="#ecebe6" roughness={0.55} metalness={0.1} />
          </mesh>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[-3.6 + i * 1.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[2.42, 0.06, 6, 40]} />
              <meshStandardMaterial color="#b8b7b0" roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[4.55, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[2.4, 2.4, 0.15, 40]} />
            <meshStandardMaterial color="#d7d6cf" roughness={0.5} />
          </mesh>
          <mesh position={[4.66, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[1.1, 40]} />
            <meshStandardMaterial color="#1f2a33" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[4.68, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <ringGeometry args={[1.1, 1.3, 40]} />
            <meshStandardMaterial color="#5b6066" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.4, 2.42]}>
            <planeGeometry args={[1.8, 0.7]} />
            <meshStandardMaterial color="#2a3b47" emissive="#ffcf8a" emissiveIntensity={0.35} />
          </mesh>
          {[-3, 3].map((x) => (
            <mesh key={x} position={[x, -2.3, 0]}>
              <boxGeometry args={[0.5, 0.9, 3.6]} />
              <meshStandardMaterial color="#8d9092" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Vertical sun-tracking solar arrays on masts (tall panels for low Sun angles) */}
      {[[-24, -10], [-20, -18], [-30, -14], [-14, -20]].map(([dx, dz], i) => (
        <SolarTower key={i} position={[bx + dx, y(dx, dz), bz + dz]} />
      ))}
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
      <group ref={capsule}>
        <group rotation={[Math.PI / 2, 0, 0]} scale={0.6}>
          <mesh position={[0, 0.25, 0]}>
            <coneGeometry args={[1.0, 0.9, 40, 1, true]} />
            <meshStandardMaterial color="#e8e6df" metalness={0.3} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.25, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[1.12, 0.35, 40]} />
            <meshStandardMaterial color="#3a2b20" roughness={0.9} />
          </mesh>
          <mesh ref={plasma} position={[0, -0.7, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[1.5, 3.2, 32, 1, true]} />
            <meshBasicMaterial color="#ff9a4a" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </>
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
        <group position={[2600, 1900, -6200]}>
          <Planet kind="earth" radius={120} spin={false} />
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
            <group position={[0, 0.6, 0]}>
              <Spacecraft design={design} separated />
            </group>
            <LanderFlame />
          </group>
          <mesh ref={predicted} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.4, 2.6, 32]} />
            <meshBasicMaterial color="#8ae0df" transparent opacity={0.8} />
          </mesh>
        </>
      ) : (
        <>
          <group position={[engine.data.lander.x, terrainHeight(engine.data.lander.x, engine.data.lander.z) + 1.4, engine.data.lander.z]}>
            <Spacecraft design={landedDesign} separated />
          </group>
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
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#b8a797" roughness={0.97} flatShading />
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

