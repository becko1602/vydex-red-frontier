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
export type PlayableDestination = DestinationId;
/** How a destination is explored. Gas/ice giants and Venus use an orbiter + entry probe. */
export type MissionKind = "orbital" | "rendezvous" | "lander" | "rover" | "probe";
export function missionKind(id: DestinationId): MissionKind {
  if (id === "earth") return "orbital";
  if (id === "asteroid") return "rendezvous";
  if (id === "mars") return "rover";
  if (id === "moon" || id === "mercury") return "lander";
  return "probe";
}
/** Airless bodies where a stationary science lander is used (Moon, Mercury). */
export const isLunarLike = (id: DestinationId) => id === "moon" || id === "mercury";
/** Real equatorial surface (or 1-bar) gravity, m/s². */
export const SURFACE_GRAVITY: Record<DestinationId, number> = {
  earth: 9.807, moon: 1.62, mars: 3.721, asteroid: 0.0001, mercury: 3.7,
  venus: 8.87, jupiter: 24.79, saturn: 10.44, uranus: 8.69, neptune: 11.15,
};
/** Mean distance from the Sun, AU. */
export const SOLAR_DISTANCE_AU: Record<DestinationId, number> = {
  earth: 1, moon: 1, asteroid: 1.1, mars: 1.524, mercury: 0.387, venus: 0.723,
  jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07,
};
/** Compressed play-time for the cruise phase (seconds at 1×) and the real transfer it represents (days). */
export const TRANSFER: Record<DestinationId, { playSeconds: number; realDays: number; correctionDv: number }> = {
  earth: { playSeconds: 15, realDays: 0.4, correctionDv: 30 },
  moon: { playSeconds: 28, realDays: 3, correctionDv: 60 },
  mars: { playSeconds: 45, realDays: 259, correctionDv: 120 },
  asteroid: { playSeconds: 45, realDays: 36, correctionDv: 30 },
  mercury: { playSeconds: 50, realDays: 2400, correctionDv: 140 },
  venus: { playSeconds: 40, realDays: 146, correctionDv: 90 },
  jupiter: { playSeconds: 55, realDays: 997, correctionDv: 110 },
  saturn: { playSeconds: 60, realDays: 2200, correctionDv: 110 },
  uranus: { playSeconds: 65, realDays: 3400, correctionDv: 100 },
  neptune: { playSeconds: 70, realDays: 4400, correctionDv: 100 },
};
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
    subtitle: "INTO THE SOLAR FURNACE",
    color: "#b7a18d",
    playable: true,
    difficulty: "Advanced",
    minutes: "6–9 min",
    objective:
      "Brake into Mercury's airless gravity well, land beside a shadowed crater rim, image the site, record a regolith spectrum and downlink both.",
    difference:
      "3.70 m/s² gravity and no atmosphere: the engine removes every metre per second. Sunlight is ~6.7× stronger than at Earth, so heat, not power, is the constraint.",
  },
  venus: {
    name: "VENUS",
    subtitle: "UNDER THE ACID CLOUDS",
    color: "#e5be7c",
    playable: true,
    difficulty: "Atmospheric probe",
    minutes: "6–9 min",
    objective:
      "Reach orbit, image the cloud deck, release an entry probe (zond) and relay its descent through 92-bar CO₂ to the orbiter.",
    difference:
      "No rover can survive 465 °C at the surface for long. The probe uses a heat shield, then parachutes through sulfuric-acid clouds while transmitting.",
  },
  jupiter: {
    name: "JUPITER",
    subtitle: "GAS GIANT ENTRY ZOND",
    color: "#d8baa3",
    playable: true,
    difficulty: "Atmospheric probe",
    minutes: "7–10 min",
    objective:
      "Stabilize in orbit, image the belts, release the entry probe and relay its parachute descent through ammonia and water clouds.",
    difference:
      "Jupiter has no solid surface. Like Galileo's probe (1995) the zond enters at ~47 km/s, survives the heat pulse, and transmits until pressure crushes it.",
  },
  saturn: {
    name: "SATURN",
    subtitle: "RINGED GIANT PROBE",
    color: "#d4c699",
    playable: true,
    difficulty: "Atmospheric probe",
    minutes: "7–10 min",
    objective:
      "Settle into orbit, image the rings, release the entry probe and relay its readings from Saturn's hydrogen-helium atmosphere.",
    difference:
      "No solid surface. Gravity at the cloud tops is 10.4 m/s²; the probe parachutes until pressure and heat end the mission.",
  },
  uranus: {
    name: "URANUS",
    subtitle: "THE TILTED ICE GIANT",
    color: "#9fc9cf",
    playable: true,
    difficulty: "Atmospheric probe",
    minutes: "7–10 min",
    objective:
      "Orbit the 98°-tilted ice giant, image it, release a methane-sounding entry probe and relay its data.",
    difference:
      "An ice giant: no solid surface, 8.7 m/s² gravity and −195 °C cloud tops. Sunlight is 1/370 of Earth's, so power margins are thin.",
  },
  neptune: {
    name: "NEPTUNE",
    subtitle: "DEEP BLUE FRONTIER",
    color: "#7297d1",
    playable: true,
    difficulty: "Atmospheric probe",
    minutes: "7–10 min",
    objective:
      "Reach orbit 4.5 billion km from the Sun, image the planet, release the entry probe and relay its descent through supersonic winds.",
    difference:
      "No solid surface; 11.2 m/s² gravity and the fastest winds in the Solar System (~2,100 km/h). Light-time to Earth is over 4 hours.",
  },
};
export function environment(destination: DestinationId) {
  if (destination === "mercury")
    return { gravity: SURFACE_GRAVITY.mercury, density: 0, scaleHeight: 1, solarDistance: C.earthOrbit * 0.387, dust: 1 };
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
