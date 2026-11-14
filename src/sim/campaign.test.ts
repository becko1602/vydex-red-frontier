import { describe, it } from "vitest";
import { checks } from "./checks";
describe("Mission science, physics, persistence and complete campaigns", () => {
  for (const check of checks) it(check.name, check.run);
});
