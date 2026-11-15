import { solarSystem } from "../data/solarSystem";
import type { FlightData } from './game';
import { masses,terrainHeight,transferPosition,transferModel,launchAscent } from './physics';
import { C } from '../data/scienceConstants';
import { earthOrbit } from './orbit';
import { launchers } from '../data/launchVehicles';
import { launchDuration } from './journey';
export function vehicleMass(d:FlightData){const m=masses(d.design);return d.stage==='surface'||(d.destination==='earth'&&d.orbital.deployed)?m.surface:['landing','debrief'].includes(d.stage)&&['moon','mars','mercury'].includes(d.destination)?m.descentDry+d.lander.fuel:m.cruiseDry+d.cruiseFuel}
export function speedTelemetry(d:FlightData){
 if(d.stage==='launch'){
  const id=d.design.launcher??'titan',example=launchers[id].ascentModel;
  const ascent=launchAscent(example,masses(d.design).wet,Math.max(0,d.stageTime-launchDuration(d)*.12));
  return {label:'Illustrative vertical ascent',speed:ascent.verticalSpeedMps,unit:'m/s',detail:`${ascent.altitudeM.toFixed(0)} m altitude · ${ascent.massKg.toFixed(0)} kg total · ${ascent.propellantKg.toFixed(0)} kg propellant`};
 }
 if(d.stage==='landing')return {label:`${d.destination.toUpperCase()} ground-relative`,speed:Math.hypot(d.lander.vx,d.lander.vy,d.lander.vz),unit:'m/s',detail:`${Math.max(0,d.lander.y-terrainHeight(d.lander.x,d.lander.z,d.destination)).toFixed(0)} m above terrain`};
 if(d.stage==='surface')return {label:'Ground-relative',speed:Math.abs(d.rover.speed),unit:'m/s',detail:'Local surface frame'};
 if(d.stage==='orbit'&&d.destination==='asteroid')return {label:'Asteroid-relative',speed:Math.hypot(d.orbital.vx,d.orbital.vy,d.orbital.vz),unit:'m/s',detail:`${Math.hypot(d.orbital.x,d.orbital.y,d.orbital.z-14).toFixed(1)} m to corridor`};
 if(d.stage==='cruise'&&d.destination==='mars'){const p=transferPosition(d.cruiseProgress),r=Math.hypot(p.x,p.z),t=transferModel();return {label:'Sun-relative (ideal model)',speed:Math.sqrt(C.muSun*(2/r-1/t.a))/1000,unit:'km/s',detail:`${(r/C.AU).toFixed(2)} AU from Sun`}}
 if(d.stage==='orbit'&&d.destination!=='earth'&&d.destination!=='asteroid'){const R=solarSystem[d.destination as 'jupiter'].radiusM,mu=solarSystem[d.destination as 'jupiter'].muM3S2,alt={venus:.05,jupiter:.09,saturn:.1,uranus:.12,neptune:.12}[d.destination as 'venus']??.1,r=R*(1+alt);return {label:`${d.destination.toUpperCase()}-relative circular orbit`,speed:Math.sqrt(mu/r)/1000,unit:'km/s',detail:`${Math.round(R*alt/1000).toLocaleString('en-US')} km above the ${d.destination==='venus'?'surface':'1-bar level'}; period ${(2*Math.PI*Math.sqrt(r**3/mu)/3600).toFixed(1)} h`}}
 if(d.stage==='orbit')return {label:'Earth-relative circular reference',speed:earthOrbit().speed/1000,unit:'km/s',detail:'400 km reference altitude; local attitude separate'};
 return {label:'Illustrative route',speed:null,unit:'',detail:'No calculated ascent / route speed'};
}
export const telemetryHelp: Record<string,[string,string]>={
 mass:['Vehicle mass','This is your spacecraft mass, in kilograms: installed dry hardware plus remaining spacecraft propellant. Provider stages and fuel are separate. The cruise deck is discarded before landing; a deployed Earth satellite keeps only surface hardware.'],
 throttle:['Throttle / engine status','Throttle is the requested fraction of a local engine’s fictional maximum thrust. Landing assist computes braking and the slider trims it. Shutdown or X forces thrust to zero, even with assist. Shift/Ctrl adjusts throttle; Ignite explicitly restarts. Transfer burns are planned operations and cannot be altered by arcade inputs.'],
 frame:['Speed reference frame','Speed needs a reference. Surface and landing speed are relative to the local ground. Local asteroid speed is relative to the fictional asteroid. Mars cruise uses a calculated Sun-relative speed from vis-viva. Earth orbital speed is a circular reference separate from local attitude. Launch speed comes from the labeled fictional one dimensional ascent example; stage changes and orbital insertion remain scripted.'],
 power:['Electrical balance','Generation minus load is the electrical balance, in watts. Battery energy is stored in watt-hours. Surface and orbital electrical time is compressed ×30. Final descent uses physical seconds; the cruise power decision models a stated two-hour episode. A full battery cannot store excess generation.'],
 elapsed:['Mission time','Mission elapsed is accumulated active gameplay time; pause and inspection stop it. Presentation acceleration changes launch/cruise progress only. Astronomical transfer time and compression are displayed separately.'],
};
