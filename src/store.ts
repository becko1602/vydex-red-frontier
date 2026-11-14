import { create } from "zustand";
import {
  engine,
  encodeSave,
  decodeSave,
  SAVE_KEY,
  type FlightData,
} from "./sim/game";
import type { PartId } from "./data/workshop";
import type { SolarBodyId } from "./data/solarSystem";
export type Settings = {
  flightCamera: "follow" | "cinematic" | "overview";
  cameraShake: boolean;
  flightZoom: number;
  payloadView: boolean;
  inspection: boolean;
  inspectionView: "free" | "front" | "side" | "rear" | "engine";
  componentLabels: boolean;
  fairingEnvelope: boolean;
  stowed: boolean;
  inspectionReset: number;
  quality: "low" | "medium" | "high";
  muted: boolean;
  volume: number;
  reducedMotion: boolean;
  camera: "chase" | "orbit" | "map";
  showOrbits: boolean;
  showLabels: boolean;
  showTrajectory: boolean;
  selectedPlanet: SolarBodyId;
};
export type TutorialState = {
  destination: string;
  enabled: boolean;
  phase: string;
  step: number;
  action: string;
  completed: string[];
  hold: boolean;
};
const tutorialDefaults: TutorialState = {
  destination: "mars",
  enabled: true,
  phase: "",
  step: 0,
  action: "",
  completed: [],
  hold: false,
};
let tutorialSaved: Partial<TutorialState> = {};
try {
  const parsed = JSON.parse(localStorage.getItem("vydex-tutorial-v1") || "{}");
  tutorialSaved = {
    enabled: typeof parsed?.enabled === "boolean" ? parsed.enabled : true,
    completed: Array.isArray(parsed?.completed)
      ? parsed.completed.filter((x: unknown) => typeof x === "string")
      : [],
  };
} catch {}
type UI = {
  thumbnails: Record<string,string>;
  setThumbnail: (id:string, image:string)=>void;
  rocketInfo: string | null;
  setRocketInfo: (key:string|null)=>void;
  workshop: {
    selected: PartId;
    info: PartId | null;
    exploded: boolean;
    message: string;
  };
  setWorkshop: (value: Partial<UI["workshop"]>) => void;
  tutorial: TutorialState;
  setTutorial: (value: Partial<TutorialState>) => void;
  data: FlightData;
  paused: boolean;
  drawer: "sources" | "settings" | "controls" | "observations" | null;
  settings: Settings;
  saveMessage: string;
  sync: () => void;
  act: (fn: () => void) => void;
  pause: () => void;
  open: (d: UI["drawer"]) => void;
  setSettings: (s: Partial<Settings>) => void;
  save: () => void;
  load: () => void;
  erase: () => void;
};
const safeRead = () => {
  try {
    return localStorage.getItem("vydex-settings");
  } catch {
    return null;
  }
};
let savedSettings: Partial<Settings> = {};
try {
  savedSettings = JSON.parse(safeRead() || "{}");
} catch {
  /* Safe defaults */
}
export const useGame = create<UI>((set, get) => ({
  thumbnails: {},
  setThumbnail: (id,image)=>set(s=>({thumbnails:{...s.thumbnails,[id]:image}})),
  rocketInfo: null,
  setRocketInfo: rocketInfo=>set({rocketInfo}),
  workshop: {
    selected: "body",
    info: null,
    exploded: false,
    message: "Select a component to preview its compatible mount.",
  },
  setWorkshop: (value) =>
    set((s) => ({ workshop: { ...s.workshop, ...value } })),
  tutorial: {
    ...tutorialDefaults,
    ...tutorialSaved,
    phase: "",
    step: 0,
    action: "",
    hold: false,
  },
  setTutorial: (value) => {
    const tutorial = { ...get().tutorial, ...value };
    set({ tutorial });
    try {
      localStorage.setItem(
        "vydex-tutorial-v1",
        JSON.stringify({
          enabled: tutorial.enabled,
          completed: tutorial.completed,
        }),
      );
    } catch {}
  },
  data: { ...engine.data, stage: "briefing" },
  paused: false,
  drawer: null,
  settings: {
    flightCamera: "cinematic",
    cameraShake: false,
    flightZoom: 1,
    payloadView: false,
    inspectionView:"free",
    inspectionReset:0,
    componentLabels:false,
    fairingEnvelope:true,
    stowed:true,
    quality: "medium",
    muted: true,
    volume: 0.3,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    camera: "chase",
    showOrbits: true,
    showLabels: true,
    showTrajectory: true,
    selectedPlanet: "mars",
    ...savedSettings,
    inspection:false,
  },
  saveMessage: "",
  sync: () =>
    set({
      data: {
        ...engine.data,
        rover: { ...engine.data.rover },
        lander: { ...engine.data.lander },
        observations: [...engine.data.observations],
        transmitted: [...engine.data.transmitted],
        design: {
          ...engine.data.design,
          parts: engine.data.design.parts
            ? { ...engine.data.design.parts }
            : undefined,
        },
        orbital: { ...engine.data.orbital },
      },
    }),
  act: (fn) => {
    fn();
    get().sync();
  },
  pause: () => set((s) => ({ paused: !s.paused })),
  open: (drawer) => set({ drawer }),
  setSettings: (s) => {
    const settings = { ...get().settings, ...s };
    set({ settings });
    try {
      localStorage.setItem("vydex-settings", JSON.stringify({...settings,inspection:false,inspectionReset:0}));
    } catch {
      /* Storage unavailable */
    }
  },
  save: () => {
    if (engine.data.stage === "briefing") {
      set({
        saveMessage:
          "Start or resume a mission before saving. Existing progress is preserved.",
      });
      return;
    }
    try {
      localStorage.setItem(SAVE_KEY, encodeSave(engine.data));
      set({ saveMessage: "Mission saved on this device" });
    } catch {
      set({ saveMessage: "Device storage unavailable" });
    }
  },
  load: () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY),
        data = raw && decodeSave(raw);
      if (data) {
        engine.data = data;
        set({ paused: false, drawer: null, settings:{...get().settings,inspection:false} });
        get().sync();
      } else set({ saveMessage: "No valid saved mission found" });
    } catch {
      set({ saveMessage: "Unable to read device storage" });
    }
  },
  erase: () => {
    try {
      localStorage.removeItem(SAVE_KEY);
      set({ saveMessage: "Saved mission deleted" });
    } catch {
      set({ saveMessage: "Device storage unavailable" });
    }
  },
}));
