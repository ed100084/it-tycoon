import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { TechDebtEngine } from './TechDebtEngine';
import { TechDebtLevel } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';

function build() {
  const bus = new EventBus();
  const tde = new TechDebtEngine();
  tde.init(bus, DEFAULT_CONFIG);
  return { bus, tde };
}

function monthEnd(bus: EventBus, year = 2000, month = 2) {
  bus.publish({
    type: 'time.month_end',
    payload: { newDate: { year, month } },
    source: 'test',
    gameDate: { year, month },
  });
}

describe('TechDebtEngine — initial state', () => {
  it('1. starts with 0 tech debt points', () => {
    const { tde } = build();
    expect(tde.getTotalPoints()).toBe(0);
  });

  it('2. initial level is Healthy', () => {
    const { tde } = build();
    expect(tde.getLevel()).toBe(TechDebtLevel.Healthy);
  });

  it('3. starts with empty items list', () => {
    const { tde } = build();
    expect(tde.getItems()).toHaveLength(0);
  });
});

describe('TechDebtEngine — addDebt', () => {
  it('4. addDebt increases totalPoints', () => {
    const { tde } = build();
    tde.addDebt('test', 10, 'test debt');
    expect(tde.getTotalPoints()).toBe(10);
  });

  it('5. addDebt adds item to list', () => {
    const { tde } = build();
    tde.addDebt('test', 10, 'test debt');
    expect(tde.getItems()).toHaveLength(1);
    expect(tde.getItems()[0].points).toBe(10);
  });

  it('6. totalPoints capped at maxPoints (100)', () => {
    const { tde } = build();
    tde.addDebt('test', 200, 'overflow');
    expect(tde.getTotalPoints()).toBeLessThanOrEqual(100);
  });

  it('7. level becomes Warning at 31 pts', () => {
    const { tde } = build();
    tde.addDebt('test', 31, 'warning zone');
    expect(tde.getLevel()).toBe(TechDebtLevel.Warning);
  });

  it('8. level becomes Danger at 61 pts', () => {
    const { tde } = build();
    tde.addDebt('test', 61, 'danger zone');
    expect(tde.getLevel()).toBe(TechDebtLevel.Danger);
  });

  it('9. level becomes Critical at 81 pts', () => {
    const { tde } = build();
    tde.addDebt('test', 81, 'critical');
    expect(tde.getLevel()).toBe(TechDebtLevel.Critical);
  });
});

describe('TechDebtEngine — reduceDebt', () => {
  it('10. reduceDebt decreases totalPoints', () => {
    const { tde } = build();
    tde.addDebt('test', 50, 'initial');
    tde.reduceDebt(20);
    expect(tde.getTotalPoints()).toBe(30);
  });

  it('11. reduceDebt does not go below 0', () => {
    const { tde } = build();
    tde.addDebt('test', 10, 'small');
    tde.reduceDebt(100);
    expect(tde.getTotalPoints()).toBe(0);
  });
});

describe('TechDebtEngine — startRefactoring', () => {
  it('12. startRefactoring publishes hardware.purchased event', () => {
    const { bus, tde } = build();
    tde.addDebt('test', 20, 'initial debt');
    const events: unknown[] = [];
    bus.subscribe('hardware.purchased', e => events.push(e));
    tde.startRefactoring(10);
    expect(events).toHaveLength(1);
  });
});

describe('TechDebtEngine — serialize/deserialize', () => {
  it('13. serialize/deserialize preserves totalPoints', () => {
    const { tde } = build();
    tde.addDebt('test', 42, 'persistent');
    const serialized = tde.serialize();
    const tde2 = new TechDebtEngine();
    tde2.init(new EventBus(), DEFAULT_CONFIG);
    tde2.deserialize(serialized);
    expect(tde2.getTotalPoints()).toBe(42);
  });
});

describe('TechDebtEngine — monthly accumulation', () => {
  it('14. publishes techdebt.updated on month_end', () => {
    const { bus, tde } = build();
    const updates: unknown[] = [];
    bus.subscribe('techdebt.updated', e => updates.push(e));
    monthEnd(bus);
    expect(updates.length).toBeGreaterThan(0);
  });
});
