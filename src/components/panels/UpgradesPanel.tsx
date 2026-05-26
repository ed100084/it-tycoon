import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { HARDWARE_DEFS, UPGRADE_LEVELS, MAX_UPGRADE_LEVEL_V02 } from '../../game/config/hardware.config';
import { PUE_DEFS, MAX_PUE_LEVEL_V02 } from '../../game/config/pue.config';
import { calcUpgradeCost } from '../../game/systems/hardware';
import { formatNumber } from '../../utils/format';

export const UpgradesPanel: React.FC = () => {
  const { compute, hardware, pueLevel, upgradePUE, upgradeHardware } = useGameStore();

  const nextPUE = PUE_DEFS[pueLevel + 1];
  const canUpgradePUE = nextPUE && pueLevel < MAX_PUE_LEVEL_V02 && compute >= nextPUE.cost;

  return (
    <div className="panel upgrades-panel">
      <div className="panel-header">⚙ UPGRADES</div>

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
            ⚙ Advanced cooling unlocks in v0.3+
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

          {/* All maxed out for v0.2 */}
          {HARDWARE_DEFS.every((def) => {
            const hw = hardware[def.id];
            return !hw || hw.owned === 0 || hw.upgradeLevel >= MAX_UPGRADE_LEVEL_V02;
          }) && (
            <div className="no-upgrades-msg glow-green-dim">
              {Object.values(hardware).every(h => h.owned === 0)
                ? 'Buy hardware to unlock upgrades'
                : `All hardware at max level (Lv${MAX_UPGRADE_LEVEL_V02} for v0.2)`}
            </div>
          )}
        </div>
      </div>

      {/* Future upgrade hint */}
      <div className="upgrade-section future-section">
        <div className="upgrade-section-title">─── COMING SOON ───</div>
        <div className="future-hint glow-green-dim">
          <div>v0.3: Datacenter Zones</div>
          <div>v0.5: Procurement (簽呈)</div>
          <div>v0.6: Audit Events (稽核)</div>
          <div>v0.7: Prestige System</div>
          <div>v0.8: Tech Tree</div>
        </div>
      </div>
    </div>
  );
};
