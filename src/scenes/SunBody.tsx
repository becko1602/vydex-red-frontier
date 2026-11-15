import { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The Sun as seen from space: an emissive photosphere with limb darkening
 * (I/I0 = 1 − u(1 − μ), u ≈ 0.6 in the visible), animated granulation, and an
 * additive corona/glare billboard. It is white-yellow, not a flat white ball.
 */
export function SunBody({ radius = 1, glare = 1 }: { radius?: number; glare?: number }) {
  const surface = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { t: { value: 0 } },
        vertexShader:
          "varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }",
        fragmentShader: `uniform float t; varying vec3 vN; varying vec3 vV; varying vec3 vP;
          float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
          float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                       mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
          void main(){
            float mu=clamp(dot(normalize(vN),normalize(vV)),0.0,1.0);
            float limb=1.0-0.62*(1.0-mu)-0.12*(1.0-mu)*(1.0-mu);
            vec3 p=normalize(vP)*14.0;
            float g=n(p+vec3(t*0.15))*0.55+n(p*2.3-vec3(t*0.2))*0.3+n(p*5.1)*0.15;
            vec3 core=vec3(1.0,0.97,0.9);
            vec3 edge=vec3(1.0,0.55,0.18);
            vec3 c=mix(edge,core,pow(mu,0.45))*limb*(0.86+0.28*g);
            gl_FragColor=vec4(c*1.25,1.0);
          }`,
        toneMapped: false,
      }),
    [],
  );
  const glow = useMemo(() => {
    const el = document.createElement("canvas");
    el.width = el.height = 256;
    const g = el.getContext("2d")!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,248,230,1)");
    grad.addColorStop(0.12, "rgba(255,236,190,0.85)");
    grad.addColorStop(0.3, "rgba(255,200,120,0.25)");
    grad.addColorStop(0.6, "rgba(255,170,90,0.06)");
    grad.addColorStop(1, "rgba(255,160,80,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    // Faint diffraction spikes (camera optics), as in real spacecraft imagery.
    g.globalCompositeOperation = "lighter";
    for (const a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
      g.save();
      g.translate(128, 128);
      g.rotate(a);
      const s = g.createLinearGradient(-128, 0, 128, 0);
      s.addColorStop(0, "rgba(255,240,210,0)");
      s.addColorStop(0.5, `rgba(255,240,210,${a % (Math.PI / 2) === 0 ? 0.35 : 0.15})`);
      s.addColorStop(1, "rgba(255,240,210,0)");
      g.fillStyle = s;
      g.fillRect(-128, -1.2, 256, 2.4);
      g.restore();
    }
    const t = new THREE.CanvasTexture(el);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => { surface.dispose(); glow.dispose(); }, [surface, glow]);
  useFrame((_, dt) => {
    surface.uniforms.t.value += Math.min(dt, 0.1);
  });
  return (
    <group>
      <mesh material={surface}>
        <sphereGeometry args={[radius, 64, 40]} />
      </mesh>
      <sprite scale={[radius * 7 * glare, radius * 7 * glare, 1]}>
        <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} transparent toneMapped={false} fog={false} />
      </sprite>
      <pointLight intensity={0} />
    </group>
  );
}
