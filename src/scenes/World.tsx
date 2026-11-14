import { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { engine, rocks } from "../sim/game";
import { clamp, seeded, terrainHeight as terrainModel } from "../sim/physics";
import { useGame } from "../store";
import { C } from "../data/scienceConstants";
import { roverView } from "../sim/controls";
import { LanderModel, Rover } from "./Models";
import { Spacecraft } from "./Spacecraft";
import { Planet } from "./Planet";
import { Stars } from "@react-three/drei";
const terrainHeight = (x: number, z: number) =>
  terrainModel(x, z, engine.data.destination);
import { makeSurfaceTextures } from "./surfaceTextures";
function Terrain() {
  const texture = useMemo(
    () => makeSurfaceTextures(engine.data.destination === "moon"),
    [],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(300, 300, 110, 110);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position,
      colors = [];
    const color = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        h = terrainHeight(x, z);
      p.setY(i, h);
      color.setHSL(
        engine.data.destination === "moon"
          ? 0.09
          : 0.065 + Math.sin(x * 0.03 + z * 0.04) * 0.012,
        engine.data.destination === "moon" ? 0.015 : 0.14,
        0.68 + h * 0.018 + Math.sin(x * 0.06 + z * 0.09) * 0.035,
      );
      colors.push(color.r, color.g, color.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        map={texture.color}
        bumpMap={texture.bump}
        bumpScale={0.035}
        roughness={1}
      />
    </mesh>
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
        engine.data.destination === "moon" ? 0.015 : 0.18,
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
function Mountains() {
  const mountains = useMemo(() => {
    const rand = seeded(901);
    return Array.from({ length: 28 }, (_, i) => ({
      angle: (i / 28) * Math.PI * 2,
      h: 12 + rand() * 22,
      radius: 165 + rand() * 35,
      width: 25 + rand() * 30,
    }));
  }, []);
  return (
    <group>
      {mountains.map((m, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(m.angle) * m.radius,
            -m.h * 0.05,
            Math.sin(m.angle) * m.radius,
          ]}
          scale={[m.width, m.h * 0.75, m.width * 0.65]}
          rotation={[0, i, 0]}
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial
            color={
              engine.data.destination === "moon"
                ? i % 2
                  ? "#686b70"
                  : "#85878b"
                : i % 2
                  ? "#795443"
                  : "#916c54"
            }
            flatShading
            roughness={1}
          />
        </mesh>
      ))}
    </group>
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
    const active = engine.data.destination === "mars" && speed > 0.08;
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
export default function World() {
  const destination = useGame((s) => s.data.destination);
  const gravity = destination === "moon" ? C.moonGravity : C.marsGravity;
  const stage = useGame((s) => s.data.stage),
    settings = useGame((s) => s.settings),
    design = useGame((s) => s.data.design),
    observations = useGame((s) => s.data.observations);
  const predicted = useRef<THREE.Mesh>(null),
    rover = useRef<THREE.Group>(null),
    lander = useRef<THREE.Group>(null),
    cameraTarget = useRef(new THREE.Vector3()),
    orbit = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 8, 15);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = stage === "landing" ? 60 : 45;
      camera.updateProjectionMatrix();
    }
  }, [camera, stage]);
  useFrame((_, dt) => {
    const d = engine.data,
      r = d.rover,
      l = d.lander;
    if (sun.current && stage === "surface") {
      lightTarget.position.set(r.x, terrainHeight(r.x, r.z), r.z);
      sun.current.position.set(
        r.x - 70,
        terrainHeight(r.x, r.z) + 40,
        r.z - 45,
      );
      lightTarget.updateMatrixWorld();
    }
    if (rover.current) {
      rover.current.position.set(r.x, terrainHeight(r.x, r.z), r.z);
      const view = roverView(r.heading);
      const pitch = Math.atan(
        (terrainHeight(r.x + view.forwardX, r.z + view.forwardZ) -
          terrainHeight(r.x - view.forwardX, r.z - view.forwardZ)) /
          2,
      );
      const rightX = Math.cos(r.heading),
        rightZ = Math.sin(r.heading);
      const roll = Math.atan(
        (terrainHeight(r.x + rightX, r.z + rightZ) -
          terrainHeight(r.x - rightX, r.z - rightZ)) /
          2,
      );
      rover.current.rotation.set(pitch, view.modelYaw, roll, "YXZ");
    }
    if (lander.current) {
      lander.current.position.set(l.x, l.y, l.z);
      lander.current.rotation.z = -l.roll;
      lander.current.rotation.x = l.pitch;
      lander.current.rotation.y = l.yaw;
    }

    if (predicted.current) {
      const impactTime =
        (l.vy + Math.sqrt(l.vy * l.vy + 2 * gravity * Math.max(0, l.y))) /
        gravity;
      const px = clamp(l.x + l.vx * impactTime, -145, 145),
        pz = clamp(l.z + l.vz * impactTime, -145, 145);
      predicted.current.position.set(px, terrainHeight(px, pz) + 0.1, pz);
    }
    if (stage === "landing") {
      const h = Math.max(0, l.y - terrainHeight(l.x, l.z));
      const zoom = settings.flightZoom || 1;
      const moonLanding = destination === "moon";
      const pos = new THREE.Vector3(
        l.x +
          (moonLanding
            ? 145
            : settings.flightCamera === "overview"
              ? 100
            : Math.min(45, h * 0.08 + 16)) *
            zoom,
        l.y +
          (moonLanding
            ? 105
            : settings.flightCamera === "overview"
              ? 80
            : Math.min(70, h * 0.15 + 9)) *
            zoom,
        l.z +
          (moonLanding
            ? 175
            : settings.flightCamera === "overview"
              ? 120
            : Math.max(26, h * 0.42)) *
            zoom,
      );
      if (settings.flightCamera === "cinematic") {
        const angle = d.stageTime * 0.022;
        const dx = pos.x - l.x,
          dz = pos.z - l.z;
        pos.x = l.x + dx * Math.cos(angle) - dz * Math.sin(angle);
        pos.z = l.z + dx * Math.sin(angle) + dz * Math.cos(angle);
      }
      camera.position.lerp(pos, 1 - Math.exp(-dt * 3));
      cameraTarget.current.set(
        l.x,
        moonLanding ? terrainHeight(l.x, l.z) : l.y - 0.35,
        l.z,
      );
      camera.lookAt(cameraTarget.current);
    } else if (destination === "moon" && settings.camera !== "orbit") {
      const zoom = settings.flightZoom || 1;
      const view = roverView(r.heading);
      const pos = new THREE.Vector3(
        r.x + view.cameraX * zoom,
        terrainHeight(r.x, r.z) + 5 * zoom,
        r.z + view.cameraZ * zoom,
      );
      if (settings.flightCamera === "cinematic")
        pos.set(
          r.x + Math.sin(d.stageTime * 0.035 + 0.65) * 13 * zoom,
          terrainHeight(r.x, r.z) + 6 * zoom,
          r.z + Math.cos(d.stageTime * 0.035 + 0.65) * 13 * zoom,
        );
      if (settings.flightCamera === "overview")
        pos.set(
          r.x + 23 * zoom,
          terrainHeight(r.x, r.z) + 19 * zoom,
          r.z + 27 * zoom,
        );
      if (settings.camera === "map")
        pos.set(r.x, terrainHeight(r.x, r.z) + 65 * zoom, r.z + 0.1);
      camera.position.lerp(
        pos,
        settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 3),
      );
      camera.lookAt(r.x, terrainHeight(r.x, r.z) + 1, r.z);
    } else if (settings.camera !== "orbit") {
      const h = terrainHeight(r.x, r.z);
      const view = roverView(r.heading);
      const zoom = settings.flightZoom || 1;
      const target =
        settings.camera === "map"
          ? new THREE.Vector3(r.x, h + 65 * zoom, r.z + 0.1)
          : new THREE.Vector3(r.x + view.cameraX * zoom, h + 4.2 * zoom, r.z + view.cameraZ * zoom);
      camera.position.lerp(
        target,
        settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 3),
      );
      cameraTarget.current.set(r.x + view.lookX, h + 1, r.z + view.lookZ);
      camera.lookAt(cameraTarget.current);
    } else if (orbit.current) {
      // Follow the rover without snapping an orbit camera back every HUD refresh.
      cameraTarget.current.set(r.x, terrainHeight(r.x, r.z) + 1, r.z);
      const delta = cameraTarget.current.clone().sub(orbit.current.target);
      camera.position.add(delta);
      orbit.current.target.copy(cameraTarget.current);
      orbit.current.update();
    }
  });
  return (
    <>
      <color
        attach="background"
        args={[destination === "moon" ? "#02050a" : "#bba18b"]}
      />
      {destination !== "moon" && (
        <fog
          attach="fog"
          args={[
            "#bba18b",
            stage === "landing" ? 350 : 60,
            stage === "landing" ? 1600 : 245,
          ]}
        />
      )}
      <ambientLight
        intensity={destination === "moon" ? 0.08 : 0.28}
        color={destination === "moon" ? "#dbe0e7" : "#e4c9b3"}
      />
      <hemisphereLight
        args={[
          destination === "moon" ? "#cdd4dd" : "#d8c9b9",
          destination === "moon" ? "#080a0d" : "#554134",
          destination === "moon" ? 0.16 : 0.85,
        ]}
      />
      <primitive object={lightTarget} />
      <directionalLight
        ref={sun}
        target={lightTarget}
        position={[-70, 40, -45]}
        intensity={2.6}
        color="#fff0dc"
        castShadow={settings.quality !== "low"}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.001}
      />
      {destination === "moon" ? (
        <>
          <Stars
            radius={500}
            depth={200}
            count={700}
            factor={1.5}
            fade
            speed={0}
          />
          <group position={[80, 60, -180]}>
            <Planet kind="earth" radius={4} spin={false} />
          </group>
        </>
      ) : (
        <MarsSky />
      )}
      <Terrain />
      {stage === "surface" && <RoverTracks />}
      {stage === "surface" && <RoverDust />}
      <Rocks />
      <Mountains />
      {settings.quality !== "low" && destination === "mars" && <Dust />}
      <group position={[0, 0.025, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[6, 48]} />
          <meshStandardMaterial color="#54524a" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[5.5, 5.65, 48]} />
          <meshBasicMaterial color="#d4bb8f" />
        </mesh>
        {[-1, 1].map((n) => (
          <mesh key={n} position={[n * 2, 0.05, 0]}>
            <boxGeometry args={[0.12, 0.03, 4]} />
            <meshBasicMaterial color="#bdba9c" />
          </mesh>
        ))}
      </group>
      {destination === "mars" &&
        engine.targets().map((t, i) => (
          <group key={t.id} position={[t.x, terrainHeight(t.x, t.z), t.z]}>
            {Array.from({ length: i === 1 ? 5 : 3 }, (_, j) => (
              <mesh
                key={j}
                position={[(j - 1) * 1.2, 0.8 + j * 0.35, (j % 2) * 0.7]}
                rotation={[0.1 * j, 0.7 * j, 0.06 * j]}
                castShadow
              >
                <dodecahedronGeometry args={[1.2 + j * 0.15, 0]} />
                <meshStandardMaterial
                  color={i === 2 ? "#c5aa82" : i === 1 ? "#916e57" : "#51443d"}
                  roughness={0.9}
                  flatShading
                />
              </mesh>
            ))}
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[4.6, 4.75, 48]} />
              <meshBasicMaterial
                color={observations.includes(t.id) ? "#a7cdab" : "#f9c389"}
                transparent
                opacity={0.7}
              />
            </mesh>
            <Html
              position={[0, 4.5, 0]}
              center
              distanceFactor={30}
              style={{ pointerEvents: "none" }}
            >
              <div className="target-label">
                <b>{t.id}</b>
                <span>{t.name}</span>
                <small>
                  {observations.includes(t.id)
                    ? "OBSERVATION STORED"
                    : `${t.instrument.toUpperCase()} SITE`}
                </small>
              </div>
            </Html>
          </group>
        ))}
      {stage === "landing" ? (
        <>
          <group ref={lander}>
            <group position={[0, 0.6, 0]}>
              <Spacecraft design={design} separated />
            </group>
            <LanderFlame />
          </group>
          <mesh
            ref={predicted}
            position={[0, 0.08, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[2.4, 2.6, 32]} />
            <meshBasicMaterial color="#8ae0df" />
          </mesh>
        </>
      ) : (
        <>
          {destination === "moon" ? (
            <>
              <group position={[engine.data.lander.x, terrainHeight(engine.data.lander.x, engine.data.lander.z) + 1.4, engine.data.lander.z]}>
                <Spacecraft design={design} separated />
              </group>
              <group ref={rover}><Rover design={design} moving /></group>
            </>
          ) : (
            <group ref={rover}>
              <Rover design={design} moving />
            </group>
          )}
          <group
            position={[
              engine.data.lander.x,
              terrainHeight(engine.data.lander.x, engine.data.lander.z) + 0.7,
              engine.data.lander.z,
            ]}
          >
            <mesh>
              <cylinderGeometry args={[1.4, 1.7, 0.5, 8]} />
              <meshStandardMaterial
                color="#a38755"
                metalness={0.6}
                roughness={0.5}
              />
            </mesh>
          </group>
        </>
      )}
      {(destination === "mars" || destination === "moon") &&
        settings.camera === "orbit" &&
        stage !== "landing" && (
          <OrbitControls
            ref={orbit}
            target={[
              engine.data.rover.x,
              terrainHeight(engine.data.rover.x, engine.data.rover.z) + 1,
              engine.data.rover.z,
            ]}
            minDistance={4}
            maxDistance={50}
            maxPolarAngle={Math.PI * 0.48}
            enablePan={false}
          />
        )}
    </>
  );
}

function MarsSky() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} renderOrder={-10}>
      <sphereGeometry args={[950, 24, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{
          zenith: { value: new THREE.Color("#8b7668") },
          horizon: { value: new THREE.Color("#c7ad91") },
        }}
        vertexShader={
          "varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
        }
        fragmentShader={
          "uniform vec3 zenith;uniform vec3 horizon;varying vec3 direction;void main(){vec3 d=normalize(direction);float t=smoothstep(-0.08,0.8,d.y);vec3 c=mix(horizon,zenith,t);float glow=pow(max(0.0,dot(d,normalize(vec3(-.7,.4,-.45)))),32.0);gl_FragColor=vec4(pow(c+vec3(.18,.13,.08)*glow,vec3(1.0/2.2)),1.0);}"
        }
      />
    </mesh>
  );
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
