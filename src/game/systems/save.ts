import { SAVE_KEY, GAME_VERSION, MAX_OFFLINE_SECONDS, INITIAL_STATE } from '../config/game.config';
import { computeTickMetrics } from './hardware';
import type { SaveData, HardwareState, OfflineEarningsReport } from '../models/types';

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
    if (!data || typeof data !== 'object' || !data.version) return null;
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

export function migrateSave(data: SaveData): SaveData {
  // Future migrations go here when GAME_VERSION bumps
  return data;
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
