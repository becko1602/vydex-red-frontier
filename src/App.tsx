import Advisor from "./ui/Advisor";
import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useProgress } from "@react-three/drei";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
  X,
  Radio,
  Sun,
  ScanLine,
  BatteryCharging,
  FlaskConical,
  Orbit,
  Navigation,
  Camera,
  BookOpen,
  ChevronUp,
  ArrowDown,
  ArrowUp,
  MoveLeft,
  MoveRight,
  Power,
} from "lucide-react";
import { useGame } from "./store";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { engine, neutral, transfer, score, type Stage } from "./sim/game";
import {
  fixedAdvance,
  cost,
  masses,
  preflight,
  terrainHeight,
} from "./sim/physics";
import {
  balance,
  catalogue,
  equipmentDetails,
  starter,
  type Objective,
  type Design,
} from "./data/gameBalance";
import { sources } from "./data/sourceRegistry";
import { scienceConstants } from "./data/scienceConstants";
import { usePwa, installGame } from "./pwa";
import { input, keyboard } from "./input";
import TouchControls from "./ui/TouchDrive";
import Workshop, { ComponentInformation } from "./ui/Workshop";
import DestinationBriefing from "./ui/Destinations";
import Tutorial, { replayTutorial } from "./ui/Tutorial";
import {
  LaunchPanel,
  TravelPanel,
  OrbitalPanel,
  LunarStation,
  HazardAlert,
  FlightToolbar,
} from "./ui/Flight";
import { parts, installed, requiredParts, type PartId } from "./data/workshop";
import { destinations, environment, isLunarLike } from "./data/destinations";
import { launchFraction } from "./sim/journey";
import Launchers, { RocketInformation } from "./ui/Launchers";
import Observations from "./ui/Observations";
import ObservationCapture from "./scenes/ObservationCapture";
import {RoverMinimap,RoverInstruments} from "./ui/RoverSystems";
import Telemetry from "./ui/Telemetry";
import FlightTouch from "./ui/FlightTouch";
import ControlsGuide from "./ui/Controls";
import InspectionControls, {openInspection} from "./ui/Inspection";
import Thumbnails from "./scenes/Thumbnails";
import RoverOps from "./ui/RoverOps";
import { attachCameraRig } from "./cameraRig";
import PostFX from "./scenes/PostFX";
import DriveHelp from "./ui/DriveHelp";
const RocketHangar = lazy(()=>import("./scenes/RocketHangar"));
const Orbital = lazy(() => import("./scenes/Orbital"));
const World = lazy(() => import("./scenes/World"));
const Hangar = lazy(() => import("./scenes/Hangar"));
const Cosmos = lazy(() => import("./scenes/Cosmos"));

const stages: Stage[] = [
  "briefing",
  "rocket",
  "assembly",
  "preflight",
  "launch",
  "cruise",
  "landing",
  "surface",
  "debrief",
];
const stageNames = [
  "Briefing",
  "Rocket",
  "Design",
  "Preflight",
  "Launch",
  "Transfer",
  "Landing",
  "Explore",
  "Debrief",
];
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  className = "",
  title,
  tutorial,
}: {
  children: ReactNode;
  onClick: () => void;
  secondary?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  tutorial?: string;
}) {
  return (
    <button
      title={title}
      data-tutorial={tutorial}
      disabled={disabled}
      onClick={onClick}
      className={`${secondary ? "btn secondary" : "btn"} ${className}`}
    >
      {children}
    </button>
  );
}
function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </div>
  );
}
function Loading() {
  const { progress, active } = useProgress();
  return (
    <div className="loading" style={{ display: active ? "flex" : "none" }}>
      <span className="spinner" />
      BUILDING YOUR FRONTIER <b>{progress.toFixed(0)}%</b>
    </div>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="graphics-error">
        <h2>Graphics unavailable</h2>
        <p>
          This game requires WebGL. Enable hardware acceleration or try a
          WebGL-capable browser. Your saved mission remains on this device.
        </p>
        <button onClick={() => location.reload()}>Retry graphics</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Scene() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings);
  const [lost, setLost] = useState(false);
  const active = d.stage;
  const pixelRatio = useMemo<[number, number]>(
    () => [
      0.75,
      settings.quality === "low"
        ? 1
        : settings.quality === "high"
          ? 1.75
          : 1.25,
    ],
    [settings.quality],
  );
  return (
    <div className={`scene scene-${active}`}>
      <SceneBoundary>
        <Canvas
          shadows={settings.quality !== "low"}
          dpr={pixelRatio}
          camera={{ position: [7, 5, 9], fov: 45, near: 0.1, far: 1200 }}
          gl={{
            antialias: settings.quality !== "low",
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            attachCameraRig(gl.domElement);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setLost(true);
              useGame.setState({ paused: true });
            });
            gl.domElement.addEventListener("webglcontextrestored", () =>
              setLost(false),
            );
          }}
        >
          <Suspense
            fallback={null}
          >
            {settings.inspection ? (<Hangar inspection />) : active==='rocket' ? (<RocketHangar/>) : ["assembly", "preflight"].includes(active) ? (
              <Hangar />
            ) : active === "orbit" ? (
              <Orbital />
            ) : ["landing", "surface"].includes(active) ? (
              <World />
            ) : (
              <Cosmos />
            )}
          </Suspense>
          <SceneEnvironment/>
          <PostFX/>
          <Thumbnails/>
          <ObservationCapture/>
          <AdaptiveResolution />
        </Canvas>
      </SceneBoundary>
      <Suspense fallback={null}>
        <Loading />
      </Suspense>
      {lost && (
        <div className="graphics-error">
          <h2>Graphics connection interrupted</h2>
          <p>
            Mission paused. Reload to restore graphics and resume your saved
            stage.
          </p>
          <Button onClick={() => location.reload()}>Restore graphics</Button>
        </div>
      )}
    </div>
  );
}
/** Image-based lighting so metals, foil and glass reflect a neutral studio environment instead of rendering black. */
function SceneEnvironment() {
  const { gl, scene } = useThree();
  const stage = useGame((s) => s.data.stage);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  useEffect(() => {
    // Hangars are lit interiors; in space and on planets the Sun dominates.
    scene.environmentIntensity = ["rocket", "assembly", "preflight"].includes(stage) ? 0.9 : 0.35;
  }, [scene, stage]);
  return null;
}
function AdaptiveResolution() {
  const { gl } = useThree();
  const quality = useGame((s) => s.settings.quality);
  const timer = useRef({ elapsed: 0, frames: 0, dpr: 1 });
  useEffect(() => {
    timer.current.dpr = Math.min(
      devicePixelRatio,
      quality === "high" ? 1.75 : quality === "medium" ? 1.25 : 1,
    );
    gl.setPixelRatio(timer.current.dpr);
  }, [quality, gl]);
  useFrame((_, dt) => {
    const t = timer.current;
    t.elapsed += dt;
    t.frames++;
    if (t.elapsed > 3) {
      const fps = t.frames / t.elapsed;
      if (fps < 38 && t.dpr > 0.75) {
        t.dpr = Math.max(0.75, t.dpr - 0.2);
        gl.setPixelRatio(t.dpr);
      }
      t.elapsed = 0;
      t.frames = 0;
    }
  });
  return null;
}
function Header() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings),
    open = useGame((s) => s.open),
    pause = useGame((s) => s.pause),
    setSettings = useGame((s) => s.setSettings);
  const currentStageIndex = stages.indexOf(
    d.stage === "orbit" ? "surface" : d.stage,
  );
  return (
    <header>
      <a
        href="#"
        className="brand"
        onClick={(e) => {
          e.preventDefault();
          if (engine.data.stage !== "briefing") {
            useGame.getState().save();
            useGame.getState().act(() => engine.go("briefing"));
          }
        }}
        aria-label="Vydex Red Frontier"
      >
        <svg className="brand-icon" viewBox="0 0 322 237" aria-hidden="true">
          <path d="M0 0h70l70 72v70h27L232 0h90v97h-29l-64 140h-88v-94H71L0 72Z" fill="currentColor" />
        </svg>
        <span>
          VYDEX<span className="brand-sub">RED FRONTIER</span>
        </span>
      </a>
      <nav aria-label="Mission progress">
        {stageNames.map((name, i) => (
          <div
            key={name}
            className={`${i === currentStageIndex ? "current" : ""} ${i < currentStageIndex ? "complete" : ""}`}
          >
            <button
              type="button"
              className="stage-button"
              disabled={i >= currentStageIndex}
              aria-label={
                i < currentStageIndex
                  ? `Return to completed stage ${name}`
                  : `${name} stage`
              }
              onClick={() =>
                useGame.getState().act(() => engine.go(stages[i]))
              }
            >
              <span>
                {i < currentStageIndex ? (
                  <Check size={10} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <b>{name}</b>
            </button>
            {i < stages.length-1 && <i />}
          </div>
        ))}
      </nav>
      <div className="header-actions">
        <button
          title="Install / download game"
          aria-label="Install or download game"
          onClick={() => open("settings")}
        >
          <ArrowDown size={18} />
        </button>
        <button
          title="Science & sources"
          aria-label="Science and sources"
          onClick={() => open("sources")}
        >
          <BookOpen size={18} />
        </button>
        <button
          title={settings.muted ? "Unmute audio" : "Mute audio"}
          aria-label={settings.muted ? "Unmute audio" : "Mute audio"}
          onClick={() => setSettings({ muted: !settings.muted })}
        >
          {settings.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button
          title="Settings"
          aria-label="Settings"
          onClick={() => open("settings")}
        >
          <Settings2 size={18} />
        </button>
        {d.stage !== "briefing" && (
          <button
            title="Pause mission"
            aria-label="Pause mission"
            onClick={pause}
          >
            <Pause size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
function Preflight() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    checks = preflight(d.design, d.objective, d.destination);
  return (
    <main className="mission-panel preflight">
      <p className="eyebrow">02 / SYSTEMS VERIFICATION</p>
      <h1>
        Ready for
        <br />
        <em>{destinations[d.destination].name.toLowerCase()}?</em>
      </h1>
      <Advisor />
      <div className="checklist">
        {checks.map((c) => (
          <div key={c.label} className={c.ok ? "check-ok" : "check-fail"}>
            <span>{c.ok ? <Check size={17} /> : <X size={17} />}</span>
            <div>
              <b>{c.label}</b>
              <p>{c.detail}</p>
              {!c.ok && (
                <button
                  className="text-link"
                  onClick={() => {
                    useGame.getState().setWorkshop({
                      selected: c.part ?? "tank",
                      message: c.detail,
                    });
                    act(() => engine.go(c.label === "Provider payload" || c.label === "Usable fairing space" ? "rocket" : "assembly"));
                  }}
                >
                  Fix in workshop →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="model-note">
        Ideal Δv excludes losses. These are local maneuver reserves, not the
        full Earth-to-Mars requirement. Your launch provider handles Earth
        ascent and departure.
      </p>
      <div className="row">
        <Button secondary onClick={() => act(() => engine.go("assembly"))}>
          <ArrowLeft size={16} /> Revise
        </Button>
        <div data-tutorial="authorize-launch">
          <Button
            disabled={!checks.every((c) => c.ok)}
            onClick={() => act(() => engine.go("launch"))}
          >
            Authorize launch <ArrowUpRight size={17} />
          </Button>
        </div>
      </div>
    </main>
  );
}
function Landing() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    l = d.lander,
    h = Math.max(0, l.y - terrainHeight(l.x, l.z, d.destination));
  return (
    <main className="flight-ui">
      <div className="flight-title">
        <p className="eyebrow">
          05 / POWERED {d.destination.toUpperCase()} LANDING
        </p>
        <h1>Make contact.</h1>
        <p>
          {isLunarLike(d.destination)
            ? "Airless descent. No atmospheric or parachute braking."
            : "Atmospheric entry and heat-shield phases were compressed."}
          <br />
          You are controlling the final descent.
        </p>
      </div>
      <div className="landing-telemetry">
        <Stat label="ALTITUDE ABOVE TERRAIN" value={h.toFixed(0)} unit="m" />
        <Stat label="VERTICAL SPEED" value={l.vy.toFixed(1)} unit="m/s" />
        <Stat
          label="HORIZONTAL SPEED"
          value={Math.hypot(l.vx, l.vz).toFixed(1)}
          unit="m/s"
        />
        <Stat label="DESCENT FUEL" value={l.fuel.toFixed(1)} unit="kg" />
        <Stat
          label="VEHICLE TILT"
          value={((l.tilt * 180) / Math.PI).toFixed(1)}
          unit="°"
        />
      </div>
      <div className="reticle">
        <span />
        <span />
      </div>
      {!d.landingStarted ? (
        <div className="center-dialog">
          <span className="event-tag">500 M / PRESET DESCENT CONDITIONS</span>
          <h2>
            Your engines.
            <br />
            Your landing.
          </h2>
          <p>
            Stabilization assist controls vertical braking. W/S pitch and Q/E roll tilt the
            thrust vector up to 25° to translate; A/D yaws. Shift/Ctrl trims throttle.
          </p>
          <p className="model-note">
            Uniform gravity: {environment(d.destination).gravity} m/s² ·{" "}
            {isLunarLike(d.destination)
              ? "airless vacuum"
              : "simplified exponential atmosphere"}{" "}
            · safe contact: vertical &lt;3 m/s, horizontal &lt;2 m/s, tilt
            &lt;12°.
          </p>
          <div data-tutorial="take-control">
            <Button
              onClick={() =>
                act(() => {
                  engine.data.landingStarted = true;
                })
              }
            >
              Take control <Navigation size={17} />
            </Button>
          </div>
        </div>
      ) : l.status !== "flying" ? (
        <div
          className={`center-dialog ${l.status === "crashed" ? "failure" : ""}`}
        >
          <span className="event-tag">
            {l.status === "safe"
              ? "TOUCHDOWN CONFIRMED"
              : "CONTACT LIMIT EXCEEDED"}
          </span>
          <h2>
            {l.status === "safe"
              ? `Welcome to ${d.destination === "moon" ? "the Moon" : d.destination === "mercury" ? "Mercury" : "Mars"}.`
              : "A hard lesson."}
          </h2>
          <p>{l.reason}</p>
          <Button
            onClick={() =>
              act(() => engine.go(l.status === "safe" ? "surface" : "landing"))
            }
          >
            {l.status === "safe"
              ? isLunarLike(d.destination)
                ? "Begin surface science"
                : "Deploy rover"
              : "Retry final descent"}{" "}
            {l.status === "safe" ? (
              <ArrowRight size={17} />
            ) : (
              <RotateCcw size={17} />
            )}
          </Button>
          {l.status === "crashed" && (
            <Button
              secondary
              onClick={() =>
                act(() =>
                  engine.start(d.objective, d.demo, d.design, d.destination),
                )
              }
            >
              Revise spacecraft
            </Button>
          )}
        </div>
      ) : (
        <div className="landing-cue">
          <span className="status-dot" />
          {d.assist
            ? "ASSIST: BRAKING TO A SAFE TOUCHDOWN"
            : Math.abs(l.vy) >
                Math.sqrt(
                  2 *
                    Math.max(
                      0.1,
                      8000 / (masses(d.design).descentDry + l.fuel) -
                        environment(d.destination).gravity,
                    ) *
                    Math.max(0, h - 15),
                )
              ? "BRAKE NOW · INCREASE THROTTLE"
              : "MONITOR DESCENT RATE"}
        </div>
      )}
      <div className="landing-controls" data-tutorial="landing-controls">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={d.assist}
            onChange={(e) =>
              act(() => {
                engine.data.assist = e.target.checked;
              })
            }
          />{" "}
          Stabilization + braking assist
        </label>
        <label className="slider-label">
          {d.assist ? "Throttle trim" : "Throttle"}
          <b>{(d.assist ? l.throttle * 100 : d.throttle * 100).toFixed(0)}%</b>
          <input
            aria-label="Descent throttle"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={d.throttle}
            onChange={(e) =>
              act(() => {
                engine.data.throttle = +e.target.value;
              })
            }
          />
        </label>
        <span className="micro">
          W/S PITCH · A/D YAW · Q/E ROLL
          <br />
          MARKER: UNPOWERED IMPACT ESTIMATE
        </span>
      </div>
      <FlightTouch />
      <FlightToolbar />
    </main>
  );
}
function Surface() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    settings = useGame((s) => s.settings),
    setSettings = useGame((s) => s.setSettings),
    nearest = engine.nearest(),
    busy = !!d.scanId || d.transmitting;
  return (
    <main className="surface-ui">
      <div className="flight-title">
        <p className="eyebrow">
          06 / SURFACE OPERATIONS <span className="live-dot" />
        </p>
        <h1>
          Leave tracks.
          <br />
          <em>Bring back knowledge.</em>
        </h1>
        <p>
          {d.demo
            ? "Demo · one target · preset spacecraft · real mission systems"
            : d.objective === "imaging"
              ? "Photograph and transmit observations from all three sites."
              : "Take two spectral readings, drill one sample, and transmit all three."}
        </p>
      </div>
      <section
        className="surface-objectives"
        data-tutorial="science-objectives"
      >
        <div className="panel-heading">
          <h2>Science objectives</h2>
          <span>
            {d.transmitted.length} / {engine.targets().length}
          </span>
        </div>
        {engine.targets().map((t) => (
          <div className="target-row" key={t.id}>
            <span
              className={`target-number ${d.observations.includes(t.id) ? "done" : ""}`}
            >
              {d.transmitted.includes(t.id) ? <Check size={14} /> : t.id}
            </span>
            <div>
              <b>{t.name}</b>
              <small>
                {Math.hypot(t.x - d.rover.x, t.z - d.rover.z).toFixed(0)} m ·{" "}
                {d.observations.includes(t.id)
                  ? d.transmitted.includes(t.id)
                    ? "TRANSMITTED"
                    : "STORED"
                  : t.instrument.toUpperCase()}
              </small>
            </div>
            {d.earthMode && !d.observations.includes(t.id) && (
              <button
                aria-label={`Queue drive to ${t.name}`}
                title={`Queue drive + observation: about ${engine.queueEstimate(t.id).energyWh.toFixed(1)} Wh gross energy, ${engine.queueEstimate(t.id).seconds.toFixed(0)} s driving. Solar generation is not subtracted.`}
                onClick={() => act(() => engine.queueTarget(t.id))}
              >
                <ArrowUpRight size={18} />
              </button>
            )}
          </div>
        ))}
        {d.earthMode && <div className="queue-preview">{engine.targets().filter(t=>!d.observations.includes(t.id)).map(t=><p key={t.id}>{t.name}: ≈{engine.queueEstimate(t.id).distance.toFixed(0)} m · {engine.queueEstimate(t.id).energyWh.toFixed(1)} Wh gross · drive + {t.instrument}. Estimate assumes 2.5 m/s, includes electrical time ×30, excludes solar.</p>)}</div>}
        <button className="text-link" onClick={()=>act(()=>engine.recoverRover())}>Game assistance: recover to landing site</button>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={d.earthMode}
            onChange={(e) =>
              act(() => {
                engine.data.earthMode = e.target.checked;
                engine.data.queue = [];
                engine.data.rover.speed = 0;
              })
            }
          />{" "}
          Earth-command mode
        </label>
        <p className="model-note">
          {d.earthMode
            ? `${engine.delay().toFixed(0)} s scientific one-way delay → 3 s command delivery. Queue a destination with ↗; local autonomy drives and observes.`
            : "Direct local rover control · no Earth command delay. Arcade-assisted ground contact."}
        </p>
        {d.queue.length > 0 && (
          <p className="queue-status">
            {d.queue[0].wait > 0 ? "COMMAND IN TRANSIT" : "AUTONOMY DRIVING"} ·{" "}
            {d.queue.length} queued
          </p>
        )}
      </section>
      <RoverMinimap/>
      <div className="surface-telemetry">
        <Stat label="BATTERY" value={d.battery.toFixed(0)} unit="Wh" />
        <div className={`meter ${d.battery < 50 ? "danger" : ""}`}>
          <i style={{ width: `${d.battery / 6}%` }} />
        </div>
        <div className="power-flow">
          <span>
            <Sun size={13} /> +{d.generation.toFixed(0)} W
          </span>
          <span>−{d.load.toFixed(0)} W load</span>
        </div>
        <Stat
          label="GROUND SPEED"
          value={Math.abs(d.rover.speed).toFixed(1)}
          unit="m/s"
        />
        <button
          className={`sun-button ${d.panelTracking ? "active" : ""}`}
          onClick={() =>
            act(() => {
              engine.data.panelTracking = !engine.data.panelTracking;
              engine.explain(
                engine.data.panelTracking
                  ? "Solar tracking faces the panel normal toward the Sun. The cosine factor is applied once."
                  : "Fixed panel orientation reduces power when facing away from the Sun.",
              );
            })
          }
        >
          <Sun size={15} />
          {d.panelTracking ? "Sun tracking on" : "Aim panels at Sun"}
        </button>
        <RoverInstruments/>
        <button className="text-link" onClick={()=>useGame.getState().open("observations")}>View stored observations ({d.observations.length})</button>
        <div className="camera-buttons" aria-label="Camera mode">
          {(["chase", "orbit", "map"] as const).map((mode) => (
            <button
              key={mode}
              className={settings.camera === mode ? "active" : ""}
              onClick={() => setSettings({ camera: mode })}
            >
              {mode === "chase" ? (
                <Navigation size={14} />
              ) : mode === "orbit" ? (
                <Orbit size={14} />
              ) : (
                <ScanLine size={14} />
              )}{" "}
              {mode}
            </button>
          ))}
        </div>
        <label className="surface-zoom">Zoom <input aria-label="Surface camera zoom" type="range" min=".3" max="3.5" step=".05" value={settings.flightZoom} onChange={(e) => setSettings({ flightZoom: +e.target.value })}/></label>
        <p className="micro">
          ENERGY TIMELINE ×30
          <br />
          DUST TRANSMISSION 72% · ARRAY {(d.panelHealth * 100).toFixed(0)}%
        </p>
      </div>
      <section className="surface-ops-panel"><RoverOps/></section>
      <div className="science-action" data-tutorial="collect-science">
        <div>
          <span className="eyebrow">
            {busy
              ? d.transmitting
                ? "TRANSMITTING TO EARTH"
                : "OBSERVATION IN PROGRESS"
              : nearest.distance <= 6
                ? "TARGET IN RANGE"
                : "NEXT SCIENCE SITE"}
          </span>
          <h3>
            {d.transmitting
              ? "Awaiting acknowledgment"
              : d.scanId
                ? engine.targets().find((t) => t.id === d.scanId)?.name
                : nearest.name}
          </h3>
          {busy ? (
            <div className="meter">
              <i
                style={{
                  width: `${d.transmitting ? (d.transmitTime / 6) * 100 : (d.scanTime / (engine.targets().find((t) => t.id === d.scanId)?.instrument === "drill" ? 12 : 8)) * 100}%`,
                }}
              />
            </div>
          ) : (
            <small>
              {nearest.distance.toFixed(0)} m away · {nearest.subtitle}
            </small>
          )}
        </div>
        <Button
          disabled={
            busy ||
            nearest.distance > 6 ||
            d.observations.includes(nearest.id) ||
            d.battery < 35
          }
          onClick={() => act(() => engine.interact())}
        >
          <ScanLine size={17} />
          {nearest.instrument === "drill"
            ? "Drill sample"
            : "Collect observation"}{" "}
          <kbd>E</kbd>
        </Button>
        <Button
          tutorial="transmit-science"
          secondary
          disabled={
            busy || !d.observations.some((id) => !d.transmitted.includes(id))
          }
          onClick={() => act(() => engine.transmit())}
        >
          <span>
            <Radio size={17} />
          </span>{" "}
          Transmit{" "}
          {d.observations.filter((id) => !d.transmitted.includes(id)).length ||
            ""}
        </Button>
      </div>
      <DriveHelp />
    </main>
  );
}
function Debrief() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    s = score(d),
    total = Object.values(s).reduce((a, b) => a + b, 0);
  return (
    <main className="debrief-layout">
      <section>
        <p className="eyebrow">
          <Check size={13} /> MISSION COMPLETE / EARTH ACKNOWLEDGED
        </p>
        <h1>
          You brought
          <br />
          {destinations[d.destination].name.toLowerCase()} <em>closer.</em>
        </h1>
        <p className="hero-description">
          Every observation was earned.
          <br />
          Every decision left a trace.
        </p>
        <div className="score">
          <strong>{total}</strong>
          <span>
            MISSION POINTS
            <small>
              {s.science} science + {s.efficiency} battery reserve
              <br />+ {s.budget} unspent credits + {s.calibration} calibration
            </small>
          </span>
        </div>
        <div className="hero-actions">
          <Button
            onClick={() =>
              act(() => {
                const design = { ...d.design };
                engine.start(d.objective, d.demo, design, d.destination);
              })
            }
          >
            Fly this design again <RotateCcw size={16} />
          </Button>
          <Button
            secondary
            onClick={() =>
              act(() =>
                engine.start(d.objective, d.demo, d.design, d.destination),
              )
            }
          >
            Revise design <ArrowRight size={16} />
          </Button>
          <Button secondary onClick={() => act(() => engine.go("briefing"))}>
            Choose another destination
          </Button>
        </div>
      </section>
      <section className="debrief-report" data-tutorial="debrief-report">
        <div className="panel-heading">
          <h2>Mission debrief</h2>
          <span>VYDEX–01</span>
        </div>
        <div className="report-grid">
          <Stat
            label="SCIENCE TRANSMITTED"
            value={`${d.transmitted.length} / ${engine.targets().length}`}
          />
          <Stat
            label="MISSION COST"
            value={cost(d.design).toFixed(1)}
            unit="credits"
          />
          <Stat
            label="DESCENT FUEL USED"
            value={(d.design.descentFuel - d.lander.fuel).toFixed(1)}
            unit="kg"
          />
          <Stat
            label="CRUISE FUEL USED"
            value={(d.design.cruiseFuel - d.cruiseFuel).toFixed(1)}
            unit="kg"
          />
          <Stat
            label="ELECTRICAL LOAD ENERGY"
            value={d.energyUsed.toFixed(1)}
            unit="Wh"
          />
          <Stat
            label="SOLAR ENERGY GENERATED"
            value={d.energyGenerated.toFixed(1)}
            unit="Wh"
          />
          <Stat
            label="ROVER DISTANCE"
            value={d.rover.distance.toFixed(0)}
            unit="m"
          />
          <Stat
            label="TIME AT THE CONTROLS"
            value={(d.elapsed / 60).toFixed(1)}
            unit="min"
          />
        </div>
        <div className="decision-report">
          <h3>Why did that happen?</h3>
          {d.decisionLog.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
          <p>
            {d.destination === "asteroid"
              ? "The probe retained its cruise stage for fuel-consuming proximity control. Mission payload dry mass: "
              : d.destination === "earth"
                ? "The satellite discarded its cruise stage during deployment. Integrated reaction wheels now control attitude without cruise propellant. Satellite dry mass: "
                : "The cruise module and remaining cruise propellant were discarded before landing. Surface equipment mass: "}
            <b>{masses(d.design).surface} kg</b>.
          </p>
          <p>
            Your{" "}
            {d.destination === "asteroid"
              ? "sampling arm used 75 W while active"
              : d.design.drill
                ? "drill used 100 W while active"
                : "camera used 10 W while active"}
            . Observations counted only after Earth acknowledgment.
          </p>
        </div>
        <div className="lesson">
          <span>TAKE THIS HOME</span>
          <p>
            Every extra instrument costs mass, money and energy. A successful
            mission brings what its science actually needs.
          </p>
        </div>
      </section>
    </main>
  );
}
function Why() {
  const d = useGame((s) => s.data),
    [expanded, setExpanded] = useState(false);
  if (
    ![
      "assembly",
      "preflight",
      "cruise",
      "landing",
      "surface",
      "orbit",
    ].includes(d.stage)
  )
    return null;
  return (
    <aside className={`why ${expanded ? "expanded" : ""}`}>
      <button onClick={() => setExpanded(!expanded)}>
        <CircleHelp size={17} />
        <b>WHY DID THAT HAPPEN?</b>
        {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      <p aria-live="polite">{d.explanations[0]}</p>
      {expanded && (
        <div className="explanation-history">
          {d.explanations.slice(1, 5).map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      )}
    </aside>
  );
}
function InstallGame() {
  const pwa = usePwa();
  return (
    <div className="install-game">
      <button className="btn secondary" onClick={() => void installGame()}>
        {pwa.installed ? "Installed on this device" : "Install / download game"}{" "}
        <ArrowDown size={15} />
      </button>
      <p>
        {pwa.offlineReady
          ? "Offline game files are ready on this device."
          : "Offline files download after opening the production game online once."}
      </p>
      {pwa.message && <p role="status">{pwa.message}</p>}
    </div>
  );
}
function Menus() {
  const drawer = useGame((s) => s.drawer),
    paused = useGame((s) => s.paused),
    open = useGame((s) => s.open),
    pause = useGame((s) => s.pause),
    settings = useGame((s) => s.settings),
    setSettings = useGame((s) => s.setSettings),
    save = useGame((s) => s.save),
    load = useGame((s) => s.load),
    erase = useGame((s) => s.erase),
    message = useGame((s) => s.saveMessage),
    act = useGame((s) => s.act);
  useEffect(() => {
    if (!drawer && !paused) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector("[role=dialog]");
    if (!dialog) return;
    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,[tabindex="0"]',
        ),
      );
    focusables()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables(),
        first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [drawer, paused]);
  if (!drawer && !paused) return null;
  return (
    <div
      className="modal-scrim"
      onClick={() => (drawer ? open(null) : pause())}
    >
      <section
        className={`drawer ${drawer === "sources" ? "sources" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={
          drawer === "sources"
            ? "Science and sources"
            : drawer === "settings"
              ? "Settings"
              : "Mission paused"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close"
          aria-label="Close menu"
          onClick={() => (drawer ? open(null) : pause())}
        >
          <X size={21} />
        </button>
        <p className="eyebrow">VYDEX / MISSION CONTROL</p>
        <h2>
          {drawer === "sources"
            ? "Science & sources"
            : drawer === "observations" ? "Stored observations" : drawer === "controls" ? "Controls & telemetry" : drawer === "settings"
              ? "Your flight settings"
              : "Mission paused"}
        </h2>
        {drawer === "sources" ? (
          <>
            <p>
              Reference science. Transparent approximations. Fictional mission.
              <br />
              Retrieved November 10, 2026. No live NASA telemetry.
            </p>
            <div className="source-explainer">
              <h3>How this simulation works</h3>
              <p>
                <b>Reference facts:</b> NASA planetary properties and JPL
                constants below. Solar day and sidereal rotation stay separate.
              </p>
              <p>
                <b>Derived calculations:</b> ideal rocket equation,
                inverse-square solar flux, one-way light time, and a circular
                coplanar Hohmann transfer solved in eccentric anomaly.
              </p>
              <p>
                <b>Educational approximations:</b> Mars uses uniform 3.73 m/s²
                gravity and density ρ = 0.016 exp(−h/11000). The Moon uses 1.62
                m/s² and zero drag. Earth deployment uses a separate
                circular-orbit reference; fictional asteroid proximity neglects
                gravity and drag. Rover contact uses a height field. Mars
                hypersonic entry is compressed.
              </p>
              <p>
                <b>Fictional parameters:</b> all hardware, credits, instrument
                results, terrain, dust transmission (72%), targets, launch
                service and touchdown limits. Energy time ×30; command delivery
                3 s; acknowledgment 6 s.
              </p>
              <p>
                <b>Challenge verification:</b> 2026 index returned an error. An
                official team page reproduces the Space Mission Design Game
                brief. Formal compliance is not asserted.
              </p>
            </div>
            <div className="science-table">
              {Object.entries(scienceConstants).map(([k, v]) => (
                <div key={k}>
                  <b>{k}</b>
                  <span>
                    {v.value.toLocaleString(undefined, {
                      maximumSignificantDigits: 18,
                    })}{" "}
                    {v.unit}
                  </span>
                  <p>
                    {v.interpretation} · precision: {v.precision}
                  </p>
                  <a
                    href={sources[v.sourceId].url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {sources[v.sourceId].title} <ArrowUpRight size={11} />
                  </a>
                </div>
              ))}
            </div>
            <h3>Primary sources</h3>
            {Object.values(sources).map((s) => (
              <a
                className="source-link"
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
              >
                {s.title}
                <ArrowUpRight size={14} />
              </a>
            ))}
            <p className="micro">
              INDEPENDENT EDUCATIONAL PROJECT · NO NASA SPONSORSHIP IMPLIED
            </p>
          </>
        ) : drawer === "observations" ? (<Observations/>) : drawer === "controls" ? (<ControlsGuide/>) : (
          <>
            <p>Vehicle motion pauses while this menu is open.</p>
            <InstallGame />
            <label className="setting-label">
              Graphics quality
              <select
                value={settings.quality}
                onChange={(e) =>
                  setSettings({
                    quality: e.target.value as typeof settings.quality,
                  })
                }
              >
                <option value="low">Low · 1× resolution, no shadows</option>
                <option value="medium">Medium · up to 1.25× resolution</option>
                <option value="high">High · up to 1.75× resolution</option>
              </select>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) =>
                  setSettings({ reducedMotion: e.target.checked })
                }
              />{" "}
              Reduced motion
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={!settings.muted}
                onChange={(e) => setSettings({ muted: !e.target.checked })}
              />{" "}
              Mission audio
            </label>
            <label className="slider-label">
              Volume<b>{Math.round(settings.volume * 100)}%</b>
              <input
                type="range"
                min="0"
                max="1"
                step=".05"
                value={settings.volume}
                onChange={(e) => setSettings({ volume: +e.target.value })}
              />
            </label>
            <div className="menu-buttons">
              <Button
                onClick={() => {
                  open(null);
                  useGame.setState({ paused: false });
                }}
              >
                Resume mission <Play size={16} />
              </Button>
              <Button secondary onClick={()=>open("observations")}>View stored observations</Button>
              <Button secondary onClick={openInspection}>Inspect spacecraft & components</Button>
              <Button secondary onClick={()=>open("controls")}>Controls & telemetry guide</Button>
              <Button secondary onClick={replayTutorial}>
                Replay tutorial
              </Button>
              <Button
                secondary
                onClick={() => {
                  save();
                  act(() => engine.go("briefing"));
                  open(null);
                  useGame.setState({ paused: false });
                }}
              >
                Save & choose destination
              </Button>
              <Button secondary onClick={save}>
                Save mission
              </Button>
              <Button secondary onClick={load}>
                Load saved mission
              </Button>
              <Button
                secondary
                onClick={() => {
                  act(() => {
                    engine.start(
                      engine.data.objective,
                      engine.data.demo,
                      engine.data.design,
                      engine.data.destination,
                    );
                  });
                  open(null);
                  useGame.setState({ paused: false });
                }}
              >
                Restart campaign <RotateCcw size={15} />
              </Button>
              <button className="text-link destructive" onClick={erase}>
                Delete saved mission
              </button>
            </div>
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
function useSimulation() {
  useEffect(() => {
    let raf = 0,
      last = performance.now(),
      acc = 0,
      lastSync = 0,
      lastStage = engine.data.stage;
    function loop(now: number) {
      const ui = useGame.getState();
      const elapsed = (now - last) / 1000;
      last = now;
      if (
        !ui.paused &&
        !ui.drawer &&
        !ui.workshop.info &&
        !ui.rocketInfo &&
        !ui.settings.inspection &&
        !(ui.tutorial.enabled && ui.tutorial.hold) &&
        !document.hidden
      ) {
        acc = fixedAdvance(acc, elapsed, (dt) => engine.tick(dt, input));
      } else {
        acc = 0;
        Object.assign(input, neutral);
        keyboard.clear();
      }
      if (now - lastSync > 120 || engine.data.stage !== lastStage) {
        ui.sync();
        lastSync = now;
        if (engine.data.stage !== lastStage) {
          lastStage = engine.data.stage;
          keyboard.clear();Object.assign(input,neutral);
          if (lastStage !== "briefing") ui.save();
        }
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const reset = () => {
      keyboard.clear();
      Object.assign(input, neutral);
    };
    const handler = (e: KeyboardEvent, down: boolean) => {
      const target = e.target as HTMLElement;
      if (
        down &&
        target.matches(
          "textarea,select,[contenteditable=true],input:not([type=checkbox]):not([type=radio]):not([type=range])",
        )
      )
        return;
      if (
        down &&
        target.matches("input[type=range]") &&
        e.key.startsWith("Arrow")
      )
        return;
      const k = e.key.toLowerCase();
      if (
        (useGame.getState().paused ||
          useGame.getState().drawer ||
          useGame.getState().workshop.info ||
          useGame.getState().rocketInfo ||
          useGame.getState().settings.inspection ||
          useGame.getState().tutorial.hold) &&
        k !== "escape"
      ) {
        reset();
        return;
      }
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          " ","q","e","shift","control",
        ].includes(k)
      )
        e.preventDefault();
      keyboard.update(k,down);
      const context=engine.data.stage;
      Object.assign(input,context==='landing'||context==='orbit'?keyboard.flightAxes():{...neutral,...keyboard.axes(),pitch:undefined,yaw:undefined,roll:undefined,rcsX:undefined,rcsZ:undefined,throttleChange:0});
      if (
        down &&
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(k)
      )
        useGame.getState().setTutorial({ action: "steer" });
      if (down && !e.repeat) {
        const ui=useGame.getState();
        if(k==='c'){
          if(engine.data.stage==='surface'){const modes=['chase','orbit','map'] as const;ui.setSettings({camera:modes[(modes.indexOf(ui.settings.camera)+1)%3]})}
          else {const modes=['follow','cinematic','overview'] as const;ui.setSettings({flightCamera:modes[(modes.indexOf(ui.settings.flightCamera)+1)%3]})}
        }
        if(k==='x'&&['landing','orbit'].includes(engine.data.stage))ui.act(()=>{engine.data.throttle=0;engine.data.engineEnabled=false});
        const st=engine.data.stage;
        if(k==='p'&&['cruise','orbit'].includes(st))ui.act(()=>engine.togglePanels());
        if(k==='f'&&st==='orbit')ui.act(()=>engine.releaseProbe());
        if(st==='surface'){
          if(k==='l')ui.act(()=>engine.cycleHeadlights());
          if(k==='i')ui.act(()=>engine.inspect());
          if(k==='b')ui.act(()=>engine.serviceAtBase());
          if(k==='t')ui.act(()=>engine.transmit());
          if(k==='v')window.dispatchEvent(new CustomEvent('vydex:record'));
        }

        if (k === "escape") {
          const ui = useGame.getState();
          ui.settings.inspection
            ? ui.setSettings({inspection:false})
            : ui.rocketInfo ? ui.setRocketInfo(null) : ui.workshop.info
            ? ui.setWorkshop({ info: null })
            : ui.drawer
              ? ui.open(null)
              : ui.pause();
          reset();
        }
        if (
          k === "e" && engine.data.stage === "surface" &&
          !useGame.getState().paused &&
          !useGame.getState().drawer
        )
          useGame.getState().act(() => engine.interact());
      }
    };
    const down = (e: KeyboardEvent) => handler(e, true),
      up = (e: KeyboardEvent) => handler(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);
}
function useSound() {
  useEffect(() => {
    let context: AudioContext | undefined;
    let bed: OscillatorNode | undefined, bedGain: GainNode | undefined;
    const click = () => {
      const s = useGame.getState().settings;
      if (s.muted) return;
      try {
        context ??= new AudioContext();
        if (!bed) {
          bed = context.createOscillator();
          bedGain = context.createGain();
          bed.type = "triangle";
          bed.frequency.value = 46;
          bedGain.gain.value = 0;
          bed.connect(bedGain);
          bedGain.connect(context.destination);
          bed.start();
        }
        void context.resume();
        const o = context.createOscillator(),
          g = context.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(650, context.currentTime);
        o.frequency.exponentialRampToValueAtTime(
          420,
          context.currentTime + 0.07,
        );
        g.gain.setValueAtTime(s.volume * 0.08, context.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
        o.connect(g);
        g.connect(context.destination);
        o.start();
        o.stop(context.currentTime + 0.11);
      } catch {
        /* Audio optional */
      }
    };
    const soundTimer = setInterval(() => {
      if (!context || !bedGain) return;
      const ui = useGame.getState(),
        d = engine.data,
        p = launchFraction(d);
      const active =
        !ui.settings.muted &&
        !ui.paused &&
        !ui.drawer &&
        !ui.workshop.info &&
        !ui.rocketInfo &&
        !ui.settings.inspection &&
        !ui.tutorial.hold;
      const level =
        active &&
        d.stage === "launch" &&
        d.launchChecks.every(Boolean) &&
        p > 0.12 &&
        p < 0.7
          ? 0.025
          : active &&
              d.stage === "landing" &&
              d.lander.status === "flying" &&
              d.landingStarted
            ? d.lander.throttle * 0.012
            : active && d.stage==='orbit' && d.destination==='asteroid' && d.engineEnabled && d.cruiseFuel>0 ? d.throttle*.008 : 0;
      bedGain.gain.setTargetAtTime(
        level * ui.settings.volume,
        context.currentTime,
        0.12,
      );
    }, 100);
    window.addEventListener("pointerdown", click);
    return () => {
      clearInterval(soundTimer);
      bed?.stop();
      window.removeEventListener("pointerdown", click);
      void context?.close();
    };
  }, []);
}
export default function App() {
  const destination = useGame((s) => s.data.destination);
  const stage = useGame((s) => s.data.stage),
    reduced = useGame((s) => s.settings.reducedMotion);
  useSimulation();
  useSound();
  return (
    <div
      data-destination={destination}
      className={`app ${reduced ? "reduced-motion" : ""}`}
    >
      <Scene />
      <div className="scene-shade" />
      <Header />
      {useGame(s=>s.settings.inspection) ? (<InspectionControls flight/>) : stage === "briefing" ? (
        <DestinationBriefing />
      ) : stage === "rocket" ? (
        <Launchers/>
      ) : stage === "assembly" ? (
        <Workshop />
      ) : stage === "preflight" ? (
        <Preflight />
      ) : stage === "launch" ? (
        <LaunchPanel />
      ) : stage === "cruise" ? (
        <TravelPanel />
      ) : stage === "landing" ? (
        <Landing />
      ) : stage === "orbit" ? (
        <OrbitalPanel />
      ) : stage === "surface" ? (
        isLunarLike(useGame.getState().data.destination) ? (
          <LunarStation />
        ) : (
          <Surface />
        )
      ) : (
        <Debrief />
      )}
      {!useGame(s=>s.settings.inspection) && <Telemetry/>}
      {["cruise","orbit"].includes(stage) && <HazardAlert/>}
      <Why />
      {stage !== "briefing" && (
        <footer>
          <span>
            <i className="status-dot" />{" "}
            {stage === "debrief"
              ? "MISSION ARCHIVED"
              : "SIMULATION / EDUCATIONAL SCENARIO"}
          </span>
          <span>
            VYDEX–01 <i /> RED FRONTIER
          </span>
          <button onClick={() => useGame.getState().open("sources")}>
            SCIENCE & SOURCES <ArrowUpRight size={11} />
          </button>
        </footer>
      )}
      <Menus />
      <ComponentInformation />
      <RocketInformation />
      <Tutorial />
    </div>
  );
}
