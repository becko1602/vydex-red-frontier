import { useEffect } from 'react';
import { OrbitControls, Grid } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useGame } from '../store';
import { LaunchVehicle, rocketLayout } from './Rocket';
export default function RocketHangar(){
 const id=useGame(s=>s.data.design.launcher??'titan'),{camera}=useThree(),h=rocketLayout(id).height;
 useEffect(()=>{camera.position.set(15,h*.55,21);camera.lookAt(0,h*.5,0)},[camera,id,h]);
 return <><color attach="background" args={['#08121d']}/><ambientLight intensity={.75}/><hemisphereLight args={['#e5f5ff','#132330',1.5]}/><directionalLight position={[8,20,8]} intensity={3}/><pointLight position={[-8,7,-4]} color="#62cee0" intensity={160}/><LaunchVehicle id={id}/><mesh position={[0,-.4,0]}><cylinderGeometry args={[6,6.2,.6,64]}/><meshStandardMaterial color="#203544" roughness={.55} metalness={.6}/></mesh><Grid args={[100,100]} cellSize={2} sectionSize={10} cellColor="#263e4b" sectionColor="#487182" fadeDistance={65} position={[0,-.71,0]}/>{[-1,1].map(x=><mesh key={x} position={[x*7,7,-5]}><boxGeometry args={[.12,17,.12]}/><meshBasicMaterial color="#8ee3ef"/></mesh>)}<OrbitControls makeDefault target={[0,h*.5,0]} enablePan={false} minDistance={h*.7} maxDistance={42} maxPolarAngle={Math.PI*.51} onStart={()=>useGame.getState().setTutorial({action:'rocket-rotate'})}/></>;
}
