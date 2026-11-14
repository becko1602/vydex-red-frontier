import { C } from "../data/scienceConstants";
import { balance, starter, type Objective } from "../data/gameBalance";
import { MissionEngine, decodeSave, encodeSave, neutral, score } from "./game";
import {
  batteryStep,
  classifyLanding,
  communicationDelay,
  deltaV,
  fixedAdvance,
  initialLander,
  landerStep,
  masses,
  planetPositions,
  preflight,
  seeded,
  solarPower,
  transferModel,
  transferPosition,
} from "./physics";
function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}
function close(a: number, b: number, tolerance = 1e-7) {
  assert(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
}
function tickFor(e: MissionEngine, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) e.tick(1 / 60, neutral);
}
function land(e: MissionEngine) {
  e.go("landing");
  e.data.landingStarted = true;
  for (let i = 0; i < 120 * 60 && e.data.lander.status === "flying"; i++)
    e.tick(1 / 60);
  assert(
    e.data.lander.status === "safe",
    `Landing failed: ${e.data.lander.reason}; fuel ${e.data.lander.fuel}`,
  );
  assert(e.data.lander.fuel > 0);
}
function complete(objective: Objective, demo = false) {
  const e = new MissionEngine();
  e.start(objective, demo);
  assert(preflight(e.data.design, objective).every((c) => c.ok));
  e.go("launch");
  e.data.launchChecks = [true, true, true];
  tickFor(e, 38);
  assert(e.data.stage === "cruise");
  e.chooseCruise("save");
  e.correctionBurn();
  tickFor(e, 46);
  assert(e.data.cruiseProgress === 1);
  assert(e.data.correction);
  land(e);
  e.go("surface");
  e.data.earthMode = true;
  for (const t of e.targets()) {
    e.queueTarget(t.id);
    let n = 0;
    while (e.data.queue.length && n++ < 180 * 60) e.tick(1 / 60);
    assert(
      e.data.queue.length === 0,
      `Autonomy stuck approaching ${t.id}: ${e.data.rover.x}, ${e.data.rover.z}`,
    );
    assert(e.nearest().id === t.id, `Expected ${t.id}`);
    e.interact();
    assert(e.data.scanId === t.id);
    tickFor(e, 13);
    assert(e.data.observations.includes(t.id));
  }
  e.transmit();
  tickFor(e, 7);
  assert(String(e.data.stage) === "debrief", "Mission did not reach debrief");
  assert(e.data.transmitted.length === (demo ? 1 : 3));
  assert(e.data.battery >= 0 && e.data.battery <= 600);
  return e;
}
export const checks: { name: string; run: () => void }[] = [
  {
    name: "Rocket equation matches analytic value",
    run() {
      close(deltaV(320, 1000, 500), 320 * C.g0 * Math.log(2));
    },
  },
  {
    name: "Rocket equation rejects invalid or nonfinite inputs safely",
    run() {
      for (const args of [
        [0, 100, 50],
        [320, 40, 50],
        [320, 100, 0],
        [NaN, 100, 50],
        [320, Infinity, 50],
        [-3, 100, 50],
      ])
        assert(deltaV(...(args as [number, number, number])) === 0);
    },
  },
  {
    name: "Fuel cannot become negative and no thrust remains when empty",
    run() {
      const s = initialLander(starter("imaging"));
      s.fuel = 0.001;
      landerStep(s, 400, 1, { throttle: 1, x: 0, z: 0, assist: false });
      assert(s.fuel === 0);
      landerStep(s, 400, 1, { throttle: 1, x: 0, z: 0, assist: false });
      assert(s.fuel === 0);
      assert(400 + s.fuel === 400);
    },
  },
  {
    name: "Descent acceleration depends on current mass",
    run() {
      const a = initialLander(starter("imaging")),
        b = { ...a };
      landerStep(a, 400, 0.1, { throttle: 1, x: 0, z: 0, assist: false });
      landerStep(b, 600, 0.1, { throttle: 1, x: 0, z: 0, assist: false });
      assert(a.vy > b.vy);
    },
  },
  {
    name: "Stage separation drops cruise module, engine and remaining cruise fuel",
    run() {
      const d = starter("geology"),
        m = masses(d);
      close(m.wet - m.descentWet, 120 + d.cruiseFuel);
      close(m.descentWet - m.surface, 25 + d.descentFuel);
    },
  },
  {
    name: "Battery clamps both boundaries",
    run() {
      assert(batteryStep(590, 600, 1000, 0, 3600) === 600);
      assert(batteryStep(1, 600, 0, 1000, 3600) === 0);
    },
  },
  {
    name: "Energy accounting is consistent across timestep partitions",
    run() {
      let wh = 300;
      for (let i = 0; i < 600; i++) wh = batteryStep(wh, 600, 112, 80, 0.1);
      close(wh, batteryStep(300, 600, 112, 80, 60), 1e-8);
    },
  },
  {
    name: "Solar inverse square and single cosine factor",
    run() {
      close(solarPower(C.AU, 2, 0.25, 0.5, 0.72), 1361 * 2 * 0.25 * 0.5 * 0.72);
      close(
        solarPower(2 * C.AU, 2, 0.25, 1, 1),
        solarPower(C.AU, 2, 0.25, 1, 1) / 4,
      );
      assert(solarPower(C.AU, 2, 0.25, -1, 1) === 0);
    },
  },
  {
    name: "Communications use metres and SI speed of light",
    run() {
      close(communicationDelay(C.AU), 499.004783836, 1e-6);
      assert(communicationDelay(-10) === 0);
    },
  },
  {
    name: "Hohmann timing is approximately 259 days",
    run() {
      const t = transferModel();
      assert(t.time / 86400 > 258 && t.time / 86400 < 260);
    },
  },
  {
    name: "Transfer endpoints meet Earth at departure and Mars at arrival",
    run() {
      for (const f of [0, 1]) {
        const s = transferPosition(f),
          p = planetPositions(f),
          planet = f === 0 ? p.earth : p.mars;
        close(s.x, planet.x, 0.001);
        close(s.z, planet.z, 0.001);
      }
    },
  },
  {
    name: "Elliptical transfer time parameterization is nonlinear",
    run() {
      const start = transferPosition(0),
        a = transferPosition(0.1),
        b = transferPosition(0.9),
        end = transferPosition(1);
      assert(
        Math.hypot(a.x - start.x, a.z - start.z) >
          Math.hypot(end.x - b.x, end.z - b.z),
      );
    },
  },
  {
    name: "Identical seeds produce identical outcomes",
    run() {
      const a = seeded(balance.seed),
        b = seeded(balance.seed);
      for (let i = 0; i < 100; i++) assert(a() === b());
    },
  },
  {
    name: "Fixed step bounds catch-up after a long inactive frame",
    run() {
      let calls = 0;
      const rest = fixedAdvance(0, 500, () => calls++);
      assert(calls <= 6 && rest < 1 / 60 + 0.000001);
    },
  },
  {
    name: "Both starter designs pass every preflight check",
    run() {
      for (const o of ["imaging", "geology"] as Objective[])
        for (const c of preflight(starter(o), o))
          assert(c.ok, `${o}: ${c.label}: ${c.detail}`);
    },
  },
  {
    name: "Missing required hardware fails meaningful preflight checks",
    run() {
      const d = starter("geology");
      d.drill = false;
      d.battery = false;
      const c = preflight(d, "geology");
      assert(!c.find((x) => x.label === "Science payload")?.ok);
      assert(!c.find((x) => x.label === "Power + communication")?.ok);
    },
  },
  {
    name: "Safe and unsafe touchdown classification observes all three limits",
    run() {
      assert(classifyLanding(-2.9, 1.9, 0.1));
      assert(!classifyLanding(-3, 0, 0));
      assert(!classifyLanding(-1, 2, 0));
      assert(!classifyLanding(-1, 0, (13 * Math.PI) / 180));
    },
  },
  {
    name: "Assisted imaging and geology landings both preserve fuel",
    run() {
      for (const objective of ["imaging", "geology"] as Objective[]) {
        const e = new MissionEngine();
        e.start(objective);
        land(e);
      }
    },
  },
  {
    name: "Unpowered descent fails, immediate retry can land safely",
    run() {
      const e = new MissionEngine();
      e.start("imaging");
      e.go("landing");
      e.data.assist = false;
      e.data.throttle = 0;
      e.data.landingStarted = true;
      tickFor(e, 60);
      assert(e.data.lander.status === "crashed");
      e.data.assist = true;
      e.data.throttle = 0.5;
      land(e);
    },
  },
  {
    name: "Correction burn consumes only cruise-stage propellant and is idempotent",
    run() {
      const e = new MissionEngine(),
        before = e.data.cruiseFuel,
        descent = e.data.lander.fuel;
      e.correctionBurn();
      assert(e.data.cruiseFuel < before);
      close(e.data.lander.fuel, descent);
      const after = e.data.cruiseFuel;
      e.correctionBurn();
      close(e.data.cruiseFuel, after);
    },
  },
  {
    name: "Cruise comparison genuinely computes energy from same starting state",
    run() {
      const a = new MissionEngine(),
        b = new MissionEngine();
      a.chooseCruise("save");
      b.chooseCruise("science");
      close(a.data.battery - b.data.battery, 144);
      assert(a.data.explanations[0].includes("514 Wh"));
      assert(b.data.explanations[0].includes("370 Wh"));
    },
  },
  {
    name: "Low-battery protection recovers with solar generation",
    run() {
      const e = new MissionEngine();
      e.go("surface");
      e.data.battery = 0;
      e.data.panelTracking = true;
      tickFor(e, 30);
      assert(e.data.battery > 30);
      assert(e.data.rover.distance === 0);
    },
  },
  {
    name: "Save/load round trip restores mission values and rejects invalid versions",
    run() {
      const e = new MissionEngine();
      e.go("surface");
      e.data.battery = 123.4;
      e.data.rover.x = 12;
      const d = decodeSave(encodeSave(e.data));
      assert(d);
      close(d.battery, 123.4);
      assert(d.rover.x === 12 && d.stage === "surface");
      assert(decodeSave('{"version":2}') === null);
      assert(decodeSave("bad") === null);
      const invalid = JSON.parse(encodeSave(e.data));
      invalid.data.battery = -1;
      assert(decodeSave(JSON.stringify(invalid)) === null);
    },
  },
  {
    name: "A full imaging campaign completes using actual drive, science and transmit systems",
    run() {
      complete("imaging");
    },
  },
  {
    name: "A full geology campaign completes with two spectral readings and a drill sample",
    run() {
      complete("geology");
    },
  },
  {
    name: "Judge demo completes using the same physics and objective systems",
    run() {
      const e = complete("imaging", true);
      assert(score(e.data).science === 200);
    },
  },
];
