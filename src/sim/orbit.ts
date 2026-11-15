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
  z: destination === "asteroid" ? 35 : 0,
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
/**
 * Rigid-body attitude + RCS translation step.
 * Torque comes from 4 × 22 N RCS quads on a ~1.6 m arm (≈140 N·m) or from
 * reaction wheels (~0.6 N·m, only on the deployed satellite).
 * With assist ON the controller is rate-command / attitude-hold: a held key
 * commands a turn rate (up to ~17°/s); releasing it nulls the rate, and
 * Space (brake) returns the vehicle to its reference attitude.
 */
export const MAX_RATE = 0.3;
export function orbitStep(
  s: OrbitalState,
  d: Design,
  fuel: number,
  dt: number,
  input: Input,
  destination: "earth" | "asteroid",
  assist: boolean,
  mainThrottle = 0,
  stackAttached = false,
) {
  if (s.crashed) return 0;
  const m = s.deployed ? masses(d).surface : masses(d).cruiseDry + fuel;
  if (
    (!s.deployed && !installed(d, "cruiseEngine")) ||
    !installed(d, "computer") ||
    m <= 0
  )
    return 0;
  void stackAttached;
  const yawInput = input.yaw ?? input.turn,
    pitchInput = input.pitch ?? input.forward,
    rollInput = input.roll ?? 0;
  const reactionWheels = destination === "earth" && s.deployed;
  const inertia = m * 0.55; // kg·m² for a ~2 m bus with folded/unfolded wings
  const maxTorque = reactionWheels ? 60 : 140;
  const controller = (angle: number, rate: number, command: number) => {
    if (command) {
      const targetRate = command * MAX_RATE;
      return assist
        ? clamp((targetRate - rate) * inertia * 3, -maxTorque, maxTorque)
        : command * maxTorque;
    }
    // Released controls + assist (or Space): PD return to the reference (nadir / target-pointing) attitude.
    if (assist || input.brake) return clamp((-angle * 0.9 - rate * 2.2) * inertia, -maxTorque, maxTorque);
    return 0;
  };
  const ty = controller(s.yaw, s.yawRate, yawInput),
    tp = controller(s.pitch, s.pitchRate, pitchInput),
    tr = controller(s.roll, s.rollRate, rollInput);
  // Translation: 4 × 22 N axial RCS per axis ≈ 45 N available.
  const F = 45;
  let fx = (input.rcsX ?? 0) * F,
    fz = (input.rcsZ ?? 0) * F,
    fy = 0;
  if (destination === "asteroid" && input.rcsX === undefined && input.rcsZ === undefined) {
    fx = -input.turn * F;
    fz = -input.forward * F;
  }
  const manual = !!(fx || fz || mainThrottle);
  if (destination === "asteroid" && s.autopilot && !manual) {
    const guidance = (error: number, v: number) =>
      clamp((Math.sign(error) * Math.min(0.65, Math.sqrt(2 * (F / m) * Math.abs(error) * 0.65)) - v) * m * 1.8, -F, F);
    fx = guidance(-s.x, s.vx);
    fz = guidance(14 - s.z, s.vz);
    fy = guidance(-s.y, s.vy);
  } else if (input.brake || (assist && !manual)) {
    fx = clamp(-s.vx * m * 2, -F, F);
    fz = clamp(-s.vz * m * 2, -F, F);
    fy = clamp(-s.vy * m * 2, -F, F);
  }
  const main = destination === "asteroid" ? 220 * clamp(mainThrottle, 0, 1) : 0;
  const rcsTorque = reactionWheels ? 0 : (Math.abs(ty) + Math.abs(tp) + Math.abs(tr)) / 1.6;
  const demand = ((rcsTorque + Math.abs(fx) + Math.abs(fz) + Math.abs(fy) + main) / (320 * C.g0)) * dt;
  const used = Math.min(Math.max(0, fuel), demand),
    fraction = demand > 0 ? used / demand : reactionWheels ? 1 : 0;
  const rotFraction = reactionWheels ? 1 : fraction;
  s.fuelUsed += used;
  s.yawRate += ((ty * rotFraction) / inertia) * dt;
  s.pitchRate += ((tp * rotFraction) / inertia) * dt;
  s.rollRate += ((tr * rotFraction) / inertia) * dt;
  s.yaw += s.yawRate * dt;
  s.pitch += s.pitchRate * dt;
  s.roll += s.rollRate * dt;
  // Body-frame main engine thrust (+Z nozzle axis points backward, thrust forward).
  const fwdX = -Math.sin(s.yaw) * Math.cos(s.pitch),
    fwdY = Math.sin(s.pitch),
    fwdZ = -Math.cos(s.yaw) * Math.cos(s.pitch);
  s.vx += ((fx + main * fwdX) * fraction / m) * dt;
  s.vy += ((fy + main * fwdY) * fraction / m) * dt;
  s.vz += ((fz + main * fwdZ) * fraction / m) * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  if (destination === "asteroid") {
    if (Math.hypot(s.x, s.y, s.z) < 10) s.crashed = true;
  } else {
    // Station-keeping box around the reference orbit slot.
    for (const k of ["x", "y", "z"] as const) {
      const lim = 25;
      if (Math.abs(s[k]) > lim) {
        s[k] = Math.sign(s[k]) * lim;
        const v = (k === "x" ? "vx" : k === "y" ? "vy" : "vz") as "vx" | "vy" | "vz";
        s[v] = 0;
      }
    }
  }
  return used;
}
