import { HARDWARE_DEFS } from '../config/hardware.config';
import {
  CROSS_REGION_CPS_BONUS,
  EXPANSION_COST_GROWTH,
  FACILITY_REGION_DEFS,
  type FacilityRegionId,
} from '../config/facility.config';
import type { FacilityRegionState, HardwareState } from '../models/types';

const HARDWARE_BY_ID = new Map(HARDWARE_DEFS.map((def) => [def.id, def]));
const REGION_BY_ID = new Map(FACILITY_REGION_DEFS.map((def) => [def.id, def]));

export type FacilityRegions = Record<FacilityRegionId, FacilityRegionState>;

export function createDefaultFacilityRegions(): FacilityRegions {
  return Object.fromEntries(
    FACILITY_REGION_DEFS.map((def) => [
      def.id,
      {
        unlocked: def.id === 'north',
        capacity: def.baseCapacity,
        expansionCount: 0,
      },
    ])
  ) as FacilityRegions;
}

export function calcTotalRackCapacity(regions: FacilityRegions): number {
  return FACILITY_REGION_DEFS.reduce((total, def) => {
    const region = regions[def.id];
    return region?.unlocked ? total + region.capacity : total;
  }, 0);
}

export function calcUnlockedRegionCount(regions: FacilityRegions): number {
  return FACILITY_REGION_DEFS.reduce((count, def) => count + (regions[def.id]?.unlocked ? 1 : 0), 0);
}

export function calcCrossRegionMultiplier(regions: FacilityRegions): number {
  return calcUnlockedRegionCount(regions) >= 2 ? 1 + CROSS_REGION_CPS_BONUS : 1;
}

export function calcRegionUnlockReady(
  regionId: FacilityRegionId,
  hardware: Record<string, HardwareState>,
  regions: FacilityRegions
): boolean {
  const def = REGION_BY_ID.get(regionId);
  if (!def || regions[regionId]?.unlocked) return false;
  if (regionId === 'central' && !regions.north.unlocked) return false;
  if (regionId === 'south' && !regions.central.unlocked) return false;
  return calcUsedRackUnits(hardware) >= def.unlockAtUsedUnits;
}

export function calcRegionExpansionCost(regionId: FacilityRegionId, regions: FacilityRegions): number {
  const def = REGION_BY_ID.get(regionId);
  const region = regions[regionId];
  if (!def || !region) return Infinity;
  return Math.ceil(def.expansionCost * Math.pow(EXPANSION_COST_GROWTH, region.expansionCount));
}

export function calcUsedRackUnits(hardware: Record<string, HardwareState>): number {
  return Object.entries(hardware).reduce((total, [id, state]) => {
    const def = HARDWARE_BY_ID.get(id);
    if (!def || !Number.isFinite(state.owned) || state.owned <= 0) return total;
    return total + def.uSize * state.owned;
  }, 0);
}

export function calcFreeRackUnits(hardware: Record<string, HardwareState>, rackCapacity: number): number;
export function calcFreeRackUnits(hardware: Record<string, HardwareState>, regions: FacilityRegions): number;
export function calcFreeRackUnits(
  hardware: Record<string, HardwareState>,
  capacityOrRegions: number | FacilityRegions
): number {
  const rackCapacity = typeof capacityOrRegions === 'number'
    ? capacityOrRegions
    : calcTotalRackCapacity(capacityOrRegions);
  return Math.max(0, rackCapacity - calcUsedRackUnits(hardware));
}

export function calcRackUtilization(hardware: Record<string, HardwareState>, rackCapacity: number): number;
export function calcRackUtilization(hardware: Record<string, HardwareState>, regions: FacilityRegions): number;
export function calcRackUtilization(
  hardware: Record<string, HardwareState>,
  capacityOrRegions: number | FacilityRegions
): number {
  const rackCapacity = typeof capacityOrRegions === 'number'
    ? capacityOrRegions
    : calcTotalRackCapacity(capacityOrRegions);
  if (rackCapacity <= 0) return 1;
  return calcUsedRackUnits(hardware) / rackCapacity;
}

export function calcMaxInstallableByRack(
  tierId: string,
  hardware: Record<string, HardwareState>,
  rackCapacity: number
): number {
  const def = HARDWARE_BY_ID.get(tierId);
  if (!def || def.uSize <= 0) return 0;
  return Math.floor(calcFreeRackUnits(hardware, rackCapacity) / def.uSize);
}

export function canInstallHardware(
  tierId: string,
  qty: number,
  hardware: Record<string, HardwareState>,
  rackCapacity: number
): boolean {
  const def = HARDWARE_BY_ID.get(tierId);
  if (!def || qty <= 0) return false;
  return def.uSize * qty <= calcFreeRackUnits(hardware, rackCapacity);
}
