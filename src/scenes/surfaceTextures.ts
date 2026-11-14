import * as THREE from "three";
import { seeded } from "../sim/physics";
export function makeSurfaceTextures(moon = false) {
  const size = 512,
    random = seeded(4042),
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!,
    image = context.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const ripple =
        Math.sin(x * 0.13 + Math.sin(y * 0.025) * 3) * 3 +
        Math.sin(x * 0.37 + y * 0.1) * 1.5;
      const grain = (random() - 0.5) * 28;
      const i = (y * size + x) * 4;
      image.data[i] = (moon ? 149 : 169) + (moon ? 0 : ripple) + grain;
      image.data[i + 1] =
        (moon ? 147 : 113) + (moon ? 0 : ripple * 0.8) + grain * 0.7;
      image.data[i + 2] =
        (moon ? 143 : 78) + (moon ? 0 : ripple * 0.6) + grain * 0.6;
      image.data[i + 3] = 255;
    }
  context.putImageData(image, 0, 0);
  const color = new THREE.CanvasTexture(canvas);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.repeat.set(38, 38);
  color.anisotropy = 4;
  const bump = color.clone();
  bump.colorSpace = THREE.NoColorSpace;
  bump.needsUpdate = true;
  return {
    color,
    bump,
    dispose() {
      color.dispose();
      bump.dispose();
    },
  };
}
