import * as THREE from "three";
import { useGame } from "./store";

/**
 * Shared mouse camera rig for the follow / cinematic cameras.
 * - Wheel: zoom (writes the same flightZoom the slider uses).
 * - Drag (left or right button): orbit around the tracked object like a gyroscope.
 * - Hover: a few degrees of parallax so the view responds to the mouse.
 * Scenes call rigCamera(cam, target) just before lerping the camera.
 */
export const rig = { yaw: 0, pitch: 0, hoverX: 0, hoverY: 0, dragging: false };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
let attached: HTMLElement | null = null;
export function attachCameraRig(el: HTMLElement) {
  if (attached === el) return () => {};
  attached = el;
  let lastX = 0, lastY = 0;
  const wheel = (e: WheelEvent) => {
    const s = useGame.getState();
    if (s.settings.flightCamera === "overview" && !["landing", "surface"].includes(s.data.stage)) return;
    if (["rocket", "assembly", "preflight", "briefing"].includes(s.data.stage)) return;
    const z = clamp((s.settings.flightZoom || 1) * Math.pow(1.0015, e.deltaY), 0.3, 3.5);
    s.setSettings({ flightZoom: z });
  };
  const down = (e: PointerEvent) => {
    rig.dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    rig.hoverX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    rig.hoverY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!rig.dragging) return;
    rig.yaw -= (e.clientX - lastX) * 0.006;
    rig.pitch = clamp(rig.pitch + (e.clientY - lastY) * 0.004, -0.6, 1.1);
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const up = () => (rig.dragging = false);
  const dbl = () => {
    rig.yaw = 0;
    rig.pitch = 0;
  };
  el.addEventListener("wheel", wheel, { passive: true });
  el.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  el.addEventListener("dblclick", dbl);
  return () => {
    attached = null;
    el.removeEventListener("wheel", wheel);
    el.removeEventListener("pointerdown", down);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    el.removeEventListener("dblclick", dbl);
  };
}
const off = new THREE.Vector3(), sph = new THREE.Spherical();
/** Rotates the camera offset around the target by the rig yaw/pitch (+ hover parallax). Mutates cam. */
export function rigCamera(cam: THREE.Vector3, target: THREE.Vector3) {
  if (useGame.getState().settings.reducedMotion && !rig.yaw && !rig.pitch) return cam;
  off.copy(cam).sub(target);
  sph.setFromVector3(off);
  sph.theta += rig.yaw + rig.hoverX * 0.08;
  sph.phi = clamp(sph.phi - rig.pitch - rig.hoverY * 0.05, 0.08, Math.PI - 0.08);
  off.setFromSpherical(sph);
  return cam.copy(target).add(off);
}
