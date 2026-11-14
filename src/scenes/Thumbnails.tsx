import { useMemo, useEffect, useRef, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LaunchVehicle, rocketLayout } from './Rocket';
import { PartGeometry } from './Spacecraft';
import { launcherIds } from '../data/launchVehicles';
import { partIds, parts } from '../data/workshop';
import { starter } from '../data/gameBalance';
import { useGame } from '../store';
// A single shared renderer/target renders the very same meshes as flight. No per-card WebGL contexts.
export default function Thumbnails(){
 const [done,setDone]=useState(false);
 const {gl}=useThree(),scene=useMemo(()=>new THREE.Scene(),[]),target=useMemo(()=>{const t=new THREE.WebGLRenderTarget(176,176,{depthBuffer:true});t.texture.colorSpace=THREE.SRGBColorSpace;return t},[]),camera=useMemo(()=>new THREE.PerspectiveCamera(36,1,.05,100),[]),groups=useRef<(THREE.Group|null)[]>([]),cursor=useRef(-2);
 const ids=useMemo(()=>[...launcherIds.map(id=>'rocket:'+id),...partIds],[]);
 useEffect(()=>()=>target.dispose(),[target]);
 useFrame(()=>{
  if(done)return;
  if(cursor.current++<0)return;const i=cursor.current-1;
  if(i>=ids.length){setDone(true);target.dispose();return;}
  const id=ids[i];if(useGame.getState().thumbnails[id])return;
  groups.current.forEach((g,j)=>{if(g)g.visible=i===j});
  if(id.startsWith('rocket:')){const r=id.slice(7) as typeof launcherIds[number],h=rocketLayout(r).height;camera.position.set(h*.85,h*.68,h*1.65);camera.lookAt(0,h*.48,0)}
  else {const p=parts[id as keyof typeof parts],size=Math.max(...p.size,1);camera.position.set(size*1.25,size*.9,size*1.9);camera.lookAt(0,0,0)}
  camera.updateMatrixWorld();const old=gl.getRenderTarget(),auto=gl.autoClear;
  try{gl.setRenderTarget(target);gl.autoClear=true;gl.render(scene,camera);const bytes=new Uint8Array(176*176*4);gl.readRenderTargetPixels(target,0,0,176,176,bytes);const c=document.createElement('canvas');c.width=c.height=176;const ctx=c.getContext('2d');if(ctx){const data=ctx.createImageData(176,176);for(let y=0;y<176;y++)data.data.set(bytes.subarray((175-y)*704,(176-y)*704),y*704);ctx.putImageData(data,0,0);useGame.getState().setThumbnail(id,c.toDataURL('image/webp',.85));}}
  finally{gl.setRenderTarget(old);gl.autoClear=auto}
 });
 if(done)return null;
 return createPortal(<><color attach="background" args={['#142330']}/><ambientLight intensity={1.1}/><directionalLight position={[10,15,15]} intensity={3.4}/><directionalLight position={[-10,5,-5]} color="#73d8ec" intensity={2}/>{launcherIds.map((id,i)=><group key={id} ref={g=>{groups.current[i]=g}} visible={false}><LaunchVehicle id={id}/></group>)}{partIds.map((id,i)=><group key={id} ref={g=>{groups.current[i+launcherIds.length]=g}} visible={false}><PartGeometry id={id} design={starter('geology')}/></group>)}</>,scene);
}
