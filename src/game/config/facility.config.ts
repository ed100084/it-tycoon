export type FacilityRegionId = 'north' | 'central' | 'south';

export interface FacilityRegionDefinition {
  id: FacilityRegionId;
  name: string;
  nameZh: string;
  baseCapacity: number;
  expansionUnits: number;
  expansionCost: number;
  unlockCost: number;
  unlockAtUsedUnits: number;
  cpsMultiplier: number;
}

export const FACILITY_REGION_DEFS: FacilityRegionDefinition[] = [
  {
    id: 'north',
    name: 'North Zone',
    nameZh: '北區',
    baseCapacity: 100,
    expansionUnits: 50,
    expansionCost: 15000,
    unlockCost: 0,
    unlockAtUsedUnits: 0,
    cpsMultiplier: 1,
  },
  {
    id: 'central',
    name: 'Central Zone',
    nameZh: '中區',
    baseCapacity: 500,
    expansionUnits: 250,
    expansionCost: 150000,
    unlockCost: 75000,
    unlockAtUsedUnits: 85,
    cpsMultiplier: 1.1,
  },
  {
    id: 'south',
    name: 'South Zone',
    nameZh: '南區',
    baseCapacity: 2000,
    expansionUnits: 500,
    expansionCost: 750000,
    unlockCost: 500000,
    unlockAtUsedUnits: 450,
    cpsMultiplier: 1.15,
  },
];

export const CAPACITY_WARNING_THRESHOLD = 0.85;
export const EXPANSION_COST_GROWTH = 1.75;
export const CROSS_REGION_CPS_BONUS = 0.25;
