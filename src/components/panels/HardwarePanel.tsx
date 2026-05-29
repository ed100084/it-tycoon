import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { HARDWARE_DEFS, UPGRADE_LEVELS } from '../../game/config/hardware.config';
import {
  calcHardwareCost,
  calcBulkCost,
  getMaxAffordable,
} from '../../game/systems/hardware';
import {
  calcFreeRackUnits,
  calcMaxInstallableByRack,
} from '../../game/systems/facility';
import { calcProcurementRackUnits, requiresProcurement } from '../../game/systems/procurement';
import { formatNumber, formatCPS } from '../../utils/format';

type BuyMode = 1 | 10 | 100 | 'max';

export const HardwarePanel: React.FC = () => {
  const { compute, hardware, metrics, rackCapacity, procurementRequests, buyHardware } = useGameStore();
  const [buyMode, setBuyMode] = useState<BuyMode>(1);
  const reservedRackUnits = calcProcurementRackUnits(procurementRequests);
  const freeRackUnits = Math.max(0, calcFreeRackUnits(hardware, rackCapacity) - reservedRackUnits);
  const effectiveRackCapacity = rackCapacity - reservedRackUnits;

  const handleBuy = (tierId: string, qty: number) => {
    if (qty <= 0) return;
    buyHardware(tierId, qty);
  };

  const getQty = (tierId: string): number => {
    const hw = hardware[tierId];
    if (buyMode === 'max') {
      return Math.min(
        getMaxAffordable(tierId, hw?.owned ?? 0, compute),
        calcMaxInstallableByRack(tierId, hardware, effectiveRackCapacity)
      );
    }
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

  // Unlock gate: show hardware only if player owns >= unlockAt of the previous tier
  const isVisible = (tier: number): boolean => {
    if (tier === 0) return true;
    const prevTier = HARDWARE_DEFS[tier - 1];
    const def = HARDWARE_DEFS[tier];
    return (hardware[prevTier.id]?.owned ?? 0) >= def.unlockAt;
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
          const requiredRackUnits = def.uSize * qty;
          const maxByRack = calcMaxInstallableByRack(def.id, hardware, effectiveRackCapacity);
          const hasSpace = qty > 0 && requiredRackUnits <= freeRackUnits;
          const blockedByRack = qty > 0 ? requiredRackUnits > freeRackUnits : maxByRack <= 0;
          const canAfford = compute >= cost;
          const procurementRequired = requiresProcurement(def.id);
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
                {procurementRequired && (
                  <div className="hw-procurement-badge">PR</div>
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
                <span className={`hw-stat rack ${requiredRackUnits > freeRackUnits ? 'capacity-blocked' : ''}`}>
                  {hw.owned > 0 ? `${def.uSize * hw.owned}U used` : `${def.uSize}U / unit`}
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
                  className={`crt-btn hw-buy-btn ${canAfford && hasSpace ? '' : 'disabled'}`}
                  onClick={() => handleBuy(def.id, qty)}
                  disabled={!canAfford || !hasSpace}
                >
                  {blockedByRack
                    ? '[ NO RACK SPACE ]'
                    : buyMode === 'max' && qty === 0
                    ? '[ INSUFFICIENT ]'
                    : procurementRequired
                      ? `[ SUBMIT PR ×${buyMode === 'max' ? qty : buyMode} ]`
                      : `[ BUY ×${buyMode === 'max' ? qty : buyMode} ]`}
                </button>
                <span className={`hw-cost ${canAfford && hasSpace ? 'glow-green' : 'glow-red'}`}>
                  {qty === 0 ? '---' : formatNumber(cost) + ' CF'}
                </span>
              </div>

              <div className={`hw-capacity ${hasSpace ? '' : 'capacity-blocked'}`}>
                Rack need: {requiredRackUnits}U · Free: {freeRackUnits}U
                {reservedRackUnits > 0 && ` · Reserved PR: ${reservedRackUnits}U`}
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
