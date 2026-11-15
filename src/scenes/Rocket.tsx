import { useEffect, useMemo } from 'react';
import { launchers, type LauncherId } from '../data/launchVehicles';
import * as THREE from 'three';
import { bellProfile } from './hardwareTextures';
export const ROCKET_VISUAL_SCALE = 0.25;
export function rocketLayout(id: LauncherId) {
  const r = launchers[id], nose = r.fairingDiameter * 0.85, body = r.height - nose - r.fairingHeight;
  return { nose, body, payloadY: (body + r.fairingHeight / 2) * ROCKET_VISUAL_SCALE, height: r.height * ROCKET_VISUAL_SCALE };
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
export function LaunchVehicle({ firing = false, fairingOpen = 0, separation = 0, upperSeparation = 0, id = 'titan', throttle = 1 }: { firing?: boolean; fairingOpen?: number; separation?: number; upperSeparation?: number; id?: LauncherId; throttle?: number }) {
  void firing; void throttle;
  const r = launchers[id], { nose, body } = rocketLayout(id), radius = r.diameter / 2, bay = r.fairingDiameter / 2, joint = body * 0.64;
  const skin = useMemo(() => skinTexture(id === 'pioneer' ? '#ece6d4' : '#eceee9', r.color), [id, r.color]);
  const upperSkin = useMemo(() => skinTexture('#e9ebe6', '#2b2f33'), []);
  useEffect(() => () => { skin.dispose(); upperSkin.dispose(); }, [skin, upperSkin]);
  const fairing = useMemo(() => fairingProfile(bay, r.fairingHeight, nose), [bay, r.fairingHeight, nose]);
  const boosterNose = useMemo(() => ogive(radius * 0.42, radius * 1.4), [radius]);
  const aftSkirt = useMemo(() => [new THREE.Vector2(radius * 1.08, 0), new THREE.Vector2(radius * 1.0, radius * 0.5)], [radius]);
  const adapter = useMemo(() => [new THREE.Vector2(radius, 0), new THREE.Vector2(bay, Math.max(0.6, (bay - radius) * 1.2))], [radius, bay]);
  const coreEngines = id === 'scout' ? [[0, 0]] : [0, 1, 2, 3].map((i) => [Math.cos(i * Math.PI / 2 + Math.PI / 4) * radius * 0.5, Math.sin(i * Math.PI / 2 + Math.PI / 4) * radius * 0.5]);
  const engineScale = id === 'scout' ? radius * 1.2 : radius * 0.62;
  const white = (map: THREE.Texture, repeat = 1) => <meshStandardMaterial map={map} color="#ffffff" metalness={0.15} roughness={0.55} map-repeat={[repeat, 1]} />;
  return <group scale={ROCKET_VISUAL_SCALE}>
    {/* First stage (core): falls away at staging */}
    <group position={[0, -upperSeparation * 45, 0]} rotation={[0, 0, upperSeparation * .17]}>
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
      {id === 'scout' && [0, 1, 2, 3].map((i) => <group key={i} rotation={[0, i * Math.PI / 2, 0]}><mesh position={[radius * 1.25, 1.1, 0]}><boxGeometry args={[radius * 0.55, 2.2, 0.08]} /><meshStandardMaterial color="#2b2f33" metalness={0.4} roughness={0.5} /></mesh></group>)}
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
    {/* Two-piece ogive payload fairing; halves hinge away at jettison */}
    {[0, 1].map((i) => (
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
    {/* Strap-on solid boosters with ogive noses, aft skirts and attach struts */}
    {r.boosters > 0 && [-1, 1].map((side) => (
      <group key={side} position={[side * (radius * 1.65 + separation * 18), -separation * 35, 0]} rotation={[0, 0, -side * separation * .25]}>
        <mesh position={[0, joint * 0.43 + 0.3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[radius * .42, radius * .42, joint * .86 - 0.6, 32]} />
          {white(skin, 1)}
        </mesh>
        {[0.25, 0.5, 0.75].map((f) => (
          <mesh key={f} position={[0, joint * 0.86 * f, 0]}>
            <cylinderGeometry args={[radius * .43, radius * .43, 0.18, 32]} />
            <meshStandardMaterial color="#9ea19c" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        <group position={[0, joint * .86, 0]}>
          <Lathe points={boosterNose} segments={32}><meshStandardMaterial color="#eceee9" roughness={0.5} /></Lathe>
        </group>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[radius * .42, radius * .55, 0.9, 32, 1, true]} />
          <meshStandardMaterial color="#2a2e31" metalness={0.5} roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
        <group position={[0, -0.1, 0]}><Engine scale={radius * 0.5} active={separation < .05} /></group>
        {[joint * 0.15, joint * 0.8].map((y) => (
          <mesh key={y} position={[-side * radius * 0.62, y, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, radius * 0.5, 8]} />
            <meshStandardMaterial color="#8d908c" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
      </group>
    ))}
  </group>;
}
