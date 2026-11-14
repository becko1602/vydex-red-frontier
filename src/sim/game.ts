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
  type DestinationId,
} from "../data/destinations";
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
  };
}
export class MissionEngine {
  data: FlightData = freshData();
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
    if (stage === "landing") {
      this.data.lander = initialLander(this.data.design, this.data.destination);
      this.data.landingStarted = false;
    }
    if (stage === "surface") {
      this.data.rover.x = this.data.lander.x + (this.data.destination === "moon" ? 4 : 0);
      this.data.rover.z = this.data.lander.z + (this.data.destination === "moon" ? 4 : 0);
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
    const dv =
      d.destination === "mars" ? 120 : d.destination === "moon" ? 60 : 30;
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
      generation = 45,
      dt = 7200;
    const save = batteryStep(baseline, 600, generation, 28, dt),
      science = batteryStep(baseline, 600, generation, 100, dt);
    d.battery = choice === "save" ? save : science;
    d.load=choice==='save'?28:100;d.generation=45;
    d.energyUsed += (choice === "save" ? 28 : 100) * 2;
    d.energyGenerated += 90;
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
    if (!d.design.antenna) {
      this.explain("An antenna is required to transmit.");
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
    if(["earth","asteroid"].includes(this.data.destination))this.data.throttle=0;
    this.go(
      ["earth", "asteroid"].includes(this.data.destination)
        ? "orbit"
        : "landing",
    );
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
      d.design.solar ? solarPower(C.earthOrbit, 2, 0.25, 1, 1) : 0,
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
    ) : 0;
    d.cruiseFuel = Math.max(0, d.cruiseFuel - used);
    const active = this.targets().find((t) => t.id === d.scanId);
    this.power(
      dt * 30,
      28 +
        (active ? parts[active.instrument].power : 0) +
        (d.transmitting ? 30 : 0),
      d.design.solar && (d.destination !== "earth" || orb.deployed)
        ? solarPower(C.earthOrbit, 2, 0.25, 1, 1)
        : 0,
    );
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
    if (d.scanId && d.destination === "earth" && !stableAttitude(orb)) {
      d.scanId = "";
      d.scanTime = 0;
      this.explain(
        "Exposure cancelled: release attitude inputs and enable stabilization before trying the camera again.",
      );
    }
    this.tickScience(dt);
  }
  delay() {
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
      d.design.battery ? 600 : 0,
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
            (d.demo
              ? 18
              : d.destination === "moon"
                ? 28
                : d.destination === "earth"
                  ? 15
                  : 45),
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
    if (d.stage === "surface" && d.destination === "moon") {
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
    const generation = d.design.solar
      ? solarPower(C.marsOrbit, 2, 0.25, cosine, balance.dust)
      : 0;
    const load =
      28 +
      (Math.abs(r.speed) > 0.1
        ? balance.drivingW + Math.min(50, slope * 100)
        : 0) +
      (low ? 0 : instrW) +
      (d.transmitting ? 30 : 0);
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
      !["earth", "moon", "mars", "asteroid"].includes(d.destination)
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
      scanId: "",
      transmitting: false,
    };
  } catch {
    return null;
  }
}
export const transfer = transferModel();
