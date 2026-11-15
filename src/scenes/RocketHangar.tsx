import { useEffect, useMemo, useRef } from 'react';
import { OrbitControls, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../store';
import { LaunchVehicle, rocketLayout, ROCKET_VISUAL_SCALE } from './Rocket';
import { launchers, launcherPerformance, type LauncherId } from '../data/launchVehicles';

/** Engineering drawing of the selected rocket, rendered to a canvas texture. */
function blueprintTexture(id: LauncherId) {
  const r = launchers[id], perf = launcherPerformance(id), { nose, body } = rocketLayout(id);
  const W = 2048, H = 1152, el = document.createElement('canvas');
  el.width = W; el.height = H;
  const g = el.getContext('2d')!;
  g.fillStyle = '#0b3360';
  g.fillRect(0, 0, W, H);
  // Drafting grid.
  for (let x = 0; x < W; x += 32) { g.strokeStyle = x % 160 === 0 ? 'rgba(170,210,255,0.22)' : 'rgba(170,210,255,0.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 32) { g.strokeStyle = y % 160 === 0 ? 'rgba(170,210,255,0.22)' : 'rgba(170,210,255,0.08)'; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeStyle = '#e8f3ff'; g.fillStyle = '#e8f3ff'; g.lineWidth = 3;
  g.strokeRect(24, 24, W - 48, H - 48);
  // Side elevation, scaled so the full height fits.
  const total = r.height, px = (H - 220) / total, cx = 380, base = H - 110;
  const rad = (r.diameter / 2) * px, bay = (r.fairingDiameter / 2) * px;
  const yBody = base - body * px, yFair = yBody - r.fairingHeight * px, yNose = yFair - nose * px;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx - rad, base); g.lineTo(cx - rad, yBody); g.lineTo(cx - bay, yBody - 10); g.lineTo(cx - bay, yFair);
  g.quadraticCurveTo(cx - bay, yNose + 20, cx, yNose); g.quadraticCurveTo(cx + bay, yNose + 20, cx + bay, yFair);
  g.lineTo(cx + bay, yBody - 10); g.lineTo(cx + rad, yBody); g.lineTo(cx + rad, base); g.closePath(); g.stroke();
  // Stage joints and tanks (dashed internal lines).
  g.setLineDash([10, 8]); g.lineWidth = 1.5;
  const joint = base - body * 0.64 * px;
  for (const y of [joint, base - body * 0.3 * px, base - body * 0.85 * px]) { g.beginPath(); g.moveTo(cx - rad, y); g.lineTo(cx + rad, y); g.stroke(); }
  g.beginPath(); g.ellipse(cx, base - body * 0.18 * px, rad * 0.8, body * 0.1 * px, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(cx, base - body * 0.47 * px, rad * 0.8, body * 0.14 * px, 0, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  // Engines.
  for (const k of r.id === 'scout' ? [0] : [-0.5, 0.5]) { g.beginPath(); g.moveTo(cx + k * rad - 10, base); g.lineTo(cx + k * rad - 22, base + 34); g.lineTo(cx + k * rad + 22, base + 34); g.lineTo(cx + k * rad + 10, base); g.stroke(); }
  // Boosters.
  if (r.boosters) for (const s of [-1, 1]) {
    const bx = cx + s * (rad * 1.65), br = rad * 0.42, top = base - body * 0.64 * 0.86 * px;
    g.beginPath(); g.moveTo(bx - br, base); g.lineTo(bx - br, top); g.lineTo(bx, top - br * 2); g.lineTo(bx + br, top); g.lineTo(bx + br, base); g.stroke();
  }
  // Dimension lines.
  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, vertical: boolean) => {
    g.lineWidth = 1.2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    for (const [x, y] of [[x1, y1], [x2, y2]]) { g.beginPath(); vertical ? (g.moveTo(x - 10, y), g.lineTo(x + 10, y)) : (g.moveTo(x, y - 10), g.lineTo(x, y + 10)); g.stroke(); }
    g.save(); g.font = '600 22px monospace'; g.textAlign = 'center';
    if (vertical) { g.translate(x1 - 18, (y1 + y2) / 2); g.rotate(-Math.PI / 2); g.fillText(label, 0, 0); } else g.fillText(label, (x1 + x2) / 2, y1 - 14);
    g.restore();
  };
  dim(cx - bay - 110, base, cx - bay - 110, yNose, `${r.height.toFixed(1)} m`, true);
  dim(cx - rad, base + 70, cx + rad, base + 70, `Ø ${r.diameter} m`, false);
  dim(cx + bay + 70, yBody, cx + bay + 70, yFair, `${r.fairingHeight} m`, true);
  dim(cx - bay, yNose - 18, cx + bay, yNose - 18, `Ø ${r.fairingDiameter} m fairing`, false);
  // Callouts.
  g.font = '20px monospace'; g.textAlign = 'left';
  const call = (y: number, text: string) => { g.beginPath(); g.moveTo(cx + bay + 10, y); g.lineTo(cx + bay + 150, y - 30); g.lineTo(cx + bay + 175, y - 30); g.stroke(); g.fillText(text, cx + bay + 180, y - 24); };
  call((yFair + yBody) / 2, 'PAYLOAD BAY / FAIRING');
  call(base - body * 0.85 * px, 'UPPER STAGE');
  call(joint + 30, 'INTERSTAGE');
  call(base - body * 0.25 * px, 'FIRST STAGE · LOX/RP-1');
  // Plan view (cross-section at base).
  const pcx = 1000, pcy = 300;
  g.lineWidth = 2; g.beginPath(); g.arc(pcx, pcy, rad * 2.2, 0, Math.PI * 2); g.stroke();
  g.setLineDash([6, 6]); g.beginPath(); g.arc(pcx, pcy, bay * 2.2, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  for (const [dx, dy] of (r.id === 'scout' ? [[0, 0]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]])) { g.beginPath(); g.arc(pcx + dx * rad * 0.9, pcy + dy * rad * 0.9, rad * 0.45, 0, Math.PI * 2); g.stroke(); }
  if (r.boosters) for (const s of [-1, 1]) { g.beginPath(); g.arc(pcx + s * rad * 2.2 * 1.65, pcy, rad * 0.95, 0, Math.PI * 2); g.stroke(); }
  g.font = '600 22px monospace'; g.textAlign = 'center'; g.fillText('SECTION A–A · ENGINE LAYOUT', pcx, pcy + bay * 2.2 + 50);
  // Specification table.
  const tx = 1340, ty = 110;
  g.textAlign = 'left'; g.font = '700 40px system-ui, sans-serif'; g.fillText(r.name.toUpperCase(), tx, ty);
  g.font = '20px monospace'; g.fillText('GENERAL ARRANGEMENT · FICTIONAL EDUCATIONAL VEHICLE', tx, ty + 34);
  const rows: [string, string][] = [
    ['Height × diameter', `${r.height} m × ${r.diameter} m`],
    ['Stage groups / boosters', `${r.stages} / ${r.boosters}`],
    ['Lift-off thrust', `${(r.ascentModel.thrustN / 1e6).toFixed(2)} MN`],
    ['Specific impulse (SL)', `${r.ascentModel.specificImpulseS} s`],
    ['Propellant / dry mass', `${(r.ascentModel.propellantKg / 1000).toFixed(0)} t / ${(r.ascentModel.dryMassKg / 1000).toFixed(1)} t`],
    ['Lift-off mass', `${(perf.liftoff / 1000).toFixed(0)} t`],
    ['Thrust-to-weight', perf.twr.toFixed(2)],
    ['Ideal Δv (single-stage eq.)', `${(perf.dv / 1000).toFixed(2)} km/s`],
    ['Full-thrust burn time', `${perf.burn.toFixed(0)} s`],
    ['Drag coefficient', `${r.ascentModel.dragCoefficient}`],
    ['Usable fairing', `Ø ${r.fairingDiameter} × ${r.fairingHeight} m`],
  ];
  rows.forEach(([k, v], i) => {
    const y = ty + 90 + i * 42;
    g.strokeStyle = 'rgba(232,243,255,0.35)'; g.beginPath(); g.moveTo(tx, y + 12); g.lineTo(W - 70, y + 12); g.stroke();
    g.fillStyle = 'rgba(232,243,255,0.75)'; g.fillText(k.toUpperCase(), tx, y);
    g.fillStyle = '#ffffff'; g.textAlign = 'right'; g.fillText(v, W - 70, y); g.textAlign = 'left';
  });
  const cy0 = ty + 90 + rows.length * 42 + 30;
  g.fillStyle = '#e8f3ff'; g.font = '600 22px monospace'; g.fillText('PAYLOAD DELIVERY (WET SPACECRAFT, kg)', tx, cy0);
  g.font = '19px monospace';
  Object.entries(r.capacity).forEach(([dest, kg], i) => {
    const x = tx + (i % 2) * 330, y = cy0 + 36 + Math.floor(i / 2) * 32;
    g.fillStyle = kg ? '#ffffff' : 'rgba(255,255,255,0.4)';
    g.fillText(`${dest.toUpperCase().padEnd(9, ' ')} ${kg ? String(kg).padStart(5, ' ') : '  —'}`, x, y);
  });
  // Title block.
  g.strokeStyle = '#e8f3ff'; g.lineWidth = 2; g.strokeRect(W - 560, H - 150, 520, 110);
  g.fillStyle = '#e8f3ff'; g.font = '18px monospace';
  g.fillText(`DWG VYX-${id.toUpperCase()}-001   REV C   SCALE 1:${Math.round(1 / (px / 1000) / 10) * 10}`, W - 545, H - 118);
  g.fillText('VYDEX LAUNCH SYSTEMS · VEHICLE INTEGRATION', W - 545, H - 88);
  g.fillText('ALL DIMENSIONS IN METRES · FICTIONAL', W - 545, H - 58);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Extensible work platforms (open = retracted for viewing), yellow safety rails. */
function WorkPlatforms({ height, radius }: { height: number; radius: number }) {
  const ref = useRef<THREE.Group>(null);
  const levels = [0.22, 0.45, 0.68, 0.88].map((f) => height * f);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const open = 0.6 + 0.4 * Math.sin(clock.getElapsedTime() * 0.15);
    ref.current.children.forEach((lvl) => lvl.children.forEach((half, i) => { half.position.x = (i ? 1 : -1) * (radius * 2.3 + 2.15 + open * 0.9); }));
  });
  return (
    <group ref={ref}>
      {levels.map((y) => (
        <group key={y} position={[0, y, 0]}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * (radius * 2.3 + 2.15), 0, 0]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[4, 0.18, 6]} />
                <meshStandardMaterial color="#8d9296" metalness={0.6} roughness={0.5} />
              </mesh>
              <mesh position={[0, 0.55, 3]}>
                <boxGeometry args={[4, 0.06, 0.06]} />
                <meshStandardMaterial color="#f1c232" />
              </mesh>
              <mesh position={[0, 0.55, -3]}>
                <boxGeometry args={[4, 0.06, 0.06]} />
                <meshStandardMaterial color="#f1c232" />
              </mesh>
              <mesh position={[0, -0.3, 0]}>
                <boxGeometry args={[0.2, 0.4, 5.6]} />
                <meshStandardMaterial color="#5e6469" metalness={0.7} roughness={0.4} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Vehicle Assembly Building high bay: steel frame, girders, crane, doors and floor markings. */
function HighBay({ height, id }: { height: number; id: LauncherId }) {
  const H = Math.max(26, height * 1.9), W = 34, D = 30;
  const blueprint = useMemo(() => blueprintTexture(id), [id]);
  useEffect(() => () => blueprint.dispose(), [blueprint]);
  const crane = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crane.current) crane.current.position.x = Math.sin(clock.getElapsedTime() * 0.05) * 6;
  });
  const steel = <meshStandardMaterial color="#596168" metalness={0.75} roughness={0.45} />;
  return (
    <group>
      {/* Concrete floor with transfer-aisle markings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]} receiveShadow>
        <planeGeometry args={[W * 2, D * 2]} />
        <meshStandardMaterial color="#8e8c86" roughness={0.9} />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x * 8, -1.58, 0]}>
          <planeGeometry args={[0.25, D * 2]} />
          <meshBasicMaterial color="#e2b53a" />
        </mesh>
      ))}
      {/* Back wall: corrugated siding with the blueprint boards */}
      <mesh position={[0, H / 2 - 1.6, -D / 2]} receiveShadow>
        <boxGeometry args={[W * 2, H, 0.4]} />
        <meshStandardMaterial color="#b9bdbb" roughness={0.8} metalness={0.2} />
      </mesh>
      <mesh position={[0, height * 0.55, -D / 2 + 0.3]}>
        <planeGeometry args={[30, 16.9]} />
        <meshStandardMaterial map={blueprint} roughness={0.6} emissive="#2b6fb5" emissiveIntensity={0.18} emissiveMap={blueprint} />
      </mesh>
      {/* Side walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * W, H / 2 - 1.6, 0]}>
          <boxGeometry args={[0.4, H, D * 2]} />
          <meshStandardMaterial color="#aeb2b0" roughness={0.85} />
        </mesh>
      ))}
      {/* Steel columns and horizontal girders */}
      {[-1, 1].flatMap((s) => [-12, -4, 4, 12].map((z) => (
        <mesh key={`${s}${z}`} position={[s * (W - 1), H / 2 - 1.6, z]} castShadow>
          <boxGeometry args={[1, H, 1]} />
          {steel}
        </mesh>
      )))}
      {[0.3, 0.55, 0.8].map((f) => [-1, 1].map((s) => (
        <mesh key={`${f}${s}`} position={[s * (W - 1.2), H * f, 0]}>
          <boxGeometry args={[0.6, 0.7, D * 2]} />
          {steel}
        </mesh>
      )))}
      {/* High clerestory windows */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-W + 0.3, H * 0.86, -24 + i * 6.8]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[5.2, 2.2]} />
          <meshBasicMaterial color="#cfe6ff" />
        </mesh>
      ))}
      {/* Roof trusses */}
      {[-18, -9, 0, 9, 18].map((z) => (
        <mesh key={z} position={[0, H - 2, z]}>
          <boxGeometry args={[W * 2, 1.2, 0.5]} />
          {steel}
        </mesh>
      ))}
      {/* 250-ton bridge crane on runway rails */}
      <group ref={crane} position={[0, H - 4.5, 0]}>
        <mesh>
          <boxGeometry args={[2.2, 1.6, D * 2 - 2]} />
          <meshStandardMaterial color="#d8a832" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, -1.2, 4]}>
          <boxGeometry args={[3, 1.2, 2.6]} />
          <meshStandardMaterial color="#c2952a" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, -H * 0.18, 4]}>
          <cylinderGeometry args={[0.04, 0.04, H * 0.3, 6]} />
          <meshStandardMaterial color="#2c2c2c" />
        </mesh>
        <mesh position={[0, -H * 0.34, 4]}>
          <torusGeometry args={[0.5, 0.12, 8, 18, Math.PI * 1.4]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
      {/* High-bay lights */}
      {[-14, 0, 14].flatMap((x) => [-10, 6].map((z) => (
        <group key={`${x}${z}`} position={[x, H - 3, z]}>
          <mesh>
            <cylinderGeometry args={[0.8, 1.1, 0.5, 16]} />
            <meshStandardMaterial color="#e6e6e0" emissive="#fff4dc" emissiveIntensity={1.5} />
          </mesh>
          <pointLight position={[0, -1, 0]} intensity={180} distance={H * 1.6} decay={1.6} color="#fff1d6" />
        </group>
      )))}
      {/* Mobile launcher platform */}
      <mesh position={[0, -1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[14, 1.2, 11]} />
        <meshStandardMaterial color="#3b3f42" metalness={0.5} roughness={0.6} />
      </mesh>
      {[-1, 1].map((x) => (
        <group key={x} position={[x * 2.3, -0.2, 2.6]}>
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[0.6, 2, 0.6]} />
            <meshStandardMaterial color="#62686c" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <Html position={[0, height * 0.55 + 9.6, -D / 2 + 0.4]} center distanceFactor={36} style={{ pointerEvents: 'none' }}>
        <span className="rocket-gyro-hud">VEHICLE ASSEMBLY · HIGH BAY 3 · {launchers[id].name.toUpperCase()}</span>
      </Html>
    </group>
  );
}

export default function RocketHangar() {
  const id = useGame((s) => s.data.design.launcher ?? 'titan'), { camera } = useThree(), h = rocketLayout(id).height;
  const radius = (launchers[id].diameter / 2) * ROCKET_VISUAL_SCALE;
  useEffect(() => {
    camera.position.set(15, h * 0.55, 21);
    camera.lookAt(0, h * 0.5, 0);
  }, [camera, id, h]);
  return (
    <>
      <color attach="background" args={['#1d2226']} />
      <fog attach="fog" args={['#1d2226', 40, 120]} />
      <ambientLight intensity={0.25} />
      <hemisphereLight args={['#f1efe7', '#3a3936', 0.7]} />
      <directionalLight position={[-20, 30, 25]} intensity={1.6} color="#fff3df" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={40} shadow-camera-bottom={-10} />
      <HighBay height={h} id={id} />
      <WorkPlatforms height={h} radius={radius} />
      <LaunchVehicle id={id} />
      <OrbitControls makeDefault target={[0, h * 0.5, 0]} enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.65} minDistance={h * 0.6} maxDistance={48} minPolarAngle={0.08} maxPolarAngle={Math.PI * 0.6} onStart={() => useGame.getState().setTutorial({ action: 'rocket-rotate' })} />
    </>
  );
}
