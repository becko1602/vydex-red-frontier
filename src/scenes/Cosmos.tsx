import { useRef, useMemo, useEffect, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Line, Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Planet } from "./Planet";
import { Asteroid } from "./Asteroid";
import { Spacecraft } from "./Spacecraft";
import { LaunchVehicle, rocketLayout, ROCKET_VISUAL_SCALE } from "./Rocket";
import { engine, transfer } from "../sim/game";
import { useGame } from "../store";
import { rigCamera } from "../cameraRig";
import { planetPositions, transferPosition, clamp, launchAscent, masses } from "../sim/physics";
import { payloadEnvelope } from "../sim/payload";
import { launchFraction, launchDuration } from "../sim/journey";
import { launchers } from "../data/launchVehicles";
import { solarSystem } from "../data/solarSystem";
import SolarTransfer from "./SolarTransfer";
import { Member, LatticeTower } from "./Structures";
import { LaunchEnvironment, PadInfrastructure, ExhaustPlume, LaunchClouds, Deluge, VaporCone, LAUNCH_UNITS_PER_M } from "./LaunchSite";
import {
  heliocentricBodyIds,
  heliocentricPosition,
  type HeliocentricBodyId,
} from "../sim/heliocentric";
function SceneLabel({
  children,
  position,
  color = "#d7e8eb",
  fontSize = 0.18,
}: {
  children: ReactNode;
  position: [number, number, number];
  color?: string;
  fontSize?: number;
}) {
  return (
    <Text
      position={position}
      color={color}
      fontSize={fontSize}
      anchorX="center"
      anchorY="middle"
      depthOffset={-1}
    >
      {children}
    </Text>
  );
}
function OrbitDirectionArrow({
  radius,
  angle,
  color,
  scale = 1,
}: {
  radius: number;
  angle: number;
  color: string;
  scale?: number;
}) {
  return (
    <group
      position={[radius * Math.cos(angle), 0.02, radius * Math.sin(angle)]}
      rotation={[0, angle + Math.PI / 2, 0]}
      scale={scale}
    >
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.12, 0.42, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
/** A swing arm: steel truss from the tower face to the vehicle, rotating horizontally to retract. */
function SwingArm({ length, crew = false }: { length: number; crew?: boolean }) {
  const L = length, H = 0.5;
  const nDiag = Math.max(2, Math.round(L / 0.6)), diag = Array.from({ length: nDiag }, (_, k) => (k / nDiag) * L);
  return (
    <group>
      {[-0.3, 0.3].map((z) => (
        <group key={z}>
          <Member a={[0, 0, z]} b={[L, 0, z]} r={0.05} color="#8f9a9c" />
          <Member a={[0, H, z]} b={[L, H, z]} r={0.05} color="#8f9a9c" />
          {diag.map((x, k) => <Member key={k} a={[x, k % 2 ? 0 : H, z]} b={[x + L / diag.length, k % 2 ? H : 0, z]} r={0.025} color="#a7b0b2" />)}
        </group>
      ))}
      {crew ? (
        <>
          {/* Enclosed crew/servicing walkway and white room at the vehicle */}
          <mesh position={[L / 2, H / 2 + 0.05, 0]}>
            <boxGeometry args={[L, H + 0.1, 0.7]} />
            <meshStandardMaterial color="#dfe1dc" roughness={0.6} transparent opacity={0.92} />
          </mesh>
          <mesh position={[L - 0.35, H / 2 + 0.1, 0]}>
            <boxGeometry args={[0.7, H + 0.35, 1.0]} />
            <meshStandardMaterial color="#f2f2ee" roughness={0.5} />
          </mesh>
        </>
      ) : (
        <>
          {/* Umbilical carrier plate + hoses */}
          <mesh position={[L - 0.08, H / 2, 0]}>
            <boxGeometry args={[0.12, 0.55, 0.6]} />
            <meshStandardMaterial color="#c58444" metalness={0.5} roughness={0.45} />
          </mesh>
          {[-0.12, 0.12].map((z) => (
            <mesh key={z} position={[L / 2, -0.12, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.05, 0.05, L, 8]} />
              <meshStandardMaterial color="#d8d8d0" roughness={0.6} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}
function LaunchComplex({ height, active, liftoff, radius = 0.55 }: { height: number; active: boolean; liftoff: boolean; radius?: number }) {
  const arms = useRef<(THREE.Group | null)[]>([]), clamps = useRef<(THREE.Group | null)[]>([]);
  const retract = useRef(0), release = useRef(0);
  const towerX = -(radius * 2.3 + 2.4), face = towerX + 1.1;
  const armLevels = [0.32, 0.55, 0.74, 0.88].map((f) => height * f);
  useFrame((_, dt) => {
    // Arms swing away staggered (lower first), like real T-minus sequencing.
    retract.current = THREE.MathUtils.damp(retract.current, active ? 1 : 0, 0.9, Math.min(dt, .1));
    release.current = THREE.MathUtils.damp(release.current, liftoff ? 1 : 0, 6, Math.min(dt, .1));
    arms.current.forEach((g, i) => {
      if (!g) return;
      const k = THREE.MathUtils.clamp(retract.current * 1.6 - i * 0.18, 0, 1);
      g.rotation.y = (i % 2 ? -1 : 1) * k * (Math.PI / 2) * 0.95;
    });
    clamps.current.forEach((g) => { if (g) g.rotation.z = release.current * 0.9; });
  });
  const concrete = <meshStandardMaterial color="#8a8c87" metalness={.05} roughness={.95} />;
  const holdDowns = [0, 1, 2, 3].map((i) => i * Math.PI / 2 + Math.PI / 4);
  return <group>
    {/* Hardstand and flame trench (runs along Z) */}
    <mesh position={[0,-1.5,0]} receiveShadow><boxGeometry args={[40,1.2,46]}/>{concrete}</mesh>
    <mesh position={[0,-1.29,0]}><boxGeometry args={[3.4,0.8,30]}/><meshStandardMaterial color="#1b2022" roughness={.9}/></mesh>
    {/* Flame deflector wedge in the trench */}
    <mesh position={[0,-1.6,0]} rotation={[Math.PI/4,0,0]}><boxGeometry args={[3.2,1.2,1.2]}/><meshStandardMaterial color="#5b5d58" metalness={.4} roughness={.7}/></mesh>
    {/* Mobile launcher deck with exhaust hole */}
    {[[0, 2.7, 9, 2.6], [0, -2.7, 9, 2.6], [3.1, 0, 2.8, 2.8], [-3.1, 0, 2.8, 2.8]].map(([x, z, w, d], k) => (
      <mesh key={k} position={[x, -0.5, z]} castShadow receiveShadow><boxGeometry args={[w, 1, d]}/><meshStandardMaterial color="#3d4144" metalness={.45} roughness={.6}/></mesh>
    ))}
    {[-1,1].flatMap(x=>[-1,1].map(z=><mesh key={`${x}${z}`} position={[x*3.8,-1.05,z*3.4]}><boxGeometry args={[0.8,0.6,0.8]}/><meshStandardMaterial color="#565a5c" metalness={.5} roughness={.5}/></mesh>))}
    {/* Hold-down posts with release jaws under the core and booster skirts */}
    {holdDowns.map((a, i) => (
      <group key={i} position={[Math.cos(a) * radius * 1.05, 0, Math.sin(a) * radius * 1.05]} rotation={[0, -a, 0]}>
        <mesh position={[0, 0.08, 0]}><boxGeometry args={[0.28, 0.16, 0.22]}/><meshStandardMaterial color="#c47b3f" metalness={.5} roughness={.45}/></mesh>
        <group ref={(n) => { clamps.current[i] = n; }} position={[0.12, 0.16, 0]}>
          <mesh position={[0.05, 0.08, 0]}><boxGeometry args={[0.08, 0.18, 0.18]}/><meshStandardMaterial color="#9ea29d" metalness={.75} roughness={.35}/></mesh>
        </group>
      </group>
    ))}
    {/* Fixed service structure: lattice tower with lightning mast */}
    <group position={[0, 0, 0]}>
      <LatticeTower x={towerX} height={height * 1.12} w={2.2} d={2.2} />
      {Array.from({ length: 7 }, (_, k) => (
        <mesh key={k} position={[towerX, (k + 1) * height * 1.12 / 7, 0]} receiveShadow>
          <boxGeometry args={[2.3, 0.06, 2.3]} />
          <meshStandardMaterial color="#6c7477" metalness={.5} roughness={.6} />
        </mesh>
      ))}
      <mesh position={[towerX, height * 1.12 + 2.2, 0]}><cylinderGeometry args={[0.04, 0.09, 4.4, 8]}/><meshStandardMaterial color="#cfd2cf" metalness={.6} roughness={.4}/></mesh>
      {/* Elevator shaft */}
      <mesh position={[towerX - 0.6, height * 0.56, 0.6]}><boxGeometry args={[0.6, height * 1.12, 0.6]}/><meshStandardMaterial color="#b9bdb9" metalness={.3} roughness={.6} transparent opacity={.85}/></mesh>
    </group>
    {/* Swing arms: pivot at the tower face, rotate horizontally to stow along the tower */}
    {armLevels.map((y, i) => (
      <group key={i} ref={(n) => { arms.current[i] = n; }} position={[face, y, 0]}>
        <SwingArm length={-face - radius * (i === 3 ? 0.95 : 1.02)} crew={i === 2} />
      </group>
    ))}
    {/* Tail service masts at the base */}
    {[-1, 1].map((side) => (
      <group key={side} position={[side * 1.3, 0, -radius * 2.4]}>
        <LatticeTower x={0} height={1.6} w={0.5} d={0.5} />
        <mesh position={[0, 1.55, 0.3]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.55, 0.35, 0.5]}/><meshStandardMaterial color="#d7d8d3" metalness={.4} roughness={.5}/></mesh>
      </group>
    ))}
  </group>;
}
function LaunchSmoke({ active }: { active: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const count = 96;
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    mesh.current.visible = active;
    if (!active) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const age = (t * .32 + i / count) % 1;
      const angle = i * 2.399963;
      const spread = .8 + age * 10;
      dummy.position.set(Math.cos(angle) * spread + age * 1.6, .18 + age * (1.6 + (i % 7) * .1), Math.sin(angle) * spread);
      const size = .18 + age * (1.35 + (i % 5) * .14);
      dummy.scale.set(size * 1.25, size * .62, size);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(.09, .025, .39 + age * .19);
      mesh.current.setColorAt(i, color);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
    <sphereGeometry args={[1, 8, 6]} />
    <meshStandardMaterial color="#a39d8c" roughness={1} transparent opacity={.12} depthWrite={false} />
  </instancedMesh>;
}
function Launch() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings),
    paused = useGame((s) => s.paused);
  const carrier = useRef<THREE.Group>(null),
    payload = useRef<THREE.Group>(null),
    altitudeM = useRef(0),
    rocketPos = useRef(new THREE.Vector3());
  const { camera, scene } = useThree(),
    target = useMemo(() => new THREE.Vector3(), []),
    cam = useMemo(() => new THREE.Vector3(), []);
  const p = launchFraction(d),
    reveal = clamp((p - 0.53) / 0.17, 0, 1),
    spread = clamp((p - 0.38) / 0.12, 0, 1),
    layout=rocketLayout(d.design.launcher??"titan"), envelope=payloadEnvelope(d.design),
    launcher= d.design.launcher??"titan",
    coreR = (launchers[d.design.launcher??"titan"].diameter / 2) * ROCKET_VISUAL_SCALE,
    sepStart = (d.design.launcher ?? "titan") === "titan" ? 0.49 : 0.38,
    jointY = rocketLayout(d.design.launcher ?? "titan").body * 0.64 * ROCKET_VISUAL_SCALE,
    ascent=launchAscent(launchers[launcher].ascentModel, masses(d.design).wet, Math.max(0,d.stageTime-launchDuration(d)*.12));
  useFrame((_, dt) => {
    const data = engine.data,
      progress = launchFraction(data),
      // Presentation altitude, time-compressed to match the staging cues:
      // Max-Q ≈ 11 km, booster separation ≈ 45 km, fairing jettison ≈ 110 km.
      visAlt = progress < .12 ? 0 : 205000 * Math.pow(clamp((progress - .12) / .58, 0, 1), 2.1),
      lift = Math.max(progress < .12 ? 0 : ascent.altitudeM * .014, visAlt * LAUNCH_UNITS_PER_M),
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
    altitudeM.current = Math.max(lift, target.y) / LAUNCH_UNITS_PER_M;
    if (carrier.current) rocketPos.current.copy(carrier.current.position);
    void scene;
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
    if (settings.flightCamera !== "overview") rigCamera(cam, target);
    camera.position.lerp(
      cam,
      settings.reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 4),
    );
    camera.lookAt(target);
  });
  return (
    <>
      <LaunchEnvironment altitudeM={altitudeM} />
      <PadInfrastructure rocketHeight={layout.height} />
      <LaunchComplex
        height={layout.height}
        active={d.launchChecks.every(Boolean) && p > 0.065}
        liftoff={p > 0.12}
        radius={coreR}
      />
      <Deluge active={() => !useGame.getState().paused && engine.data.launchChecks.every(Boolean) && launchFraction(engine.data) > 0.07 && launchFraction(engine.data) < 0.2} />
      <LaunchClouds
        active={() => !useGame.getState().paused && engine.data.launchChecks.every(Boolean) && launchFraction(engine.data) > 0.12 && launchFraction(engine.data) < 0.7}
        rocket={rocketPos}
        altitudeM={altitudeM}
      />
      <group ref={carrier}>
        <LaunchVehicle
          id={launcher}
          upperSeparation={clamp((p-(launcher==='titan'?0.49:0.38))/.13,0,1)}
          firing={false}
          fairingOpen={settings.payloadView ? 0.85 : reveal}
          separation={spread}
        />
        {/* Core-stage plume */}
        <group position={[0, -0.05, 0]}>
          <ExhaustPlume radius={coreR} altitudeM={altitudeM} throttle={() => { const q = launchFraction(engine.data); return engine.data.launchChecks.every(Boolean) && q > 0.115 && q < sepStart + 0.01 && !useGame.getState().paused ? 1 : 0; }} />
        </group>
        {/* Upper-stage vacuum engine after staging */}
        <group position={[0, jointY - 0.05, 0]}>
          <ExhaustPlume radius={coreR * 0.6} altitudeM={altitudeM} throttle={() => { const q = launchFraction(engine.data); return engine.data.launchChecks.every(Boolean) && q > sepStart + 0.03 && q < 0.7 && !useGame.getState().paused ? 0.8 : 0; }} />
        </group>
        {/* Solid rocket booster plumes until separation */}
        {launchers[launcher].boosters > 0 && [-1, 1].map((side) => (
          <group key={side} position={[side * coreR * 1.65, -0.05, 0]}>
            <ExhaustPlume solid radius={coreR * 0.44} altitudeM={altitudeM} throttle={() => { const q = launchFraction(engine.data); return engine.data.launchChecks.every(Boolean) && q > 0.12 && q < 0.38 && !useGame.getState().paused ? 1 : 0; }} />
          </group>
        ))}
        <group position={[0, layout.height * 0.62, 0]}>
          <VaporCone altitudeM={altitudeM} radius={coreR} />
        </group>
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
  const visualElapsed = d.cruiseProgress * transfer.time;
  const displayOrbitRadius: Record<HeliocentricBodyId, number> = {
    mercury: 3.2,
    venus: 5.3,
    earth: 6.1,
    mars: 8,
    jupiter: 13.5,
    saturn: 18.5,
    uranus: 24,
    neptune: 29,
  };
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
    if (settings.flightCamera === "overview") {
      const selected = settings.selectedPlanet;
      if (selected === "earth" || selected === "mars") {
        const selectedPoint =
          selected === "earth"
            ? planetPositions(f).earth
            : planetPositions(f).mars;
        target.set(selectedPoint.x * scale, 0, selectedPoint.z * scale);
      } else if (selected !== "sun" && selected !== "moon") {
        const selectedPoint = heliocentricPosition(
          selected as HeliocentricBodyId,
          visualElapsed,
        );
        const selectedRadius = displayOrbitRadius[selected as HeliocentricBodyId];
        target.set(
          selectedRadius * Math.cos(selectedPoint.angle),
          selectedRadius * Math.sin(selectedPoint.angle) * 0.06,
          selectedRadius * Math.sin(selectedPoint.angle),
        );
      } else {
        target.set(0, 0, 0);
      }
      camera.lookAt(target);
      return;
    }
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
          {settings.showLabels && (
            <SceneLabel
              position={[0, 1.8, 0]}
              color="#f0c77b"
              fontSize={0.2}
            >
              SUN · ORBITAL FOCUS
            </SceneLabel>
          )}
          <pointLight intensity={65} color="#ffd34f" distance={45} />
          {settings.showOrbits && (
            <>
              <Line
                points={orbit(transfer.r1 * scale)}
                color="#4b9ab0"
                lineWidth={1.2}
                rotation={[0.032, 0, 0]}
              />
              <Line
                points={orbit(transfer.r2 * scale)}
                color="#c66d4e"
                lineWidth={1.2}
                rotation={[0.032, 0, 0]}
              />
              <OrbitDirectionArrow
                radius={transfer.r1 * scale}
                angle={1.25}
                color="#78d2e0"
                scale={0.9}
              />
              <OrbitDirectionArrow
                radius={transfer.r2 * scale}
                angle={2.25}
                color="#f09a72"
              />
            </>
          )}
          {heliocentricBodyIds
            .filter((body) => body !== "earth" && body !== "mars")
            .map((body) => {
            const positionM = heliocentricPosition(body, visualElapsed);
            const displayRadius = displayOrbitRadius[body];
            const position = {
              x: displayRadius * Math.cos(positionM.angle),
              y: displayRadius * Math.sin(positionM.angle) * 0.06,
              z: displayRadius * Math.sin(positionM.angle),
            };
            const orbit = displayRadius;
            const radius =
              body === "jupiter"
                ? 1.15
                : body === "saturn"
                  ? 0.95
                  : body === "venus"
                    ? 0.7
                    : body === "mercury"
                      ? 0.42
                      : body === "uranus"
                        ? 0.72
                        : 0.68;
            return (
            <group
              key={body}
              position={[0, 0, 0]}
            >
              {settings.showOrbits && (
                <Line
                  points={previewOrbit(orbit)}
                  color="#314b59"
                  transparent
                  opacity={0.58}
                  rotation={[0.032, 0, 0]}
                />
              )}
              <group position={[position.x, position.y, position.z]}>
                <Planet kind={body} radius={radius} />
                {settings.showLabels && (
                  <SceneLabel position={[0, radius + 0.35, 0]}>
                    {solarSystem[body].name.toUpperCase()}
                  </SceneLabel>
                )}
              </group>
            </group>
            );
          })}
        </>
      ) : null}
      {settings.showTrajectory && (
        <Line
          points={path}
          color="#8ed5df"
          lineWidth={1.8}
          dashed
          dashSize={0.12}
          gapSize={0.08}
        />
      )}
      <group ref={earth}>
        <Planet kind="earth" radius={d.destination === "mars" ? 0.82 : 2.2} />
        {settings.showLabels && (
          <SceneLabel position={[0, d.destination === "mars" ? 1.15 : 2.7, 0]}>
            EARTH · DEPARTURE
          </SceneLabel>
        )}
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
          {settings.showLabels && (
            <SceneLabel
              position={[0, d.destination === "moon" ? 1.35 : 1.15, 0]}
            >
              {d.destination.toUpperCase()} · ARRIVAL
            </SceneLabel>
          )}
        </group>
      )}
      <group ref={ship}>
        <Spacecraft design={d.design} scale={0.065} stowed/>
        <mesh position={[0, 0, -0.22]}>
          <sphereGeometry args={[0.12, 12, 8]} />
          <meshBasicMaterial color="#f07845" />
        </mesh>
        {settings.showLabels && (
          <SceneLabel position={[0, 0.35, 0]}>
            VYDEX–01 · TRANSFER
          </SceneLabel>
        )}
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
        <SolarTransfer />
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
                radius={
                  destination === "mercury"
                    ? 2.4
                    : destination === "venus"
                      ? 3
                      : destination === "saturn"
                        ? 2.1
                        : destination === "uranus" || destination === "neptune"
                          ? 2.7
                          : 3.4
                }
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
