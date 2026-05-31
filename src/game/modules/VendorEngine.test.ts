import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { VendorEngine } from './VendorEngine';
import { DEFAULT_CONFIG } from '../config/default.config';
import type { VendorId } from '../core/types';

function build() {
  const bus = new EventBus();
  const ve = new VendorEngine();
  ve.init(bus, DEFAULT_CONFIG);
  return { bus, ve };
}

describe('VendorEngine — initial state', () => {
  it('1. starts with 6 vendors', () => {
    const { ve } = build();
    expect(ve.getVendors()).toHaveLength(6);
  });

  it('2. all vendors start at Bronze level', () => {
    const { ve } = build();
    for (const v of ve.getVendors()) {
      expect(v.level).toBe('Bronze');
    }
  });

  it('3. all vendors start with 0 relationship level', () => {
    const { ve } = build();
    for (const v of ve.getVendors()) {
      expect(v.relationshipLevel).toBe(0);
    }
  });

  it('4. all vendors start with 0 discount', () => {
    const { ve } = build();
    for (const v of ve.getVendors()) {
      expect(v.discountRate).toBe(0);
    }
  });

  it('5. no priority delivery at start', () => {
    const { ve } = build();
    expect(ve.hasPriorityDelivery('DELL')).toBe(false);
  });
});

describe('VendorEngine — recordPurchase', () => {
  it('6. recordPurchase updates totalPurchases', () => {
    const { ve } = build();
    ve.recordPurchase('DELL', 2_000_000);
    expect(ve.getVendor('DELL')!.totalPurchases).toBe(2_000_000);
  });

  it('7. 30 points reach Silver level', () => {
    const { ve } = build();
    ve.recordPurchase('CISCO', 30_000_000); // 30 points
    expect(ve.getVendor('CISCO')!.level).toBe('Silver');
  });

  it('8. 60 points reach Gold level', () => {
    const { ve } = build();
    ve.recordPurchase('HPE', 60_000_000);
    expect(ve.getVendor('HPE')!.level).toBe('Gold');
  });

  it('9. Gold level grants 10% discount', () => {
    const { ve } = build();
    ve.recordPurchase('FORTINET', 60_000_000);
    expect(ve.getDiscount('FORTINET')).toBeCloseTo(0.10, 5);
  });

  it('10. 85+ points reach Platinum level', () => {
    const { ve } = build();
    ve.recordPurchase('MICROSOFT', 85_000_000);
    expect(ve.getVendor('MICROSOFT')!.level).toBe('Platinum');
  });

  it('11. Platinum level grants 15% discount', () => {
    const { ve } = build();
    ve.recordPurchase('VMWARE', 85_000_000);
    expect(ve.getDiscount('VMWARE')).toBeCloseTo(0.15, 5);
  });

  it('12. Gold enables priority delivery', () => {
    const { ve } = build();
    ve.recordPurchase('DELL', 60_000_000);
    expect(ve.hasPriorityDelivery('DELL')).toBe(true);
  });

  it('13. level_up event fires on level change', () => {
    const { bus, ve } = build();
    const events: unknown[] = [];
    bus.subscribe('vendor.level_up', (e) => events.push(e));
    ve.recordPurchase('CISCO', 30_000_000);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('14. platinum_unlocked event fires at Platinum', () => {
    const { bus, ve } = build();
    const events: unknown[] = [];
    bus.subscribe('vendor.platinum_unlocked', (e) => events.push(e));
    ve.recordPurchase('CISCO', 85_000_000);
    expect(events).toHaveLength(1);
  });
});

describe('VendorEngine — concentration risk', () => {
  it('15. no concentration risk initially', () => {
    const { ve } = build();
    expect(ve.getConcentrationRisk()).toBeNull();
  });

  it('16. concentration risk detected when one vendor >60%', () => {
    const { ve } = build();
    ve.recordPurchase('DELL', 70_000_000);
    ve.recordPurchase('HPE', 10_000_000);
    ve.recordPurchase('CISCO', 10_000_000);
    const risk = ve.getConcentrationRisk();
    expect(risk).not.toBeNull();
    expect(risk!.vendorId).toBe('DELL');
  });
});

describe('VendorEngine — serialize / deserialize', () => {
  it('17. round-trip preserves vendor state', () => {
    const { ve } = build();
    ve.recordPurchase('DELL', 60_000_000);
    const saved = ve.serialize();

    const bus2 = new EventBus();
    const ve2 = new VendorEngine();
    ve2.init(bus2, DEFAULT_CONFIG);
    ve2.deserialize(saved);
    expect(ve2.getVendor('DELL')!.level).toBe('Gold');
  });

  it('18. getVendor returns null for unknown id', () => {
    const { ve } = build();
    expect(ve.getVendor('UNKNOWN' as VendorId)).toBeNull();
  });
});
