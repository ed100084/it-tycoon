import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import { TECH_NODE_DEFS, type TechEffectKey } from '../../../game/config/tech.config';
import { calcTechEffects, canUnlockTechNode } from '../../../game/systems/tech';
import { formatNumber } from '../../../utils/format';

const TECH_EFFECT_LABELS: Record<TechEffectKey, string> = {
  cpsMultiplier: 'CPS',
  clickMultiplier: 'Click',
  powerCostMultiplier: 'Power cost',
  procurementSpeedMultiplier: 'Procurement speed',
  auditCostMultiplier: 'Audit cost',
  satisfactionRecoveryMultiplier: 'Satisfaction recovery',
  rackCapacityMultiplier: 'Rack capacity',
  prestigeReputationMultiplier: 'Prestige reputation',
};

const formatTechEffect = (effectKey: string, value: number): string => {
  const label = TECH_EFFECT_LABELS[effectKey as TechEffectKey] ?? effectKey;
  const sign = value >= 0 ? '+' : '-';
  return `${label} ${sign}${Math.round(Math.abs(value) * 100)}%`;
};

export const TechTreeSection: React.FC = () => {
  const { reputation, techNodes, unlockTechNode } = useGameStore();
  const techEffects = calcTechEffects(techNodes);

  return (
    <div className="upgrade-section">
      <div className="upgrade-section-title">─── TECH TREE ───</div>

      <div className="tech-summary">
        <span>Unlocked <span className="glow-blue">{techNodes.length}/{TECH_NODE_DEFS.length}</span></span>
        <span>Reputation <span className={reputation > 0 ? 'glow-purple' : 'glow-green-dim'}>{formatNumber(reputation, 0)} R</span></span>
      </div>

      <div className="tech-effects">
        <span>CPS x{techEffects.cpsMultiplier.toFixed(2)}</span>
        <span>Power x{techEffects.powerCostMultiplier.toFixed(2)}</span>
        <span>Rack x{techEffects.rackCapacityMultiplier.toFixed(2)}</span>
      </div>

      <div className="tech-list">
        {TECH_NODE_DEFS.map((node) => {
          const unlocked = techNodes.includes(node.id);
          const canUnlock = canUnlockTechNode(node.id, techNodes, reputation);
          const missingRequires = node.requires.filter((requiredId) => !techNodes.includes(requiredId));
          const requirementText = node.requires.length === 0
            ? 'Root node'
            : `Requires ${node.requires.map((requiredId) => TECH_NODE_DEFS.find((def) => def.id === requiredId)?.name ?? requiredId).join(', ')}`;

          return (
            <div key={node.id} className={`tech-card ${unlocked ? 'unlocked' : canUnlock ? 'available' : 'locked'}`}>
              <div className="tech-card-top">
                <span className="tech-name">{node.name}</span>
                <span className={unlocked ? 'glow-green' : canUnlock ? 'glow-yellow' : 'glow-green-dim'}>
                  {unlocked ? 'UNLOCKED' : `${node.cost} R`}
                </span>
              </div>
              <div className="tech-category">{node.category}</div>
              <div className="tech-desc">{node.description}</div>
              <div className="tech-meta">{requirementText}</div>
              <div className="tech-effect-list">
                {Object.entries(node.effect).map(([effectKey, value]) => (
                  <span key={effectKey}>{formatTechEffect(effectKey, value)}</span>
                ))}
              </div>
              <button
                className={`crt-btn tech-btn ${canUnlock && !unlocked ? '' : 'disabled'}`}
                onClick={() => unlockTechNode(node.id)}
                disabled={!canUnlock || unlocked}
              >
                {unlocked ? '[ ACTIVE ]' : missingRequires.length > 0 ? '[ REQUIRE PREREQ ]' : reputation < node.cost ? '[ NEED REPUTATION ]' : '[ UNLOCK TECH ]'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
