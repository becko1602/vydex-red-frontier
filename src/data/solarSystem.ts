import { sources } from "./sourceRegistry";

export type SolarBodyId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "moon"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

export type SolarBody = {
  id: SolarBodyId;
  name: string;
  radiusM: number;
  massKg: number;
  muM3S2: number;
  gravityMS2: number;
  siderealRotationS: number;
  orbitalPeriodS: number;
  axialTiltDeg: number;
  atmosphere: string;
  source: { title: string; url: string };
};

const day = 86_400;

/**
 * Reference values are rounded educational constants in SI units. Rendering
 * uses an explicitly compressed visual scale; these values are not renderer
 * dimensions and are not used as mission telemetry without a model note.
 */
export const solarSystem: Record<SolarBodyId, SolarBody> = {
  sun: {
    id: "sun",
    name: "Sun",
    radiusM: 696_340_000,
    massKg: 1.98847e30,
    muM3S2: 1.3271244004127942e20,
    gravityMS2: 274,
    siderealRotationS: 25.38 * day,
    orbitalPeriodS: 0,
    axialTiltDeg: 7.25,
    atmosphere: "Photosphere and corona; no solid surface.",
    source: sources.jpl,
  },
  mercury: {
    id: "mercury",
    name: "Mercury",
    radiusM: 2_439_700,
    massKg: 3.3011e23,
    muM3S2: 2.2032e13,
    gravityMS2: 3.7,
    siderealRotationS: 58.646 * day,
    orbitalPeriodS: 87.969 * day,
    axialTiltDeg: 0.034,
    atmosphere: "Extremely tenuous exosphere.",
    source: sources.jpl,
  },
  venus: {
    id: "venus",
    name: "Venus",
    radiusM: 6_051_800,
    massKg: 4.8675e24,
    muM3S2: 3.24859e14,
    gravityMS2: 8.87,
    siderealRotationS: -243.025 * day,
    orbitalPeriodS: 224.701 * day,
    axialTiltDeg: 177.36,
    atmosphere: "Dense CO2 atmosphere with global cloud cover.",
    source: sources.venusFacts,
  },
  earth: {
    id: "earth",
    name: "Earth",
    radiusM: 6_371_000,
    massKg: 5.9722e24,
    muM3S2: 3.986004418e14,
    gravityMS2: 9.80665,
    siderealRotationS: 23.9344696 * 3600,
    orbitalPeriodS: 365.256363004 * day,
    axialTiltDeg: 23.439,
    atmosphere: "Nitrogen-oxygen atmosphere with liquid-water oceans.",
    source: sources.earth,
  },
  moon: {
    id: "moon",
    name: "Moon",
    radiusM: 1_737_400,
    massKg: 7.342e22,
    muM3S2: 4.9048695e12,
    gravityMS2: 1.62,
    siderealRotationS: 27.321661 * day,
    orbitalPeriodS: 27.321661 * day,
    axialTiltDeg: 6.68,
    atmosphere: "Tenuous exosphere; no useful aerodynamic braking.",
    source: sources.moon,
  },
  mars: {
    id: "mars",
    name: "Mars",
    radiusM: 3_389_500,
    massKg: 6.4171e23,
    muM3S2: 4.282837e13,
    gravityMS2: 3.73,
    siderealRotationS: 24.6229 * 3600,
    orbitalPeriodS: 686.98 * day,
    axialTiltDeg: 25.19,
    atmosphere: "Thin CO2 atmosphere; dust and terrain dominate the local visual model.",
    source: sources.mars,
  },
  jupiter: {
    id: "jupiter",
    name: "Jupiter",
    radiusM: 69_911_000,
    massKg: 1.89813e27,
    muM3S2: 1.26686534e17,
    gravityMS2: 24.79,
    siderealRotationS: 9.925 * 3600,
    orbitalPeriodS: 11.862 * 365.256363004 * day,
    axialTiltDeg: 3.13,
    atmosphere: "Hydrogen-helium gas giant with no solid surface.",
    source: sources.jupiterFacts,
  },
  saturn: {
    id: "saturn",
    name: "Saturn",
    radiusM: 58_232_000,
    massKg: 5.6834e26,
    muM3S2: 3.7931187e16,
    gravityMS2: 10.44,
    siderealRotationS: 10.656 * 3600,
    orbitalPeriodS: 29.4571 * 365.256363004 * day,
    axialTiltDeg: 26.73,
    atmosphere: "Hydrogen-helium gas giant with a prominent icy ring system.",
    source: sources.saturnFacts,
  },
  uranus: {
    id: "uranus",
    name: "Uranus",
    radiusM: 25_362_000,
    massKg: 8.681e25,
    muM3S2: 5.793939e15,
    gravityMS2: 8.69,
    siderealRotationS: -17.24 * 3600,
    orbitalPeriodS: 84.016846 * 365.256363004 * day,
    axialTiltDeg: 97.77,
    atmosphere: "Cold hydrogen-helium-methane atmosphere.",
    source: sources.jpl,
  },
  neptune: {
    id: "neptune",
    name: "Neptune",
    radiusM: 24_622_000,
    massKg: 1.02413e26,
    muM3S2: 6.836529e15,
    gravityMS2: 11.15,
    siderealRotationS: 16.11 * 3600,
    orbitalPeriodS: 164.79132 * 365.256363004 * day,
    axialTiltDeg: 28.32,
    atmosphere: "Dynamic hydrogen-helium-methane atmosphere.",
    source: sources.jpl,
  },
};

export const solarSystemBodies = Object.values(solarSystem);

