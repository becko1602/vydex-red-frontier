import { useRef, useMemo, useEffect } from "react";
import { hardwareTextures } from "./hardwareTextures";
import { useFrame } from "@react-three/fiber";
import { Cylinder, Text } from "@react-three/drei";
import * as THREE from "three";
import { engine } from "../sim/game";
import { useGame } from "../store";
import type { Design } from "../data/gameBalance";
const white = "#e7e5dd",
  dark = "#24282b",
  alu = "#b9bcbb";
/** Rover-wide transient presentation state written by the UI (video recording). */
export const roverFx = { recording: false };
function Wheel({ ghost = false }: { ghost?: boolean }) {
  // Machined aluminium wheel, 0.42 m radius, 0.36 m wide, chevron grousers, titanium spokes.
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.36, 36, 1, true]} />
        <meshStandardMaterial color="#a9a8a3" metalness={0.75} roughness={0.45} side={THREE.DoubleSide} transparent={ghost} opacity={ghost ? 0.3 : 1} />
      </mesh>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            {[-1, 1].map((k) => (
              <mesh key={k} position={[0.425, k * 0.085, 0]} rotation={[k * 0.5, 0, 0]}>
                <boxGeometry args={[0.025, 0.19, 0.028]} />
                <meshStandardMaterial color="#8d8c87" metalness={0.8} roughness={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}
      {[-1, 1].map((k) => (
        <mesh key={k} position={[0, k * 0.17, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.015, 36]} />
          <meshStandardMaterial color="#c2c1bb" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`s${i}`} position={[0, 0.17, 0]} rotation={[0, (i / 6) * Math.PI * 2, 0]}>
          <boxGeometry args={[0.72, 0.02, 0.035]} />
          <meshStandardMaterial color="#d4d3cd" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.08, 20]} />
        <meshStandardMaterial color="#3a3d3f" metalness={0.7} roughness={0.4} />
      </mesh>
    </group>
  );
}
function Strut({ from, to, r = 0.045, color = alu }: { from: [number, number, number]; to: [number, number, number]; r?: number; color?: string }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5), dir = b.clone().sub(a), len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return (
    <mesh position={mid} quaternion={q} castShadow>
      <cylinderGeometry args={[r, r, len, 10]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.4} />
    </mesh>
  );
}
/** Laser / structured-light scan fan from the mast head toward the ground. */
function ScanBeams({ active, color = "#4dffd2" }: { active: () => number; color?: string }) {
  const fan = useRef<THREE.Group>(null), line = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // Triangle fan: apex at origin, far edge on a 7 m arc, 40° wide.
    const verts: number[] = [];
    const n = 24, R = 7, w = 0.35;
    for (let i = 0; i < n; i++) {
      const a0 = -w + (2 * w * i) / n, a1 = -w + (2 * w * (i + 1)) / n;
      verts.push(0, 0, 0, Math.sin(a0) * R, 0, -Math.cos(a0) * R, Math.sin(a1) * R, 0, -Math.cos(a1) * R);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, t: { value: 0 }, k: { value: 0 } },
    vertexShader: "varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "uniform vec3 color; uniform float t; uniform float k; varying vec3 p; void main(){ float d=length(p.xz); float scan=smoothstep(0.35,0.0,abs(fract(d*0.55-t*0.9)-0.5)); float fall=1.0-smoothstep(1.0,7.0,d); gl_FragColor=vec4(color,(0.05+0.5*scan)*fall*k);}",
  }), [color]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(({ clock }) => {
    const k = active();
    if (!fan.current) return;
    fan.current.visible = k > 0.01;
    mat.uniforms.k.value = k;
    mat.uniforms.t.value = clock.getElapsedTime();
    fan.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.9) * 0.45;
    if (line.current) line.current.position.z = -2 - ((clock.getElapsedTime() * 2.2) % 4.5);
  });
  return (
    <group ref={fan} visible={false} rotation={[0, 0, 0]}>
      <group rotation={[-0.42, 0, 0]}>
        <mesh geometry={geo} material={mat} />
        <mesh ref={line} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.2, 0.03]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      <pointLight color={color} intensity={0.8} distance={3} />
    </group>
  );
}
export function Rover({
  design,
  speed = 0,
  turn = 0,
  scale = 1,
  moving = false,
  folded = false,
}: {
  design: Design;
  speed?: number;
  turn?: number;
  scale?: number;
  moving?: boolean;
  folded?: boolean;
}) {
  const wheels = useRef<(THREE.Group | null)[]>([]),
    tires = useRef<(THREE.Group | null)[]>([]),
    mastHead = useRef<THREE.Group>(null),
    mast = useRef<THREE.Group>(null),
    arm = useRef<THREE.Group>(null),
    elbow = useRef<THREE.Group>(null),
    turret = useRef<THREE.Group>(null),
    drillBit = useRef<THREE.Mesh>(null),
    hga = useRef<THREE.Group>(null),
    lights = useRef<THREE.Group>(null),
    rec = useRef<THREE.Mesh>(null),
    beam = useRef<THREE.Mesh>(null),
    spotA = useRef<THREE.SpotLight>(null),
    spotB = useRef<THREE.SpotLight>(null),
    lightTarget = useMemo(() => new THREE.Object3D(), []);
  const scanning = () => {
    const d = engine.data;
    if (!moving || d.stage !== "surface") return 0;
    const inst = engine.targets().find((t) => t.id === d.scanId)?.instrument;
    return inst === "camera" || inst === "spectrometer" ? 1 : 0;
  };
  useFrame(({ clock }, dt) => {
    const ui = useGame.getState();
    if (ui.paused || ui.drawer || ui.settings.inspection || ui.workshop.info || ui.rocketInfo || ui.tutorial.hold) return;
    const d = engine.data, t = clock.getElapsedTime();
    const inst = moving ? engine.targets().find((x) => x.id === d.scanId)?.instrument : undefined;
    const anim = ui.settings.reducedMotion ? 0 : 1;
    const step = Math.min(dt, 0.1);
    // Mast: folded on the deck for cruise, raised on the surface. Head pans while imaging.
    if (mast.current) mast.current.rotation.x = THREE.MathUtils.damp(mast.current.rotation.x, folded ? -Math.PI / 2 : 0, 3, step);
    if (mastHead.current) {
      mastHead.current.rotation.y = THREE.MathUtils.damp(mastHead.current.rotation.y, inst === "camera" ? Math.sin(t * 0.7) * 0.6 * anim : inst ? 0 : Math.sin(t * 0.15) * 0.15 * anim, 3, step);
      mastHead.current.rotation.x = THREE.MathUtils.damp(mastHead.current.rotation.x, inst ? -0.35 : -0.08, 3, step);
    }
    // Arm: stowed across the front; unfolds to the ground for drill / contact science.
    const armOut = inst === "drill" || inst === "spectrometer" || inst === "sampler";
    if (arm.current) arm.current.rotation.x = THREE.MathUtils.damp(arm.current.rotation.x, armOut ? -0.25 : 1.25, 2.2, step);
    if (elbow.current) elbow.current.rotation.x = THREE.MathUtils.damp(elbow.current.rotation.x, armOut ? 1.35 : -2.4, 2.2, step);
    if (turret.current) turret.current.rotation.z += armOut ? step * 0.4 * anim : 0;
    if (drillBit.current) {
      if (inst === "drill") drillBit.current.rotation.y += step * 18 * anim;
      drillBit.current.position.y = inst === "drill" ? -0.2 - Math.min(0.12, d.scanTime * 0.012) : -0.2;
    }
    // HGA tracks Earth; dish slews up during transmission.
    if (hga.current) hga.current.rotation.x = THREE.MathUtils.damp(hga.current.rotation.x, moving && d.transmitting ? -0.9 : -0.3, 2, step);
    if (beam.current) {
      beam.current.visible = moving && d.transmitting;
      (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(t * 12);
    }
    const lit = moving && d.stage === "surface" && engine.lightsOn();
    if (lights.current) lights.current.visible = lit;
    if (spotA.current) spotA.current.intensity = lit ? 45 : 0;
    if (spotB.current) spotB.current.intensity = lit ? 45 : 0;
    if (rec.current) rec.current.visible = roverFx.recording && Math.sin(t * 6) > 0;
    wheels.current.forEach((w, i) => {
      if (!w) return;
      const corner = i % 3 !== 1;
      const front = i % 3 === 0;
      const steer = moving ? d.rover.steering : turn;
      w.rotation.y = corner ? (front ? 1 : -1) * steer * 0.35 : 0;
    });
    tires.current.forEach((tg, i) => {
      if (!tg) return;
      const side = i < 3 ? -1 : 1;
      tg.rotation.x -= ((moving ? d.rover.speed + side * d.rover.steering * 0.6 : speed) * step) / 0.42;
    });
  });
  // Rocker-bogie geometry, per side (x = ±1.02). Wheels at z = -1.05 (front), 0.05 (middle), 1.0 (rear).
  const wheelZ = [-1.05, 0.05, 1.0];
  return (
    <group scale={scale}>
      <primitive object={lightTarget} position={[0, 0, -9]} />
      {/* Warm Electronics Box (chassis) */}
      <group position={[0, 1.08, 0.05]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.55, 0.5, 2.15]} />
          <meshStandardMaterial color={white} roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <boxGeometry args={[1.62, 0.04, 2.22]} />
          <meshStandardMaterial color="#c8c6be" roughness={0.6} metalness={0.3} />
        </mesh>
        {/* Gold-taped seams and calibration targets */}
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * 0.78, 0, 0]}>
            <boxGeometry args={[0.012, 0.4, 2.05]} />
            <meshStandardMaterial color="#c79d43" metalness={0.85} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0.45, 0.3, 0.75]}>
          <boxGeometry args={[0.18, 0.02, 0.18]} />
          <meshStandardMaterial color="#6e6e6a" />
        </mesh>
        {/* Front/rear hazard-avoidance stereo cameras */}
        {[-1, 1].map((end) => [-0.18, 0.18].map((x) => (
          <mesh key={`${end}${x}`} position={[x, -0.12, end * 1.09]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.05, 14]} />
            <meshStandardMaterial color="#0b0d10" metalness={0.9} roughness={0.15} />
          </mesh>
        )))}
        {/* Recording LED */}
        <mesh ref={rec} position={[0.55, 0.3, -1.05]} visible={false}>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshBasicMaterial color="#ff2a2a" />
        </mesh>
        {/* Rear power-system housing (MMRTG-style fins) */}
        <group position={[0, 0.15, 1.25]} rotation={[-0.5, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.62, 16]} />
            <meshStandardMaterial color="#2f3337" metalness={0.6} roughness={0.5} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} rotation={[0, (i / 8) * Math.PI * 2, 0]} position={[0, 0, 0]}>
              <boxGeometry args={[0.6, 0.58, 0.02]} />
              <meshStandardMaterial color="#3c4146" metalness={0.6} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Rocker-bogie suspension + six wheels with corner steering actuators */}
      {[-1, 1].map((side, si) => {
        const x = side * 1.02;
        return (
          <group key={side}>
            {/* Differential pivot on the body side */}
            <mesh position={[side * 0.82, 1.0, 0.1]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.09, 0.09, 0.12, 16]} />
              <meshStandardMaterial color={dark} metalness={0.6} roughness={0.4} />
            </mesh>
            <Strut from={[side * 0.88, 1.0, 0.1]} to={[x, 1.0, 0.1]} r={0.05} />
            {/* Rocker: pivot → front wheel; pivot → bogie pivot */}
            <Strut from={[x, 1.0, 0.1]} to={[x, 0.82, wheelZ[0]]} />
            <Strut from={[x, 1.0, 0.1]} to={[x, 0.78, 0.55]} />
            {/* Bogie: middle ↔ rear wheels */}
            <Strut from={[x, 0.78, 0.55]} to={[x, 0.62, wheelZ[1]]} />
            <Strut from={[x, 0.78, 0.55]} to={[x, 0.62, wheelZ[2]]} />
            {wheelZ.map((z, wi) => (
              <group key={z} position={[x, 0.42, z]} ref={(n) => { wheels.current[si * 3 + wi] = n; }}>
                {/* Wheel drop link */}
                <Strut from={[0, z === wheelZ[0] ? 0.4 : 0.2, 0]} to={[0, 0, 0]} r={0.04} />
                {wi !== 1 && (
                  <mesh position={[0, 0.42, 0]}>
                    <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
                    <meshStandardMaterial color={dark} metalness={0.6} roughness={0.4} />
                  </mesh>
                )}
                <group position={[side * 0.12, 0, 0]} ref={(n) => { tires.current[si * 3 + wi] = n; }}>
                  <Wheel />
                </group>
              </group>
            ))}
          </group>
        );
      })}
      {/* Remote sensing mast with pan/tilt head: twin zoom cameras + laser spectrometer lens */}
      <group ref={mast} position={[-0.48, 1.36, -0.85]}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.07, 1.6, 12]} />
          <meshStandardMaterial color={white} roughness={0.5} metalness={0.3} />
        </mesh>
        <group ref={mastHead} position={[0, 1.68, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.52, 0.24, 0.3]} />
            <meshStandardMaterial color={white} roughness={0.45} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0, -0.17]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.06, 24]} />
            <meshStandardMaterial color="#0a0c0e" metalness={0.95} roughness={0.08} />
          </mesh>
          {[-0.19, 0.19].map((x) => (
            <mesh key={x} position={[x, 0.02, -0.17]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.07, 18]} />
              <meshStandardMaterial color="#111518" metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
          {/* Navigation cameras */}
          <mesh position={[0, -0.16, -0.12]}>
            <boxGeometry args={[0.36, 0.07, 0.1]} />
            <meshStandardMaterial color={dark} metalness={0.5} roughness={0.5} />
          </mesh>
          <group position={[0, 0, -0.2]}>
            <ScanBeams active={scanning} />
          </group>
        </group>
      </group>
      {/* Headlights: two LED floodlights on the front of the chassis */}
      <group ref={lights} visible={false}>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 1.0, -1.09]}>
            <boxGeometry args={[0.16, 0.08, 0.03]} />
            <meshBasicMaterial color="#fff6dc" />
          </mesh>
        ))}
      </group>
      <spotLight ref={spotA} position={[-0.5, 1.0, -1.1]} target={lightTarget} angle={0.55} penumbra={0.6} distance={28} decay={1.4} color="#fff3d6" intensity={0} castShadow={false} />
      <spotLight ref={spotB} position={[0.5, 1.0, -1.1]} target={lightTarget} angle={0.55} penumbra={0.6} distance={28} decay={1.4} color="#fff3d6" intensity={0} />
      {/* 5-DOF robotic arm with tool turret (drill, contact spectrometer, close-up imager) */}
      {(design.drill || design.spectrometer || folded === false) && (
        <group ref={arm} position={[0.5, 1.05, -1.15]} rotation={[1.25, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.09, 14, 10]} />
            <meshStandardMaterial color={dark} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.45, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.9, 12]} />
            <meshStandardMaterial color={white} metalness={0.3} roughness={0.5} />
          </mesh>
          <group ref={elbow} position={[0, -0.9, 0]} rotation={[-2.4, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.07, 12, 10]} />
              <meshStandardMaterial color={dark} metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.4, 0]}>
              <cylinderGeometry args={[0.04, 0.045, 0.8, 12]} />
              <meshStandardMaterial color={white} metalness={0.3} roughness={0.5} />
            </mesh>
            <group ref={turret} position={[0, -0.85, 0]}>
              <mesh>
                <boxGeometry args={[0.22, 0.18, 0.22]} />
                <meshStandardMaterial color="#5a5e60" metalness={0.7} roughness={0.4} />
              </mesh>
              {design.drill && (
                <mesh ref={drillBit} position={[0, -0.2, 0]}>
                  <cylinderGeometry args={[0.03, 0.012, 0.26, 10]} />
                  <meshStandardMaterial color="#d8d6cf" metalness={0.95} roughness={0.2} />
                </mesh>
              )}
              <mesh position={[0.14, -0.04, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.12, 14]} />
                <meshStandardMaterial color="#202326" metalness={0.6} roughness={0.4} />
              </mesh>
              <mesh position={[-0.14, -0.04, 0]}>
                <boxGeometry args={[0.08, 0.12, 0.1]} />
                <meshStandardMaterial color="#c49b45" metalness={0.8} roughness={0.35} />
              </mesh>
            </group>
          </group>
        </group>
      )}
      {/* MER-style solar deck with fold-out wings */}
      {design.solar && (
        <group position={[0, 1.42, 0.08]}>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} position={[k * 1.05, k ? -0.02 : 0, 0]} rotation={[0, 0, k * 0.05]} castShadow>
              <boxGeometry args={[k ? 0.62 : 1.5, 0.035, k ? 1.7 : 2.1]} />
              <SolarCellMaterial />
            </mesh>
          ))}
        </group>
      )}
      {/* High-gain antenna (hexagonal flat-plate) + UHF helix */}
      {design.antenna && (
        <group position={[0.5, 1.5, 0.75]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.2, 10]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          <group ref={hga} position={[0, 0.28, 0]} rotation={[-0.3, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.04, 6]} />
              <meshStandardMaterial color="#d7d5cc" metalness={0.4} roughness={0.5} />
            </mesh>
            <mesh ref={beam} position={[0, 0, -9]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
              <cylinderGeometry args={[0.6, 0.22, 18, 16, 1, true]} />
              <meshBasicMaterial color="#7cf0ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
          <mesh position={[-0.35, 0.25, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.5, 10]} />
            <meshStandardMaterial color="#c9c7bf" />
          </mesh>
        </group>
      )}
      {design.camera && (
        <mesh position={[-0.48, 3.12, -0.75]}>
          <boxGeometry args={[0.05, 0.05, 0.05]} />
          <meshStandardMaterial color="#e05a2c" />
        </mesh>
      )}
      {design.battery && (
        <mesh position={[-0.5, 1.38, 0.6]}>
          <boxGeometry args={[0.36, 0.08, 0.36]} />
          <meshStandardMaterial color="#3d4945" metalness={0.5} roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}
function SolarCellMaterial() {
  const map = useMemo(() => hardwareTextures().cells, []);
  return <meshStandardMaterial map={map} color="#ffffff" metalness={0.5} roughness={0.25} />;
}
export function LanderModel({
  design,
  throttle = 0,
}: {
  design: Design;
  throttle?: number;
}) {
  return (
    <group>
      <Rover design={design} scale={0.8} />
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[1.4, 1.7, 0.45, 8]} />
        <meshStandardMaterial color="#a38755" metalness={0.7} roughness={0.4} />
      </mesh>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group key={`${x}${z}`}>
            <mesh
              position={[x * 1.4, 0, z * 1.4]}
              rotation={[z * 0.4, 0, -x * 0.4]}
            >
              <cylinderGeometry args={[0.045, 0.07, 1.3, 8]} />
              <meshStandardMaterial
                color="#b0b3b1"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[x * 1.65, -0.5, z * 1.65]}>
              <cylinderGeometry args={[0.22, 0.3, 0.1, 8]} />
              <meshStandardMaterial color="#3b3632" />
            </mesh>
          </group>
        )),
      )}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.5, 0.7, 12]} />
        <meshStandardMaterial color="#363b3c" metalness={0.8} roughness={0.4} />
      </mesh>
      {throttle > 0.01 && (
        <group>
          <mesh position={[0, -0.6 - throttle, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.32, throttle * 3, 12]} />
            <meshBasicMaterial color="#9fe3ff" transparent opacity={0.8} />
          </mesh>
          <pointLight
            position={[0, -1, 0]}
            intensity={throttle * 8}
            color="#82c8ff"
            distance={8}
          />
        </group>
      )}
    </group>
  );
}
export function SmallLabel({
  children,
  ...props
}: {
  children: string;
  position: [number, number, number];
}) {
  return (
    <Text {...props} fontSize={0.3} color="#eae0ce" anchorX="center">
      {children}
    </Text>
  );
}
