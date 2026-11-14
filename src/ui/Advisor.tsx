import { engineeringAdvice } from '../sim/advisor';
import { useGame } from '../store';

export default function Advisor() {
  const { design, objective, destination } = useGame(s => s.data);
  const advice = engineeringAdvice(design, objective, destination);
  return <details className="engineering-advisor">
    <summary>Engineering advisor · {advice.issues.length ? `${advice.issues.length} checks need attention` : 'preflight checks satisfied'}</summary>
    <p>Local operations estimate: tracked panels produce <b>{advice.generation.toFixed(1)} W</b>; stationary operation with the most demanding installed instrument and downlink consumes <b>{advice.load.toFixed(1)} W</b>.</p>
    <p>{advice.enduranceHours === null ? 'Generation covers this operating profile. Shadows, driving and poor panel alignment can still drain the battery.' : `This profile drains the battery. Full-battery endurance is approximately ${(advice.enduranceHours * 60).toFixed(0)} energy-model minutes. Observe and transmit separately, stop driving, or improve panel alignment.`}</p>
    <ul>{advice.issues.map(issue => <li key={issue.label}><strong>{issue.label}</strong><p>{issue.detail}</p><p>{issue.suggestion}</p></li>)}</ul>
    <small>Deterministic guidance from your design. Fictional hardware; simplified power model. Operations use a compressed energy timeline. This estimate excludes eclipse, terrain loads and cruise.</small>
  </details>;
}
