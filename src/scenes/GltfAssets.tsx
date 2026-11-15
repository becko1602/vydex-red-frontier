import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Imported NASA 3D models (public/models, copied unchanged from the originals).
 * Every model is normalised at load: measured with a bounding box, scaled to its
 * real-world size in metres, rotated to the game's forward axis (−Z), centred on
 * X/Z and placed with its lowest point on y = 0. Gameplay physics never reads
 * these meshes; collision stays on the simulation's own simple shapes.
 */
export type ModelId = "perseverance" | "apolloLM" | "calipso" | "ace" | "hdu" | "mobileLauncher";
type Spec = {
  url: string;
  /** Extra files sharing one coordinate frame (multi-part exports). */
  parts?: string[];
  label: string;
  /** Real size in metres along `sizeAxis` of the normalised model. */
  size: number;
  sizeAxis: "x" | "y" | "z" | "max";
  /** Yaw so the model's front faces −Z (game forward). */
  yaw?: number;
  /** Extra rotation applied before measuring (to stand a model upright). */
  pre?: [number, number, number];
  ground?: boolean;
};
export const MODELS: Record<ModelId, Spec> = {
  // Perseverance: 2.9 m long, front (hazcams, arm) on +Z in the file.
  perseverance: { url: "/models/perseverance.glb", label: "Mars 2020 Perseverance Rover", size: 2.9, sizeAxis: "z", yaw: Math.PI, ground: true },
  // Apollo LM: 7.04 m tall with the gear deployed.
  apolloLM: { url: "/models/apollo-lm.glb", label: "Apollo Lunar Module", size: 7.04, sizeAxis: "y", ground: true },
  // CALIPSO (Proteus bus + solar wings): ~9.5 m across the deployed array.
  calipso: { url: "/models/calipso.glb", label: "CALIPSO", size: 9.5, sizeAxis: "max" },
  // ACE: ~1.6 m octagonal bus; span with the deployed panels and booms ~8 m.
  ace: { url: "/models/ace.glb", label: "Advanced Composition Explorer (ACE)", size: 8, sizeAxis: "max" },
  // NASA Habitat Demonstration Unit (two files, same frame): ~5.8 m across the core module.
  hdu: { url: "/models/hdu-part1.glb", parts: ["/models/hdu-part2.glb"], label: "Habitat Demonstration Unit", size: 12, sizeAxis: "max", ground: true },
  // SLS Mobile Launcher ML-1: base deck + 116 m umbilical tower (≈118 m overall).
  mobileLauncher: { url: "/models/mobile-launcher.glb", label: "SLS Mobile Launcher", size: 118, sizeAxis: "y", ground: true },
};
const DRACO = "/draco/";
export function preloadModels(ids: ModelId[]) {
  for (const id of ids) for (const u of [MODELS[id].url, ...(MODELS[id].parts ?? [])]) useGLTF.preload(u, DRACO);
}

/** Visible error in the 3D view instead of a silent placeholder. */
class ModelBoundary extends Component<{ label: string; children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Html center zIndexRange={[20, 10]}>
        <div className="model-error" role="alert">
          <b>3D model failed to load</b>
          <span>{this.props.label}</span>
          <small>{this.state.error.slice(0, 160)}</small>
        </div>
      </Html>
    );
  }
}

export type LoadedModel = {
  root: THREE.Group;
  /** Original glTF scene clone (named nodes are reachable via getObjectByName). */
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
};
function useNormalised(id: ModelId): LoadedModel {
  const spec = MODELS[id];
  const all = useGLTF([spec.url, ...(spec.parts ?? [])], DRACO) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }[];
  const gltf = all[0];
  return useMemo(() => {
    const scene = new THREE.Group();
    for (const g of all) scene.add(cloneSkinned(g.scene));
    // Drop exporter cameras/lights baked into some files (e.g. CALIPSO).
    const junk: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera) junk.push(o);
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        // Keep the authored PBR materials; just make sure textures use correct colour spaces.
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats as THREE.MeshStandardMaterial[]) {
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          for (const t of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap]) if (t) t.anisotropy = 8;
          mat.envMapIntensity = 1;
        }
      }
    });
    junk.forEach((o) => o.parent?.remove(o));
    const inner = new THREE.Group();
    inner.add(scene);
    if (spec.pre) inner.rotation.set(...spec.pre);
    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner), dim = box.getSize(new THREE.Vector3());
    const measured = spec.sizeAxis === "max" ? Math.max(dim.x, dim.y, dim.z) : dim[spec.sizeAxis];
    const k = measured > 0 ? spec.size / measured : 1;
    const centre = box.getCenter(new THREE.Vector3());
    const root = new THREE.Group();
    const scaler = new THREE.Group();
    scaler.scale.setScalar(k);
    scaler.position.set(-centre.x * k, spec.ground ? -box.min.y * k : -centre.y * k, -centre.z * k);
    scaler.add(inner);
    const yawG = new THREE.Group();
    yawG.rotation.y = spec.yaw ?? 0;
    yawG.add(scaler);
    root.add(yawG);
    root.name = `model:${id}`;
    return { root, scene, animations: gltf.animations };
  }, [gltf, spec, all]);
}

/** Renders a normalised model; `onReady` receives it for rigging (animations, node control). */
function ModelInner({ id, onReady }: { id: ModelId; onReady?: (m: LoadedModel) => void }) {
  const model = useNormalised(id);
  useEffect(() => {
    onReady?.(model);
  }, [model, onReady]);
  return <primitive object={model.root} />;
}
export function GltfModel({ id, onReady }: { id: ModelId; onReady?: (m: LoadedModel) => void }) {
  return (
    <ModelBoundary label={MODELS[id].label}>
      <Suspense fallback={null}>
        <ModelInner id={id} onReady={onReady} />
      </Suspense>
    </ModelBoundary>
  );
}
