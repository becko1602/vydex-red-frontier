import { input } from '../input';
import { useGame } from '../store';
import { useState } from 'react';
export default function FlightTouch(){
 const stage=useGame(s=>s.data.stage),destination=useGame(s=>s.data.destination),[pressed,setPressed]=useState('');
 const hold=(key:'pitch'|'yaw'|'roll'|'rcsX'|'rcsZ',v:number,label:string)=>({
  className:pressed===label?'pressed':'',
  'aria-pressed':pressed===label,
  onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);input[key]=v;setPressed(label);useGame.getState().setTutorial({action:'steer'})},
  onPointerUp:()=>{input[key]=0;setPressed('')},
  onPointerCancel:()=>{input[key]=0;setPressed('')},
  onPointerLeave:()=>{input[key]=0;setPressed('')}
 });
 return <div className="flight-touch" aria-label="Touch flight attitude controls"><span>ATTITUDE / ACTIVE INPUT</span>{(['pitch','yaw','roll'] as const).map(axis=><div key={axis}><button aria-label={`${axis} negative`} {...hold(axis,-1,`${axis}-`)}>−</button><span>{axis}</span><button aria-label={`${axis} positive`} {...hold(axis,1,`${axis}+`)}>+</button></div>)}{stage==='orbit'&&destination==='asteroid'&&<><span>LOCAL RCS TRANSLATION</span><div><button aria-label="translate left" {...hold('rcsX',-1,'left')}>←</button><button aria-label="translate forward" {...hold('rcsZ',-1,'up')}>↑</button><button aria-label="translate backward" {...hold('rcsZ',1,'down')}>↓</button><button aria-label="translate right" {...hold('rcsX',1,'right')}>→</button></div></>}</div>
}
