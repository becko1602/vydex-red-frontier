// Uses the same check bodies as Vitest. Run only after compiling tsconfig.sim.json.
const { checks } = require("/tmp/vydex-sim/sim/checks.js");
let failed = 0;
for (const { name, run } of checks) {
  try {
    run();
    console.log("PASS", name);
  } catch (e) {
    failed++;
    console.error("FAIL", name, e.message);
  }
}
console.log(`${checks.length - failed}/${checks.length} checks passed`);
process.exitCode = failed ? 1 : 0;
