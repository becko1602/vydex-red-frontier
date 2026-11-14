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
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#d7eaf3", "#131e26", 1.2]} />
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
