import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Cylinder, Text } from "@react-three/drei";
import * as THREE from "three";
import { engine } from "../sim/game";
import { useGame } from "../store";
import type { Design } from "../data/gameBalance";
const ivory = "#d9d6ca",
  dark = "#242a2e",
  orange = "#f06a32";
export function Rover({
  design,
  speed = 0,
  turn = 0,
  scale = 1,
  moving = false,
}: {
  design: Design;
  speed?: number;
  turn?: number;
  scale?: number;
  moving?: boolean;
}) {
  const wheels = useRef<THREE.Group>(null),cameraHead=useRef<THREE.Group>(null),drillTip=useRef<THREE.Mesh>(null),analyzer=useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const ui = useGame.getState();
    if (ui.paused || ui.drawer || ui.settings.inspection || ui.workshop.info || ui.rocketInfo || ui.tutorial.hold) return;
    const scan=engine.targets().find(t=>t.id===engine.data.scanId)?.instrument,animation=ui.settings.reducedMotion?0:1;
    if(cameraHead.current)cameraHead.current.rotation.y=scan==='camera'?Math.sin(engine.data.scanTime*.6)*.25*animation:0;
    if(drillTip.current){if(scan==='drill')drillTip.current.rotation.y+=Math.min(dt,.1)*9*animation;drillTip.current.position.y=scan==='drill'?-.3-Math.min(.22,engine.data.scanTime*.03)*animation:-.3;}
    if(analyzer.current)analyzer.current.rotation.x=scan==='spectrometer'?Math.sin(engine.data.scanTime)*.08*animation:0;
    wheels.current?.children.forEach((w) => {
      w.rotation.y =
        w.position.z < -0.5
          ? (moving ? engine.data.rover.steering : turn) * 0.35
          : 0;
      const tire = w.children[0];
      if (tire)
        tire.rotation.x +=
          ((moving
            ? engine.data.rover.speed +
              Math.sign(w.position.x) * engine.data.rover.steering * 1.25 * 1.04
            : speed) *
            Math.min(dt, 0.1)) /
          0.42;
    });
  });
  return (
    <group scale={scale}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1.65, 0.55, 2.3]} />
        <meshStandardMaterial color={ivory} roughness={0.57} metalness={0.35} />
      </mesh>
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[1.45, 0.12, 1.8]} />
        <meshStandardMaterial color={orange} metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.74, 0]}>
        <boxGeometry args={[0.9, 0.25, 1.7]} />
        <meshStandardMaterial color={dark} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          {[-0.8, 0, 0.8].map((z) => (
            <mesh
              key={z}
              position={[side * 0.82, 0.63, z]}
              rotation={[0, 0, side * 0.3]}
            >
              <boxGeometry args={[0.7, 0.1, 0.12]} />
              <meshStandardMaterial
                color="#9a9a94"
                metalness={0.8}
                roughness={0.4}
              />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={wheels}>
        {[-1, 1].flatMap((side) =>
          [-0.85, 0, 0.85].map((z) => (
            <group key={`${side}${z}`} position={[side * 1.04, 0.4, z]}>
              <group>
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                  <cylinderGeometry args={[0.42, 0.42, 0.32, 16]} />
                  <meshStandardMaterial color="#242326" roughness={0.85} />
                </mesh>
                {Array.from({ length: 10 }, (_, i) => (
                  <mesh
                    key={i}
                    position={[
                      0,
                      Math.cos((i * Math.PI) / 5) * 0.416,
                      Math.sin((i * Math.PI) / 5) * 0.416,
                    ]}
                    rotation={[(i * Math.PI) / 5, 0, 0]}
                  >
                    <boxGeometry args={[0.35, 0.035, 0.07]} />
                    <meshStandardMaterial color="#66605a" />
                  </mesh>
                ))}
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.18, 0.18, 0.34, 12]} />
                  <meshStandardMaterial
                    color="#9c9489"
                    metalness={0.7}
                    roughness={0.35}
                  />
                </mesh>
              </group>
            </group>
          )),
        )}
      </group>
      {design.solar &&
        [-1, 1].map((side) => (
          <group
            key={side}
            position={[side * 1.36, 1.35, 0.15]}
            rotation={[0, 0, side * -0.07]}
          >
            <mesh receiveShadow>
              <boxGeometry args={[1.1, 0.045, 1.9]} />
              <meshStandardMaterial
                color="#14384e"
                metalness={0.65}
                roughness={0.3}
              />
            </mesh>
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} position={[0, 0.028, -0.8 + i * 0.265]}>
                <boxGeometry args={[1.02, 0.008, 0.008]} />
                <meshStandardMaterial color="#79b5c5" />
              </mesh>
            ))}
            {[-0.35, 0, 0.35].map((x) => (
              <mesh key={x} position={[x, 0.028, 0]}>
                <boxGeometry args={[0.008, 0.008, 1.8]} />
                <meshStandardMaterial color="#79b5c5" />
              </mesh>
            ))}
          </group>
        ))}
      {design.camera && (
        <group ref={cameraHead} position={[0.25, 1.6, -0.65]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.045, 0.065, 1.1, 8]} />
            <meshStandardMaterial color={dark} />
          </mesh>
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[0.65, 0.24, 0.24]} />
            <meshStandardMaterial color={ivory} />
          </mesh>
          {[-0.2, 0.2].map((x) => (
            <mesh
              key={x}
              position={[x, 1.05, -0.13]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.085, 0.085, 0.06, 12]} />
              <meshStandardMaterial
                color="#1e3442"
                metalness={0.7}
                roughness={0.2}
              />
            </mesh>
          ))}
        </group>
      )}
      {design.antenna && (
        <group position={[-0.4, 1.5, 0.55]} rotation={[0.4, 0, 0.2]}>
          <Cylinder args={[0.035, 0.035, 0.8, 8]} position={[0, 0.3, 0]}>
            <meshStandardMaterial color={dark} />
          </Cylinder>
          <mesh position={[0, 0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry
              args={[0.4, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.4]}
            />
            <meshStandardMaterial
              side={THREE.DoubleSide}
              color={ivory}
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
        </group>
      )}
      {design.spectrometer && (
        <mesh ref={analyzer} position={[-0.6, 1.62, -0.48]}>
          <boxGeometry args={[0.35, 0.45, 0.5]} />
          <meshStandardMaterial
            color="#80bdc5"
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      )}
      {design.drill && (
        <group position={[0.65, 0.9, -1.1]} rotation={[0.2, 0, -0.3]}>
          <mesh position={[0.25, 0, -0.25]}>
            <boxGeometry args={[0.14, 0.14, 0.85]} />
            <meshStandardMaterial color={orange} />
          </mesh>
          <mesh ref={drillTip} position={[0.25, -0.3, -0.65]}>
            <cylinderGeometry args={[0.055, 0.02, 0.7, 8]} />
            <meshStandardMaterial
              color="#a5a3a1"
              metalness={0.8}
              roughness={0.25}
            />
          </mesh>
        </group>
      )}
      {design.battery && (
        <mesh position={[0, 1, 0.95]}>
          <boxGeometry args={[0.8, 0.35, 0.35]} />
          <meshStandardMaterial color="#434a43" />
        </mesh>
      )}
    </group>
  );
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
