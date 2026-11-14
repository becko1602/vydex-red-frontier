# Mission guide

## Assemble deliberately

All 16 workshop components have an explicit guide: structural bus, propellant tanks, navigation computer, stage connector, cruise deck, cruise engine, descent engine, landing legs, rover, battery, solar array, antenna, camera, spectrometer, drill and sampling arm. Most mount to the bus; the cruise deck needs its connector, the cruise engine needs the deck, and the Mars drill needs the rover. Removal respects those dependencies.

A red compatibility explanation tells the player what to add or remove. Preflight can select the missing component. Science, mass, cost, fuel and thrust are computed from installed hardware. Passive hardware is labeled as such. The 20 W computer draw is counted once in base avionics, not added a second time.

## Earth orbit

Use a starter or manually install the required orbital hardware. Complete launch decisions and the cruise power/correction decisions. In the deployment scene, release steering with stabilization on until yaw/pitch errors and rates fall inside limits. Deploy the satellite and panels. The cruise deck, engine and remaining cruise propellant are then discarded; integrated fictional reaction wheels use the avionics electrical budget for subsequent attitude control. Observe Earth for eight seconds, then transmit. The 400 km circular orbit is an educational selection, with speed and period derived from sourced Earth GM and mean radius.

## Moon

A rover and drill are not compatible with this stationary science-lander mission. Bring navigation, power, communication, landing engine/legs, camera and spectrometer. The three-day journey is an illustrative direct-transfer scenario. Final descent uses 1.62 m/s² and zero atmospheric drag; assist still consumes actual propellant. At safe contact, begin lunar science, collect the panorama and spectrum, then transmit both. Terrain is generated cratered regolith artwork, not mapped lunar elevation.

## Mars

The original campaign remains: imaging requires three camera observations; geology needs two spectral readings and a drilled sample. Launch and transfer use the assembled craft, with the cruise stage discarded before powered descent. After touchdown deploy the rover, drive or queue commands, collect and transmit every observation. A crash explains vertical speed, lateral speed, tilt, lack of propellant or missing landing equipment and supports immediate descent retry.

## Fictional asteroid VY-26

This is not Bennu, Ryugu or an actual ephemeris. The 36-day schedule, 18-million-km reference Earth range, approximately 8 m illustrative body and 10 m safety sphere are fictional. In the local frame gravity and drag are deliberately neglected. Every RCS pulse consumes cruise propellant through its Isp and changes velocity according to current mass. Neutral controls plus stabilization reduce drift; Approach assist follows a bounded braking controller using the same forces and fuel. Stop within 5 m of the science point at less than 0.35 m/s, scan and collect a contact sample, then transmit. Sampling does not infer life.

## Preview worlds

Venus, Jupiter and Saturn are clearly labeled educational previews with no launch action. Venus is cloud-covered artwork, Jupiter uses a banded texture and Saturn has a ring system. Planet render scales and rotations in the selector are illustrative. Preview and mission images are credited in ASSET_CREDITS.md.

## Troubleshooting a design

- No compatible mount: start with the structural bus, then follow the named dependency.
- Over budget/mass: remove optional instruments or reduce unused fuel. The panel shows mission credits, never dollars.
- No navigation/power/communication: fit the named computer, battery, array or antenna before launch.
- Failed descent reserve: fit the engine and legs, reduce mass or add descent propellant; cruise fuel is separate.
- Low battery: stop nonessential activity and let aligned solar generation recover charge.
- Satellite unstable: release attitude inputs, turn stabilization on and wait for rates as well as angles to settle.
- Asteroid scan disabled: brake earlier or enable approach assist; both range and speed must meet the corridor limits.

## Rocket selection and current controls

After destination/objective, select the launch provider. Scout: Earth only; Pioneer: Earth/Moon/VY-26; Titan: all playable routes including Mars. Every number is fictional. ⓘ explains each specification. Rotate the hangar rocket, compare the cards, then **Use … & assemble**.

The workshop shows a wireframe usable fairing. Select **Switch carrier** to change rocket without losing installed equipment. Preflight distinguishes unsupported route, mass overload, physical overhang and credits. A fuel reduction helps mass but cannot shrink a protruding instrument. Use a wider carrier or remove optional hardware when dimensions fail.

**Inspection:** front/side/rear/engine/free views, labels, exploded view, stow toggle and Reset camera. During flight choose **Inspect & pause**; **Resume same mission** retains state.

**Flight:** W/S pitch, A/D yaw, Q/E roll, Shift/Ctrl throttle, X cutoff, C camera, Space stabilize. The Ignite button restarts after cutoff. Asteroid arrows translate; Earth main thrust is restricted. Planned transfer burns have a separate Execute burn button. Rover WASD/arrows and E are separate from flight controls. Touch buttons duplicate local attitude and sliders duplicate throttle.

**Rover:** minimap shows rover, landing site and target IDs. Photograph/Analyze/Drill buttons work only for a suitable nearby site with the instrument, energy and no active task. In Earth-command mode, queue a target from its ↗ or minimap marker; estimated gross energy is shown before execution. Local autonomy drives and observes after compressed delivery. Transmit stored science yourself. **Game assistance: recover to landing site** preserves observations and battery and returns a stuck rover to the landing location.
