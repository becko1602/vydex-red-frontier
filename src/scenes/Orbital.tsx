import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { engine } from "../sim/game";
import { useGame } from "../store";
import { rigCamera } from "../cameraRig";
import { Planet } from "./Planet";
import VehicleEffects from "./VehicleEffects";
import { Spacecraft, PartGeometry } from "./Spacecraft";
import { Asteroid } from "./Asteroid";
import { earthOrbit } from "../sim/orbit";
import { missionKind, type DestinationId } from "../data/destinations";
import { SunBody } from "./SunBody";
import { GltfModel } from "./GltfAssets";

/** Visual planet radius (scene units ≈ metres near the ship, planet compressed for depth precision). */
const RV = 6000;
/** Orbit altitude as a fraction of planet radius (real ratios: LEO 400 km / 6371 km ≈ 0.063). */
const ALT: Partial<Record<DestinationId, number>> = {
  earth: 0.063,
  venus: 0.05,
  jupiter: 0.09,
  saturn: 0.1,
  uranus: 0.12,
  neptune: 0.12,
};
const haze: Partial<Record<DestinationId, { top: string; deep: string; cloud: string }>> = {
  venus: { top: "#e9cf98", deep: "#8a5a2a", cloud: "#f3dfb0" },
  jupiter: { top: "#d9c3a2", deep: "#5a3a26", cloud: "#efe2c8" },
  saturn: { top: "#e6d6a8", deep: "#6b5733", cloud: "#f4ead0" },
  uranus: { top: "#a9dde0", deep: "#1f4d61", cloud: "#d4f1f2" },
  neptune: { top: "#6d93d8", deep: "#0f2350", cloud: "#bcd2f6" },
};
function DebrisStream() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const n = 140;
  const seeds = useMemo(() => Array.from({ length: n }, (_, i) => ({ y: (Math.sin(i * 12.9) * 0.5) * 30, z: (Math.cos(i * 7.3) * 0.5) * 30, s: 0.05 + ((i * 37) % 10) / 40, v: 40 + ((i * 13) % 20), p: i * 3.1 })), []);
  useFrame(({ clock }) => {
    const d = engine.data, m = ref.current;
    if (!m) return;
    m.visible = d.debrisActive > 0;
    if (!m.visible) return;
    const t = clock.getElapsedTime(), o = d.orbital;
    seeds.forEach((k, i) => {
      dummy.position.set(o.x + 60 - ((t * k.v + k.p * 10) % 120), o.y + k.y, o.z + k.z);
      dummy.rotation.set(t * 3 + i, t * 2, i);
      dummy.scale.setScalar(k.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false} visible={false}>
      <tetrahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#9c9a94" metalness={0.6} roughness={0.5} />
    </instancedMesh>
  );
}
/** In-atmosphere descent: probe under its main parachute falling through cloud decks. */
function ProbeDescent({ dest }: { dest: DestinationId }) {
  const c = haze[dest] ?? haze.jupiter!;
  const probe = useRef<THREE.Group>(null), clouds = useRef<THREE.Group>(null), chute = useRef<THREE.Group>(null), shield = useRef<THREE.Group>(null), flash = useRef<THREE.PointLight>(null);
  const { scene } = useThree();
  const layers = useMemo(() => Array.from({ length: 9 }, (_, i) => ({ y: -i * 60, rot: i * 0.7, s: 1 + (i % 3) * 0.3 })), []);
  const cloudTex = useMemo(() => {
    const el = document.createElement("canvas");
    el.width = el.height = 256;
    const g = el.getContext("2d")!;
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 50;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.55)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(el);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
  }, []);
  useEffect(() => () => cloudTex.dispose(), [cloudTex]);
  useFrame(({ clock, camera }, dt) => {
    const p = engine.data.probe, t = clock.getElapsedTime();
    const deep = p.phase === "descent" ? p.progress : 0;
    if (clouds.current) {
      clouds.current.children.forEach((l, i) => {
        l.position.y += Math.min(dt, 0.1) * (p.phase === "parachute" ? 40 : 22);
        if (l.position.y > 120) l.position.y -= 540;
        l.rotation.z = layers[i].rot + t * 0.01;
      });
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(c.top).lerp(new THREE.Color(c.deep), deep);
      scene.fog.near = 20;
      scene.fog.far = 420 - deep * 300;
    }
    if (scene.background instanceof THREE.Color) scene.background.set(c.top).lerp(new THREE.Color(c.deep), deep);
    if (probe.current) {
      probe.current.position.set(Math.sin(t * 0.7) * 0.4, Math.sin(t * 1.3) * 0.2, 0);
      probe.current.rotation.set(Math.sin(t * 0.9) * 0.08, t * 0.4, Math.cos(t * 0.8) * 0.08);
    }
    if (chute.current) chute.current.scale.setScalar(p.phase === "parachute" ? Math.min(1, p.t / 3) : 1);
    if (shield.current) {
      shield.current.visible = p.phase === "parachute";
      shield.current.position.y = -2 - p.t * 6;
    }
    if (flash.current) flash.current.intensity = dest === "jupiter" && Math.sin(t * 0.9) > 0.995 ? 4000 : 0;
    camera.position.lerp(new THREE.Vector3(7, -1.5, 9), 0.05);
    camera.lookAt(0, 1.5, 0);
  });
  return (
    <>
      <fog attach="fog" args={[c.top, 20, 420]} />
      <ambientLight intensity={0.45} color={c.cloud} />
      <directionalLight position={[-30, 60, 20]} intensity={1.6} color="#fff3e2" />
      <pointLight ref={flash} position={[-80, -120, -60]} distance={600} color="#cfe3ff" intensity={0} />
      <group ref={clouds}>
        {layers.map((l, i) => (
          <mesh key={i} position={[0, l.y, 0]} rotation={[-Math.PI / 2, 0, l.rot]}>
            <planeGeometry args={[900 * l.s, 900 * l.s]} />
            <meshStandardMaterial map={cloudTex} color={c.cloud} transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <group ref={probe}>
        {/* Descent module (aft cover gone) */}
        <group scale={1.6}>
          <PartGeometry id="probe" design={engine.data.design} />
        </group>
        {/* Main parachute: 2.5 m conical ribbon chute, risers to the probe */}
        <group ref={chute} position={[0, 7.2, 0]}>
          <mesh>
            <sphereGeometry args={[2.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
            <meshStandardMaterial color="#f1f0ea" side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} rotation={[0, (i / 12) * Math.PI * 2, 0]} position={[0, 0.3, 0]}>
              <boxGeometry args={[0.05, 1.4, 5.2]} />
              <meshStandardMaterial color={i % 2 ? "#e2662c" : "#f1f0ea"} transparent opacity={0.0} />
            </mesh>
          ))}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const top = new THREE.Vector3(Math.cos(a) * 2.2, 1.2, Math.sin(a) * 2.2);
            const bottom = new THREE.Vector3(0, -6.2, 0);
            const mid = top.clone().add(bottom).multiplyScalar(0.5);
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bottom).normalize());
            return (
              <mesh key={`r${i}`} position={mid} quaternion={q}>
                <cylinderGeometry args={[0.01, 0.01, top.distanceTo(bottom), 4]} />
                <meshBasicMaterial color="#d8d6cf" />
              </mesh>
            );
          })}
        </group>
        <group ref={shield}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[1.05, 0.65, 40, 1]} />
            <meshStandardMaterial color="#2c1f17" roughness={0.95} />
          </mesh>
        </group>
      </group>
    </>
  );
}
export default function Orbital() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings),
    ship = useRef<THREE.Group>(null),
    planet = useRef<THREE.Group>(null),
    probeBody = useRef<THREE.Group>(null),
    plasma = useRef<THREE.Mesh>(null),
    { camera } = useThree(),
    cam = useMemo(() => new THREE.Vector3(), []),
    look = useMemo(() => new THREE.Vector3(), []);
  const asteroid = d.destination === "asteroid";
  const probeMission = missionKind(d.destination) === "probe";
  const probePhase = useGame((s) => s.data.probe.phase);
  const earthSat = d.destination === "earth" && d.orbital.deployed;
  const inAtmosphere = probeMission && (probePhase === "parachute" || probePhase === "descent");
  const alt = (ALT[d.destination] ?? 0.063) * RV;
  const planetKind = (asteroid ? "earth" : d.destination) as "earth";
  useEffect(() => {
    camera.position.set(10, 5, 16);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.far = 90000;
      camera.fov = 50;
      camera.updateProjectionMatrix();
    }
    return () => {
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.far = 1200;
        camera.updateProjectionMatrix();
      }
    };
  }, [camera, asteroid]);
  useFrame((_, dt) => {
    const data = engine.data, o = data.orbital, z = settings.flightZoom || 1;
    if (inAtmosphere) return;
    if (ship.current) {
      ship.current.position.set(o.x, o.y, o.z);
      ship.current.rotation.set(o.pitch, o.yaw, o.roll, "YXZ");
    }
    // Probe coast & entry: it separates, then falls toward the planet limb.
    const p = data.probe;
    if (probeBody.current) {
      const flying = p.phase === "coast" || p.phase === "entry";
      probeBody.current.visible = flying;
      if (flying) {
        const k = p.phase === "coast" ? p.t / 9 : 1 + p.t / 11;
        probeBody.current.position.set(o.x + 2 + k * 10, o.y - 1.5 - k * k * (p.phase === "entry" ? 60 : 12), o.z - 4 - k * 30);
        probeBody.current.rotation.set(0.4, data.elapsed * 1.05, 0);
      }
      if (plasma.current) {
        plasma.current.visible = p.phase === "entry";
        plasma.current.scale.set(1, 1 + Math.sin(data.elapsed * 40) * 0.08, 1);
      }
    }
    if (planet.current && !asteroid)
      planet.current.rotation.y = -data.stageTime * 30 * ((2 * Math.PI) / earthOrbit().period) * 0.2;
    if (settings.flightCamera === "overview" && !asteroid) return; // OrbitControls owns the camera
    // Chase camera: behind and slightly above the vehicle, in its yaw frame.
    const target = p.phase === "entry" && probeBody.current ? probeBody.current.position : look.set(o.x, o.y, o.z);
    if (settings.flightCamera === "overview") {
      if (asteroid) cam.set(30 * z, 22 * z, 52 * z);
      else cam.set(o.x + 30 * z, o.y + 14 * z, o.z + 36 * z);
    } else if (settings.flightCamera === "follow") {
      const D = (p.phase === "entry" ? 10 : 15) * z, H = 4.2 * z;
      cam.set(target.x + Math.sin(o.yaw) * D, target.y + H + Math.sin(-o.pitch) * D * 0.3, target.z + Math.cos(o.yaw) * D);
    } else {
      const a = data.stageTime * 0.06;
      cam.set(target.x + Math.sin(a) * 16 * z, target.y + 5 * z, target.z + Math.cos(a) * 16 * z);
    }
    if (settings.flightCamera !== "overview") rigCamera(cam, target);
    camera.position.lerp(cam, settings.reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 4));
    camera.lookAt(settings.flightCamera === "overview" && asteroid ? new THREE.Vector3(0, 0, 10) : target);
  });
  if (inAtmosphere) return <ProbeDescent dest={d.destination} />;
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <Stars radius={20000} depth={8000} count={4000} factor={260} saturation={0.15} fade speed={0} />
      <ambientLight intensity={0.035} />
      <directionalLight position={[-25, 12, 30]} intensity={1.9} color="#fff6ea" />
      <group position={[-30000, 12000, 36000]}>
        <SunBody radius={asteroid || d.destination === "earth" ? 350 : 350 / Math.max(1, (({ jupiter: 5.2, saturn: 9.5, uranus: 19.2, neptune: 30 } as Record<string, number>)[d.destination] ?? 1) * 0.6)} />
      </group>
      {asteroid ? (
        <>
          <Asteroid radius={8} />
          <group position={[-2800, 1800, -8000]}>
            <Planet kind="earth" radius={4} />
          </group>
          <mesh position={[0, 0, 14]}>
            <ringGeometry args={[4.8, 5, 64]} />
            <meshBasicMaterial color="#8edacb" transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
          <Line points={[[0, 0, 10], [0, 0, 24]]} color="#78bbce" dashed dashSize={0.4} gapSize={0.4} />
        </>
      ) : (
        <group ref={planet} position={[0, -RV - alt, -RV * 0.25]}>
          <Planet kind={planetKind} radius={RV} spin={false} />
        </group>
      )}
      <group ref={ship}>
        {/* Asteroid approach: stack axis along the flight line, so the cruise engine
            exhausts toward +Z and its thrust drives the craft toward the target. */}
        <group rotation={asteroid ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
        {earthSat ? (
          // Deployed Earth satellite: imported NASA CALIPSO model.
          <GltfModel id="calipso" />
        ) : probeMission ? (
          // Outer-planet / Venus orbiter: imported NASA ACE model, entry probe mounted until release.
          <>
            <VehicleEffects />
            <GltfModel id="ace" />
            {d.probe.phase === "attached" && (
              <group position={[0, 1.6, 0]}>
                <PartGeometry id="probe" design={d.design} />
              </group>
            )}
          </>
        ) : (
          <>
            <VehicleEffects />
        <Spacecraft
          design={probeMission && d.probe.phase !== "attached" ? { ...d.design, parts: { ...d.design.parts, probe: false } } : d.design}
          separated={(!asteroid && d.orbital.deployed) || probeMission}
          solarDeployed={asteroid || probeMission || d.orbital.deployed}
        />
          </>
        )}
        </group>
      </group>
      <group ref={probeBody} visible={false}>
        <PartGeometry id="probe" design={d.design} />
        <mesh ref={plasma} position={[0, -0.9, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
          <coneGeometry args={[1.2, 3.4, 32, 1, true]} />
          <meshBasicMaterial color="#ffb070" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <pointLight color="#ffae66" intensity={probePhase === "entry" ? 40 : 0} distance={30} />
      </group>
      <DebrisStream />
      {settings.flightCamera === "overview" && !asteroid && (
        <OrbitControls target={[d.orbital.x, d.orbital.y, d.orbital.z]} enablePan={false} minDistance={6} maxDistance={400} />
      )}
    </>
  );
}
