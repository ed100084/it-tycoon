import { SAVE_KEY, GAME_VERSION, MAX_OFFLINE_SECONDS, INITIAL_STATE } from '../config/game.config';
import { computeTickMetrics } from './hardware';
import type { SaveData, HardwareState, OfflineEarningsReport } from '../models/types';

type RawSave = Record<string, unknown> & { version?: number };

export function createDefaultSave(): SaveData {
  return {
    version: GAME_VERSION,
    ...INITIAL_STATE,
    hardware: {},
    lastSaveTime: Date.now(),
  };
}

export function serializeSave(state: SaveData): string {
  return JSON.stringify({ ...state, lastSaveTime: Date.now() });
}

export function deserializeSave(raw: string): SaveData | null {
  try {
    const data = JSON.parse(raw) as SaveData;
    if (!data || typeof data !== 'object') return null;
    // Pre-versioned legacy saves are accepted and treated as version 0 so the
    // migration chain can upgrade them instead of being silently discarded.
    return data;
  } catch {
    return null;
  }
}

export function saveToStorage(state: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(state));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

export function loadFromStorage(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return deserializeSave(raw);
  } catch {
    return null;
  }
}

export function clearStorage(): void {
  localStorage.removeItem(SAVE_KEY);
}

/**
 * Migration registry. Each entry upgrades a save from version `key` to `key + 1`.
 * Add a new entry whenever GAME_VERSION is bumped; the chain in migrateSave()
 * applies them in order so any old save lands on the current schema.
 *
 * Migrations only need to backfill/transform fields — final clamping and
 * validation happen in the store's normalize* helpers on load.
 */
const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const SAVE_MIGRATIONS: Record<number, (s: RawSave) => RawSave> = {
  // v0 (pre-versioned / legacy) -> v1: backfill fields introduced up to v1.0
  // (reputation, prestige, influence, tech tree, achievements).
  0: (s) => ({
    ...s,
    reputation: num(s.reputation, INITIAL_STATE.reputation),
    totalEarnedReputation: num(s.totalEarnedReputation, num(s.reputation, INITIAL_STATE.totalEarnedReputation)),
    influence: num(s.influence, INITIAL_STATE.influence),
    prestigeCount: num(s.prestigeCount, INITIAL_STATE.prestigeCount),
    satisfaction: num(s.satisfaction, INITIAL_STATE.satisfaction),
    techNodes: Array.isArray(s.techNodes) ? s.techNodes : [...INITIAL_STATE.techNodes],
    unlockedAchievements: Array.isArray(s.unlockedAchievements)
      ? s.unlockedAchievements
      : [...INITIAL_STATE.unlockedAchievements],
    version: 1,
  }),
  // v1 -> v2: introduce the contract system. Old saves have no contracts.
  1: (s) => ({
    ...s,
    contracts: Array.isArray(s.contracts) ? s.contracts : [],
    contractOffers: Array.isArray(s.contractOffers) ? s.contractOffers : [],
    completedContracts: num(s.completedContracts, 0),
    breachedContracts: num(s.breachedContracts, 0),
    totalContractsSigned: num(s.totalContractsSigned, 0),
    totalContractRevenue: num(s.totalContractRevenue, 0),
    version: 2,
  }),
};

export function migrateSave(data: SaveData): SaveData {
  let working: RawSave = { ...(data as unknown as RawSave) };
  let version = num(working.version, 0);

  // Apply migrations sequentially until the save reaches the current schema.
  while (version < GAME_VERSION) {
    const migrate = SAVE_MIGRATIONS[version];
    working = migrate ? migrate(working) : { ...working, version: version + 1 };
    const nextVersion = num(working.version, version + 1);
    // Guard against a migration that forgets to advance the version.
    version = nextVersion > version ? nextVersion : version + 1;
  }

  working.version = GAME_VERSION;
  return working as unknown as SaveData;
}

export function calcOfflineEarnings(
  hardware: Record<string, HardwareState>,
  pueLevel: number,
  lastSaveTime: number,
  isShutdown: boolean,
  cpsMultiplier = 1,
  powerCostMultiplier = 1
): OfflineEarningsReport {
  const now = Date.now();
  const elapsed = Math.max(0, Math.min((now - lastSaveTime) / 1000, MAX_OFFLINE_SECONDS));

  if (isShutdown || elapsed < 5) {
    return { elapsed, earnings: 0, wasShutdown: isShutdown };
  }

  const metrics = computeTickMetrics(hardware, pueLevel, cpsMultiplier, powerCostMultiplier);
  const earnings = Math.max(0, metrics.netCPS * elapsed);

  return { elapsed, earnings, wasShutdown: false };
}
