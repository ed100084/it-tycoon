import { HARDWARE_DEFS, COST_GROWTH, UPGRADE_LEVELS } from '../config/hardware.config';
import { PUE_DEFS, ELECTRICITY_PRICE } from '../config/pue.config';
import type { HardwareState } from '../models/types';

const KNOWN_HARDWARE_IDS = new Set(HARDWARE_DEFS.map((d) => d.id));

export function getHardwareDef(id: string) {
  const def = HARDWARE_DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown hardware: ${id}`);
  return def;
}

export function calcHardwareCost(id: string, owned: number): number {
  const def = getHardwareDef(id);
  return Math.ceil(def.baseCost * Math.pow(COST_GROWTH, owned));
}

export function calcBulkCost(id: string, owned: number, count: number): number {
  const def = getHardwareDef(id);
  // Geometric series: sum_{i=0}^{n-1} baseCost * growth^(owned+i)
  const a = def.baseCost * Math.pow(COST_GROWTH, owned);
  const total = a * (Math.pow(COST_GROWTH, count) - 1) / (COST_GROWTH - 1);
  return Math.ceil(total);
}

export function calcUpgradeCost(id: string, currentLevel: number): number {
  const def = getHardwareDef(id);
  const next = UPGRADE_LEVELS[currentLevel]; // currentLevel is 1-based, index is 0-based
  if (!next) return Infinity;
  return Math.ceil(def.baseCost * next.costMultiplier);
}

export function getUpgradeMultiplier(level: number): number {
  return UPGRADE_LEVELS[level - 1]?.multiplier ?? 1;
}

export function calcHardwareCPS(id: string, state: HardwareState): number {
  if (state.owned === 0) return 0;
  const def = getHardwareDef(id);
  return def.baseCps * state.owned * getUpgradeMultiplier(state.upgradeLevel);
}

export function calcHardwarePower(id: string, state: HardwareState, pue: number): number {
  if (state.owned === 0) return 0;
  const def = getHardwareDef(id);
  return def.watts * state.owned * ELECTRICITY_PRICE * pue;
}

export interface GameTickMetrics {
  totalCPS: number;
  totalPowerCost: number;
  netCPS: number;
  perHardware: Record<string, { cps: number; power: number }>;
}

export function computeTickMetrics(
  hardware: Record<string, HardwareState>,
  pueLevel: number,
  cpsMultiplier = 1,
  powerCostMultiplier = 1
): GameTickMetrics {
  const pue = PUE_DEFS[pueLevel]?.pue ?? PUE_DEFS[0].pue;
  let totalCPS = 0;
  let totalPowerCost = 0;
  const perHardware: Record<string, { cps: number; power: number }> = {};

  for (const [id, hw] of Object.entries(hardware)) {
    if (!KNOWN_HARDWARE_IDS.has(id)) continue;
    if (hw.owned === 0) continue;
    const cps = calcHardwareCPS(id, hw) * cpsMultiplier;
    const power = calcHardwarePower(id, hw, pue) * powerCostMultiplier;
    totalCPS += cps;
    totalPowerCost += power;
    perHardware[id] = { cps, power };
  }

  return {
    totalCPS,
    totalPowerCost,
    netCPS: totalCPS - totalPowerCost,
    perHardware,
  };
}

export function getTotalOwnedHardware(hardware: Record<string, HardwareState>): number {
  return Object.values(hardware).reduce((sum, hw) => sum + hw.owned, 0);
}

export function getMaxAffordable(id: string, owned: number, budget: number): number {
  let count = 0;
  let totalCost = 0;
  const def = getHardwareDef(id);
  while (count < 1000) {
    const next = Math.ceil(def.baseCost * Math.pow(COST_GROWTH, owned + count));
    if (totalCost + next > budget) break;
    totalCost += next;
    count++;
  }
  return count;
}
