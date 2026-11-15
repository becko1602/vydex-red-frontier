import {
  balance,
  catalogue,
  requiredTargets,
  starter,
  type Design,
  type Objective,
} from "../data/gameBalance";
import { C } from "../data/scienceConstants";
import {
  batteryStep,
  BATTERY_CAPACITY_WH,
  CRUISE_GENERATION_W,
  CRUISE_HIBERNATE_LOAD_W,
  CRUISE_POWER_EPISODE_SECONDS,
  CRUISE_SCIENCE_LOAD_W,
  clamp,
  communicationDelay,
  initialLander,
  landerStep,
  masses,
  planetPositions,
  solarPower,
  terrainHeight,
  terrainSlope,
  transferModel,
  type Lander,
} from "./physics";
import {
  environment,
  destinations,
  missionKind,
  isLunarLike,
  SOLAR_DISTANCE_AU,
  TRANSFER,
  type DestinationId,
} from "../data/destinations";
import { atmosphereAt, PROBE_PHASES, type ProbeState, initialProbe } from "./probe";
import { installed, missionStarter, parts, partIds } from "../data/workshop";
import {
  initialOrbit,
  orbitStep,
  stableAttitude,
  sampleCorridor,
  type OrbitalState,
} from "./orbit";
export type Stage =
  | "rocket"
  | "briefing"
  | "assembly"
  | "preflight"
  | "launch"
  | "cruise"
  | "landing"
  | "surface"
  | "debrief"
  | "orbit";
export type Command = { targetId: string; wait: number };
export type FlightData = {
  stage: Stage;
  destination: DestinationId;
  orbital: OrbitalState;
  timeScale: number;
  cinematicSkipped: boolean;
  objective: Objective;
  demo: boolean;
  design: Design;
  seed: number;
  battery: number;
  cruiseFuel: number;
  lander: Lander;
  rover: {
    x: number;
    z: number;
    heading: number;
    speed: number;
    distance: number;
    steering: number;
  };
  elapsed: number;
  stageTime: number;
  cruiseProgress: number;
  correction: boolean;
  cruiseChoice: "pending" | "save" | "science";
  launchChecks: boolean[];
  observations: string[];
  captures:Record<string,string>;
  transmitted: string[];
  scanId: string;
  scanTime: number;
  transmitTime: number;
  transmitting: boolean;
  queue: Command[];
  earthMode: boolean;
  panelTracking: boolean;
  generation: number;
  load: number;
  energyUsed: number;
  energyGenerated: number;
  explanations: string[];
  decisionLog: string[];
  lastResult: string;
  landingStarted: boolean;
  assist: boolean;
  throttle: number;
  engineEnabled: boolean;
  /** Solar wings folded against the bus (protects them from debris, no generation). */
  panelsStowed: boolean;
  /** 1 = pristine; debris strikes on open wings reduce output. */
  panelHealth: number;
  /** Seconds until the next tracked debris crossing (orbit / cruise only). */
  debrisIn: number;
  /** >0 while a debris cloud is crossing the vehicle's path. */
  debrisActive: number;
  /** Short-lived hazard banner text (debris), separate from the explanation log. */
  alert: string;
  probe: ProbeState;
  /** Local solar time on the surface, 0..1 (0.25 sunrise, 0.5 noon, 0.75 sunset). */
  solTime: number;
  headlights: "auto" | "on" | "off";
  /** Rover inside the surface base service radius. */
  docked: boolean;
  inspections: string[];
  /** Pilot-selected descent-rate setpoint (m/s, positive down); -1 = automatic glide profile, 0 = hover. */
  descentRate: number;
};
export type Input = {
  pitch?: number; yaw?: number; roll?: number; throttleChange?: number; rcsX?:number; rcsZ?:number;
  forward: number;
  turn: number;
  brake: boolean;
  lateralX: number;
  lateralZ: number;
};
export const neutral: Input = {
  pitch:undefined,yaw:undefined,roll:undefined,rcsX:undefined,rcsZ:undefined,throttleChange:0,
  forward: 0,
  turn: 0,
  brake: false,
  lateralX: 0,
  lateralZ: 0,
};
export function freshData(
  objective: Objective = "imaging",
  demo = false,
  design = starter(objective),
  destination: DestinationId = "mars",
): FlightData {
  return {
    stage: "assembly",
    destination,
    orbital: initialOrbit(destination === "asteroid" ? "asteroid" : "earth"),
    timeScale: 1,
    cinematicSkipped: false,
    objective,
    demo,
    design: { ...design },
    seed: balance.seed,
    battery: design.battery ? 480 : 0,
    cruiseFuel: installed(design, "tank") ? design.cruiseFuel : 0,
    lander: initialLander(design, destination),
    rover: { x: 0, z: 0, heading: 0, speed: 0, distance: 0, steering: 0 },
    elapsed: 0,
    stageTime: 0,
    cruiseProgress: 0,
    correction: false,
    cruiseChoice: "pending",
    launchChecks: [false, false, false],
    observations: [],
    captures:{},
    transmitted: [],
    scanId: "",
    scanTime: 0,
    transmitTime: 0,
    transmitting: false,
    queue: [],
    earthMode: false,
    panelTracking: true,
    generation: 0,
    load: 28,
    energyUsed: 0,
    energyGenerated: 0,
    explanations: [
      "Every instrument adds mass, cost and electrical load. Choose for your objective.",
    ],
    decisionLog: [],
    lastResult: "",
    landingStarted: false,
    assist: true,
    throttle: 0.5,
    engineEnabled: true,
    panelsStowed: false,
    panelHealth: 1,
    debrisIn: 70,
    debrisActive: 0,
    alert: "",
    probe: initialProbe(),
    solTime: 0.36,
    headlights: "auto",
    docked: false,
    inspections: [],
    descentRate: -1,
  };
}
/** Surface base position for rover missions, metres from the landing site. */
export const BASE_POSITION = { x: -26, z: 18 };
export const BASE_RADIUS = 9;
/** Real-time seconds for one compressed surface sol. */
export const SOL_SECONDS = 300;
export function sunElevation(solTime: number) {
  return Math.sin((solTime - 0.25) * Math.PI * 2);
}
export class MissionEngine {
  data: FlightData = freshData();
  /** Presentation hook: scenes set this to animate the robotic arm. */
  armFx?: () => void;
  explain(message: string) {
    if (this.data.explanations[0] !== message)
      this.data.explanations = [message, ...this.data.explanations].slice(
        0,
        12,
      );
  }
  go(stage: Stage) {
    this.data.stage = stage;
    this.data.stageTime = 0;
    if (stage === "cruise") {
      this.data.generation = CRUISE_GENERATION_W;
      this.data.load = CRUISE_HIBERNATE_LOAD_W;
    }
    if (stage === "landing") {
      this.data.lander = initialLander(this.data.design, this.data.destination);
      this.data.landingStarted = false;
    }
    if (stage === "surface") {
      this.data.rover.x = this.data.lander.x + (isLunarLike(this.data.destination) ? 4 : 3);
      this.data.rover.z = this.data.lander.z + (isLunarLike(this.data.destination) ? 4 : 3.5);
      this.explain(
        "Arcade-assisted driving: wheels follow a height field; steep slopes and rocks stop the rover.",
      );
    }
  }
  start(
    objective: Objective,
    demo = false,
    design?: Design,
    destination: DestinationId = "mars",
  ) {
    this.data = freshData(
      objective,
      demo,
      design ??
        (destination === "mars"
          ? starter(objective)
          : missionStarter(destination, objective)),
      destination,
    );
  }
  correctionBurn() {
    const d = this.data;
    if (d.correction) return;
    const mass = masses(d.design).cruiseDry + d.cruiseFuel;
    const dv = TRANSFER[d.destination].correctionDv;
    if (!installed(d.design, "cruiseEngine")) {
      this.explain("Install a cruise engine before attempting the correction.");
      return;
    }
    const fuel = mass * (1 - Math.exp(-dv / (320 * C.g0)));
    if (d.cruiseFuel < fuel) {
      this.explain("Insufficient cruise propellant. Revise your design.");
      return;
    }
    d.cruiseFuel -= fuel;
    d.correction = true;
    this.explain(
      `${dv} m/s correction consumed ${fuel.toFixed(1)} kg of cruise propellant. Descent fuel is untouched.`,
    );
  }
  chooseCruise(choice: "save" | "science") {
    const d = this.data;
    if (d.cruiseChoice !== "pending") return;
    d.cruiseChoice = choice;
    const baseline = d.battery,
      generation = CRUISE_GENERATION_W,
      dt = CRUISE_POWER_EPISODE_SECONDS;
    const save = batteryStep(
        baseline,
        BATTERY_CAPACITY_WH,
        generation,
        CRUISE_HIBERNATE_LOAD_W,
        dt,
      ),
      science = batteryStep(
        baseline,
        BATTERY_CAPACITY_WH,
        generation,
        CRUISE_SCIENCE_LOAD_W,
        dt,
      );
    d.battery = choice === "save" ? save : science;
    d.load =
      choice === "save" ? CRUISE_HIBERNATE_LOAD_W : CRUISE_SCIENCE_LOAD_W;
    d.generation = CRUISE_GENERATION_W;
    d.energyUsed +=
      (choice === "save" ? CRUISE_HIBERNATE_LOAD_W : CRUISE_SCIENCE_LOAD_W) *
      (dt / 3600);
    d.energyGenerated += generation * (dt / 3600);
    d.decisionLog.push(
      choice === "save"
        ? "Hibernated during cruise: preserved surface battery."
        : "Kept cruise science active: stored a bonus calibration, used more energy.",
    );
    this.explain(
      `Same starting charge, calculated 2 h episode: hibernate ends at ${save.toFixed(0)} Wh; science at ${science.toFixed(0)} Wh. You chose ${choice === "save" ? "hibernate" : "science"}.`,
    );
  }
  targets() {
    const d = this.data;
    if (missionKind(d.destination) === "probe") {
      const name = destinations[d.destination].name;
      return [
        {
          id: "P1",
          name: `${name} CLOUD-TOP IMAGING`,
          subtitle: "Orbiter camera, stable attitude",
          x: 0,
          z: 0,
          instrument: "camera" as const,
          result: `Multispectral mosaic of ${name.toLowerCase()} stored. Band contrast comes from cloud altitude and composition, not surface features.`,
        },
        {
          id: "P2",
          name: "ATMOSPHERIC DESCENT PROFILE",
          subtitle: "Entry probe pressure, temperature and composition",
          x: 0,
          z: 0,
          instrument: "probe" as const,
          result: `Entry probe profile stored: pressure, temperature and wind measured during the parachute descent, relayed through the orbiter.`,
        },
      ];
    }
    if (d.destination === "mercury")
      return [
        {
          id: "H1",
          name: "CRATER-RIM PANORAMA",
          subtitle: "Landing-site camera mosaic",
          x: d.lander.x,
          z: d.lander.z,
          instrument: "camera" as const,
          result: "Mercury panorama stored: hard shadows, no air glow, and a Sun about 2.5× wider than seen from Earth.",
        },
        {
          id: "H2",
          name: "REGOLITH SPECTRUM",
          subtitle: "Station X-ray / IR spectral reading",
          x: d.lander.x,
          z: d.lander.z,
          instrument: "spectrometer" as const,
          result: "Regolith spectrum stored (illustrative): low iron, high sulfur, consistent with MESSENGER-era findings.",
        },
      ];
    if (d.destination === "moon")
      return [
        {
          id: "M1",
          name: "LUNAR PANORAMA",
          subtitle: "Landing-site camera mosaic",
          x: d.lander.x,
          z: d.lander.z,
          instrument: "camera" as const,
          result:
            "Fictional lunar panorama stored. The surface is illuminated by direct sunlight without atmospheric haze.",
        },
        {
          id: "M2",
          name: "REGOLITH SPECTRUM",
          subtitle: "Station spectral reading",
          x: d.lander.x,
          z: d.lander.z,
          instrument: "spectrometer" as const,
          result:
            "Fictional regolith spectrum stored; this is not an actual lunar measurement.",
        },
      ];
    if (d.destination === "earth")
      return [
        {
          id: "E1",
          name: "EARTH OBSERVATION",
          subtitle: "Orbital camera payload",
          x: 0,
          z: 0,
          instrument: "camera" as const,
          result:
            "Fictional cloud-band image stored. Circular orbit and local attitude are separate educational models.",
        },
      ];
    if (d.destination === "asteroid")
      return [
        {
          id: "A1",
          name: "VY-26 SPECTRUM",
          subtitle: "Stable proximity scan",
          x: 0,
          z: 14,
          instrument: "spectrometer" as const,
          result: "A fictional mineral spectrum from VY-26 has been recorded.",
        },
        {
          id: "A2",
          name: "CONTACT SAMPLE",
          subtitle: "Sampling arm in the science corridor",
          x: 0,
          z: 14,
          instrument: "sampler" as const,
          result:
            "Fictional contact sample collected. No real asteroid measurements or life claims are made.",
        },
      ];
    return requiredTargets(d.objective, d.demo);
  }
  nearest() {
    const r = this.data.rover;
    return this.targets()
      .map((t) => ({ ...t, distance: Math.hypot(t.x - r.x, t.z - r.z) }))
      .sort((a, b) => a.distance - b.distance)[0];
  }
  interact(targetId?: string) {
    const d = this.data,
      t = targetId
        ? (this.targets().find((t) => t.id === targetId) ?? this.nearest())
        : this.nearest();
    if (d.stage !== "surface" || d.scanId) return;
    if (Math.hypot(t.x - d.rover.x, t.z - d.rover.z) > 6) {
      this.explain("Drive within 6 m of a target to collect an observation.");
      return;
    }
    if (d.observations.includes(t.id)) {
      this.explain(
        "Observation already stored. Transmit from any stationary position.",
      );
      return;
    }
    if (!installed(d.design, t.instrument)) {
      this.explain(
        `This observation needs a ${t.instrument}. Revise the payload to enable it.`,
      );
      return;
    }
    if (d.battery < 35) {
      this.explain(
        "Low charge: nonessential loads are off. Stop and track the Sun to recharge.",
      );
      return;
    }
    d.scanId = t.id;
    d.scanTime = 0;
    d.rover.speed = 0;
    this.explain(
      `${catalogue[t.instrument].name} consumes ${catalogue[t.instrument].power} W while active. Observation time: ${t.instrument === "drill" ? 12 : 8} s (energy timeline ×30).`,
    );
  }
  transmit() {
    const d = this.data;
    if (d.transmitting || d.scanId) return;
    if (!d.design.antenna && !d.docked) {
      this.explain("An antenna is required to transmit, or drive into the surface base relay radius.");
      return;
    }
    if (!d.observations.some((id) => !d.transmitted.includes(id))) {
      this.explain("Collect an observation before transmitting.");
      return;
    }
    if (d.battery < 30) {
      this.explain("Transmission needs 30 Wh reserve. Park and track the Sun.");
      return;
    }
    d.transmitting = true;
    d.transmitTime = 0;
    d.rover.speed = 0;
    this.explain(
      `Science uplink: ${this.delay().toFixed(0)} s scientific one-way delay. Acknowledgment timeline compressed to 6 s.`,
    );
  }
  arrive() {
    if (!this.data.correction || this.data.cruiseProgress < 1) {
      this.explain("Complete the correction burn and transfer before arrival.");
      return;
    }
    const kind = missionKind(this.data.destination);
    const orbital = kind === "orbital" || kind === "rendezvous" || kind === "probe";
    if (orbital) this.data.throttle = 0;
    if (kind === "probe") this.data.probe = initialProbe();
    this.go(orbital ? "orbit" : "landing");
  }
  deploySatellite() {
    const d = this.data;
    if (d.stage !== "orbit" || d.destination !== "earth") return;
    if (!stableAttitude(d.orbital)) {
      this.explain(
        "Attitude not stable: release steering and enable stabilization; wait for angles <7° and rates <0.04 rad/s.",
      );
      return;
    }
    if (!d.design.solar || !installed(d.design, "computer")) {
      this.explain(
        "A navigation computer and solar array are required. Revise the spacecraft.",
      );
      return;
    }
    d.orbital.deployed = true;
    this.explain(
      "Satellite released; solar panels deployed. Cruise hardware mass is no longer carried by the satellite.",
    );
  }
  orbitalScience(id: string) {
    const d = this.data,
      t = this.targets().find((t) => t.id === id);
    if (
      !t ||
      d.stage !== "orbit" ||
      d.scanId ||
      d.transmitting ||
      d.observations.includes(id)
    )
      return;
    if (t.instrument === "probe") {
      this.releaseProbe();
      return;
    }
    if (missionKind(d.destination) === "probe" && !stableAttitude(d.orbital)) {
      this.explain("Hold attitude: release the controls and press Space (stabilize) until angles are <7° and rates <0.04 rad/s.");
      return;
    }
    if (
      d.destination === "earth" &&
      (!d.orbital.deployed || !stableAttitude(d.orbital))
    ) {
      this.explain(
        "Deploy the satellite and stabilize its attitude before taking the observation.",
      );
      return;
    }
    if (d.destination === "asteroid" && !sampleCorridor(d.orbital)) {
      this.explain(
        "Use WASD or Approach assist, then brake within the 5 m science corridor at <0.35 m/s.",
      );
      return;
    }
    if (!installed(d.design, t.instrument)) {
      this.explain(
        "Missing " +
          parts[t.instrument].name +
          ". Return to the workshop and attach it.",
      );
      return;
    }
    if (d.battery < 35) {
      this.explain("Wait for solar charging; science requires 35 Wh reserve.");
      return;
    }
    d.scanId = id;
    d.scanTime = 0;
    this.explain(
      parts[t.instrument].name +
        " active: " +
        parts[t.instrument].power +
        " W.",
    );
  }
  tickScience(dt: number) {
    const d = this.data;
    if (d.scanId) {
      const t = this.targets().find((t) => t.id === d.scanId);
      if (t) {
        d.scanTime += dt;
        if (
          d.scanTime >=
          (t.instrument === "sampler" ? 10 : t.instrument === "drill" ? 12 : 8)
        ) {
          d.observations.push(t.id);
          d.scanId = "";
          d.lastResult = t.result;
          this.explain(t.result);
        }
      }
    }
    if (d.transmitting) {
      d.transmitTime += dt;
      if (d.transmitTime >= 6) {
        d.transmitted = [...d.observations];
        d.transmitting = false;
        if (this.targets().every((t) => d.transmitted.includes(t.id)))
          this.go("debrief");
      }
    }
  }
  tickStation(dt: number, input: Input) {
    const d = this.data,
      active = this.targets().find((t) => t.id === d.scanId);
    const r = d.rover;
    const drive = d.battery >= 30 && !d.scanId && !d.transmitting;
    const steer = drive ? input.turn : 0;
    const forward = drive && !input.brake ? input.forward : 0;
    r.steering += (steer - r.steering) * (1 - Math.exp(-dt * 10));
    r.heading -= r.steering * dt * 1.25;
    r.speed += (forward * 3 - r.speed * (input.brake ? 9 : 1.5)) * dt;
    r.speed = clamp(r.speed, -1.5, 3);
    const nx = clamp(r.x + Math.sin(r.heading) * r.speed * dt, -145, 145);
    const nz = clamp(r.z - Math.cos(r.heading) * r.speed * dt, -145, 145);
    if (terrainSlope(nx, nz) < 0.55 && !this.rockCollision(nx, nz)) {
      r.distance += Math.hypot(nx - r.x, nz - r.z);
      r.x = nx;
      r.z = nz;
    } else r.speed = 0;
    this.power(
      dt * 30,
      28 +
        (Math.abs(r.speed) > 0.1 ? balance.drivingW : 0) +
        (active ? parts[active.instrument].power : 0) +
        (d.transmitting ? 30 : 0),
      (d.design.solar ? solarPower(C.earthOrbit, 2, 0.25, 1, 1) * Math.min(1, Math.max(0, sunElevation(d.solTime)) * 1.6) * (d.destination === "mercury" ? 1.6 : 1) : 0) + (d.docked ? 260 : 0),
    );
    this.tickScience(dt);
  }
  tickOrbit(dt: number, input: Input) {
    const d = this.data,
      orb = d.orbital;
    const used = d.battery>0 ? orbitStep(
      orb,
      d.design,
      d.cruiseFuel,
      dt,
      input,
      d.destination === "asteroid" ? "asteroid" : "earth",
      d.assist,
      d.engineEnabled ? d.throttle : 0,
      missionKind(d.destination) === "orbital" && !orb.deployed,
    ) : 0;
    d.cruiseFuel = Math.max(0, d.cruiseFuel - used);
    const active = this.targets().find((t) => t.id === d.scanId);
    this.power(
      dt * 30,
      28 +
        (active ? parts[active.instrument].power : 0) +
        (d.transmitting ? 30 : 0),
      d.design.solar && (d.destination !== "earth" || orb.deployed)
        ? this.arrayOutput()
        : 0,
    );
    this.tickDebris(dt);
    if (missionKind(d.destination) === "probe") this.tickProbe(dt);
    if (orb.crashed) {
      this.explain(
        "Contact with the asteroid keep-out sphere. Retry rendezvous and brake earlier.",
      );
      return;
    }
    if (d.scanId && d.destination === "asteroid" && !sampleCorridor(orb)) {
      d.scanId = "";
      this.explain(
        "Scan cancelled: leave controls neutral and brake inside the science corridor.",
      );
    }
    if (d.scanId && (d.destination === "earth" || missionKind(d.destination) === "probe") && !stableAttitude(orb)) {
      d.scanId = "";
      d.scanTime = 0;
      this.explain(
        "Exposure cancelled: release attitude inputs and enable stabilization before trying the camera again.",
      );
    }
    this.tickScience(dt);
  }
  delay() {
    if (missionKind(this.data.destination) === "probe" || this.data.destination === "mercury")
      return communicationDelay(Math.max(0.3, Math.abs(SOLAR_DISTANCE_AU[this.data.destination] - 1)) * C.AU);
    if (this.data.destination === "moon")
      return communicationDelay(C.moonDistance);
    if (this.data.destination === "earth") return communicationDelay(400000);
    if (this.data.destination === "asteroid")
      return communicationDelay(18000000000);
    const p = planetPositions(1);
    return communicationDelay(
      Math.hypot(p.earth.x - p.mars.x, p.earth.z - p.mars.z),
    );
  }
  recoverRover() {
    const d=this.data;
    if(d.stage!=='surface'||d.destination!=='mars')return;
    // Explicit game assistance, preserve science and energy, no simulated teleport claim.
    d.rover.x=d.lander.x;d.rover.z=d.lander.z;d.rover.speed=0;d.rover.steering=0;d.queue=[];d.scanId='';
    this.explain('Game assistance: rover returned to its landing site. Science and battery are preserved. This is not a physical recovery simulation.');
    d.decisionLog.push('Used rover recovery assistance.');
  }
  queueEstimate(id:string) {
    const r=this.data.rover,t=this.targets().find(t=>t.id===id);
    if(!t)return {distance:0,seconds:0,energyWh:0};
    const distance=Math.hypot(r.x,r.z)>8 ? Math.hypot(r.x,r.z)+Math.hypot(t.x,t.z) : Math.hypot(t.x-r.x,t.z-r.z);
    const seconds=distance/2.5+8,scan=t.instrument==='drill'?12:8;
    return {distance,seconds,energyWh:((128*seconds+parts[t.instrument].power*scan)*30)/3600};
  }
  queueTarget(id: string) {
    const d = this.data;
    if (!d.earthMode) return;
    if (Math.hypot(d.rover.x, d.rover.z) > 8)
      d.queue.push({ targetId: "home", wait: 3 });
    d.queue.push({ targetId: id, wait: 3 });
    this.explain(
      `Earth command queued: ${this.delay().toFixed(0)} s one-way in the model, compressed to 3 s. Local autonomy will drive the route.`,
    );
  }
  power(dt: number, load: number, generation: number) {
    const d = this.data;
    d.load = load;
    d.generation = generation;
    d.energyUsed += (load * dt) / 3600;
    d.energyGenerated += (generation * dt) / 3600;
    d.battery = batteryStep(
      d.battery,
      d.design.battery ? BATTERY_CAPACITY_WH : 0,
      generation,
      load,
      dt,
    );
  }
  tick(dt: number, input: Input = neutral) {
    const d = this.data;
    d.elapsed += dt;
    if (['landing','orbit'].includes(d.stage)) d.throttle=clamp(d.throttle+(input.throttleChange??0)*dt*.35,0,1);
    d.stageTime +=
      dt * (["launch", "cruise"].includes(d.stage) ? d.timeScale : 1);
    if (
      d.stage === "launch" &&
      d.launchChecks.every(Boolean) &&
      d.stageTime > (d.demo ? 16 : 36)
    )
      this.go("cruise");
    if (d.stage === "cruise" && d.cruiseChoice !== "pending") {
      d.cruiseProgress = clamp(
        d.cruiseProgress +
          (dt * d.timeScale) /
            (d.demo ? 18 : TRANSFER[d.destination].playSeconds),
        0,
        1,
      );
    }
    if (d.stage === "landing" && d.landingStarted) {
      landerStep(
        d.lander,
        masses(d.design).descentDry,
        dt,
        {
          throttle: d.throttle,
          x: input.roll ?? input.lateralX,
          z: input.pitch ?? input.lateralZ,
          yaw: input.yaw,
          assist: d.assist,
          descentRate: d.descentRate,
          thrust: d.engineEnabled && installed(d.design, "descentEngine") ? 8000 : 0,
          legs: installed(d.design, "legs"),
        },
        environment(d.destination),
        d.destination,
      );
      this.power(dt,28,0);
      if (d.lander.status === "safe") {
        d.lastResult = d.lander.reason;
        this.explain(
          `Touchdown at ${Math.abs(d.lander.vy).toFixed(2)} m/s; ${(d.design.descentFuel - d.lander.fuel).toFixed(1)} kg descent fuel used. Additional payload increases the thrust and fuel needed.`,
        );
      }
      return;
    }
    if (d.stage === "orbit") {
      this.tickOrbit(dt, input);
      return;
    }
    if (d.stage === "cruise") this.tickDebris(dt);
    if (d.stage === "surface") {
      d.solTime = (d.solTime + dt / SOL_SECONDS) % 1;
      d.docked = Math.hypot(d.rover.x - BASE_POSITION.x, d.rover.z - BASE_POSITION.z) < BASE_RADIUS;
    }
    if (d.stage === "surface" && isLunarLike(d.destination)) {
      this.tickStation(dt, input);
      return;
    }
    if (d.stage !== "surface") return;
    const r = d.rover,
      low = d.battery < 30;
    let forward = input.forward,
      turn = input.turn;
    if (d.earthMode) {
      forward = 0;
      turn = 0;
      const q = d.queue[0];
      if (q) {
        q.wait -= dt;
        if (q.wait <= 0) {
          const target =
            q.targetId === "home"
              ? { x: 0, z: 0 }
              : this.targets().find((t) => t.id === q.targetId);
          if (target) {
            const dist = Math.hypot(target.x - r.x, target.z - r.z),
              heading = Math.atan2(target.x - r.x, -(target.z - r.z)),
              diff = Math.atan2(
                Math.sin(heading - r.heading),
                Math.cos(heading - r.heading),
              );
            turn = -clamp(diff * 2, -1, 1);
            forward = Math.abs(diff) < 0.5 ? 1 : 0.25;
            if (dist < 4) {
              d.queue.shift();
              r.speed = 0;
              forward = 0;
              if (q.targetId !== "home")
                { this.interact(q.targetId); this.explain("Autonomy reached the queued target and started its instrument. Transmission remains your decision."); }
            }
          }
        }
      }
    }
    if (input.brake) forward = 0;
    r.steering += (turn - r.steering) * (1 - Math.exp(-dt * 10));
    const busy = !!d.scanId || d.transmitting;
    const slope = terrainSlope(r.x, r.z);
    if (low || busy) {
      forward = 0;
      r.speed *= Math.exp(-dt * 8);
    } else {
      r.heading -= r.steering * dt * 1.25;
      r.speed += (forward * 4 - r.speed * (input.brake ? 9 : 1.2)) * dt;
      r.speed = clamp(r.speed, -2, 4);
      if (input.brake && Math.abs(r.speed) < 0.025) r.speed = 0;
    }
    const nx = clamp(r.x + Math.sin(r.heading) * r.speed * dt, -145, 145),
      nz = clamp(r.z - Math.cos(r.heading) * r.speed * dt, -145, 145);
    if (terrainSlope(nx, nz) < 0.55 && !this.rockCollision(nx, nz)) {
      r.distance += Math.hypot(nx - r.x, nz - r.z);
      r.x = nx;
      r.z = nz;
    } else {
      r.speed = 0;
      this.explain(
        "Contact or steep slope: brake, reverse, and steer around the obstacle.",
      );
    }
    const instrument = this.targets().find((t) => t.id === d.scanId);
    const instrW = instrument ? catalogue[instrument.instrument].power : 0;
    const cosine = d.panelTracking
      ? 1
      : Math.max(0, 0.2 + 0.8 * Math.cos(r.heading - 1));
    const daylight = Math.max(0, sunElevation(d.solTime));
    const generation = (d.design.solar
      ? solarPower(C.marsOrbit, 2, 0.25, cosine, balance.dust) * Math.min(1, daylight * 1.6) * d.panelHealth
      : 0) + (d.docked ? 260 : 0);
    const load =
      28 +
      (Math.abs(r.speed) > 0.1
        ? balance.drivingW + Math.min(50, slope * 100)
        : 0) +
      (low ? 0 : instrW) +
      (d.transmitting ? 30 : 0) +
      (this.lightsOn() ? 24 : 0) +
      (daylight <= 0 ? 18 : 0);
    this.power(dt * 30, load, generation);
    if (low) {
      d.scanId = "";
      d.transmitting = false;
      this.explain(
        "Low-charge protection disabled driving and instruments. Solar tracking restores charge; no random failure.",
      );
    }
    if (d.scanId && instrument) {
      if (Math.hypot(r.x - instrument.x, r.z - instrument.z) > 6) {
        d.scanId = "";
        this.explain("Observation cancelled: rover left the target.");
      } else {
        d.scanTime += dt;
        const duration = instrument.instrument === "drill" ? 12 : 8;
        if (d.scanTime >= duration) {
          d.observations.push(d.scanId);
          d.lastResult = instrument.result;
          d.scanId = "";
          this.explain(instrument.result);
        }
      }
    }
    if (d.transmitting) {
      d.transmitTime += dt;
      if (d.transmitTime >= 6) {
        d.transmitted = [...d.observations];
        d.transmitting = false;
        this.explain(
          "Earth acknowledgment received on the compressed timeline. Observations archived.",
        );
        if (this.targets().every((t) => d.transmitted.includes(t.id)))
          this.go("debrief");
      }
    }
  }
  /** Array output at this destination: inverse-square sunlight, wing health, stowed = 0. */
  arrayOutput() {
    const d = this.data;
    if (!d.design.solar || d.panelsStowed) return 0;
    const au = SOLAR_DISTANCE_AU[d.destination];
    return solarPower(C.earthOrbit * au, 2, 0.25, 1, 1) * d.panelHealth;
  }
  togglePanels(stow?: boolean) {
    const d = this.data;
    if (!d.design.solar) return;
    d.panelsStowed = stow ?? !d.panelsStowed;
    this.explain(
      d.panelsStowed
        ? "Solar wings folded against the bus. Generation is zero; the battery carries the load until you redeploy."
        : "Solar wings deploying. Hinge motors unfold each panel; generation returns once the wings lock.",
    );
  }
  tickDebris(dt: number) {
    const d = this.data;
    if (!d.design.solar) return;
    if (d.debrisActive > 0) {
      d.debrisActive -= dt;
      d.alert = d.panelsStowed
        ? "DEBRIS CROSSING · wings stowed and protected"
        : `DEBRIS CROSSING · wings exposed · array ${(d.panelHealth * 100).toFixed(0)}%`;
      if (!d.panelsStowed && Math.random() < dt * 0.9) {
        d.panelHealth = Math.max(0.35, d.panelHealth - 0.06);
        d.decisionLog.push("Debris struck open solar wings.");
      }
      if (d.debrisActive <= 0) {
        d.debrisIn = 80 + Math.random() * 70;
        d.alert = "Debris cloud passed · safe to redeploy wings (P)";
      }
      return;
    }
    d.debrisIn -= dt;
    if (d.debrisIn <= 12)
      d.alert = `TRACKING ALERT · debris crossing in ${Math.max(0, d.debrisIn).toFixed(0)} s · fold the solar wings (P)`;
    else if (d.debrisIn < 70 && d.alert.startsWith("Debris cloud passed") && d.debrisIn < 72) d.alert = "";
    if (d.debrisIn <= 0) d.debrisActive = 8;
  }
  releaseProbe() {
    const d = this.data;
    if (!installed(d.design, "probe")) {
      this.explain("No atmospheric entry probe installed. Return to the workshop and attach it to the forward adapter.");
      return;
    }
    if (d.probe.phase !== "attached") return;
    if (!stableAttitude(d.orbital)) {
      this.explain("Probe release needs a stable orbiter: release controls and stabilize (Space) first, so the spin-up and separation are clean.");
      return;
    }
    if (d.battery < 35) {
      this.explain("Wait for charge: probe release and relay need a 35 Wh reserve.");
      return;
    }
    d.probe.phase = "coast";
    d.probe.t = 0;
    this.explain("Pyrotechnic bolts fired: probe spun up to 10 rpm and released. Coasting toward the entry interface.");
  }
  tickProbe(dt: number) {
    const d = this.data,
      p = d.probe;
    if (p.phase === "attached" || p.phase === "complete") return;
    p.t += dt;
    const spec = PROBE_PHASES[p.phase];
    if (p.phase === "descent" || p.phase === "parachute") {
      const a = atmosphereAt(d.destination, p.progress);
      p.pressureBar = a.pressureBar;
      p.temperatureK = a.temperatureK;
      p.altitudeKm = a.altitudeKm;
      p.velocity = a.descentRate;
      p.dataKb += dt * (d.design.antenna ? 1.6 : 0.4) * 8;
      p.progress = Math.min(1, p.progress + dt / (p.phase === "parachute" ? 120 : 34));
    } else if (p.phase === "entry") {
      const f = Math.min(1, p.t / spec.duration);
      p.velocity = (d.destination === "venus" ? 11.5 : d.destination === "jupiter" ? 47.4 : d.destination === "saturn" ? 26 : 22) * 1000 * Math.pow(1 - f, 2.2) + 120;
      p.peakG = Math.max(p.peakG, Math.sin(f * Math.PI) * (d.destination === "jupiter" ? 228 : d.destination === "venus" ? 140 : 90));
      p.altitudeKm = atmosphereAt(d.destination, 0).altitudeKm + (1 - f) * 380;
    }
    if (p.t >= spec.duration) {
      p.t = 0;
      p.phase = spec.next;
      this.explain(spec.message);
      if (p.phase === "complete") {
        if (!d.observations.includes("P2")) d.observations.push("P2");
        d.lastResult = this.targets()[1].result;
      }
    }
  }
  lightsOn() {
    const d = this.data;
    return d.headlights === "on" || (d.headlights === "auto" && sunElevation(d.solTime) < 0.08);
  }
  cycleHeadlights() {
    const d = this.data;
    d.headlights = d.headlights === "auto" ? "on" : d.headlights === "on" ? "off" : "auto";
    this.explain(`Headlights ${d.headlights.toUpperCase()}. Two 12 W LED floodlights; auto turns them on at dusk.`);
  }
  /** Quick hazard-camera look at the nearest feature. No power-intensive instrument. */
  inspect() {
    const d = this.data;
    if (d.stage !== "surface") return;
    this.armFx?.();
    const r = d.rover;
    const near = rocks
      .map((k, i) => ({ ...k, i, dist: Math.hypot(k.x - r.x, k.z - r.z) }))
      .sort((a, b) => a.dist - b.dist)[0];
    const slope = terrainSlope(r.x, r.z);
    const id = near ? `rock-${near.i}` : "ground";
    if (!d.inspections.includes(id)) d.inspections = [...d.inspections, id].slice(-30);
    this.explain(
      near && near.dist < 8
        ? `Hazcam inspection: rock ${near.size.toFixed(1)} m across, ${near.dist.toFixed(1)} m away. Angular, wind-faceted surface; ${near.size > 1.1 ? "too large to drive over" : "low enough to straddle carefully"}. Local slope ${(Math.atan(slope) * 57.3).toFixed(1)}°.`
        : `Hazcam inspection: fine regolith with ${slope > 0.2 ? "ripples" : "a smooth crust"}; local slope ${(Math.atan(slope) * 57.3).toFixed(1)}°. Nearest rock ${near ? near.dist.toFixed(0) : "—"} m away.`,
    );
  }
  /** Service at the surface base: fast charging is passive; this swaps worn parts. */
  serviceAtBase() {
    const d = this.data;
    if (!d.docked) {
      this.explain(`Drive within ${BASE_RADIUS} m of the surface base pad to service the rover.`);
      return;
    }
    d.panelHealth = 1;
    d.rover.speed = 0;
    d.decisionLog.push("Serviced rover at the surface base (spare parts swapped, panels cleaned).");
    this.explain("Base service: dust brushed off the solar deck, a worn wheel module and a spare camera filter swapped from base stock. Charging at 260 W while docked.");
  }
  rockCollision(x: number, z: number) {
    return rocks.some((rock) => {
      const distance = Math.hypot(rock.x - x, rock.z - z);
      const previous = Math.hypot(
        rock.x - this.data.rover.x,
        rock.z - this.data.rover.z,
      );
      return (
        distance < rock.size + 0.85 &&
        !(previous < rock.size + 0.85 && distance > previous + 1e-8)
      );
    });
  }
}
import { seeded } from "./physics";
const random = seeded(balance.seed);
export const rocks = Array.from({ length: 180 }, () => ({
  x: (random() - 0.5) * 290,
  z: (random() - 0.5) * 290,
  size: 0.3 + random() * 1.4,
  rotation: random() * 6,
})).filter(
  (r) =>
    Math.hypot(r.x, r.z) > 17 &&
    Math.hypot(r.x - BASE_POSITION.x, r.z - BASE_POSITION.z) > 24 &&
    !requiredTargets("geology").some(
      (t) => Math.hypot(t.x - r.x, t.z - r.z) < 10,
    ) &&
    ![...requiredTargets("geology"), ...requiredTargets("imaging", true)].some(
      (t) => {
        const length = t.x * t.x + t.z * t.z;
        const u = clamp((r.x * t.x + r.z * t.z) / length, 0, 1);
        return Math.hypot(r.x - u * t.x, r.z - u * t.z) < 7;
      },
    ),
);
export const engine = new MissionEngine();
export const score = (d: FlightData) => ({
  science: d.transmitted.length * 200,
  efficiency: Math.round(d.battery / 6),
  budget: Math.max(0, Math.round((balance.budget - importCost(d.design)) * 5)),
  calibration: d.cruiseChoice === "science" ? 50 : 0,
});
import { cost as importCost } from "./physics";
export const SAVE_KEY = "vydex-mission-v1";
export function encodeSave(d: FlightData) {
  return JSON.stringify({ version: 3, data: d });
}
export function decodeSave(raw: string): FlightData | null {
  try {
    const o = JSON.parse(raw),
      d = o.data;
    if (
      ![1, 2, 3].includes(o.version) ||
      !d ||
      ![
        "rocket",
        "assembly",
        "preflight",
        "launch",
        "cruise",
        "landing",
        "surface",
        "debrief",
        "orbit",
      ].includes(d.stage) ||
      !["imaging", "geology"].includes(d.objective)
    )
      return null;
    if (
      d.destination &&
      !Object.keys(destinations).includes(d.destination)
    )
      return null;
    if (o.version === 1 && d.rover && d.lander) {
      d.rover.steering ??= 0;
      d.lander.roll ??= 0;
      d.lander.pitch ??= 0;
    }
    if (d.design?.launcher !== undefined && !["scout","pioneer","titan"].includes(d.design.launcher)) return null;
    if(o.version<3 && d.stage==='orbit')d.throttle=0;
    if(d.orbital){ d.orbital.roll ??= 0; d.orbital.rollRate ??= 0; }
    if(d.lander) d.lander.yaw ??= 0;
    if(d.engineEnabled !== undefined && typeof d.engineEnabled !== "boolean")return null;
    const base = freshData(
      d.objective,
      !!d.demo,
      undefined,
      d.destination ?? "mars",
    );
    if (
      !d.design ||
      !Object.keys(base.design).every(
        (k) => typeof d.design[k] === typeof base.design[k as keyof Design],
      )
    )
      return null;
    if (
      !Number.isFinite(d.design.cruiseFuel + d.design.descentFuel) ||
      d.design.cruiseFuel < 0 ||
      d.design.cruiseFuel > 400 ||
      d.design.descentFuel < 0 ||
      d.design.descentFuel > 300
    )
      return null;
    for (const key of [
      "battery",
      "cruiseFuel",
      "elapsed",
      "stageTime",
      "cruiseProgress",
      "scanTime",
      "transmitTime",
      "generation",
      "load",
      "energyUsed",
      "energyGenerated",
      "throttle",
    ])
      if (!Number.isFinite(d[key]) || d[key] < 0) return null;
    if (
      d.battery > 600 ||
      d.cruiseFuel > d.design.cruiseFuel ||
      d.cruiseProgress > 1 ||
      d.throttle > 1 ||
      !d.lander ||
      !d.rover
    )
      return null;
    for (const key of [
      "x",
      "y",
      "z",
      "vx",
      "vy",
      "vz",
      "tilt",
      "yaw",
      "roll",
      "pitch",
      "fuel",
      "throttle",
    ])
      if (!Number.isFinite(d.lander[key])) return null;
    for (const key of ["x", "z", "heading", "speed", "distance", "steering"])
      if (!Number.isFinite(d.rover[key])) return null;
    if (
      d.lander.fuel < 0 ||
      d.lander.fuel > d.design.descentFuel ||
      !["flying", "safe", "crashed"].includes(d.lander.status) ||
      !["pending", "save", "science"].includes(d.cruiseChoice)
    )
      return null;
    if(d.captures!==undefined && (!d.captures || typeof d.captures!=='object' || Array.isArray(d.captures) || Object.keys(d.captures).length>4 || Object.entries(d.captures).some(([id,value])=>!d.observations?.includes(id)||typeof value!=='string'||value.length>200000||!/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(value))))return null;
    const validator = new MissionEngine();
    validator.data = { ...base, ...d };
    const validIds = validator.targets().map((t) => t.id);
    for (const key of ["observations", "transmitted"])
      if (
        !Array.isArray(d[key]) ||
        d[key].some((id: unknown) => !validIds.includes(id as string)) ||
        new Set(d[key]).size !== d[key].length
      )
        return null;
    if (d.transmitted.some((id: string) => !d.observations.includes(id)))
      return null;
    for (const key of ["explanations", "decisionLog"])
      if (
        !Array.isArray(d[key]) ||
        d[key].some((v: unknown) => typeof v !== "string")
      )
        return null;
    if (
      !Array.isArray(d.queue) ||
      d.queue.some(
        (q: Command) =>
          !q ||
          (!validIds.includes(q.targetId) && q.targetId !== "home") ||
          !Number.isFinite(q.wait),
      )
    )
      return null;
    if (
      !Array.isArray(d.launchChecks) ||
      d.launchChecks.length !== 3 ||
      d.launchChecks.some((v: unknown) => typeof v !== "boolean")
    )
      return null;
    for (const key of [
      "correction",
      "earthMode",
      "panelTracking",
      "landingStarted",
      "assist",
    ])
      if (typeof d[key] !== "boolean") return null;
    if (
      d.design.parts &&
      Object.entries(d.design.parts).some(
        ([key, v]) => !partIds.includes(key as any) || typeof v !== "boolean",
      )
    )
      return null;
    if (
      d.orbital &&
      (!Object.keys(base.orbital).every(
        (key) =>
          typeof d.orbital[key] ===
          typeof base.orbital[key as keyof OrbitalState],
      ) ||
        [
          "x",
          "y",
          "z",
          "vx",
          "vy",
          "vz",
          "yaw",
          "pitch",
          "yawRate",
          "pitchRate",
          "roll",
          "rollRate",
          "fuelUsed",
        ].some((key) => !Number.isFinite(d.orbital[key])))
    )
      return null;
    if (d.orbital && d.orbital.fuelUsed < 0) return null;
    if (d.timeScale !== undefined && ![0.5, 1, 2, 4].includes(d.timeScale))
      return null;
    return {
      ...base,
      ...d,
      destination: d.destination ?? "mars",
      orbital: { ...base.orbital, ...d.orbital },
      probe: { ...base.probe, ...(d.probe ?? {}) },
      scanId: "",
      transmitting: false,
    };
  } catch {
    return null;
  }
}
export const transfer = transferModel();
