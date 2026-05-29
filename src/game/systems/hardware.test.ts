import { describe, it, expect } from 'vitest';
import {
  calcHardwareCost,
  calcBulkCost,
  calcUpgradeCost,
  getUpgradeMultiplier,
  calcHardwareCPS,
  calcHardwarePower,
  computeTickMetrics,
  getHardwareDef,
  getTotalOwnedHardware,
} from './hardware';

describe('calcHardwareCost', () => {
  it('returns base cost for the first unit', () => {
    expect(calcHardwareCost('T0', 0)).toBe(10);
  });

  it('grows by the cost growth factor per owned unit', () => {
    // ceil(10 * 1.15^1) = ceil(11.5) = 12
    expect(calcHardwareCost('T0', 1)).toBe(12);
  });

  it('throws on unknown hardware id', () => {
    expect(() => getHardwareDef('NOPE')).toThrow();
  });
});

describe('calcBulkCost', () => {
  it('matches single cost for a quantity of one', () => {
    expect(calcBulkCost('T0', 0, 1)).toBe(calcHardwareCost('T0', 0));
  });

  it('sums the geometric series for multiple units', () => {
    // cost(0) + cost(1) = 10 + 12 = 22
    expect(calcBulkCost('T0', 0, 2)).toBe(22);
  });
});

describe('upgrades', () => {
  it('computes upgrade cost from base cost and level multiplier', () => {
    // T0 baseCost 10 * UPGRADE_LEVELS[1].costMultiplier 50 = 500
    expect(calcUpgradeCost('T0', 1)).toBe(500);
  });

  it('returns Infinity beyond the max upgrade level', () => {
    expect(calcUpgradeCost('T0', 5)).toBe(Infinity);
  });

  it('maps level to multiplier with a safe fallback', () => {
    expect(getUpgradeMultiplier(1)).toBe(1);
    expect(getUpgradeMultiplier(5)).toBe(100);
    expect(getUpgradeMultiplier(99)).toBe(1);
  });
});

describe('per-hardware production', () => {
  it('scales CPS by owned count and upgrade multiplier', () => {
    expect(calcHardwareCPS('T1', { owned: 2, upgradeLevel: 1 })).toBe(4);
    expect(calcHardwareCPS('T1', { owned: 2, upgradeLevel: 2 })).toBe(8);
  });

  it('produces nothing when none are owned', () => {
    expect(calcHardwareCPS('T1', { owned: 0, upgradeLevel: 1 })).toBe(0);
    expect(calcHardwarePower('T1', { owned: 0, upgradeLevel: 1 }, 2)).toBe(0);
  });

  it('computes power cost from watts, price and PUE', () => {
    // 35 watts * 1 * 0.001 price * 2.0 PUE = 0.07
    expect(calcHardwarePower('T0', { owned: 1, upgradeLevel: 1 }, 2)).toBeCloseTo(0.07, 6);
  });
});

describe('computeTickMetrics', () => {
  it('matches the documented T0 net at PUE 2.0', () => {
    const metrics = computeTickMetrics({ T0: { owned: 1, upgradeLevel: 1 } }, 0);
    expect(metrics.totalCPS).toBeCloseTo(0.1, 6);
    expect(metrics.totalPowerCost).toBeCloseTo(0.07, 6);
    expect(metrics.netCPS).toBeCloseTo(0.03, 6);
  });

  it('applies cps and power multipliers', () => {
    const metrics = computeTickMetrics({ T0: { owned: 1, upgradeLevel: 1 } }, 0, 2, 0.5);
    expect(metrics.totalCPS).toBeCloseTo(0.2, 6);
    expect(metrics.totalPowerCost).toBeCloseTo(0.035, 6);
  });

  it('ignores unknown hardware ids in saved data', () => {
    const metrics = computeTickMetrics(
      { T0: { owned: 1, upgradeLevel: 1 }, LEGACY: { owned: 999, upgradeLevel: 1 } },
      0
    );
    expect(metrics.perHardware.LEGACY).toBeUndefined();
    expect(metrics.totalCPS).toBeCloseTo(0.1, 6);
  });
});

describe('getTotalOwnedHardware', () => {
  it('sums owned units across tiers', () => {
    expect(
      getTotalOwnedHardware({ T0: { owned: 3, upgradeLevel: 1 }, T1: { owned: 2, upgradeLevel: 1 } })
    ).toBe(5);
  });
});
