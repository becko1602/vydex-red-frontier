import { C } from "../data/scienceConstants";
import type { SolarBodyId } from "../data/solarSystem";

export type HeliocentricBodyId =
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

type OrbitDefinition = {
  radiusM: number;
  periodS: number;
  inclinationRad: number;
  phaseRad: number;
};

/**
 * Rounded educational heliocentric parameters. They drive the visualization
 * only; the Mars transfer solver remains in physics.ts and uses its own
 * circular Earth/Mars model.
 */
export const heliocentricOrbits: Record<HeliocentricBodyId, OrbitDefinition> = {
  mercury: { radiusM: 0.387 * C.AU, periodS: 87.969 * 86400, inclinationRad: 0.122, phaseRad: 0.4 },
  venus: { radiusM: 0.723 * C.AU, periodS: 224.701 * 86400, inclinationRad: 0.059, phaseRad: 1.6 },
  earth: { radiusM: C.earthOrbit, periodS: 365.256 * 86400, inclinationRad: 0, phaseRad: 0 },
  mars: { radiusM: C.marsOrbit, periodS: 686.98 * 86400, inclinationRad: 0.032, phaseRad: Math.PI - 0.6 },
  jupiter: { radiusM: 5.204 * C.AU, periodS: 11.862 * 365.256 * 86400, inclinationRad: 0.022, phaseRad: 2.4 },
  saturn: { radiusM: 9.537 * C.AU, periodS: 29.457 * 365.256 * 86400, inclinationRad: 0.043, phaseRad: 4.1 },
  uranus: { radiusM: 19.191 * C.AU, periodS: 84.0168 * 365.256 * 86400, inclinationRad: 0.013, phaseRad: 5.1 },
  neptune: { radiusM: 30.07 * C.AU, periodS: 164.79 * 365.256 * 86400, inclinationRad: 0.031, phaseRad: 5.7 },
};

export const heliocentricBodyIds = Object.keys(
  heliocentricOrbits,
) as HeliocentricBodyId[];

export function heliocentricPosition(
  body: HeliocentricBodyId,
  elapsedSeconds: number,
) {
  const orbit = heliocentricOrbits[body];
  const angle =
    orbit.phaseRad + (Math.max(0, elapsedSeconds) / orbit.periodS) * Math.PI * 2;
  const x = orbit.radiusM * Math.cos(angle);
  const z = orbit.radiusM * Math.sin(angle);
  return {
    x,
    y: Math.sin(orbit.inclinationRad) * z,
    z: Math.cos(orbit.inclinationRad) * z,
    angle,
  };
}

export function isSelectableHeliocentricBody(
  body: SolarBodyId,
): body is HeliocentricBodyId {
  return body !== "sun" && body !== "moon";
}
