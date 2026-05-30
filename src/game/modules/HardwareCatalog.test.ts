import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { HardwareCatalog } from './HardwareCatalog';
import { DEFAULT_CONFIG } from '../config/default.config';
import {
  FacilityRegion,
  AssetStatus,
  PurchasePaymentMethod,
  MaintenanceType,
} from '../core/types';
import type { GameConfig } from '../core/types';

function buildModule(cfg: GameConfig = DEFAULT_CONFIG) {
  const bus = new EventBus();
  const hw = new HardwareCatalog();
  hw.init(bus, cfg);
  return { bus, hw };
}

function triggerMonthEnd(bus: EventBus, year = 2000, month = 1) {
  const newMonth = month === 12 ? 1 : month + 1;
  const newYear = month === 12 ? year + 1 : year;
  bus.publish({
    type: 'time.month_end',
    payload: { prevDate: { year, month }, newDate: { year: newYear, month: newMonth }, totalMonthsElapsed: 1 },
    gameDate: { year: newYear, month: newMonth },
    source: 'TimeEngine',
  });
}

describe('HardwareCatalog — catalog access', () => {
  it('returns available models for a given year', () => {
    const { hw } = buildModule();
    const models = hw.getAvailableModels({ year: 2003, month: 1 });
    expect(models.length).toBeGreaterThan(0);
  });

  it('filters out models not yet unlocked', () => {
    const { hw } = buildModule();
    const models = hw.getAvailableModels({ year: 2000, month: 1 });
    expect(models.every(m => m.unlockYear <= 2000)).toBe(true);
  });

  it('getModel returns model by id', () => {
    const { hw } = buildModule();
    const model = hw.getModel('DELL_PE2650');
    expect(model?.name).toBe('Dell PowerEdge 2650');
  });

  it('getModel returns null for unknown id', () => {
    const { hw } = buildModule();
    expect(hw.getModel('UNKNOWN_ID')).toBeNull();
  });
});

describe('HardwareCatalog — purchase', () => {
  it('creates a purchase order', () => {
    const { hw } = buildModule();
    const order = hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    expect(order.modelId).toBe('DELL_PE2650');
    expect(order.quantity).toBe(1);
    expect(order.status).toBe('pending');
  });

  it('creates assets in InTransit status', () => {
    const { hw } = buildModule();
    hw.purchase('DELL_PE2650', 2, FacilityRegion.North, PurchasePaymentMethod.Cash);
    const assets = hw.getAssets();
    expect(assets).toHaveLength(2);
    expect(assets[0].status).toBe(AssetStatus.InTransit);
  });

  it('applies ODM discount', () => {
    const { hw } = buildModule();
    const odm = hw.getModel('SMC_PSCE')!;
    const regular = hw.getModel('DELL_PE1650')!;
    const orderOdm = hw.purchase('SMC_PSCE', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    const orderReg = hw.purchase('DELL_PE1650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    expect(orderOdm.unitPrice).toBeLessThan(orderReg.unitPrice);
    void odm; void regular;
  });

  it('applies requisition discount', () => {
    const { hw } = buildModule();
    const orderCash = hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    const { hw: hw2 } = buildModule();
    const orderReq = hw2.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.RequisitionForm);
    expect(orderReq.unitPrice).toBeLessThan(orderCash.unitPrice);
  });

  it('emits hardware.purchased event', () => {
    const { bus, hw } = buildModule();
    const handler = vi.fn();
    bus.subscribe('hardware.purchased', handler);
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    expect(handler).toHaveBeenCalled();
  });

  it('throws for unknown model id', () => {
    const { hw } = buildModule();
    expect(() => hw.purchase('UNKNOWN', 1, FacilityRegion.North, PurchasePaymentMethod.Cash)).toThrow();
  });
});

describe('HardwareCatalog — delivery & installation', () => {
  it('delivers immediately for cash purchase on next month_end', () => {
    const { bus, hw } = buildModule();
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1);
    const asset = hw.getAssets()[0];
    expect(asset.status).toBe(AssetStatus.Active);
  });

  it('emits hardware.delivered event on delivery', () => {
    const { bus, hw } = buildModule();
    const handler = vi.fn();
    bus.subscribe('hardware.delivered', handler);
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1);
    expect(handler).toHaveBeenCalled();
  });

  it('emits hardware.installed event on delivery', () => {
    const { bus, hw } = buildModule();
    const handler = vi.fn();
    bus.subscribe('hardware.installed', handler);
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1);
    expect(handler).toHaveBeenCalled();
  });

  it('requisition purchase delays delivery by 1 month', () => {
    const { bus, hw } = buildModule();
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.RequisitionForm);
    triggerMonthEnd(bus, 2000, 1); // 1 month later — should not be delivered yet
    const assets = hw.getAssets().filter(a => a.status === AssetStatus.InTransit);
    expect(assets.length).toBe(1);
  });
});

describe('HardwareCatalog — depreciation', () => {
  it('calculates monthly depreciation for active assets', () => {
    const { bus, hw } = buildModule();
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1); // deliver
    const summary = hw.calculateMonthlyDepreciation();
    expect(summary.totalMonthlyDepreciation).toBeGreaterThan(0);
  });

  it('emits hardware.monthly_depreciation event on month end', () => {
    const { bus, hw } = buildModule();
    const handler = vi.fn();
    bus.subscribe('hardware.monthly_depreciation', handler);
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1); // deliver + depreciate
    triggerMonthEnd(bus, 2000, 2);
    expect(handler).toHaveBeenCalled();
  });

  it('reduces book value each month', () => {
    const { bus, hw } = buildModule();
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1);
    const before = hw.getAssets()[0].bookValue;
    triggerMonthEnd(bus, 2000, 2);
    const after = hw.getAssets()[0].bookValue;
    expect(after).toBeLessThan(before);
  });
});

describe('HardwareCatalog — EOL tracking', () => {
  it('getEolWarningAssets returns assets approaching EOL', () => {
    const { bus, hw } = buildModule();
    hw.purchase('DELL_PE1650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1); // deliver
    // Advance to near EOL (2007-12, warning at 2007-09)
    bus.publish({
      type: 'time.month_end',
      payload: { prevDate: { year: 2007, month: 9 }, newDate: { year: 2007, month: 10 }, totalMonthsElapsed: 93 },
      gameDate: { year: 2007, month: 10 },
      source: 'TimeEngine',
    });
    expect(hw.getEolWarningAssets().length).toBeGreaterThan(0);
  });

  it('getFailureRate increases after EOL', () => {
    const { bus, hw } = buildModule();
    hw.purchase('DELL_PE1650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1);
    const asset = hw.getAssets()[0];
    const rateBefore = hw.getFailureRate(asset.id);

    // Force EOL
    asset.isEOL = true;
    asset.monthsSinceEOL = 6;
    const rateAfter = hw.getFailureRate(asset.id);
    expect(rateAfter).toBeGreaterThan(rateBefore);
  });
});

describe('HardwareCatalog — dispose', () => {
  it('marks asset as disposed', () => {
    const { bus, hw } = buildModule();
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1);
    const asset = hw.getAssets()[0];
    hw.dispose(asset.id);
    expect(hw.getAsset(asset.id)?.status).toBe(AssetStatus.Disposed);
  });

  it('emits hardware.removed on dispose of installed asset', () => {
    const { bus, hw } = buildModule();
    const handler = vi.fn();
    bus.subscribe('hardware.removed', handler);
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1);
    const asset = hw.getAssets()[0];
    hw.dispose(asset.id);
    expect(handler).toHaveBeenCalled();
  });

  it('returns salvage value on disposal', () => {
    const { bus, hw } = buildModule();
    hw.purchase('DELL_PE2650', 1, FacilityRegion.North, PurchasePaymentMethod.Cash);
    triggerMonthEnd(bus, 2000, 1);
    const asset = hw.getAssets()[0];
    const result = hw.dispose(asset.id);
    expect(result.salvageValue).toBeGreaterThanOrEqual(0);
  });
});

describe('HardwareCatalog — serialize/deserialize', () => {
  it('round-trips state', () => {
    const { bus, hw } = buildModule();
    hw.purchase('DELL_PE2650', 2, FacilityRegion.North, PurchasePaymentMethod.Cash);
    const snap = hw.serialize();

    const bus2 = new EventBus();
    const hw2 = new HardwareCatalog();
    hw2.init(bus2, DEFAULT_CONFIG);
    hw2.deserialize(snap);
    expect(hw2.getAssets()).toHaveLength(2);
    void bus;
  });
});
