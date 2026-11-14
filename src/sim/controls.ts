import type { Input } from "./game";

// Derive axes from all held keys. Releasing one alias must not release another.
export class DriveKeyboard {
  private held = new Set<string>();
  update(key: string, down: boolean) {
    key = key.toLowerCase();
    if (down) this.held.add(key);
    else this.held.delete(key);
    return this.axes();
  }
  clear() {
    this.held.clear();
  }
  flightAxes(): Input {
    const k=(name:string)=>Number(this.held.has(name));
    return {forward:0,turn:0,brake:!!k(' '),lateralX:0,lateralZ:0,pitch:k('s')-k('w'),yaw:k('a')-k('d'),roll:k('q')-k('e'),throttleChange:k('shift')-k('control'),rcsX:k('arrowright')-k('arrowleft'),rcsZ:k('arrowdown')-k('arrowup')};
  }
  axes(): Input {
    const any = (...keys: string[]) => keys.some((k) => this.held.has(k));
    const forward = Number(any("w", "arrowup")) - Number(any("s", "arrowdown"));
    const turn = Number(any("a", "arrowleft")) - Number(any("d", "arrowright"));
    return {
      pitch:undefined,yaw:undefined,roll:undefined,rcsX:undefined,rcsZ:undefined,throttleChange:0,
      forward,
      turn,
      brake: any(" "),
      lateralX: turn ? -turn : 0,
      lateralZ: forward ? -forward : 0,
    };
  }
}

export function roverView(heading: number) {
  const x = Math.sin(heading),
    z = -Math.cos(heading);
  return {
    modelYaw: -heading,
    forwardX: x,
    forwardZ: z,
    cameraX: -x * 9.5,
    cameraZ: -z * 9.5,
    lookX: x * 2.5,
    lookZ: z * 2.5,
  };
}
