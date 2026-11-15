import { useRef, useMemo, useEffect, useCallback } from "react";
import { GltfModel, type LoadedModel } from "./GltfAssets";
import { hardwareTextures } from "./hardwareTextures";
import { panelSet } from "./materials";
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
export const roverFx = { recording: false, armUntil: 0 };
function Wheel({ ghost = false }: { ghost?: boolean }) {
  // Machined aluminium wheel, 0.42 m radius, 0.36 m wide, chevron grousers, titanium spokes.
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.36, 36, 1, true]} />
        <meshStandardMaterial color="#4a4946" metalness={0.6} roughness={0.55} side={THREE.DoubleSide} transparent={ghost} opacity={ghost ? 0.3 : 1} />
      </mesh>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            {[-1, 1].map((k) => (
              <mesh key={k} position={[0.425, k * 0.085, 0]} rotation={[k * 0.5, 0, 0]}>
                <boxGeometry args={[0.025, 0.19, 0.028]} />
                <meshStandardMaterial color="#2c2c2a" metalness={0.5} roughness={0.7} />
              </mesh>
            ))}
          </group>
        );
      })}
      {[-1, 1].map((k) => (
        <mesh key={k} position={[0, k * 0.17, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.015, 36]} />
          <meshStandardMaterial color="#5a5955" metalness={0.7} roughness={0.45} />
        </mesh>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`s${i}`} position={[0, 0.17, 0]} rotation={[Math.PI / 2, 0, (i / 6) * Math.PI * 2]}>
          <torusGeometry args={[0.2, 0.014, 6, 16, Math.PI * 0.9]} />
          <meshStandardMaterial color="#c9a95a" metalness={0.9} roughness={0.3} />
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
engine.armFx = () => { roverFx.armUntil = performance.now() + 7000; };
/** Perseverance clip timings (from the glTF): arm stowed at 0 s, fully deployed 9–18 s. */
const ARM_CLIPS = ["arm.003Action", "arm.002Action", "armAction", "arm.004Action", "turret_objAction", "turret_cam_cover_01", "turret.001Action.001"];
const ARM_DEPLOYED_T = 9;
const MAST_CLIPS = ["CylinderAction", "bottomAction", "Cylinder.002Action"];
const MAST_UP_T = 3;
type WheelRig = { steer: THREE.Group; spin: THREE.Group; side: number; pos: -1 | 0 | 1 };
/** Real Perseverance wheel: 52.5 cm diameter. */
const WHEEL_R = 0.2625;
/**
 * The glTF merges all six wheels into one node (`Wheels_objs`, 3 material
 * primitives). Split it at load time: assign every triangle to the nearest of
 * six wheel clusters (left/right × front/middle/rear), rebuild one geometry per
 * wheel per material, re-centre it on the hub and nest it in steer → spin groups.
 */
function splitWheels(root: THREE.Object3D): WheelRig[] {
  const node = root.getObjectByName("Wheels_objs");
  if (!node) return [];
  // Idempotent: React StrictMode / re-mounts may run this twice on the same clone.
  if (node.userData.wheelRigs) return node.userData.wheelRigs as WheelRig[];
  const meshes: THREE.Mesh[] = [];
  node.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  if (!meshes.length) return [];
  node.updateMatrixWorld(true);
  const toNode = new THREE.Matrix4().copy(node.matrixWorld).invert();
  // Triangle soup per mesh in the node's frame.
  const soups = meshes.map((m) => {
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toNode, m.matrixWorld));
    return { mesh: m, g };
  });
  // 1-D k-means on z (3 axles), side from the sign of x.
  const zs: number[] = [];
  for (const { g } of soups) { const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) zs.push((p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3); }
  let c = [Math.min(...zs), 0, Math.max(...zs)];
  for (let it = 0; it < 12; it++) {
    const sum = [0, 0, 0], n = [0, 0, 0];
    for (const z of zs) { const k = c.reduce((b, v, i) => (Math.abs(z - v) < Math.abs(z - c[b]) ? i : b), 0); sum[k] += z; n[k]++; }
    c = c.map((v, i) => (n[i] ? sum[i] / n[i] : v));
  }
  const order = [...c.keys()].sort((a, b) => c[a] - c[b]); // rear(−z) → front(+z)
  const key = (x: number, z: number) => { const k = c.reduce((b, v, i) => (Math.abs(z - v) < Math.abs(z - c[b]) ? i : b), 0); return `${x < 0 ? -1 : 1}:${order.indexOf(k)}`; };
  // Bucket triangles.
  const buckets = new Map<string, { mesh: THREE.Mesh; pos: number[]; nor: number[]; uv: number[] }[]>();
  const box = new Map<string, THREE.Box3>();
  for (const { mesh, g } of soups) {
    const p = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
    const local = new Map<string, { mesh: THREE.Mesh; pos: number[]; nor: number[]; uv: number[] }>();
    for (let i = 0; i < p.count; i += 3) {
      const k = key((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3);
      let b = local.get(k);
      if (!b) { b = { mesh, pos: [], nor: [], uv: [] }; local.set(k, b); }
      if (!box.has(k)) box.set(k, new THREE.Box3());
      for (let v = i; v < i + 3; v++) {
        b.pos.push(p.getX(v), p.getY(v), p.getZ(v));
        box.get(k)!.expandByPoint(new THREE.Vector3(p.getX(v), p.getY(v), p.getZ(v)));
        if (nrm) b.nor.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
        if (uv) b.uv.push(uv.getX(v), uv.getY(v));
      }
    }
    for (const [k, b] of local) { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(b); }
    g.dispose();
  }
  // Remove the merged originals and rebuild per-wheel pivots.
  for (const m of meshes) m.parent?.remove(m);
  const rigs: WheelRig[] = [];
  for (const [k, parts] of buckets) {
    const centre = box.get(k)!.getCenter(new THREE.Vector3());
    const steer = new THREE.Group(), spin = new THREE.Group();
    steer.position.copy(centre);
    steer.add(spin);
    for (const b of parts) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
      if (b.nor.length) g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
      if (b.uv.length) g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
      g.translate(-centre.x, -centre.y, -centre.z);
      const m = new THREE.Mesh(g, b.mesh.material);
      m.castShadow = m.receiveShadow = true;
      spin.add(m);
    }
    node.add(steer);
    const [side, idx] = k.split(":").map(Number);
    rigs.push({ steer, spin, side, pos: (idx - 1) as -1 | 0 | 1 });
  }
  node.userData.wheelRigs = rigs;
  return rigs;
}
type RoverRig = { wheels: WheelRig[]; mixer: THREE.AnimationMixer; arm: THREE.AnimationAction[]; mast: THREE.AnimationAction[]; top?: THREE.Object3D; topRest?: THREE.Quaternion; head?: THREE.Object3D; hga?: THREE.Object3D; root: THREE.Object3D };
/**
 * Rover = imported NASA Mars 2020 Perseverance model (public/models/perseverance.glb).
 * Driven parts: robotic arm and mast via the model's own animation clips, mast
 * pan via its `top` node. Limitation: the file merges all six wheels into one
 * mesh (`Wheels_objs`) and the rocker-bogie into one mesh (`suspension`), so
 * individual wheel spin, corner steering and suspension articulation cannot be
 * animated; the whole vehicle still pitches/rolls with the terrain.
 */
export function Rover({
  design,
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
  void design;
  const rig = useRef<RoverRig | null>(null),
    k = useRef({ arm: 0, mast: folded ? 0 : 1, pan: 0 }),
    beams = useRef<THREE.Group>(null),
    beam = useRef<THREE.Mesh>(null),
    lights = useRef<THREE.Group>(null),
    rec = useRef<THREE.Mesh>(null),
    spotA = useRef<THREE.SpotLight>(null),
    spotB = useRef<THREE.SpotLight>(null),
    self = useRef<THREE.Group>(null),
    lightTarget = useMemo(() => new THREE.Object3D(), []),
    tmp = useMemo(() => new THREE.Vector3(), []);
  const onReady = useCallback((m: LoadedModel) => {
    const mixer = new THREE.AnimationMixer(m.scene);
    const take = (names: string[]) => names.flatMap((n) => {
      const clip = m.animations.find((c) => c.name === n);
      if (!clip) return [];
      const a = mixer.clipAction(clip);
      a.play();
      a.paused = true;
      a.time = 0;
      return [a];
    });
    const top = m.scene.getObjectByName("top") ?? undefined;
    rig.current = { wheels: splitWheels(m.scene), mixer, arm: take(ARM_CLIPS), mast: take(MAST_CLIPS), top, topRest: top?.quaternion.clone(), head: m.scene.getObjectByName("head") ?? undefined, hga: m.scene.getObjectByName("antenna_hg") ?? undefined, root: m.root };
  }, []);
  const scanning = () => {
    const d = engine.data;
    if (!moving || d.stage !== "surface") return 0;
    const inst = engine.targets().find((t) => t.id === d.scanId)?.instrument;
    return inst === "camera" || inst === "spectrometer" ? 1 : 0;
  };
  useFrame(({ clock }, dt) => {
    const ui = useGame.getState();
    const r = rig.current;
    const d = engine.data, t = clock.getElapsedTime(), step = Math.min(dt, 0.1);
    const frozen = ui.paused || ui.drawer || ui.settings.inspection || ui.workshop.info || ui.rocketInfo || ui.tutorial.hold;
    const inst = moving ? engine.targets().find((x) => x.id === d.scanId)?.instrument : undefined;
    const anim = ui.settings.reducedMotion ? 0 : 1;
    if (r && !frozen) {
      const armOut = inst === "drill" || inst === "spectrometer" || inst === "sampler" || performance.now() < roverFx.armUntil;
      k.current.arm = THREE.MathUtils.damp(k.current.arm, armOut ? 1 : 0, 0.9, step);
      k.current.mast = THREE.MathUtils.damp(k.current.mast, folded ? 0 : 1, 2, step);
      for (const a of r.arm) a.time = k.current.arm * ARM_DEPLOYED_T;
      for (const a of r.mast) a.time = k.current.mast * MAST_UP_T;
      r.mixer.update(0);
      // Mast pan: sweep while imaging, slow idle look-around otherwise.
      k.current.pan = THREE.MathUtils.damp(k.current.pan, inst === "camera" ? Math.sin(t * 0.7) * 0.7 * anim : Math.sin(t * 0.15) * 0.2 * anim, 3, step);
      if (r.top && r.topRest) r.top.quaternion.copy(r.topRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.current.pan));
    }
    // Wheels: roll with ground speed (ω = v / r, inner/outer side differential
    // while turning); corner wheels (front/rear) steer in opposite directions.
    if (r && !frozen) {
      const v = moving ? d.rover.speed : 0, steer = moving ? d.rover.steering : 0;
      for (const w of r.wheels) {
        w.spin.rotation.x += ((v - w.side * steer * 0.45) * step) / WHEEL_R;
        w.steer.rotation.y = w.pos === 0 ? 0 : w.pos * steer * 0.35;
      }
    }
    // Scan beams follow the real mast head.
    if (r?.head && beams.current && self.current) {
      r.head.getWorldPosition(tmp);
      self.current.worldToLocal(tmp);
      beams.current.position.copy(tmp);
    }
    if (r?.hga && beam.current && self.current) {
      r.hga.getWorldPosition(tmp);
      self.current.worldToLocal(tmp);
      beam.current.parent?.position.copy(tmp);
      beam.current.visible = moving && d.transmitting;
      (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(t * 12);
    }
    const lit = moving && d.stage === "surface" && engine.lightsOn();
    if (lights.current) lights.current.visible = lit;
    if (spotA.current) spotA.current.intensity = lit ? 45 : 0;
    if (spotB.current) spotB.current.intensity = lit ? 45 : 0;
    if (rec.current) rec.current.visible = roverFx.recording && Math.sin(t * 6) > 0;
  });
  return (
    <group scale={scale} ref={self}>
      <primitive object={lightTarget} position={[0, 0, -9]} />
      <GltfModel id="perseverance" onReady={onReady} />
      {/* Mast-head scan fan (position updated from the model's head node) */}
      <group ref={beams}>
        <group position={[0, 0, -0.25]}>
          <ScanBeams active={scanning} />
        </group>
      </group>
      {/* Earth link beam from the high-gain antenna */}
      <group>
        <group rotation={[-0.9, 0, 0]}>
          <mesh ref={beam} position={[0, 0, -9]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
            <cylinderGeometry args={[0.6, 0.22, 18, 16, 1, true]} />
            <meshBasicMaterial color="#7cf0ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
      {/* Headlights (added hardware for night driving) and recording LED */}
      <group ref={lights} visible={false}>
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.95, -1.5]}>
            <boxGeometry args={[0.14, 0.07, 0.03]} />
            <meshBasicMaterial color="#fff6dc" />
          </mesh>
        ))}
      </group>
      <mesh ref={rec} position={[0.5, 1.4, -1.3]} visible={false}>
        <sphereGeometry args={[0.03, 10, 8]} />
        <meshBasicMaterial color="#ff2a2a" />
      </mesh>
      <spotLight ref={spotA} position={[-0.45, 0.95, -1.5]} target={lightTarget} angle={0.55} penumbra={0.6} distance={28} decay={1.4} color="#fff3d6" intensity={0} />
      <spotLight ref={spotB} position={[0.45, 0.95, -1.5]} target={lightTarget} angle={0.55} penumbra={0.6} distance={28} decay={1.4} color="#fff3d6" intensity={0} />
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
