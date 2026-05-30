import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { ReputationEngine } from './ReputationEngine';
import { DEFAULT_CONFIG } from '../config/default.config';
import { CustomerTier, IncidentSeverity, IncidentType } from '../core/types';
import type { GameConfig } from '../core/types';

function buildModule(cfg: GameConfig = DEFAULT_CONFIG) {
  const bus = new EventBus();
  const re = new ReputationEngine();
  re.init(bus, cfg);
  return { bus, re };
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

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('ReputationEngine — initial state', () => {
  it('1. Initial score is 75 (config.initialScore)', () => {
    const { re } = buildModule();
    expect(re.getSatisfactionScore()).toBe(75);
  });

  it('2. getSatisfactionByTier() returns all CustomerTier keys', () => {
    const { re } = buildModule();
    const byTier = re.getSatisfactionByTier();
    const expectedKeys = Object.values(CustomerTier) as string[];
    for (const key of expectedKeys) {
      expect(Object.prototype.hasOwnProperty.call(byTier, key)).toBe(true);
    }
    expect(Object.keys(byTier)).toHaveLength(expectedKeys.length);
  });

  it('3. getSatisfactionHistory() starts empty', () => {
    const { re } = buildModule();
    expect(re.getSatisfactionHistory()).toHaveLength(0);
  });

  it('4. getActiveModifiers() starts empty', () => {
    const { re } = buildModule();
    expect(re.getActiveModifiers()).toHaveLength(0);
  });
});

// ─── getReputationEffects ──────────────────────────────────────────────────────

describe('ReputationEngine — getReputationEffects', () => {
  it('5. at score 75 returns neutral band (rfpFrequencyMod = 1.0)', () => {
    const { re } = buildModule();
    // Default score is 75, which is >= lowSatisfactionThreshold(50) and < highSatisfactionThreshold(80)
    const effects = re.getReputationEffects();
    expect(effects.rfpFrequencyMod).toBe(1.0);
    expect(effects.renewalSuccessRateBonus).toBe(0);
    expect(effects.pricingPower).toBe(0);
    expect(effects.contractLossProbabilityMod).toBe(1.0);
  });

  it('6. getReputationEffects() changes when score >= 80', () => {
    const { re } = buildModule();
    // Force score to 85 via updateContractSatisfaction
    re.updateContractSatisfaction('c1', 10, 'test boost');
    expect(re.getSatisfactionScore()).toBe(85);
    const effects = re.getReputationEffects();
    expect(effects.rfpFrequencyMod).toBeGreaterThan(1.0);
    expect(effects.renewalSuccessRateBonus).toBeGreaterThan(0);
    expect(effects.pricingPower).toBeGreaterThan(0);
    expect(effects.contractLossProbabilityMod).toBeLessThan(1.0);
  });

  it('7. getReputationEffects() changes when score < 50', () => {
    const { re } = buildModule();
    // Drop score below 50
    re.updateContractSatisfaction('c1', -30, 'test penalty');
    expect(re.getSatisfactionScore()).toBeLessThan(50);
    const effects = re.getReputationEffects();
    expect(effects.rfpFrequencyMod).toBeLessThan(1.0);
    expect(effects.renewalSuccessRateBonus).toBeLessThan(0);
    expect(effects.contractLossProbabilityMod).toBeGreaterThan(1.0);
  });
});

// ─── Event-driven score changes ────────────────────────────────────────────────

describe('ReputationEngine — incident resolved', () => {
  // P1 resolved adds a one-time modifier (delta=+3). One-time modifiers are
  // recorded as history/audit trail but are excluded from the month-end delta
  // calculation (only non-one-time modifiers contribute). The score still rises
  // due to natural recovery (+1/month when score < 80 and coverage >= 1.0).
  it('8. security.incident_resolved (P1 success) → modifier is recorded in activeModifiers', () => {
    const { bus, re } = buildModule();
    bus.publish({
      type: 'security.incident_resolved',
      payload: { incidentId: 'inc-1', type: IncidentType.NetworkOutage, severity: IncidentSeverity.P1, downtimeHours: 2 },
      gameDate: { year: 2000, month: 1 },
      source: 'SecurityEngine',
    });
    // Before month-end the one-time modifier should be in activeModifiers
    const mods = re.getActiveModifiers();
    const incMod = mods.find(m => m.description.includes('P1 incident resolved'));
    expect(incMod).toBeDefined();
    expect(incMod!.delta).toBeGreaterThan(0);
    expect(incMod!.isOneTime).toBe(true);
  });
});

describe('ReputationEngine — staff insufficient coverage', () => {
  it('9. staff.insufficient_coverage (ratio 0.6) → active modifier added', () => {
    const { bus, re } = buildModule();
    bus.publish({
      type: 'staff.insufficient_coverage',
      payload: { ratio: 0.6 },
      gameDate: { year: 2000, month: 1 },
      source: 'StaffManager',
    });
    const mods = re.getActiveModifiers();
    expect(mods.length).toBeGreaterThan(0);
    const coverageMod = mods.find(m => m.source === 'coverage_penalty');
    expect(coverageMod).toBeDefined();
    expect(coverageMod!.delta).toBeLessThan(0);
  });
});

describe('ReputationEngine — contract events', () => {
  // contract.terminated / contract.renewed add one-time modifiers as audit trail.
  // They are stored in activeModifiers before month-end but do not affect the
  // monthly-settlement score delta (only non-one-time modifiers are summed).
  it('10. contract.terminated Enterprise → one-time modifier is recorded with negative delta', () => {
    const { bus, re } = buildModule();
    bus.publish({
      type: 'contract.terminated',
      payload: { contractId: 'ctr-1', tier: CustomerTier.Enterprise },
      gameDate: { year: 2000, month: 1 },
      source: 'ContractManager',
    });
    const mods = re.getActiveModifiers();
    const termMod = mods.find(m => m.description.includes('terminated'));
    expect(termMod).toBeDefined();
    expect(termMod!.delta).toBeLessThan(0);
    expect(termMod!.isOneTime).toBe(true);
  });

  it('11. contract.renewed Enterprise → one-time modifier is recorded with positive delta', () => {
    const { bus, re } = buildModule();
    bus.publish({
      type: 'contract.renewed',
      payload: { contractId: 'ctr-2', tier: CustomerTier.Enterprise },
      gameDate: { year: 2000, month: 1 },
      source: 'ContractManager',
    });
    const mods = re.getActiveModifiers();
    const renewMod = mods.find(m => m.description.includes('renewed'));
    expect(renewMod).toBeDefined();
    expect(renewMod!.delta).toBeGreaterThan(0);
    expect(renewMod!.isOneTime).toBe(true);
  });
});

// ─── Natural recovery ─────────────────────────────────────────────────────────

describe('ReputationEngine — natural recovery', () => {
  it('12. Natural recovery applies when score < 80 and coverageRatio >= 1.0', () => {
    const { bus, re } = buildModule();
    // score is 75 (<80) and coverage defaults to 1.0
    const before = re.getSatisfactionScore();
    triggerMonthEnd(bus, 2000, 1);
    // naturalRecoveryPerMonth is 1 in DEFAULT_CONFIG
    expect(re.getSatisfactionScore()).toBe(before + 1);
  });

  it('13. No natural recovery when coverageRatio < 1.0', () => {
    const { bus, re } = buildModule();
    // Set coverage below 1.0
    bus.publish({
      type: 'staff.coverage_changed',
      payload: { ratio: 0.8 },
      gameDate: { year: 2000, month: 1 },
      source: 'StaffManager',
    });
    const before = re.getSatisfactionScore();
    triggerMonthEnd(bus, 2000, 1);
    // Without natural recovery, score should stay at or below before
    // (it might go down if there are active modifiers from coverage)
    expect(re.getSatisfactionScore()).toBeLessThanOrEqual(before);
  });
});

// ─── updateContractSatisfaction ───────────────────────────────────────────────

describe('ReputationEngine — updateContractSatisfaction', () => {
  it('14. updateContractSatisfaction immediately applies delta', () => {
    const { re } = buildModule();
    const before = re.getSatisfactionScore();
    re.updateContractSatisfaction('c-abc', 5, 'test direct');
    expect(re.getSatisfactionScore()).toBe(before + 5);
  });
});

// ─── Events published ─────────────────────────────────────────────────────────

describe('ReputationEngine — events published', () => {
  it('15. reputation.satisfaction_changed event published on month end', () => {
    const { bus } = buildModule();
    const handler = vi.fn();
    bus.subscribe('reputation.satisfaction_changed', handler);
    triggerMonthEnd(bus, 2000, 1);
    expect(handler).toHaveBeenCalled();
    const payload = handler.mock.calls[0][0] as { payload: { score: number; delta: number } };
    expect(typeof payload.payload.score).toBe('number');
    expect(typeof payload.payload.delta).toBe('number');
  });

  it('16. reputation.high_satisfaction event published when score crosses 80', () => {
    const { bus, re } = buildModule();
    const handler = vi.fn();
    bus.subscribe('reputation.high_satisfaction', handler);
    // Push score to 80+
    re.updateContractSatisfaction('boost', 10, 'boost to high');
    expect(re.getSatisfactionScore()).toBeGreaterThanOrEqual(80);
    triggerMonthEnd(bus, 2000, 1);
    expect(handler).toHaveBeenCalled();
  });
});

// ─── Serialize / deserialize ───────────────────────────────────────────────────

describe('ReputationEngine — serialize/deserialize', () => {
  it('17. serialize/deserialize preserves score', () => {
    const { bus, re } = buildModule();
    re.updateContractSatisfaction('c1', 8, 'bump');
    triggerMonthEnd(bus, 2000, 1);
    const scoreBeforeSnap = re.getSatisfactionScore();
    const snap = re.serialize();

    const bus2 = new EventBus();
    const re2 = new ReputationEngine();
    re2.init(bus2, DEFAULT_CONFIG);
    re2.deserialize(snap);

    expect(re2.getSatisfactionScore()).toBe(scoreBeforeSnap);
  });
});

// ─── Score clamping ────────────────────────────────────────────────────────────

describe('ReputationEngine — score clamping', () => {
  it('18. Score is clamped to 0 at minimum', () => {
    const { re } = buildModule();
    // Apply a massive penalty
    re.updateContractSatisfaction('c1', -200, 'extreme penalty');
    expect(re.getSatisfactionScore()).toBe(0);
  });

  it('Score is clamped to 100 at maximum', () => {
    const { re } = buildModule();
    re.updateContractSatisfaction('c1', 200, 'extreme boost');
    expect(re.getSatisfactionScore()).toBe(100);
  });
});
