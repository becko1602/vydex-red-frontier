import { describe, it, expect } from 'vitest';
import { engineeringAdvice } from './advisor';
import { missionStarter } from '../data/workshop';

describe('engineering advisor', () => {
  it('uses destination-dependent solar power and deterministic inputs without mutating designs', () => {
    const design = missionStarter('mars', 'geology');
    const before = JSON.stringify(design);
    const mars = engineeringAdvice(design, 'geology', 'mars');
    const earth = engineeringAdvice(design, 'geology', 'earth');
    expect(mars.generation).toBeLessThan(earth.generation);
    expect(mars.load).toBe(158);
    expect(mars).toEqual(engineeringAdvice(design, 'geology', 'mars'));
    expect(JSON.stringify(design)).toBe(before);
  });
  it('reports missing power hardware and finite battery depletion', () => {
    const design = missionStarter('earth', 'imaging');
    design.solar = false;
    const result = engineeringAdvice(design, 'imaging', 'earth');
    expect(result.generation).toBe(0);
    expect(result.enduranceHours).toBe(600 / result.load);
    expect(result.issues.some(x => x.label === 'Power + communication')).toBe(true);
    design.battery = false;
    expect(engineeringAdvice(design, 'imaging', 'earth').enduranceHours).toBe(0);
  });
  it('explains unsupported launch services and does not promise mission success', () => {
    const design = missionStarter('mars', 'imaging');
    design.launcher = 'scout';
    const result = engineeringAdvice(design, 'imaging', 'mars');
    expect(result.feasible).toBe(false);
    expect(result.issues.find(x => x.label === 'Provider payload')?.suggestion).toContain('destination');
  });
});
