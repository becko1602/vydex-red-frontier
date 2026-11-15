import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { launchers, type LauncherId } from '../data/launchVehicles';
import * as THREE from 'three';
import { bellProfile } from './hardwareTextures';
export const ROCKET_VISUAL_SCALE = 0.25;
/** Booster placement angles around the core (radians). */
export const boosterAngles = (n: number) => n === 2 ? [0, Math.PI] : n === 4 ? [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75] : [];
export function rocketLayout(id: LauncherId) {
  const r = launchers[id], nose = r.fairingDiameter * 0.85, body = r.height - nose - r.fairingHeight;
  return { nose, body, joint: body * (id === 'titan' ? 0.84 : 0.74), payloadY: (body + r.fairingHeight / 2) * ROCKET_VISUAL_SCALE, height: r.height * ROCKET_VISUAL_SCALE };
}

/** Tangent-ogive profile from the fairing shoulder (radius R at y=0) to the tip at y=L, on top of a cylinder of height h. */
function fairingProfile(R: number, h: number, L: number) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(R * 0.97, -0.05), new THREE.Vector2(R, 0), new THREE.Vector2(R, h)];
  const rho = (R * R + L * L) / (2 * R);
  for (let i = 1; i <= 24; i++) {
    const x = (i / 24) * L;
    const y = Math.sqrt(rho * rho - x * x) + R - rho;
    pts.push(new THREE.Vector2(Math.max(0.0001, y), h + x));
  }
  return pts;
}
function ogive(R: number, L: number) {
  return fairingProfile(R, 0, L).slice(1);
}
/** Procedural stage skin: panel seams, stringers and a cork/foam tint band. */
function skinTexture(base: string, accent: string) {
  const el = document.createElement('canvas');
  el.width = 512; el.height = 1024;
  const g = el.getContext('2d')!;
  g.fillStyle = base; g.fillRect(0, 0, 512, 1024);
  for (let x = 0; x < 512; x += 16) { g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(x, 0, 2, 1024); }
  for (let y = 0; y < 1024; y += 128) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y, 512, 3); }
  g.fillStyle = accent; g.fillRect(0, 0, 512, 24);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 40; y < 1024; y += 128) for (let x = 6; x < 512; x += 64) g.fillRect(x, y, 3, 3);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
/** SRB casing: white with black roll-pattern blocks near the forward and aft ends, segment joints. */
function boosterTexture() {
  const el = document.createElement('canvas');
  el.width = 512; el.height = 1024;
  const g = el.getContext('2d')!;
  g.fillStyle = '#efefea'; g.fillRect(0, 0, 512, 1024);
  for (let y = 0; y < 1024; y += 170) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y, 512, 4); }
  g.fillStyle = '#16181a';
  for (const y0 of [60, 900]) for (let k = 0; k < 4; k++) g.fillRect(k * 128 + (y0 > 500 ? 64 : 0), y0, 64, 40);
  for (let k = 0; k < 3000; k++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'; g.fillRect(Math.random() * 512, Math.random() * 1024, 2, 3); }
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
/** Sprayed-on foam insulation: orange-brown with vertical mottling and darker stringer streaks. */
function foamTexture(base: string) {
  const el = document.createElement('canvas');
  el.width = 512; el.height = 1024;
  const g = el.getContext('2d')!;
  g.fillStyle = base; g.fillRect(0, 0, 512, 1024);
  for (let k = 0; k < 9000; k++) { const v = Math.random(); g.fillStyle = v > 0.5 ? `rgba(255,190,120,${0.05 + v * 0.05})` : `rgba(90,40,10,${0.05 + v * 0.06})`; g.fillRect(Math.random() * 512, Math.random() * 1024, 3 + Math.random() * 5, 2 + Math.random() * 4); }
  for (let x = 0; x < 512; x += 32) { g.fillStyle = 'rgba(80,35,10,0.12)'; g.fillRect(x, 0, 3, 1024); }
  for (let y = 0; y < 1024; y += 256) { g.fillStyle = 'rgba(60,25,8,0.25)'; g.fillRect(0, y, 512, 5); }
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function Lathe({ points, segments = 48, phiStart = 0, phiLength = Math.PI * 2, children }: { points: THREE.Vector2[]; segments?: number; phiStart?: number; phiLength?: number; children: React.ReactNode }) {
  const geo = useMemo(() => new THREE.LatheGeometry(points, segments, phiStart, phiLength), [points, segments, phiStart, phiLength]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} castShadow receiveShadow>{children}</mesh>;
}
function Engine({ scale = 1, active = true }: { scale?: number; active?: boolean }) {
  const pts = useMemo(() => bellProfile(0.18, 0.5, 1.15), []);
  if (!active) return null;
  return (
    <group scale={scale}>
      {/* Turbopump + gimbal block above the bell */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.2, 0.26, 0.4, 16]} />
        <meshStandardMaterial color="#7e8486" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0.24, 0.45, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.36, 12]} />
        <meshStandardMaterial color="#b88a4a" metalness={0.85} roughness={0.3} />
      </mesh>
      <Lathe points={pts} segments={40}>
        <meshStandardMaterial color="#3b3633" metalness={0.85} roughness={0.32} side={THREE.DoubleSide} />
      </Lathe>
    </group>
  );
}
// One model for cards, hangar and flight. All geometry in fictional design metres, then display scale 1:4.
/**
 * World-space fall of jettisoned hardware, in metres-of-scene (world units).
 * The launch scene writes these each frame: once a part separates it stops
 * following the climbing vehicle and falls back under gravity.
 */
export type JettisonDrop = { booster: number; core: number };
export function LaunchVehicle({ firing = false, fairingOpen = 0, separation = 0, upperSeparation = 0, id = 'titan', throttle = 1, drop }: { drop?: JettisonDrop;  firing?: boolean; fairingOpen?: number; separation?: number; upperSeparation?: number; id?: LauncherId; throttle?: number }) {
  void firing; void throttle;
  const r = launchers[id], { nose, body } = rocketLayout(id), radius = r.diameter / 2, bay = r.fairingDiameter / 2, joint = rocketLayout(id).joint;
  const coreRef = useRef<THREE.Group>(null), boosterRefs = useRef<Record<number, THREE.Group | null>>({});
  useFrame(() => {
    if (!drop) return;
    // Local offsets are in design metres (group is scaled by ROCKET_VISUAL_SCALE).
    // Trail behind (y), drift sideways and tumble as the gap grows.
    if (coreRef.current) {
      coreRef.current.position.y = -upperSeparation * 6 - drop.core / ROCKET_VISUAL_SCALE;
      coreRef.current.position.x = Math.min(40, drop.core * 0.25) / ROCKET_VISUAL_SCALE;
      coreRef.current.rotation.z = upperSeparation * 0.17 + drop.core * 0.012;
    }
    for (const g of Object.values(boosterRefs.current)) if (g) {
      g.position.y = -separation * 4 - drop.booster / ROCKET_VISUAL_SCALE;
      g.rotation.z = -separation * 0.25 - drop.booster * 0.02;
    }
  });
  const skin = useMemo(() => (id === 'titan' ? foamTexture(r.coreColor) : skinTexture(r.coreColor, '#2b2f33')), [id, r.coreColor]);
  const upperSkin = useMemo(() => skinTexture(r.upperColor, '#2b2f33'), [r.upperColor]);
  const boosterSkin = useMemo(() => boosterTexture(), []);
  useEffect(() => () => { skin.dispose(); upperSkin.dispose(); boosterSkin.dispose(); }, [skin, upperSkin, boosterSkin]);
  const fairing = useMemo(() => fairingProfile(bay, r.fairingHeight, nose), [bay, r.fairingHeight, nose]);
    const aftSkirt = useMemo(() => [new THREE.Vector2(radius * 1.08, 0), new THREE.Vector2(radius * 1.0, radius * 0.5)], [radius]);
  const adapter = useMemo(() => [new THREE.Vector2(radius, 0), new THREE.Vector2(bay, Math.max(0.6, (bay - radius) * 1.2))], [radius, bay]);
  const coreEngines = r.engines === 2 ? [[-radius * 0.28, 0], [radius * 0.28, 0]] : [0, 1, 2, 3].map((i) => [Math.cos(i * Math.PI / 2 + Math.PI / 4) * radius * 0.5, Math.sin(i * Math.PI / 2 + Math.PI / 4) * radius * 0.5]);
  const engineScale = r.engines === 2 ? radius * 0.62 : radius * 0.42;
  const bLen = Math.max(4, r.boosterLength);
  const white = (map: THREE.Texture, repeat = 1) => <meshStandardMaterial map={map} color="#ffffff" metalness={0.15} roughness={0.55} map-repeat={[repeat, 1]} />;
  return <group scale={ROCKET_VISUAL_SCALE}>
    {/* First stage (core): falls away at staging */}
    <group ref={coreRef} position={[0, -upperSeparation * 6, 0]} rotation={[0, 0, upperSeparation * .17]}>
      <mesh position={[0, joint / 2 + radius * 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, joint - radius * 0.5, 48]} />
        {white(skin, 3)}
      </mesh>
      <Lathe points={aftSkirt}><meshStandardMaterial color="#2a2e31" metalness={0.5} roughness={0.55} side={THREE.DoubleSide} /></Lathe>
      {/* Black interstage at the top of the core */}
      <mesh position={[0, joint - 0.4, 0]}>
        <cylinderGeometry args={[radius * 1.005, radius * 1.005, 0.8, 48]} />
        <meshStandardMaterial color="#1f2326" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Cable raceway and LOX feed line */}
      <mesh position={[radius * 1.02, joint / 2, 0]}>
        <boxGeometry args={[0.12, joint * 0.92, 0.28]} />
        <meshStandardMaterial color="#d9dad5" roughness={0.6} />
      </mesh>
      <mesh position={[-radius * 1.03, joint * 0.42, 0]}>
        <cylinderGeometry args={[0.1, 0.1, joint * 0.7, 10]} />
        <meshStandardMaterial color="#c9cbc6" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Grid-stiffener rings */}
      {[0.12, 0.36, 0.58].map((f) => (
        <mesh key={f} position={[0, joint * f, 0]}>
          <cylinderGeometry args={[radius * 1.008, radius * 1.008, 0.08, 48]} />
          <meshStandardMaterial color="#b9bcb8" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* Fins / aero strakes on small vehicles only */}
      {coreEngines.map(([x, z], i) => <group key={i} position={[x, -0.05, z]}><Engine scale={engineScale} active={upperSeparation < 0.05} /></group>)}
    </group>
    {/* Upper stage */}
    <mesh position={[0, (joint + body) / 2, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 0.96, radius, body - joint, 48]} />
      {white(upperSkin, 3)}
    </mesh>
    {upperSeparation > .1 && <group position={[0, joint - 0.1, 0]}><Engine scale={radius * 0.7} /></group>}
    {/* Payload adapter cone up to the fairing diameter */}
    <group position={[0, body - 0.8, 0]}>
      <Lathe points={adapter}><meshStandardMaterial color="#c6c8c3" metalness={0.5} roughness={0.45} side={THREE.DoubleSide} /></Lathe>
    </group>
    {/* SLS: Orion crew module + service module fairing, topped by the launch abort tower. */}
    {id === 'titan' && fairingOpen < 0.05 && (
      <group position={[0, body, 0]}>
        <mesh position={[0, r.fairingHeight * 0.32, 0]} castShadow>
          <cylinderGeometry args={[bay * 0.92, bay, r.fairingHeight * 0.64, 48]} />
          <meshStandardMaterial map={upperSkin} color="#ffffff" roughness={0.5} />
        </mesh>
        <group position={[0, r.fairingHeight * 0.64, 0]}>
          <Lathe points={[new THREE.Vector2(bay * 0.92, 0), new THREE.Vector2(bay * 0.36, r.fairingHeight * 0.42), new THREE.Vector2(bay * 0.2, r.fairingHeight * 0.48)]} segments={48}>
            <meshStandardMaterial color="#f2f2ee" roughness={0.45} />
          </Lathe>
          {/* Abort motor tower */}
          <mesh position={[0, r.fairingHeight * 0.48 + nose * 0.45, 0]} castShadow>
            <cylinderGeometry args={[bay * 0.13, bay * 0.2, nose * 0.9, 24]} />
            <meshStandardMaterial color="#efefea" roughness={0.5} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.cos(k * Math.PI / 2) * bay * 0.2, r.fairingHeight * 0.48 + nose * 0.18, Math.sin(k * Math.PI / 2) * bay * 0.2]} rotation={[Math.sin(k * Math.PI / 2) * 0.6, 0, -Math.cos(k * Math.PI / 2) * 0.6]}>
              <cylinderGeometry args={[bay * 0.05, bay * 0.07, nose * 0.12, 12]} />
              <meshStandardMaterial color="#2a2c2e" metalness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, r.fairingHeight * 0.48 + nose * 0.95, 0]}>
            <coneGeometry args={[bay * 0.13, nose * 0.18, 24]} />
            <meshStandardMaterial color="#d8d8d2" roughness={0.5} />
          </mesh>
        </group>
      </group>
    )}
    {/* Two-piece ogive payload fairing; halves hinge away at jettison */}
    {(id !== 'titan' || fairingOpen >= 0.05) && [0, 1].map((i) => (
      <group key={i} position={[(i ? 1 : -1) * fairingOpen * 9, body, 0]} rotation={[0, 0, (i ? -1 : 1) * fairingOpen * .65]}>
        <Lathe points={fairing} segments={32} phiStart={i * Math.PI + Math.PI / 2} phiLength={Math.PI}>
          <meshStandardMaterial color="#f1f1ec" metalness={0.12} roughness={0.5} side={THREE.DoubleSide} />
        </Lathe>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[bay * 1.01, bay * 1.01, 0.12, 32, 1, true, i * Math.PI + Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color="#25292c" side={THREE.DoubleSide} />
        </mesh>
      </group>
    ))}
    {/* Strap-on solid boosters: white segmented casings, ogive noses, aft skirts, attach struts */}
    {boosterAngles(r.boosters).map((a) => {
      const br = radius * (r.boosters === 4 ? 0.42 : 0.44), dist = radius + br * 1.08;
      return (
        <group key={a} rotation={[0, -a, 0]}>
          <group ref={(n) => { boosterRefs.current[a] = n; }} position={[dist + separation * 10, -separation * 4, 0]} rotation={[0, 0, -separation * .25]}>
            <mesh position={[0, bLen / 2 + 0.3, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[br, br, bLen - 0.6, 32]} />
              <meshStandardMaterial map={boosterSkin} color="#ffffff" roughness={0.55} metalness={0.1} />
            </mesh>
            {Array.from({ length: Math.max(2, Math.round(bLen / 10)) }, (_, k) => (
              <mesh key={k} position={[0, (bLen * (k + 1)) / (Math.max(2, Math.round(bLen / 10)) + 1), 0]}>
                <cylinderGeometry args={[br * 1.02, br * 1.02, 0.35, 32]} />
                <meshStandardMaterial color="#25292c" roughness={0.6} />
              </mesh>
            ))}
            <group position={[0, bLen, 0]}>
              <Lathe points={ogive(br, br * 3)} segments={32}><meshStandardMaterial color="#f1f1ec" roughness={0.5} /></Lathe>
            </group>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[br, br * 1.25, 0.9, 32, 1, true]} />
              <meshStandardMaterial color="#2a2e31" metalness={0.5} roughness={0.55} side={THREE.DoubleSide} />
            </mesh>
            <group position={[0, -0.1, 0]}><Engine scale={br * 1.2} active={separation < .05} /></group>
            {[bLen * 0.1, bLen * 0.85].map((y) => (
              <mesh key={y} position={[-br * 1.04, y, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.1, 0.1, br * 0.25, 8]} />
                <meshStandardMaterial color="#8d908c" metalness={0.7} roughness={0.4} />
              </mesh>
            ))}
          </group>
        </group>
      );
    })}
  </group>;
}
