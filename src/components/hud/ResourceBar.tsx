import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { formatNumber, formatCPS } from '../../utils/format';
import { PUE_DEFS } from '../../game/config/pue.config';

export const ResourceBar: React.FC = () => {
  const { compute, totalEarnedCompute, metrics, isShutdown, pueLevel } = useGameStore();
  const currentPue = PUE_DEFS[pueLevel]?.pue ?? 2.0;

  return (
    <div className="resource-bar">
      <div className="resource-item compute-resource">
        <span className="res-label">COMPUTE</span>
        <span className="res-value glow-green">{formatNumber(compute)} CF</span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">NET CPS</span>
        <span className={`res-value ${metrics.netCPS >= 0 ? 'glow-green' : 'glow-red'}`}>
          {formatCPS(metrics.netCPS)}
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">POWER COST</span>
        <span className="res-value glow-yellow">
          -{formatNumber(metrics.totalPowerCost, 3)} CF/s
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">PUE</span>
        <span className="res-value glow-blue">{currentPue.toFixed(2)}</span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">STATUS</span>
        <span className={`res-value status-badge ${isShutdown ? 'shutdown' : 'online'}`}>
          {isShutdown ? '⚠ SHUTDOWN' : '● ONLINE'}
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">TOTAL</span>
        <span className="res-value glow-green-dim">{formatNumber(totalEarnedCompute)} CF</span>
      </div>
    </div>
  );
};
