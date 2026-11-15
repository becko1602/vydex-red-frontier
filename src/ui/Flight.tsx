import { missionKind, TRANSFER } from "../data/destinations";
import { PROBE_PHASES } from "../sim/probe";
import { installed } from "../data/workshop";
import RoverOps from "./RoverOps";
import DriveHelp from "./DriveHelp";
import {
  ArrowRight,
  Check,
  Info,
  Pause,
  Play,
  SkipForward,
} from "lucide-react";
import { useGame } from "../store";
import { engine } from "../sim/game";
import {
  launchPhase,
  routeInfo,
  launchFraction,
  launchDuration,
} from "../sim/journey";
import { destinations } from "../data/destinations";
import { launchers } from "../data/launchVehicles";
import {
  stableAttitude,
  sampleCorridor,
  initialOrbit,
  earthOrbit,
} from "../sim/orbit";
import {
  BATTERY_CAPACITY_WH,
  CRUISE_GENERATION_W,
  CRUISE_HIBERNATE_LOAD_W,
  CRUISE_SCIENCE_LOAD_W,
  remainingOperatingHours,
} from "../sim/physics";
import { parts, type PartId } from "../data/workshop";
import { useState } from "react";
import FlightTouch from "./FlightTouch";
import {EngineControls} from "./Telemetry";
import {openInspection} from "./Inspection";
import { solarSystem, type SolarBodyId } from "../data/solarSystem";
import TouchControls from "./TouchDrive";
const selectablePlanets: SolarBodyId[] = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];
export function FlightToolbar() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings),
    set = useGame((s) => s.setSettings),
    act = useGame((s) => s.act);
  return (
    <div className="flight-toolbar">
      <div className="flight-camera-options">
        {(["follow", "cinematic", "overview"] as const).map((mode) => (
          <button
            data-tutorial={`flight-${mode}`}
            key={mode}
            className={settings.flightCamera === mode ? "active" : ""}
            onClick={() => set({ flightCamera: mode })}
          >
            {mode}
          </button>
        ))}
      </div>
      <label>
        Camera distance
        <input
          aria-label="Flight camera distance"
          type="range"
          min=".3"
          max="3.5"
          step=".05"
          value={settings.flightZoom}
          onChange={(e) => set({ flightZoom: +e.target.value })}
        />
      </label>
      {["launch", "cruise"].includes(d.stage) && (
        <label>
          Timeline speed
          <select
            aria-label="Timeline speed"
            value={d.timeScale}
            onChange={(e) =>
              act(() => {
                engine.data.timeScale = +e.target.value;
              })
            }
          >
            {[0.5, 1, 2, 4].map((rate) => (
              <option key={rate} value={rate}>
                {rate}× simulation speed
              </option>
            ))}
          </select>
        </label>
      )}
      <button onClick={openInspection}>Inspect & pause</button>
      <button onClick={()=>useGame.getState().open('controls')}>Controls</button>
      <EngineControls/>
      <button
        title="Pause mission"
        aria-label="Pause flight"
        onClick={() => useGame.getState().pause()}
      >
        <Pause size={16} />
      </button>
    </div>
  );
}
export function LaunchPanel() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    set = useGame((s) => s.setSettings),
    settings = useGame((s) => s.settings);
  const launchModel=launchers[d.design.launcher??"titan"].ascentModel;
  return (
    <main className="journey-ui">
      <section className="mission-panel journey-panel">
        <p className="eyebrow">03 / {launchers[d.design.launcher??"titan"].name.toUpperCase()}</p>
        <h1>
          From Earth.
          <br />
          <em>To {destinations[d.destination].name.toLowerCase()}.</em>
        </h1>
        <p className="model-note">
          Educational vertical ascent model drives altitude and speed telemetry. Stage separation and orbital insertion remain presentation cues.
        </p>
        <details className="ascent-assumptions">
          <summary>Ascent model assumptions</summary>
          <p>Fictional example carrier values: {launchModel.dryMassKg.toLocaleString()} kg dry, {launchModel.propellantKg.toLocaleString()} kg propellant, {launchModel.thrustN.toLocaleString()} N, Isp {launchModel.specificImpulseS} s, Cd {launchModel.dragCoefficient}. The example uses a single equivalent stage, standard Earth gravity, exponential air density, and drag from vehicle diameter. These are not real vehicle specifications or an orbit insertion prediction.</p>
        </details>
        <div className="launch-checklist">
          {[
            "Verify payload fairing",
            "Switch to internal power",
            "Release launch interlocks",
          ].map((label, i) => (
            <button
              data-tutorial={`launch-check-${i}`}
              key={label}
              disabled={d.launchChecks[i]}
              onClick={() =>
                act(() => {
                  engine.data.launchChecks[i] = true;
                  if (engine.data.launchChecks.every(Boolean)) {
                    engine.data.stageTime = 0;
                    useGame.getState().setSettings({ payloadView: false });
                  }
                })
              }
            >
              <span>{d.launchChecks[i] ? <Check size={16} /> : i + 1}</span>
              {label}
            </button>
          ))}
        </div>
        {d.launchChecks.every(Boolean) && launchFraction(d) < 0.12 && (
          <p className="countdown-number">
            T−{Math.ceil((0.12 - launchFraction(d)) * launchDuration(d))}
          </p>
        )}
        <div className="launch-phase">
          <span className="status-dot" />
          {d.launchChecks.every(Boolean)
            ? launchPhase(d)
            : "PAYLOAD INSPECTION / AWAITING CHECKLIST"}
        </div>
        <div className="meter">
          <i style={{ width: `${launchFraction(d) * 100}%` }} />
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.payloadView}
            onChange={(e) => set({ payloadView: e.target.checked })}
          />
          Payload cutaway inspection
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.cameraShake}
            onChange={(e) => set({ cameraShake: e.target.checked })}
          />
          Restrained engine camera shake
        </label>
        <button
          className="text-link"
          disabled={!d.launchChecks.every(Boolean)}
          onClick={() =>
            act(() => {
              engine.data.cinematicSkipped = true;
              engine.data.decisionLog.push(
                "Skipped launch presentation after completing the required launch checklist.",
              );
              engine.go("cruise");
            })
          }
        >
          <SkipForward size={14} />
          Skip cinematic after authorization
        </button>
        <p className="micro">
          YOUR INSTALLED PAYLOAD IS REVEALED AFTER SEPARATION
        </p>
      </section>
      <FlightToolbar />
    </main>
  );
}
export function TravelPanel() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    settings = useGame((s) => s.settings),
    set = useGame((s) => s.setSettings),
    route = routeInfo(d);
  return (
    <main className="journey-ui">
      <section className="stage-intro travel-intro">
        <p className="eyebrow">06 / CONNECTED TRANSFER</p>
        <h1>
          Destination:
          <br />
          <em>{destinations[d.destination].name}</em>
        </h1>
        <p>{route.title}</p>
        <p>{route.detail}</p>
        <div className="vertical-stats">
          <div className="stat">
            <span>ASTRONOMICAL / SCENARIO TIME</span>
            <strong>
              {d.destination === "earth"
                ? "90"
                : (route.seconds / 86400).toFixed(
                    d.destination === "mars" ? 2 : 0,
                  )}
              <small>{d.destination === "earth" ? "min" : "Earth days"}</small>
            </strong>
          </div>
          <div className="stat">
            <span>TRANSFER COMPLETE</span>
            <strong>
              {(d.cruiseProgress * 100).toFixed(0)}
              <small>%</small>
            </strong>
          </div>
          <div className="stat">
            <span>CRUISE PROPELLANT</span>
            <strong>
              {d.cruiseFuel.toFixed(1)}
              <small>kg</small>
            </strong>
          </div>
        </div>
        <p className="micro">
          BASE TIME COMPRESSION ×
          {Math.round(route.seconds / route.screenSeconds).toLocaleString()}
          <br />
          VISUAL SCALE: ENLARGED FOR CLARITY · EDUCATIONAL MODEL
        </p>
      </section>
      <section className="mission-panel cruise-panel">
        <div className="panel-heading">
          <h2>Transfer operations</h2>
          <span>{d.destination.toUpperCase()}</span>
        </div>
        <div className="event">
          <span className="event-tag">DETERMINISTIC POWER EPISODE / 2 H</span>
          <h3>What stays awake?</h3>
          <p>
            Educational power episode: {CRUISE_GENERATION_W} W solar
            generation for 2 h. Hibernation draws {CRUISE_HIBERNATE_LOAD_W} W;
            science mode draws {CRUISE_SCIENCE_LOAD_W} W. Both outcomes are
            calculated from the current battery.
          </p>
          <div className="choice-grid">
            <button
              className={d.cruiseChoice === "save" ? "chosen" : ""}
              disabled={d.cruiseChoice !== "pending"}
              data-tutorial="hibernate"
              onClick={() => act(() => engine.chooseCruise("save"))}
            >
              <b>Hibernate</b>
              <small>Save energy</small>
            </button>
            <button
              className={d.cruiseChoice === "science" ? "chosen" : ""}
              disabled={d.cruiseChoice !== "pending"}
              onClick={() => act(() => engine.chooseCruise("science"))}
            >
              <b>Keep science active</b>
              <small>100 W episode</small>
            </button>
          </div>
        </div>
        <div className="burn-row">
          <b>Required correction / alignment burn</b>
          <p>
            {TRANSFER[d.destination].correctionDv}{" "}
            m/s · cruise propellant only
          </p>
          <button
            className="btn secondary"
            data-tutorial="correction-burn"
            disabled={d.correction}
            onClick={() => act(() => engine.correctionBurn())}
          >
            {d.correction ? "✓ Burn complete" : "Execute burn"}
          </button>
        </div>
        <div className="stat">
          <span>BATTERY RESERVE</span>
          <strong>
            {d.battery.toFixed(0)}
            <small>/ {BATTERY_CAPACITY_WH} Wh</small>
          </strong>
        </div>
        <div className="meter">
          <i style={{ width: `${(d.battery / BATTERY_CAPACITY_WH) * 100}%` }} />
        </div>
        <div className="power-summary" aria-label="Power balance">
          <span>+{d.generation.toFixed(0)} W generation</span>
          <span>{d.load.toFixed(0)} W consumption</span>
          <b className={d.generation - d.load >= 0 ? "positive" : "negative"}>
            {d.generation - d.load >= 0 ? "+" : ""}
            {(d.generation - d.load).toFixed(0)} W net
          </b>
          <span>
            {Number.isFinite(remainingOperatingHours(d.battery, d.generation, d.load))
              ? `${remainingOperatingHours(d.battery, d.generation, d.load).toFixed(1)} h remaining at current load`
              : "Net-positive: battery charging"}
          </span>
        </div>
        <div className="transfer-toggles">
          <span className="event-tag">DISPLAY LAYERS</span>
          {(
            [
              ["showOrbits", "Orbits"],
              ["showLabels", "Labels"],
              ["showTrajectory", "Transfer trajectory"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="toggle-row">
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => set({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="planet-selection">
          <span className="event-tag">HELIOCENTRIC VIEW / SELECT BODY</span>
          <div>
            {selectablePlanets.map((body) => (
              <button
                key={body}
                className={settings.selectedPlanet === body ? "active" : ""}
                onClick={() =>
                  set({ selectedPlanet: body, flightCamera: "overview" })
                }
                title={`Focus camera on ${solarSystem[body].name}`}
              >
                {solarSystem[body].name}
              </button>
            ))}
          </div>
          <small>
            Inner planets are drawn at true relative distance; beyond Mars distances are compressed. Planet sizes are enlarged ~2000× for visibility.
          </small>
          <PlanetFacts id={settings.selectedPlanet} />
        </div>
        {d.decisionLog.length > 0 && (
          <details className="mission-log">
            <summary>Mission event log ({d.decisionLog.length})</summary>
            {d.decisionLog.slice(-4).map((event, index) => (
              <p key={`${event}-${index}`}>{event}</p>
            ))}
          </details>
        )}
        <button
          className="btn"
          disabled={d.cruiseProgress < 1 || !d.correction}
          onClick={() =>
            act(() => {
              engine.explain(
                ["moon", "mars", "mercury"].includes(d.destination)
                  ? "Cruise stage separated. The final-descent frame now uses local metres."
                  : "Arrival handover: local controls now operate the assembled mission payload.",
              );
              engine.arrive();
            })
          }
        >
          {d.cruiseProgress < 1
            ? "Transfer in progress"
            : d.destination === "earth"
              ? "Begin satellite deployment"
              : d.destination === "asteroid"
                ? "Begin rendezvous"
                : missionKind(d.destination) === "probe"
                  ? "Orbit insertion"
                  : "Begin final descent"}
          <ArrowRight size={16} />
        </button>
        <PanelStowControl />
        <p className="model-note">
          Required operations remain interactive. Changing presentation speed
          changes wall-clock duration, not the scientific constants or burn Δv.
        </p>
      </section>
      <FlightToolbar />
    </main>
  );
}
function PartHelp({ id }: { id: PartId }) {
  return (
    <button
      aria-label={`Information about installed ${parts[id].name}`}
      onClick={() => useGame.getState().setWorkshop({ info: id })}
    >
      <Info size={16} />
    </button>
  );
}
export function OrbitalPanel() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    o = d.orbital,
    asteroid = d.destination === "asteroid",
    probeMission = missionKind(d.destination) === "probe",
    ready = asteroid ? sampleCorridor(o) : probeMission ? stableAttitude(o) : o.deployed && stableAttitude(o),
    orbit = earthOrbit();
  return (
    <main className="journey-ui orbital-ui">
      <section className="flight-title">
        <p className="eyebrow">
          06 / {asteroid ? "ASTEROID PROXIMITY" : probeMission ? `${destinations[d.destination].name} ORBIT · ENTRY PROBE` : "EARTH ORBITAL DEPLOYMENT"}
        </p>
        <h1>
          {asteroid
            ? "Small forces. Precise moves."
            : probeMission ? "Drop into the clouds." : "Give your satellite a purpose."}
        </h1>
        <p>
          {asteroid
            ? "Fictional VY-26 · local relative metres · negligible gravity and no drag"
            : probeMission ? "No solid surface: the orbiter releases an aeroshell probe and relays its parachute descent" : "Calculated circular 400 km reference orbit · local attitude uses fuel-consuming RCS"}
        </p>
      </section>
      <section className="mission-panel orbital-panel">
        <div className="panel-heading">
          <h2>{asteroid ? "Rendezvous control" : probeMission ? "Orbiter & probe control" : "Deployment control"}</h2>
          <PartHelp id="computer" />
        </div>
        <MissionSteps />
        {asteroid ? (
          <>
            <div className="report-grid">
              <div className="stat">
                <span>CORRIDOR RANGE</span>
                <strong>
                  {Math.hypot(o.x, o.y, o.z - 14).toFixed(1)}
                  <small>m</small>
                </strong>
              </div>
              <div className="stat">
                <span>RELATIVE SPEED</span>
                <strong>
                  {Math.hypot(o.vx, o.vy, o.vz).toFixed(2)}
                  <small>m/s</small>
                </strong>
              </div>
            </div>
            <button
              className="btn secondary"
              data-tutorial="approach-assist"
              onClick={() =>
                act(() => {
                  engine.data.orbital.autopilot = !o.autopilot;
                })
              }
            >
              {o.autopilot
                ? "Disable approach assist"
                : "Approach science corridor"}
            </button>
            <p className="model-note">
              W/S pitch · A/D yaw · Q/E roll · arrows translate · Space brake. Sample within 5 m
              and below 0.35 m/s. A 10 m keep-out sphere protects the irregular
              body.
            </p>
          </>
        ) : (
          <>
            <div className="report-grid">
              <div className="stat">
                <span>YAW ERROR</span>
                <strong>
                  {((o.yaw * 180) / Math.PI).toFixed(1)}
                  <small>°</small>
                </strong>
              </div>
              <div className="stat">
                <span>PITCH ERROR</span>
                <strong>
                  {((o.pitch * 180) / Math.PI).toFixed(1)}
                  <small>°</small>
                </strong>
              </div>
            </div>
            <p className="resource-line">Roll {((o.roll*180)/Math.PI).toFixed(1)}° · cruise RCS / integrated satellite wheels</p>
            <p className="model-note">
              W/S pitch · A/D yaw · Q/E roll · Space stabilize. Deployment requires angles
              &lt;7° and angular rates &lt;0.04 rad/s.
            </p>
            {probeMission ? <ProbeStatus /> : <button
              className="btn"
              data-tutorial="deploy-satellite"
              disabled={o.deployed || !stableAttitude(o)}
              onClick={() => act(() => engine.deploySatellite())}
            >
              {o.deployed
                ? "✓ Satellite deployed"
                : "Deploy satellite & solar array"}
            </button>}
            {!probeMission && <p className="model-note">
              Orbit speed {(orbit.speed / 1000).toFixed(2)} km/s; period{" "}
              {(orbit.period / 60).toFixed(1)} min. Orbital background time ×30;
              local attitude time ×1; electrical time ×30. Derived from sourced
              Earth GM and radius; the 400 km orbit is a fictional selected
              scenario.
            </p>}
          </>
        )}
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={d.assist}
            onChange={(e) =>
              act(() => {
                engine.data.assist = e.target.checked;
              })
            }
          />
          Stabilization assist
        </label>
        <PanelStowControl />
        <div className="orbital-science" data-tutorial="orbital-science">
          {engine.targets().map((t) => (
            <div key={t.id}>
              <button
                className="btn secondary"
                disabled={
                  !ready ||
                  !!d.scanId ||
                  d.transmitting ||
                  d.observations.includes(t.id) ||
                  d.battery < 35
                }
                onClick={() => act(() => engine.orbitalScience(t.id))}
              >
                {d.observations.includes(t.id) ? "✓ " : ""}
                {t.name} · {parts[t.instrument].power} W
              </button>
              <PartHelp id={t.instrument} />
            </div>
          ))}
        </div>
        {d.scanId && (
          <p className="queue-status">
            COLLECTING {d.scanId} · {d.scanTime.toFixed(0)} s
          </p>
        )}
        <button
          className="btn"
          data-tutorial="orbital-transmit"
          disabled={
            d.transmitting ||
            !!d.scanId ||
            !d.observations.some((id) => !d.transmitted.includes(id))
          }
          onClick={() => act(() => engine.transmit())}
        >
          {d.transmitting ? "Transmitting…" : "Transmit observations"}
        </button>
        <div className="resource-line">
          Battery {d.battery.toFixed(0)} Wh ·{" "}
          {o.deployed
            ? "Cruise fuel discarded; reaction-wheel attitude"
            : `Cruise fuel ${d.cruiseFuel.toFixed(1)} kg`}
        </div>
        <p className="model-note">
          Signal light time {engine.delay().toFixed(asteroid ? 1 : 4)} s one way
          · acknowledgment display 6 s.{" "}
          {asteroid
            ? "Fictional 18-million-km Earth range."
            : probeMission ? `${(engine.delay() / 60).toFixed(1)} min light-time to Earth.` : "Ideal overhead 400 km link."}
        </p>
        {o.crashed && (
          <div className="fit-error">
            <p>Keep-out contact. Brake earlier or use approach assist.</p>
            <button
              className="btn"
              onClick={() =>
                act(() => {
                  engine.data.orbital = initialOrbit("asteroid");
                  engine.data.throttle=0;
                })
              }
            >
              Retry rendezvous
            </button>
          </div>
        )}
      </section>
      <FlightToolbar />
      <FlightTouch />
      <div className="orbit-local-label">
        {asteroid
          ? "LOCAL PROXIMITY FRAME / 1 UNIT = 1 M"
          : probeMission ? "ORBITER VIEW · PLANET AT TRUE CURVATURE" : "CIRCULAR ORBIT PRESENTATION / ENLARGED SPACECRAFT"}
      </div>
    </main>
  );
}
const MEAN_TEMP_C: Record<string, number> = { sun: 5505, mercury: 167, venus: 464, earth: 15, moon: -20, mars: -63, jupiter: -108, saturn: -139, uranus: -195, neptune: -200 };
function PlanetFacts({ id }: { id: keyof typeof solarSystem }) {
  const b = solarSystem[id];
  const years = b.orbitalPeriodS / (365.256 * 86400);
  return (
    <div className="planet-facts">
      <b>{b.name.toUpperCase()}</b>
      <dl>
        <div><dt>DIAMETER</dt><dd>{Math.round((b.radiusM * 2) / 1000).toLocaleString("en-US")} km</dd></div>
        <div><dt>MASS</dt><dd>{b.massKg.toExponential(2).replace("e+", " × 10^")} kg</dd></div>
        <div><dt>SURFACE / 1-BAR GRAVITY</dt><dd>{b.gravityMS2.toFixed(2)} m/s²</dd></div>
        <div><dt>MEAN TEMPERATURE</dt><dd>{MEAN_TEMP_C[id]} °C</dd></div>
        <div><dt>ORBITAL PERIOD</dt><dd>{b.orbitalPeriodS ? (years < 2 ? `${(years * 365.256).toFixed(0)} days` : `${years.toFixed(1)} years`) : "—"}</dd></div>
        <div><dt>AXIAL TILT</dt><dd>{b.axialTiltDeg}°</dd></div>
      </dl>
      <small>{b.atmosphere}</small>
    </div>
  );
}
type Step = { title: string; how: string; done: boolean; active?: string };
/** Step-by-step plan for orbital missions: what is done, what to do next and how. */
function MissionSteps() {
  const d = useGame((s) => s.data), o = d.orbital;
  const has = (id: string) => d.observations.includes(id);
  const allSent = engine.targets().every((t) => d.transmitted.includes(t.id));
  const scanning = (id: string) => (d.scanId === id ? `Collecting… ${d.scanTime.toFixed(0)} s` : undefined);
  const range = Math.hypot(o.x, o.y, o.z - 14), speed = Math.hypot(o.vx, o.vy, o.vz);
  let steps: Step[];
  if (d.destination === "asteroid")
    steps = [
      { title: "Reach the science corridor", how: `Press “Approach science corridor” (autopilot) or translate with the arrow keys / RCS pad, then Space to brake. Need range < 5 m and speed < 0.35 m/s — now ${range.toFixed(1)} m, ${speed.toFixed(2)} m/s.`, done: sampleCorridor(o) || has("A1") },
      { title: "Record the VY-26 spectrum", how: "Hold position in the green ring and press “VY-26 SPECTRUM”. Do not touch the controls for 8 s or the reading is cancelled.", done: has("A1"), active: scanning("A1") },
      { title: "Collect the contact sample", how: "Still inside the corridor, press “CONTACT SAMPLE”. The sampling arm touches the surface for 10 s.", done: has("A2"), active: scanning("A2") },
      { title: "Transmit to Earth", how: "Press “Transmit observations”. When Earth acknowledges, the mission is complete and the debrief opens.", done: allSent, active: d.transmitting ? `Transmitting… ${d.transmitTime.toFixed(0)} / 6 s` : undefined },
    ];
  else if (d.destination === "earth")
    steps = [
      { title: "Stabilize the attitude", how: "Release the controls and press Space (or keep Stabilization assist on) until angles < 7° and rates < 0.04 rad/s.", done: stableAttitude(o) || o.deployed },
      { title: "Deploy the satellite", how: "Press “Deploy satellite & solar array”.", done: o.deployed },
      { title: "Take the Earth observation", how: "Keep the attitude stable and press “EARTH OBSERVATION”.", done: has("E1"), active: scanning("E1") },
      { title: "Transmit to Earth", how: "Press “Transmit observations” to finish the mission.", done: allSent, active: d.transmitting ? `Transmitting… ${d.transmitTime.toFixed(0)} / 6 s` : undefined },
    ];
  else
    steps = [
      { title: "Stabilize the orbiter", how: "Release the controls and press Space until angles < 7° and rates < 0.04 rad/s.", done: stableAttitude(o) || has("P1") },
      { title: "Image the cloud tops", how: "Press the CLOUD-TOP IMAGING button and hold attitude for 8 s.", done: has("P1"), active: scanning("P1") },
      { title: "Release the entry probe", how: "Press “Release entry probe (F)”, then wait for entry, parachute and descent to finish.", done: has("P2"), active: d.probe.phase !== "attached" && d.probe.phase !== "complete" ? PROBE_PHASES[d.probe.phase].label : undefined },
      { title: "Transmit to Earth", how: "Press “Transmit observations” to finish the mission.", done: allSent, active: d.transmitting ? `Transmitting… ${d.transmitTime.toFixed(0)} / 6 s` : undefined },
    ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <ol className="mission-steps" aria-label="Mission plan">
      {steps.map((s, i) => (
        <li key={s.title} className={s.done ? "done" : i === next ? "now" : ""}>
          <span className="mark">{s.done ? "✓" : i === next ? "▶" : i + 1}</span>
          <div>
            <b>{s.title}</b>
            {i === next && <p>{s.active ?? s.how}</p>}
          </div>
        </li>
      ))}
      {next === -1 && <li className="done"><span className="mark">★</span><div><b>Mission complete</b></div></li>}
    </ol>
  );
}
export function PanelStowControl() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act);
  if (!d.design.solar) return null;
  return (
    <div className="stow-control">
      <button className={`btn secondary ${d.panelsStowed ? "active" : ""}`} onClick={() => act(() => engine.togglePanels())}>
        {d.panelsStowed ? "Deploy solar wings (P)" : "Stow solar wings (P)"}
      </button>
      <span>Array {(d.panelHealth * 100).toFixed(0)}% · {d.panelsStowed ? "folded, 0 W" : `${engine.arrayOutput().toFixed(0)} W`}</span>
    </div>
  );
}
export function HazardAlert() {
  const alert = useGame((s) => s.data.alert),
    active = useGame((s) => s.data.debrisActive > 0 || s.data.debrisIn <= 12);
  if (!alert) return null;
  return <div className={`hazard-alert ${active ? "danger" : ""}`} role="status">{alert}</div>;
}
export function ProbeStatus() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    p = d.probe,
    spec = PROBE_PHASES[p.phase];
  const has = installed(d.design, "probe");
  return (
    <div className="probe-status">
      <div className="probe-phase">
        {(["attached", "coast", "entry", "parachute", "descent", "complete"] as const).map((ph) => (
          <span key={ph} className={ph === p.phase ? "now" : Object.keys(PROBE_PHASES).indexOf(ph) < Object.keys(PROBE_PHASES).indexOf(p.phase) ? "done" : ""}>{PROBE_PHASES[ph].label}</span>
        ))}
      </div>
      {p.phase === "attached" ? (
        <button className="btn" disabled={!has || !stableAttitude(d.orbital)} onClick={() => act(() => engine.releaseProbe())}>
          {has ? "Release entry probe (F)" : "No probe installed"}
        </button>
      ) : (
        <div className="report-grid probe-grid">
          <div className="stat"><span>{d.destination === "venus" ? "ALTITUDE" : "ALT. vs 1 BAR"}</span><strong>{p.altitudeKm.toFixed(1)}<small>km</small></strong></div>
          <div className="stat"><span>PRESSURE</span><strong>{p.pressureBar < 0.01 ? p.pressureBar.toExponential(1) : p.pressureBar.toFixed(2)}<small>bar</small></strong></div>
          <div className="stat"><span>TEMPERATURE</span><strong>{p.temperatureK ? (p.temperatureK - 273.15).toFixed(0) : "—"}<small>°C</small></strong></div>
          <div className="stat"><span>{p.phase === "entry" ? "ENTRY SPEED" : "DESCENT RATE"}</span><strong>{p.velocity > 2000 ? (p.velocity / 1000).toFixed(1) : p.velocity.toFixed(0)}<small>{p.velocity > 2000 ? "km/s" : "m/s"}</small></strong></div>
          <div className="stat"><span>PEAK LOAD</span><strong>{p.peakG.toFixed(0)}<small>g</small></strong></div>
          <div className="stat"><span>RELAYED DATA</span><strong>{p.dataKb.toFixed(0)}<small>kbit</small></strong></div>
        </div>
      )}
      <p className="model-note">{spec.label}{p.phase !== "attached" && p.phase !== "complete" ? ` · T+${(p.t).toFixed(0)} s (compressed)` : ""}</p>
    </div>
  );
}
export function LunarStation() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    settings = useGame((s) => s.settings),
    setSettings = useGame((s) => s.setSettings);
  return (
    <main className="journey-ui">
      <section className="flight-title">
        <p className="eyebrow">06 / {d.destination === "mercury" ? "MERCURY" : "LUNAR"} SURFACE STATION</p>
        <h1>{d.destination === "mercury" ? "Science beside the Sun." : "Science in the silence."}</h1>
        <p>
          Airless lunar terrain. Drive the small rover with WASD or arrows; Space brakes.
          Scroll or pinch in orbit view to zoom.
        </p>
      </section>
      <section className="mission-panel station-panel">
        <div className="panel-heading">
          <h2>Station instruments</h2>
          <span>{d.transmitted.length}/2 RETURNED</span>
        </div>
        <div data-tutorial="station-science">
          {engine.targets().map((t) => (
            <div className="station-instrument" key={t.id}>
              <div>
                <b>{t.name}</b>
                <p>
                  {t.subtitle} · {parts[t.instrument].power} W · 8 s
                </p>
              </div>
              <PartHelp id={t.instrument} />
              <button
                className="btn secondary"
                disabled={
                  !!d.scanId ||
                  d.transmitting ||
                  d.observations.includes(t.id) ||
                  d.battery < 35
                }
                onClick={() => act(() => engine.interact(t.id))}
              >
                {d.observations.includes(t.id) ? "✓ Stored" : "Collect"}
              </button>
            </div>
          ))}
        </div>
        {d.scanId && (
          <p className="queue-status">
            {d.scanId} · {d.scanTime.toFixed(1)} / 8 s
          </p>
        )}
        <div className="resource-line">
          Battery {d.battery.toFixed(0)} Wh · +{d.generation.toFixed(0)} W solar
          · −{d.load.toFixed(0)} W
        </div>
        <button
          className="btn"
          data-tutorial="station-transmit"
          disabled={
            !!d.scanId ||
            d.transmitting ||
            !d.observations.some((id) => !d.transmitted.includes(id))
          }
          onClick={() => act(() => engine.transmit())}
        >
          {d.transmitting
            ? "Awaiting acknowledgment…"
            : `Transmit ${d.destination === "mercury" ? "Mercury" : "lunar"} observations`}
        </button>
        <p className="model-note">
          Earth light time {engine.delay().toFixed(2)} s one way. Acknowledgment
          presentation takes 6 s. Surface electrical timeline ×30.
        </p>
        <p className="model-note">
          {d.lastResult ||
            "Use both instruments. All observation results are fictional and educational."}
        </p>
      </section>
      <section className="mission-panel lunar-ops-panel"><RoverOps /></section>
      <div className="lunar-drive-controls">
        <span>ROVER {Math.abs(d.rover.speed).toFixed(1)} m/s · {d.rover.distance.toFixed(0)} m traveled</span>
        <div className="camera-buttons" aria-label="Lunar camera mode">
          {(["chase", "orbit", "map"] as const).map((mode) => (
            <button key={mode} className={settings.camera === mode ? "active" : ""} onClick={() => setSettings({ camera: mode })}>{mode}</button>
          ))}
        </div>
        <label>Zoom <input aria-label="Lunar camera zoom" type="range" min=".3" max="3.5" step=".05" value={settings.flightZoom} onChange={(e) => setSettings({ flightZoom: +e.target.value })}/></label>
      </div>
      <DriveHelp />
      <FlightToolbar />
    </main>
  );
}
