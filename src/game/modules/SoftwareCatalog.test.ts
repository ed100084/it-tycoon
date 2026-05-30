import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { SoftwareCatalog } from './SoftwareCatalog';
import { DEFAULT_CONFIG } from '../config/default.config';
import { LicenseStatus, ComplianceRiskLevel } from '../core/types';
import type { GameConfig } from '../core/types';

function buildModule(cfg: GameConfig = DEFAULT_CONFIG) {
  const bus = new EventBus();
  const sw = new SoftwareCatalog();
  sw.init(bus, cfg);
  return { bus, sw };
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

describe('SoftwareCatalog — catalog access', () => {
  it('returns available products for a given year', () => {
    const { sw } = buildModule();
    const products = sw.getAvailableProducts({ year: 2004, month: 1 });
    expect(products.length).toBeGreaterThan(0);
  });

  it('getProduct returns correct product', () => {
    const { sw } = buildModule();
    const product = sw.getProduct('VMWARE_ESX_2');
    expect(product?.vendor).toBe('VMware');
  });

  it('getProduct returns null for unknown id', () => {
    const { sw } = buildModule();
    expect(sw.getProduct('UNKNOWN')).toBeNull();
  });
});

describe('SoftwareCatalog — license purchase', () => {
  it('creates a license', () => {
    const { sw } = buildModule();
    const license = sw.purchaseLicense('CENTOS_3');
    expect(license.productId).toBe('CENTOS_3');
    expect(license.status).toBe(LicenseStatus.Active);
  });

  it('free software has zero annual cost', () => {
    const { sw } = buildModule();
    const license = sw.purchaseLicense('CENTOS_3');
    expect(license.annualCostNTD).toBe(0);
  });

  it('emits software.license_purchased event', () => {
    const { bus, sw } = buildModule();
    const handler = vi.fn();
    bus.subscribe('software.license_purchased', handler);
    sw.purchaseLicense('VMWARE_ESX_2');
    expect(handler).toHaveBeenCalled();
  });

  it('getLicenses returns purchased licenses', () => {
    const { sw } = buildModule();
    sw.purchaseLicense('CENTOS_3');
    sw.purchaseLicense('VMWARE_ESX_2');
    expect(sw.getLicenses()).toHaveLength(2);
  });

  it('throws for unknown product', () => {
    const { sw } = buildModule();
    expect(() => sw.purchaseLicense('UNKNOWN')).toThrow();
  });
});

describe('SoftwareCatalog — license costs', () => {
  it('calculateMonthlyLicenseCost returns zero for all free software', () => {
    const { sw } = buildModule();
    sw.purchaseLicense('CENTOS_3');
    sw.purchaseLicense('BACULA_OSS');
    expect(sw.calculateMonthlyLicenseCost()).toBe(0);
  });

  it('calculateMonthlyLicenseCost includes paid software', () => {
    const { sw } = buildModule();
    sw.purchaseLicense('VMWARE_ESX_2');
    const cost = sw.calculateMonthlyLicenseCost();
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBe(Math.round(75_000 / 12));
  });

  it('emits software.license_fee_due on month end for paid licenses', () => {
    const { bus, sw } = buildModule();
    const handler = vi.fn();
    bus.subscribe('software.license_fee_due', handler);
    sw.purchaseLicense('VMWARE_ESX_2');
    triggerMonthEnd(bus);
    expect(handler).toHaveBeenCalled();
  });
});

describe('SoftwareCatalog — EOS tracking', () => {
  it('emits software.eos_warning when approaching EOS', () => {
    const { bus, sw } = buildModule();
    const handler = vi.fn();
    bus.subscribe('software.eos_warning', handler);
    sw.purchaseLicense('RHEL_3'); // EOS 2010-12; warning fires ≤3 months before
    // Advance to 2010-09 — exactly 3 months before EOS 2010-12
    bus.publish({
      type: 'time.month_end',
      payload: { prevDate: { year: 2010, month: 8 }, newDate: { year: 2010, month: 9 }, totalMonthsElapsed: 128 },
      gameDate: { year: 2010, month: 9 },
      source: 'TimeEngine',
    });
    expect(handler).toHaveBeenCalled();
  });

  it('marks license as EosExpired after EOS date', () => {
    const { bus, sw } = buildModule();
    sw.purchaseLicense('RHEL_3'); // EOS 2010
    // Advance past EOS
    bus.publish({
      type: 'time.month_end',
      payload: { prevDate: { year: 2011, month: 1 }, newDate: { year: 2011, month: 2 }, totalMonthsElapsed: 134 },
      gameDate: { year: 2011, month: 2 },
      source: 'TimeEngine',
    });
    const expired = sw.getEosExpiredLicenses();
    expect(expired.length).toBe(1);
    expect(expired[0].status).toBe(LicenseStatus.EosExpired);
  });

  it('compliance score drops after EOS', () => {
    const { bus, sw } = buildModule();
    const initialScore = sw.getComplianceScore();
    sw.purchaseLicense('RHEL_3');
    // Past EOS by > 1 month
    bus.publish({
      type: 'time.month_end',
      payload: { prevDate: { year: 2011, month: 1 }, newDate: { year: 2011, month: 2 }, totalMonthsElapsed: 134 },
      gameDate: { year: 2011, month: 2 },
      source: 'TimeEngine',
    });
    expect(sw.getComplianceScore()).toBeLessThan(initialScore);
  });

  it('emits software.compliance_changed after EOS', () => {
    const { bus, sw } = buildModule();
    const handler = vi.fn();
    bus.subscribe('software.compliance_changed', handler);
    sw.purchaseLicense('RHEL_3');
    bus.publish({
      type: 'time.month_end',
      payload: { prevDate: { year: 2011, month: 1 }, newDate: { year: 2011, month: 2 }, totalMonthsElapsed: 134 },
      gameDate: { year: 2011, month: 2 },
      source: 'TimeEngine',
    });
    expect(handler).toHaveBeenCalled();
  });
});

describe('SoftwareCatalog — virtualization bonus', () => {
  it('getVirtualizationDensityBonus is 1.0 with no virtualization software', () => {
    const { sw } = buildModule();
    sw.purchaseLicense('CENTOS_3');
    expect(sw.getVirtualizationDensityBonus()).toBe(1.0);
  });

  it('getVirtualizationDensityBonus returns 2.0 with VMware ESX 2', () => {
    const { sw } = buildModule();
    sw.purchaseLicense('VMWARE_ESX_2');
    expect(sw.getVirtualizationDensityBonus()).toBe(2.0);
  });
});

describe('SoftwareCatalog — cancel subscription', () => {
  it('cancels an active license', () => {
    const { sw } = buildModule();
    const license = sw.purchaseLicense('RHEL_3');
    const result = sw.cancelSubscription(license.id);
    expect(result).toBe(true);
    expect(sw.getLicense(license.id)?.status).toBe(LicenseStatus.Cancelled);
  });

  it('does not count cancelled license in monthly cost', () => {
    const { sw } = buildModule();
    const license = sw.purchaseLicense('RHEL_3');
    sw.cancelSubscription(license.id);
    expect(sw.calculateMonthlyLicenseCost()).toBe(0);
  });
});

describe('SoftwareCatalog — serialize/deserialize', () => {
  it('round-trips license state', () => {
    const { sw } = buildModule();
    sw.purchaseLicense('VMWARE_ESX_2');
    sw.purchaseLicense('CENTOS_3');
    const snap = sw.serialize();

    const bus2 = new EventBus();
    const sw2 = new SoftwareCatalog();
    sw2.init(bus2, DEFAULT_CONFIG);
    sw2.deserialize(snap);
    expect(sw2.getLicenses()).toHaveLength(2);
  });
});
