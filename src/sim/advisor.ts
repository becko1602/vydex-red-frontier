import type { Design, Objective } from '../data/gameBalance';
import { balance, catalogue } from '../data/gameBalance';
import type { DestinationId } from '../data/destinations';
import { installed, parts, partIds } from '../data/workshop';
import { C } from '../data/scienceConstants';
import { preflight, solarPower } from './physics';

/** Planning estimate: stationary, tracked panels, one instrument and downlink.
 * Uses the same local-operation power assumptions as MissionEngine.
 * Excludes driving, eclipse, cruise and terrain loads; never a launch guarantee.
 */
export function engineeringAdvice(design: Design, objective: Objective, destination: DestinationId) {
  const checks = preflight(design, objective, destination);
  const science = partIds.filter(id => ['camera', 'spectrometer', 'drill', 'sampler'].includes(id) && installed(design, id));
  const peakInstrument = Math.max(0, ...science.map(id => parts[id].power));
  const generation = design.solar ? solarPower(destination === 'mars' ? C.marsOrbit : C.earthOrbit, catalogue.solar.area, catalogue.solar.efficiency, 1, destination === 'mars' ? balance.dust : 1) : 0;
  const load = balance.baseW + balance.heaterW + peakInstrument + (design.antenna ? balance.transmissionW : 0);
  const deficit = Math.max(0, load - generation);
  const enduranceHours = deficit > 0 ? (design.battery ? catalogue.battery.capacity : 0) / deficit : null;
  const fixes: Record<string, string> = {
    'Mission budget': 'Remove optional equipment or compare cheaper carriers that support this destination. Recheck fuel reserve after reducing tank fill.',
    'Provider payload': 'Choose a carrier supporting this destination and wet mass, or remove optional payload. Propellant is part of launch mass.',
    'Usable fairing space': 'Choose a wider or taller fairing. Reducing fuel does not shrink the hardware.',
    'Science payload': 'Install the instruments required by this mission objective.',
    'Power + communication': 'Install solar wings, a battery and an antenna; each serves a different function.',
    'Cruise maneuver reserve': 'Install the cruise engine and increase cruise fuel. Added fuel also increases cost and launch mass.',
    'Descent authority': 'Install the descent engine and review descent fuel and payload mass. More fuel improves delta-v but reduces initial thrust-to-weight.',
  };
  return {
    generation, load, enduranceHours,
    issues: checks.filter(c => !c.ok).map(c => ({ ...c, suggestion: fixes[c.label] ?? c.detail })),
    feasible: checks.every(c => c.ok),
  };
}
