import { describe, it, expect } from "vitest";
import { MissionEngine, neutral, encodeSave, decodeSave } from "./game";
import {
  parts,
  partIds,
  requiredParts,
  emptyDesign,
  missionStarter,
  changePart,
  compatibility,
  installed,
} from "../data/workshop";
import { preflight, cost, masses, initialLander, landerStep } from "./physics";
import { environment, type PlayableDestination } from "../data/destinations";
import {
  earthOrbit,
  sampleCorridor,
  stableAttitude,
  initialOrbit,
} from "./orbit";
function ticks(e: MissionEngine, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) e.tick(1 / 60, neutral);
}
function travel(dest: PlayableDestination) {
  const e = new MissionEngine();
  e.start("imaging", false, missionStarter(dest, "imaging"), dest);
  expect(preflight(e.data.design, "imaging", dest).every((c) => c.ok)).toBe(
    true,
  );
  e.go("launch");
  e.data.launchChecks = [true, true, true];
  ticks(e, 38);
  expect(e.data.stage).toBe("cruise");
  e.chooseCruise("save");
  e.correctionBurn();
  ticks(e, 55);
  expect(e.data.cruiseProgress).toBe(1);
  e.arrive();
  return e;
}
describe("Workshop, mission expansion and progress preservation", () => {
  for (const destination of [
    "earth",
    "moon",
    "mars",
    "asteroid",
  ] as PlayableDestination[])
    it(`can manually assemble a valid ${destination} mission component by component`, () => {
      let d = emptyDesign();
      for (const id of partIds.filter((id) =>
        requiredParts(destination, "imaging").includes(id),
      )) {
        expect(compatibility(d, id, destination, true)).toBe("");
        d = changePart(d, id, true);
      }
      if (destination === "earth" || destination === "asteroid")
        d.descentFuel = 0;
      expect(preflight(d, "imaging", destination).every((c) => c.ok)).toBe(
        true,
      );
    });
  it("rejects incompatible attachments and explains the missing mount", () => {
    expect(compatibility(emptyDesign(), "battery", "mars")).toContain(
      "structural bus",
    );
    expect(
      compatibility(missionStarter("moon", "imaging"), "rover", "moon"),
    ).toContain("Mars");
    expect(
      compatibility(missionStarter("earth", "imaging"), "legs", "earth"),
    ).toContain("orbital");
    expect(
      compatibility(missionStarter("asteroid", "imaging"), "drill", "asteroid"),
    ).toContain("Mars rover");
  });
  it("requires safe removal order, then permits removal and reinstallation", () => {
    let d = missionStarter("mars", "imaging");
    expect(compatibility(d, "body", "mars", false)).toContain("Remove");
    expect(compatibility(d, "battery", "mars", false)).toBe("");
    const before = masses(d).wet,
      credits = cost(d);
    d = changePart(d, "battery", false);
    expect(masses(d).wet).toBe(before - 15);
    expect(cost(d)).toBe(credits - 5);
    d = changePart(d, "battery", true);
    expect(masses(d).wet).toBe(before);
    expect(cost(d)).toBe(credits);
  });
  it("provides a full field guide for even structural parts", () => {
    for (const p of Object.values(parts)) {
      expect(p.purpose.length).toBeGreaterThan(10);
      expect(p.example.length).toBeGreaterThan(10);
      expect(p.omission.length).toBeGreaterThan(10);
      expect(p.slot).toBeTruthy();
      expect(p.mass).toBeGreaterThan(0);
    }
  });
  it("empty workshop has no prepared battery or propellant without equipment", () => {
    const e = new MissionEngine();
    e.start("imaging", false, emptyDesign());
    expect(e.data.battery).toBe(0);
    expect(e.data.cruiseFuel).toBe(0);
    expect(e.data.lander.fuel).toBe(0);
    expect(masses(e.data.design).wet).toBe(0);
  });
  it("uses lunar gravity with exactly zero atmospheric drag", () => {
    const d = missionStarter("moon", "imaging"),
      s = initialLander(d, "moon");
    s.fuel = 0;
    const before = s.vy;
    landerStep(
      s,
      masses(d).descentDry,
      1,
      { throttle: 0, x: 0, z: 0, assist: false },
      environment("moon"),
      "moon",
    );
    expect(s.vy).toBeCloseTo(before - 1.62, 8);
    expect(environment("moon").density).toBe(0);
  });
  it("derives a plausible 400 km circular Earth orbit from sourced SI constants", () => {
    const o = earthOrbit();
    expect(o.speed).toBeGreaterThan(7600);
    expect(o.speed).toBeLessThan(7800);
    expect(o.period / 60).toBeGreaterThan(90);
    expect(o.period / 60).toBeLessThan(95);
  });
  it("completes Earth deployment, camera observation and acknowledged downlink", () => {
    const e = travel("earth");
    expect(e.data.stage).toBe("orbit");
    ticks(e, 20);
    expect(stableAttitude(e.data.orbital)).toBe(true);
    e.deploySatellite();
    expect(e.data.orbital.deployed).toBe(true);
    e.orbitalScience("E1");
    ticks(e, 9);
    expect(e.data.observations).toContain("E1");
    e.transmit();
    ticks(e, 7);
    expect(e.data.stage).toBe("debrief");
  });
  it("completes an airless Moon descent and both stationary science objectives", () => {
    const e = travel("moon");
    e.data.landingStarted = true;
    for (let i = 0; i < 120 * 60 && e.data.lander.status === "flying"; i++)
      e.tick(1 / 60);
    expect(e.data.lander.status).toBe("safe");
    expect(e.data.lander.fuel).toBeGreaterThan(0);
    e.go("surface");
    for (const id of ["M1", "M2"]) {
      e.interact(id);
      ticks(e, 9);
      expect(e.data.observations).toContain(id);
    }
    e.transmit();
    ticks(e, 7);
    expect(e.data.stage).toBe("debrief");
    expect(e.data.transmitted).toHaveLength(2);
  });
  it("completes an actual fuel-consuming asteroid approach, scan and sample", () => {
    const e = travel("asteroid"),
      fuel = e.data.cruiseFuel;
    e.data.orbital.autopilot = true;
    for (
      let i = 0;
      i < 180 * 60 &&
      !sampleCorridor(e.data.orbital) &&
      !e.data.orbital.crashed;
      i++
    )
      e.tick(1 / 60);
    expect(e.data.orbital.crashed).toBe(false);
    expect(sampleCorridor(e.data.orbital)).toBe(true);
    expect(e.data.cruiseFuel).toBeLessThan(fuel);
    for (const id of ["A1", "A2"]) {
      e.orbitalScience(id);
      ticks(e, 11);
      expect(e.data.observations).toContain(id);
    }
    e.transmit();
    ticks(e, 7);
    expect(e.data.stage).toBe("debrief");
  });
  it("refuses premature deployment and premature sampling with an actionable explanation", () => {
    const e = travel("earth");
    e.deploySatellite();
    expect(e.data.orbital.deployed).toBe(false);
    expect(e.data.explanations[0]).toContain("stabil");
    const a = travel("asteroid");
    a.orbitalScience("A1");
    expect(a.data.scanId).toBe("");
    expect(a.data.explanations[0]).toContain("5 m");
  });
  it("prevents arrival before the required correction burn", () => {
    const e = new MissionEngine();
    e.start("imaging");
    e.go("cruise");
    e.data.cruiseProgress = 1;
    e.arrive();
    expect(e.data.stage).toBe("cruise");
  });
  it("restores assembled parts and destination without resetting progress", () => {
    const e = travel("asteroid");
    e.data.orbital.x = 2;
    e.data.observations = ["A1"];
    const saved = decodeSave(encodeSave(e.data));
    expect(saved?.destination).toBe("asteroid");
    expect(saved?.orbital.x).toBe(2);
    expect(saved?.observations).toEqual(["A1"]);
    expect(saved?.design.parts).toEqual(e.data.design.parts);
  });
  it("migrates an existing version-one Mars save with its original design and progress", () => {
    const e = new MissionEngine();
    e.go("surface");
    e.data.observations = ["01"];
    const data: any = { ...e.data };
    delete data.destination;
    delete data.orbital;
    delete data.timeScale;
    delete data.cinematicSkipped;
    const saved = decodeSave(JSON.stringify({ version: 1, data }));
    expect(saved?.destination).toBe("mars");
    expect(saved?.observations).toEqual(["01"]);
    expect(saved?.design).toEqual(e.data.design);
  });
  it("cancels an Earth exposure when the vehicle is steered outside stabilization limits", () => {
    const e = travel("earth");
    ticks(e, 20);
    e.deploySatellite();
    e.orbitalScience("E1");
    e.data.assist = false;
    for (let i = 0; i < 90; i++) e.tick(1 / 60, { ...neutral, turn: 1 });
    expect(e.data.scanId).toBe("");
    expect(e.data.observations).not.toContain("E1");
    expect(e.data.explanations[0]).toContain("Exposure cancelled");
  });
  it("manual attitude input is not overridden by the position-centering assist", () => {
    const e = travel("earth");
    e.tick(1 / 60, { ...neutral, turn: 1 });
    expect(e.data.orbital.yawRate).toBeGreaterThan(0);
  });
  it("removing a descent engine removes actual thrust and propellant flow", () => {
    const d = changePart(
        missionStarter("moon", "imaging"),
        "descentEngine",
        false,
      ),
      e = new MissionEngine();
    e.start("imaging", false, d, "moon");
    e.go("landing");
    e.data.landingStarted = true;
    e.data.assist = false;
    e.data.throttle = 1;
    const fuel = e.data.lander.fuel,
      vy = e.data.lander.vy;
    ticks(e, 1);
    expect(e.data.lander.fuel).toBe(fuel);
    expect(e.data.lander.vy).toBeCloseTo(vy - 1.62, 6);
  });
  it("a craft without landing legs cannot receive a safe touchdown result", () => {
    const e = new MissionEngine();
    e.start(
      "imaging",
      false,
      changePart(missionStarter("moon", "imaging"), "legs", false),
      "moon",
    );
    e.go("landing");
    e.data.landingStarted = true;
    for (let i = 0; i < 120 * 60 && e.data.lander.status === "flying"; i++)
      e.tick(1 / 60);
    expect(e.data.lander.status).toBe("crashed");
    expect(e.data.lander.reason).toContain("legs");
  });
  it("deployed satellite reaction wheels no longer consume separated cruise fuel", () => {
    const e = travel("earth");
    ticks(e, 20);
    e.deploySatellite();
    const fuel = e.data.cruiseFuel;
    e.data.orbital.yaw = 0.2;
    ticks(e, 8);
    expect(e.data.cruiseFuel).toBe(fuel);
    expect(Math.abs(e.data.orbital.yaw)).toBeLessThan(0.12);
  });
  it("asteroid contact can be retried without resetting the spacecraft", () => {
    const e = travel("asteroid");
    e.data.orbital.z = 9;
    e.tick(1 / 60);
    expect(e.data.orbital.crashed).toBe(true);
    e.data.orbital = initialOrbit();
    expect(e.data.orbital.crashed).toBe(false);
    expect(installed(e.data.design, "sampler")).toBe(true);
  });
});
