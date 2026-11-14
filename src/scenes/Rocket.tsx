import { launchers, type LauncherId } from '../data/launchVehicles';
import * as THREE from 'three';
export const ROCKET_VISUAL_SCALE=0.25;
export function rocketLayout(id:LauncherId){
 const r=launchers[id], nose=r.fairingDiameter*0.85, body=r.height-nose-r.fairingHeight;
 return {nose,body,payloadY:(body+r.fairingHeight/2)*ROCKET_VISUAL_SCALE,height:r.height*ROCKET_VISUAL_SCALE};
}
// One model for cards, hangar and flight. All geometry in fictional design metres, then display scale 1:4.
export function LaunchVehicle({firing=false,fairingOpen=0,separation=0,upperSeparation=0,id='titan',throttle=1}: {firing?:boolean;fairingOpen?:number;separation?:number;upperSeparation?:number;id?:LauncherId;throttle?:number}){
 const r=launchers[id],{nose,body}=rocketLayout(id),radius=r.diameter/2, bay=r.fairingDiameter/2, joint=body*0.64;
 const metal=<meshStandardMaterial color="#bec9cc" metalness={0.7} roughness={0.42}/>;
 const white=<meshStandardMaterial color={id==='scout'?'#d9e9ed':id==='pioneer'?'#e6dfca':'#e8e9e3'} metalness={0.3} roughness={0.48}/>;
 const dark=<meshStandardMaterial color="#253643" metalness={0.6} roughness={0.48}/>;
 const bell=(x:number,z:number,small=1,active=true)=><group key={`${x}:${z}`} position={[x,0,z]} scale={small}><mesh position={[0,0.1,0]}><cylinderGeometry args={[radius*0.15,radius*0.32,radius*0.65,16,1,true]}/>{metal}</mesh>{firing&&active&&throttle>0&&<group position={[0,-radius*0.2,0]} scale={[1,Math.max(.05,throttle),1]}><mesh position={[0,-radius*1.7,0]} rotation={[0,0,Math.PI]}><coneGeometry args={[radius*.33,radius*3.5,16]}/><meshBasicMaterial color="#8edfff" transparent opacity={.65} depthWrite={false}/></mesh><mesh position={[0,-radius*.55,0]} rotation={[0,0,Math.PI]}><coneGeometry args={[radius*.19,radius*1.3,12]}/><meshBasicMaterial color="#fff3d7"/></mesh></group>}</group>;
 return <group scale={ROCKET_VISUAL_SCALE}>
  <group position={[0,-upperSeparation*45,0]} rotation={[0,0,upperSeparation*.17]}>
   <mesh position={[0,joint/2,0]} castShadow><cylinderGeometry args={[radius,radius,joint,32]}/>{white}</mesh>
   {[.08,.35,.85,.98].map(f=><mesh key={f} position={[0,joint*f,0]}><cylinderGeometry args={[radius*1.015,radius*1.015,.1,32]}/>{metal}</mesh>)}
   <mesh position={[0,joint*.73,0]}><cylinderGeometry args={[radius*1.01,radius*1.01,joint*.12,32]}/>{dark}</mesh>
   {[0,1,2,3].map(i=><group key={i} rotation={[0,i*Math.PI/2,0]}><mesh position={[radius*.9,1.6,0]} rotation={[0,0,-.2]}><boxGeometry args={[radius*.75,3,.12]}/><meshStandardMaterial color={r.color} metalness={.4} roughness={.5}/></mesh></group>)}
   {id==='scout'?bell(0,0,1,upperSeparation<.05):[0,1,2,3].map(i=>bell(Math.cos(i*Math.PI/2)*radius*.48,Math.sin(i*Math.PI/2)*radius*.48,.8,upperSeparation<.05))}
  </group>
  <mesh position={[0,(joint+body)/2,0]} castShadow><cylinderGeometry args={[radius*.94,radius,body-joint,32]}/>{white}</mesh>
  <mesh position={[0,joint+.3,0]}><cylinderGeometry args={[radius*1.02,radius*1.02,.65,32]}/>{dark}</mesh>
  {upperSeparation>.1&&<group position={[0,joint,0]}>{bell(0,0,.8)}</group>}
  <mesh position={[0,body-.4,0]}><cylinderGeometry args={[bay,radius,.8,32]}/>{metal}</mesh>
  {[0,1].map(i=><group key={i} position={[(i?1:-1)*fairingOpen*9,body,0]} rotation={[0,0,(i?-1:1)*fairingOpen*.65]}>
   <mesh position={[0,r.fairingHeight/2,0]}><cylinderGeometry args={[bay,bay,r.fairingHeight,32,1,true,i*Math.PI,Math.PI]}/><meshStandardMaterial color="#ecede7" metalness={.25} roughness={.45} side={THREE.DoubleSide}/></mesh>
   <mesh position={[0,r.fairingHeight+nose/2,0]}><coneGeometry args={[bay,nose,32,1,true,i*Math.PI,Math.PI]}/><meshStandardMaterial color="#ecede7" metalness={.25} roughness={.45} side={THREE.DoubleSide}/></mesh>
  </group>)}
  {r.boosters>0&&[-1,1].map(side=><group key={side} position={[side*(radius*1.65+separation*18),-separation*35,0]} rotation={[0,0,-side*separation*.25]}>
   <mesh position={[0,joint*.43,0]} castShadow><cylinderGeometry args={[radius*.4,radius*.44,joint*.86,24]}/>{white}</mesh>
   <mesh position={[0,joint*.86+radius*.45,0]}><coneGeometry args={[radius*.4,radius*.9,24]}/>{white}</mesh>
   <mesh position={[0,joint*.35,0]}><cylinderGeometry args={[radius*.45,radius*.45,.5,24]}/><meshStandardMaterial color={r.color}/></mesh>
   {bell(0,0,.65,separation<.05)}
  </group>)}
 </group>;
}
