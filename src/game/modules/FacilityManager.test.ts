import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { FacilityManager } from './FacilityManager';
import { DEFAULT_CONFIG } from '../config/default.config';
import { FacilityRegion, CoolingLevel, ClimateRisk } from '../core/types';
import type { GameConfig } from '../core/types';

function buildModule(cfg: GameConfig = DEFAULT_CONFIG) {
  const bus = new EventBus();
  const fm = new FacilityManager();
  fm.init(bus, cfg);
  return { bus, fm };
}

function triggerMonthEnd(bus: EventBus, year = 2000, month = 1) {
  const prevDate = { year, month };
  const newMonth = month === 12 ? 1 : month + 1;
  const newYear = month === 12 ? year + 1 : year;
  bus.publish({
    type: 'time.month_end',
    payload: { prevDate, newDate: { year: newYear, month: newMonth }, totalMonthsElapsed: 1 },
    gameDate: { year: newYear, month: newMonth },
    source: 'TimeEngine',
  });
}

describe('FacilityManager — initial state', () => {
  it('initialises with North region unlocked', () => {
    const { fm } = buildModule();
    const north = fm.getRegion(FacilityRegion.North);
    expect(north?.isUnlocked).toBe(true);
  });

  it('initialises Central and South as locked', () => {
    const { fm } = buildModule();
    expect(fm.getRegion(FacilityRegion.Central)?.isUnlocked).toBe(false);
    expect(fm.getRegion(FacilityRegion.South)?.isUnlocked).toBe(false);
  });

  it('North starts with 100 units', () => {
    const { fm } = buildModule();
    expect(fm.getRegion(FacilityRegion.North)?.totalUnits).toBe(100);
  });

  it('North starts with Open cooling (PUE 2.00)', () => {
    const { fm } = buildModule();
    const north = fm.getRegion(FacilityRegion.North);
    expect(north?.coolingLevel).toBe(CoolingLevel.Open);
    expect(north?.pue).toBe(2.00);
  });

  it('getRegions returns all 3 regions', () => {
    const { fm } = buildModule();
    expect(fm.getRegions()).toHaveLength(3);
  });

  it('initial electricity is zero (no hardware)', () => {
    const { fm } = buildModule();
    expect(fm.estimateMonthlyElectricity(FacilityRegion.North)).toBe(0);
  });

  it('initial geo redundancy is false', () => {
    const { fm } = buildModule();
    expect(fm.hasGeoRedundancy()).toBe(false);
  });
});

describe('FacilityManager — hardware events', () => {
  it('updates usedUnits on hardware.installed', () => {
    const { bus, fm } = buildModule();
    bus.publish({
      type: 'hardware.installed',
      payload: { assetId: 'a1', region: FacilityRegion.North, watts: 300, units: 2 },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    expect(fm.getUsedUnits(FacilityRegion.North)).toBe(2);
  });

  it('updates totalWatts on hardware.installed', () => {
    const { bus, fm } = buildModule();
    bus.publish({
      type: 'hardware.installed',
      payload: { assetId: 'a1', region: FacilityRegion.North, watts: 500, units: 1 },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    expect(fm.getRegion(FacilityRegion.North)?.totalWatts).toBe(500);
  });

  it('decreases usedUnits on hardware.removed', () => {
    const { bus, fm } = buildModule();
    bus.publish({
      type: 'hardware.installed',
      payload: { assetId: 'a1', region: FacilityRegion.North, watts: 300, units: 4 },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    bus.publish({
      type: 'hardware.removed',
      payload: { assetId: 'a1', region: FacilityRegion.North, watts: 300, units: 4 },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    expect(fm.getUsedUnits(FacilityRegion.North)).toBe(0);
  });

  it('calculates utilization rate after hardware install', () => {
    const { bus, fm } = buildModule();
    bus.publish({
      type: 'hardware.installed',
      payload: { assetId: 'a1', region: FacilityRegion.North, watts: 300, units: 50 },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    expect(fm.getRegion(FacilityRegion.North)?.utilizationRate).toBeCloseTo(0.5);
  });
});

describe('FacilityManager — electricity calculation', () => {
  it('calculates electricity after hardware install', () => {
    const { bus, fm } = buildModule();
    bus.publish({
      type: 'hardware.installed',
      payload: { assetId: 'a1', region: FacilityRegion.North, watts: 1000, units: 1 },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    const elec = fm.estimateMonthlyElectricity(FacilityRegion.North);
    // 1000W * 744h / 1000 * 2.5 NT$/kWh * PUE 2.0 = 3720
    expect(elec).toBeGreaterThan(0);
  });

  it('emits facility.electricity_due on month end', () => {
    const { bus, fm } = buildModule();
    bus.publish({
      type: 'hardware.installed',
      payload: { assetId: 'a1', region: FacilityRegion.North, watts: 1000, units: 1 },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    const handler = vi.fn();
    bus.subscribe('facility.electricity_due', handler);
    triggerMonthEnd(bus);
    expect(handler).toHaveBeenCalled();
  });

  it('getTotalMonthlyElectricity sums all unlocked regions', () => {
    const { bus, fm } = buildModule();
    bus.publish({
      type: 'hardware.installed',
      payload: { assetId: 'a1', region: FacilityRegion.North, watts: 1000, units: 1 },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    expect(fm.getTotalMonthlyElectricity()).toEqual(fm.estimateMonthlyElectricity(FacilityRegion.North));
  });
});

describe('FacilityManager — cooling upgrade', () => {
  it('upgrades cooling level to BasicAC (available in 2000)', () => {
    const { fm } = buildModule();
    const result = fm.upgradeCooling(FacilityRegion.North, CoolingLevel.BasicAC);
    expect(result).toBe(true);
    expect(fm.getRegion(FacilityRegion.North)?.coolingLevel).toBe(CoolingLevel.BasicAC);
  });

  it('rejects downgrade from BasicAC to Open', () => {
    const { fm } = buildModule();
    fm.upgradeCooling(FacilityRegion.North, CoolingLevel.BasicAC);
    const result = fm.upgradeCooling(FacilityRegion.North, CoolingLevel.Open);
    expect(result).toBe(false);
  });

  it('rejects upgrade to HotAisle before year 2002', () => {
    const { fm } = buildModule(); // starts at year 2000
    const result = fm.upgradeCooling(FacilityRegion.North, CoolingLevel.HotAisle);
    expect(result).toBe(false);
  });

  it('emits facility.cooling_upgraded event', () => {
    const { bus, fm } = buildModule();
    const handler = vi.fn();
    bus.subscribe('facility.cooling_upgraded', handler);
    fm.upgradeCooling(FacilityRegion.North, CoolingLevel.BasicAC);
    expect(handler).toHaveBeenCalled();
  });

  it('hasCoolingLevel returns true when BasicAC reached', () => {
    const { fm } = buildModule();
    fm.upgradeCooling(FacilityRegion.North, CoolingLevel.BasicAC);
    expect(fm.hasCoolingLevel(CoolingLevel.BasicAC)).toBe(true);
  });
});

describe('FacilityManager — capacity expansion', () => {
  it('increases total units by 50%', () => {
    const { fm } = buildModule();
    const before = fm.getRegion(FacilityRegion.North)!.totalUnits;
    fm.expandCapacity(FacilityRegion.North);
    const after = fm.getRegion(FacilityRegion.North)!.totalUnits;
    expect(after).toBe(before + Math.floor(before * 0.5));
  });

  it('rejects expansion on locked region', () => {
    const { fm } = buildModule();
    const result = fm.expandCapacity(FacilityRegion.Central);
    expect(result).toBe(false);
  });

  it('emits facility.expansion_completed event', () => {
    const { bus, fm } = buildModule();
    const handler = vi.fn();
    bus.subscribe('facility.expansion_completed', handler);
    fm.expandCapacity(FacilityRegion.North);
    expect(handler).toHaveBeenCalled();
  });
});

describe('FacilityManager — region unlock', () => {
  it('unlockRegion unlocks a locked region', () => {
    const { fm } = buildModule();
    fm.unlockRegion(FacilityRegion.Central);
    expect(fm.getRegion(FacilityRegion.Central)?.isUnlocked).toBe(true);
  });

  it('returns false when already unlocked', () => {
    const { fm } = buildModule();
    expect(fm.unlockRegion(FacilityRegion.North)).toBe(false);
  });

  it('emits facility.region_unlocked event', () => {
    const { bus, fm } = buildModule();
    const handler = vi.fn();
    bus.subscribe('facility.region_unlocked', handler);
    fm.unlockRegion(FacilityRegion.Central);
    expect(handler).toHaveBeenCalled();
  });
});

describe('FacilityManager — serialize/deserialize', () => {
  it('round-trips state correctly', () => {
    const { fm } = buildModule();
    fm.upgradeCooling(FacilityRegion.North, CoolingLevel.BasicAC); // available in 2000
    fm.expandCapacity(FacilityRegion.North);
    const snap = fm.serialize();

    const bus2 = new EventBus();
    const fm2 = new FacilityManager();
    fm2.init(bus2, DEFAULT_CONFIG);
    fm2.deserialize(snap);

    expect(fm2.getRegion(FacilityRegion.North)?.coolingLevel).toBe(CoolingLevel.BasicAC);
    expect(fm2.getRegion(FacilityRegion.North)?.expansionCount).toBe(1);
  });
});
