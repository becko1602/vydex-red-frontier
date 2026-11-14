import { C } from "./scienceConstants";
export type DestinationId =
  | "earth"
  | "moon"
  | "mars"
  | "asteroid"
  | "mercury"
  | "venus"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";
export type PlayableDestination = "earth" | "moon" | "mars" | "asteroid";
export const destinations: Record<
  DestinationId,
  {
    name: string;
    subtitle: string;
    color: string;
    playable: boolean;
    difficulty: string;
    minutes: string;
    objective: string;
    difference: string;
  }
> = {
  earth: {
    name: "EARTH ORBIT",
    subtitle: "THE FIRST STEP",
    color: "#79c9ec",
    playable: true,
    difficulty: "Introduction",
    minutes: "4–6 min",
    objective:
      "Stabilize the satellite, deploy its solar array, capture an Earth observation and downlink it.",
    difference:
      "A 400 km circular parking orbit. Local attitude control is separate from the calculated orbital motion.",
  },
  moon: {
    name: "MOON",
    subtitle: "SILENCE & SHADOW",
    color: "#cbd2de",
    playable: true,
    difficulty: "Intermediate",
    minutes: "5–8 min",
    objective:
      "Land an uncrewed station, photograph the landing site, record a spectrum, and transmit both.",
    difference:
      "1.62 m/s² gravity. No air braking: engines must remove all final-descent speed. A stationary science lander replaces the rover.",
  },
  mars: {
    name: "MARS",
    subtitle: "THE RED FRONTIER",
    color: "#ee885b",
    playable: true,
    difficulty: "Intermediate",
    minutes: "6–10 min",
    objective:
      "Land, deploy a solar rover, complete your imaging or geology survey and transmit every observation.",
    difference:
      "3.73 m/s² gravity and a thin simplified atmosphere. Balance payload, landing fuel and surface electrical power.",
  },
  asteroid: {
    name: "ASTEROID",
    subtitle: "SMALL WORLD, PRECISE MOVES",
    color: "#b0c39e",
    playable: true,
    difficulty: "Precision",
    minutes: "5–7 min",
    objective:
      "Rendezvous with fictional asteroid VY-26, stop in its science corridor, scan, sample and downlink.",
    difference:
      "Fictional 36-day near-Earth scenario. Local relative motion assumes negligible gravity and no drag; even small thrust changes your drift.",
  },
  mercury: {
    name: "MERCURY",
    subtitle: "ORBITAL HEAT",
    color: "#b7a18d",
    playable: false,
    difficulty: "Probe preview",
    minutes: "Orbiter",
    objective:
      "Plan a heat-resistant probe to map Mercury's surface and measure its exosphere from orbit.",
    difference:
      "A close solar orbit creates extreme thermal and communications constraints. This campaign uses an orbiter, not a rover landing.",
  },
  venus: {
    name: "VENUS",
    subtitle: "CLOUD OCEAN",
    color: "#e5be7c",
    playable: false,
    difficulty: "Probe preview",
    minutes: "Orbiter",
    objective:
      "Plan a radar and atmospheric probe to study Venus beneath its permanent cloud cover.",
    difference:
      "A dense atmosphere and extreme surface conditions require a dedicated probe architecture. No Mars-style rover landing is shown.",
  },
  jupiter: {
    name: "JUPITER",
    subtitle: "THE GAS GIANT",
    color: "#d8baa3",
    playable: false,
    difficulty: "Probe preview",
    minutes: "Orbiter",
    objective:
      "Plan a radiation-hardened orbiter to observe Jupiter's atmosphere and magnetosphere.",
    difference:
      "Jupiter has no solid surface. The mission model is orbital observation, not landing or surface sampling.",
  },
  saturn: {
    name: "SATURN",
    subtitle: "RINGS OF ICE",
    color: "#d4c699",
    playable: false,
    difficulty: "Probe preview",
    minutes: "Orbiter",
    objective:
      "Plan an orbiter to survey Saturn's rings, atmosphere and major moons.",
    difference:
      "The ring system is shown at an illustrative scale. No solid planetary surface exists for a Mars-style landing.",
  },
  uranus: {
    name: "URANUS",
    subtitle: "THE TILTED WORLD",
    color: "#9fc9cf",
    playable: false,
    difficulty: "Probe preview",
    minutes: "Orbiter",
    objective:
      "Plan a distant orbiter to measure Uranus's atmosphere, rings and unusual axial tilt.",
    difference:
      "A long-duration outer-planet mission depends on power, communications and thermal planning rather than landing.",
  },
  neptune: {
    name: "NEPTUNE",
    subtitle: "DEEP BLUE FRONTIER",
    color: "#7297d1",
    playable: false,
    difficulty: "Probe preview",
    minutes: "Orbiter",
    objective:
      "Plan a deep-space probe to observe Neptune's winds, atmosphere and ring system.",
    difference:
      "Neptune is a gas giant with no solid surface. The educational mission model is a long-range flyby or orbiter.",
  },
};
export function environment(destination: DestinationId) {
  return destination === "moon"
    ? {
        gravity: C.moonGravity,
        density: 0,
        scaleHeight: 1,
        solarDistance: C.earthOrbit,
        dust: 1,
      }
    : destination === "mars"
      ? {
          gravity: C.marsGravity,
          density: C.density,
          scaleHeight: C.scaleHeight,
          solarDistance: C.marsOrbit,
          dust: 0.72,
        }
      : {
          gravity: 0,
          density: 0,
          scaleHeight: 1,
          solarDistance: C.earthOrbit,
          dust: 1,
        };
}
export const isPlayable = (id: DestinationId): id is PlayableDestination =>
  destinations[id].playable;
export const LUNAR_FLIGHT_SECONDS = 3 * 86400; // Fictional direct-transfer schedule, not a heliocentric Hohmann orbit.
export const ASTEROID_FLIGHT_SECONDS = 36 * 86400; // Fictional VY-26 rendezvous schedule, not a real ephemeris.
