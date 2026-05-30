import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { EventTimeline } from './EventTimeline';
import { DEFAULT_CONFIG } from '../config/default.config';
import { EconomicCycle } from '../core/types';
import type { GameConfig } from '../core/types';

function buildModule(cfg: GameConfig = DEFAULT_CONFIG) {
  const bus = new EventBus();
  const et = new EventTimeline();
  et.init(bus, cfg);
  return { bus, et };
}

function triggerMonthEnd(bus: EventBus, year: number, month: number) {
  const newMonth = month === 12 ? 1 : month + 1;
  const newYear = month === 12 ? year + 1 : year;
  bus.publish({
    type: 'time.month_end',
    payload: { prevDate: { year, month }, newDate: { year: newYear, month: newMonth }, totalMonthsElapsed: 1 },
    gameDate: { year: newYear, month: newMonth },
    source: 'TimeEngine',
  });
}

// Advance to specific date (simulate all months up to target)
function advanceTo(bus: EventBus, targetYear: number, targetMonth: number, startYear = 2000, startMonth = 1) {
  let y = startYear, m = startMonth;
  while (y < targetYear || (y === targetYear && m < targetMonth)) {
    triggerMonthEnd(bus, y, m);
    if (m === 12) { m = 1; y++; } else m++;
  }
}

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('EventTimeline — initial state', () => {
  it('1. no triggered events initially', () => {
    const { et } = buildModule();
    expect(et.getTriggeredEvents()).toHaveLength(0);
  });

  it('2. getUpcomingEvents() returns future historical events', () => {
    const { et } = buildModule();
    // With start date 2000/01, events at 2000/01 (same month) or within next 12 months
    const upcoming = et.getUpcomingEvents(24);
    expect(upcoming.length).toBeGreaterThan(0);
    for (const e of upcoming) {
      expect(e.status).toBe('pending');
    }
  });

  it('3. getEconomicCycle() returns Normal initially', () => {
    const { et } = buildModule();
    expect(et.getEconomicCycle().current).toBe(EconomicCycle.Normal);
  });

  it('4. getExchangeRateMod() returns ~1.0 initially', () => {
    const { et } = buildModule();
    expect(et.getExchangeRateMod()).toBeCloseTo(1.0, 5);
  });

  it('5. getActiveModifiers() is empty initially', () => {
    const { et } = buildModule();
    expect(et.getActiveModifiers()).toHaveLength(0);
  });

  it('6. getPendingDecisions() is empty initially', () => {
    const { et } = buildModule();
    expect(et.getPendingDecisions()).toHaveLength(0);
  });
});

// ─── Historical event triggering ──────────────────────────────────────────────

describe('EventTimeline — Y2K_AFTERMATH (2000/01)', () => {
  // _checkHistoricalEvents matches events at the `newDate` produced by month-end.
  // Y2K_AFTERMATH is at year=2000, month=1.
  // We need newDate = {2000, 1}, so we publish month_end for prev={1999,12}.
  it('7. Y2K_AFTERMATH triggers when month-end arrives at 2000/01', () => {
    const { bus, et } = buildModule();
    bus.publish({
      type: 'time.month_end',
      payload: { prevDate: { year: 1999, month: 12 }, newDate: { year: 2000, month: 1 }, totalMonthsElapsed: 1 },
      gameDate: { year: 2000, month: 1 },
      source: 'TimeEngine',
    });
    const triggered = et.getTriggeredEvents();
    const y2k = triggered.find(e => e.id === 'Y2K_AFTERMATH');
    expect(y2k).toBeDefined();
    expect(y2k?.status).toBe('triggered');
  });

  it('8. timeline.historical_event published when Y2K triggers', () => {
    const { bus } = buildModule();
    const handler = vi.fn();
    bus.subscribe('timeline.historical_event', handler);
    bus.publish({
      type: 'time.month_end',
      payload: { prevDate: { year: 1999, month: 12 }, newDate: { year: 2000, month: 1 }, totalMonthsElapsed: 1 },
      gameDate: { year: 2000, month: 1 },
      source: 'TimeEngine',
    });
    const calls = handler.mock.calls.map((c: unknown[]) => (c[0] as { payload: { id: string } }).payload.id);
    expect(calls).toContain('Y2K_AFTERMATH');
  });
});

describe('EventTimeline — WANNACRY (2017/05)', () => {
  // WANNACRY is at year=2017, month=5. The handler receives `newDate`, so we need
  // newDate={2017,5}, which means we call triggerMonthEnd(bus, 2017, 4).
  // advanceTo brings us to 2017/04 (not inclusive), then we fire the final step.
  it('9. WANNACRY triggers on 2017/05', () => {
    const { bus, et } = buildModule();
    // Advance to just before 2017/05 — last step produces newDate={2017,5}
    advanceTo(bus, 2017, 4);
    triggerMonthEnd(bus, 2017, 4);
    const triggered = et.getTriggeredEvents();
    const wannacry = triggered.find(e => e.id === 'WANNACRY');
    expect(wannacry).toBeDefined();
    expect(wannacry?.triggeredAt?.year).toBe(2017);
    expect(wannacry?.triggeredAt?.month).toBe(5);
  });
});

// ─── DOTCOM_CRASH economic cycle ───────────────────────────────────────────────

describe('EventTimeline — DOTCOM_CRASH (2001/03)', () => {
  // DOTCOM_CRASH is at year=2001, month=3. Need newDate={2001,3}, so
  // the triggering call is triggerMonthEnd(bus, 2001, 2).
  it('10. After DOTCOM_CRASH, active modifiers include the economic cycle change', () => {
    const { bus, et } = buildModule();
    // Advance to newDate = 2001/03
    advanceTo(bus, 2001, 2);
    triggerMonthEnd(bus, 2001, 2);
    // DOTCOM_CRASH forces Recession and adds ClientBudgetMod modifier
    const mods = et.getActiveModifiers();
    const hasBudgetMod = mods.some(m => m.sourceEventId === 'DOTCOM_CRASH');
    expect(hasBudgetMod).toBe(true);
  });

  it('10b. Economic cycle is set to Recession after DOTCOM_CRASH fires', () => {
    const { bus, et } = buildModule();
    advanceTo(bus, 2001, 2);
    triggerMonthEnd(bus, 2001, 2);
    expect(et.getEconomicCycle().current).toBe(EconomicCycle.Recession);
  });
});

// ─── Economic cycle advancement ────────────────────────────────────────────────

describe('EventTimeline — economic cycle', () => {
  it('11. Economic cycle advances after phaseDurationMonths months pass', () => {
    // The initial state hardcodes phaseDurationMonths=12, so we must advance 12+ months.
    // Use a config that won't interfere, but we still need to tick >=12 months.
    const cfg: GameConfig = {
      ...DEFAULT_CONFIG,
      eventTimeline: {
        ...DEFAULT_CONFIG.eventTimeline!,
        economicCycleDurationRange: [12, 12],
        randomEventCooldownRange: [100, 100], // disable random events
      },
    };
    const { bus, et } = buildModule(cfg);
    const initialCycle = et.getEconomicCycle().current; // NORMAL
    // Advance 13 months to guarantee the cycle flips (12 months in phase triggers transition)
    for (let i = 0; i < 13; i++) {
      const m = (i % 12) + 1;
      const y = 2000 + Math.floor(i / 12);
      triggerMonthEnd(bus, y, m);
    }
    const newCycle = et.getEconomicCycle().current;
    expect(newCycle).not.toBe(initialCycle);
  });
});

// ─── getNextHistoricalEvent ────────────────────────────────────────────────────

describe('EventTimeline — getNextHistoricalEvent', () => {
  it('12. returns the nearest upcoming pending event', () => {
    const { et } = buildModule();
    const result = et.getNextHistoricalEvent();
    expect(result).not.toBeNull();
    expect(result!.event.status).toBe('pending');
    expect(result!.monthsAway).toBeGreaterThanOrEqual(0);
    // Y2K_AFTERMATH is at 2000/01 — with current date at 2000/01, monthsAway=0, so it should be the nearest
    expect(result!.monthsAway).toBe(0);
    expect(result!.event.id).toBe('Y2K_AFTERMATH');
  });
});

// ─── makeDecision ─────────────────────────────────────────────────────────────

describe('EventTimeline — makeDecision', () => {
  // NINE_ELEVEN (2001/09) has a decision
  function advanceToNineEleven(bus: EventBus) {
    advanceTo(bus, 2001, 9);
    triggerMonthEnd(bus, 2001, 9);
  }

  it('13. makeDecision with valid id returns DecisionOutcome', () => {
    const { bus, et } = buildModule();
    advanceToNineEleven(bus);
    const decisions = et.getPendingDecisions();
    expect(decisions.length).toBeGreaterThan(0);
    const d = decisions[0];
    const outcome = et.makeDecision(d.id, 0);
    expect(outcome.decisionId).toBe(d.id);
    expect(outcome.optionIndex).toBe(0);
    expect(Array.isArray(outcome.effectsApplied)).toBe(true);
  });

  it('14. makeDecision with invalid id returns outcome with error description', () => {
    const { et } = buildModule();
    const outcome = et.makeDecision('nonexistent-decision-id', 0);
    expect(outcome.decisionId).toBe('nonexistent-decision-id');
    expect(outcome.effectsApplied).toHaveLength(0);
    expect(outcome.description).toBeTruthy();
  });
});

// ─── Serialize / deserialize ───────────────────────────────────────────────────

describe('EventTimeline — serialize/deserialize', () => {
  it('15. roundtrip preserves triggered event count', () => {
    const { bus, et } = buildModule();
    // Trigger Y2K_AFTERMATH
    triggerMonthEnd(bus, 2000, 1);
    const triggeredBefore = et.getTriggeredEvents().length;

    const snap = et.serialize();

    const bus2 = new EventBus();
    const et2 = new EventTimeline();
    et2.init(bus2, DEFAULT_CONFIG);
    et2.deserialize(snap);

    expect(et2.getTriggeredEvents().length).toBe(triggeredBefore);
  });
});

// ─── Exchange rate ─────────────────────────────────────────────────────────────

describe('EventTimeline — exchange rate', () => {
  it('16. exchange rate mod changes after months pass (floating)', () => {
    const { bus, et } = buildModule();
    const initial = et.getExchangeRateMod();
    // Advance several months so the seeded random has a chance to deviate
    for (let m = 1; m <= 10; m++) {
      triggerMonthEnd(bus, 2000, m);
    }
    // With nonzero volatility the mod should drift from 1.0
    const after = et.getExchangeRateMod();
    // It may stay very close but should have changed at least slightly
    // We check it is still a reasonable positive number
    expect(after).toBeGreaterThan(0.9);
    expect(after).toBeLessThan(1.1);
    // And that it is actually tracked (not stuck at exactly 1.0 forever)
    expect(typeof after).toBe('number');
    expect(after).not.toBe(initial); // seeded rand guarantees it moves
  });
});

// ─── getUpcomingEvents window ──────────────────────────────────────────────────

describe('EventTimeline — getUpcomingEvents window filtering', () => {
  it('events outside the window are not returned', () => {
    const { et } = buildModule();
    // With 0-month window from 2000/01, only events at exactly 2000/01 qualify
    const tight = et.getUpcomingEvents(0);
    for (const e of tight) {
      expect(e.year).toBe(2000);
      expect(e.month).toBe(1);
    }
  });

  it('a triggered event is not listed as upcoming', () => {
    const { bus, et } = buildModule();
    triggerMonthEnd(bus, 2000, 1);
    const upcoming = et.getUpcomingEvents(24);
    const hasY2K = upcoming.some(e => e.id === 'Y2K_AFTERMATH');
    expect(hasY2K).toBe(false);
  });
});
