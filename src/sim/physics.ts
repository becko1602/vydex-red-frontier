import { C } from "../data/scienceConstants";
import {
  balance,
  catalogue,
  type Design,
  type Objective,
} from "../data/gameBalance";
import {
  installed,
  parts,
  partIds,
  requiredParts,
  type PartId,
} from "../data/workshop";
import { environment, missionKind, TRANSFER, type DestinationId } from "../data/destinations";
import { launchers } from "../data/launchVehicles";
import { launcherFit } from "./payload";
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export type EducationalAscentSpec = {
  diameterM: number;
  dryMassKg: number;
  propellantKg: number;
  thrustN: number;
  specificImpulseS: number;
  dragCoefficient: number;
};
export type AscentState = {
  elapsedS: number;
  altitudeM: number;
  verticalSpeedMps: number;
  propellantKg: number;
  massKg: number;
  thrustN: number;
  dragN: number;
  netForceN: number;
};
/**
 * Educational one dimensional ascent example. The fictional carrier is
 * represented by one equivalent engine and dry stage; it is not a prediction
 * of a real launch vehicle, ascent guidance profile, or orbital insertion.
 */
export function launchAscent(
  spec: EducationalAscentSpec,
  payloadKg: number,
  elapsedS: number,
): AscentState {
  let state: AscentState = {
    elapsedS: 0,
    altitudeM: 0,
    verticalSpeedMps: 0,
    propellantKg: Math.max(0, spec.propellantKg),
    massKg: Math.max(0, spec.dryMassKg) + Math.max(0, payloadKg) + Math.max(0, spec.propellantKg),
    thrustN: 0,
    dragN: 0,
    netForceN: 0,
  };
  let remaining = Math.max(0, elapsedS);
  while (remaining > 1e-9) {
    const dt = Math.min(0.05, remaining);
    const throttle = clamp(state.elapsedS / 0.8, 0, 1);
    const thrust = state.propellantKg > 0 ? spec.thrustN * throttle : 0;
    const flow = spec.specificImpulseS > 0 ? thrust / (spec.specificImpulseS * C.g0) : 0;
    const used = Math.min(state.propellantKg, flow * dt);
    const mass = Math.max(1, spec.dryMassKg + payloadKg + state.propellantKg - used * 0.5);
    const rho = 1.225 * Math.exp(-Math.max(0, state.altitudeM) / 8500);
    const area = Math.PI * (Math.max(.01, spec.diameterM) / 2) ** 2;
    const drag = .5 * rho * spec.dragCoefficient * area * state.verticalSpeedMps ** 2;
    const averageThrust = state.propellantKg > 0 ? (used > 0 ? used / dt * spec.specificImpulseS * C.g0 : thrust) : 0;
    const net = averageThrust - drag - mass * 9.80665;
    const acceleration = net / mass;
    const nextVelocity = Math.max(0, state.verticalSpeedMps + acceleration * dt);
    const altitude = Math.max(0, state.altitudeM + (state.verticalSpeedMps + nextVelocity) * .5 * dt);
    state = {
      elapsedS: state.elapsedS + dt,
      altitudeM: altitude,
      verticalSpeedMps: nextVelocity,
      propellantKg: Math.max(0, state.propellantKg - used),
      massKg: Math.max(0, spec.dryMassKg + payloadKg + state.propellantKg - used),
      thrustN: averageThrust,
      dragN: drag,
      netForceN: net,
    };
    remaining -= dt;
  }
  return state;
}
export const BATTERY_CAPACITY_WH = 600;
export const CRUISE_POWER_EPISODE_SECONDS = 2 * 3600;
export const CRUISE_GENERATION_W = 45;
export const CRUISE_HIBERNATE_LOAD_W = 28;
export const CRUISE_SCIENCE_LOAD_W = 100;
export function deltaV(isp: number, wet: number, dry: number) {
  return Number.isFinite(isp + wet + dry) && isp > 0 && dry > 0 && wet >= dry
    ? isp * C.g0 * Math.log(wet / dry)
    : 0;
}
export function masses(d: Design) {
  const surfaceIds: PartId[] = [
    "body",
    "tank",
    "computer",
    "legs",
    "rover",
    "solar",
    "battery",
    "antenna",
    "camera",
    "spectrometer",
    "drill",
    "sampler",
  ];
  const surface = surfaceIds.reduce(
    (sum, id) => sum + (installed(d, id) ? parts[id].mass : 0),
    0,
  );
  const descentDry =
    surface + (installed(d, "descentEngine") ? parts.descentEngine.mass : 0);
  const descentFuel = installed(d, "tank") ? d.descentFuel : 0;
  const cruiseDry =
    descentDry +
    descentFuel +
    (["cruise", "cruiseEngine", "connector"] as PartId[]).reduce(
      (sum, id) => sum + (installed(d, id) ? parts[id].mass : 0),
      0,
    );
  return {
    surface,
    descentDry,
    descentWet: descentDry + descentFuel,
    cruiseDry,
    wet: cruiseDry + (installed(d, "tank") ? d.cruiseFuel : 0),
  };
}
export function cost(d: Design) {
  return (
    launchers[d.launcher ?? "titan"].cost +
    partIds.reduce(
      (sum, id) => sum + (installed(d, id) ? parts[id].credits : 0),
      0,
    ) +
    (installed(d, "tank")
      ? d.cruiseFuel * balance.cruiseFuelPrice +
        d.descentFuel * balance.descentFuelPrice
      : 0)
  );
}
export function preflight(
  d: Design,
  o: Objective,
  destination: DestinationId = "mars",
) {
  const m = masses(d), fit = launcherFit(d, destination, m.wet);
  const checks: {
    label: string;
    ok: boolean;
    detail: string;
    part?: PartId;
  }[] = [
    {
      label: "Mission budget",
      ok: cost(d) <= balance.budget,
      detail: `${cost(d).toFixed(1)} / ${balance.budget} mission credits, including launch service`,
    },
    {
      label: "Provider payload",
      ok: fit.route && fit.mass,
      detail: fit.route ? `${m.wet.toFixed(0)} / ${fit.capacity} kg to ${destination} · ${fit.rocket.name}` : `${fit.rocket.name} does not support ${destination}. Switch launch vehicle.`,
    },
    {
      label: "Science payload",
      ok: requiredParts(destination, o)
        .filter((id) =>
          ["camera", "spectrometer", "drill", "sampler"].includes(id),
        )
        .every((id) => installed(d, id)),
      detail:
        requiredParts(destination, o)
          .filter((id) =>
            ["camera", "spectrometer", "drill", "sampler"].includes(id),
          )
          .map((id) => parts[id].name)
          .join(" + ") + " required",
    },
    {
      label: "Power + communication",
      ok: d.solar && d.battery && d.antenna,
      detail: "Solar array, battery and antenna required",
    },
    {
      label: "Cruise maneuver reserve",
      ok:
        installed(d, "cruiseEngine") &&
        deltaV(320, m.wet, m.cruiseDry) >
          TRANSFER[destination].correctionDv,
      detail: `${deltaV(320, m.wet, m.cruiseDry).toFixed(0)} m/s ideal Δv; correction requires ${TRANSFER[destination].correctionDv} m/s`,
    },
    {
      label: "Descent authority",
      ok:
        !["mars", "moon", "mercury"].includes(destination) ||
        (installed(d, "descentEngine") &&
          8000 / (m.descentWet * environment(destination).gravity) > 1.6 &&
          deltaV(220, m.descentWet, m.descentDry) >
            (destination === "moon" ? 180 : destination === "mercury" ? 300 : 380)),
      detail: `T/W ${(8000 / (m.descentWet * C.marsGravity)).toFixed(2)} · ${deltaV(220, m.descentWet, m.descentDry).toFixed(0)} m/s ideal reserve (minimum 380)`,
    },
  ];
  checks[0].detail +=
    cost(d) > balance.budget
      ? ". Remove optional instruments or reduce propellant to recover credits."
      : "";
  checks[1].detail +=
    !fit.mass
      ? ". Remove optional payload or reduce tank fill."
      : "";
  checks[0].part =
    partIds.find(
      (id) => installed(d, id) && !requiredParts(destination, o).includes(id),
    ) ?? "tank";
  checks[1].part = checks[0].part;
  checks[2].part = requiredParts(destination, o)
    .filter((id) => ["camera", "spectrometer", "drill", "sampler", "probe"].includes(id))
    .find((id) => !installed(d, id));
  checks[3].part = !d.battery ? "battery" : !d.solar ? "solar" : "antenna";
  checks[4].part = !installed(d, "cruiseEngine") ? "cruiseEngine" : "tank";
  checks[5].part = !installed(d, "descentEngine") ? "descentEngine" : "tank";
  if (destination === "moon")
    checks[5].detail = `Moon: uniform 1.62 m/s²; no drag. T/W ${(8000 / (m.descentWet * 1.62)).toFixed(2)}; minimum 180 m/s ideal reserve.`;
  if (destination === "mercury")
    checks[5].detail = `Mercury: 3.70 m/s²; no drag, so the engine removes all speed. T/W ${(8000 / (m.descentWet * 3.7)).toFixed(2)}; minimum 300 m/s ideal reserve.`;
  if (["orbital", "rendezvous", "probe"].includes(missionKind(destination)))
    checks.splice(5, 1);
  for (const id of requiredParts(destination, o).filter(
    (id) =>
      ![
        "camera",
        "spectrometer",
        "drill",
        "sampler",
        "probe",
        "solar",
        "battery",
        "antenna",
        "cruiseEngine",
        "descentEngine",
      ].includes(id),
  ))
    checks.push({
      label: parts[id].name,
      ok: installed(d, id),
      detail: installed(d, id)
        ? `${parts[id].slot}: secured.`
        : `Install ${parts[id].name} at ${parts[id].slot}. ${parts[id].omission}`,
      part: id,
    });
  checks.push({label:"Usable fairing space",ok:fit.dimensions,detail:`Stowed envelope Ø${fit.payload.diameter.toFixed(2)} × ${fit.payload.height.toFixed(2)} m / bay Ø${fit.rocket.fairingDiameter} × ${fit.rocket.fairingHeight} m. ${fit.dimensions ? "Fits the conservative cylindrical envelope." : "Switch to a wider carrier or remove optional protruding equipment; fuel changes mass, not equipment dimensions."}`});
  return checks;
}
export const communicationDelay = (distanceM: number) =>
  Math.max(0, distanceM) / C.c;
export const solarPower = (
  r: number,
  area: number,
  efficiency: number,
  cosine: number,
  dust: number,
) =>
  C.earthFlux *
  (C.AU / r) ** 2 *
  area *
  efficiency *
  Math.max(0, cosine) *
  clamp(dust, 0, 1);
export function batteryStep(
  wh: number,
  capacity: number,
  generation: number,
  consumption: number,
  dt: number,
) {
  return clamp(wh + ((generation - consumption) * dt) / 3600, 0, capacity);
}
export function propellantForDeltaV(
  deltaVRequired: number,
  isp: number,
  initialMass: number,
) {
  if (
    !Number.isFinite(deltaVRequired) ||
    !Number.isFinite(isp) ||
    !Number.isFinite(initialMass) ||
    deltaVRequired < 0 ||
    isp <= 0 ||
    initialMass <= 0
  )
    return 0;
  const finalMass = initialMass / Math.exp(deltaVRequired / (isp * C.g0));
  return Math.max(0, initialMass - finalMass);
}
export function remainingOperatingHours(
  batteryWh: number,
  generationW: number,
  consumptionW: number,
) {
  const deficit = consumptionW - generationW;
  return deficit > 0 ? Math.max(0, batteryWh / deficit) : Infinity;
}
export function transferModel() {
  const r1 = C.earthOrbit,
    r2 = C.marsOrbit,
    a = (r1 + r2) / 2,
    e = (r2 - r1) / (r2 + r1),
    time = Math.PI * Math.sqrt(a ** 3 / C.muSun),
    nMars = Math.sqrt(C.muSun / r2 ** 3);
  return {
    r1,
    r2,
    a,
    e,
    time,
    nMars,
    phase: Math.PI - nMars * time,
    departureDV:
      Math.sqrt(C.muSun * (2 / r1 - 1 / a)) - Math.sqrt(C.muSun / r1),
    arrivalDV: Math.sqrt(C.muSun / r2) - Math.sqrt(C.muSun * (2 / r2 - 1 / a)),
  };
}
export function transferPosition(fraction: number) {
  const t = transferModel(),
    M = clamp(fraction, 0, 1) * Math.PI;
  let E = M;
  for (let i = 0; i < 12; i++)
    E -= (E - t.e * Math.sin(E) - M) / (1 - t.e * Math.cos(E));
  return {
    x: t.a * (Math.cos(E) - t.e),
    z: t.a * Math.sqrt(1 - t.e * t.e) * Math.sin(E),
  };
}
export function planetPositions(fraction: number) {
  const t = transferModel(),
    elapsed = clamp(fraction, 0, 1) * t.time,
    earthAngle = Math.sqrt(C.muSun / t.r1 ** 3) * elapsed,
    marsAngle = t.phase + t.nMars * elapsed;
  return {
    earth: { x: t.r1 * Math.cos(earthAngle), z: t.r1 * Math.sin(earthAngle) },
    mars: { x: t.r2 * Math.cos(marsAngle), z: t.r2 * Math.sin(marsAngle) },
  };
}
export function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function terrainHeight(
  x: number,
  z: number,
  destination: DestinationId = "mars",
) {
  if (destination === "moon" || destination === "mercury") {
    // Continuous local lunar terrain. Crater bowls and rims are analytic so
    // the renderer, landing solver and touchdown tests share the same surface.
    let h = 0.22 * Math.sin(x * 0.045) * Math.sin(z * 0.035)
      + 0.12 * Math.sin((x + z) * 0.11);
    for (const [cx, cz, r] of [
      [0, 0, 16],
      [-45, -55, 22],
      [52, -88, 28],
      [70, 45, 18],
      [-80, 30, 26],
      [35, 102, 12],
      [-112, -5, 17],
      [125, 80, 24],
    ]) {
      const d = Math.hypot(x - cx, z - cz) / r;
      h += 1.05 * Math.exp(-(((d - 1) / 0.12) ** 2))
        - 1.45 * Math.exp(-((d / 0.72) ** 4));
    }
    return h;
  }
  const fade = clamp((Math.hypot(x, z) - 12) / 35, 0, 1);
  return (
    fade *
    (1.3 * Math.sin(x * 0.05) * Math.sin(z * 0.037) +
      0.55 * Math.sin(z * 0.12 + x * 0.023))
  );
}
export function terrainSlope(x: number, z: number) {
  return Math.hypot(
    terrainHeight(x + 0.5, z) - terrainHeight(x - 0.5, z),
    terrainHeight(x, z + 0.5) - terrainHeight(x, z - 0.5),
  );
}
export type Lander = {
  yaw:number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  tilt: number;
  roll: number;
  pitch: number;
  fuel: number;
  throttle: number;
  status: "flying" | "safe" | "crashed";
  reason: string;
};
export const initialLander = (
  d: Design,
  destination: DestinationId = "mars",
): Lander => ({
  yaw:0,
  x: 0,
  y: 500,
  z: 0,
  vx: 0,
  vy: destination === "moon" ? -8 : destination === "mercury" ? -14 : -12,
  vz: 0,
  tilt: 0,
  roll: 0,
  pitch: 0,
  fuel: installed(d, "tank") ? d.descentFuel : 0,
  throttle: 0,
  status: "flying",
  reason: "",
});
export function classifyLanding(vy: number, vh: number, tilt: number) {
  return (
    Math.abs(vy) < balance.safeVertical &&
    vh < balance.safeHorizontal &&
    Math.abs(tilt) < (balance.safeTilt * Math.PI) / 180
  );
}
export function landerStep(
  s: Lander,
  dry: number,
  dt: number,
  control: {
    throttle: number;
    x: number;
    z: number;
    assist: boolean;
    descentRate?: number;
    yaw?:number;
    thrust?: number;
    legs?: boolean;
  },
  env = environment("mars"),
  destination: DestinationId = "mars",
) {
  if (s.status !== "flying") return;
  const h = s.y - terrainHeight(s.x, s.z, destination),
    m = dry + s.fuel;
  const maximumThrust = control.thrust ?? 8000;
  // Automatic glide slope, or the pilot's descent-rate setpoint (0 = hover), always slowing to ≤0.8 m/s near the ground.
  const rate = control.descentRate ?? -1;
  const desiredVy = rate < 0 ? -Math.min(18, Math.max(0.8, h * 0.38)) : -Math.min(rate, Math.max(rate === 0 ? 0 : 0.8, h * 0.38));
  const automatic =
    maximumThrust > 0
      ? ((env.gravity + (desiredVy - s.vy) * 1.1) * m) / (maximumThrust * Math.max(0.5, Math.cos(s.tilt)))
      : 0;
  s.throttle = clamp(
    control.assist
      ? automatic + (control.throttle - 0.5) * 0.5
      : control.throttle,
    0,
    1,
  );
  // Thrust-vector attitude: up to 25° of tilt commanded by the pilot; when the
  // stick is released, assist tilts against horizontal velocity to null drift.
  const targetRoll = clamp(
      control.x ? control.x * 0.44 : control.assist ? -s.vx * 0.09 : 0,
      -0.44,
      0.44,
    ),
    targetPitch = clamp(
      control.z ? control.z * 0.44 : control.assist ? -s.vz * 0.09 : 0,
      -0.44,
      0.44,
    );
  s.yaw += (control.yaw??0)*dt*.8;
  s.roll += (targetRoll - s.roll) * Math.min(1, dt * 3);
  s.pitch += (targetPitch - s.pitch) * Math.min(1, dt * 3);
  s.tilt = Math.acos(Math.cos(s.roll) * Math.cos(s.pitch));
  const demand = maximumThrust * s.throttle,
    used = Math.min(s.fuel, (demand / (220 * C.g0)) * dt),
    thrust = dt > 0 ? (used / dt) * 220 * C.g0 : 0;
  s.fuel = Math.max(0, s.fuel - used);
  const speed = Math.hypot(s.vx, s.vy, s.vz),
    drag =
      0.5 *
      env.density *
      Math.exp(-Math.max(0, s.y) / env.scaleHeight) *
      balance.Cd *
      balance.dragArea *
      speed;
  s.vx +=
    ((thrust * (Math.sin(s.roll)*Math.cos(s.pitch)*Math.cos(s.yaw)+Math.sin(s.pitch)*Math.sin(s.yaw))) / m - (drag * s.vx) / m) *
    dt;
  s.vz += ((thrust * (Math.sin(s.pitch)*Math.cos(s.yaw)-Math.sin(s.roll)*Math.cos(s.pitch)*Math.sin(s.yaw))) / m - (drag * s.vz) / m) * dt;
  s.vy +=
    ((thrust * Math.cos(s.tilt)) / m - env.gravity - (drag * s.vy) / m) * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  if (s.y <= terrainHeight(s.x, s.z, destination) + 0.8) {
    s.y = terrainHeight(s.x, s.z, destination) + 0.8;
    const inArea = Math.abs(s.x) < 145 && Math.abs(s.z) < 145,
      safe =
        inArea &&
        control.legs !== false &&
        classifyLanding(s.vy, Math.hypot(s.vx, s.vz), s.tilt);
    s.status = safe ? "safe" : "crashed";
    s.reason = safe
      ? "Contact confirmed. Engine shutdown."
      : control.legs === false
        ? "Landing legs missing. Return to the workshop and install landing equipment."
        : !inArea
          ? "Touchdown outside the surveyed 300 m landing area. Retry and reduce lateral steering."
          : s.fuel === 0
            ? "Propellant exhausted before braking was complete."
            : Math.abs(s.vy) >= 3
              ? `Vertical contact at ${Math.abs(s.vy).toFixed(1)} m/s exceeded 3 m/s.`
              : Math.hypot(s.vx, s.vz) >= 2
                ? "Horizontal contact exceeded 2 m/s."
                : "Touchdown tilt exceeded 12°.";
  }
}
export const FIXED_DT = 1 / 60;
export function fixedAdvance(
  accumulator: number,
  elapsed: number,
  step: (dt: number) => void,
) {
  let a = accumulator + Math.min(0.1, Math.max(0, elapsed));
  let n = 0;
  while (a >= FIXED_DT && n < 6) {
    step(FIXED_DT);
    a -= FIXED_DT;
    n++;
  }
  return a;
}
