import { useRef, useLayoutEffect } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Design } from "../data/gameBalance";
import { parts, partIds, installed, type PartId } from "../data/workshop";
import { Rover } from "./Models";
import { useGame } from "../store";
function Material({
  color = "#deded5",
  ghost = false,
  metal = 0.35,
}: {
  color?: string;
  ghost?: boolean;
  metal?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={metal}
      roughness={0.48}
      transparent={ghost}
      opacity={ghost ? 0.22 : 1}
      depthWrite={!ghost}
    />
  );
}
export function PartGeometry({
  id,
  design,
  ghost = false,
  solarDeployed = true,
  stowed = false,
}: {
  id: PartId;
  design: Design;
  ghost?: boolean;
  solarDeployed?: boolean;
  stowed?: boolean;
}) {
  const mat = (color?: string, metal?: number) => (
    <Material color={color} metal={metal} ghost={ghost} />
  );
  if (id === "body")
    return (
      <group>
        <mesh castShadow>
          <cylinderGeometry args={[1.12, 1.12, 1.15, 8]} />
          {mat("#d5d9d8")}
        </mesh>
        <mesh position={[0, -0.32, 0]}>
          <cylinderGeometry args={[1.14, 1.14, 0.22, 8]} />
          {mat("#ae8e4b", 0.75)}
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * 1.04, 0.08, 0]}>
            <boxGeometry args={[0.04, 0.65, 1.1]} />
            {mat("#303d45")}
          </mesh>
        ))}
      </group>
    );
  if (id === "tank")
    return (
      <group>
        {[-1, 1].map((x) => (
          <group key={x} position={[x * 0.65, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.36, 0.65, 6, 16]} />
              {mat("#b29a5d", 0.75)}
            </mesh>
            {[-0.3, 0.3].map((z) => (
              <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.365, 0.025, 6, 16]} />
                {mat("#575f61", 0.7)}
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  if (id === "connector")
    return (
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.1, 10, 32]} />
        {mat("#a4adb0", 0.8)}
      </mesh>
    );
  if (id === "cruise")
    return (
      <group>
        <mesh>
          <cylinderGeometry args={[1.23, 1.23, 0.55, 12]} />
          {mat("#c0a663", 0.7)}
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * 0.65, 0.3, 0]}>
            <boxGeometry args={[0.35, 0.12, 0.8]} />
            {mat("#27353d")}
          </mesh>
        ))}
      </group>
    );
  if (id === "cruiseEngine" || id === "descentEngine")
    return (
      <group rotation={id==='cruiseEngine'?[Math.PI/2,0,0]:[0,0,0]}>
        <mesh>
          <cylinderGeometry args={[0.19, 0.42, 0.65, 24, 1, true]} />
          {mat("#535c62", 0.8)}
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.24, 12, 8]} />
          {mat("#8b9494", 0.7)}
        </mesh>
        <mesh position={[0, -0.33, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.035, 8, 24]} />
          {mat("#a6a6a0", 0.8)}
        </mesh>
      </group>
    );
  if (id === "legs")
    return (
      <group scale={stowed ? [0.62,0.6,0.62] : 1}>
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <group key={`${x}${z}`}>
              <mesh
                position={[x * 1.25, -0.35, z * 1.25]}
                rotation={[z * 0.48, 0, -x * 0.48]}
              >
                <cylinderGeometry args={[0.045, 0.07, 1.65, 8]} />
                {mat("#a9b3b4", 0.8)}
              </mesh>
              <mesh position={[x * 1.66, -1, z * 1.66]}>
                <cylinderGeometry args={[0.25, 0.3, 0.09, 16]} />
                {mat("#454847")}
              </mesh>
            </group>
          )),
        )}
      </group>
    );
  if (id === "rover")
    return (
      <Rover
        design={{
          ...design,
          solar: false,
          camera: false,
          antenna: false,
          battery: false,
          drill: false,
          spectrometer: false,
        }}
        scale={0.52}
      />
    );
  if (id === "solar") return <SolarWings open={solarDeployed} ghost={ghost} />;
  if (id === "antenna")
    return (
      <group rotation={[0.35, 0, -0.2]}>
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.6, 8]} />
          {mat("#68757b")}
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry
            args={[0.44, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42]}
          />
          <meshStandardMaterial
            color="#dedfd8"
            side={THREE.DoubleSide}
            transparent={ghost}
            opacity={ghost ? 0.22 : 1}
            metalness={0.5}
            roughness={0.5}
          />
        </mesh>
      </group>
    );
  if (id === "camera")
    return (
      <group>
        <mesh position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.04, 0.055, 0.8, 8]} />
          {mat("#63727a")}
        </mesh>
        <mesh>
          <boxGeometry args={[0.7, 0.24, 0.25]} />
          {mat()}
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
            {mat("#183346", 0.7)}
          </mesh>
        ))}
      </group>
    );
  if (id === "drill" || id === "sampler")
    return (
      <group rotation={[id === "drill" ? 0.2 : Math.PI / 2, 0, -0.2]}>
        <mesh position={[0, -0.05, -0.3]}>
          <boxGeometry args={[0.15, 0.15, 0.9]} />
          {mat("#e18550")}
        </mesh>
        <mesh position={[0, -0.25, -0.7]}>
          <cylinderGeometry args={[0.08, 0.035, 0.7, 12]} />
          {mat("#9aabae", 0.8)}
        </mesh>
      </group>
    );
  return (
    <group>
      <mesh>
        <boxGeometry
          args={
            id === "computer"
              ? [0.52, 0.35, 0.56]
              : id === "battery"
                ? [0.6, 0.34, 0.6]
                : [0.4, 0.5, 0.4]
          }
        />
        {mat(
          id === "spectrometer"
            ? "#80bac6"
            : id === "battery"
              ? "#415451"
              : "#283d4d",
        )}
      </mesh>
      <mesh position={[0, 0.19, 0]}>
        <boxGeometry args={[0.2, 0.025, 0.3]} />
        <meshStandardMaterial
          color="#83d2d4"
          emissive="#49b3bd"
          emissiveIntensity={0.22}
          transparent={ghost}
          opacity={ghost ? 0.2 : 1}
        />
      </mesh>
    </group>
  );
}
function Mount({
  id,
  design,
  exploded,
  selected,
  preview,
  separated,
  solarDeployed,
  stowed,
  labels,
  interactive,
}: {
  id: PartId;
  design: Design;
  exploded: boolean;
  selected: boolean;
  preview: boolean;
  separated: boolean;
  solarDeployed: boolean;
  stowed:boolean; labels:boolean; interactive:boolean;
}) {
  const ref = useRef<THREE.Group>(null),
    amount = useRef(0);
  const present =
    installed(design, id) &&
    !(separated && ["connector", "cruise", "cruiseEngine"].includes(id));
  const visible = present || preview;
  const p = parts[id];
  useFrame((_, dt) => {
    if (!ref.current) return;
    amount.current = THREE.MathUtils.damp(
      amount.current,
      visible ? 1 : 0,
      9,
      Math.min(dt, 0.1),
    );
    const s = amount.current;
    ref.current.visible = s > 0.008;
    ref.current.scale.setScalar(Math.max(0.001, s));
    const spread = exploded ? 1.65 : 1;
    ref.current.position.set(
      p.position[0] * spread,
      p.position[1] * spread + (1 - s) * 0.7,
      p.position[2] * spread,
    );
  });
  return (
    <group ref={ref} onClick={interactive ? e=>{e.stopPropagation();useGame.getState().setWorkshop({selected:id,message:p.purpose});} : undefined}>
      <PartGeometry
        id={id}
        design={design}
        ghost={!present}
        solarDeployed={solarDeployed}
        stowed={stowed}
      />
      {labels && present && <Html center distanceFactor={10} zIndexRange={[3,0]}><button className="component-label" onClick={()=>useGame.getState().setWorkshop({info:id,selected:id})}>{p.name} ⓘ</button></Html>}
      {selected && (
        <mesh>
          <boxGeometry args={p.size} />
          <meshBasicMaterial
            color="#8bd9e4"
            wireframe
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
    </group>
  );
}
export function Spacecraft({
  design,
  exploded = false,
  selected,
  preview = false,
  separated = false,
  scale = 1,
  solarDeployed = true,
  stowed = false, labels=false, interactive=false,
}: {
  design: Design;
  exploded?: boolean;
  selected?: PartId;
  preview?: boolean;
  separated?: boolean;
  scale?: number;
  solarDeployed?: boolean;
  stowed?: boolean; labels?:boolean; interactive?:boolean;
}) {
  return (
    <group scale={scale}>
      {partIds.map((id) => (
        <Mount
          key={id}
          id={id}
          design={design}
          exploded={exploded}
          selected={id === selected}
          preview={preview && id === selected && !installed(design, id)}
          separated={separated}
          solarDeployed={solarDeployed}
          stowed={stowed} labels={labels} interactive={interactive}
        />
      ))}
    </group>
  );
}

function SolarWings({ open, ghost }: { open: boolean; ghost: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]),
    phase = useRef(open ? 1 : 0);
  useLayoutEffect(() => {
    refs.current.forEach((ref, i) => {
      if (ref) ref.rotation.z = (i === 0 ? -1 : 1) * (1 - phase.current) * 1.4;
    });
  }, []);
  useFrame((_, dt) => {
    const ui = useGame.getState();
    if (ui.paused || ui.drawer || ui.workshop.info || ui.tutorial.hold) return;
    phase.current = THREE.MathUtils.damp(
      phase.current,
      open ? 1 : 0,
      4,
      Math.min(dt, 0.1),
    );
    refs.current.forEach((ref, i) => {
      if (ref) ref.rotation.z = (i === 0 ? -1 : 1) * (1 - phase.current) * 1.4;
    });
  });
  return (
    <group>
      {[-1, 1].map((side, i) => (
        <group
          key={side}
          ref={(node) => {
            refs.current[i] = node;
          }}
          position={[side * 1.12, 0, 0]}
        >
          <group position={[side * 0.58, 0, 0]}>
            <mesh>
              <boxGeometry args={[1.05, 0.045, 0.95]} />
              <Material color="#15394d" metal={0.65} ghost={ghost} />
            </mesh>
            {Array.from({ length: 6 }, (_, j) => (
              <mesh key={j} position={[0, 0.028, -0.42 + j * 0.168]}>
                <boxGeometry args={[1, 0.006, 0.008]} />
                <Material color="#91b7c5" ghost={ghost} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}
