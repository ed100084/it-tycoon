import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import { HARDWARE_DEFS, UPGRADE_LEVELS, MAX_UPGRADE_LEVEL_V02 } from '../../../game/config/hardware.config';
import { calcUpgradeCost } from '../../../game/systems/hardware';
import { formatNumber } from '../../../utils/format';

export const HardwareUpgradeSection: React.FC = () => {
  const { compute, hardware, upgradeHardware } = useGameStore();

  return (
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
            {Object.values(hardware).every((h) => h.owned === 0)
              ? 'Buy hardware to unlock upgrades'
              : `All hardware at max level (Lv${MAX_UPGRADE_LEVEL_V02} cap)`}
          </div>
        )}
      </div>
    </div>
  );
};
