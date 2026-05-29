import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import { PRESTIGE1_THRESHOLD, PRESTIGE2_THRESHOLD } from '../../../game/config/game.config';
import { calcTechEffects } from '../../../game/systems/tech';
import {
  calcInfluenceMultiplier,
  calcPrestigeInfluenceGain,
  calcPrestigeReputationGain,
  calcReputationMultiplier,
} from '../../../game/systems/prestige';
import { formatNumber } from '../../../utils/format';

export const PrestigeSection: React.FC = () => {
  const {
    totalEarnedCompute,
    hardware,
    reputation,
    totalEarnedReputation,
    influence,
    prestigeCount,
    techNodes,
    prestige,
    prestigeTier2,
  } = useGameStore();

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

  return (
    <div className="upgrade-section">
      <div className="upgrade-section-title">─── PRESTIGE ───</div>

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
  );
};
