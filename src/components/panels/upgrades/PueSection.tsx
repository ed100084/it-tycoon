import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import { PUE_DEFS, MAX_PUE_LEVEL_V02 } from '../../../game/config/pue.config';
import { formatNumber } from '../../../utils/format';

export const PueSection: React.FC = () => {
  const { compute, pueLevel, upgradePUE } = useGameStore();
  const nextPUE = PUE_DEFS[pueLevel + 1];
  const canUpgradePUE = nextPUE && pueLevel < MAX_PUE_LEVEL_V02 && compute >= nextPUE.cost;

  return (
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
          ⚙ Advanced cooling unlocks in a future release
        </div>
      ) : (
        <div className="pue-maxed glow-green">◈ MAX COOLING EFFICIENCY</div>
      )}
    </div>
  );
};
