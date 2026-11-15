import { describe, expect, it } from "vitest";
import { initialLander, landerStep, launchAscent, terrainHeight } from "./physics";
import { missionStarter } from "../data/workshop";
import { environment } from "../data/destinations";
import { launchers } from "../data/launchVehicles";

describe("continuous lunar surface and local descent gravity", () => {
  it("keeps a crater bowl, rim, and surrounding terrain in one height field", () => {
    const floor = terrainHeight(0, 0, "moon");
    const rim = terrainHeight(16, 0, "moon");
    const plain = terrainHeight(28, 0, "moon");
    expect(rim).toBeGreaterThan(floor + 1);
    expect(Number.isFinite(plain)).toBe(true);
    expect(Math.abs(terrainHeight(0, 0, "moon") - terrainHeight(0, 0, "mars"))).toBeGreaterThan(.1);
  });

  it("uses lunar gravity with no atmospheric braking when thrust is off", () => {
    const lander = initialLander(missionStarter("moon", "imaging"), "moon");
    const altitude = lander.y;
    landerStep(lander, 300, 1, { throttle: 0, x: 0, z: 0, assist: false, thrust: 0 }, environment("moon"), "moon");
    expect(lander.vy).toBeCloseTo(-8 - environment("moon").gravity, 8);
    expect(lander.y).toBeCloseTo(altitude + lander.vy, 8);
    expect(lander.x).toBe(0);
    expect(lander.z).toBe(0);
  });

  it("conserves example ascent mass as propellant is consumed and computes drag", () => {
    const spec = launchers.titan.ascentModel;
    const start = launchAscent(spec, 900, 0);
    const after = launchAscent(spec, 900, 20);
    expect(after.altitudeM).toBeGreaterThan(start.altitudeM);
    expect(after.verticalSpeedMps).toBeGreaterThan(0);
    expect(after.propellantKg).toBeLessThan(start.propellantKg);
    expect(after.massKg).toBeCloseTo(spec.dryMassKg + 900 + after.propellantKg, 5);
    expect(after.dragN).toBeGreaterThan(0);
  });
});
