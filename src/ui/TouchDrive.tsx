import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { input } from "../input";
import { useGame } from "../store";
export default function TouchControls({
  landing = false,
}: {
  landing?: boolean;
}) {
  function hold(key: keyof typeof input, value: number | boolean) {
    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        Object.assign(input, { [key]: value });
        useGame.getState().setTutorial({ action: "steer" });
      },
      onPointerUp: () =>
        Object.assign(input, { [key]: typeof value === "boolean" ? false : 0 }),
      onPointerCancel: () =>
        Object.assign(input, { [key]: typeof value === "boolean" ? false : 0 }),
    };
  }
  return (
    <div className="touch-controls">
      <button
        aria-label="Drive forward"
        {...hold(landing ? "lateralZ" : "forward", landing ? -1 : 1)}
      >
        <ArrowUp size={20} />
      </button>
      <div>
        <button
          aria-label="Steer left"
          {...hold(landing ? "lateralX" : "turn", landing ? -1 : 1)}
        >
          <ArrowLeft size={20} />
        </button>
        <button
          aria-label="Drive reverse"
          {...hold(landing ? "lateralZ" : "forward", landing ? 1 : -1)}
        >
          <ArrowDown size={20} />
        </button>
        <button
          aria-label="Steer right"
          {...hold(landing ? "lateralX" : "turn", landing ? 1 : -1)}
        >
          <ArrowRight size={20} />
        </button>
      </div>
      {!landing && (
        <button
          className="touch-brake"
          aria-label="Brake rover or RCS"
          {...hold("brake", true)}
        >
          BRAKE
        </button>
      )}
    </div>
  );
}
