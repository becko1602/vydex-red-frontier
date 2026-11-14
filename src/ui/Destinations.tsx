import { useState } from "react";
import { ArrowRight, ArrowUpRight, Play } from "lucide-react";
import { useGame } from "../store";
import { engine } from "../sim/game";
import {
  destinations,
  isPlayable,
  type DestinationId,
} from "../data/destinations";
import { missionStarter, emptyDesign } from "../data/workshop";
import { recommendedLauncher } from "../data/launchVehicles";
import type { Objective } from "../data/gameBalance";
const availableDestinations: DestinationId[] = [
  "earth",
  "moon",
  "mars",
  "asteroid",
  "mercury",
  "venus",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];
export default function DestinationBriefing() {
  const d = useGame((s) => s.data),
    act = useGame((s) => s.act),
    load = useGame((s) => s.load),
    message = useGame((s) => s.saveMessage);
  const [objective, setObjective] = useState<Objective>("imaging");
  const selected = destinations[d.destination];
  function begin(manual = false, demo = false) {
    const destination = demo ? "mars" : d.destination;
    if (!isPlayable(destination)) return;
    const goal = destination === "mars" ? objective : "imaging";
    useGame.getState().setTutorial({
      completed: [
        ...new Set([...useGame.getState().tutorial.completed, "briefing"]),
      ],
      hold: false,
      phase: "",
      step: 0,
      action: "begin",
    });
    act(() =>
      engine.start(
        goal,
        demo,
        { ...(manual ? emptyDesign(destination) : missionStarter(destination, goal)), launcher: recommendedLauncher(destination) },
        destination,
      ),
    );
    act(() => engine.go("rocket"));
  }
  return (
    <main className="destination-briefing">
      <section className="destination-copy">
        <p className="eyebrow">VYDEX / MISSION DESIGN ACADEMY</p>
        <h1>
          Build a reason
          <br />
          to <em>go further.</em>
        </h1>
        <div className="destination-description">
          <p className="eyebrow">{selected.subtitle}</p>
          <h2>{selected.name}</h2>
          <p>{selected.objective}</p>
          <div className="destination-tags">
            <span>
              {selected.playable ? "PLAYABLE MISSION" : "EDUCATIONAL PREVIEW"}
            </span>
            <span>{selected.difficulty}</span>
            <span>{selected.minutes}</span>
          </div>
          <p className="destination-difference">{selected.difference}</p>
        </div>
        {d.destination === "mars" && (
          <div className="mission-objectives">
            <button
              className={objective === "imaging" ? "selected" : ""}
              onClick={() => setObjective("imaging")}
            >
              Imaging survey · 3 photos
            </button>
            <button
              className={objective === "geology" ? "selected" : ""}
              onClick={() => setObjective("geology")}
            >
              Geology · 2 readings + sample
            </button>
          </div>
        )}
        <div className="hero-actions" data-tutorial="begin-mission">
          <button
            className="btn"
            disabled={!selected.playable}
            onClick={() => begin(false)}
          >
            Starter mission → choose rocket <ArrowUpRight size={16} />
          </button>
          <button
            className="btn secondary"
            disabled={!selected.playable}
            onClick={() => begin(true)}
          >
            Manual mission → choose rocket <ArrowRight size={16} />
          </button>
        </div>
        <div className="briefing-links">
          <button onClick={load}>Resume saved mission →</button>
          <button onClick={() => begin(false, true)}>
            <Play size={12} /> Mars 3-minute demo
          </button>
        </div>
        {message && <p className="notice">{message}</p>}
      </section>
      <div className="planet-interaction-hint">
        DRAG / TOUCH TO ORBIT · SCROLL / PINCH TO ZOOM
        <br />
        <span>Illustrative planet scales · no live ephemeris</span>
      </div>
      <section
        className="destination-strip"
        data-tutorial="destinations"
        aria-label="Choose destination"
      >
        {availableDestinations.map((id) => (
          <button
            key={id}
            aria-pressed={d.destination === id}
            className={d.destination === id ? "selected" : ""}
            style={
              {
                "--destination-color": destinations[id].color,
              } as React.CSSProperties
            }
            onClick={() => {
              act(() => {
                engine.data.destination = id;
              });
              useGame.getState().setTutorial({ action: "destination" });
            }}
          >
            <span className={`destination-icon icon-${id}`} />
            <b>{destinations[id].name}</b>
            <small>
              {destinations[id].playable ? "PLAY MISSION" : "PREVIEW ONLY"}
            </small>
          </button>
        ))}
      </section>
      <div className="destination-footer">
        <span>TEAM VYDEX / THREE MEMBERS</span>
        <span>DESIGN · FLY · DISCOVER</span>
      </div>
    </main>
  );
}
