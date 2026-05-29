import { describe, it, expect } from 'vitest';
import {
  calcPrestigeReputationGain,
  calcReputationMultiplier,
  calcPrestigeInfluenceGain,
  calcInfluenceMultiplier,
} from './prestige';

describe('calcPrestigeReputationGain', () => {
  it('returns 0 below the tier-1 threshold', () => {
    expect(calcPrestigeReputationGain(1e9)).toBe(0);
    expect(calcPrestigeReputationGain(9.99e9)).toBe(0);
  });

  it('returns 1 exactly at the threshold', () => {
    expect(calcPrestigeReputationGain(1e10)).toBe(1);
  });

  it('scales with the square root of compute over threshold', () => {
    expect(calcPrestigeReputationGain(4e10)).toBe(2);
    expect(calcPrestigeReputationGain(9e10)).toBe(3);
  });

  it('applies the tech reputation multiplier', () => {
    expect(calcPrestigeReputationGain(1e10, 2)).toBe(2);
  });

  it('guards against non-finite input', () => {
    expect(calcPrestigeReputationGain(NaN)).toBe(0);
  });
});

describe('calcReputationMultiplier', () => {
  it('is 1 with no reputation', () => {
    expect(calcReputationMultiplier(0)).toBe(1);
    expect(calcReputationMultiplier(-5)).toBe(1);
  });

  it('adds 2% CPS per reputation point', () => {
    expect(calcReputationMultiplier(10)).toBeCloseTo(1.2, 6);
  });
});

describe('calcPrestigeInfluenceGain', () => {
  it('returns 0 below the tier-2 threshold', () => {
    expect(calcPrestigeInfluenceGain(499)).toBe(0);
  });

  it('returns the square-root gain at and above the threshold', () => {
    // floor(sqrt(500 / 100)) = floor(2.236) = 2
    expect(calcPrestigeInfluenceGain(500)).toBe(2);
    // floor(sqrt(900 / 100)) = 3
    expect(calcPrestigeInfluenceGain(900)).toBe(3);
  });
});

describe('calcInfluenceMultiplier', () => {
  it('is 1 with no influence', () => {
    expect(calcInfluenceMultiplier(0)).toBe(1);
  });

  it('adds 5% CPS per influence point', () => {
    expect(calcInfluenceMultiplier(4)).toBeCloseTo(1.2, 6);
  });
});
