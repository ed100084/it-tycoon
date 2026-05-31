import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { CustomerEngine } from './CustomerEngine';
import { DEFAULT_CONFIG } from '../config/default.config';

function build() {
  const bus = new EventBus();
  const ce = new CustomerEngine();
  ce.init(bus, DEFAULT_CONFIG);
  return { bus, ce };
}

function advanceMonths(bus: EventBus, months: number, startYear = 2000, startMonth = 1) {
  let y = startYear; let m = startMonth;
  for (let i = 0; i < months; i++) {
    m++; if (m > 12) { m = 1; y++; }
    bus.publish({ type: 'time.month_end', payload: { newDate: { year: y, month: m } }, source: 'test', gameDate: { year: y, month: m } });
  }
}

describe('CustomerEngine — initial state', () => {
  it('1. starts with no customers', () => {
    const { ce } = build();
    expect(ce.getCustomers()).toHaveLength(0);
  });

  it('2. getActiveCustomers empty initially', () => {
    const { ce } = build();
    expect(ce.getActiveCustomers()).toHaveLength(0);
  });

  it('3. getCustomerCount returns 0 initially', () => {
    const { ce } = build();
    expect(ce.getCustomerCount()).toBe(0);
  });
});

describe('CustomerEngine — acquireCustomer', () => {
  it('4. acquireCustomer returns a customer', () => {
    const { ce } = build();
    const c = ce.acquireCustomer(0, 'contract-1');
    expect(c).not.toBeNull();
    expect(c!.status).toBe('active');
  });

  it('5. acquired customer appears in getCustomers()', () => {
    const { ce } = build();
    ce.acquireCustomer(0, 'c1');
    expect(ce.getCustomers()).toHaveLength(1);
  });

  it('6. acquiring same customer twice (by name) reuses existing', () => {
    const { ce } = build();
    const c1 = ce.acquireCustomer(0, 'c1');
    const c2 = ce.acquireCustomer(0, 'c2');
    expect(c1!.id).toBe(c2!.id);
  });

  it('7. acquiring different templates creates separate customers', () => {
    const { ce } = build();
    ce.acquireCustomer(0, 'c1');
    ce.acquireCustomer(1, 'c2');
    expect(ce.getCustomers()).toHaveLength(2);
  });

  it('8. acquireCustomer fires customer.acquired event', () => {
    const { bus, ce } = build();
    const events: unknown[] = [];
    bus.subscribe('customer.acquired', (e) => events.push(e));
    ce.acquireCustomer(2, 'c3');
    expect(events).toHaveLength(1);
  });
});

describe('CustomerEngine — churn', () => {
  it('9. churnCustomer sets status to churned', () => {
    const { ce } = build();
    const c = ce.acquireCustomer(0, 'c1');
    ce.churnCustomer(c!.id);
    expect(ce.getCustomerById(c!.id)!.status).toBe('churned');
  });

  it('10. churned customer not in getActiveCustomers()', () => {
    const { ce } = build();
    const c = ce.acquireCustomer(0, 'c1');
    ce.churnCustomer(c!.id);
    expect(ce.getActiveCustomers()).toHaveLength(0);
  });

  it('11. churning fires customer.churned event', () => {
    const { bus, ce } = build();
    const events: unknown[] = [];
    bus.subscribe('customer.churned', (e) => events.push(e));
    const c = ce.acquireCustomer(3, 'c1');
    ce.churnCustomer(c!.id);
    expect(events).toHaveLength(1);
  });

  it('12. XL customer churn applies larger penalty payload', () => {
    const { bus, ce } = build();
    let penalty = 0;
    bus.subscribe('customer.churned', (e) => {
      penalty = (e.payload as { reputationPenalty: number }).reputationPenalty;
    });
    // Template 0 = 台北市政府 = XL
    const c = ce.acquireCustomer(0, 'c1');
    ce.churnCustomer(c!.id);
    expect(penalty).toBeGreaterThanOrEqual(5);
  });
});

describe('CustomerEngine — loyalty', () => {
  it('13. updateLoyalty increases loyaltyScore', () => {
    const { ce } = build();
    const c = ce.acquireCustomer(0, 'c1');
    const before = c!.loyaltyScore;
    ce.updateLoyalty(c!.id, 10);
    expect(ce.getCustomerById(c!.id)!.loyaltyScore).toBe(before + 10);
  });

  it('14. loyaltyScore capped at 100', () => {
    const { ce } = build();
    const c = ce.acquireCustomer(0, 'c1');
    ce.updateLoyalty(c!.id, 200);
    expect(ce.getCustomerById(c!.id)!.loyaltyScore).toBe(100);
  });

  it('15. loyaltyScore minimum 0', () => {
    const { ce } = build();
    const c = ce.acquireCustomer(0, 'c1');
    ce.updateLoyalty(c!.id, -500);
    expect(ce.getCustomerById(c!.id)!.loyaltyScore).toBe(0);
  });
});

describe('CustomerEngine — monthsAsCustomer aging', () => {
  it('16. monthsAsCustomer increments each month', () => {
    const { bus, ce } = build();
    ce.acquireCustomer(4, 'c1');
    advanceMonths(bus, 3);
    expect(ce.getActiveCustomers()[0].monthsAsCustomer).toBe(3);
  });
});

describe('CustomerEngine — serialize / deserialize', () => {
  it('17. round-trip preserves customers', () => {
    const { ce } = build();
    ce.acquireCustomer(0, 'c1');
    ce.acquireCustomer(1, 'c2');
    const saved = ce.serialize();

    const bus2 = new EventBus();
    const ce2 = new CustomerEngine();
    ce2.init(bus2, DEFAULT_CONFIG);
    ce2.deserialize(saved);
    expect(ce2.getCustomers()).toHaveLength(2);
  });

  it('18. getCustomerTemplates returns 20 templates', () => {
    const { ce } = build();
    expect(ce.getCustomerTemplates()).toHaveLength(20);
  });
});
