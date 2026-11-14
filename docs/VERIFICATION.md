# Verification — destination/workshop expansion, 2026-11-10

## Executed results

- **61/61 Vitest tests pass across four files:** 26 original science/campaign checks, nine rover regressions, 23 component/expanded-mission checks and three interface-state/progress checks.
- **Production build passes** TypeScript and Vite, including generation of the production offline service worker.
- **Three offline-worker checks pass:** every precache asset exists, cache cleanup preserves unrelated application caches, and offline navigation/planet reads resolve to cached data.
- **Eight current Playwright workflows are discovered** with `npm run test:browser -- --list`. Discovery is not an executed browser playthrough.
- All added planet files were actually fetched, decoded and identified as valid JPEG images; no Git LFS pointers or invented downloads are included.

Whole-production output, including all lazy scenes, every planet map and the offline worker: **3,987,267 raw bytes; 2,959,168 gzip bytes; 2,885,881 Brotli bytes**. Detailed measurements are in BUILD_METRICS.json. This is local compression of the complete dist, not an initial-network trace or an FPS benchmark. Vite reports one large shared JS chunk warning; the build succeeds.

## Verified through the actual engine

Manual required-part assembly for Earth orbit, Moon, Mars and asteroid; compatible/incompatible attachments; dependency-aware removal; mass/cost changes on removal and reinstallation; complete equipment-guide data; empty-design resource limits; missing-engine thrust removal; missing-leg touchdown failure; distinct lunar gravity with exactly zero drag; sourced circular Earth-orbit calculations; blocked premature deployment/sampling/arrival; propellant-consuming asteroid approach, scan and sampling; deployed satellite reaction-wheel control; exposure cancellation after destabilization; complete acknowledged Earth, lunar, both original Mars objectives and judge-demo mission endings; asteroid failure/retry; save/load with assembled parts and destination; version-1 Mars-save migration.

Interface-state tests confirm information-panel open/close does not change the craft or resources, tutorial skip/replay persists and preserves progress, and briefing cannot overwrite an existing valid mission save. These test the state controllers, not real mouse/touch rendering.

## Implemented visual and interaction systems

Sixteen individually mounted workshop components; selection outlines, ghost preview, attachment/removal animation, exploded view, click install and HTML drag/drop; explicit ⓘ guides; contextual lessons with real-control highlighting; four playable destinations and three labeled previews; shared assembled spacecraft across provider launch, separation, transfer, descent and operations; fairing inspection and payload reveal; follow/cinematic/overview cameras, zoom, restrained optional shake, synthesized engine sonification, presentation speed controls and decision-safe cinematic skip; airless cratered lunar terrain, dusty Mars terrain and rover tracks, textured Earth/Moon/Mars/gas-planet previews; accessible install/offline UI.

The same saved design feeds numerical mass/capability checks and the rendered component hierarchy. Cruise hardware and fuel are excluded at lunar/Mars descent and satellite deployment. The asteroid probe retains its cruise stage for RCS. Satellite post-release attitude is explicitly modeled with fictional integrated reaction wheels rather than propellant from a discarded engine.

## Browser verification limit

A fresh Vite start failed with **`listen EPERM: operation not permitted 0.0.0.0:5173`**. The current Playwright default browser revision was not cached; a launch using the already cached Chromium headless shell also terminated under the restricted environment. Earlier full Chromium attempts failed with a prohibited socket operation. No permissions were bypassed, and no browser screenshots or executed browser mission flows are claimed.

Consequently the final appearance, actual drag/drop picking, touch layout, shader output, camera/separation presentation, install prompt and browser console remain **browser-unverified**. The supplied Playwright suite covers these user flows for execution on a machine that can run a browser/server.

No updated hosted version was published because terminal access to the hosting Git endpoint remains unavailable. Local production source/build archives are supplied instead.

## Scientific and product limits

- Earth ascent is a labeled provider cinematic, not a physical launch simulation. Its presentation progress is not calculated flight telemetry.
- Mars retains the idealized circular coplanar Hohmann model; lunar travel is an illustrative three-day geocentric schedule, not a solved lunar trajectory.
- VY-26, its 36-day journey, range, shape, safety sphere and negligible-gravity proximity scenario are fictional.
- Moon final descent uses uniform 1.62 m/s² and zero drag; Mars uses uniform 3.73 m/s² and the documented exponential atmosphere. Neither models hypersonic entry heating.
- Ground contact and rover driving are arcade-assisted height-field approximations. Planet render sizes and selector rotations are illustrative.
- Venus, Jupiter and Saturn are educational previews with disabled mission-start controls.
- Full orbital perturbations, eclipse/thermal cycles, real ephemerides and NASA spacecraft specifications are not modeled. No integrated-GPU frame-rate guarantee is claimed.

## Reproduce

```sh
npm test
npm run build
node scripts/check-offline.mjs
npm run measure
npm run preview
```

Open http://localhost:4173. Resume a saved mission or select a destination. Use **Build manually** or **Load starter & begin**; open ⓘ on any component, then run preflight. Test **Replay tutorial** from pause settings. Use Follow + Camera distance for a close launch/payload view. To execute the browser workflows in a suitable environment: `npm run test:browser`.
