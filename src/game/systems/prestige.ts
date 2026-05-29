import { PRESTIGE1_THRESHOLD, PRESTIGE2_THRESHOLD } from '../config/game.config';
import { INFLUENCE_CPS_BONUS, REPUTATION_CPS_BONUS } from '../config/prestige.config';

export function calcPrestigeReputationGain(totalEarnedCompute: number, reputationMultiplier = 1): number {
  if (!Number.isFinite(totalEarnedCompute) || totalEarnedCompute < PRESTIGE1_THRESHOLD) return 0;
  return Math.max(1, Math.floor(Math.sqrt(totalEarnedCompute / PRESTIGE1_THRESHOLD) * reputationMultiplier));
}

export function calcReputationMultiplier(reputation: number): number {
  if (!Number.isFinite(reputation) || reputation <= 0) return 1;
  return 1 + reputation * REPUTATION_CPS_BONUS;
}

export function calcPrestigeInfluenceGain(totalEarnedReputation: number): number {
  if (!Number.isFinite(totalEarnedReputation) || totalEarnedReputation < PRESTIGE2_THRESHOLD) return 0;
  return Math.max(1, Math.floor(Math.sqrt(totalEarnedReputation / 100)));
}

export function calcInfluenceMultiplier(influence: number): number {
  if (!Number.isFinite(influence) || influence <= 0) return 1;
  return 1 + influence * INFLUENCE_CPS_BONUS;
}
