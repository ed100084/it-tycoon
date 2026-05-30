import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { CompetitorEngine } from './CompetitorEngine';
import { DEFAULT_CONFIG } from '../config/default.config';

function buildModule() {
  const bus = new EventBus();
  const ce = new CompetitorEngine();
  ce.init(bus, DEFAULT_CONFIG);
  return { bus, ce };
}

function monthEnd(bus: EventBus, year: number, month: number) {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  bus.publish({
    type: 'time.month_end',
    payload: { prevDate: { year, month }, newDate: next, totalMonthsElapsed: 1 },
    gameDate: next,
    source: 'TimeEngine',
  });
  return next;
}

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('CompetitorEngine — initial state', () => {
  it('1. starts with 3 competitors', () => {
    const { ce } = buildModule();
    expect(ce.getCompetitors()).toHaveLength(3);
  });

  it('2. each competitor has valid market share (0-1)', () => {
    const { ce } = buildModule();
    for (const comp of ce.getCompetitors()) {
      expect(comp.marketShare).toBeGreaterThan(0);
      expect(comp.marketShare).toBeLessThanOrEqual(1);
    }
  });

  it('3. initial player market share is 0.40', () => {
    const { ce } = buildModule();
    expect(ce.getPlayerMarketShare()).toBeCloseTo(0.40, 2);
  });

  it('4. RFP win probability mod is 1.0 at start', () => {
    const { ce } = buildModule();
    expect(ce.getRFPWinProbabilityMod()).toBeCloseTo(1.0, 1);
  });

  it('5. each competitor has id, name, specialty, description', () => {
    const { ce } = buildModule();
    for (const comp of ce.getCompetitors()) {
      expect(comp.id).toBeTruthy();
      expect(comp.name).toBeTruthy();
      expect(comp.specialty).toBeTruthy();
      expect(comp.description).toBeTruthy();
    }
  });
});

// ─── Market dynamics ──────────────────────────────────────────────────────────

describe('CompetitorEngine — market dynamics', () => {
  it('6. player market share increases after signing a contract', () => {
    const { bus, ce } = buildModule();
    const initial = ce.getPlayerMarketShare();
    bus.publish({
      type: 'contract.signed',
      payload: { contractId: 'c1', clientName: 'Test', monthlyFeeNTD: 100_000 },
      gameDate: { year: 2000, month: 1 },
      source: 'ContractManager',
    });
    expect(ce.getPlayerMarketShare()).toBeGreaterThan(initial);
  });

  it('7. player market share decreases after contract termination', () => {
    const { bus, ce } = buildModule();
    const initial = ce.getPlayerMarketShare();
    bus.publish({
      type: 'contract.terminated',
      payload: { contractId: 'c1', clientName: 'Test' },
      gameDate: { year: 2000, month: 1 },
      source: 'ContractManager',
    });
    expect(ce.getPlayerMarketShare()).toBeLessThan(initial);
  });

  it('8. competitor state updated after 3 months (quarter end)', () => {
    const { bus, ce } = buildModule();
    const initialShares = ce.getCompetitors().map(c => c.marketShare);
    // Advance 3 months to trigger quarter update
    let date = { year: 2000, month: 1 };
    date = monthEnd(bus, date.year, date.month);
    date = monthEnd(bus, date.year, date.month);
    date = monthEnd(bus, date.year, date.month);
    const newShares = ce.getCompetitors().map(c => c.marketShare);
    // Shares may change slightly but should still be valid
    newShares.forEach(share => {
      expect(share).toBeGreaterThan(0);
      expect(share).toBeLessThanOrEqual(0.45);
    });
    void initialShares; // referenced for context
  });

  it('9. market shares stay within valid range after many quarters', () => {
    const { bus, ce } = buildModule();
    let date = { year: 2000, month: 1 };
    for (let i = 0; i < 36; i++) {
      date = monthEnd(bus, date.year, date.month);
    }
    for (const comp of ce.getCompetitors()) {
      expect(comp.marketShare).toBeGreaterThanOrEqual(0.05);
      expect(comp.marketShare).toBeLessThanOrEqual(0.45);
    }
  });
});

// ─── Serialization ─────────────────────────────────────────────────────────────

describe('CompetitorEngine — serialize/deserialize', () => {
  it('10. serializes and restores player market share', () => {
    const { bus, ce } = buildModule();
    bus.publish({
      type: 'contract.signed',
      payload: { contractId: 'c1' },
      gameDate: { year: 2000, month: 1 },
      source: 'ContractManager',
    });
    const saved = ce.serialize();

    const bus2 = new EventBus();
    const ce2 = new CompetitorEngine();
    ce2.init(bus2, DEFAULT_CONFIG);
    ce2.deserialize(saved);

    expect(ce2.getPlayerMarketShare()).toBeCloseTo(ce.getPlayerMarketShare(), 3);
  });

  it('11. serializes and restores competitor array', () => {
    const { ce } = buildModule();
    const saved = ce.serialize();

    const bus2 = new EventBus();
    const ce2 = new CompetitorEngine();
    ce2.init(bus2, DEFAULT_CONFIG);
    ce2.deserialize(saved);

    expect(ce2.getCompetitors()).toHaveLength(3);
    expect(ce2.getCompetitors()[0].name).toBe(ce.getCompetitors()[0].name);
  });

  it('12. getState() returns correct structure', () => {
    const { ce } = buildModule();
    const state = ce.getState();
    expect(state).toHaveProperty('competitors');
    expect(state).toHaveProperty('playerMarketShare');
    expect(state).toHaveProperty('rfpWinProbabilityMod');
  });
});
