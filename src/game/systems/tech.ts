import { TECH_NODE_DEFS, type TechEffectKey } from '../config/tech.config';

export type TechEffects = Record<TechEffectKey, number>;

const defaultEffects: TechEffects = {
  cpsMultiplier: 1,
  clickMultiplier: 1,
  powerCostMultiplier: 1,
  procurementSpeedMultiplier: 1,
  auditCostMultiplier: 1,
  satisfactionRecoveryMultiplier: 1,
  rackCapacityMultiplier: 1,
  prestigeReputationMultiplier: 1,
};

const MULTIPLICATIVE_EFFECTS = new Set<TechEffectKey>([
  'cpsMultiplier',
  'clickMultiplier',
  'powerCostMultiplier',
  'procurementSpeedMultiplier',
  'auditCostMultiplier',
  'satisfactionRecoveryMultiplier',
  'rackCapacityMultiplier',
  'prestigeReputationMultiplier',
]);

export function getTechNode(id: string) {
  return TECH_NODE_DEFS.find((node) => node.id === id);
}

export function canUnlockTechNode(nodeId: string, unlockedNodeIds: string[], reputation: number): boolean {
  const node = getTechNode(nodeId);
  if (!node || unlockedNodeIds.includes(nodeId) || reputation < node.cost) return false;
  return node.requires.every((requiredId) => unlockedNodeIds.includes(requiredId));
}

export function calcTechEffects(unlockedNodeIds: string[]): TechEffects {
  const effects = { ...defaultEffects };
  for (const nodeId of unlockedNodeIds) {
    const node = getTechNode(nodeId);
    if (!node) continue;
    for (const [effectKey, value] of Object.entries(node.effect) as [TechEffectKey, number][]) {
      if (MULTIPLICATIVE_EFFECTS.has(effectKey)) {
        effects[effectKey] *= 1 + value;
      } else {
        effects[effectKey] += value;
      }
    }
  }
  return effects;
}
