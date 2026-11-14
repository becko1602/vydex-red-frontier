import { sources, retrievalDate } from "./sourceRegistry";
type Entry = {
  value: number;
  unit: string;
  siValue: number;
  siUnit: string;
  sourceId: keyof typeof sources;
  interpretation: string;
  precision: string;
  kind: "Reference fact" | "Educational approximation";
  retrieved: string;
};
const fact = (
  value: number,
  unit: string,
  sourceId: Entry["sourceId"],
  interpretation: string,
  precision = "As published",
): Entry => ({
  value,
  unit,
  siValue:
    value *
    (unit === "h"
      ? 3600
      : unit === "days" || unit === "Earth days"
        ? 86400
        : 1),
  siUnit: ["h", "days", "Earth days"].includes(unit) ? "s" : unit,
  sourceId,
  interpretation,
  precision,
  kind: "Reference fact",
  retrieved: retrievalDate,
});
export const scienceConstants = {
  moonGravity: fact(
    1.62,
    "m/s²",
    "moon",
    "Uniform lunar surface gravity approximation",
    "0.01 m/s²",
  ),
  moonRadius: fact(
    1737400,
    "m",
    "moon",
    "Volumetric mean lunar radius",
    "100 m",
  ),
  moonDistance: fact(
    384400000,
    "m",
    "moon",
    "Reference Earth–Moon semimajor axis, not a live range",
    "100000 m",
  ),
  earthRadius: fact(
    6371000,
    "m",
    "earth",
    "Volumetric mean radius for circular educational orbit",
    "1000 m",
  ),
  earthMu: fact(
    3.986e14,
    "m³/s²",
    "earth",
    "Rounded terrestrial gravitational parameter; source 0.39860 × 10^6 km³/s²",
    "5 significant figures",
  ),
  marsRadius: fact(3389500, "m", "mars", "Volumetric mean radius", "100 m"),
  marsGravity: fact(
    3.73,
    "m/s²",
    "mars",
    "Mean surface gravity; uniform local gameplay approximation",
    "0.01 m/s²",
  ),
  equatorialAcceleration: fact(
    3.69,
    "m/s²",
    "mars",
    "Equatorial surface acceleration; not used by the local model",
    "0.01 m/s²",
  ),
  solarDay: fact(
    24.6597,
    "h",
    "mars",
    "Mean solar day; distinct from sidereal rotation",
    "0.0001 h",
  ),
  siderealRotation: fact(
    24.6229,
    "h",
    "mars",
    "Rotation relative to distant stars",
    "0.0001 h",
  ),
  marsPeriod: fact(
    686.98,
    "Earth days",
    "mars",
    "Reference orbital period",
    "0.001 day",
  ),
  marsOrbit: fact(
    227956000000,
    "m",
    "mars",
    "Rounded reference semimajor axis; circular model radius",
    "1000000 m",
  ),
  earthOrbit: fact(
    149598000000,
    "m",
    "mars",
    "Rounded reference semimajor axis; circular model radius",
    "1000000 m",
  ),
  eccentricity: fact(
    0.0935,
    "dimensionless",
    "mars",
    "Real-orbit reference; circular teaching model sets eccentricity to zero",
    "0.0001",
  ),
  marsFlux: fact(
    586.2,
    "W/m²",
    "mars",
    "Reference solar irradiance; actual game flux uses inverse square",
    "0.1 W/m²",
  ),
  earthFlux: fact(
    1361,
    "W/m²",
    "mars",
    "Reference irradiance at 1 AU",
    "0.1 W/m²",
  ),
  pressure: fact(
    636,
    "Pa",
    "mars",
    "Reference surface pressure; varies with location and season",
    "1 Pa",
  ),
  density: fact(
    0.016,
    "kg/m³",
    "mars",
    "Approximate surface density; substantial variability",
    "0.001 kg/m³",
  ),
  scaleHeight: fact(
    11000,
    "m",
    "mars",
    "Reference scale height for a deliberately simplified exponential atmosphere",
    "1000 m",
  ),
  co2: fact(
    0.951,
    "fraction",
    "mars",
    "Approximate atmospheric carbon dioxide fraction",
    "0.001",
  ),
  synodic: fact(
    779.94,
    "days",
    "mars",
    "Reference Earth–Mars synodic period",
    "0.01 day",
  ),
  c: fact(299792458, "m/s", "jpl", "Speed of light in vacuum", "Exact"),
  AU: fact(149597870700, "m", "jpl", "Astronomical unit", "Exact"),
  muSun: fact(
    1.32712440041279419e20,
    "m³/s²",
    "jpl",
    "Solar gravitational parameter",
  ),
  day: fact(86400, "s", "jpl", "Conventional Earth day", "Exact"),
  g0: fact(
    9.80665,
    "m/s²",
    "standard",
    "Conventional standard gravity for specific impulse; not Mars gravity",
    "Exact conventional value",
  ),
};
export const C = Object.fromEntries(
  Object.entries(scienceConstants).map(([k, v]) => [k, v.siValue]),
) as { [K in keyof typeof scienceConstants]: number };
