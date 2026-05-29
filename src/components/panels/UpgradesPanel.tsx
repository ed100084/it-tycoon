import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { HARDWARE_DEFS, UPGRADE_LEVELS, MAX_UPGRADE_LEVEL_V02 } from '../../game/config/hardware.config';
import { PUE_DEFS, MAX_PUE_LEVEL_V02 } from '../../game/config/pue.config';
import { calcUpgradeCost } from '../../game/systems/hardware';
import {
  calcCrossRegionMultiplier,
  calcRegionExpansionCost,
  calcRegionUnlockReady,
  calcRackUtilization,
  calcUsedRackUnits,
} from '../../game/systems/facility';
import { CAPACITY_WARNING_THRESHOLD, FACILITY_REGION_DEFS } from '../../game/config/facility.config';
import { getAuditRemainingSeconds } from '../../game/systems/audit';
import { PRESTIGE1_THRESHOLD, PRESTIGE2_THRESHOLD } from '../../game/config/game.config';
import {
  calcInfluenceMultiplier,
  calcPrestigeInfluenceGain,
  calcPrestigeReputationGain,
  calcReputationMultiplier,
} from '../../game/systems/prestige';
import { TECH_NODE_DEFS, type TechEffectKey } from '../../game/config/tech.config';
import { calcTechEffects, canUnlockTechNode } from '../../game/systems/tech';
import { ACHIEVEMENT_DEFS } from '../../game/config/achievement.config';
import type { AchievementCategory } from '../../game/models/types';
import { formatDuration, formatNumber } from '../../utils/format';

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

const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  milestone: 'Milestone',
  hardware: 'Hardware',
  audit: 'Audit',
  efficiency: 'Efficiency',
  expansion: 'Expansion',
  bureaucracy: 'Bureaucracy',
  prestige: 'Prestige',
  technology: 'Technology',
};

export const UpgradesPanel: React.FC = () => {
  const {
    compute,
    totalEarnedCompute,
    hardware,
    pueLevel,
    rackCapacity,
    facilityRegions,
    procurementRequests,
    auditEvents,
    resolvedAudits,
    failedAudits,
    reputation,
    totalEarnedReputation,
    influence,
    prestigeCount,
    unlockedAchievements,
    recentAchievementIds,
    techNodes,
    gameTime,
    upgradePUE,
    upgradeHardware,
    expandRegion,
    unlockRegion,
    resolveAudit,
    prestige,
    prestigeTier2,
    unlockTechNode,
  } = useGameStore();

  const nextPUE = PUE_DEFS[pueLevel + 1];
  const canUpgradePUE = nextPUE && pueLevel < MAX_PUE_LEVEL_V02 && compute >= nextPUE.cost;
  const usedRackUnits = calcUsedRackUnits(hardware);
  const rackUtilization = calcRackUtilization(hardware, rackCapacity);
  const crossRegionMultiplier = calcCrossRegionMultiplier(facilityRegions);
  const techEffects = calcTechEffects(techNodes);
  const reputationGain = calcPrestigeReputationGain(totalEarnedCompute, techEffects.prestigeReputationMultiplier);
  const prestigeProgress = Math.min(1, totalEarnedCompute / PRESTIGE1_THRESHOLD);
  const hasT5 = (hardware.T5?.owned ?? 0) >= 1;
  const canPrestigeTier1 = reputationGain > 0 && hasT5;
  const currentRepMultiplier = calcReputationMultiplier(reputation);
  const nextRepMultiplier = calcReputationMultiplier(reputation + reputationGain);
  const influenceGain = calcPrestigeInfluenceGain(totalEarnedReputation);
  const prestigeTier2Progress = Math.min(1, totalEarnedReputation / PRESTIGE2_THRESHOLD);
  const currentInfluenceMultiplier = calcInfluenceMultiplier(influence);
  const nextInfluenceMultiplier = calcInfluenceMultiplier(influence + influenceGain);
  const achievementUnlockSet = new Set(unlockedAchievements);
  const recentAchievementSet = new Set(recentAchievementIds);

  return (
    <div className="panel upgrades-panel">
      <div className="panel-header">⚙ UPGRADES</div>

      {/* Prestige */}
      <div className="upgrade-section">
        <div className="upgrade-section-title">─── PRESTIGE v1.0 ───</div>

        <div className="prestige-card">
          <div className="prestige-top">
            <span>Tier 1: Cloud Transformation</span>
            <span className={reputationGain > 0 ? 'glow-purple' : 'glow-green-dim'}>
              Run {prestigeCount}
            </span>
          </div>
          <div className="prestige-desc">
            Requires {formatNumber(PRESTIGE1_THRESHOLD)} total CF and one T5 Regional DC. Resets this run into permanent Reputation.
          </div>
          <div className="prestige-progress">
            <div className="prestige-progress-fill" style={{ width: `${prestigeProgress * 100}%` }} />
          </div>
          <div className="prestige-meta">
            <span>{formatNumber(totalEarnedCompute)} / {formatNumber(PRESTIGE1_THRESHOLD)} CF</span>
            <span className={hasT5 ? 'glow-green' : 'glow-red'}>{hasT5 ? 'T5 ready' : 'Need T5'}</span>
          </div>
          <div className="prestige-meta">
            <span>Gain: <span className={reputationGain > 0 ? 'glow-purple' : 'glow-green-dim'}>{reputationGain} Reputation</span></span>
            <span>Rep CPS: x{currentRepMultiplier.toFixed(2)} {'->'} x{nextRepMultiplier.toFixed(2)}</span>
          </div>
          <button
            className={`crt-btn prestige-btn ${canPrestigeTier1 ? '' : 'disabled'}`}
            onClick={prestige}
            disabled={!canPrestigeTier1}
          >
            [ EXECUTE TIER 1 ]
          </button>
        </div>

        <div className="prestige-card prestige-tier2">
          <div className="prestige-top">
            <span>Tier 2: IPO</span>
            <span className={influence > 0 ? 'glow-purple' : 'glow-green-dim'}>
              {formatNumber(influence, 0)} Influence
            </span>
          </div>
          <div className="prestige-desc">
            Converts accumulated Reputation into permanent Influence. Resets Compute and Reputation while keeping technologies and achievements.
          </div>
          <div className="prestige-progress">
            <div className="prestige-progress-fill tier2" style={{ width: `${prestigeTier2Progress * 100}%` }} />
          </div>
          <div className="prestige-meta">
            <span>{formatNumber(totalEarnedReputation, 0)} / {formatNumber(PRESTIGE2_THRESHOLD, 0)} total R</span>
            <span>Inf CPS x{currentInfluenceMultiplier.toFixed(2)}</span>
          </div>
          <div className="prestige-meta">
            <span>Gain: <span className={influenceGain > 0 ? 'glow-purple' : 'glow-green-dim'}>{influenceGain} Influence</span></span>
            <span>After: x{nextInfluenceMultiplier.toFixed(2)}</span>
          </div>
          <button
            className={`crt-btn prestige-btn ${influenceGain > 0 ? '' : 'disabled'}`}
            onClick={prestigeTier2}
            disabled={influenceGain <= 0}
          >
            [ EXECUTE IPO ]
          </button>
        </div>
      </div>

      {/* Achievements */}
      <div className="upgrade-section">
        <div className="upgrade-section-title">─── ACHIEVEMENTS v1.0 ───</div>

        <div className="achievement-summary">
          <span>Unlocked <span className="glow-yellow">{unlockedAchievements.length}/{ACHIEVEMENT_DEFS.length}</span></span>
          <span>{Math.floor((unlockedAchievements.length / ACHIEVEMENT_DEFS.length) * 100)}%</span>
        </div>

        {recentAchievementIds.length > 0 && (
          <div className="achievement-recent">
            {recentAchievementIds.map((achievementId) => {
              const achievement = ACHIEVEMENT_DEFS.find((def) => def.id === achievementId);
              if (!achievement) return null;
              return <span key={achievement.id}>NEW: {achievement.name}</span>;
            })}
          </div>
        )}

        <div className="achievement-list">
          {ACHIEVEMENT_DEFS.map((achievement) => {
            const unlocked = achievementUnlockSet.has(achievement.id);
            const recent = recentAchievementSet.has(achievement.id);
            return (
              <div key={achievement.id} className={`achievement-card ${unlocked ? 'unlocked' : 'locked'} ${recent ? 'recent' : ''}`}>
                <div className="achievement-card-top">
                  <span className="achievement-name">{achievement.name}</span>
                  <span className={unlocked ? 'glow-yellow' : 'glow-green-dim'}>
                    {unlocked ? 'DONE' : 'LOCKED'}
                  </span>
                </div>
                <div className="achievement-category">{ACHIEVEMENT_CATEGORY_LABELS[achievement.category]}</div>
                <div className="achievement-desc">{unlocked ? achievement.description : achievement.requirement}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tech Tree */}
      <div className="upgrade-section">
        <div className="upgrade-section-title">─── TECH TREE v1.0 ───</div>

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

      {/* Facility Zones */}
      <div className="upgrade-section">
        <div className="upgrade-section-title">─── FACILITY ZONES ───</div>

        <div className={`facility-summary ${rackUtilization >= CAPACITY_WARNING_THRESHOLD ? 'capacity-warn' : ''}`}>
          <div>
            Rack usage: <span className={rackUtilization >= CAPACITY_WARNING_THRESHOLD ? 'glow-yellow' : 'glow-blue'}>
              {usedRackUnits}/{rackCapacity}U
            </span>
          </div>
          <div>
            Cross-region ops:{' '}
            <span className={crossRegionMultiplier > 1 ? 'glow-green' : 'glow-green-dim'}>
              {crossRegionMultiplier > 1 ? '+25% CPS active' : 'unlock 2 regions for +25% CPS'}
            </span>
          </div>
        </div>

        <div className="facility-list">
          {FACILITY_REGION_DEFS.map((def) => {
            const region = facilityRegions[def.id];
            const expansionCost = calcRegionExpansionCost(def.id, facilityRegions);
            const canExpand = region.unlocked && compute >= expansionCost;
            const canUnlock = calcRegionUnlockReady(def.id, hardware, facilityRegions) && compute >= def.unlockCost;
            const unlockReady = calcRegionUnlockReady(def.id, hardware, facilityRegions);

            return (
              <div key={def.id} className={`facility-card ${region.unlocked ? 'online' : 'locked'}`}>
                <div className="facility-card-top">
                  <span className="facility-name">{def.nameZh}</span>
                  <span className={region.unlocked ? 'glow-green' : 'glow-red'}>
                    {region.unlocked ? 'ONLINE' : 'LOCKED'}
                  </span>
                </div>

                <div className="facility-stats">
                  <span>{region.capacity}U</span>
                  <span>Expand +{def.expansionUnits}U</span>
                  <span>CPS ×{def.cpsMultiplier.toFixed(2)}</span>
                </div>

                {region.unlocked ? (
                  <button
                    className={`crt-btn facility-btn ${canExpand ? '' : 'disabled'}`}
                    onClick={() => expandRegion(def.id)}
                    disabled={!canExpand}
                  >
                    [ EXPAND {formatNumber(expansionCost)} CF ]
                  </button>
                ) : (
                  <>
                    <div className="facility-unlock">
                      Need {def.unlockAtUsedUnits}U deployed · Cost {formatNumber(def.unlockCost)} CF
                    </div>
                    <button
                      className={`crt-btn facility-btn ${canUnlock ? '' : 'disabled'}`}
                      onClick={() => unlockRegion(def.id)}
                      disabled={!canUnlock}
                    >
                      {unlockReady ? '[ UNLOCK REGION ]' : '[ REQUIRE SCALE ]'}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Events */}
      <div className="upgrade-section">
        <div className="upgrade-section-title">─── AUDIT EVENTS ───</div>

        <div className="audit-summary">
          <span>Passed: <span className="glow-green">{resolvedAudits}</span></span>
          <span>Failed: <span className={failedAudits > 0 ? 'glow-red' : 'glow-green-dim'}>{failedAudits}</span></span>
        </div>

        {auditEvents.length === 0 ? (
          <div className="audit-empty glow-green-dim">
            No active audits
          </div>
        ) : (
          <div className="audit-list">
            {auditEvents.map((audit) => {
              const remaining = getAuditRemainingSeconds(audit, gameTime);
              const canResolve = compute >= audit.responseCost;
              const urgencyClass = remaining < 20 ? 'glow-red' : remaining < 45 ? 'glow-yellow' : 'glow-blue';

              return (
                <div key={audit.id} className="audit-card">
                  <div className="audit-card-top">
                    <span>{audit.title}</span>
                    <span className={urgencyClass}>{formatDuration(remaining)}</span>
                  </div>
                  <div className="audit-desc">{audit.description}</div>
                  <div className="audit-meta">
                    Cost {formatNumber(audit.responseCost)} CF · Penalty -{audit.satisfactionPenalty}% satisfaction
                  </div>
                  <button
                    className={`crt-btn audit-btn ${canResolve ? '' : 'disabled'}`}
                    onClick={() => resolveAudit(audit.id)}
                    disabled={!canResolve}
                  >
                    [ SUBMIT EVIDENCE ]
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Procurement */}
      <div className="upgrade-section">
        <div className="upgrade-section-title">─── PROCUREMENT ───</div>

        {procurementRequests.length === 0 ? (
          <div className="procurement-empty glow-green-dim">
            No active purchase requests
          </div>
        ) : (
          <div className="procurement-list">
            {procurementRequests.map((request) => {
              const def = HARDWARE_DEFS.find((hardwareDef) => hardwareDef.id === request.tierId);
              const remaining = Math.max(0, request.readyAt - gameTime);
              const statusClass = request.status === 'blocked'
                ? 'glow-red'
                : remaining > 0
                  ? 'glow-yellow'
                  : 'glow-green';

              return (
                <div key={request.id} className={`procurement-card ${request.status}`}>
                  <div className="procurement-card-top">
                    <span>{def?.name ?? request.tierId}</span>
                    <span className={statusClass}>
                      {request.status === 'blocked' ? 'WAITING RACK' : remaining > 0 ? formatDuration(remaining) : 'DELIVERING'}
                    </span>
                  </div>
                  <div className="procurement-meta">
                    Qty {request.qty} · {formatNumber(request.cost)} CF · PR #{request.id.slice(-5).toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PUE Cooling Upgrade */}
      <div className="upgrade-section">
        <div className="upgrade-section-title">─── PUE COOLING ───</div>

        <div className="pue-current">
          <div className="pue-label">Current:</div>
          <div className="pue-info">
            <span className="glow-blue">{PUE_DEFS[pueLevel].nameZh}</span>
            <span className="pue-value">PUE {PUE_DEFS[pueLevel].pue.toFixed(2)}</span>
          </div>
        </div>

        <div className="pue-progress">
          {PUE_DEFS.slice(0, MAX_PUE_LEVEL_V02 + 1).map((p, i) => (
            <div
              key={p.level}
              className={`pue-step ${i <= pueLevel ? 'pue-done' : 'pue-locked'}`}
            >
              {i <= pueLevel ? '▓' : '░'}
            </div>
          ))}
        </div>

        {nextPUE && pueLevel < MAX_PUE_LEVEL_V02 ? (
          <div className="pue-upgrade-card">
            <div className="pue-next-name glow-yellow">→ {nextPUE.nameZh}</div>
            <div className="pue-next-desc">{nextPUE.description}</div>
            <div className="pue-next-stats">
              PUE: {PUE_DEFS[pueLevel].pue.toFixed(2)} → <span className="glow-green">{nextPUE.pue.toFixed(2)}</span>
            </div>
            <div className="pue-next-cost">
              Cost: <span className={canUpgradePUE ? 'glow-green' : 'glow-red'}>{formatNumber(nextPUE.cost)} CF</span>
            </div>
            <button
              className={`crt-btn pue-btn ${canUpgradePUE ? '' : 'disabled'}`}
              onClick={upgradePUE}
              disabled={!canUpgradePUE}
            >
              [ INSTALL UPGRADE ]
            </button>
          </div>
        ) : pueLevel >= MAX_PUE_LEVEL_V02 ? (
          <div className="pue-locked-msg glow-yellow">
            ⚙ Advanced cooling unlocks in v1.1+
          </div>
        ) : (
          <div className="pue-maxed glow-green">◈ MAX COOLING EFFICIENCY</div>
        )}
      </div>

      {/* Hardware Upgrades */}
      <div className="upgrade-section">
        <div className="upgrade-section-title">─── HARDWARE LVL ───</div>

        <div className="hw-upgrades-list">
          {HARDWARE_DEFS.map((def) => {
            const hw = hardware[def.id];
            if (!hw || hw.owned === 0) return null;
            if (hw.upgradeLevel >= MAX_UPGRADE_LEVEL_V02) return null;

            const nextLevel = hw.upgradeLevel + 1;
            const nextUpgrade = UPGRADE_LEVELS[nextLevel - 1];
            const cost = calcUpgradeCost(def.id, hw.upgradeLevel);
            const canAfford = compute >= cost;
            const currentMult = UPGRADE_LEVELS[hw.upgradeLevel - 1].multiplier;
            const nextMult = nextUpgrade.multiplier;

            return (
              <div key={def.id} className="hw-upgrade-card">
                <div className="hw-upgrade-header">
                  <span className="hw-upgrade-name">[{def.id}] {def.name}</span>
                  <span className="hw-upgrade-level glow-blue">Lv{hw.upgradeLevel} → Lv{nextLevel}</span>
                </div>
                <div className="hw-upgrade-effect">
                  ×{currentMult} → <span className="glow-green">×{nextMult} CPS</span>
                </div>
                <div className="hw-upgrade-cost">
                  Cost: <span className={canAfford ? 'glow-green' : 'glow-red'}>{formatNumber(cost)} CF</span>
                </div>
                <button
                  className={`crt-btn hw-upgrade-btn ${canAfford ? '' : 'disabled'}`}
                  onClick={() => upgradeHardware(def.id)}
                  disabled={!canAfford}
                >
                  [ UPGRADE ]
                </button>
              </div>
            );
          })}

          {/* All maxed out for current release */}
          {HARDWARE_DEFS.every((def) => {
            const hw = hardware[def.id];
            return !hw || hw.owned === 0 || hw.upgradeLevel >= MAX_UPGRADE_LEVEL_V02;
          }) && (
            <div className="no-upgrades-msg glow-green-dim">
              {Object.values(hardware).every(h => h.owned === 0)
                ? 'Buy hardware to unlock upgrades'
                : `All hardware at max level (Lv${MAX_UPGRADE_LEVEL_V02} for v1.0)`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
