import type React from 'react';
import * as THREE from 'three';

/** Thin steel member between two points. */
export function Member({ a, b, r = 0.05, color = '#c9ccc8' }: { a: [number, number, number]; b: [number, number, number]; r?: number; color?: string }) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return (
    <mesh position={A.clone().add(B).multiplyScalar(0.5)} quaternion={q} castShadow>
      <boxGeometry args={[r * 2, len, r * 2]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.45} />
    </mesh>
  );
}
/** Lattice tower: four chord columns with X-bracing on every bay (like the VAB platform support towers). */
export function LatticeTower({ x, height, w = 1.6, d = 3.2 }: { x: number; height: number; w?: number; d?: number }) {
  const bays = Math.max(4, Math.round(height / 1.6)), bh = height / bays;
  const cx = [-w / 2, w / 2], cz = [-d / 2, d / 2];
  const members: React.ReactElement[] = [];
  cx.forEach((px) => cz.forEach((pz) => members.push(<Member key={`c${px}${pz}`} a={[x + px, -0.4, pz]} b={[x + px, height, pz]} r={0.09} color="#b8bcb9" />)));
  for (let k = 0; k < bays; k++) {
    const y0 = k * bh, y1 = y0 + bh;
    cz.forEach((pz) => {
      members.push(<Member key={`h${k}${pz}`} a={[x - w / 2, y1, pz]} b={[x + w / 2, y1, pz]} r={0.04} />);
      members.push(<Member key={`x${k}${pz}`} a={[x - w / 2, y0, pz]} b={[x + w / 2, y1, pz]} r={0.03} />);
    });
    cx.forEach((px) => {
      members.push(<Member key={`hz${k}${px}`} a={[x + px, y1, -d / 2]} b={[x + px, y1, d / 2]} r={0.04} />);
      members.push(<Member key={`xz${k}${px}`} a={[x + px, y0, k % 2 ? -d / 2 : d / 2]} b={[x + px, y1, k % 2 ? d / 2 : -d / 2]} r={0.03} />);
    });
  }
  return <group>{members}</group>;
}
