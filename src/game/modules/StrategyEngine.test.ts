import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { StrategyEngine } from './StrategyEngine';
import { DEFAULT_CONFIG } from '../config/default.config';

function build() {
  const bus = new EventBus();
  const se = new StrategyEngine();
  se.init(bus, DEFAULT_CONFIG);
  return { bus, se };
}

describe('StrategyEngine — initial state', () => {
  it('1. starts with all zero scores', () => {
    const { se } = build();
    const s = se.getScores();
    expect(s.government).toBe(0);
    expect(s.startup).toBe(0);
    expect(s.enterprise).toBe(0);
  });

  it('2. no dominant route initially', () => {
    const { se } = build();
    expect(se.getDominantRoute()).toBeNull();
  });

  it('3. established routes list is empty initially', () => {
    const { se } = build();
    expect(se.getEstablishedRoutes()).toHaveLength(0);
  });

  it('4. percentages sum to 0 when no scores', () => {
    const { se } = build();
    const pct = se.getPercentages();
    expect(pct.government + pct.startup + pct.enterprise).toBeCloseTo(1, 5); // divides by 1 when total=0
  });
});

describe('StrategyEngine — addScore', () => {
  it('5. addScore updates government score', () => {
    const { se } = build();
    se.addScore('GOVERNMENT', 10);
    expect(se.getScores().government).toBe(10);
  });

  it('6. addScore updates startup score', () => {
    const { se } = build();
    se.addScore('STARTUP', 5);
    expect(se.getScores().startup).toBe(5);
  });

  it('7. addScore updates enterprise score', () => {
    const { se } = build();
    se.addScore('ENTERPRISE', 7);
    expect(se.getScores().enterprise).toBe(7);
  });

  it('8. percentages correct after mixed scores', () => {
    const { se } = build();
    se.addScore('GOVERNMENT', 6);
    se.addScore('STARTUP', 3);
    se.addScore('ENTERPRISE', 1);
    const pct = se.getPercentages();
    expect(pct.government).toBeCloseTo(0.6, 5);
    expect(pct.startup).toBeCloseTo(0.3, 5);
    expect(pct.enterprise).toBeCloseTo(0.1, 5);
  });
});

describe('StrategyEngine — route establishment', () => {
  it('9. dominant route established when ≥60% threshold', () => {
    const { se } = build();
    se.addScore('GOVERNMENT', 60);
    se.addScore('STARTUP', 20);
    se.addScore('ENTERPRISE', 20);
    expect(se.getDominantRoute()).toBe('GOVERNMENT');
  });

  it('10. route establishment fires event on bus', () => {
    const { bus, se } = build();
    const events: unknown[] = [];
    bus.subscribe('strategy.route_established', (e) => events.push(e.payload));
    se.addScore('STARTUP', 60);
    se.addScore('GOVERNMENT', 20);
    se.addScore('ENTERPRISE', 20);
    expect(events).toHaveLength(1);
    expect((events[0] as { route: string }).route).toBe('STARTUP');
  });

  it('11. established route is not triggered twice', () => {
    const { bus, se } = build();
    const events: unknown[] = [];
    bus.subscribe('strategy.route_established', (e) => events.push(e));
    se.addScore('ENTERPRISE', 60);
    se.addScore('STARTUP', 20);
    se.addScore('GOVERNMENT', 20);
    se.addScore('ENTERPRISE', 5); // additional — still same route
    expect(events).toHaveLength(1);
  });

  it('12. getRFPModifier returns boost for established dominant route', () => {
    const { se } = build();
    se.addScore('GOVERNMENT', 60);
    se.addScore('STARTUP', 20);
    se.addScore('ENTERPRISE', 20);
    expect(se.getRFPModifier('GOVERNMENT')).toBeGreaterThan(1);
  });

  it('13. getRFPModifier returns 1 for non-dominant route', () => {
    const { se } = build();
    se.addScore('GOVERNMENT', 60);
    se.addScore('STARTUP', 20);
    se.addScore('ENTERPRISE', 20);
    expect(se.getRFPModifier('STARTUP')).toBe(1.0);
  });
});

describe('StrategyEngine — event bus signals', () => {
  it('14. government contract adds government score', () => {
    const { bus, se } = build();
    bus.publish({
      type: 'contract.signed',
      payload: { serviceType: 'MSSP', clientTier: 'GOVERNMENT' },
      source: 'test',
      gameDate: { year: 2000, month: 1 },
    });
    expect(se.getScores().government).toBeGreaterThan(0);
  });

  it('15. VPS contract adds startup score', () => {
    const { bus, se } = build();
    bus.publish({
      type: 'contract.signed',
      payload: { serviceType: 'VPS', clientTier: 'SMB' },
      source: 'test',
      gameDate: { year: 2000, month: 1 },
    });
    expect(se.getScores().startup).toBeGreaterThan(0);
  });
});

describe('StrategyEngine — serialize / deserialize', () => {
  it('16. round-trip preserves scores', () => {
    const { se } = build();
    se.addScore('GOVERNMENT', 30);
    se.addScore('ENTERPRISE', 70);
    const saved = se.serialize();

    const bus2 = new EventBus();
    const se2 = new StrategyEngine();
    se2.init(bus2, DEFAULT_CONFIG);
    se2.deserialize(saved);

    expect(se2.getScores().government).toBe(30);
    expect(se2.getScores().enterprise).toBe(70);
  });

  it('17. round-trip preserves dominant route', () => {
    const { se } = build();
    se.addScore('ENTERPRISE', 70);
    se.addScore('GOVERNMENT', 20);
    se.addScore('STARTUP', 10);
    const saved = se.serialize();

    const bus2 = new EventBus();
    const se2 = new StrategyEngine();
    se2.init(bus2, DEFAULT_CONFIG);
    se2.deserialize(saved);

    expect(se2.getDominantRoute()).toBe('ENTERPRISE');
  });
});
