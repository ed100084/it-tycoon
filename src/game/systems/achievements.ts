import { ACHIEVEMENT_DEFS } from '../config/achievement.config';
import { calcTotalRackCapacity, calcUsedRackUnits } from './facility';
import type { FacilityRegionId } from '../config/facility.config';
import type { FacilityRegionState, HardwareState, ProcurementRequest } from '../models/types';

export interface AchievementCheckState {
  totalEarnedCompute: number;
  hardware: Record<string, HardwareState>;
  procurementRequests: ProcurementRequest[];
  pueLevel: number;
  rackCapacity: number;
  facilityRegions: Record<FacilityRegionId, FacilityRegionState>;
  satisfaction: number;
  reputation: number;
  totalEarnedReputation: number;
  influence: number;
  prestigeCount: number;
  resolvedAudits: number;
  techNodes: string[];
  metrics: {
    netCPS: number;
  };
}

type AchievementCondition = (state: AchievementCheckState) => boolean;

const owned = (state: AchievementCheckState, tierId: string) => state.hardware[tierId]?.owned ?? 0;

const CONDITIONS: Record<string, AchievementCondition> = {
  CF_100: (state) => state.totalEarnedCompute >= 100,
  CF_1K: (state) => state.totalEarnedCompute >= 1_000,
  CF_100K: (state) => state.totalEarnedCompute >= 100_000,
  CF_10M: (state) => state.totalEarnedCompute >= 10_000_000,
  CF_1B: (state) => state.totalEarnedCompute >= 1_000_000_000,
  CF_10B: (state) => state.totalEarnedCompute >= 10_000_000_000,
  HW_T0: (state) => owned(state, 'T0') >= 1,
  HW_T1: (state) => owned(state, 'T1') >= 1,
  HW_T2: (state) => owned(state, 'T2') >= 1,
  HW_T3: (state) => owned(state, 'T3') >= 1,
  HW_T4: (state) => owned(state, 'T4') >= 1,
  HW_T5: (state) => owned(state, 'T5') >= 1,
  HW_T6: (state) => owned(state, 'T6') >= 1,
  HW_T7: (state) => owned(state, 'T7') >= 1,
  FAC_100U_USED: (state) => calcUsedRackUnits(state.hardware) >= 100,
  FAC_CENTRAL: (state) => Boolean(state.facilityRegions.central?.unlocked),
  FAC_SOUTH: (state) => Boolean(state.facilityRegions.south?.unlocked),
  FAC_1000U: (state) => Math.max(state.rackCapacity, calcTotalRackCapacity(state.facilityRegions)) >= 1_000,
  OPS_PUE_18: (state) => state.pueLevel >= 1,
  OPS_PUE_16: (state) => state.pueLevel >= 2,
  OPS_SAT_90: (state) => state.satisfaction >= 90,
  OPS_CPS_1K: (state) => state.metrics.netCPS >= 1_000,
  OPS_CPS_100K: (state) => state.metrics.netCPS >= 100_000,
  PR_FIRST: (state) => state.procurementRequests.length > 0 || owned(state, 'T4') > 0 || owned(state, 'T5') > 0,
  PR_BLOCKED: (state) => state.procurementRequests.some((request) => request.status === 'blocked'),
  AUDIT_1: (state) => state.resolvedAudits >= 1,
  AUDIT_5: (state) => state.resolvedAudits >= 5,
  PRESTIGE_1: (state) => state.prestigeCount >= 1,
  PRESTIGE_2: (state) => state.influence >= 1,
  REP_5: (state) => state.reputation >= 5,
  INF_5: (state) => state.influence >= 5,
  INF_10: (state) => state.influence >= 10,
  TECH_1: (state) => state.techNodes.length >= 1,
  TECH_5: (state) => state.techNodes.length >= 5,
  TECH_10: (state) => state.techNodes.length >= 10,
  TECH_20: (state) => state.techNodes.length >= 20,
};

export function evaluateAchievementUnlocks(
  state: AchievementCheckState,
  unlockedAchievementIds: string[]
): string[] {
  const unlocked = new Set(unlockedAchievementIds);
  const newlyUnlocked: string[] = [];

  for (const achievement of ACHIEVEMENT_DEFS) {
    if (unlocked.has(achievement.id)) continue;
    if (CONDITIONS[achievement.id]?.(state)) {
      unlocked.add(achievement.id);
      newlyUnlocked.push(achievement.id);
    }
  }

  return newlyUnlocked;
}

export function mergeAchievementUnlocks(
  unlockedAchievementIds: string[],
  newlyUnlockedIds: string[]
): string[] {
  if (newlyUnlockedIds.length === 0) return unlockedAchievementIds;
  return [...unlockedAchievementIds, ...newlyUnlockedIds];
}
