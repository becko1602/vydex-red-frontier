import { describe, expect, it } from "vitest";
import { MissionEngine } from "./game";
import { missionStarter } from "../data/workshop";
import { preflight } from "./physics";
import { stableAttitude } from "./orbit";
import { atmosphereAt } from "./probe";
const advance = (e: MissionEngine, s: number) => { for (let i = 0; i < s * 60; i++) e.tick(1 / 60); };
function toArrival(dest: Parameters<MissionEngine["start"]>[3]) {
  const d = { ...missionStarter(dest!, "imaging"), launcher: "titan" as const }, e = new MissionEngine();
  expect(preflight(d, "imaging", dest).filter((c) => !c.ok)).toEqual([]);
  e.start("imaging", false, d, dest);
  e.go("launch"); e.data.launchChecks = [true, true, true]; advance(e, 37);
  e.chooseCruise("save"); e.correctionBurn(); advance(e, 75); e.arrive();
  return e;
}
describe("All planets are playable", () => {
  for (const dest of ["venus", "jupiter", "saturn", "uranus", "neptune"] as const)
    it(`${dest}: orbiter images, releases probe, relays descent, downlinks`, () => {
      const e = toArrival(dest);
      expect(e.data.stage).toBe("orbit");
      advance(e, 20);
      expect(stableAttitude(e.data.orbital)).toBe(true);
      e.orbitalScience("P1"); advance(e, 9);
      expect(e.data.observations).toContain("P1");
      e.releaseProbe();
      expect(e.data.probe.phase).toBe("coast");
      advance(e, 70);
      expect(e.data.probe.phase).toBe("complete");
      expect(e.data.probe.pressureBar).toBeGreaterThan(5);
      e.transmit(); advance(e, 7);
      expect(e.data.stage).toBe("debrief");
    });
  it("mercury: airless powered landing and station science", () => {
    const e = toArrival("mercury");
    expect(e.data.stage).toBe("landing");
    e.data.landingStarted = true;
    for (let i = 0; i < 150 * 60 && e.data.lander.status === "flying"; i++) e.tick(1 / 60);
    expect(e.data.lander.status).toBe("safe");
    e.go("surface");
    for (const t of e.targets()) { e.interact(t.id); advance(e, 9); }
    e.transmit(); advance(e, 7);
    expect(e.data.stage).toBe("debrief");
  });
  it("stowed wings produce no power and survive debris", () => {
    const e = toArrival("jupiter");
    e.data.panelHealth = 1;
    e.togglePanels(true);
    expect(e.arrayOutput()).toBe(0);
    e.data.debrisIn = 0; advance(e, 10);
    expect(e.data.panelHealth).toBe(1);
  });
  it("jupiter reference atmosphere reaches ~20 bar at the end of the column", () => {
    const a = atmosphereAt("jupiter", 1);
    expect(a.pressureBar).toBeGreaterThan(15);
    expect(a.pressureBar).toBeLessThan(400);
    expect(atmosphereAt("venus", 1).pressureBar).toBeCloseTo(92, 0);
  });
});
