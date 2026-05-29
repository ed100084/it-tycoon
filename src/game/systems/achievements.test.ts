import { describe, it, expect } from 'vitest';
import {
  evaluateAchievementUnlocks,
  mergeAchievementUnlocks,
  type AchievementCheckState,
} from './achievements';
import { ACHIEVEMENT_DEFS } from '../config/achievement.config';
import { createDefaultFacilityRegions } from './facility';
import type { ActiveContract } from '../models/types';

const baseState = (): AchievementCheckState => ({
  totalEarnedCompute: 0,
  hardware: {},
  procurementRequests: [],
  pueLevel: 0,
  rackCapacity: 100,
  facilityRegions: createDefaultFacilityRegions(),
  satisfaction: 50,
  reputation: 0,
  totalEarnedReputation: 0,
  influence: 0,
  prestigeCount: 0,
  resolvedAudits: 0,
  techNodes: [],
  contracts: [],
  totalContractsSigned: 0,
  totalContractRevenue: 0,
  metrics: { netCPS: 0 },
});

const makeContract = (id: string): ActiveContract => ({
  id,
  clientName: 'Client',
  serviceType: 'vps',
  reservedUnits: 1,
  payoutPerSecond: 1,
  slaPenaltyPerSecond: 0,
  completionReward: 0,
  startedAt: 0,
  endsAt: 100,
  breachSeconds: 0,
  totalPaid: 0,
});

const maxedState = (): AchievementCheckState => {
  const regions = createDefaultFacilityRegions();
  regions.central.unlocked = true;
  regions.south.unlocked = true;
  return {
    totalEarnedCompute: 1e11,
    hardware: Object.fromEntries(
      ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((id) => [id, { owned: 50, upgradeLevel: 1 }])
    ),
    procurementRequests: [
      {
        id: 'PR-1',
        tierId: 'T4',
        qty: 1,
        cost: 1,
        submittedAt: 0,
        readyAt: 0,
        status: 'blocked',
      },
    ],
    pueLevel: 2,
    rackCapacity: 5000,
    facilityRegions: regions,
    satisfaction: 100,
    reputation: 100,
    totalEarnedReputation: 1000,
    influence: 50,
    prestigeCount: 3,
    resolvedAudits: 10,
    techNodes: Array.from({ length: 20 }, (_, i) => `T${i}`),
    contracts: Array.from({ length: 5 }, (_, i) => makeContract(`C${i}`)),
    totalContractsSigned: 8,
    totalContractRevenue: 5_000_000,
    metrics: { netCPS: 1e8 },
  };
};

describe('evaluateAchievementUnlocks', () => {
  it('unlocks nothing from a fresh baseline state', () => {
    expect(evaluateAchievementUnlocks(baseState(), [])).toEqual([]);
  });

  it('unlocks every achievement from a fully maxed state', () => {
    const unlocked = evaluateAchievementUnlocks(maxedState(), []);
    expect(unlocked).toHaveLength(ACHIEVEMENT_DEFS.length);
    expect(new Set(unlocked)).toEqual(new Set(ACHIEVEMENT_DEFS.map((a) => a.id)));
  });

  it('does not re-report already unlocked achievements', () => {
    const allIds = ACHIEVEMENT_DEFS.map((a) => a.id);
    expect(evaluateAchievementUnlocks(maxedState(), allIds)).toEqual([]);
  });

  it('unlocks milestone tiers as compute crosses thresholds', () => {
    const state = { ...baseState(), totalEarnedCompute: 1500 };
    const unlocked = evaluateAchievementUnlocks(state, []);
    expect(unlocked).toContain('CF_100');
    expect(unlocked).toContain('CF_1K');
    expect(unlocked).not.toContain('CF_100K');
  });
});

describe('mergeAchievementUnlocks', () => {
  it('returns the same reference when nothing is newly unlocked', () => {
    const existing = ['CF_100'];
    expect(mergeAchievementUnlocks(existing, [])).toBe(existing);
  });

  it('appends newly unlocked ids', () => {
    expect(mergeAchievementUnlocks(['CF_100'], ['CF_1K'])).toEqual(['CF_100', 'CF_1K']);
  });
});
