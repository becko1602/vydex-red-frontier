import { describe, expect, it } from "vitest";
import {
  BATTERY_CAPACITY_WH,
  CRUISE_GENERATION_W,
  CRUISE_HIBERNATE_LOAD_W,
  CRUISE_POWER_EPISODE_SECONDS,
  CRUISE_SCIENCE_LOAD_W,
  batteryStep,
  propellantForDeltaV,
  remainingOperatingHours,
} from "./physics";
import { MissionEngine } from "./game";

describe("transfer power and propulsion model", () => {
  it("applies watts over seconds as watt-hours and clamps battery limits", () => {
    expect(
      batteryStep(
        480,
        BATTERY_CAPACITY_WH,
        CRUISE_GENERATION_W,
        CRUISE_HIBERNATE_LOAD_W,
        CRUISE_POWER_EPISODE_SECONDS,
      ),
    ).toBe(514);
    expect(
      batteryStep(
        480,
        BATTERY_CAPACITY_WH,
        CRUISE_GENERATION_W,
        CRUISE_SCIENCE_LOAD_W,
        CRUISE_POWER_EPISODE_SECONDS,
      ),
    ).toBe(370);
  });

  it("reports finite endurance only when the power balance is negative", () => {
    expect(remainingOperatingHours(370, 45, 100)).toBeCloseTo(6.727, 3);
    expect(remainingOperatingHours(600, 45, 28)).toBe(Infinity);
  });

  it("uses a physically valid ideal rocket equation mass delta", () => {
    const propellant = propellantForDeltaV(120, 320, 1000);
    expect(propellant).toBeGreaterThan(0);
    expect(propellant).toBeLessThan(1000);
    expect(propellantForDeltaV(-1, 320, 1000)).toBe(0);
  });

  it("records the selected power episode using the same calculation as the UI", () => {
    const engine = new MissionEngine();
    engine.start("imaging", false, undefined, "mars");
    engine.go("cruise");
    engine.chooseCruise("science");
    expect(engine.data.battery).toBe(370);
    expect(engine.data.generation - engine.data.load).toBe(-55);
    expect(engine.data.energyUsed).toBe(200);
    expect(engine.data.energyGenerated).toBe(90);
  });
});
