import type { DestinationId } from "../data/destinations";

/**
 * Atmospheric entry probe (zond) model.
 * Values follow published reference atmospheres (Galileo probe for Jupiter,
 * Pioneer Venus / Venera for Venus, Voyager radio occultation for the others).
 * Altitudes are relative to the 1-bar level (Venus: relative to the surface).
 * The descent is time-compressed; the displayed mission clock is real time.
 */
export type ProbePhase = "attached" | "coast" | "entry" | "parachute" | "descent" | "complete";
export type ProbeState = {
  phase: ProbePhase;
  t: number;
  /** 0..1 progress through the measured column. */
  progress: number;
  altitudeKm: number;
  pressureBar: number;
  temperatureK: number;
  velocity: number;
  peakG: number;
  dataKb: number;
};
export const initialProbe = (): ProbeState => ({
  phase: "attached",
  t: 0,
  progress: 0,
  altitudeKm: 0,
  pressureBar: 0,
  temperatureK: 0,
  velocity: 0,
  peakG: 0,
  dataKb: 0,
});

export const PROBE_PHASES: Record<ProbePhase, { duration: number; next: ProbePhase; message: string; label: string }> = {
  attached: { duration: Infinity, next: "coast", message: "", label: "ATTACHED TO ORBITER" },
  coast: {
    duration: 9,
    next: "entry",
    message: "Entry interface: the aeroshell meets the upper atmosphere. Shock-layer plasma blacks out the radio link.",
    label: "COAST TO ENTRY",
  },
  entry: {
    duration: 11,
    next: "parachute",
    message: "Peak heating passed. Pilot chute fired, aft cover pulled, heat shield released. Main parachute open.",
    label: "HYPERSONIC ENTRY",
  },
  parachute: {
    duration: 10,
    next: "descent",
    message: "Probe stable under its main parachute. Nephelometer, mass spectrometer and wind experiment are sampling.",
    label: "PARACHUTE DEPLOY",
  },
  descent: {
    duration: 34,
    next: "complete",
    message: "Signal lost: pressure and heat ended the probe's mission. Its full profile was relayed to the orbiter.",
    label: "SCIENCE DESCENT",
  },
  complete: { duration: Infinity, next: "complete", message: "", label: "MISSION COMPLETE" },
};

type Column = { startKm: number; endKm: number; H: number; p0: number; T0: number; lapse: number; molar: number; g: number; mass: number; area: number };
const columns: Partial<Record<DestinationId, Column>> = {
  // p0/T0 at the reference level (1 bar, or Venus surface). lapse in K/km.
  venus: { startKm: 66, endKm: 0, H: 15.9, p0: 92, T0: 737, lapse: 7.7, molar: 0.0434, g: 8.87, mass: 310, area: 4.9 },
  jupiter: { startKm: 25, endKm: -150, H: 27, p0: 1, T0: 165, lapse: 2.0, molar: 0.0023, g: 24.79, mass: 339, area: 4.9 },
  saturn: { startKm: 40, endKm: -230, H: 59.5, p0: 1, T0: 134, lapse: 0.75, molar: 0.0021, g: 10.44, mass: 300, area: 4.9 },
  uranus: { startKm: 30, endKm: -110, H: 27.7, p0: 1, T0: 76, lapse: 0.9, molar: 0.0023, g: 8.69, mass: 300, area: 4.9 },
  neptune: { startKm: 30, endKm: -90, H: 19.7, p0: 1, T0: 72, lapse: 1.0, molar: 0.0023, g: 11.15, mass: 300, area: 4.9 },
};

/** Pressure, temperature and parachute terminal descent rate at a fraction of the descent column. */
export function atmosphereAt(destination: DestinationId, progress: number) {
  const c = columns[destination] ?? columns.jupiter!;
  const altitudeKm = c.startKm + (c.endKm - c.startKm) * Math.min(1, Math.max(0, progress));
  const ref = destination === "venus" ? 0 : 0;
  const z = altitudeKm - ref;
  const pressureBar = c.p0 * Math.exp(-z / c.H);
  const temperatureK = Math.max(40, c.T0 - c.lapse * z);
  const rho = (pressureBar * 1e5 * c.molar) / (8.314 * temperatureK);
  // Terminal velocity under a 2.5 m main chute (Cd ≈ 0.8) + probe body.
  const descentRate = Math.sqrt((2 * c.mass * c.g) / (rho * 0.8 * c.area));
  return { altitudeKm, pressureBar, temperatureK, density: rho, descentRate };
}
