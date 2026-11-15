import { useRef, useLayoutEffect, useMemo, useEffect } from "react";
import { hardwareTextures, bellProfile, dishProfile } from "./hardwareTextures";
import { engine } from "../sim/game";
import { Html, RoundedBox } from "@react-three/drei";
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
function useHw() {
  return useMemo(() => hardwareTextures(), []);
}
function Foil({ ghost, silver = false, repeat = 1 }: { ghost: boolean; silver?: boolean; repeat?: number }) {
  const hw = useHw();
  const map = useMemo(() => {
    const t = (silver ? hw.mliSilver : hw.mli).clone();
    t.repeat.set(repeat, repeat);
    t.needsUpdate = true;
    return t;
  }, [hw, silver, repeat]);
  return (
    <meshStandardMaterial
      map={map}
      color="#ffffff"
      metalness={0.92}
      roughness={0.32}
      transparent={ghost}
      opacity={ghost ? 0.22 : 1}
      depthWrite={!ghost}
    />
  );
}
/** RCS quad: four 22 N thrusters on a common block. */
function RcsQuad({ ghost }: { ghost: boolean }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <Material color="#b9bdb9" metal={0.7} ghost={ghost} />
      </mesh>
      {[
        [0.13, 0, 0, 0, 0, -Math.PI / 2],
        [-0.13, 0, 0, 0, 0, Math.PI / 2],
        [0, 0.13, 0, 0, 0, 0],
        [0, -0.13, 0, Math.PI, 0, 0],
      ].map(([x, y, z, rx, ry, rz], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[rx, ry, rz]}>
          <cylinderGeometry args={[0.022, 0.045, 0.1, 10, 1, true]} />
          <meshStandardMaterial color="#3a3d40" metalness={0.8} roughness={0.4} side={THREE.DoubleSide} transparent={ghost} opacity={ghost ? 0.22 : 1} />
        </mesh>
      ))}
    </group>
  );
}
function Nozzle({ throat, exit, length, ghost, color = "#2b2d30" }: { throat: number; exit: number; length: number; ghost: boolean; color?: string }) {
  const geo = useMemo(() => new THREE.LatheGeometry(bellProfile(throat, exit, length), 40), [throat, exit, length]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} metalness={0.85} roughness={0.38} side={THREE.DoubleSide} transparent={ghost} opacity={ghost ? 0.22 : 1} />
    </mesh>
  );
}
function Dish({ R, depth, ghost, color = "#eceee9" }: { R: number; depth: number; ghost: boolean; color?: string }) {
  const geo = useMemo(() => new THREE.LatheGeometry(dishProfile(R, depth), 56), [R, depth]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} metalness={0.25} roughness={0.55} side={THREE.DoubleSide} transparent={ghost} opacity={ghost ? 0.22 : 1} />
    </mesh>
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
  const hw = useHw();
  const mat = (color?: string, metal?: number) => (
    <Material color={color} metal={metal} ghost={ghost} />
  );
  if (id === "body")
    return (
      <group>
        {/* Aluminium honeycomb bus wrapped in gold Kapton MLI blankets */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.12, 1.16, 1.86]} />
          <Foil ghost={ghost} repeat={1.4} />
        </mesh>
        {/* White OSR radiator panels on the ±Z faces */}
        {[-1, 1].map((z) => (
          <mesh key={z} position={[0, 0.02, z * 0.935]}>
            <boxGeometry args={[1.7, 0.92, 0.02]} />
            <meshStandardMaterial map={hw.radiator} color="#ffffff" metalness={0.2} roughness={0.25} transparent={ghost} opacity={ghost ? 0.22 : 1} />
          </mesh>
        ))}
        {/* Top equipment deck and bottom launch-adapter ring */}
        <mesh position={[0, 0.59, 0]}>
          <boxGeometry args={[2.14, 0.035, 1.88]} />
          {mat("#c9ccc6", 0.6)}
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <boxGeometry args={[2.14, 0.05, 1.88]} />
          {mat("#9a9d98", 0.7)}
        </mesh>
        <mesh position={[0, -0.64, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.62, 0.035, 8, 40]} />
          {mat("#7d8380", 0.85)}
        </mesh>
        {/* Corner longerons */}
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
          <mesh key={`l${x}${z}`} position={[x * 1.06, 0, z * 0.93]}>
            <boxGeometry args={[0.05, 1.18, 0.05]} />
            {mat("#a8aca7", 0.8)}
          </mesh>
        )))}
        {/* Star trackers with sun baffles */}
        {[[-0.78, 0.7, -0.5], [0.78, 0.7, -0.5]].map(([x, y, z], i) => (
          <group key={`tracker-${i}`} position={[x, y, z]} rotation={[-0.5, i ? 0.4 : -0.4, 0]}>
            <mesh><boxGeometry args={[0.18, 0.14, 0.18]} />{mat("#2c3336", 0.7)}</mesh>
            <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.1, 0.06, 0.2, 18, 1, true]} /><meshStandardMaterial color="#1a1c1e" metalness={0.6} roughness={0.6} side={THREE.DoubleSide} transparent={ghost} opacity={ghost ? 0.22 : 1} /></mesh>
          </group>
        ))}
        {/* Sun sensors and low-gain antenna */}
        <group position={[0.75, 0.64, 0.6]}>
          <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.02, 0.03, 0.32, 8]} />{mat("#8c9691", 0.76)}</mesh>
          <mesh position={[0, 0.36, 0]}><coneGeometry args={[0.07, 0.12, 16]} />{mat("#e9ece6", 0.3)}</mesh>
        </group>
        {/* RCS thruster quads on the four lower corners */}
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
          <group key={`rcs${x}${z}`} position={[x * 1.12, -0.45, z * 0.98]}>
            <RcsQuad ghost={ghost} />
          </group>
        )))}
      </group>
    );
  if (id === "tank")
    return (
      <group>
        {/* Titanium propellant tanks (fuel / oxidizer), partly wrapped in MLI */}
        {[-1, 1].map((x) => (
          <group key={x} position={[x * 0.62, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.42, 32, 20]} />
              <meshStandardMaterial color="#b9bcbf" metalness={0.95} roughness={0.28} transparent={ghost} opacity={ghost ? 0.22 : 1} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.423, 0.018, 8, 40]} />
              {mat("#6f7472", 0.8)}
            </mesh>
            <mesh position={[0, 0.44, 0]}><cylinderGeometry args={[0.04, 0.04, 0.08, 10]} />{mat("#8a8f8c", 0.8)}</mesh>
          </group>
        ))}
        <mesh position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, 1.24, 6]} />
          {mat("#c8b37a", 0.8)}
        </mesh>
      </group>
    );
  if (id === "probe")
    return (
      <group>
        {/* 45° sphere-cone aeroshell with carbon-phenolic heat shield (Galileo-probe style) */}
        <mesh position={[0, -0.12, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.66, 0.42, 48, 1, true]} />
          <meshStandardMaterial color="#3b2a1f" roughness={0.9} metalness={0.1} side={THREE.DoubleSide} transparent={ghost} opacity={ghost ? 0.22 : 1} />
        </mesh>
        <mesh position={[0, -0.33, 0]}>
          <sphereGeometry args={[0.16, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#2c1f17" roughness={0.95} transparent={ghost} opacity={ghost ? 0.22 : 1} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.36, 0.64, 0.3, 48]} />
          <Foil ghost={ghost} silver repeat={0.8} />
        </mesh>
        <mesh position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.18, 0.36, 0.08, 32]} />
          {mat("#c0c4c2", 0.6)}
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.1, 20]} />
          {mat("#e46f2b", 0.2)}
        </mesh>
      </group>
    );
  if (id === "connector")
    return (
      <group>
        {/* Marman clamp-band separation ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.9, 0.07, 12, 48]} />
          {mat("#a4adb0", 0.85)}
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.95, 0.95, 0.12, 48, 1, true]} />
          <meshStandardMaterial color="#74797a" metalness={0.85} roughness={0.35} side={THREE.DoubleSide} transparent={ghost} opacity={ghost ? 0.22 : 1} />
        </mesh>
      </group>
    );
  if (id === "cruise")
    return (
      <group>
        {/* Cruise stage: aluminium ring frame, MLI, fixed body-mounted radiators */}
        <mesh>
          <cylinderGeometry args={[1.23, 1.23, 0.5, 32]} />
          <Foil ghost={ghost} silver repeat={1.6} />
        </mesh>
        <mesh position={[0, 0.27, 0]}>
          <cylinderGeometry args={[1.25, 1.25, 0.04, 32]} />
          {mat("#9ea29f", 0.75)}
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 1.24, 0, Math.sin((i / 8) * Math.PI * 2) * 1.24]} rotation={[0, -(i / 8) * Math.PI * 2, 0]}>
            <boxGeometry args={[0.02, 0.44, 0.34]} />
            <meshStandardMaterial map={hw.radiator} color="#fff" roughness={0.25} transparent={ghost} opacity={ghost ? 0.22 : 1} />
          </mesh>
        ))}
      </group>
    );
  if (id === "cruiseEngine" || id === "descentEngine")
    return (
      <group rotation={id === "cruiseEngine" ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
        {/* Bipropellant engine: valves + chamber + radiatively cooled niobium bell */}
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.16, 16]} />
          {mat("#9aa0a0", 0.8)}
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x * 0.12, 0.44, 0]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            {mat("#c2a85f", 0.75)}
          </mesh>
        ))}
        <Nozzle throat={0.075} exit={id === "cruiseEngine" ? 0.32 : 0.42} length={id === "cruiseEngine" ? 0.6 : 0.62} ghost={ghost} color={id === "cruiseEngine" ? "#3a3532" : "#2f3134"} />
        {id === "descentEngine" &&
          [0, 1, 2, 3].map((i) => (
            <group key={i} position={[Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.62, -0.05, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.62]}>
              <Nozzle throat={0.03} exit={0.12} length={0.24} ghost={ghost} />
            </group>
          ))}
      </group>
    );
  if (id === "legs")
    return (
      <group>
        {[0, 1, 2, 3].map((i) => {
          const a = i * Math.PI / 2 + Math.PI / 4,
            spread = stowed ? 0.25 : 1;
          return (
            <group key={i} rotation={[0, -a, 0]}>
              {/* Primary strut with crushable aluminium honeycomb shock absorber */}
              <group position={[1.08, 0.15, 0]} rotation={[0, 0, 0.62 * spread + 0.08]}>
                <mesh position={[0, -0.62, 0]}>
                  <cylinderGeometry args={[0.055, 0.055, 1.25, 12]} />
                  {mat("#c5c9c6", 0.8)}
                </mesh>
                <mesh position={[0, -1.15, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
                  {mat("#8c9391", 0.9)}
                </mesh>
                <group position={[0, -1.42, 0]} rotation={[0, 0, -(0.62 * spread + 0.08)]}>
                  <mesh>
                    <cylinderGeometry args={[0.24, 0.3, 0.07, 24]} />
                    {mat("#5c5f5b", 0.5)}
                  </mesh>
                  <mesh position={[0, -0.06, 0]}>
                    <cylinderGeometry args={[0.32, 0.28, 0.05, 24]} />
                    <Foil ghost={ghost} repeat={0.4} />
                  </mesh>
                </group>
              </group>
              {/* Secondary A-frame struts */}
              {[-1, 1].map((side) => (
                <mesh key={side} position={[1.2, -0.42, side * 0.22]} rotation={[side * 0.25, 0, 0.95 * spread]}>
                  <cylinderGeometry args={[0.022, 0.022, 0.95, 8]} />
                  {mat("#b2b7b3", 0.85)}
                </mesh>
              ))}
            </group>
          );
        })}
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
        folded
      />
    );
  if (id === "solar") return <SolarWings open={solarDeployed} ghost={ghost} />;
  if (id === "antenna")
    return (
      <group rotation={[0.35, 0, -0.2]}>
        {/* 2-axis gimbal, boom and 1.1 m Cassegrain high-gain antenna */}
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.6, 10]} />
          {mat("#9aa29f", 0.8)}
        </mesh>
        <mesh position={[0, -0.02, 0]}>
          <boxGeometry args={[0.16, 0.12, 0.16]} />
          {mat("#3a4144", 0.7)}
        </mesh>
        <group rotation={[-Math.PI / 2 + 0.2, 0, 0]} position={[0, 0.05, 0]}>
          <Dish R={0.56} depth={0.16} ghost={ghost} />
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
            {mat("#c6a85c", 0.8)}
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.cos(i * 2.094) * 0.2, 0.22, Math.sin(i * 2.094) * 0.2]} rotation={[Math.sin(i * 2.094) * 0.55, 0, -Math.cos(i * 2.094) * 0.55]}>
              <cylinderGeometry args={[0.008, 0.008, 0.46, 6]} />
              {mat("#d9d9d4", 0.5)}
            </mesh>
          ))}
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.07, 0.05, 0.06, 16]} />
            {mat("#e2e3dd", 0.4)}
          </mesh>
        </group>
      </group>
    );
  if (id === "camera")
    return (
      <group>
        {/* Push-broom survey telescope: baffled barrel on a bipod mount */}
        <mesh position={[0, -0.32, 0]}>
          <cylinderGeometry args={[0.035, 0.05, 0.7, 8]} />
          {mat("#8f9895", 0.8)}
        </mesh>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.17, 0.17, 0.62, 32]} />
            <Foil ghost={ghost} silver repeat={0.6} />
          </mesh>
          <mesh position={[0, -0.33, 0]}>
            <cylinderGeometry args={[0.2, 0.17, 0.06, 32, 1, true]} />
            <meshStandardMaterial color="#151719" metalness={0.5} roughness={0.7} side={THREE.DoubleSide} transparent={ghost} opacity={ghost ? 0.22 : 1} />
          </mesh>
          <mesh position={[0, -0.29, 0]}>
            <circleGeometry args={[0.15, 32]} />
            <meshStandardMaterial color="#0d2433" metalness={0.9} roughness={0.08} transparent={ghost} opacity={ghost ? 0.22 : 1} />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <boxGeometry args={[0.26, 0.1, 0.26]} />
            {mat("#33393b", 0.7)}
          </mesh>
        </group>
      </group>
    );
  if (id === "drill" || id === "sampler")
    return (
      <group rotation={[id === "drill" ? 0.2 : Math.PI / 2, 0, -0.2]}>
        {/* Articulated tool arm: shoulder, two booms, wrist and tool head */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.1, 16, 12]} />
          {mat("#4b5255", 0.75)}
        </mesh>
        <mesh position={[0, -0.02, -0.32]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.6, 12]} />
          {mat("#d8dbd6", 0.6)}
        </mesh>
        <mesh position={[0, -0.02, -0.64]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          {mat("#4b5255", 0.75)}
        </mesh>
        <mesh position={[0, -0.2, -0.72]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 12]} />
          {mat("#d8dbd6", 0.6)}
        </mesh>
        <mesh position={[0, -0.42, -0.8]}>
          <boxGeometry args={[0.16, 0.12, 0.16]} />
          {mat("#35393b", 0.7)}
        </mesh>
        <mesh position={[0, -0.56, -0.8]}>
          <cylinderGeometry args={[0.03, 0.012, 0.2, 10]} />
          {mat("#a7a9a4", 0.9)}
        </mesh>
      </group>
    );
  const boxSize = id === "computer" ? [0.52, 0.35, 0.56] : id === "battery" ? [0.6, 0.34, 0.6] : [0.4, 0.5, 0.4];
  return (
    <group>
      <RoundedBox args={boxSize as [number, number, number]} radius={0.03} smoothness={3}>
        {id === "spectrometer" ? <Foil ghost={ghost} silver repeat={0.5} /> : mat(id === "battery" ? "#3c4441" : "#2b3135", 0.6)}
      </RoundedBox>
      {/* Connector panel and harness */}
      <mesh position={[0, 0, boxSize[2] / 2 + 0.005]}>
        <planeGeometry args={[boxSize[0] * 0.7, boxSize[1] * 0.5]} />
        <meshStandardMaterial color="#8a8f8c" metalness={0.8} roughness={0.4} transparent={ghost} opacity={ghost ? 0.22 : 1} />
      </mesh>
      {[-1, 0, 1].map((k) => (
        <mesh key={k} position={[k * boxSize[0] * 0.22, -boxSize[1] * 0.05, boxSize[2] / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.03, 12]} />
          {mat("#c7b06a", 0.9)}
        </mesh>
      ))}
      {id === "spectrometer" && (
        <mesh position={[0, boxSize[1] / 2 + 0.06, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.12, 20]} />
          {mat("#1c2124", 0.6)}
        </mesh>
      )}
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

/**
 * Two 3-panel solar wings (≈10.4 m tip-to-tip) on yokes. Stowed, each wing
 * Z-folds flat against the bus side (inside the fairing envelope); deployed,
 * hinge motors unfold the accordion. In flight the player can re-stow them.
 */
const PANEL_W = 1.18,
  PANEL_D = 0.95,
  YOKE = 0.42;
function SolarWings({ open, ghost }: { open: boolean; ghost: boolean }) {
  const hw = useHw();
  const hinges = useRef<(THREE.Group | null)[]>([]),
    phase = useRef(open ? 1 : 0);
  const target = () => {
    const d = engine.data;
    const flight = ["cruise", "orbit", "landing", "surface"].includes(d.stage) && !useGame.getState().settings.inspection;
    return open && !(flight && d.panelsStowed) ? 1 : 0;
  };
  const apply = () => {
    const t = phase.current;
    hinges.current.forEach((g, i) => {
      if (!g) return;
      const side = i < 4 ? -1 : 1,
        k = i % 4;
      // k=0 yoke root, k=1..3 panels. Z-fold: down, back up, down.
      const fold = 1 - t;
      g.rotation.z =
        k === 0 ? -side * (Math.PI / 2) * fold
        : k === 1 ? 0
        : k === 2 ? side * Math.PI * fold * 0.985
        : -side * Math.PI * fold * 0.985;
    });
  };
  useLayoutEffect(() => {
    phase.current = target();
    apply();
  }, []);
  useFrame((_, dt) => {
    const ui = useGame.getState();
    if (ui.paused || ui.drawer || ui.workshop.info || ui.tutorial.hold) return;
    // Real wings take ~1–2 min to deploy; compressed to a few seconds.
    phase.current = THREE.MathUtils.damp(phase.current, target(), 1.6, Math.min(dt, 0.1));
    apply();
  });
  const panel = (key: string) => (
    <group key={key}>
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[PANEL_W, 0.018, PANEL_D]} />
        <meshStandardMaterial map={hw.cells} color="#ffffff" metalness={0.55} roughness={0.22} transparent={ghost} opacity={ghost ? 0.22 : 1} />
      </mesh>
      <mesh position={[0, -0.008, 0]}>
        <boxGeometry args={[PANEL_W, 0.012, PANEL_D]} />
        <meshStandardMaterial map={hw.cellsBack} color="#ffffff" metalness={0.3} roughness={0.6} transparent={ghost} opacity={ghost ? 0.22 : 1} />
      </mesh>
      {/* Graphite-epoxy frame */}
      {[-1, 1].map((z) => (
        <mesh key={z} position={[0, 0.004, z * (PANEL_D / 2)]}>
          <boxGeometry args={[PANEL_W, 0.03, 0.02]} />
          <meshStandardMaterial color="#202224" metalness={0.4} roughness={0.6} transparent={ghost} opacity={ghost ? 0.22 : 1} />
        </mesh>
      ))}
    </group>
  );
  return (
    <group>
      {[-1, 1].map((side, si) => (
        <group key={side} position={[side * 1.08, 0, 0]}>
          {/* Solar array drive assembly */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
            <Material color="#8b918e" metal={0.85} ghost={ghost} />
          </mesh>
          <group ref={(n) => { hinges.current[si * 4] = n; }}>
            {/* Yoke */}
            <mesh position={[side * YOKE / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, YOKE, 8]} />
              <Material color="#d6d8d3" metal={0.6} ghost={ghost} />
            </mesh>
            {[-1, 1].map((z) => (
              <mesh key={z} position={[side * YOKE * 0.7, 0, z * 0.24]} rotation={[0, side * z * 0.7, Math.PI / 2]}>
                <cylinderGeometry args={[0.015, 0.015, YOKE * 0.8, 6]} />
                <Material color="#d6d8d3" metal={0.6} ghost={ghost} />
              </mesh>
            ))}
            <group position={[side * YOKE, 0, 0]} ref={(n) => { hinges.current[si * 4 + 1] = n; }}>
              <group position={[side * PANEL_W / 2, 0, 0]}>{panel("a")}</group>
              <group position={[side * PANEL_W, 0, 0]} ref={(n) => { hinges.current[si * 4 + 2] = n; }}>
                <group position={[side * PANEL_W / 2, 0.022, 0]}>{panel("b")}</group>
                <group position={[side * PANEL_W, 0, 0]} ref={(n) => { hinges.current[si * 4 + 3] = n; }}>
                  <group position={[side * PANEL_W / 2, -0.022, 0]}>{panel("c")}</group>
                </group>
              </group>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}
