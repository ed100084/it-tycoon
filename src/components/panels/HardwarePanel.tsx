import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HARDWARE_DEFS, UPGRADE_LEVELS } from '../../game/config/hardware.config';
import {
  calcHardwareCost,
  calcBulkCost,
  getMaxAffordable,
} from '../../game/systems/hardware';
import { formatNumber, formatCPS } from '../../utils/format';

type BuyMode = 1 | 10 | 100 | 'max';

export const HardwarePanel: React.FC = () => {
  const { compute, hardware, metrics, buyHardware } = useGameStore();
  const [buyMode, setBuyMode] = useState<BuyMode>(1);

  const handleBuy = (tierId: string, qty: number) => {
    if (qty <= 0) return;
    buyHardware(tierId, qty);
  };

  const getQty = (tierId: string): number => {
    const hw = hardware[tierId];
    if (buyMode === 'max') return getMaxAffordable(tierId, hw?.owned ?? 0, compute);
    return buyMode;
  };

  const getCost = (tierId: string): number => {
    const hw = hardware[tierId];
    const qty = getQty(tierId);
    if (qty <= 0) return Infinity;
    return qty === 1
      ? calcHardwareCost(tierId, hw?.owned ?? 0)
      : calcBulkCost(tierId, hw?.owned ?? 0, qty);
  };

  // Unlock gate: show hardware only if player has at least 1 of the previous tier
  const isVisible = (tier: number): boolean => {
    if (tier === 0) return true;
    const prevTier = HARDWARE_DEFS[tier - 1];
    return (hardware[prevTier.id]?.owned ?? 0) >= 1;
  };

  return (
    <div className="panel hardware-panel">
      <div className="panel-header">
        <span>◈ HARDWARE STORE</span>
        <div className="buy-mode-selector">
          {(['1', '10', '100', 'max'] as const).map((m) => (
            <button
              key={m}
              className={`buy-mode-btn ${buyMode === (m === 'max' ? 'max' : Number(m)) ? 'active' : ''}`}
              onClick={() => setBuyMode(m === 'max' ? 'max' : (Number(m) as BuyMode))}
            >
              ×{m}
            </button>
          ))}
        </div>
      </div>

      <div className="hardware-list">
        {HARDWARE_DEFS.filter((_, i) => isVisible(i)).map((def) => {
          const hw = hardware[def.id] ?? { owned: 0, upgradeLevel: 1 };
          const qty = getQty(def.id);
          const cost = getCost(def.id);
          const canAfford = compute >= cost;
          const hwMetrics = metrics.perHardware[def.id];
          const upgradeInfo = UPGRADE_LEVELS[hw.upgradeLevel - 1];

          return (
            <div key={def.id} className={`hardware-card ${hw.owned > 0 ? 'owned' : 'unowned'}`}>
              {/* Card header */}
              <div className="hw-card-top">
                <div className="hw-tier-badge">[{def.id}]</div>
                <div className="hw-name">{def.name}</div>
                <div className="hw-owned">
                  <span className="owned-count">{hw.owned}</span>
                  <span className="owned-label"> units</span>
                </div>
                {hw.upgradeLevel > 1 && (
                  <div className="hw-upgrade-badge">Lv{hw.upgradeLevel}</div>
                )}
              </div>

              {/* Stats row */}
              <div className="hw-stats">
                <span className="hw-stat">
                  <span className="stat-icon">▲</span>
                  {formatCPS(def.baseCps * hw.owned * upgradeInfo.multiplier)}
                </span>
                <span className="hw-stat power">
                  <span className="stat-icon">⚡</span>
                  {formatNumber(def.watts * hw.owned)} W
                </span>
                {hwMetrics && (
                  <span className="hw-stat net">
                    NET: {formatCPS(hwMetrics.cps - hwMetrics.power)}
                  </span>
                )}
              </div>

              {/* Base stats for unowned */}
              {hw.owned === 0 && (
                <div className="hw-base-stats">
                  {def.baseCps}/s · {def.watts}W · {def.uSize}U
                </div>
              )}

              {/* Buy button */}
              <div className="hw-buy-row">
                <button
                  className={`crt-btn hw-buy-btn ${canAfford && qty > 0 ? '' : 'disabled'}`}
                  onClick={() => handleBuy(def.id, qty)}
                  disabled={!canAfford || qty <= 0}
                >
                  {buyMode === 'max' && qty === 0
                    ? '[ INSUFFICIENT ]'
                    : `[ BUY ×${buyMode === 'max' ? qty : buyMode} ]`}
                </button>
                <span className={`hw-cost ${canAfford && qty > 0 ? 'glow-green' : 'glow-red'}`}>
                  {qty === 0 ? '---' : formatNumber(cost) + ' CF'}
                </span>
              </div>

              {/* Description (tooltip on hover via title) */}
              <div className="hw-desc" title={def.description}>
                {hw.owned === 0 ? def.description : `${def.uSize}U / unit · Base: ${def.baseCps} CPS`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
