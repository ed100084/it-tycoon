import { describe, it, expect } from 'vitest';
import { migrateSave, calcOfflineEarnings } from './save';
import { GAME_VERSION } from '../config/game.config';
import type { SaveData } from '../models/types';

const asSave = (obj: Record<string, unknown>): SaveData => obj as unknown as SaveData;

describe('migrateSave', () => {
  it('upgrades a pre-versioned legacy save to the current schema', () => {
    const migrated = migrateSave(asSave({ compute: 5, totalEarnedCompute: 5, hardware: {} }));
    expect(migrated.version).toBe(GAME_VERSION);
    expect(migrated.reputation).toBe(0);
    expect(migrated.totalEarnedReputation).toBe(0);
    expect(migrated.influence).toBe(0);
    expect(migrated.prestigeCount).toBe(0);
    expect(migrated.techNodes).toEqual([]);
    expect(migrated.unlockedAchievements).toEqual([]);
  });

  it('backfills totalEarnedReputation from an existing reputation value', () => {
    const migrated = migrateSave(asSave({ version: 0, reputation: 7 }));
    expect(migrated.reputation).toBe(7);
    expect(migrated.totalEarnedReputation).toBe(7);
  });

  it('preserves a save already at the current version', () => {
    const current = asSave({
      version: GAME_VERSION,
      reputation: 3,
      totalEarnedReputation: 9,
      influence: 2,
      techNodes: ['VIRTUALIZATION'],
    });
    const migrated = migrateSave(current);
    expect(migrated.version).toBe(GAME_VERSION);
    expect(migrated.reputation).toBe(3);
    expect(migrated.totalEarnedReputation).toBe(9);
    expect(migrated.influence).toBe(2);
    expect(migrated.techNodes).toEqual(['VIRTUALIZATION']);
  });

  it('does not lose unrelated fields', () => {
    const migrated = migrateSave(asSave({ version: 0, compute: 1234, gameTime: 42 }));
    expect(migrated.compute).toBe(1234);
    expect(migrated.gameTime).toBe(42);
  });

  it('adds contract-system defaults when upgrading v1 -> v2', () => {
    const migrated = migrateSave(asSave({ version: 1, reputation: 5, influence: 1 }));
    expect(migrated.version).toBe(GAME_VERSION);
    expect(migrated.contracts).toEqual([]);
    expect(migrated.contractOffers).toEqual([]);
    expect(migrated.completedContracts).toBe(0);
    expect(migrated.breachedContracts).toBe(0);
    expect(migrated.totalContractsSigned).toBe(0);
    expect(migrated.totalContractRevenue).toBe(0);
  });

  it('runs the full v0 -> current chain on a legacy save', () => {
    const migrated = migrateSave(asSave({ compute: 10 }));
    expect(migrated.version).toBe(GAME_VERSION);
    // v0->v1 fields
    expect(migrated.reputation).toBe(0);
    // v1->v2 fields
    expect(migrated.contracts).toEqual([]);
    expect(migrated.totalContractRevenue).toBe(0);
  });
});

describe('calcOfflineEarnings', () => {
  const hardware = { T0: { owned: 1000, upgradeLevel: 1 } };

  it('earns nothing while shut down', () => {
    const report = calcOfflineEarnings(hardware, 0, Date.now() - 60_000, true);
    expect(report.earnings).toBe(0);
    expect(report.wasShutdown).toBe(true);
  });

  it('earns nothing for very short gaps', () => {
    const report = calcOfflineEarnings(hardware, 0, Date.now() - 1_000, false);
    expect(report.earnings).toBe(0);
  });

  it('accrues net CPS over the elapsed offline window', () => {
    // 1000 x T0: CPS 100, power 1000*35*0.001*2 = 70, net 30/s
    const report = calcOfflineEarnings(hardware, 0, Date.now() - 10_000, false);
    expect(report.elapsed).toBeGreaterThan(5);
    expect(report.earnings).toBeCloseTo(30 * report.elapsed, 3);
  });

  it('earns nothing with an empty fleet', () => {
    const report = calcOfflineEarnings({}, 0, Date.now() - 10_000, false);
    expect(report.elapsed).toBeGreaterThan(5);
    expect(report.earnings).toBe(0);
  });
});
