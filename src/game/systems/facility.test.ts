import { describe, it, expect } from 'vitest';
import {
  createDefaultFacilityRegions,
  calcTotalRackCapacity,
  calcUnlockedRegionCount,
  calcCrossRegionMultiplier,
  calcRegionUnlockReady,
  calcRegionExpansionCost,
  calcUsedRackUnits,
  calcFreeRackUnits,
  calcRackUtilization,
  canInstallHardware,
} from './facility';

describe('createDefaultFacilityRegions', () => {
  it('starts with only the north region unlocked', () => {
    const regions = createDefaultFacilityRegions();
    expect(regions.north.unlocked).toBe(true);
    expect(regions.central.unlocked).toBe(false);
    expect(regions.south.unlocked).toBe(false);
    expect(regions.north.capacity).toBe(100);
  });
});

describe('rack capacity and cross-region bonus', () => {
  it('only counts unlocked regions toward total capacity', () => {
    const regions = createDefaultFacilityRegions();
    expect(calcTotalRackCapacity(regions)).toBe(100);
  });

  it('gives no cross-region bonus with a single region', () => {
    const regions = createDefaultFacilityRegions();
    expect(calcUnlockedRegionCount(regions)).toBe(1);
    expect(calcCrossRegionMultiplier(regions)).toBe(1);
  });

  it('grants +25% CPS once two regions are unlocked', () => {
    const regions = createDefaultFacilityRegions();
    regions.central.unlocked = true;
    expect(calcUnlockedRegionCount(regions)).toBe(2);
    expect(calcCrossRegionMultiplier(regions)).toBeCloseTo(1.25, 6);
    expect(calcTotalRackCapacity(regions)).toBe(600);
  });
});

describe('rack usage', () => {
  it('sums U size across owned hardware', () => {
    // T0 uSize 2 * 3 owned = 6
    expect(calcUsedRackUnits({ T0: { owned: 3, upgradeLevel: 1 } })).toBe(6);
  });

  it('ignores unknown ids and non-positive counts', () => {
    expect(
      calcUsedRackUnits({ T0: { owned: 0, upgradeLevel: 1 }, LEGACY: { owned: 10, upgradeLevel: 1 } })
    ).toBe(0);
  });

  it('computes free units and clamps at zero', () => {
    expect(calcFreeRackUnits({ T0: { owned: 3, upgradeLevel: 1 } }, 100)).toBe(94);
    expect(calcFreeRackUnits({ T5: { owned: 2, upgradeLevel: 1 } }, 100)).toBe(0);
  });

  it('reports utilization and treats zero capacity as full', () => {
    expect(calcRackUtilization({ T0: { owned: 25, upgradeLevel: 1 } }, 100)).toBeCloseTo(0.5, 6);
    expect(calcRackUtilization({}, 0)).toBe(1);
  });
});

describe('canInstallHardware', () => {
  it('allows installs that fit within free capacity', () => {
    expect(canInstallHardware('T5', 1, {}, 100)).toBe(true); // uSize 100
    expect(canInstallHardware('T5', 2, {}, 100)).toBe(false);
  });

  it('rejects unknown ids and non-positive quantities', () => {
    expect(canInstallHardware('NOPE', 1, {}, 100)).toBe(false);
    expect(canInstallHardware('T0', 0, {}, 100)).toBe(false);
  });
});

describe('region unlock gating', () => {
  it('requires the previous region and enough deployed units', () => {
    const regions = createDefaultFacilityRegions();
    // central needs 85U used; T5 = 100U
    expect(calcRegionUnlockReady('central', { T5: { owned: 1, upgradeLevel: 1 } }, regions)).toBe(true);
    expect(calcRegionUnlockReady('central', { T0: { owned: 1, upgradeLevel: 1 } }, regions)).toBe(false);
    // south is gated behind central being unlocked
    expect(calcRegionUnlockReady('south', { T5: { owned: 10, upgradeLevel: 1 } }, regions)).toBe(false);
  });
});

describe('calcRegionExpansionCost', () => {
  it('grows by the expansion cost factor per expansion', () => {
    const regions = createDefaultFacilityRegions();
    expect(calcRegionExpansionCost('north', regions)).toBe(15000);
    regions.north.expansionCount = 1;
    // ceil(15000 * 1.75) = 26250
    expect(calcRegionExpansionCost('north', regions)).toBe(26250);
  });
});
