import { C } from "../data/scienceConstants";
import type { Design } from "../data/gameBalance";
import { installed } from "../data/workshop";
import { clamp, masses } from "./physics";
import type { Input } from "./game";
export type OrbitalState = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  yawRate: number;
  pitchRate: number;
  roll:number; rollRate:number;
  deployed: boolean;
  autopilot: boolean;
  crashed: boolean;
  fuelUsed: number;
};
export const initialOrbit = (
  destination: "earth" | "asteroid" = "earth",
): OrbitalState => ({
  x: 0,
  y: 0,
  z: 35,
  vx: 0,
  vy: 0,
  vz: 0,
  yaw: destination === "earth" ? 0.55 : 0,
  pitch: destination === "earth" ? 0.25 : 0,
  yawRate: 0,
  pitchRate: 0,
  roll:0, rollRate:0,
  deployed: false,
  autopilot: false,
  crashed: false,
  fuelUsed: 0,
});
export const EARTH_ORBIT_ALTITUDE = 400000; // Fictional selected orbit height, SI.
export const earthOrbit = () => {
  const r = C.earthRadius + EARTH_ORBIT_ALTITUDE;
  return {
    radius: r,
    speed: Math.sqrt(C.earthMu / r),
    period: 2 * Math.PI * Math.sqrt(r ** 3 / C.earthMu),
  };
};
export function stableAttitude(s: OrbitalState) {
  return (
    Math.abs(s.yaw) < 0.12 &&
    Math.abs(s.pitch) < 0.12 &&
    Math.abs(s.roll)<.12 && Math.abs(s.rollRate)<.04 &&
    Math.abs(s.yawRate) < 0.04 &&
    Math.abs(s.pitchRate) < 0.04
  );
}
export function sampleCorridor(s: OrbitalState) {
  return (
    !s.crashed &&
    Math.hypot(s.x, s.y, s.z - 14) < 5 &&
    Math.hypot(s.vx, s.vy, s.vz) < 0.35
  );
}
export function orbitStep(
  s: OrbitalState,
  d: Design,
  fuel: number,
  dt: number,
  input: Input,
  destination: "earth" | "asteroid",
  assist: boolean,
  mainThrottle=0,
) {
  if (s.crashed) return 0;
  const m = s.deployed ? masses(d).surface : masses(d).cruiseDry + fuel;
  if (
    (!s.deployed && !installed(d, "cruiseEngine")) ||
    !installed(d, "computer") ||
    m <= 0
  )
    return 0;
  let fx = 0,
    fz = 0,
    ty = 0,
    tp = 0;
  const yawInput=input.yaw??input.turn,pitchInput=input.pitch??input.forward,rollInput=input.roll??0,inertia=m*.22;
  const torque=(angle:number,rate:number,command:number)=>clamp(command*25+((assist||input.brake)?(-(command?0:angle*1.2)-rate*2.5)*inertia:0),-25,25);
  ty=torque(s.yaw,s.yawRate,yawInput);tp=torque(s.pitch,s.pitchRate,pitchInput);
  const tr=torque(s.roll,s.rollRate,rollInput);
  let fy=0;
  if(destination==='asteroid') {
    fx=(input.rcsX??-input.turn)*25;fz=(input.rcsZ??-input.forward)*25;
    const manual=!!(input.rcsX||input.rcsZ||input.forward||input.turn||mainThrottle);
    if(s.autopilot&&!manual){
      const guidance=(error:number,v:number)=>clamp((Math.sign(error)*Math.min(.65,Math.sqrt(2*25/m*Math.abs(error)*.65))-v)*m*1.8,-25,25);
      fx=guidance(-s.x,s.vx);fz=guidance(14-s.z,s.vz);fy=guidance(-s.y,s.vy);
    } else if(input.brake||(assist&&!manual)){fx=clamp(-s.vx*m*2,-25,25);fz=clamp(-s.vz*m*2,-25,25);fy=clamp(-s.vy*m*2,-25,25)}
  }
  const main=destination==='asteroid'?40*clamp(mainThrottle,0,1):0;
  const reactionWheels = destination === "earth" && s.deployed;
  const demand = reactionWheels
    ? 0
    : ((Math.abs(fx) + Math.abs(fz) + Math.abs(ty) + Math.abs(tp) + Math.abs(tr) + Math.abs(fy) + main) /
        (320 * C.g0)) *
      dt;
  const used = Math.min(Math.max(0, fuel), demand),
    fraction = reactionWheels ? 1 : demand > 0 ? used / demand : 0;
  s.fuelUsed += used;
  s.yawRate+=ty*fraction/inertia*dt;s.pitchRate+=tp*fraction/inertia*dt;s.rollRate+=tr*fraction/inertia*dt;
  s.yaw+=s.yawRate*dt;s.pitch+=s.pitchRate*dt;s.roll+=s.rollRate*dt;
  if(destination==='asteroid'){
    s.vx+=(fx-main*Math.sin(s.yaw)*Math.cos(s.pitch))*fraction/m*dt;
    s.vy+=(fy+main*Math.sin(s.pitch))*fraction/m*dt;
    s.vz+=(fz-main*Math.cos(s.yaw)*Math.cos(s.pitch))*fraction/m*dt;
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;
    if(Math.hypot(s.x,s.y,s.z)<10)s.crashed=true;
  }
  return used;
}
