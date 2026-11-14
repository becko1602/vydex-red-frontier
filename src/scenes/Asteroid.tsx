import { useMemo, useEffect } from "react";
import * as THREE from "three";
export function Asteroid({ radius = 1 }: { radius?: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(radius, 3),
      p = g.attributes.position,
      c = new THREE.Color(),
      colors = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / radius,
        y = p.getY(i) / radius,
        z = p.getZ(i) / radius;
      const f =
        1 +
        0.12 * Math.sin(x * 9 + y * 5) * Math.cos(z * 7) +
        0.06 * Math.sin(y * 19 + z * 11);
      p.setXYZ(i, x * radius * f * 1.15, y * radius * f * 0.82, z * radius * f);
      c.setHSL(0.065, 0.1, 0.23 + (f - 1) * 0.4);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} flatShading />
    </mesh>
  );
}
