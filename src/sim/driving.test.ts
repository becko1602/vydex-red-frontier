import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { DriveKeyboard, roverView } from "./controls";
import { MissionEngine, neutral, rocks } from "./game";
describe("Rover driving regressions", () => {
  it("rendered rover nose points along actual travel after left and right turns", () => {
    for (const h of [-2, -1, 0, 1, 2]) {
      const v = roverView(h),
        nose = new Vector3(0, 0, -1).applyAxisAngle(
          new Vector3(0, 1, 0),
          v.modelYaw,
        );
      expect(nose.x).toBeCloseTo(v.forwardX);
      expect(nose.z).toBeCloseTo(v.forwardZ);
    }
  });
  it("opposite keys cancel, releasing one restores the other", () => {
    const k = new DriveKeyboard();
    k.update("w", true);
    expect(k.update("s", true).forward).toBe(0);
    expect(k.update("s", false).forward).toBe(1);
  });
  it("releasing a keyboard alias leaves the other held alias active", () => {
    const k = new DriveKeyboard();
    k.update("w", true);
    k.update("arrowup", true);
    expect(k.update("arrowup", false).forward).toBe(1);
  });
  it("release and blur reset prevent stuck steering or throttle", () => {
    const k = new DriveKeyboard();
    k.update("a", true);
    k.update("w", true);
    k.clear();
    expect(k.axes()).toEqual(neutral);
  });
  it("turns retain the correct lateral descent axes", () => {
    const k = new DriveKeyboard();
    expect(k.update("a", true)).toMatchObject({ turn: 1, lateralX: -1 });
    expect(k.update("s", true).lateralZ).toBe(1);
  });
  it("camera and look-ahead rotate together through a complete turn", () => {
    for (const h of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const v = roverView(h);
      expect(v.cameraX * v.forwardX + v.cameraZ * v.forwardZ).toBeCloseTo(-9.5);
      expect(v.lookX * v.forwardX + v.lookZ * v.forwardZ).toBeCloseTo(2.5);
    }
  });
  it("brake stops the rover even while the accelerator remains held", () => {
    const e = new MissionEngine();
    e.go("surface");
    e.data.rover.speed = 3;
    for (let i = 0; i < 120; i++)
      e.tick(1 / 60, { ...neutral, forward: 1, brake: true });
    expect(e.data.rover.speed).toBe(0);
  });
  it("steering approaches input smoothly instead of snapping every HUD refresh", () => {
    const e = new MissionEngine();
    e.go("surface");
    e.tick(1 / 60, { ...neutral, turn: 1 });
    expect(e.data.rover.steering).toBeGreaterThan(0);
    expect(e.data.rover.steering).toBeLessThan(0.3);
  });
  it("allows escape from an already-overlapping rock and blocks driving deeper", () => {
    const e = new MissionEngine();
    const rock = rocks.find((r) =>
      rocks.every(
        (other) => other === r || Math.hypot(other.x - r.x, other.z - r.z) > 6,
      ),
    )!;
    e.go("surface");
    e.data.rover.x = rock.x + rock.size + 0.8;
    e.data.rover.z = rock.z;
    expect(e.rockCollision(e.data.rover.x + 0.02, rock.z)).toBe(false);
    expect(e.rockCollision(e.data.rover.x - 0.02, rock.z)).toBe(true);
  });
});
