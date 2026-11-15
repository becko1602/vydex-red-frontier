import { useState } from "react";
import { Keyboard, ChevronDown } from "lucide-react";
import TouchControls from "./TouchDrive";

const KEYS: [string, string][] = [
  ["W A S D", "Drive / steer"],
  ["Space", "Brake"],
  ["E", "Scan / sample nearest target"],
  ["I", "Inspect (hazard camera)"],
  ["T", "Transmit observations"],
  ["L", "Headlights auto / on / off"],
  ["V", "Record video"],
  ["B", "Service at surface base"],
  ["C", "Camera mode"],
  ["Esc", "Pause"],
];
const read = () => {
  try {
    return localStorage.getItem("vydex-drive-help") === "open";
  } catch {
    return false;
  }
};
/** Collapsible rover key reference + on-screen drive pad. Closed by default so it never blocks the view. */
export default function DriveHelp() {
  const [open, setOpen] = useState(read);
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem("vydex-drive-help", open ? "closed" : "open");
    } catch {}
  };
  return (
    <div className={`drive-help ${open ? "open" : ""}`}>
      <button className="drive-help-toggle" onClick={toggle} aria-expanded={open}>
        <Keyboard size={14} /> Controls <ChevronDown size={14} className="chev" />
      </button>
      {open && (
        <div className="drive-help-body">
          <dl>
            {KEYS.map(([k, v]) => (
              <div key={k}>
                <dt>{k.split(" ").map((x) => <kbd key={x}>{x}</kbd>)}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <TouchControls />
        </div>
      )}
    </div>
  );
}
