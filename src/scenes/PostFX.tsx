import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { useGame } from "../store";

/**
 * HDR post-processing: physically-motivated bloom on bright sources (Sun,
 * engine plumes, lights, re-entry plasma), SMAA edge anti-aliasing, then
 * ACES tone mapping + sRGB output. Uses the passes bundled with three.js.
 */
export default function PostFX() {
  const { gl, scene, camera, size } = useThree();
  const quality = useGame((s) => s.settings.quality);
  const stage = useGame((s) => s.data.stage);
  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.88);
    c.addPass(bloom);
    c.addPass(new SMAAPass());
    c.addPass(new OutputPass());
    return { c, bloom };
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.c.setPixelRatio(gl.getPixelRatio());
    composer.c.setSize(size.width, size.height);
  }, [composer, size, gl]);
  useEffect(() => () => composer.c.dispose(), [composer]);
  useEffect(() => {
    // Interiors get a soft glow; space and launch scenes get stronger bloom on the Sun and plumes.
    const interior = ["rocket", "assembly", "preflight"].includes(stage);
    composer.bloom.strength = interior ? 0.2 : stage === "launch" ? 0.5 : 0.45;
    composer.bloom.threshold = interior ? 1.1 : 1.0;
  }, [composer, stage]);
  useFrame(() => {
    if (quality === "low") gl.render(scene, camera);
    else composer.c.render();
  }, 1);
  return null;
}
