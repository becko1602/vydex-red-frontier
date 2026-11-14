import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import { engine } from "../sim/game";
import { useGame } from "../store";
import { Planet } from "./Planet";
import VehicleEffects from "./VehicleEffects";
import { Spacecraft } from "./Spacecraft";
import { Asteroid } from "./Asteroid";
import { earthOrbit } from "../sim/orbit";
export default function Orbital() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings),
    ship = useRef<THREE.Group>(null),
    earth = useRef<THREE.Group>(null),
    { camera } = useThree(),
    cam = useMemo(() => new THREE.Vector3(), []),
    target = useMemo(() => new THREE.Vector3(), []);
  const asteroid = d.destination === "asteroid";
  useEffect(() => {
    camera.position.set(14, 8, asteroid ? 50 : 18);
  }, [camera, asteroid]);
  useFrame((_, dt) => {
    const data = engine.data,
      o = data.orbital,
      z = settings.flightZoom || 1;
    if (ship.current) {
      ship.current.position.set(
        asteroid ? o.x : 0,
        asteroid ? o.y : 0,
        asteroid ? o.z : 0,
      );
      ship.current.rotation.set(o.pitch, o.yaw, o.roll, "YXZ");
    }
    target.set(asteroid ? o.x : 0, asteroid ? o.y : 0, asteroid ? o.z : 0);
    if (settings.flightCamera === "overview")
      cam.set(asteroid ? 30 * z : 20 * z, 20 * z, asteroid ? 52 * z : 25 * z);
    else if (settings.flightCamera === "follow")
      cam.set(target.x + 6 * z, target.y + 4 * z, target.z + 9 * z);
    else
      cam.set(
        target.x + Math.sin(data.stageTime * 0.035 + 1) * 12 * z,
        target.y + 7 * z,
        target.z + 15 * z,
      );
    camera.position.lerp(
      cam,
      settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 3),
    );
    camera.lookAt(
      settings.flightCamera === "overview"
        ? new THREE.Vector3(0, 0, asteroid ? 10 : 0)
        : target,
    );
    if (earth.current && !asteroid)
      earth.current.rotation.z =
        -data.stageTime * 30 * ((2 * Math.PI) / earthOrbit().period);
  });
  return (
    <>
      <color attach="background" args={["#030811"]} />
      <Stars radius={350} depth={150} count={900} factor={2} fade speed={0} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[-25, 20, 30]}
        intensity={3}
        color="#fff1dd"
      />
      {asteroid ? (
        <>
          <Asteroid radius={8} />
          <group position={[-28, 18, -80]}>
            <Planet kind="earth" radius={0.03} />
          </group>
          <mesh position={[0, 0, 14]} rotation={[0, 0, 0]}>
            <ringGeometry args={[4.8, 5, 64]} />
            <meshBasicMaterial
              color="#8edacb"
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
            />
          </mesh>
          <Line
            points={[
              [0, 0, 10],
              [0, 0, 24],
            ]}
            color="#78bbce"
            dashed
            dashSize={0.4}
            gapSize={0.4}
          />
        </>
      ) : (
        <group ref={earth} position={[0, -18, -22]}>
          <Planet kind="earth" radius={19} spin={false} />
        </group>
      )}
      <group ref={ship}>
        <VehicleEffects/>
        <Spacecraft
          design={d.design}
          separated={!asteroid && d.orbital.deployed}
          solarDeployed={asteroid || d.orbital.deployed}
        />
      </group>
    </>
  );
}
