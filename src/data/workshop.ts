import {
  starter,
  type Design,
  type Objective,
  type StructuralPart,
} from "./gameBalance";
import { missionKind, type DestinationId } from "./destinations";
export type PartId =
  | StructuralPart
  | "battery"
  | "solar"
  | "antenna"
  | "camera"
  | "spectrometer"
  | "drill";
export type PartSpec = {
  name: string;
  purpose: string;
  mass: number;
  credits: number;
  power: number;
  slot: string;
  position: [number, number, number];
  size: [number, number, number];
  advantage: string;
  tradeoff: string;
  omission: string;
  example: string;
  performance: string;
  source: "rocket" | "mars" | "comms" | "jpl" | "asteroids";
};
export const parts: Record<PartId, PartSpec> = {
  body: {
    name: "Structural bus",
    purpose: "Supports tanks, computers and mission hardware.",
    mass: 150,
    credits: 10,
    power: 0,
    slot: "Central spine",
    position: [0, 0.2, 0],
    size: [2.2, 1.3, 2.2],
    advantage: "A common mounting backbone keeps the design manageable.",
    tradeoff: "Structural mass must be accelerated but produces no science.",
    omission: "No other component can be attached safely.",
    example:
      "Install the body first, then attach a battery to its equipment bay.",
    performance: "Primary structural mounting platform",
    source: "rocket",
  },
  tank: {
    name: "Propellant tanks",
    purpose: "Stores separate cruise and descent propellant supplies.",
    mass: 50,
    credits: 4,
    power: 0,
    slot: "Tank cradle",
    position: [0, 0.2, 0.9],
    size: [2.5, 1.1, 1.1],
    advantage: "More propellant can increase maneuver reserve.",
    tradeoff: "Every kilogram costs credits and increases wet mass.",
    omission: "Engines have no usable propellant supply.",
    example:
      "Adding descent fuel improves reserve but makes initial braking heavier.",
    performance: "Separate cruise / descent tanks; selectable fill mass",
    source: "rocket",
  },
  computer: {
    name: "Navigation computer",
    purpose: "Runs guidance, stabilization and queued commands.",
    mass: 15,
    credits: 3,
    power: 20,
    slot: "Avionics bay",
    position: [-0.7, 0.9, 0.4],
    size: [0.55, 0.38, 0.6],
    advantage: "Enables local autonomy and assisted controls.",
    tradeoff: "Electronics need continuous electrical power.",
    omission: "Preflight blocks guidance-critical missions.",
    example:
      "Earth commands arrive late; the computer drives a queued route locally.",
    performance:
      "20 W base avionics, counted once; satellite reaction wheels after deployment",
    source: "comms",
  },
  connector: {
    name: "Stage connector",
    purpose: "Connects the cruise deck to the mission payload.",
    mass: 10,
    credits: 2,
    power: 0,
    slot: "Separation ring",
    position: [0, -1.3, 0],
    size: [2.1, 0.22, 2.1],
    advantage: "Lets cruise hardware be discarded before landing.",
    tradeoff: "Adds a small amount of inert launch mass.",
    omission: "The cruise deck cannot attach.",
    example:
      "Separation removes the cruise deck and its engine from descent mass.",
    performance: "One cruise-stage interface",
    source: "rocket",
  },
  cruise: {
    name: "Cruise deck",
    purpose: "Carries the cruise engine and supporting structure.",
    mass: 90,
    credits: 8,
    power: 0,
    slot: "Cruise-stage ring",
    position: [0, -1.9, 0],
    size: [2.5, 0.7, 2.5],
    advantage: "Supports the correction maneuver during transfer.",
    tradeoff: "Must be launched, then discarded before landing.",
    omission: "The cruise engine has no compatible mounting deck.",
    example: "Keep cruise fuel separate; it cannot replace descent propellant.",
    performance: "Discarded with connector and cruise engine at arrival",
    source: "rocket",
  },
  cruiseEngine: {
    name: "Cruise engine",
    purpose: "Changes transfer velocity using cruise propellant.",
    mass: 20,
    credits: 5,
    power: 0,
    slot: "Cruise engine socket",
    position: [0, -2.7, 0],
    size: [0.85, 0.9, 0.85],
    advantage: "320 s fictional specific impulse gives efficient corrections.",
    tradeoff: "Consumes real propellant and requires tank + cruise deck.",
    omission: "The required correction burn cannot execute.",
    example: "A 120 m/s Mars correction consumes only cruise-stage propellant.",
    performance: "Isp 320 s; correction Δv depends on destination",
    source: "rocket",
  },
  descentEngine: {
    name: "Descent engine",
    purpose: "Removes speed during final powered descent.",
    mass: 25,
    credits: 7,
    power: 0,
    slot: "Lander thrust socket",
    position: [0, -0.85, 0],
    size: [0.9, 0.8, 0.9],
    advantage: "8,000 N thrust enables controlled braking.",
    tradeoff: "Thrust consumes propellant at thrust / (Isp × g0).",
    omission: "Moon and Mars powered descent cannot be authorized.",
    example: "With the same thrust, a heavier payload accelerates less.",
    performance: "8,000 N maximum; Isp 220 s",
    source: "rocket",
  },
  legs: {
    name: "Landing legs",
    purpose: "Provides four stable surface contact points.",
    mass: 25,
    credits: 3,
    power: 0,
    slot: "Landing hardpoints",
    position: [0, -0.4, 0],
    size: [3.9, 2.2, 3.9],
    advantage: "Supports a stable touchdown below the contact limits.",
    tradeoff: "Adds mass even while folded for travel.",
    omission:
      "Surface landing preflight fails; orbital missions do not need legs.",
    example:
      "A low vertical speed is insufficient if the vehicle touches down tilted.",
    performance: "Game limits: <3 m/s vertical, <2 m/s lateral, <12° tilt",
    source: "rocket",
  },
  rover: {
    name: "Solar exploration rover",
    purpose: "Carries instruments to reachable Mars science sites.",
    mass: 110,
    credits: 15,
    power: 80,
    slot: "Rover deployment deck",
    position: [0, 1.5, 0],
    size: [2.4, 1.2, 2.8],
    advantage: "Reaches separated targets after landing.",
    tradeoff: "Adds 110 kg and 80 W while driving, plus slope load.",
    omission:
      "Mars exploration cannot begin. Other missions use a stationary or orbital payload.",
    example:
      "Bring a camera for imaging; geological surveys need spectrometer + drill.",
    performance: "Arcade-assisted drive; 80 W plus bounded slope increment",
    source: "mars",
  },
  battery: {
    name: "Battery pack",
    purpose:
      "Stores electrical energy for avionics, instruments and transmission.",
    mass: 15,
    credits: 5,
    power: 0,
    slot: "Energy bay",
    position: [0.75, 0.9, 0.45],
    size: [0.65, 0.4, 0.65],
    advantage: "Keeps instruments working when generation is insufficient.",
    tradeoff: "Finite capacity; storage does not generate power.",
    omission: "The mission has no usable electrical reserve.",
    example:
      "A 100 W drill operating for one hour would consume 100 Wh before other loads.",
    performance: "600 Wh capacity; 480 Wh prepared initial charge",
    source: "jpl",
  },
  solar: {
    name: "Deployable solar array",
    purpose: "Converts sunlight into electrical power.",
    mass: 12,
    credits: 5,
    power: 0,
    slot: "Solar hinges",
    position: [0, 0.5, 0],
    size: [6, 0.12, 1.9],
    advantage: "Recharges the battery and supports long operations.",
    tradeoff:
      "Output depends on solar distance, orientation and scenario dust.",
    omission: "Preflight requires a sustainable power supply.",
    example: "Turning a fixed panel away from the Sun reduces generation.",
    performance: "2 m² area; 25% efficiency; a single cosine incidence factor",
    source: "mars",
  },
  antenna: {
    name: "High-gain antenna",
    purpose: "Receives commands and transmits stored observations.",
    mass: 5,
    credits: 4,
    power: 30,
    slot: "Communication mast",
    position: [-0.8, 1.6, 0.6],
    size: [1, 0.9, 1],
    advantage: "Returns scientific data to complete the mission.",
    tradeoff:
      "Adds 30 W while transmitting; signals still have a light-time delay.",
    omission:
      "Collected observations cannot reach Earth, so the objective cannot complete.",
    example:
      "A Mars observation counts only after its compressed acknowledgment.",
    performance: "30 W active transmission; delay = distance / c",
    source: "comms",
  },
  camera: {
    name: "Survey camera",
    purpose: "Records images of Earth, landing sites or rocky terrain.",
    mass: 3,
    credits: 3,
    power: 10,
    slot: "Optical mast",
    position: [0.45, 1.8, -0.7],
    size: [0.8, 0.6, 0.55],
    advantage: "Low-mass, low-power visual observations.",
    tradeoff: "An image alone does not establish mineral composition or life.",
    omission:
      "Imaging, Earth-observation and lunar photo objectives cannot complete.",
    example:
      "Drive within 6 m of a Mars target, stop and expose for 8 seconds.",
    performance: "10 W active; 8 s fictional observation",
    source: "mars",
  },
  spectrometer: {
    name: "Spectrometer",
    purpose: "Records a fictional spectral signature of surface material.",
    mass: 8,
    credits: 6,
    power: 25,
    slot: "Spectral sensor bay",
    position: [-0.8, 0.85, -0.7],
    size: [0.5, 0.65, 0.5],
    advantage: "Adds mineral-analysis capability beyond photographs.",
    tradeoff: "Heavier and more power-hungry than the camera.",
    omission:
      "Geological, lunar spectral and asteroid scan objectives cannot complete.",
    example:
      "A simulated iron-bearing signature is an educational result, not a real Mars measurement.",
    performance: "25 W active; 8 s fictional reading",
    source: "mars",
  },
  drill: {
    name: "Core sample drill",
    purpose: "Collects a shallow fictional Mars core sample.",
    mass: 15,
    credits: 8,
    power: 100,
    slot: "Rover tool socket",
    position: [0.9, 0.4, -1.25],
    size: [0.6, 1.2, 1],
    advantage: "Enables the Geological Survey sample objective.",
    tradeoff: "100 W active load and 15 kg carried through launch and landing.",
    omission: "A Mars geology mission lacks its required sample capability.",
    example:
      "The tool needs the rover mount; an orbital satellite has no compatible tool arm.",
    performance: "100 W active; 12 s sampling",
    source: "mars",
  },
  sampler: {
    name: "Asteroid sampling arm",
    purpose: "Collects a fictional contact sample after stable rendezvous.",
    mass: 12,
    credits: 8,
    power: 75,
    slot: "Probe tool flange",
    position: [0.9, 0.2, -1.3],
    size: [0.5, 0.5, 1.9],
    advantage: "Enables sample collection without deploying a rover.",
    tradeoff:
      "Approach speed must be below 0.35 m/s; mass and power are still required.",
    omission: "The asteroid mission cannot collect its required sample.",
    example:
      "Brake in the marked 5 m science corridor before extending the arm.",
    performance: "75 W for 10 s; VY-26 is a fictional target",
    source: "asteroids",
  },
  probe: {
    name: "Atmospheric entry probe",
    purpose: "A detachable zond with heat shield and parachute that descends into a gas giant or Venus and radios atmospheric data to the orbiter.",
    mass: 120,
    credits: 9,
    power: 40,
    slot: "Forward probe adapter",
    position: [0, 1.25, -0.15],
    size: [1.35, 0.75, 1.35],
    advantage: "Measures pressure, temperature and composition in place, where an orbiter can only look from above.",
    tradeoff: "120 kg of entry hardware; a one-shot instrument that survives only ~1 hour inside the atmosphere.",
    omission: "A probe mission to Venus or the giant planets cannot sample the atmosphere.",
    example: "Stabilize the orbiter, release the probe, then relay its readings during the parachute descent.",
    performance: "45° sphere-cone aeroshell, pilot + main parachute, 40 W science bus, relay via orbiter",
    source: "jpl",
  },
};
export const partIds = Object.keys(parts) as PartId[];
export const structuralIds = partIds.filter(
  (id) =>
    ![
      "camera",
      "spectrometer",
      "drill",
      "battery",
      "solar",
      "antenna",
    ].includes(id),
) as StructuralPart[];
export function installed(d: Design, id: PartId) {
  return id in d
    ? Boolean(d[id as keyof Design])
    : (d.parts?.[id as StructuralPart] ?? (id !== "sampler" && id !== "probe"));
}
export function changePart(d: Design, id: PartId, value: boolean): Design {
  if (
    ["camera", "spectrometer", "drill", "battery", "solar", "antenna"].includes(
      id,
    )
  )
    return { ...d, [id]: value };
  const legacy = Object.fromEntries(
    structuralIds.map((k) => [k, k !== "sampler" && k !== "probe"]),
  );
  return { ...d, parts: { ...legacy, ...d.parts, [id]: value } };
}
export function compatibility(
  d: Design,
  id: PartId,
  destination: DestinationId,
  attach = true,
) {
  if (attach) {
    if (id === "body") return "";
    if (!installed(d, "body"))
      return "Install the structural bus first; this part needs its mounting spine.";
    if (id === "cruise" && !installed(d, "connector"))
      return "Install a stage connector before the cruise deck.";
    if (id === "cruiseEngine" && !installed(d, "cruise"))
      return "Install the cruise deck before its engine.";
    if (id === "rover" && destination !== "mars")
      return "This rover deck is compatible with the Mars exploration mission only.";
    if (id === "drill" && (destination !== "mars" || !installed(d, "rover")))
      return "The core drill fits the Mars rover tool socket. Install the rover first.";
    if (id === "sampler" && destination !== "asteroid")
      return "The sampling arm fits the asteroid probe mission only.";
    if (id === "probe" && missionKind(destination) !== "probe")
      return "The entry probe is for Venus and the giant planets, where there is no safe solid landing surface.";
    if (id === "rover" && missionKind(destination) === "probe")
      return "There is no solid surface to drive on. Use the atmospheric entry probe.";
    if (
      ["legs", "descentEngine"].includes(id) &&
      ["orbital", "rendezvous", "probe"].includes(missionKind(destination))
    )
      return "This orbital mission uses cruise-engine RCS; landing equipment is not required or compatible.";
  } else {
    const dependents =
      id === "body"
        ? partIds.filter((k) => k !== "body" && installed(d, k))
        : id === "connector" && installed(d, "cruise")
          ? ["cruise"]
          : id === "cruise" && installed(d, "cruiseEngine")
            ? ["cruiseEngine"]
            : id === "rover" && installed(d, "drill")
              ? ["drill"]
              : [];
    if (dependents.length)
      return `Remove ${dependents.map((k) => parts[k as PartId].name).join(", ")} first; they depend on this mount.`;
  }
  return "";
}
export function requiredParts(
  destination: DestinationId,
  objective: Objective,
): PartId[] {
  const base: PartId[] = [
    "body",
    "tank",
    "computer",
    "connector",
    "cruise",
    "cruiseEngine",
    "battery",
    "solar",
    "antenna",
  ];
  return destination === "mars"
    ? [
        ...base,
        "descentEngine",
        "legs",
        "rover",
        ...(objective === "imaging"
          ? (["camera"] as PartId[])
          : (["spectrometer", "drill"] as PartId[])),
      ]
    : missionKind(destination) === "lander"
      ? [...base, "descentEngine", "legs", "camera", "spectrometer"]
      : missionKind(destination) === "probe"
        ? [...base, "camera", "probe"]
      : destination === "asteroid"
        ? [...base, "spectrometer", "sampler"]
        : [...base, "camera"];
}
export function missionStarter(
  destination: DestinationId,
  objective: Objective,
): Design {
  let d = starter(objective);
  for (const id of partIds)
    d = changePart(d, id, requiredParts(destination, objective).includes(id));
  if (destination === "moon") d = { ...d, cruiseFuel: 150, descentFuel: 100 };
  if (destination === "mercury") d = { ...d, cruiseFuel: 260, descentFuel: 160 };
  if (missionKind(destination) === "probe") d = { ...d, cruiseFuel: 300, descentFuel: 0 };
  if (destination === "earth") d = { ...d, cruiseFuel: 80, descentFuel: 0 };
  if (destination === "asteroid") d = { ...d, cruiseFuel: 160, descentFuel: 0 };
  return d;
}
export function emptyDesign(destination: DestinationId = "mars"): Design {
  return {
    camera: false,
    spectrometer: false,
    drill: false,
    battery: false,
    solar: false,
    antenna: false,
    parts: Object.fromEntries(structuralIds.map((id) => [id, false])),
    cruiseFuel: destination === "earth" ? 80 : destination === "moon" ? 150 : destination === "asteroid" ? 160 : missionKind(destination) === "probe" ? 300 : destination === "mercury" ? 260 : 220,
    descentFuel: ["orbital", "rendezvous", "probe"].includes(missionKind(destination)) ? 0 : destination === "moon" ? 100 : 160,
  };
}
