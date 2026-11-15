import { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Line, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { engine } from "../sim/game";
import { useGame } from "../store";
import { rigCamera } from "../cameraRig";
import { Planet } from "./Planet";
import { Asteroid } from "./Asteroid";
import { Spacecraft } from "./Spacecraft";
import { SunBody } from "./SunBody";
import { C } from "../data/scienceConstants";
import { solarSystem, type SolarBodyId } from "../data/solarSystem";
import { SOLAR_DISTANCE_AU, type DestinationId } from "../data/destinations";
import { heliocentricBodyIds, heliocentricOrbits, type HeliocentricBodyId } from "../sim/heliocentric";

/**
 * One consistent distance mapping for the whole Solar System view.
 * Inner planets (≤1.6 AU) are true-proportional; beyond Mars distances are
 * compressed with a power law so Neptune still fits. Every body uses the same
 * function, so no two orbits can collapse onto each other.
 */
export const auToScene = (au: number) => (au <= 1.6 ? au * 5.25 : 8.4 + Math.pow(au - 1.6, 0.62) * 4.2);
/** Visual radii: real ratios inside each group, inflated for visibility, always far smaller than orbit spacing. */
const BODY_R: Record<HeliocentricBodyId, number> = {
  mercury: 0.05, venus: 0.1, earth: 0.105, mars: 0.07,
  jupiter: 0.55, saturn: 0.46, uranus: 0.26, neptune: 0.25,
};
const SUN_R = 0.9;
const AU = C.AU;
function orbitAU(id: HeliocentricBodyId) {
  return heliocentricOrbits[id].radiusM / AU;
}
/** Hohmann ellipse between circular orbits r1 → r2 (AU). Departure on +X. */
function hohmann(r1: number, r2: number, f: number) {
  const a = (r1 + r2) / 2, e = Math.abs(r2 - r1) / (r1 + r2), outward = r2 > r1;
  const M = Math.min(1, Math.max(0, f)) * Math.PI;
  let E = M;
  for (let i = 0; i < 14; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  // Outward: starts at perihelion (angle 0). Inward: starts at aphelion.
  const angle = outward ? nu : nu;
  return { r: outward ? r : a * (1 + e * Math.cos(E)), angle };
}
const periodYears = (au: number) => Math.pow(au, 1.5);
const transferYears = (r1: number, r2: number) => 0.5 * Math.pow((r1 + r2) / 2, 1.5);

function Belt({ inner, outer, count, color, size, thickness }: { inner: number; outer: number; count: number; color: string; size: number; thickness: number }) {
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    let s = 9;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      // Kirkwood-like clumping: denser in the middle of the belt.
      const au = inner + (outer - inner) * (0.5 + (rnd() - 0.5) * (0.6 + rnd() * 0.4));
      const a = rnd() * Math.PI * 2, d = auToScene(au);
      pos[i * 3] = Math.cos(a) * d;
      pos[i * 3 + 1] = (rnd() - 0.5) * thickness;
      pos[i * 3 + 2] = Math.sin(a) * d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [inner, outer, count, thickness]);
  useEffect(() => () => geo.dispose(), [geo]);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += Math.min(dt, 0.1) * 0.004;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={color} size={size} sizeAttenuation transparent opacity={0.8} depthWrite={false} />
    </points>
  );
}
function circle(r: number, incl = 0) {
  return Array.from({ length: 257 }, (_, i) => {
    const a = (i / 256) * Math.PI * 2;
    return [r * Math.cos(a), Math.sin(incl) * r * Math.sin(a), Math.cos(incl) * r * Math.sin(a)] as [number, number, number];
  });
}
function Label({ text, sub, y, color = "#d7e8eb" }: { text: string; sub?: string; y: number; color?: string }) {
  return (
    <Html position={[0, y, 0]} center style={{ pointerEvents: "none" }} zIndexRange={[5, 0]}>
      <div className="space-label-card" style={{ color }}>
        <b>{text}</b>
        {sub && <small>{sub}</small>}
      </div>
    </Html>
  );
}
const fmtKm = (m: number) => `${Math.round((m * 2) / 1000).toLocaleString("en-US")} km`;
/** Heliocentric transfer: Sun, all eight planets, asteroid & Kuiper belts, and the live Hohmann arc. */
function Heliocentric({ dest }: { dest: DestinationId }) {
  const settings = useGame((s) => s.settings);
  const { camera } = useThree();
  const ship = useRef<THREE.Group>(null), plume = useRef<THREE.Mesh>(null);
  const bodies = useRef<Partial<Record<HeliocentricBodyId, THREE.Group | null>>>({});
  const destAU = dest === "asteroid" ? 1.1 : SOLAR_DISTANCE_AU[dest];
  const destBody = (dest === "asteroid" ? null : dest) as HeliocentricBodyId | null;
  const tYears = transferYears(1, destAU);
  // Phase so the destination is exactly opposite the departure point at arrival.
  const destPhase0 = Math.PI - (2 * Math.PI * tYears) / periodYears(destAU);
  const path = useMemo(
    () => Array.from({ length: 160 }, (_, i) => {
      const p = hohmann(1, destAU, i / 159);
      const d = auToScene(p.r);
      return [d * Math.cos(p.angle), 0, d * Math.sin(p.angle)] as [number, number, number];
    }),
    [destAU],
  );
  const v = useMemo(() => new THREE.Vector3(), []), cam = useMemo(() => new THREE.Vector3(), []), look = useMemo(() => new THREE.Vector3(), []);
  const tmpBody = useMemo(() => new THREE.Vector3(), []), tmpOff = useMemo(() => new THREE.Vector3(), []), tmpDir = useMemo(() => new THREE.Vector3(), []);
  const bodyPos = (id: HeliocentricBodyId, f: number, out: THREE.Vector3) => {
    const au = orbitAU(id), years = f * tYears;
    let phase = heliocentricOrbits[id].phaseRad;
    if (id === "earth") phase = 0;
    if (id === destBody) phase = destPhase0;
    const ang = phase + (2 * Math.PI * years) / periodYears(au);
    const d = auToScene(au), inc = heliocentricOrbits[id].inclinationRad;
    return out.set(d * Math.cos(ang), Math.sin(inc) * d * Math.sin(ang), Math.cos(inc) * d * Math.sin(ang));
  };
  useEffect(() => {
    camera.position.set(4, 3, 9);
  }, [camera]);
  useFrame((_, dt) => {
    const data = engine.data, f = data.cruiseProgress;
    heliocentricBodyIds.forEach((id) => {
      const g = bodies.current[id];
      if (g) bodyPos(id, f, g.position);
    });
    const p = hohmann(1, destAU, f), d = auToScene(p.r);
    v.set(d * Math.cos(p.angle), 0, d * Math.sin(p.angle));
    // Parking orbits: around Earth at departure and around the target on arrival
    // the craft circles on an inclined orbit just above the globe (it keeps
    // moving while it waits for orbit insertion / landing clearance).
    const orbitAt = (id: HeliocentricBodyId, phase: number, out: THREE.Vector3) => {
      bodyPos(id, f, tmpBody);
      const r = BODY_R[id] + 0.17, a = data.stageTime * 0.55 + phase, inc = 0.45;
      return out.set(Math.cos(a) * r, Math.sin(a) * Math.sin(inc) * r, Math.sin(a) * Math.cos(inc) * r).add(tmpBody);
    };
    if (destBody && f > 0.88) {
      const k = THREE.MathUtils.smoothstep(f, 0.88, 0.995);
      v.lerp(orbitAt(destBody, 0, tmpDir), k);
    } else if (f < 0.06) {
      const k = 1 - THREE.MathUtils.smoothstep(f, 0.0, 0.06);
      v.lerp(orbitAt("earth", Math.PI / 2, tmpDir), k);
    }
    if (ship.current) {
      const prev = tmpOff.copy(ship.current.position);
      ship.current.position.copy(v);
      if (prev.distanceToSquared(v) > 1e-10) ship.current.lookAt(v.clone().add(v.clone().sub(prev)));
    }
    if (plume.current) plume.current.visible = data.correction && data.cruiseProgress < 0.025;
    const z = settings.flightZoom || 1;
    if (settings.flightCamera === "overview") {
      const sel = settings.selectedPlanet;
      if (sel !== "sun" && sel !== "moon") bodyPos(sel as HeliocentricBodyId, f, look);
      else look.set(0, 0, 0);
      return;
    }
    if (settings.flightCamera === "follow") cam.set(v.x + 0.9 * z, v.y + 0.45 * z, v.z + 1.4 * z);
    else {
      const a = data.stageTime * 0.05;
      cam.set(v.x + Math.sin(a) * 3.2 * z, v.y + 1.6 * z, v.z + Math.cos(a) * 3.2 * z);
    }
    rigCamera(cam, v);
    camera.position.lerp(cam, settings.reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 3));
    camera.lookAt(v);
  });
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <Stars radius={900} depth={300} count={6000} factor={6} saturation={0.12} fade speed={0} />
      <ambientLight intensity={0.03} />
      <pointLight position={[0, 0, 0]} intensity={260} decay={1.2} distance={0} color="#fff3e2" />
      <SunBody radius={SUN_R} />
      {settings.showLabels && <Label text="SUN" sub="1,392,700 km · 5,778 K" y={SUN_R + 1.3} color="#ffd890" />}
      <Belt inner={2.1} outer={3.3} count={2600} color="#9b8f80" size={0.035} thickness={0.25} />
      <Belt inner={30} outer={50} count={3500} color="#8fa3b8" size={0.09} thickness={2.2} />
      {settings.showLabels && (
        <group position={[auToScene(2.7), 0, 0]}>
          <Label text="ASTEROID BELT" sub="2.1–3.3 AU" y={0.4} color="#b9ad9b" />
        </group>
      )}
      {settings.showLabels && (
        <group position={[-auToScene(40), 0, 0]}>
          <Label text="KUIPER BELT" sub="30–50 AU" y={1.5} color="#a9bfd6" />
        </group>
      )}
      {heliocentricBodyIds.map((id) => {
        const b = solarSystem[id as SolarBodyId], r = BODY_R[id];
        return (
          <group key={id}>
            {settings.showOrbits && (
              <Line points={circle(auToScene(orbitAU(id)), heliocentricOrbits[id].inclinationRad)} color={id === "earth" ? "#4b9ab0" : id === destBody ? "#d9845d" : "#2a3d48"} lineWidth={id === "earth" || id === destBody ? 1.4 : 0.8} transparent opacity={0.75} />
            )}
            <group ref={(n) => { bodies.current[id] = n; }}>
              <Planet kind={id} radius={r} />
              {settings.showLabels && (
                <Label
                  text={`${b.name.toUpperCase()}${id === "earth" ? " · DEPARTURE" : id === destBody ? " · ARRIVAL" : ""}`}
                  sub={id === "earth" || id === destBody || ["jupiter", "saturn", "uranus", "neptune"].includes(id) ? `Ø ${fmtKm(b.radiusM)} · ${(orbitAU(id)).toFixed(2)} AU` : undefined}
                  y={r + 0.28}
                  color={id === destBody ? "#f0a47c" : id === "earth" ? "#9fd6e6" : "#c9d4d8"}
                />
              )}
            </group>
          </group>
        );
      })}
      {dest === "asteroid" && (
        <group position={[-auToScene(1.1), 0, 0]}>
          <Asteroid radius={0.06} />
          {settings.showLabels && <Label text="VY-26 · ARRIVAL" y={0.3} color="#b0c39e" />}
        </group>
      )}
      {settings.showTrajectory && <Line points={path} color="#8ed5df" lineWidth={1.6} dashed dashSize={0.18} gapSize={0.12} />}
      <group ref={ship} name="cruise-ship">
        {/* True-scale hierarchy: the spacecraft is a speck next to planets; a marker shows where it is. */}
        <group scale={0.012} rotation={[Math.PI / 2, 0, 0]}>
          <Spacecraft design={engine.data.design} solarDeployed stowed />
        </group>
        <mesh>
          <sphereGeometry args={[0.018, 10, 8]} />
          <meshBasicMaterial color="#ffb38a" />
        </mesh>
        <mesh ref={plume} position={[0, 0, -0.08]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <coneGeometry args={[0.02, 0.12, 12, 1, true]} />
          <meshBasicMaterial color="#9fdcff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {settings.showLabels && <Label text="VYDEX–01" sub="cruise" y={0.14} color="#ffcfb4" />}
      </group>
      {settings.flightCamera === "overview" && <OverviewControls look={look} />}
    </>
  );
}
function OverviewControls({ look }: { look: THREE.Vector3 }) {
  const ref = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 26, 34);
  }, [camera]);
  useFrame(() => {
    if (!ref.current) return;
    const delta = look.clone().sub(ref.current.target);
    if (delta.lengthSq() > 1e-6) {
      ref.current.target.add(delta.multiplyScalar(0.08));
      ref.current.update();
    }
  });
  return <OrbitControls ref={ref} minDistance={1.5} maxDistance={140} enablePan={false} />;
}
/** Earth–Moon space: Earth and Moon at true relative size and true separation (60 Earth radii). */
function Geocentric({ dest }: { dest: DestinationId }) {
  const settings = useGame((s) => s.settings);
  const { camera } = useThree();
  const ship = useRef<THREE.Group>(null), moon = useRef<THREE.Group>(null);
  const RE = 1, RM = 0.273, DIST = 60.3;
  const v = useMemo(() => new THREE.Vector3(), []), cam = useMemo(() => new THREE.Vector3(), []);
  const path = useMemo(() => Array.from({ length: 140 }, (_, i) => {
    const f = i / 139;
    if (dest === "earth") {
      const a = f * Math.PI * 2, r = RE * 1.063;
      return [r * Math.cos(a), 0, r * Math.sin(a)] as [number, number, number];
    }
    // Translunar ellipse: perigee at LEO, apogee at the Moon.
    const r1 = RE * 1.03, r2 = DIST, a = (r1 + r2) / 2, e = (r2 - r1) / (r2 + r1);
    const E = f * Math.PI, nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const r = a * (1 - e * Math.cos(E));
    return [r * Math.cos(nu), 0, r * Math.sin(nu)] as [number, number, number];
  }), [dest]);
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.far = 4000;
      camera.updateProjectionMatrix();
    }
    return () => {
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.far = 1200;
        camera.updateProjectionMatrix();
      }
    };
  }, [camera]);
  useFrame((_, dt) => {
    const f = engine.data.cruiseProgress, i = Math.min(path.length - 1, Math.floor(f * (path.length - 1)));
    const pt = path[i];
    v.set(pt[0], pt[1], pt[2]);
    // Arrival: settle into a low lunar orbit instead of entering the Moon.
    const moonC = new THREE.Vector3(-DIST, 0, 0), dm = v.distanceTo(moonC);
    if (dest === "moon" && dm < RM * 2.2) {
      const a = engine.data.stageTime * 0.8;
      v.copy(moonC).add(new THREE.Vector3(Math.cos(a), 0.2, Math.sin(a)).normalize().multiplyScalar(RM * 1.5));
    }
    ship.current?.position.copy(v);
    moon.current?.position.set(-DIST, 0, 0.0001);
    const z = settings.flightZoom || 1;
    if (settings.flightCamera === "overview") cam.set(-DIST / 2, 38 * z, 46 * z);
    else if (settings.flightCamera === "follow") cam.set(v.x + 0.35 * z, v.y + 0.18 * z, v.z + 0.6 * z);
    else cam.set(v.x + Math.sin(engine.data.stageTime * 0.05) * 1.6 * z, v.y + 0.7 * z, v.z + Math.cos(engine.data.stageTime * 0.05) * 1.6 * z);
    if (settings.flightCamera !== "overview") rigCamera(cam, v);
    camera.position.lerp(cam, 1 - Math.exp(-Math.min(dt, 0.1) * 3));
    camera.lookAt(settings.flightCamera === "overview" ? new THREE.Vector3(-DIST / 2, 0, 0) : v);
  });
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <Stars radius={1500} depth={500} count={6000} factor={10} saturation={0.12} fade speed={0} />
      <ambientLight intensity={0.03} />
      <directionalLight position={[300, 60, 200]} intensity={3.2} color="#fff6ea" />
      <group position={[1500, 300, 1000]}>
        <SunBody radius={9} />
      </group>
      <Planet kind="earth" radius={RE} />
      <group ref={moon}>
        <Planet kind="moon" radius={RM} />
        {settings.showLabels && <Label text="MOON" sub="384,400 km · 3,474 km Ø" y={RM + 0.4} />}
      </group>
      {settings.showLabels && <Label text="EARTH" sub="12,742 km Ø" y={RE + 0.4} color="#9fd6e6" />}
      {settings.showTrajectory && <Line points={path} color="#8ed5df" lineWidth={1.4} dashed dashSize={0.3} gapSize={0.2} />}
      <group ref={ship}>
        <group scale={0.003}>
          <Spacecraft design={engine.data.design} solarDeployed stowed />
        </group>
        <mesh>
          <sphereGeometry args={[0.006, 8, 6]} />
          <meshBasicMaterial color="#ffb38a" />
        </mesh>
        {settings.showLabels && <Label text="VYDEX–01" y={0.05} color="#ffcfb4" />}
      </group>
    </>
  );
}
export default function SolarTransfer() {
  const dest = useGame((s) => s.data.destination);
  return dest === "earth" || dest === "moon" ? <Geocentric dest={dest} /> : <Heliocentric dest={dest} />;
}
