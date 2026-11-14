import { beforeAll, describe, it, expect, vi } from "vitest";
import { engine, encodeSave } from "./game";
import { missionStarter } from "../data/workshop";
let useGame: typeof import("../store").useGame;
let replayTutorial: typeof import("../ui/Tutorial").replayTutorial;
const storage = new Map<string, string>();
beforeAll(async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  ({ useGame } = await import("../store"));
  ({ replayTutorial } = await import("../ui/Tutorial"));
});
describe("Interface state preserves a spacecraft and mission", () => {
  it("opening and returning from component information preserves all assembled equipment and mission resources", () => {
    engine.start("geology", false, missionStarter("mars", "geology"), "mars");
    useGame.getState().sync();
    const before = encodeSave(engine.data);
    for (const part of ["body", "battery", "legs", "drill"] as const) {
      useGame.getState().setWorkshop({ info: part, selected: part });
      useGame.getState().setWorkshop({ info: null });
    }
    expect(encodeSave(engine.data)).toBe(before);
  });
  it("skip persists locally and replay resumes the contextual tutorial without resetting mission progress", () => {
    engine.start("imaging", false, missionStarter("moon", "imaging"), "moon");
    engine.go("landing");
    engine.data.lander.y = 275;
    useGame.getState().sync();
    const before = encodeSave(engine.data);
    useGame.getState().setTutorial({
      enabled: false,
      completed: ["briefing", "landing:moon"],
      hold: false,
    });
    expect(JSON.parse(storage.get("vydex-tutorial-v1")!).enabled).toBe(false);
    replayTutorial();
    expect(useGame.getState().tutorial.enabled).toBe(true);
    expect(useGame.getState().tutorial.completed).not.toContain("landing:moon");
    expect(encodeSave(engine.data)).toBe(before);
  });
  it("returning to the destination selector cannot overwrite a previous valid mission save", () => {
    engine.start("imaging", false, missionStarter("earth", "imaging"), "earth");
    engine.go("orbit");
    useGame.getState().sync();
    useGame.getState().save();
    const before = storage.get("vydex-mission-v1");
    engine.go("briefing");
    useGame.getState().save();
    expect(storage.get("vydex-mission-v1")).toBe(before);
  });
});
