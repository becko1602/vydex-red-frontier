# VYDEX: RED FRONTIER — science and assumptions

Retrieved 2026-11-10. This is a fictional uncrewed educational mission, not a NASA flight simulation. There is no live weather, telemetry or ephemeris. Reference values retain their published units alongside `siValue` and `siUnit`; numerical model constants use the SI equivalents. Source identifiers and URLs are defined in `src/data/sourceRegistry.ts`. Every reference constant has a value, SI unit (or explicitly identified reference unit), interpretation, precision, retrieval date and classification in `src/data/scienceConstants.ts`.

## Reference facts

NASA Mars Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html

Mean radius 3,389,500 m; mean gravity 3.73 m/s²; equatorial surface acceleration 3.69 m/s². These are different reference quantities. Local gameplay explicitly uses uniform **3.73 m/s²**, independent of altitude; it does not calculate gravity from a radius or GM.

Mean solar day 24.6597 h and sidereal rotation 24.6229 h are stored separately. Mars orbital period 686.980 Earth days; rounded Mars/Earth semimajor axes 227,956,000,000 / 149,598,000,000 m; eccentricity reference 0.0935; reference irradiances 586.2 / 1361.0 W/m²; surface pressure 636 Pa (variable); approximate density 0.016 kg/m³ (the sheet reports ±0.006 kg/m³); scale height 11,000 m; approximately 95.1% CO₂ by volume; synodic period 779.94 days.

JPL constants: https://ssd.jpl.nasa.gov/astro_par.html

c = 299,792,458 m/s, AU = 149,597,870,700 m, solar GM = 1.32712440041279419×10²⁰ m³/s², Earth day = 86,400 s. Constants are recorded with source precision; JavaScript numbers retain about 15–17 significant decimal digits.

Conventional standard gravity g0 = 9.80665 m/s² is a unit reference for Isp, **not Mars gravity**. NIST reference: https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9

## Derived calculations that affect play

### Propulsion and stage accounting

NASA Glenn: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/

`wetMass = dryMass + remainingPropellant`. Ideal `Δv = Isp × g0 × ln(wet/dry)`. Invalid, nonfinite or reversed mass inputs return zero. This ideal value excludes losses and cannot establish complete Earth-to-Mars mission feasibility.

A 120 m/s scripted correction uses `fuel = wet × (1 − exp(−120/(Isp × g0)))`. It consumes cruise fuel exactly once. Earth launch and injection are an explicit fictional provider service: 10 credits, 1,200 kg payload limit. Small lander engines do not launch from Earth.

Landing uses `massFlow = thrust/(Isp × g0)`, limits actual consumption to available propellant, and recomputes acceleration from current mass. When propellant is exhausted, thrust stops while dry mass remains. Cruise hardware (100 kg module + 20 kg engine) and remaining cruise propellant are discarded before descent. Surface operations discard the descent engine and its remaining propellant.

### Electrical energy

`flux = 1361 × (AU/r)²`. Generation is `flux × area × efficiency × max(0, panelNormal·sunDirection) × dustTransmission`. The cosine is applied once. Tracking uses alignment 1; a fixed panel uses a heading-dependent orientation cosine. Terrain shadowing is not modeled.

`batteryWh += (generation − load) × dt/3600`, bounded to 0–600 Wh. Accounted loads: base electronics 20 W, heater 8 W, driving 80 W plus a slope increment bounded at 50 W, active instruments, and transmission 30 W. Below 30 Wh the rover disables driving and nonessential loads, while passive solar tracking can recover charge. Science needs 35 Wh reserve, transmission 30 Wh.

Surface electrical time is **30× wall time**, while vehicle dynamics and displayed instrument durations use real simulation seconds. The display labels this compression. Battery starts at 480 Wh, representing prepared reserve after previous operations. Cruise visual time compresses ~259 days into 45 s (18 s demo); electrical resource decisions model a separate **2 h fictional episode**, rather than integrating a 259-day mission at a single instantaneous power balance. The two choices are evaluated from the same starting battery, with 45 W generation and 28 or 100 W consumption. This calculated alternative is shown explicitly.

### Communication and command autonomy

NASA context: https://science.nasa.gov/blog/speaking-percys-language-how-to-talk-so-perseverance-will-listen/

One-way delay is `distanceM / c`; Earth–Mars separation comes from the model's arrival geometry. NASA describes roughly 3–22 minute delays depending on geometry. Direct local control has no artificial delay. Earth-command mode compresses delivery to 3 s, then local autonomy drives via safe corridors. Science acknowledgment is compressed to 6 s. Success requires observing all assigned sites **and transmitting** them.

### Transfer

`a = (rEarth + rMars)/2`, `T = π sqrt(a³/μSun)`. Vis-viva calculates departure and arrival heliocentric velocity differences; these are not full Earth launch or Mars landing requirements. Circular, coplanar orbits intentionally ignore actual eccentricity and inclination.

Initial Mars angle is `π − sqrt(μSun/rMars³) × T`, so the planet reaches the transfer endpoint with the spacecraft. Mean anomaly advances linearly with model time. Newton iteration solves Kepler's equation `E − e sin(E) = M`; Cartesian transfer coordinates are `a(cos(E)−e), a sqrt(1−e²) sin(E)`. This is not a curved path traversed at constant linear fraction.

## Educational approximations

Final powered descent begins 500 m above a fictional flat landing datum at −12 m/s. Hypersonic entry and heat-shield phases are compressed. The game models gravity, thrust, changing mass, orientation, drag and terrain contact; it makes no claim to simulate hypersonic heating, NASA guidance or actual entry aerodynamics.

One metre equals one local world unit. Density is deliberately simplified: `ρ(h)=0.016 exp(−h/11000)` kg/m³. Drag is `0.5 ρ Cd A |v|²` opposite velocity. Cd=1.3, area=7 m² and still air are fictional vehicle/scenario assumptions. This is not silently combined with NASA's separate piecewise educational model, linked only for context: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/mars-atmosphere-equation-metric/

Safe-touchdown limits are fictional strict inequalities: vertical speed <3 m/s, horizontal <2 m/s, tilt <12°. Optional braking assist is a velocity feedback controller subject to the same engine, propellant and gravity constraints. It does not bypass physics. Retry restores the initial descent fuel and state.

Rover driving is arcade-assisted height-field contact, with bounded speed, braking, slope limits and rock collision. It does not model full wheel-soil terramechanics. Terrain is seeded, procedurally generated and Mars-inspired, approximately 300×300 m. It is not Jezero or mapped NASA terrain. Safe radial corridors connect the spawn and targets; autonomy returns through the spawn corridor when changing sites.

## Fictional game parameters

All catalogue entries in `gameBalance.ts`, mission credits, provider specifications, panel dust transmission 0.72, target names, instrument readings, mission success criteria, science points and touchdown limits are fictional educational parameters. Dust is not measured weather. A generic spectral scan or core sample does not demonstrate life.

The budget was adjusted from 100 to **112 credits** because the required geology design (spectrometer + drill, without unnecessary camera) and explicit 10-credit provider service cost **111.8 credits**. Imaging starter costs **100.8 credits**. Optional hardware still increases mass, cost and fuel demand.

## Challenge verification

The supplied 2026 index https://www.spaceappschallenge.org/2026/challenges/ returned HTTP 502 during verification. An official Space Apps 2026 team page reproduced the challenge description: https://www.spaceappschallenge.org/2026/find-a-team/missionforge/ . The implementation addresses the reproduced design/manage/simulate trade-offs; formal compliance with an independently fetched full challenge page is **not asserted**.

## Visual follow-up

The planet globe materials now use locally hosted artistic texture maps, with separate credits in ASSET_CREDITS.md. They improve visual appearance without changing transfer geometry, scientific constants, terrain collision or mission objectives. The Mars surface remains seeded fictional terrain with procedural sand and bounded cosmetic wheel tracks; it is not real mapped Mars topography. Rover render yaw now matches the simulator's heading convention, ground attitude uses rover-local slopes, and input is derived from the complete set of held keys. Stabilization, fuel, energy and science rules remain the same.

## Earth, lunar and asteroid expansion (2026-11-10)

Additional reference entries in `scienceConstants.ts`:

| Value                         | SI value          | Source and interpretation                                                                                          |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Moon surface gravity          | 1.62 m/s²         | [NASA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html); uniform local approximation |
| Moon mean radius              | 1,737,400 m       | Same source; volumetric mean, 100 m source precision                                                               |
| Earth–Moon semimajor axis     | 384,400,000 m     | Same source; reference distance, not current position                                                              |
| Earth mean radius             | 6,371,000 m       | [NASA Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html)                            |
| Earth gravitational parameter | 3.9860×10¹⁴ m³/s² | Same source; converted from 0.39860×10⁶ km³/s², five significant figures                                           |

The lunar model deliberately uses **zero drag**, representing an airless gameplay approximation; the real Moon has a tenuous exosphere. No parachute or Mars density profile is used there. Generated lunar craters affect the same terrain-height function used by descent contact. Lunar final descent starts at 500 m and −8 m/s; Mars retains −12 m/s. These initial conditions and touchdown limits are fictional scenarios.

Earth orbit selects a fictional 400,000 m altitude. Circular speed is `sqrt(muEarth/(earthRadius+altitude))`; period is `2π sqrt(r³/muEarth)`. The provider cinematic is not a physical Earth-ascent simulation. Its progress and camera positions are presentation values, not simulated telemetry. In the orbital scene, calculated background orbit time is ×30; local attitude dynamics remain ×1 and electrical time ×30. Before payload release, bounded RCS torque consumes cruise propellant with Isp 320 s; after release the cruise stage and its fuel are excluded from satellite mass. Fictional integrated reaction wheels then control attitude using the already-accounted avionics power, without consuming separated cruise propellant.

Lunar travel uses a clearly labeled **illustrative geocentric three-day schedule**, not the heliocentric Mars Hohmann model or a solved restricted-three-body trajectory. The Mars route retains its sourced two-body equations, Kepler time parameterization and initial phase alignment.

VY-26 is a **fictional asteroid**. NASA's [Asteroid Facts](https://science.nasa.gov/solar-system/asteroids/facts/) supplies general educational context, not a gravitational parameter or measured properties for this target. Its 36-day route, 18-million-km reference Earth range, body size and keep-out sphere are fictional game parameters. Local proximity control neglects gravity and drag, uses bounded 25 N thrusters, consumes actual cruise propellant and updates acceleration from current mass. Assist uses the same controller limits and fuel. This is not asteroid orbit determination or an OSIRIS-REx guidance model.

The component workshop partitions the original fixed hardware mass/cost into visible parts while preserving the original valid Mars configurations. All equipment specifications remain fictional. Bodies, tanks, navigation, connectors and stages now affect the same mission mass calculation and renderer. Missing engines remove thrust; missing legs prevent a safe touchdown classification. The planetary data in the Science & Sources drawer retain their reference-vs-approximation distinction.

Local attitude uses a fictional inertia approximation `I = mass × 0.22 m²`, 25 N bounded thrusters and a 1 m reference lever arm. This is not a NASA spacecraft inertia tensor. An Earth-camera exposure is cancelled if attitude leaves the stabilization limits before the observation finishes. Lunar and Earth missions assume the selected daylight operating window; eclipses, thermal cycling and solar-array shadow geometry are not modeled.

## Launch providers and control expansion

Scout, Pioneer and Titan are fictional educational providers defined in `src/data/launchVehicles.ts`. All prices, capacities, dimensions, stage counts and route support are fictional game parameters. Delivery capacity is destination-specific and includes provider injection; no real launcher payload claim is made. Provider stages, fuel and fairing are included in exactly one service charge and are excluded from all spacecraft mass and propellant calculations. The original 112-credit mission budget and Titan-equivalent 10-credit Mars service are preserved.

`payloadEnvelope` conservatively encloses the actual stowed part meshes in local metre boxes, then computes the maximum radial corner and vertical span. Preflight compares that cylinder to the selected usable fairing diameter and height. This conservative packaging approximation is not finite-element analysis or real flight clearance certification. Solar wings fold and landing struts stow in the shared assembly/launch model.

Local flight uses independent pitch, yaw and roll. Earth local translation and main-engine burns are intentionally unavailable so they cannot invalidate the separately calculated circular reference orbit. The fictional asteroid probe additionally has a 40 N main-engine mode, using its cruise engine and Isp 320 s, plus 25 N RCS translation/torque. Total demanded impulse is limited by actual fuel using `thrust/(Isp*g0)`, and acceleration uses current mass. Attitude uses the documented fictional inertia, not a NASA tensor. Shutdown forces thrust off even with landing assist; transfer remains a planned ideal burn rather than unrestricted local thrust.

The telemetry module labels Sun-relative ideal-model cruise speed (vis-viva), Earth-relative circular reference speed, local asteroid-relative speed and ground-relative surface/descent speed. Scripted ascent and illustrative non-Mars routes do not receive invented calculated speed readings. Mass telemetry is spacecraft mass, never total provider mass. Game elapsed time is separate from astronomical travel time. Descent electrical use integrates physical seconds; surface/orbital electrical time remains ×30 and the cruise policy remains its stated two-hour episode.

Queue-energy previews estimate gross electrical use at a fictional 2.5 m/s including a fixed steering allowance and instrument duration, with energy time ×30. They omit solar generation and are labeled estimates, not guaranteed reserve. Recovery teleports the rover to the safe landing location as an explicitly labeled game assist; it does not claim physical recovery mechanics.

Provider ascent, separation, fairing and parking orbit are cinematic approximations using a common display scale of 1:4 for all three vehicle models. The spacecraft uses the same scale inside the fairing, then enlarges after release for readability. Catalogue thumbnails render the exact procedural meshes locally. There are no additional real-world constants in this expansion; the existing NASA/JPL registry is unchanged.
