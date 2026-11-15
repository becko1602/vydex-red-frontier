import { useRef, useLayoutEffect, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import { useGame } from "../store";
import { engine } from "../sim/game";
import { parts, partIds, installed, type PartId } from "../data/workshop";
import { fitPart } from "../assemblyActions";
import { launchers } from "../data/launchVehicles";
import { payloadEnvelope } from "../sim/payload";
import { Spacecraft } from "./Spacecraft";
import { Text } from "@react-three/drei";

function Laboratory() {
  const screens: { x: number; title: string; part: PartId; tint: string }[] = [
    { x: -8.2, title: "STRUCTURAL / THERMAL", part: "body", tint: "#77d5dc" },
    { x: -3.4, title: "POWER / ARRAY", part: "solar", tint: "#8cb9ff" },
    { x: 3.4, title: "PROPULSION / FEED", part: "descentEngine", tint: "#efaa70" },
    { x: 8.2, title: "COMMS / NAVIGATION", part: "antenna", tint: "#b5d9a7" },
  ];
  return <group>
    {/* Enclosed clean-room bay, with a clear central assembly envelope. */}
    <mesh position={[0, 5.7, -9]} receiveShadow><boxGeometry args={[26, 11.4, .35]} /><meshStandardMaterial color="#1e2c34" roughness={.8} /></mesh>
    <mesh position={[0, 11.5, 0]}><boxGeometry args={[26, .35, 19]} /><meshStandardMaterial color="#17242c" metalness={.35} roughness={.76} /></mesh>
    {[-12.7, 12.7].map(x => <group key={x}>
      <mesh position={[x, 5.5, 0]} castShadow><boxGeometry args={[.35, 11, 18]} /><meshStandardMaterial color="#25353d" metalness={.4} roughness={.62} /></mesh>
      {[-6, -2, 2, 6].map(z => <mesh key={z} position={[x * .98, 5.7, z]}><boxGeometry args={[.04, 10.8, .06]} /><meshBasicMaterial color="#7898a0" transparent opacity={.28} /></mesh>)}
    </group>)}
    {[-8, -4, 0, 4, 8].map(x => <group key={x}>
      <mesh position={[x, 11.25, 0]}><boxGeometry args={[.14, .24, 17]} /><meshStandardMaterial color="#364a52" metalness={.68} roughness={.4} /></mesh>
      <mesh position={[x, 11.02, 0]}><boxGeometry args={[1.7, .04, 2.6]} /><meshBasicMaterial color="#f0bb7a" transparent opacity={.72} /></mesh>
    </group>)}
    {screens.map(screen => <group key={screen.title} position={[screen.x, 6.6, -8.77]}>
      <mesh><boxGeometry args={[4.4, 2.35, .12]} /><meshStandardMaterial color="#101a20" metalness={.35} roughness={.45} /></mesh>
      <mesh position={[0, 0, .07]}><planeGeometry args={[4.12, 2.07]} /><meshBasicMaterial color="#0b202a" /></mesh>
      <mesh position={[0, -.78, .09]}><boxGeometry args={[3.4, .012, .01]} /><meshBasicMaterial color={screen.tint} /></mesh>
      <Text position={[0, .72, .1]} fontSize={.17} color={screen.tint} anchorX="center">{screen.title}</Text>
      <Text position={[0, .18, .1]} fontSize={.12} color="#bbd3d6" anchorX="center">SYSTEM SCHEMATIC · VYDEX–01</Text>
      <group position={[0, -.2, .12]}>
        {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[-1.2 + i * .58, 0, 0]}><boxGeometry args={[.34, .42 + (i % 3) * .12, .01]} /><meshBasicMaterial color={screen.tint} transparent opacity={.55} /></mesh>)}
      </group>
      <Html position={[0, -.48, .18]} center transform><button className="lab-screen-button" onClick={() => useGame.getState().setWorkshop({ selected: screen.part, info: screen.part, message: `Technical reference opened: ${parts[screen.part].purpose}` })}>OPEN {parts[screen.part].name.toUpperCase()} DATA</button></Html>
    </group>)}
    {[-8, 8].map(x => <group key={`bench-${x}`} position={[x, 1.05, -3.9]}>
      <mesh castShadow><boxGeometry args={[5.5, .18, 1.6]} /><meshStandardMaterial color="#65767a" metalness={.68} roughness={.38} /></mesh>
      {[-2.3, 2.3].map(px => <mesh key={px} position={[px, -.58, 0]}><boxGeometry args={[.16, 1, 1.3]} /><meshStandardMaterial color="#35464c" metalness={.6} roughness={.5} /></mesh>)}
      {[-1.5, -.6, .35, 1.1].map((px, i) => <mesh key={px} position={[px, .22, -.2]} rotation={[0, 0, i % 2 ? .2 : -.2]}><boxGeometry args={[.28, .08, .42]} /><meshStandardMaterial color={i % 2 ? "#b79862" : "#7f9191"} metalness={.7} roughness={.35} /></mesh>)}
      <mesh position={[0, .12, .55]}><boxGeometry args={[2.9, .04, .55]} /><meshStandardMaterial color="#18232a" metalness={.4} roughness={.35} /></mesh>
      {[[-1.85,.16,.45],[1.82,.17,-.5]].map(([bx,by,bz],i)=><group key={i} position={[bx,by,bz]} rotation={[0,0,i?.06:-.04]}>
        <mesh><boxGeometry args={[.72,.18,.52]}/><meshStandardMaterial color={i?"#8b6546":"#496b70"} roughness={.8}/></mesh>
        <mesh position={[0,.015,0]}><boxGeometry args={[.62,.15,.44]}/><meshStandardMaterial color="#ded7c7" roughness={.95}/></mesh>
        <mesh position={[0,.11,0]}><boxGeometry args={[.73,.025,.54]}/><meshStandardMaterial color={i?"#b58a5c":"#648c8d"} roughness={.72}/></mesh>
      </group>)}
    </group>)}
    {[-10.8, 10.8].map(x => <group key={`rack-${x}`} position={[x, 2.5, 3.5]}>
      <mesh><boxGeometry args={[1.2, 5, 3.6]} /><meshStandardMaterial color="#26383e" metalness={.45} roughness={.7} /></mesh>
      {[-1.5, -.5, .5, 1.5].map(z => <mesh key={z} position={[0, 0, z]}><boxGeometry args={[1.28, .08, .08]} /><meshStandardMaterial color="#8a9a96" metalness={.65} roughness={.42} /></mesh>)}
      {[-1.55, -.55, .45, 1.45].map(z => <mesh key={`kit-${z}`} position={[0, -.3, z]}><boxGeometry args={[.64, .55, .38]} /><meshStandardMaterial color="#a47c50" metalness={.38} roughness={.58} /></mesh>)}
    </group>)}
    <Text position={[0, 9.4, -8.78]} fontSize={.25} color="#a8cbd1" anchorX="center">SPACECRAFT INTEGRATION · CLEAN ASSEMBLY BAY 04</Text>
  </group>;
}
export default function Hangar({inspection=false}:{inspection?:boolean}) {
  const d = useGame((s) => s.data.design),
    w = useGame((s) => s.workshop),
    set = useGame((s) => s.setWorkshop),
    settings = useGame((s) => s.settings),
    quality = settings.quality,
    flight = useGame(s=>s.data),
    { camera } = useThree(),
    controls = useRef<any>(null),
    launcher=launchers[d.launcher??'titan'],
    envelope=useMemo(()=>payloadEnvelope(d),[d]);
  useEffect(()=>{
    const y=w.exploded?4:3, view=settings.inspectionView;
    const offset= view==='front'?[0,1,10]:view==='rear'?[0,1,-10]:view==='side'?[10,1,0]:view==='engine'?[0,-2.5,6]:[7,3,9];
    camera.position.set(offset[0],y+offset[1],offset[2]);camera.lookAt(0,view==='engine'?1:y,0);
    if(controls.current){controls.current.target.set(0,view==='engine'?1:y,0);controls.current.update()}
  },[camera,settings.inspectionView,settings.inspectionReset]);
  const root = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (root.current) root.current.position.y = 3;
  }, []);
  useFrame((_, dt) => {
    if (root.current)
      root.current.position.y = THREE.MathUtils.damp(
        root.current.position.y,
        w.exploded ? 4.8 : 3,
        5,
        Math.min(dt, 0.1),
      );
  });
  return (
    <>
      <color attach="background" args={["#0c141d"]} />
      <fog attach="fog" args={["#0c141d", 20, 65]} />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={["#d7eaf3", "#3a4650", 1.0]} />
      <spotLight
        position={[0, 13, 5]}
        intensity={190}
        angle={0.6}
        penumbra={0.8}
        castShadow={quality !== "low"}
      />
      <pointLight position={[-6, 3, 0]} intensity={45} color="#9dc9e2" />
      <pointLight position={[6, 4, -4]} intensity={55} color="#80e0e8" />
      <group ref={root}>
        <Spacecraft
          design={d}
          exploded={w.exploded}
          selected={w.selected}
          preview={!inspection}
          stowed={settings.stowed}
          solarDeployed={!settings.stowed}
          labels={settings.componentLabels}
          interactive
          separated={inspection && (flight.stage==='surface'||flight.stage==='landing'||flight.stage==='debrief'||(flight.destination==='earth'&&flight.orbital.deployed))}
        />
        {!inspection && settings.fairingEnvelope && !w.exploded && <group position={[0,envelope.centerY,0]}><mesh><cylinderGeometry args={[launcher.fairingDiameter/2,launcher.fairingDiameter/2,launcher.fairingHeight,32,1,true]}/><meshBasicMaterial color={envelope.diameter>launcher.fairingDiameter?'#fa9065':'#7eddea'} wireframe transparent opacity={.13} depthWrite={false}/></mesh><Html position={[0,launcher.fairingHeight/2,0]} center><span className="space-label">{launcher.name} · Ø{launcher.fairingDiameter} × {launcher.fairingHeight} m USABLE BAY</span></Html></group>}
        {!inspection && partIds
          .filter((id) => id === w.selected || !installed(d, id))
          .map((id) => {
            const p = parts[id],
              spread = w.exploded ? 1.65 : 1;
            return (
              <Html
                key={id}
                position={[
                  p.position[0] * spread,
                  p.position[1] * spread,
                  p.position[2] * spread,
                ]}
                center
                zIndexRange={[2, 0]}
              >
                <button
                  data-tutorial={`slot-${id}`}
                  className={`mount ${w.selected === id ? "selected" : ""} ${installed(d, id) ? "attached" : ""}`}
                  title={`${p.slot}: ${p.name}`}
                  aria-label={`Mount ${p.name} at ${p.slot}`}
                  onClick={() => {
                    if (w.selected === id)
                      fitPart(id, !installed(engine.data.design, id));
                    else set({ selected: id, message: p.purpose });
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dragged = e.dataTransfer.getData(
                      "text/vydex-part",
                    ) as PartId;
                    if (dragged !== id) {
                      set({
                        message: `${parts[dragged]?.name ?? "This component"} does not fit ${p.slot}. Choose its highlighted compatible slot.`,
                      });
                      return;
                    }
                    fitPart(id, true);
                  }}
                >
                  {installed(d, id) ? "−" : "+"}
                </button>
              </Html>
            );
          })}
      </group>
      <Laboratory />
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <cylinderGeometry args={[5, 5.2, 0.4, 64]} />
        <meshStandardMaterial
          color="#283740"
          metalness={0.6}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.65, 4.7, 64]} />
        <meshBasicMaterial color="#82d7e1" />
      </mesh>
      <Grid
        args={[65, 65]}
        position={[0, -0.52, 0]}
        cellSize={1}
        sectionSize={5}
        cellColor="#20303b"
        sectionColor="#405b67"
        fadeDistance={45}
      />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 7, 4, -5]}>
          <boxGeometry args={[0.1, 9, 0.15]} />
          <meshBasicMaterial color="#a2dce8" />
        </mesh>
      ))}
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, settings.inspectionView==='engine'?1:w.exploded ? 4 : 3, 0]}
        minDistance={w.exploded ? 7 : 4.8}
        maxDistance={24}
        enablePan={false}
        maxPolarAngle={Math.PI * 0.92}
        onStart={() => useGame.getState().setTutorial({ action: "rotate" })}
      />
    </>
  );
}
