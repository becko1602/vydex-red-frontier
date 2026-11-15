import { useMemo, useRef, useEffect, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky, Stars } from "@react-three/drei";
import * as THREE from "three";
import { Planet } from "./Planet";
import { SunBody } from "./SunBody";

/**
 * Launch-site environment at a consistent scale.
 * The ascent maps altitude to scene units with LAUNCH_UNITS_PER_M, so Earth is
 * drawn with its true radius in the same units: the pad sits on a 6371 km
 * sphere and curvature only appears once the vehicle is high enough.
 */
export const LAUNCH_UNITS_PER_M = 0.014;
export const EARTH_R_UNITS = 6_371_000 * LAUNCH_UNITS_PER_M; // ≈ 89 194
/** Morning launch: Sun 9° above the eastern (ocean, +X) horizon. */
export const SUN_DIR = new THREE.Vector3(0.93, 0.16, -0.33).normalize();

function softSprite() {
  const el = document.createElement("canvas");
  el.width = el.height = 128;
  const g = el.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.65)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // Lumpy billow edges.
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 22;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r, s = 8 + Math.random() * 14;
    const gg = g.createRadialGradient(x, y, 0, x, y, s);
    gg.addColorStop(0, "rgba(255,255,255,0.35)");
    gg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gg;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function groundTexture() {
  const el = document.createElement("canvas");
  el.width = el.height = 512;
  const g = el.getContext("2d")!;
  g.fillStyle = "#5b6a3c";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const k = Math.random();
    g.fillStyle = k < 0.33 ? "rgba(70,86,44,0.6)" : k < 0.66 ? "rgba(112,118,72,0.5)" : "rgba(146,138,98,0.35)";
    g.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(220, 220);
  t.anisotropy = 8;
  return t;
}

/** Sky, sunlight, coastline, ground and the full Earth, crossfading with altitude. */
export function LaunchEnvironment({ altitudeM }: { altitudeM: MutableRefObject<number> }) {
  const { camera, scene } = useThree();
  const sky = useRef<THREE.Mesh>(null), ground = useRef<THREE.Group>(null), earth = useRef<THREE.Group>(null), stars = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null), amb = useRef<THREE.HemisphereLight>(null);
  const grass = useMemo(groundTexture, []);
  useEffect(() => () => grass.dispose(), [grass]);
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.far = 420000;
      camera.updateProjectionMatrix();
    }
    return () => {
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.far = 1200;
        camera.near = 0.1;
        camera.updateProjectionMatrix();
      }
      scene.fog = null;
    };
  }, [camera, scene]);
  const fog = useMemo(() => new THREE.Fog("#c9b9a2", 400, 9000), []);
  useFrame(() => {
    const h = altitudeM.current;
    const air = THREE.MathUtils.clamp(1 - h / 45000, 0, 1); // atmosphere optical depth proxy
    const high = THREE.MathUtils.clamp((h - 2500) / 6000, 0, 1);
    // Depth precision: push the near plane out as the vehicle climbs.
    if (camera instanceof THREE.PerspectiveCamera) {
      const near = h > 3000 ? Math.min(1.5, 0.1 + h * 0.00002) : 0.1; // keep the vehicle (≈10–20 units away) inside the frustum
      if (Math.abs(camera.near - near) > 0.05) {
        camera.near = near;
        camera.updateProjectionMatrix();
      }
    }
    scene.fog = air > 0.05 ? fog : null;
    fog.near = 400 + h * 0.05;
    fog.far = 9000 + h * 1.5;
    fog.color.set("#d2c0a4").lerp(new THREE.Color("#0a1424"), 1 - air);
    if (sky.current) {
      const m = sky.current.material as THREE.ShaderMaterial;
      sky.current.visible = air > 0.02;
      m.uniforms.rayleigh.value = 2.2 * air;
      m.uniforms.turbidity.value = 2 + 6 * air;
      m.uniforms.mieCoefficient.value = 0.006 * air;
    }
    if (scene.background instanceof THREE.Color) scene.background.set("#000000");
    if (ground.current) ground.current.visible = high < 1;
    if (earth.current) earth.current.visible = high > 0;
    if (stars.current) stars.current.visible = air < 0.55;
    if (sun.current) sun.current.intensity = 3.2 + (1 - air) * 1.2;
    if (amb.current) amb.current.intensity = 0.25 + 0.45 * air;
  });
  return (
    <>
      <Sky ref={sky as never} distance={380000} sunPosition={SUN_DIR.clone().multiplyScalar(100)} turbidity={6} rayleigh={2.2} mieCoefficient={0.006} mieDirectionalG={0.86} />
      <group ref={stars}>
        <Stars radius={200000} depth={50000} count={3500} factor={4000} saturation={0.1} fade speed={0} />
      </group>
      <group position={SUN_DIR.clone().multiplyScalar(300000).toArray()}>
        <SunBody radius={1400} glare={0.7} />
      </group>
      <hemisphereLight ref={amb} args={["#cfdcef", "#4f5a3a", 0.6]} />
      <directionalLight
        ref={sun}
        position={SUN_DIR.clone().multiplyScalar(220).toArray()}
        intensity={3.4}
        color="#ffe2b8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={600}
        shadow-bias={-0.0006}
      />
      {/* True-scale Earth below the pad (visible from altitude). */}
      <group ref={earth} position={[0, -EARTH_R_UNITS - 2, 0]} rotation={[0.2, 0, 0.1]} visible={false}>
        <Planet kind="earth" radius={EARTH_R_UNITS} spin={false} />
      </group>
      {/* Local coastal landscape: scrubland, beach, Atlantic Ocean to the east. */}
      <group ref={ground}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4000, -0.95, 0]} receiveShadow>
          <planeGeometry args={[16000, 30000]} />
          <meshStandardMaterial map={grass} color="#ffffff" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4060, -0.97, 0]}>
          <planeGeometry args={[120, 30000]} />
          <meshStandardMaterial color="#d8cba8" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[40000, -1.4, 0]}>
          <planeGeometry args={[71800, 120000]} />
          <meshStandardMaterial color="#21486a" roughness={0.18} metalness={0.25} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-40000, -1.0, 0]}>
          <planeGeometry args={[56000, 120000]} />
          <meshStandardMaterial color="#56653a" roughness={1} />
        </mesh>
        {/* Crawlerway gravel road toward the assembly building (west). */}
        {[-3.2, 3.2].map((z) => (
          <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[-1240, -0.92, z]}>
            <planeGeometry args={[2400, 4]} />
            <meshStandardMaterial color="#8f8a7f" roughness={1} />
          </mesh>
        ))}
        {/* Distant assembly building on the horizon. */}
        <mesh position={[-2600, 60, 220]} castShadow>
          <boxGeometry args={[160, 125, 140]} />
          <meshStandardMaterial color="#d9dad5" roughness={0.8} />
        </mesh>
      </group>
    </>
  );
}

/** Pad infrastructure around the existing tower: lightning masts, cryo spheres, water tower, floodlights. */
export function PadInfrastructure({ rocketHeight = 12 }: { rocketHeight?: number }) {
  const beacons = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const on = Math.sin(clock.getElapsedTime() * 2.4) > 0.2;
    beacons.current?.children.forEach((c) => ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(on ? "#ff2a1a" : "#3a0905"));
  });
  // LC-39B-style catenary towers: ~2× the vehicle height, ~150 m apart (1 unit = 4 m).
  const masts: [number, number][] = [[-19, -19], [19, -19], [-19, 21], [19, 21]];
  const H = rocketHeight * 1.9;
  return (
    <group>
      {/* Catenary lightning-protection system: four tapered masts with overhead wires */}
      {masts.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, H / 2, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.32, H, 10]} />
            <meshStandardMaterial color="#d7d9d6" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#8c8f8a" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <group ref={beacons}>
        {masts.map(([x, z], i) => (
          <mesh key={i} position={[x, H + 0.4, z]}>
            <sphereGeometry args={[0.18, 10, 8]} />
            <meshBasicMaterial color="#ff2a1a" />
          </mesh>
        ))}
      </group>
      {[[0, 1], [1, 3], [3, 2], [2, 0]].map(([a, b], i) => {
        const A = new THREE.Vector3(masts[a][0], H, masts[a][1]), B = new THREE.Vector3(masts[b][0], H, masts[b][1]);
        const pts = Array.from({ length: 17 }, (_, k) => {
          const t = k / 16;
          return A.clone().lerp(B, t).add(new THREE.Vector3(0, -3 * 4 * t * (1 - t), 0));
        });
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return (
          <primitive key={i} object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: "#2b2f31" }))} />
        );
      })}
      {/* Liquid hydrogen (east) and liquid oxygen (west) storage spheres */}
      {[[92, 46, 3.2, "#f2f2ee"], [-88, 50, 2.6, "#e9ebe8"]].map(([x, z, r, c], i) => (
        <group key={i} position={[Number(x), 0, Number(z)]}>
          <mesh position={[0, Number(r) + 0.8, 0]} castShadow receiveShadow>
            <sphereGeometry args={[Number(r), 40, 24]} />
            <meshStandardMaterial color={String(c)} roughness={0.45} metalness={0.15} />
          </mesh>
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2;
            return (
              <mesh key={k} position={[Math.cos(a) * Number(r) * 0.8, (Number(r) + 0.8) / 2, Math.sin(a) * Number(r) * 0.8]}>
                <cylinderGeometry args={[0.1, 0.1, Number(r) + 0.8, 8]} />
                <meshStandardMaterial color="#9a9d99" metalness={0.6} roughness={0.4} />
              </mesh>
            );
          })}
        </group>
      ))}
      {/* Sound-suppression water tower */}
      <group position={[-60, 0, -55]} scale={0.42}>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[Math.cos(k * Math.PI / 2) * 3, 12, Math.sin(k * Math.PI / 2) * 3]} rotation={[Math.sin(k * Math.PI / 2) * 0.08, 0, -Math.cos(k * Math.PI / 2) * 0.08]}>
            <cylinderGeometry args={[0.7, 0.9, 24, 8]} />
            <meshStandardMaterial color="#a6aaa5" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 28, 0]} castShadow>
          <sphereGeometry args={[6, 32, 20]} />
          <meshStandardMaterial color="#e8e8e2" roughness={0.5} />
        </mesh>
      </group>
      {/* Pad perimeter floodlight poles */}
      {[[-28, 0], [28, 0], [0, -30], [0, 30]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} scale={0.5}>
          <mesh position={[0, 9, 0]}>
            <cylinderGeometry args={[0.15, 0.25, 18, 8]} />
            <meshStandardMaterial color="#8a8d89" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 18.4, 0]} rotation={[0, Math.atan2(-x, -z), 0]}>
            <boxGeometry args={[2.6, 1.2, 0.5]} />
            <meshStandardMaterial color="#e9e7df" emissive="#fff3d0" emissiveIntensity={0.25} />
          </mesh>
        </group>
      ))}

    </group>
  );
}

/**
 * Rocket exhaust plume. Sea-level plumes are tight and bright; as ambient
 * pressure falls the under-expanded plume balloons outward (visible at
 * altitude in real launches). Shock diamonds shown on liquid engines.
 */
export function ExhaustPlume({ radius, throttle, altitudeM, solid = false }: { radius: number; throttle: () => number; altitudeM: MutableRefObject<number>; solid?: boolean }) {
  const group = useRef<THREE.Group>(null), light = useRef<THREE.PointLight>(null);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { t: { value: 0 }, expand: { value: 0 }, solid: { value: solid ? 1 : 0 } },
    vertexShader: "varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }",
    fragmentShader: `uniform float t; uniform float expand; uniform float solid; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float h(float n){return fract(sin(n)*43758.5453);}
      void main(){
        float y=1.0-vUv.y; // 0 at nozzle, 1 at tail
        float edge=pow(abs(dot(normalize(vN),normalize(vV))),1.4);
        float flick=0.85+0.15*sin(t*60.0+y*30.0)+0.1*h(floor(t*30.0)+y*10.0);
        float diamonds=solid>0.5?0.0:pow(max(0.0,sin(y*42.0-1.0)),12.0)*(1.0-y)*(1.0-expand);
        vec3 hot=solid>0.5?vec3(1.0,0.86,0.55):vec3(1.0,0.78,0.45);
        vec3 tail=solid>0.5?vec3(1.0,0.45,0.12):vec3(1.0,0.5,0.25);
        vec3 c=mix(hot,tail,smoothstep(0.0,0.7,y));
        float a=(1.0-smoothstep(0.15,1.0,y))*edge*flick*(0.9-0.5*expand)+diamonds*1.4;
        gl_FragColor=vec4(c*(1.6+diamonds*2.0),a);
      }`,
  }), [solid]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    const th = throttle(), h = altitudeM.current;
    mat.uniforms.t.value += Math.min(dt, 0.1);
    const expand = THREE.MathUtils.clamp(h / 40000, 0, 1);
    mat.uniforms.expand.value = expand;
    if (group.current) {
      group.current.visible = th > 0.01;
      const len = radius * (solid ? 22 : 18) * (0.6 + 0.4 * th) * (1 + expand * 1.6);
      group.current.scale.set(1 + expand * 3.5, len, 1 + expand * 3.5);
    }
    if (light.current) light.current.intensity = th * (h < 2000 ? 900 : 120);
  });
  return (
    <group>
      <group ref={group} visible={false}>
        <mesh position={[0, -0.5, 0]} material={mat}>
          <cylinderGeometry args={[radius * 0.55, radius * 1.1, 1, 32, 8, true]} />
        </mesh>
        <mesh position={[0, -0.18, 0]} scale={[0.55, 0.36, 0.55]}>
          <cylinderGeometry args={[radius * 0.6, radius * 0.75, 1, 24, 1, true]} />
          <meshBasicMaterial color="#fffaf0" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0, -radius * 3, 0]} color="#ffb25e" distance={radius * 140} decay={1.6} intensity={0} />
    </group>
  );
}

/**
 * Ground cloud: exhaust + vaporised deluge water bursting out of the flame
 * trench on both sides, then a persistent trail column along the ascent.
 */
export function LaunchClouds({ active, rocket, altitudeM }: { active: () => boolean; rocket: MutableRefObject<THREE.Vector3>; altitudeM: MutableRefObject<number> }) {
  const tex = useMemo(softSprite, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const N = 260, TRAIL = 220;
  const ground = useRef<THREE.InstancedMesh>(null), trail = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(() => Array.from({ length: N }, (_, i) => ({ born: -1, side: i % 2 ? 1 : -1, dir: new THREE.Vector3(), speed: 0, size: 0 })), []);
  const trailPts = useMemo(() => Array.from({ length: TRAIL }, () => ({ p: new THREE.Vector3(), born: -1 })), []);
  const cursor = useRef(0), trailCursor = useRef(0), lastTrail = useRef(new THREE.Vector3(0, -999, 0));
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const { camera } = useThree();
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime(), on = active(), h = altitudeM.current;
    // Spawn trench billows while the vehicle is low.
    if (on && h < 1200) {
      const rate = Math.ceil(dt * 110);
      for (let k = 0; k < rate; k++) {
        const p = parts[cursor.current++ % N];
        p.born = t;
        p.side = Math.random() > 0.5 ? 1 : -1;
        p.dir.set(p.side * (0.8 + Math.random() * 0.4), 0.18 + Math.random() * 0.4, (Math.random() - 0.5) * 0.9).normalize();
        p.speed = 18 + Math.random() * 22;
        p.size = 1.6 + Math.random() * 2.2;
      }
    }
    // Trail puffs every ~6 units of climb.
    if (on && h > 30 && h < 60000 && rocket.current.distanceTo(lastTrail.current) > 5 + h * 0.0004) {
      const tp = trailPts[trailCursor.current++ % TRAIL];
      tp.p.copy(rocket.current);
      tp.born = t;
      lastTrail.current.copy(rocket.current);
    }
    const g = ground.current, tr = trail.current;
    if (g) {
      parts.forEach((p, i) => {
        const age = p.born < 0 ? 99 : t - p.born;
        if (age > 14) {
          dummy.position.set(0, -1e5, 0);
          dummy.scale.setScalar(0.001);
        } else {
          const travel = p.speed * (1 - Math.exp(-age * 0.55)) * 2.4;
          dummy.position.set(p.dir.x * travel, 1 + p.dir.y * travel + age * 1.4, p.dir.z * travel);
          dummy.scale.setScalar(Math.min(38, p.size * (1.4 + age * 0.6)));
        }
        dummy.quaternion.copy(camera.quaternion);
        dummy.updateMatrix();
        g.setMatrixAt(i, dummy.matrix);
        color.setScalar(0.92 - Math.min(0.25, age * 0.02));
        g.setColorAt(i, color);
      });
      g.instanceMatrix.needsUpdate = true;
      if (g.instanceColor) g.instanceColor.needsUpdate = true;
    }
    if (tr) {
      trailPts.forEach((p, i) => {
        const age = p.born < 0 ? 999 : t - p.born;
        if (age > 90) {
          dummy.position.set(0, -1e5, 0);
          dummy.scale.setScalar(0.001);
        } else {
          dummy.position.copy(p.p).add(new THREE.Vector3(age * 0.6, -age * 0.15, 0));
          const altScale = 1 + Math.min(6, p.p.y * 0.004);
          dummy.scale.setScalar(Math.min(30, (1.2 + age * 0.25) * altScale));
        }
        dummy.quaternion.copy(camera.quaternion);
        dummy.updateMatrix();
        tr.setMatrixAt(i, dummy.matrix);
      });
      tr.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      <instancedMesh ref={ground} args={[undefined, undefined, N]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshLambertMaterial map={tex} transparent depthWrite={false} opacity={0.95} color="#ffffff" emissive="#4a3a2a" />
      </instancedMesh>
      <instancedMesh ref={trail} args={[undefined, undefined, TRAIL]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshLambertMaterial map={tex} transparent depthWrite={false} opacity={0.55} color="#e9e6df" />
      </instancedMesh>
    </>
  );
}

/** Rainbird deluge: 1 million litres of water dumped onto the pad seconds before ignition. */
export function Deluge({ active }: { active: () => boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(softSprite, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { camera } = useThree();
  const N = 180;
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ a: Math.random() * Math.PI * 2, s: Math.random(), nozzle: i % 8, spread: 0.6 + Math.random() * 0.8 })), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    m.visible = active();
    if (!m.visible) return;
    const t = clock.getElapsedTime();
    seeds.forEach((k, i) => {
      // Rainbird nozzles around the deck throw arcs of water that turn to mist.
      const age = (t * 0.7 + k.s) % 1;
      const nz = (k.nozzle / 8) * Math.PI * 2;
      const base = new THREE.Vector3(Math.cos(nz) * 4.2, 0.2, Math.sin(nz) * 4.2);
      const v = new THREE.Vector3(-Math.cos(nz) * 4 * k.spread + Math.cos(k.a) * 0.6, 4.2, -Math.sin(nz) * 4 * k.spread + Math.sin(k.a) * 0.6);
      dummy.position.copy(base).addScaledVector(v, age).add(new THREE.Vector3(0, -6 * age * age, 0));
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.setScalar(0.4 + age * 1.6);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshLambertMaterial map={tex} color="#eef5f8" transparent opacity={0.45} depthWrite={false} />
    </instancedMesh>
  );
}

/** Transonic vapor cone (Prandtl–Glauert condensation) briefly visible near Max-Q. */
export function VaporCone({ altitudeM, radius }: { altitudeM: MutableRefObject<number>; radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const h = altitudeM.current;
    const k = Math.max(0, 1 - Math.abs(h - 11000) / 3500);
    if (ref.current) {
      ref.current.visible = k > 0.02;
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * k * (0.85 + 0.15 * Math.sin(clock.getElapsedTime() * 30));
    }
  });
  return (
    <mesh ref={ref} visible={false}>
      <coneGeometry args={[radius * 3.2, radius * 6, 40, 1, true]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
