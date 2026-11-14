import Advisor from "./Advisor";
import { ArrowRight, Info, RotateCcw, Layers, Plus, Minus } from "lucide-react";
import { engine } from "../sim/game";
import { useGame } from "../store";
import {
  parts,
  partIds,
  installed,
  compatibility,
  missionStarter,
  emptyDesign,
  requiredParts,
  type PartId,
} from "../data/workshop";
import { cost, masses } from "../sim/physics";
import { balance } from "../data/gameBalance";
import { fitPart } from "../assemblyActions";
import { sources } from "../data/sourceRegistry";
import { useEffect, useRef, useState } from "react";
import { launchers, capacityFor } from "../data/launchVehicles";
import { launcherFit } from "../sim/payload";
import InspectionControls from "./Inspection";
const equipmentGroups = {
 "All equipment": partIds,
 "Propulsion": ["tank","cruiseEngine"],
 "Structure": ["body","connector","cruise"],
 "Electrical": ["battery","solar"],
 "Navigation": ["computer"],
 "Communications": ["antenna"],
 "Landing": ["legs","descentEngine"],
 "Science": ["camera","spectrometer","drill","sampler"],
 "Surface mobility": ["rover"],
} as Record<string,PartId[]>;
export default function Workshop() {
  const [category,setCategory]=useState("All equipment");
  const images=useGame(s=>s.thumbnails);
  const d = useGame((s) => s.data),
    w = useGame((s) => s.workshop),
    set = useGame((s) => s.setWorkshop),
    act = useGame((s) => s.act),
    selected = parts[w.selected],
    has = installed(d.design, w.selected),
    issue = compatibility(d.design, w.selected, d.destination, !has),
    m = masses(d.design), launcher=launchers[d.design.launcher??"titan"], fit=launcherFit(d.design,d.destination,m.wet);
  const select = (id: PartId) => {
    set({ selected: id, message: `${parts[id].slot}: ${parts[id].purpose}` });
    useGame.getState().setTutorial({ action: "select:" + id });
  };
  return (
    <main className="assembly-layout workshop-layout">
      <section className="stage-intro">
        <p className="eyebrow">01 / ASSEMBLY WORKSHOP</p>
        <h1>
          Your craft.
          <br />
          <em>Every connection.</em>
        </h1>
        <p>
          Select a component, inspect ⓘ, then click its mounting point or
          Install. Drag a card onto a compatible slot.
        </p>
        <div className="vertical-stats">
          <div className="stat">
            <span>MISSION COST</span>
            <strong>
              {cost(d.design).toFixed(1)}
              <small>/ {balance.budget} cr</small>
            </strong>
          </div>
          <div className="stat">
            <span>LAUNCH MASS / LIMIT</span>
            <strong>
              {m.wet.toFixed(0)}
              <small>/ {capacityFor(launcher.id,d.destination)} kg</small>
            </strong>
          </div>
          <div className="stat">
            <span>SCIENCE HARDWARE</span>
            <strong>
              {partIds.filter((id) => installed(d.design, id)).length}
              <small>components</small>
            </strong>
          </div>
        </div>
        <div className="launcher-summary"><b>{launcher.name}</b> · {launcher.cost} cr <button className="text-link" onClick={()=>act(()=>engine.go('rocket'))}>Switch carrier →</button><p className={fit.ok?'fit-ok':'fit-error'}>{!fit.route?'Unsupported destination. Switch carrier.':!fit.mass?'Too heavy. Reduce optional mass / fuel or choose a larger carrier.':!fit.dimensions?'Payload exceeds usable bay. Choose a larger fairing or remove protruding equipment.':`Stowed envelope Ø${fit.payload.diameter.toFixed(2)} × ${fit.payload.height.toFixed(2)} m fits.`}</p></div>
        <Advisor />
        <div className="workshop-tools">
          <button
            onClick={() => set({ exploded: !w.exploded })}
            aria-pressed={w.exploded}
          >
            <Layers size={15} />
            {w.exploded ? "Collapse vehicle" : "Exploded view"}
          </button>
          <button
            onClick={() =>
              act(() => {
                engine.data.design = {...emptyDesign(d.destination),launcher:d.design.launcher};
                engine.data.battery = 0;
                engine.data.cruiseFuel = 0;
                engine.data.lander.fuel = 0;
                set({
                  selected: "body",
                  message:
                    "Start with the structural bus. All mounts remain editable.",
                });
              })
            }
          >
            Build manually
          </button>
          <button
            onClick={() =>
              act(() => {
                engine.data.design = {...missionStarter(d.destination, d.objective),launcher:d.design.launcher};
                engine.data.battery = 480;
                engine.data.cruiseFuel = engine.data.design.cruiseFuel;
                set({
                  message:
                    "Working starter loaded. Inspect, remove and reinstall components to learn.",
                });
              })
            }
          >
            <RotateCcw size={13} />
            Load starter design
          </button>
        </div>
        <div className="installed-inspector">
          <b>{selected.name}</b>
          <button
            aria-label={`Information about installed ${selected.name}`}
            onClick={() => set({ info: w.selected })}
          >
            <Info size={18} />
          </button>
          <span>
            {has ? "INSTALLED" : "PREVIEW"} · {selected.slot}
          </span>
          <p>{w.message}</p>
          <p className="micro">
            Battery capacity: {d.design.battery ? 600 : 0} Wh · thrust:{" "}
            {installed(d.design, "descentEngine") ? 8000 : 0} N
          </p>
        </div>
      </section>
      <InspectionControls/>
      <div className="assembly-scene-caption">
        <span>VYDEX–01 / {d.destination.toUpperCase()} CONFIGURATION</span>
        <small>DRAG SCENE TO ROTATE · SCROLL / PINCH TO ZOOM</small>
      </div>
      <section className="payload-panel workshop-panel">
        <div className="panel-heading">
          <h2>Component library</h2>
          <span>
            {
              requiredParts(d.destination, d.objective).filter((id) =>
                installed(d.design, id),
              ).length
            }
            /{requiredParts(d.destination, d.objective).length} REQUIRED
          </span>
        </div>
        <p className="panel-sub">
          Fictional hardware · mission credits · ⓘ explains every part
        </p>
        <label className="catalogue-category">Equipment category<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.keys(equipmentGroups).map(c=><option key={c}>{c}</option>)}</select></label>
        <p className="model-note">Sensors + reaction wheels are bundled with navigation; RCS with the cruise engine; transmitter with antenna; wheels + motors with rover. Provider fairing is included in the rocket service.</p>
        <div className="workshop-parts">
          {equipmentGroups[category].map((id) => (
            <div
              key={id}
              className={`workshop-card ${w.selected === id ? "selected" : ""} ${installed(d.design, id) ? "installed" : ""}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/vydex-part", id);
                select(id);
              }}
            >
              <button
                data-tutorial={`part-${id}`}
                className="component-select"
                onClick={() => select(id)}
                aria-label={`Select ${parts[id].name}`}
              >
                {images[id]?<img className="equipment-thumbnail" src={images[id]} alt={`${parts[id].name} installed 3D geometry`}/>:<span>{installed(d.design, id) ? "✓" : "+"}</span>}
                <span>
                  <b>{parts[id].name}</b>
                  <small>
                    {parts[id].mass} kg · {parts[id].credits} cr ·{" "}
                    {parts[id].power} W{" "}
                    {parts[id].power === 0
                      ? "passive"
                      : id === "computer"
                        ? "base"
                        : "active"}
                  </small>
                </span>
              </button>
              <button
                className="info-button"
                data-tutorial={`info-${id}`}
                aria-label={`Information about ${parts[id].name}`}
                onClick={() => set({ info: id, selected: id })}
              >
                <Info size={18} />
              </button>
            </div>
          ))}
        </div>
        <div className="component-detail">
          <b>{selected.name}</b>
          <p>
            {selected.slot} · {selected.performance}
          </p>
          {issue && (
            <p className="fit-error" role="status">
              {issue}
            </p>
          )}
          <button
            className="btn fit-button"
            data-tutorial="install-part"
            disabled={!!issue}
            onClick={() => fitPart(w.selected, !has)}
          >
            {has ? <Minus size={14} /> : <Plus size={14} />}{" "}
            {has ? "Remove" : "Install"} {selected.name}
          </button>
        </div>
        <label className="slider-label">
          Cruise fuel <b>{d.design.cruiseFuel} kg</b>
          <input
            type="range"
            min="20"
            max="300"
            step="10"
            value={d.design.cruiseFuel}
            disabled={!installed(d.design, "tank")}
            onChange={(e) =>
              act(() => {
                engine.data.design = {
                  ...engine.data.design,
                  cruiseFuel: +e.target.value,
                };
              })
            }
          />
          <small className="fuel-cost">
            0.04 cr/kg · separate cruise reserve
          </small>
        </label>
        <label className="slider-label">
          Descent fuel <b>{d.design.descentFuel} kg</b>
          <input
            type="range"
            min="0"
            max="220"
            step="10"
            value={d.design.descentFuel}
            disabled={!installed(d.design, "tank")}
            onChange={(e) =>
              act(() => {
                engine.data.design = {
                  ...engine.data.design,
                  descentFuel: +e.target.value,
                };
              })
            }
          />
          <small className="fuel-cost">
            0.05 cr/kg · zero for orbital missions
          </small>
        </label>
        <button
          className="btn"
          data-tutorial="preflight"
          onClick={() =>
            act(() => {
              engine.data.cruiseFuel = d.design.cruiseFuel;
              useGame.getState().setTutorial({
                action: "preflight",
                completed: [
                  ...new Set([
                    ...useGame.getState().tutorial.completed,
                    "assembly:" + d.destination,
                  ]),
                ],
                hold: false,
              });
              engine.go("preflight");
            })
          }
        >
          Run preflight <ArrowRight size={16} />
        </button>
      </section>
    </main>
  );
}
export function ComponentInformation() {
  const id = useGame((s) => s.workshop.info),
    set = useGame((s) => s.setWorkshop);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!id) return;
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        set({ info: null });
      }
      if (event.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>("button,a[href]") ?? [],
        );
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      previous?.focus();
    };
  }, [id, set]);
  if (!id) return null;
  const p = parts[id];
  return (
    <div
      className="modal-scrim component-info-scrim"
      onClick={() => set({ info: null })}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${p.name} information`}
        className="component-information"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close"
          aria-label="Close component information"
          onClick={() => set({ info: null })}
        >
          ×
        </button>
        <p className="eyebrow">EQUIPMENT FIELD GUIDE / {id.toUpperCase()}</p>
        <h2>{p.name}</h2>
        <p>{p.purpose}</p>
        <div className="part-specs">
          <span>
            <b>{p.mass} kg</b>dry mass
          </span>
          <span>
            <b>{p.power} W</b>
            {id === "computer" ? "base avionics" : "active load"}
          </span>
          <span>
            <b>{p.credits} cr</b>mission credits
          </span>
        </div>
        <dl>
          <dt>In the mission</dt>
          <dd>{p.performance}</dd>
          <dt>Compatible mounting location</dt>
          <dd>
            {p.slot}.{" "}
            {compatibility(
              engine.data.design,
              id,
              engine.data.destination,
              true,
            ) ||
              "Compatible with the selected mission and its current mounting structure."}
          </dd>
          <dt>Advantage</dt>
          <dd>{p.advantage}</dd>
          <dt>Trade-off</dt>
          <dd>{p.tradeoff}</dd>
          <dt>If you leave it out</dt>
          <dd>{p.omission}</dd>
          <dt>A simple example</dt>
          <dd>{p.example}</dd>
        </dl>
        <p className="model-note">
          All equipment specifications and mission-credit prices here are
          fictional educational design parameters. The linked reference explains
          the underlying science, not this hardware.
        </p>
        <a
          className="source-link"
          href={sources[p.source].url}
          target="_blank"
          rel="noreferrer"
        >
          {sources[p.source].title} ↗
        </a>
        <button className="btn" onClick={() => set({ info: null })}>
          Back to the same spacecraft
        </button>
      </div>
    </div>
  );
}
