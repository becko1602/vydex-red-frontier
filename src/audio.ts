import { engine } from "./sim/game";
import { useGame } from "./store";
import { launchFraction } from "./sim/journey";
import { launchers } from "./data/launchVehicles";
import { input } from "./input";

/**
 * Procedural mission audio (Web Audio API, no sample files).
 *
 * Launch: deluge hiss → ignition → full roar (low rumble + broadband roar +
 * crackle, the characteristic "popping" of large rocket exhaust). Loudness
 * falls with altitude as the air thins, so the sound fades out in near-vacuum,
 * while Max-Q adds buffeting. Staging, booster separation and fairing jettison
 * are pyrotechnic thumps.
 * Landing: roar through thin CO₂ on Mars; on airless bodies only a muffled
 * structure-borne rumble (no sound travels through vacuum).
 * Space: RCS valve clicks; surface: rover drive motors and Martian wind.
 */
type Nodes = {
  ctx: AudioContext;
  master: GainNode;
  rumble: GainNode;
  roar: GainNode;
  roarFilter: BiquadFilterNode;
  crackle: GainNode;
  hiss: GainNode;
  wind: GainNode;
  motor: GainNode;
  motorOsc: OscillatorNode;
};
let n: Nodes | null = null;
const prev = { stage: "", upper: false, booster: false, fairing: false, landed: "", rcs: false, rcsT: 0, beep: -1 };

function noiseBuffer(ctx: AudioContext, seconds: number, kind: "brown" | "white" | "crackle") {
  const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else if (kind === "white") d[i] = w;
    else d[i] = Math.random() < 0.0016 ? (Math.random() * 2 - 1) * (0.6 + Math.random() * 0.4) : 0; // sparse shock pops
  }
  return buf;
}
function loop(ctx: AudioContext, buffer: AudioBuffer) {
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  s.loop = true;
  s.start();
  return s;
}
function init() {
  if (n) return n;
  const ctx = new AudioContext();
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  const brown = noiseBuffer(ctx, 4, "brown"), white = noiseBuffer(ctx, 3, "white"), crack = noiseBuffer(ctx, 2.7, "crackle");
  // Deep rumble felt more than heard.
  const rumble = ctx.createGain();
  rumble.gain.value = 0;
  const lp1 = ctx.createBiquadFilter();
  lp1.type = "lowpass";
  lp1.frequency.value = 90;
  loop(ctx, brown).connect(lp1).connect(rumble).connect(master);
  const sub = ctx.createOscillator();
  sub.frequency.value = 31;
  const subG = ctx.createGain();
  subG.gain.value = 0.35;
  sub.connect(subG).connect(rumble);
  sub.start();
  // Broadband roar.
  const roar = ctx.createGain();
  roar.gain.value = 0;
  const roarFilter = ctx.createBiquadFilter();
  roarFilter.type = "lowpass";
  roarFilter.frequency.value = 900;
  loop(ctx, white).connect(roarFilter).connect(roar).connect(master);
  // Crackle.
  const crackle = ctx.createGain();
  crackle.gain.value = 0;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 700;
  loop(ctx, crack).connect(hp).connect(crackle).connect(master);
  // Deluge / venting hiss.
  const hiss = ctx.createGain();
  hiss.gain.value = 0;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400;
  bp.Q.value = 0.7;
  loop(ctx, white).connect(bp).connect(hiss).connect(master);
  // Martian wind: slowly swept band of noise.
  const wind = ctx.createGain();
  wind.gain.value = 0;
  const wf = ctx.createBiquadFilter();
  wf.type = "bandpass";
  wf.frequency.value = 380;
  wf.Q.value = 1.4;
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoG.gain.value = 180;
  lfo.connect(lfoG).connect(wf.frequency);
  lfo.start();
  loop(ctx, brown).connect(wf).connect(wind).connect(master);
  // Rover drive motors.
  const motor = ctx.createGain();
  motor.gain.value = 0;
  const motorOsc = ctx.createOscillator();
  motorOsc.type = "sawtooth";
  motorOsc.frequency.value = 140;
  const mf = ctx.createBiquadFilter();
  mf.type = "lowpass";
  mf.frequency.value = 700;
  motorOsc.connect(mf).connect(motor).connect(master);
  motorOsc.start();
  n = { ctx, master, rumble, roar, roarFilter, crackle, hiss, wind, motor, motorOsc };
  if (import.meta.env.DEV) {
    const an = ctx.createAnalyser();
    master.connect(an);
    Object.assign(window as object, { __vydexAudioLevel: () => { const a = new Float32Array(an.fftSize); an.getFloatTimeDomainData(a); return Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length); } });
  }
  return n;
}
/** Short pyrotechnic / mechanical thump. */
function thump(strength = 1, pitch = 70) {
  if (!n) return;
  const { ctx, master } = n, t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(pitch * 1.8, t);
  o.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + 0.35);
  g.gain.setValueAtTime(0.9 * strength, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.55);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
  s.buffer = noiseBuffer(ctx, 0.4, "white");
  f.type = "lowpass";
  f.frequency.value = 1500;
  ng.gain.setValueAtTime(0.5 * strength, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  s.connect(f).connect(ng).connect(master);
  s.start(t);
}
function beep(freq = 880, dur = 0.12, vol = 0.18) {
  if (!n) return;
  const { ctx, master } = n, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function valveClick() {
  if (!n) return;
  const { ctx, master } = n, t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuffer(ctx, 0.08, "white");
  f.type = "bandpass";
  f.frequency.value = 3200;
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  s.connect(f).connect(g).connect(master);
  s.start(t);
}
const set = (p: AudioParam, v: number, tau = 0.15) => n && p.setTargetAtTime(v, n.ctx.currentTime, tau);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function update() {
  if (!n) return;
  const ui = useGame.getState(), s = ui.settings, d = engine.data;
  const live = !s.muted && !ui.paused && !ui.settings.inspection && !ui.tutorial.hold && document.visibilityState === "visible";
  set(n.master.gain, s.muted ? 0 : s.volume * 1.4, 0.08);
  let rumble = 0, roar = 0, crackle = 0, hiss = 0, wind = 0, motor = 0, cutoff = 900;
  if (live && d.stage === "launch" && d.launchChecks.every(Boolean)) {
    const p = launchFraction(d), id = d.design.launcher ?? "titan";
    const alt = p < 0.12 ? 0 : 205000 * Math.pow(clamp((p - 0.12) / 0.58), 2.1);
    const air = clamp(1 - alt / 45000);
    const maxQ = Math.max(0, 1 - Math.abs(alt - 11000) / 5000);
    const firing = p > 0.115 && p < 0.7;
    const size = id === "titan" ? 1 : id === "pioneer" ? 0.8 : 0.65;
    if (p > 0.06 && p < 0.2) hiss = 0.35 * (1 - clamp((p - 0.12) / 0.08)); // sound-suppression water
    if (firing) {
      const ramp = clamp((p - 0.115) / 0.02);
      rumble = ramp * size * (0.25 + 0.75 * air) + maxQ * 0.25;
      roar = ramp * size * 0.55 * air;
      crackle = ramp * size * 0.7 * air * clamp(alt / 300 + 0.4);
      cutoff = 500 + 1400 * air;
    }
    // T-minus beeps after the checklist, before ignition.
    const second = Math.floor(d.stageTime);
    if (p < 0.115 && second !== prev.beep) { prev.beep = second; beep(p > 0.1 ? 1320 : 880); }
    const sep = id === "titan" ? 0.49 : 0.38;
    if (launchers[id].boosters && p > 0.38 && !prev.booster) { prev.booster = true; thump(0.8 * air + 0.2, 55); }
    if (p > sep && !prev.upper) { prev.upper = true; thump(0.9, 60); }
    if (p > 0.53 && !prev.fairing) { prev.fairing = true; thump(0.5, 110); }
    if (p < 0.1) prev.booster = prev.upper = prev.fairing = false;
  }
  if (live && d.stage === "landing" && d.landingStarted) {
    const l = d.lander;
    if (l.status === "flying") {
      const th = l.throttle * (d.engineEnabled ? 1 : 0);
      if (d.destination === "mars") { rumble = th * 0.45; roar = th * 0.35; crackle = th * 0.15; cutoff = 650; }
      else { rumble = th * 0.3; cutoff = 160; } // airless: vibration through the structure only
    }
    if (l.status !== "flying" && prev.landed !== l.status) thump(l.status === "safe" ? 0.6 : 1, l.status === "safe" ? 90 : 45);
    prev.landed = l.status;
  } else prev.landed = "";
  if (live && d.stage === "orbit") {
    const firing = !!(input.yaw || input.pitch || input.roll || input.rcsX || input.rcsZ || input.turn || input.forward);
    if (firing && d.cruiseFuel > 0 && performance.now() - prev.rcsT > 140) { prev.rcsT = performance.now(); valveClick(); }
    if (d.destination === "asteroid" && d.engineEnabled && d.throttle > 0 && d.cruiseFuel > 0) { rumble = d.throttle * 0.18; cutoff = 140; }
  }
  if (live && d.stage === "surface") {
    if (d.destination === "mars") wind = 0.12;
    const sp = Math.abs(d.rover.speed);
    motor = clamp(sp / 3) * 0.08;
    n.motorOsc.frequency.setTargetAtTime(110 + sp * 70, n.ctx.currentTime, 0.2);
  }
  set(n.rumble.gain, rumble);
  set(n.roar.gain, roar);
  set(n.crackle.gain, crackle);
  set(n.hiss.gain, hiss, 0.3);
  set(n.wind.gain, wind, 0.8);
  set(n.motor.gain, motor);
  set(n.roarFilter.frequency, cutoff, 0.3);
  prev.stage = d.stage;
}
/** Starts audio on the first user gesture (browser autoplay rules). Returns a cleanup. */
export function startMissionAudio() {
  const unlock = () => {
    try {
      init();
      void n?.ctx.resume();
    } catch {
      /* audio optional */
    }
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  const timer = setInterval(update, 50);
  return () => {
    clearInterval(timer);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    void n?.ctx.close();
    n = null;
  };
}
