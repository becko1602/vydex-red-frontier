import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Line, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Planet } from "./Planet";
import { Asteroid } from "./Asteroid";
import { Spacecraft } from "./Spacecraft";
import { LaunchVehicle, rocketLayout, ROCKET_VISUAL_SCALE } from "./Rocket";
import { engine, transfer } from "../sim/game";
import { useGame } from "../store";
import { planetPositions, transferPosition, clamp } from "../sim/physics";
import { payloadEnvelope } from "../sim/payload";
import { launchFraction } from "../sim/journey";
import { solarSystem } from "../data/solarSystem";
function LaunchPadSupports({ height, active }: { height: number; active: boolean }) {
  const ref = useRef<THREE.Group>(null),
    offset = useRef(0);
  useFrame((_, dt) => {
    offset.current = THREE.MathUtils.damp(
      offset.current,
      active ? 0 : 1,
      6,
      Math.min(dt, 0.1),
    );
    if (ref.current) ref.current.position.x = offset.current * 1.8;
  });
  const levels = [height * 0.3, height * 0.62];
  return (
    <group ref={ref}>
      {levels.flatMap((y) =>
        [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => (
          <group key={`${y}:${angle}`} rotation={[0, angle, 0]}>
            <mesh position={[2.35, y, 0]} castShadow>
              <boxGeometry args={[3.5, 0.2, 0.3]} />
              <meshStandardMaterial
                color="#7e8f91"
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0.78, y, 0]} castShadow>
              <boxGeometry args={[0.28, 0.72, 0.72]} />
              <meshStandardMaterial
                color="#263b43"
                metalness={0.8}
                roughness={0.34}
              />
            </mesh>
            <mesh position={[0.62, y, 0]}>
              <boxGeometry args={[0.12, 0.34, 0.56]} />
              <meshStandardMaterial
                color="#e2a35f"
                metalness={0.7}
                roughness={0.32}
              />
            </mesh>
            <mesh position={[4.08, y - 0.22, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.45, 12]} />
              <meshStandardMaterial
                color="#d3d9d7"
                metalness={0.9}
                roughness={0.25}
              />
            </mesh>
          </group>
        )),
      )}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}:${z}`} position={[x * 3.7, -0.02, z * 2.9]}>
            <boxGeometry args={[0.9, 0.18, 0.9]} />
            <meshStandardMaterial color="#d47d47" metalness={0.5} roughness={0.5} />
          </mesh>
        )),
      )}
    </group>
  );
}
function Launch() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings);
  const carrier = useRef<THREE.Group>(null),
    payload = useRef<THREE.Group>(null),
    spaceStars = useRef<THREE.Group>(null);
  const { camera, scene } = useThree(),
    target = useMemo(() => new THREE.Vector3(), []),
    cam = useMemo(() => new THREE.Vector3(), []);
  const p = launchFraction(d),
    reveal = clamp((p - 0.53) / 0.17, 0, 1),
    spread = clamp((p - 0.38) / 0.12, 0, 1),
    layout=rocketLayout(d.design.launcher??"titan"), envelope=payloadEnvelope(d.design);
  useFrame((_, dt) => {
    const data = engine.data,
      progress = launchFraction(data),
      lift = 70 * Math.pow(clamp((progress - 0.12) / 0.58, 0, 1), 2),
      angle = Math.max(0, progress - 0.7) * 0.8;
    target.set(Math.sin(angle) * 140, -60 + Math.cos(angle) * 140, 0);
    if (progress < 0.7) target.set(0, lift + layout.payloadY, 0);
    if (carrier.current) {
      carrier.current.position.set(
        0,
        lift - Math.max(0, progress - 0.7) * 110,
        0,
      );
      carrier.current.visible = progress < 0.86;
    }
    if (payload.current) {
      payload.current.position.copy(target);
      payload.current.scale.setScalar(
        ROCKET_VISUAL_SCALE + (1-ROCKET_VISUAL_SCALE) * clamp((progress - 0.7) / 0.16, 0, 1),
      );
      payload.current.rotation.y = Math.max(0,progress-.7)*.4;
    }
    if (spaceStars.current) spaceStars.current.visible = progress > 0.48;
    if (scene.background instanceof THREE.Color)
      scene.background
        .copy(new THREE.Color("#7895a5"))
        .lerp(new THREE.Color("#060d16"), clamp((progress - 0.25) / 0.5, 0, 1));
    const zoom = settings.flightZoom || 1;
    if (settings.flightCamera === "overview")
      cam.set(target.x + 34 * zoom, target.y + 20 * zoom, target.z + 42 * zoom);
    else if (settings.flightCamera === "follow")
      cam.set(target.x + 5 * zoom, target.y + 3 * zoom, target.z + 10 * zoom);
    else
      cam.set(
        target.x + Math.sin(data.stageTime * 0.04 + 1) * 17 * zoom,
        target.y + 7 * zoom,
        target.z + Math.cos(data.stageTime * 0.04 + 1) * 19 * zoom,
      );
    if (
      settings.cameraShake &&
      !settings.reducedMotion &&
      data.launchChecks.every(Boolean) &&
      progress > 0.12 &&
      progress < 0.65 &&
      !useGame.getState().paused &&
      !useGame.getState().tutorial.hold
    ) {
      cam.x += Math.sin(data.stageTime * 37) * 0.035;
      cam.y += Math.sin(data.stageTime * 43) * 0.03;
    }
    camera.position.lerp(
      cam,
      settings.reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 4),
    );
    camera.lookAt(target);
  });
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[-60, 70, 30]}
        intensity={3.4}
        color="#fff0d7"
      />
      <group ref={spaceStars}>
        <Stars radius={400} depth={200} count={850} factor={3} fade speed={0} />
      </group>
      <group position={[0, -60, 0]}>
        <Planet kind="earth" radius={55} spin={false} />
      </group>
      <mesh position={[0, -0.65, 0]} receiveShadow>
        <cylinderGeometry args={[12, 14, 1.2, 48]} />
        <meshStandardMaterial color="#697475" roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5, 5.18, 48]} />
        <meshBasicMaterial color="#bfd4d1" />
      </mesh>
      <LaunchPadSupports
        height={layout.height}
        active={!d.launchChecks.every(Boolean) || p < 0.12}
      />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 6, 7, -3]}>
          <mesh>
            <boxGeometry args={[0.35, 15, 0.35]} />
            <meshStandardMaterial
              color="#6c8189"
              metalness={0.65}
              roughness={0.5}
            />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-side * 1, i * 2 - 6, 0]}>
              <boxGeometry args={[2, 0.15, 0.15]} />
              <meshStandardMaterial color="#748b92" />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={carrier}>
        <LaunchVehicle
          id={d.design.launcher??"titan"}
          upperSeparation={clamp((p-(d.design.launcher==='titan'?0.49:0.38))/.13,0,1)}
          firing={d.launchChecks.every(Boolean) && p > 0.12 && p < 0.7}
          fairingOpen={settings.payloadView ? 0.85 : reveal}
          separation={spread}
        />
      </group>
      <group ref={payload}>
        <group position={[0,-envelope.centerY,0]}><Spacecraft design={d.design} solarDeployed={false} stowed /></group>
      </group>
    </>
  );
}
function Travel() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings),
    { camera } = useThree();
  const ship = useRef<THREE.Group>(null),
    earth = useRef<THREE.Group>(null),
    destination = useRef<THREE.Group>(null),
    target = useMemo(() => new THREE.Vector3(), []),
    cam = useMemo(() => new THREE.Vector3(), []),
    scale = 8 / transfer.r2;
  const previewPlanets = useMemo(
    () => [
      { kind: "mercury" as const, radius: 0.42, orbit: 3.2, phase: 0.6, inclination: 0.03 },
      { kind: "venus" as const, radius: 0.7, orbit: 5.3, phase: 1.8, inclination: 0.059 },
      { kind: "jupiter" as const, radius: 1.15, orbit: 13.5, phase: 2.5, inclination: 0.023 },
      { kind: "saturn" as const, radius: 0.95, orbit: 18.5, phase: 4.1, inclination: 0.044 },
      { kind: "uranus" as const, radius: 0.72, orbit: 24, phase: 5.1, inclination: 0.014 },
      { kind: "neptune" as const, radius: 0.68, orbit: 29, phase: 5.7, inclination: 0.031 },
    ],
    [],
  );
  const path = useMemo(
    () =>
      Array.from({ length: 121 }, (_, i) => {
        const f = i / 120;
        if (d.destination === "mars") {
          const p = transferPosition(f);
          return [p.x * scale, 0, p.z * scale] as [number, number, number];
        }
        if (d.destination === "earth")
          return [
            -4 + 3 * Math.cos(f * Math.PI * 2),
            0,
            3 * Math.sin(f * Math.PI * 2),
          ] as [number, number, number];
        return [-1 + 6.8 * f, 0, -4 * Math.sin(Math.PI * f)] as [
          number,
          number,
          number,
        ];
      }),
    [d.destination, scale],
  );
  const orbit = (r: number) =>
    Array.from(
      { length: 129 },
      (_, i) =>
        [
          r * Math.cos((i / 128) * Math.PI * 2),
          0,
          r * Math.sin((i / 128) * Math.PI * 2),
        ] as [number, number, number],
    );
  const previewOrbit = (r: number) =>
    Array.from(
      { length: 129 },
      (_, i) =>
        [
          r * Math.cos((i / 128) * Math.PI * 2),
          0,
          r * Math.sin((i / 128) * Math.PI * 2),
        ] as [number, number, number],
    );
  const inclinedPosition = (x: number, z: number, inclination: number) => ({
    x,
    y: Math.sin(inclination) * z,
    z: Math.cos(inclination) * z,
  });
  useEffect(() => {
    camera.position.set(0, 13, 15);
  }, [camera, d.destination]);
  useEffect(() => {
    if (settings.flightCamera === "overview")
      camera.position.set(
        0,
        13 * (settings.flightZoom || 1),
        15 * (settings.flightZoom || 1),
      );
  }, [camera, settings.flightCamera, settings.flightZoom]);
  useFrame((_, dt) => {
    const data = engine.data,
      f = data.cruiseProgress;
    if (data.destination === "mars") {
      const p = transferPosition(f),
        planets = planetPositions(f);
      const earthPoint = inclinedPosition(planets.earth.x * scale, planets.earth.z * scale, 0.032);
      const marsPoint = inclinedPosition(planets.mars.x * scale, planets.mars.z * scale, 0.032);
      target.set(
        p.x * scale,
        0,
        p.z * scale +
          1.28 * Math.max(0, 1 - f * 14) +
          0.65 * Math.max(0, (f - 0.95) * 20),
      );
      earth.current?.position.set(
        earthPoint.x,
        earthPoint.y,
        earthPoint.z,
      );
      destination.current?.position.set(
        marsPoint.x,
        marsPoint.y,
        marsPoint.z,
      );
    } else {
      earth.current?.position.set(-4, 0, 0);
      destination.current?.position.set(7, 0, 0);
      if (data.destination === "earth")
        target.set(
          -4 + 3 * Math.cos(f * Math.PI * 2),
          0,
          3 * Math.sin(f * Math.PI * 2),
        );
      else target.set(-1 + 6.8 * f, 0, -4 * Math.sin(Math.PI * f));
    }
    ship.current?.position.copy(target);
    if (ship.current) ship.current.rotation.y = 0.4 + f * Math.PI;
    if (settings.flightCamera === "overview") return;
    const z = settings.flightZoom || 1;
    if (settings.flightCamera === "follow")
      cam.set(target.x + 1.8 * z, target.y + 1.2 * z, target.z + 3.2 * z);
    else cam.set(target.x + 4 * z, target.y + 4 * z, target.z + 5.5 * z);
    camera.position.lerp(
      cam,
      settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 3),
    );
    camera.lookAt(target);
  });
  return (
    <>
      <Stars radius={180} depth={80} count={2200} factor={2.2} fade speed={0} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[-12, 7, 10]}
        intensity={2.7}
        color="#fff0da"
      />
      {d.destination === "mars" ? (
        <>
          <Planet kind="sun" radius={1.4} spin={false} />
          <pointLight intensity={65} color="#ffd34f" distance={45} />
          <Line points={orbit(transfer.r1 * scale)} color="#40646f" rotation={[0.032, 0, 0]} />
          <Line points={orbit(8)} color="#8d6554" rotation={[0.032, 0, 0]} />
          {previewPlanets.map((planet) => {
            const x = Math.cos(planet.phase) * planet.orbit;
            const z = Math.sin(planet.phase) * planet.orbit;
            const position = inclinedPosition(x, z, planet.inclination);
            return (
            <group
              key={planet.kind}
              position={[0, 0, 0]}
            >
              <Line
                points={previewOrbit(planet.orbit)}
                color="#314b59"
                transparent
                opacity={0.58}
                rotation={[planet.inclination, 0, 0]}
              />
              <group position={[position.x, position.y, position.z]}>
                <Planet kind={planet.kind} radius={planet.radius} />
                <Html position={[0, planet.radius + 0.35, 0]} center>
                  <span className="space-label">
                    {solarSystem[planet.kind].name.toUpperCase()}
                  </span>
                </Html>
              </group>
            </group>
            );
          })}
        </>
      ) : null}
      <Line
        points={path}
        color="#8ed5df"
        lineWidth={1.4}
        dashed
        dashSize={0.12}
        gapSize={0.08}
      />
      <group ref={earth}>
        <Planet kind="earth" radius={d.destination === "mars" ? 0.82 : 2.2} />
        <Html position={[0, d.destination === "mars" ? 1.15 : 2.7, 0]} center>
          <span className="space-label">EARTH</span>
        </Html>
      </group>
      {d.destination !== "earth" && (
        <group ref={destination}>
          {d.destination === "asteroid" ? (
            <Asteroid radius={0.8} />
          ) : (
            <Planet
              kind={d.destination === "moon" ? "moon" : "mars"}
              radius={d.destination === "moon" ? 0.9 : 0.76}
            />
          )}
          <Html position={[0, d.destination === "moon" ? 1.35 : 1.15, 0]} center>
            <span className="space-label">{d.destination.toUpperCase()}</span>
          </Html>
        </group>
      )}
      <group ref={ship}>
        <Spacecraft design={d.design} scale={0.065} stowed/>
        <Html position={[0, 0.35, 0]} center>
          <span className="space-label">VYDEX–01</span>
        </Html>
      </group>
      {settings.flightCamera === "overview" && (
        <OrbitControls
          target={[0, 0, 0]}
          minDistance={5}
          maxDistance={30}
          maxPolarAngle={Math.PI * 0.49}
        />
      )}
    </>
  );
}
export default function Cosmos() {
  const stage = useGame((s) => s.data.stage),
    destination = useGame((s) => s.data.destination),
    { camera } = useThree();
  useEffect(() => {
    if (stage === "briefing" || stage === "debrief") {
      camera.position.set(0, 1, 12);
      camera.lookAt(2.4, 0.2, 0);
    }
  }, [stage, destination, camera]);
  return (
    <>
      <color attach="background" args={["#01050b"]} />
      {stage === "launch" ? (
        <Launch />
      ) : stage === "cruise" ? (
        <Travel />
      ) : (
        <>
          <ambientLight intensity={0.12} />
          <directionalLight
            position={[-6, 3, 8]}
            intensity={1.35}
            color="#fff5e9"
          />
          <Stars
            radius={85}
            depth={35}
            count={1200}
            factor={2}
            fade
            speed={0}
          />
          <group position={[2.4, 0.2, 0]}>
            {destination === "asteroid" ? (
              <Asteroid radius={2.7} />
            ) : (
              <Planet
                kind={destination}
                radius={destination === "saturn" ? 2.1 : 3.4}
              />
            )}
          </group>
          <OrbitControls
            target={[2.4, 0.2, 0]}
            enablePan={false}
            minDistance={5}
            maxDistance={22}
          />
        </>
      )}
    </>
  );
}
