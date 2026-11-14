import type { FlightData } from "./game";
import { transferModel } from "./physics";
import {
  ASTEROID_FLIGHT_SECONDS,
  LUNAR_FLIGHT_SECONDS,
} from "../data/destinations";
export const launchDuration = (d: Pick<FlightData, "demo">) =>
  d.demo ? 16 : 36;
export const launchFraction = (d: FlightData) =>
  d.launchChecks.every(Boolean)
    ? Math.min(1, d.stageTime / launchDuration(d))
    : 0;
export function launchPhase(d: FlightData) {
  const p = launchFraction(d);
  return p < 0.12
    ? "COUNTDOWN & IGNITION"
    : p < 0.4
      ? "ATMOSPHERIC ASCENT"
      : p < 0.55
        ? "LAUNCH VEHICLE SEPARATION"
        : p < 0.7
          ? "FAIRING RELEASE"
          : p < 0.86
            ? "EARTH PARKING ORBIT"
            : d.destination === "earth"
              ? "SATELLITE HANDOVER"
              : "DEPARTURE BURN";
}
export function routeInfo(d: FlightData) {
  return d.destination === "mars"
    ? {
        seconds: transferModel().time,
        title: "Idealized circular-orbit Hohmann transfer",
        detail:
          "Kepler timing and initial phase align Mars with arrival. No live positions.",
        screenSeconds: d.demo ? 18 : 45,
      }
    : d.destination === "moon"
      ? {
          seconds: LUNAR_FLIGHT_SECONDS,
          title: "Illustrative geocentric lunar route",
          detail:
            "Fictional 3-day direct-transfer schedule. Not a heliocentric Mars transfer or a solved lunar ephemeris.",
          screenSeconds: d.demo ? 18 : 28,
        }
      : d.destination === "asteroid"
        ? {
            seconds: ASTEROID_FLIGHT_SECONDS,
            title: "Fictional VY-26 rendezvous route",
            detail:
              "A 36-day near-Earth scenario. The asteroid, flight schedule and trajectory illustration are fictional.",
            screenSeconds: d.demo ? 18 : 45,
          }
        : {
            seconds: 5400,
            title: "Earth parking-orbit handover",
            detail:
              "Illustrative 90-minute provider handover; the deployment scene uses a separate calculated 400 km circular orbit.",
            screenSeconds: d.demo ? 18 : 15,
          };
}
