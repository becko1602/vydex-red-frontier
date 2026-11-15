import { useEffect, useRef, useState } from "react";
import { useGame } from "../store";
import { engine, BASE_POSITION, sunElevation } from "../sim/game";
import { roverFx } from "../scenes/Models";

/** Records the 3D view (WebGL canvas) to a WebM file with MediaRecorder. */
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const rec = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]), started = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const stop = () => rec.current?.state === "recording" && rec.current.stop();
  const start = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(".scene canvas");
    if (!canvas || typeof MediaRecorder === "undefined") {
      engine.explain("Video capture is not supported in this browser.");
      return;
    }
    const stream = canvas.captureStream(30);
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const r = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6_000_000 } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      roverFx.recording = false;
      setRecording(false);
      const blob = new Blob(chunks.current, { type: type || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vydex-${engine.data.destination}-sol-video-${Date.now()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      engine.explain(`Video saved: ${((Date.now() - started.current) / 1000).toFixed(0)} s of mast-camera footage (${(blob.size / 1e6).toFixed(1)} MB). On a real rover it would queue for downlink.`);
    };
    r.start(500);
    rec.current = r;
    started.current = Date.now();
    roverFx.recording = true;
    setRecording(true);
    engine.explain("Recording video from the rover camera view. Press V again to stop and save.");
  };
  const toggle = () => (rec.current?.state === "recording" ? stop() : start());
  useEffect(() => {
    const h = () => toggle();
    window.addEventListener("vydex:record", h);
    return () => {
      window.removeEventListener("vydex:record", h);
      stop();
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((Date.now() - started.current) / 1000), 250);
    return () => clearInterval(id);
  }, [recording]);
  return { recording, toggle, elapsed };
}
export default function RoverOps() {
  const d = useGame((s) => s.data), act = useGame((s) => s.act);
  const { recording, toggle, elapsed } = useRecorder();
  const nearest = engine.nearest();
  const inRange = nearest && nearest.distance <= 6;
  const busy = !!d.scanId || d.transmitting;
  const el = sunElevation(d.solTime);
  const hours = (d.solTime * 24.66 + 24.66) % 24.66;
  const baseDist = Math.hypot(d.rover.x - BASE_POSITION.x, d.rover.z - BASE_POSITION.z);
  const scanTarget = engine.targets().find((t) => t.instrument !== "drill" && !d.observations.includes(t.id) && Math.hypot(t.x - d.rover.x, t.z - d.rover.z) <= 6);
  const drillTarget = engine.targets().find((t) => t.instrument === "drill" && !d.observations.includes(t.id) && Math.hypot(t.x - d.rover.x, t.z - d.rover.z) <= 6);
  return (
    <div className="rover-operations">
      {recording && (
        <div className="rec-badge">
          <i /> REC {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")}
        </div>
      )}
      <div className="rover-ops" role="group" aria-label="Rover operations">
        <button disabled={busy || !scanTarget} onClick={() => act(() => scanTarget && engine.interact(scanTarget.id))} title="Laser/optical scan of the nearest target (camera or spectrometer)">
          Scan<kbd>E</kbd>
        </button>
        <button disabled={busy || !drillTarget} onClick={() => act(() => drillTarget && engine.interact(drillTarget.id))} title="Deploy the arm and drill a core sample">
          Sample<kbd>E</kbd>
        </button>
        <button disabled={busy} onClick={() => act(() => engine.inspect())} title="Hazard-camera inspection of the nearest rock / ground">
          Inspect<kbd>I</kbd>
        </button>
        <button disabled={busy || !d.observations.some((id) => !d.transmitted.includes(id))} onClick={() => act(() => engine.transmit())} title="Downlink stored observations (via the base relay when docked)">
          Transmit<kbd>T</kbd>
        </button>
        <button className={engine.lightsOn() ? "on" : ""} onClick={() => act(() => engine.cycleHeadlights())} title="Headlights: auto / on / off">
          Lights {d.headlights}<kbd>L</kbd>
        </button>
        <button className={recording ? "on" : ""} onClick={toggle} title="Record the camera view to a video file">
          {recording ? "Stop video" : "Record video"}<kbd>V</kbd>
        </button>
      </div>
      <button className="btn secondary" style={{ width: "100%" }} disabled={!d.docked} onClick={() => act(() => engine.serviceAtBase())}>
        {d.docked ? "Service at base: swap parts & clean panels (B)" : `Surface base ${baseDist.toFixed(0)} m away`}
      </button>
      <div className="sol-clock">
        <span>LOCAL TIME {String(Math.floor(hours)).padStart(2, "0")}:{String(Math.floor((hours % 1) * 60)).padStart(2, "0")}</span>
        <span>{el > 0.05 ? `SUN ${(Math.asin(Math.max(-1, Math.min(1, el))) * 57.3).toFixed(0)}°` : "NIGHT"}</span>
        <span>{d.docked ? "DOCKED · +260 W" : inRange ? `${nearest.id} IN RANGE` : ""}</span>
      </div>
    </div>
  );
}
