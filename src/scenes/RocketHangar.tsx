import { useEffect, useRef } from 'react';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../store';
import { LaunchVehicle, rocketLayout } from './Rocket';

function Gantry({ height, radius }: { height: number; radius: number }) {
 const levels=[height*.28,height*.62,height*.9];
 return <group>
  {[-1,1].map(side=><group key={side} position={[side*4.25,0,0]}>
   <mesh position={[0,height*.5,0]} castShadow><boxGeometry args={[.34,height+1,.5]}/><meshStandardMaterial color="#16252d" metalness={.8} roughness={.34}/></mesh>
   <mesh position={[0,height*.5,.27]}><boxGeometry args={[.08,height,.08]}/><meshBasicMaterial color="#74d9e8"/></mesh>
   {levels.map(y=><group key={y}>
    <mesh position={[-side*1.72,y,0]} castShadow><boxGeometry args={[3.45,.18,.32]}/><meshStandardMaterial color="#50646a" metalness={.82} roughness={.3}/></mesh>
    <mesh position={[-side*(radius+.18),y,0]} castShadow><boxGeometry args={[.28,.6,.7]}/><meshStandardMaterial color="#334c57" metalness={.8} roughness={.32}/></mesh>
    <mesh position={[-side*(radius+.34),y,0]}><boxGeometry args={[.1,.34,.54]}/><meshStandardMaterial color="#d2a35f" metalness={.7} roughness={.35}/></mesh>
   </group>)}
  </group>)}
  {levels.map(y=><mesh key={`back:${y}`} position={[0,y,-2.8]}><boxGeometry args={[8.5,.16,.2]}/><meshStandardMaterial color="#263b45" metalness={.75} roughness={.38}/></mesh>)}
  <mesh position={[0,height*.96,0]}><boxGeometry args={[8.5,.22,.3]}/><meshStandardMaterial color="#354d58" metalness={.8} roughness={.3}/></mesh>
  <mesh position={[0,-.55,0]}><boxGeometry args={[7.2,.22,2.4]}/><meshStandardMaterial color="#202f36" metalness={.75} roughness={.42}/></mesh>
  <mesh position={[0,-.68,0]}><boxGeometry args={[2.8,.08,1.1]}/><meshBasicMaterial color="#e08a4d"/></mesh>
 </group>;
}

function Gyroscope({ height }: { height: number }) {
 const ref=useRef<THREE.Group>(null);
 useFrame((_,dt)=>{ if(ref.current) ref.current.rotation.y+=dt*.16; });
 const material=<meshBasicMaterial color="#7fe1ec" transparent opacity={.28} depthWrite={false}/>;
 return <group ref={ref} position={[0,height*.52,0]}>
  <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[height*.28,.025,8,64]}/>{material}</mesh>
  <mesh rotation={[0,Math.PI/2,0]}><torusGeometry args={[height*.28,.025,8,64]}/>{material}</mesh>
  <mesh><torusGeometry args={[height*.28,.025,8,64]}/>{material}</mesh>
  <mesh><sphereGeometry args={[height*.06,16,16]}/><meshBasicMaterial color="#d7fbff" transparent opacity={.42}/></mesh>
  <Html position={[0,height*.32,0]} center>
   <span className="rocket-gyro-hud">GYRO LOCK · 360° VIEW</span>
  </Html>
 </group>;
}

function HangarBackdrop({ height }: { height: number }) {
 return <group>
  <mesh position={[0,height*.5,-7.2]} receiveShadow>
   <boxGeometry args={[23,height+2,.28]}/>
   <meshStandardMaterial color="#27333a" metalness={.3} roughness={.78}/>
  </mesh>
  {[-1,0,1].map((x)=><mesh key={x} position={[x*6.4,height*.5,-7.02]}>
   <boxGeometry args={[.12,height+.5,.04]}/>
   <meshBasicMaterial color="#d58b54" transparent opacity={.5}/>
  </mesh>)}
  {[-1,0,1].map((x)=><mesh key={x} position={[x*6.4,height*.84,-6.98]}>
   <boxGeometry args={[5.2,.035,.04]}/>
   <meshBasicMaterial color="#f0bd85" transparent opacity={.8}/>
  </mesh>)}
  <mesh position={[0,height+.55,0]} receiveShadow>
   <boxGeometry args={[24,.2,16]}/>
   <meshStandardMaterial color="#101b21" metalness={.55} roughness={.62}/>
  </mesh>
  {[-5.5,0,5.5].map(x=><mesh key={x} position={[x,height+.42,0]} rotation={[0,0,0]}>
   <boxGeometry args={[3.2,.03,8.5]}/>
   <meshBasicMaterial color="#f2bc7c" transparent opacity={.55}/>
  </mesh>)}
 </group>;
}

export default function RocketHangar(){
 const id=useGame(s=>s.data.design.launcher??'titan'),{camera}=useThree(),h=rocketLayout(id).height;
 useEffect(()=>{camera.position.set(15,h*.55,21);camera.lookAt(0,h*.5,0)},[camera,id,h]);
 return <><color attach="background" args={['#08121d']}/><fog attach="fog" args={['#08121d',18,52]}/><ambientLight intensity={.52}/><hemisphereLight args={['#e5f5ff','#132330',1.35]}/><directionalLight position={[8,20,8]} intensity={2.8} castShadow/><pointLight position={[-8,7,-4]} color="#62cee0" intensity={160}/><pointLight position={[8,4,5]} color="#f0a05c" intensity={110}/><HangarBackdrop height={h}/><Gantry height={h} radius={id==='scout'?0.42:id==='pioneer'?.58:.72}/><LaunchVehicle id={id}/><Gyroscope height={h}/><mesh position={[0,-.4,0]} receiveShadow><cylinderGeometry args={[6,6.2,.6,64]}/><meshStandardMaterial color="#203544" roughness={.55} metalness={.6}/></mesh><mesh position={[0,-.07,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.3,1.34,64]}/><meshBasicMaterial color="#eea25c"/></mesh><Grid args={[100,100]} cellSize={2} sectionSize={10} cellColor="#263e4b" sectionColor="#487182" fadeDistance={65} position={[0,-.71,0]}/><OrbitControls makeDefault target={[0,h*.5,0]} enablePan={false} enableDamping dampingFactor={.08} rotateSpeed={.65} minDistance={h*.7} maxDistance={42} minPolarAngle={.08} maxPolarAngle={Math.PI*.92} onStart={()=>useGame.getState().setTutorial({action:'rocket-rotate'})}/></>;
}
