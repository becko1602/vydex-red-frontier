import { useEffect, useMemo } from "react";
import { useGame } from "../store";
import { installed } from "../data/workshop";
import { sampleCorridor } from "../sim/orbit";
type Step = {
  title: string;
  text: string;
  target?: string;
  explain?: boolean;
  done?: (s: ReturnType<typeof useGame.getState>) => boolean;
};
function stepsFor(
  phase: string,
  moon: boolean,
  manual: boolean,
  asteroid: boolean,
): Step[] {
  if (phase === "briefing")
    return [
      {
        title: "Welcome to mission control",
        text: "Choose where to go, build the craft, then fly its real systems. Every extra instrument costs mass, credits and power.",
        explain: true,
      },
      {
        title: "Choose a destination",
        text: "Select the Moon, Mars or an asteroid. Each destination has a playable mission and a 3D model you can rotate and zoom.",
        target: "destinations",
        done: (s) => s.tutorial.action === "destination",
      },
      {
        title: "Choose how to build",
        text: "Build manually for an empty workshop, or load a starter and inspect its parts.",
        target: "begin-mission",
        done: (s) => s.data.stage === "rocket",
      },
    ];
  if(phase==='rocket')return [
    {title:'Choose the right carrier',text:'These are fictional launch services. Delivery capacity depends on your destination; your spacecraft and its propellant are separate.',explain:true},
    {title:'Compare a rocket',text:'Select a carrier card. Check its destination payload capacity, usable fairing and remaining budget.',target:'rocket-catalogue',done:s=>s.tutorial.action==='select-rocket'},
    {title:'Inspect the actual model',text:'Drag the 3D rocket to rotate it, then scroll or pinch to zoom. Card images use the same model.',done:s=>s.tutorial.action==='rocket-rotate'},
    {title:'Continue to assembly',text:'Use this carrier. You can switch again without losing any installed equipment. Preflight enforces fit and budget.',target:'confirm-rocket',done:s=>s.data.stage==='assembly'},
  ];
  if (phase === "assembly")
    return [
      {
        title: "Your assembly workshop",
        text: "Each component has a real mount and an ⓘ field guide. Incompatible fits explain what must be installed first.",
        explain: true,
      },
      ...(manual
        ? [
            {
              title: "Select the structural bus",
              text: "Choose the body card to preview its highlighted mount.",
              target: "part-body",
              done: (s: ReturnType<typeof useGame.getState>) =>
                s.workshop.selected === "body",
            },
            {
              title: "Install the structural bus",
              text: "Click Install or its + mount. Other parts need this spine.",
              target: "install-part",
              done: (s: ReturnType<typeof useGame.getState>) =>
                installed(s.data.design, "body"),
            },
            {
              title: "Select a battery",
              text: "Find the battery card. Its compatible energy bay is highlighted.",
              target: "part-battery",
              done: (s: ReturnType<typeof useGame.getState>) =>
                s.workshop.selected === "battery",
            },
            {
              title: "Install the battery",
              text: "Click Install or the highlighted energy-bay +. Capacity is now 600 Wh, with a 480 Wh prepared reserve.",
              target: "install-part",
              done: (s: ReturnType<typeof useGame.getState>) =>
                installed(s.data.design, "battery"),
            },
          ]
        : [
            {
              title: "Inspect the battery",
              text: "Open its ⓘ button. Read why storage and generation are different.",
              target: "info-battery",
              done: (s: ReturnType<typeof useGame.getState>) =>
                s.workshop.info === "battery",
            },
          ]),
      {
        title: "Inspect your spacecraft",
        text: "Drag the 3D scene to orbit. Scroll or pinch to zoom; Exploded view separates the mounts.",
        done: (s) => s.tutorial.action === "rotate",
      },
      {title:"Inspect a close-up view",text:"Choose front, side or engine in the inspection toolbar. Turn labels on to select parts. Reset camera restores the overview.",target:"inspect-controls",done:s=>s.tutorial.action==='inspect-view'},
      {
        title: "Run preflight when ready",
        text: "Complete the required components, then check budget, fuel and mission capability. Failed checks link back to the exact part.",
        target: "preflight",
        done: (s) => s.data.stage === "preflight",
      },
    ];
  if (phase === "preflight")
    return [
      {
        title: "Make the design flyable",
        text: "Every failed check explains what to add, remove or refill. Fix in workshop selects that component without clearing the rest of your design.",
        explain: true,
      },
      {
        title: "Authorize only a valid design",
        text: "Complete failed checks, then authorize launch. A starter is available in the workshop if you need a working example.",
        target: "authorize-launch",
        done: (s) => s.data.stage === "launch",
      },
    ];
  if (phase === "cruise")
    return [
      {
        title: "Resources during the journey",
        text: "The route timeline and scientific travel duration are separate. Choose a power profile and perform the required propellant-consuming correction.",
        explain: true,
      },
      {
        title: "Choose a power profile",
        text: "Hibernate preserves charge. Keeping science active earns calibration points but uses more electricity. Both alternatives are calculated.",
        target: "hibernate",
        done: (s) => s.data.cruiseChoice !== "pending",
      },
      {
        title: "Correct the trajectory",
        text: "Execute the burn. Cruise propellant is separate from descent fuel; time acceleration cannot bypass this decision.",
        target: "correction-burn",
        done: (s) => s.data.correction,
      },
    ];
  if (phase === "debrief")
    return [
      {
        title: "Read what your decisions changed",
        text: "Only transmitted science counts. Compare the fuel, electrical energy, remaining charge and mission-credit figures in your report.",
        target: "debrief-report",
        explain: true,
      },
      {
        title: "Try a different design",
        text: "Fly the same design again, revise its equipment or select a new destination. Existing valid mission progress remains saved locally.",
        explain: true,
      },
    ];
  if (phase === "launch")
    return [
      {
        title: "A connected journey",
        text: "Earth launch is a labeled cinematic provider service. Your assembled payload is inside the fairing and is revealed after separation.",
        explain: true,
      },
      {
        title: "Check the payload fairing",
        text: "Confirm the first launch action.",
        target: "launch-check-0",
        done: (s) => s.data.launchChecks[0],
      },
      {
        title: "Choose a close camera",
        text: "Select Follow to watch the rocket closely. Cinematic and Overview remain available.",
        target: "flight-follow",
        done: (s) => s.settings.flightCamera === "follow",
      },
      {
        title: "Complete launch authorization",
        text: "Switch to internal power and release the interlocks. Pause and time controls do not bypass required decisions.",
        target: "launch-check-2",
        done: (s) => s.data.launchChecks.every(Boolean),
      },
    ];
  if (phase === "landing")
    return [
      {
        title: moon ? "Landing without an atmosphere" : "Final powered descent",
        text: moon
          ? "The Moon uses 1.62 m/s² and zero atmospheric drag. Engines must do all braking."
          : "Entry is compressed. You control the final 500 m with gravity, changing mass, thrust, fuel and simplified drag.",
        explain: true,
      },
      {
        title: "Take control",
        text: "Assist uses the same fuel-consuming engines. Start descent when ready.",
        target: "take-control",
        done: (s) => s.data.landingStarted,
      },
      {
        title: "Try gentle steering",
        text: "Use W/S pitch or Q/E roll briefly, or touch the attitude buttons. A/D changes yaw. Release to let stabilization reduce drift. Watch contact speed and fuel.",
        target: "landing-controls",
        done: (s) =>
          s.tutorial.action === "steer" || s.data.lander.status !== "flying",
      },
    ];
  if (phase === "surface")
    return moon
      ? [
          {
            title: "Explore the lunar surface",
            text: "The lander stays at touchdown and a small rover can drive nearby. Use WASD or arrows, Space to brake, C to change camera, and scroll or pinch in orbit view to zoom.",
            explain: true,
          },
          {
            title: "Drive the lunar rover",
            text: "Hold W or the touch forward arrow to drive a short distance. Steering and braking consume battery power.",
            done: (s) => s.data.rover.distance > 1,
          },
          {
            title: "Collect a lunar observation",
            text: "Use either instrument. It takes time and electrical energy.",
            target: "station-science",
            done: (s) => !!s.data.scanId || s.data.observations.length > 0,
          },
          {
            title: "Return the science",
            text: "Collect both required observations and transmit them. Only acknowledged data completes the mission.",
            target: "station-transmit",
            done: (s) => s.data.transmitting || s.data.transmitted.length > 0,
          },
        ]
      : [
          {
            title: "Rover exploration",
            text: "WASD/arrows drive; Space brakes. E observes a nearby site; C cycles chase / inspect / map cameras. The minimap shows sites and stored science.",
            explain: true,
          },
          {
            title: "Drive a short distance",
            text: "Hold W or the touch forward arrow. Reach at least one metre.",
            done: (s) => s.data.rover.distance > 1,
          },
          {
            title: "Brake",
            text: "Press Space or release the drive control and stop before observing.",
            done: (s) =>
              s.data.rover.distance > 1 && Math.abs(s.data.rover.speed) < 0.1,
          },
          {
            title: "Reach a science site",
            text: "Drive within 6 m of a marked target. Earth-command mode can queue an autonomous route instead.",
            target: "science-objectives",
            done: (s) =>
              Math.min(
                ...(s.data.demo
                  ? [{ x: 8, z: -16 }]
                  : [
                      { x: 12, z: -28 },
                      { x: -32, z: -56 },
                      { x: 28, z: -85 },
                    ]
                ).map((t) =>
                  Math.hypot(t.x - s.data.rover.x, t.z - s.data.rover.z),
                ),
              ) <= 6,
          },
          {
            title: "Collect an observation",
            text: "Use E or Collect observation. Watch the instrument load and progress.",
            target: "collect-science",
            done: (s) => !!s.data.scanId || s.data.observations.length > 0,
          },
          {
            title: "Transmit stored science",
            text: "Use Transmit. The real scientific delay is displayed; the command timeline is compressed.",
            target: "transmit-science",
            done: (s) => s.data.transmitting || s.data.transmitted.length > 0,
          },
        ];
  if (phase === "orbit")
    return asteroid
      ? [
          {
            title: "Asteroid proximity operations",
            text: "No Mars gravity or drag here. WASD controls pitch/yaw, Q/E roll, arrows translate with RCS; Space brakes. Approach assist uses the same propellant-consuming controls.",
            explain: true,
          },
          {
            title: "Reach the science corridor",
            text: "Fly slowly toward the marker, or enable Approach assist. Stop within 5 m at less than 0.35 m/s.",
            target: "approach-assist",
            done: (s) => sampleCorridor(s.data.orbital),
          },
          {
            title: "Scan and sample",
            text: "Collect the spectrum, then use the sampling arm. Both need stable proximity and energy.",
            target: "orbital-science",
            done: (s) => s.data.observations.length === 2,
          },
          {
            title: "Downlink your discoveries",
            text: "Transmit the stored results to complete this fictional VY-26 mission.",
            target: "orbital-transmit",
            done: (s) => s.data.transmitting || s.data.stage === "debrief",
          },
        ]
      : [
          {
            title: "Deploy a science satellite",
            text: "The provider placed you in a simplified 400 km circular orbit. Local attitude controls use fuel-consuming thrusters: W/S pitch, A/D yaw, Q/E roll; Space stabilizes.",
            explain: true,
          },
          {
            title: "Stabilize and deploy",
            text: "Release WASD and keep stabilization on. Deploy when angles are within 7° and angular rates below 0.04 rad/s.",
            target: "deploy-satellite",
            done: (s) => s.data.orbital.deployed,
          },
          {
            title: "Make an Earth observation",
            text: "Use the camera after the panels are deployed and attitude is stable.",
            target: "orbital-science",
            done: (s) => s.data.observations.length > 0,
          },
          {
            title: "Transmit to mission control",
            text: "Downlink the observation. Completion requires acknowledgment.",
            target: "orbital-transmit",
            done: (s) => s.data.transmitting || s.data.stage === "debrief",
          },
        ];
  return [];
}
export function replayTutorial() {
  const s = useGame.getState();
  s.open(null);
  useGame.setState({ paused: false });
  s.setTutorial({
    enabled: true,
    phase: "",
    step: 0,
    hold: false,
    action: "",
    completed: s.tutorial.completed.filter(
      (p) =>
        p !== s.data.stage && p !== s.data.stage + ":" + s.data.destination,
    ),
  });
}
export default function Tutorial() {
  const s = useGame(),
    t = s.tutorial,
    phase = s.data.stage;
  const steps = useMemo(
    () =>
      stepsFor(
        phase,
        s.data.destination === "moon",
        !installed(s.data.design, "body"),
        s.data.destination === "asteroid",
      ),
    [phase, s.data.destination],
  );
  const completionKey =
    phase === "briefing" ? phase : phase + ":" + s.data.destination;
  const active =
      t.enabled && steps.length > 0 && !t.completed.includes(completionKey),
    step = steps[t.step] ?? steps[0];
  const finish = () =>
    s.setTutorial({
      completed: [...new Set([...t.completed, completionKey])],
      hold: false,
      phase: "",
      step: 0,
      action: "",
    });
  useEffect(() => {
    if (active && t.phase !== phase)
      s.setTutorial({
        phase,
        destination: s.data.destination,
        step: 0,
        action: "",
        hold: !!steps[0]?.explain,
        completed: t.phase
          ? [
              ...new Set([
                ...t.completed,
                t.phase === "briefing"
                  ? "briefing"
                  : t.phase + ":" + t.destination,
              ]),
            ]
          : t.completed,
      });
    else if (!active && t.hold) s.setTutorial({ hold: false });
  }, [active, phase, t.phase]);
  useEffect(() => {
    if (!active || t.phase !== phase) return;
    if (t.hold !== !!step?.explain) s.setTutorial({ hold: !!step?.explain });
    if (step?.done?.(s)) {
      if (t.step >= steps.length - 1) finish();
      else s.setTutorial({ step: t.step + 1, action: "" });
    }
  }, [s.data, s.workshop, s.settings, t.step, t.action, t.phase, active]);
  useEffect(() => {
    if (!active || !step?.target) return;
    const target = document.querySelector(`[data-tutorial="${step.target}"]`);
    target?.classList.add("tutorial-highlight");
    if (target instanceof HTMLElement)
      target.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: useGame.getState().settings.reducedMotion ? "auto" : "smooth",
      });
    return () => target?.classList.remove("tutorial-highlight");
  }, [active, step?.target, t.step]);
  if (!active || t.phase !== phase || !step) return null;
  return (
    <aside
      className="tutorial-card"
      role="region"
      aria-label="Interactive tutorial"
    >
      <div>
        <span>
          FLIGHT ACADEMY / {t.step + 1} OF {steps.length}
        </span>
        <button
          onClick={() =>
            s.setTutorial({
              enabled: false,
              hold: false,
              completed: [...new Set([...t.completed, completionKey])],
            })
          }
        >
          Skip
        </button>
      </div>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
      <div className="tutorial-buttons">
        <button
          disabled={t.step === 0}
          onClick={() =>
            s.setTutorial({ step: Math.max(0, t.step - 1), action: "" })
          }
        >
          Back
        </button>
        <small>
          {step.explain
            ? "Simulation paused for this explanation"
            : "Perform the highlighted action to continue"}
        </small>
        <button
          disabled={!step.explain}
          onClick={() =>
            t.step >= steps.length - 1
              ? finish()
              : s.setTutorial({ step: t.step + 1, action: "" })
          }
        >
          Next →
        </button>
      </div>
    </aside>
  );
}
