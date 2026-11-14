import type { Design } from '../data/gameBalance';
import { parts, partIds, installed, type PartId } from '../data/workshop';
import { launchers, capacityFor } from '../data/launchVehicles';
import type { DestinationId } from '../data/destinations';
// Conservative boxes enclosing the same local meshes used by Spacecraft. Metres.
export function stowedBounds(id: PartId): { position:number[]; size:number[] } {
 const p=parts[id];
 if(id==='solar') return {position:[0,0.65,0],size:[2.55,1.3,1.05]};
 if(id==='legs') return {position:[0,-0.45,0],size:[2.65,1.4,2.65]};
 if(id==='tank') return {position:p.position,size:[2.1,.75,1.4]};
 if(id==='body') return {position:p.position,size:[2.26,1.3,2.26]};
 if(id==='antenna') return {position:p.position,size:[1.2,1.2,1.2]};
 return p;
}
export function payloadEnvelope(d:Design) {
 let radius=0, minY=Infinity,maxY=-Infinity;
 for(const id of partIds.filter(id=>installed(d,id))){
  const {position:p,size:s}=stowedBounds(id);
  radius=Math.max(radius,Math.hypot(Math.abs(p[0])+s[0]/2,Math.abs(p[2])+s[2]/2));
  minY=Math.min(minY,p[1]-s[1]/2);maxY=Math.max(maxY,p[1]+s[1]/2);
 }
 return {diameter:2*radius,height:Number.isFinite(minY)?maxY-minY:0,centerY:Number.isFinite(minY)?(maxY+minY)/2:0};
}
export function launcherFit(d:Design,destination:DestinationId, wetMass:number){
 const id=d.launcher??'titan',r=launchers[id],p=payloadEnvelope(d),capacity=capacityFor(id,destination);
 const route=capacity>0,mass=wetMass<=capacity,dimensions=p.diameter<=r.fairingDiameter && p.height<=r.fairingHeight;
 return {route,mass,dimensions,ok:route&&mass&&dimensions,capacity,payload:p,rocket:r};
}
