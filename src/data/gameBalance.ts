// All values in this file are FICTIONAL EDUCATIONAL GAME PARAMETERS, not NASA hardware or real prices.
export type Instrument = "camera" | "spectrometer" | "drill" | "sampler" | "probe";
export type Objective = "imaging" | "geology";
export type StructuralPart =
  | "body"
  | "tank"
  | "computer"
  | "connector"
  | "cruise"
  | "cruiseEngine"
  | "descentEngine"
  | "legs"
  | "rover"
  | "sampler"
  | "probe";
export type Design = {
  launcher?: import("./launchVehicles").LauncherId;
  parts?: Partial<Record<StructuralPart, boolean>>;
  camera: boolean;
  spectrometer: boolean;
  drill: boolean;
  solar: boolean;
  battery: boolean;
  antenna: boolean;
  cruiseFuel: number;
  descentFuel: number;
};
export const catalogue = {
  core: { name: "Lander + solar rover", credits: 35, mass: 350, power: 20 },
  cruise: { name: "Cruise module", credits: 10, mass: 100, power: 0 },
  cruiseEngine: { name: "Cruise engine", credits: 5, mass: 20, isp: 320 },
  descentEngine: {
    name: "Descent engine",
    credits: 7,
    mass: 25,
    thrust: 8000,
    isp: 220,
  },
  solar: {
    name: "Solar wings",
    credits: 5,
    mass: 12,
    power: 0,
    area: 2,
    efficiency: 0.25,
  },
  battery: {
    name: "Battery pack",
    credits: 5,
    mass: 15,
    power: 0,
    capacity: 600,
  },
  antenna: { name: "High-gain antenna", credits: 4, mass: 5, power: 30 },
  camera: { name: "Survey camera", credits: 3, mass: 3, power: 10 },
  spectrometer: { name: "Spectrometer", credits: 6, mass: 8, power: 25 },
  drill: { name: "Core sample drill", credits: 8, mass: 15, power: 100 },
  sampler: { name: "Asteroid sampling arm", credits: 8, mass: 12, power: 75 },
  probe: { name: "Atmospheric entry probe", credits: 9, mass: 120, power: 40 },
};
export const balance = {
  budget: 112,
  providerCost: 10,
  payloadLimit: 1200,
  cruiseFuelPrice: 0.04,
  descentFuelPrice: 0.05,
  drivingW: 80,
  baseW: 20,
  heaterW: 8,
  transmissionW: 30,
  dust: 0.72,
  Cd: 1.3,
  dragArea: 7,
  safeVertical: 3,
  safeHorizontal: 2,
  safeTilt: 12,
  seed: 42026,
};
// Budget raised 100→112 to support full geology kit + launch provider (111.8 credits).
export const starter = (objective: Objective): Design => ({
  camera: objective === "imaging",
  spectrometer: objective === "geology",
  drill: objective === "geology",
  solar: true,
  battery: true,
  antenna: true,
  cruiseFuel: 220,
  descentFuel: 160,
});
export const targets = [
  {
    id: "01",
    name: "THE SENTINEL",
    subtitle: "Fractured basalt outcrop",
    x: 12,
    z: -28,
    instrument: "camera" as Instrument,
    result:
      "Angular fractures cross a dark, volcanic-looking surface. Fictional observation; texture alone cannot establish composition.",
  },
  {
    id: "02",
    name: "ECHO RIDGE",
    subtitle: "Layered sediment exposure",
    x: -32,
    z: -56,
    instrument: "spectrometer" as Instrument,
    result:
      "A simulated iron-bearing mineral signature is stored. Educational result, not an actual measurement from Mars.",
  },
  {
    id: "03",
    name: "PALE BASIN",
    subtitle: "Sheltered sample deposit",
    x: 28,
    z: -85,
    instrument: "drill" as Instrument,
    result:
      "A shallow fictional core reveals alternating fine and coarse grains. No inference of life is made.",
  },
];
export const demoTarget = { ...targets[0], x: 8, z: -16 };
export const requiredTargets = (objective: Objective, demo = false) =>
  demo
    ? [demoTarget]
    : targets.map((t) => ({
        ...t,
        instrument:
          objective === "imaging"
            ? ("camera" as Instrument)
            : t.id === "03"
              ? ("drill" as Instrument)
              : ("spectrometer" as Instrument),
      }));

export const equipmentDetails: Partial<Record<keyof typeof catalogue, string>> =
  {
    camera:
      "Photographs surface textures and fractures. Required for Imaging Survey. Draws 10 W during an 8-second observation; does not identify life or composition.",
    spectrometer:
      "Records a fictional mineral spectrum. Required at two Geological Survey sites. Uses 25 W for each 8-second reading.",
    drill:
      "Collects a fictional shallow core at Pale Basin. Required for Geological Survey. Uses 100 W for 12 seconds; its 15 kg also increases landing fuel demand.",
    solar:
      "Two square metres at 25% efficiency. Generates about 211 W in this scenario when tracking the Sun; fixed orientation can reduce output. Charges the battery automatically.",
    battery:
      "Stores up to 600 Wh; mission starts with 480 Wh. Driving, heaters, instruments and the antenna draw from the same reserve. Low-charge protection preserves recoverability.",
    antenna:
      "Required to return observations to Earth. Transmission adds 30 W for a compressed 6-second acknowledgment. Also receives queued Earth commands.",
  };
