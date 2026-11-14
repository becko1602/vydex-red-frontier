import { engine } from "./sim/game";
import { useGame } from "./store";
import {
  parts,
  installed,
  changePart,
  compatibility,
  type PartId,
} from "./data/workshop";
export function fitPart(id: PartId, attach = true) {
  const issue = compatibility(
    engine.data.design,
    id,
    engine.data.destination,
    attach,
  );
  if (issue) {
    useGame.getState().setWorkshop({ selected: id, message: issue });
    engine.explain(issue);
    return false;
  }
  engine.data.design = changePart(engine.data.design, id, attach);
  if (id === "battery") engine.data.battery = attach ? 480 : 0;
  if (id === "tank") {
    engine.data.cruiseFuel = attach ? engine.data.design.cruiseFuel : 0;
    engine.data.lander.fuel = attach ? engine.data.design.descentFuel : 0;
  }
  const message =
    parts[id].name +
    (attach ? " attached at " : " removed from ") +
    parts[id].slot +
    ". Mass and mission resources recalculated.";
  useGame.getState().setWorkshop({ selected: id, message });
  useGame
    .getState()
    .setTutorial({ action: (attach ? "attach:" : "remove:") + id });
  engine.explain(message);
  useGame.getState().sync();
  return true;
}
export const togglePart = (id: PartId) =>
  fitPart(id, !installed(engine.data.design, id));
