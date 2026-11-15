import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { engine } from '../sim/game';
import { input } from '../input';
import { useGame } from '../store';

/**
 * Thruster exhaust tied to real hardware on the model (Spacecraft.tsx):
 * - Four RCS quads on the bus corners at body (±1.12, −0.45, ±0.98) + bus offset y 0.2;
 *   each quad has nozzles pointing ±X and ±Y. Hydrazine RCS plumes in vacuum are
 *   faint, short and expand quickly — drawn as pale additive puffs that pulse.
 * - Main cruise engine bell exit at (0, −3.3, 0), pointing −Y (stack axis).
 * Every jet is gated by actual input / assist demand and remaining propellant.
 */
type Jet = { quad: [number, number]; dir: [number, number, number] };
const QUADS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const jetsDef: Jet[] = QUADS.flatMap((q) => [
  { quad: q, dir: [q[0], 0, 0] as [number, number, number] },
  { quad: q, dir: [0, 1, 0] as [number, number, number] },
  { quad: q, dir: [0, -1, 0] as [number, number, number] },
]);
const quadPos = (q: [number, number]) => new THREE.Vector3(q[0] * 1.12, -0.25, q[1] * 0.98);

function plumeMaterial(color: string, strength = 0.55) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { color: { value: new THREE.Color(color) }, k: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: ('uniform vec3 color; uniform float k; varying vec2 vUv; void main(){ float y = 1.0 - vUv.y; float a = pow(1.0 - y, 1.6) * STRENGTH * k; gl_FragColor = vec4(color * (1.2 + (1.0 - y)), a); }').replace('STRENGTH', strength.toFixed(3)),
  });
}

export default function VehicleEffects() {
  const main = useRef<THREE.Group>(null), jets = useRef<(THREE.Group | null)[]>([]);
  const rcsMat = useMemo(() => plumeMaterial('#dfefff'), []);
  const mainMat = useMemo(() => plumeMaterial('#ffd7a8', 0.16), []); // vacuum biprop plume: faint, mostly the hot throat glow
  useEffect(() => () => { rcsMat.dispose(); mainMat.dispose(); }, [rcsMat, mainMat]);
  useFrame(({ clock }) => {
    const d = engine.data, ui = useGame.getState(), o = d.orbital;
    const active = d.stage === 'orbit' && d.battery > 0 && !ui.settings.inspection && !useGame.getState().paused;
    const rcs = active && d.cruiseFuel > 0 && !o.deployed;
    const t = clock.getElapsedTime();
    rcsMat.uniforms.k.value = 0.75 + 0.25 * Math.sin(t * 47);
    mainMat.uniforms.k.value = 0.9 + 0.1 * Math.sin(t * 61);
    if (main.current) {
      main.current.visible = rcs && d.destination === 'asteroid' && d.engineEnabled && d.throttle > 0;
      main.current.scale.set(1, Math.max(0.05, d.throttle), 1);
    }
    // Commanded torque per axis: pilot input, else assist damping of residual rates.
    const cmd = (inp: number | undefined, rate: number) => (inp && Math.abs(inp) > 0.01 ? Math.sign(inp) : d.assist && Math.abs(rate) > 0.008 ? -Math.sign(rate) : 0);
    const yaw = cmd(input.yaw ?? input.turn, o.yawRate);
    const pitch = cmd(input.pitch ?? input.forward, o.pitchRate);
    const roll = cmd(input.roll, o.rollRate);
    const tx = Math.sign(input.rcsX ?? 0), tz = Math.sign(input.rcsZ ?? 0);
    jetsDef.forEach((j, i) => {
      const g = jets.current[i];
      if (!g) return;
      const [qx, qz] = j.quad;
      let on = false;
      if (j.dir[0] !== 0) {
        // Side nozzles: yaw couple on diagonal quads, or lateral translation.
        on = (yaw !== 0 && qx * qz === yaw) || (tx !== 0 && qx === -tx);
      } else {
        const up = j.dir[1] > 0;
        // Vertical nozzles: pitch couple front/back, roll couple left/right, forward/back translation.
        on = (pitch !== 0 && (qz === pitch) === up) || (roll !== 0 && (qx === roll) === up) || (tz !== 0 && up === tz > 0);
      }
      g.visible = rcs && on;
    });
  });
  return (
    <>
      <group position={[0, -3.32, 0]}>
        <group ref={main} visible={false}>
          <mesh position={[0, -0.75, 0]} material={mainMat}>
            <cylinderGeometry args={[0.3, 0.9, 1.8, 24, 1, true]} />
          </mesh>
          <pointLight position={[0, -0.6, 0]} color="#ffcf9a" intensity={6} distance={6} />
        </group>
      </group>
      {jetsDef.map((j, i) => {
        const p = quadPos(j.quad).add(new THREE.Vector3(j.dir[0] * 0.18, j.dir[1] * 0.18, j.dir[2] * 0.18));
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...j.dir));
        return (
          <group key={i} position={p} quaternion={q}>
            <group ref={(n) => { jets.current[i] = n; }} visible={false}>
              <mesh position={[0, -0.2, 0]} material={rcsMat}>
                <cylinderGeometry args={[0.03, 0.13, 0.4, 12, 1, true]} />
              </mesh>
            </group>
          </group>
        );
      })}
    </>
  );
}
