import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { formatNumber, formatCPS } from '../../utils/format';
import { PUE_DEFS } from '../../game/config/pue.config';
import {
  calcCrossRegionMultiplier,
  calcRackUtilization,
  calcUnlockedRegionCount,
  calcUsedRackUnits,
} from '../../game/systems/facility';
import { CAPACITY_WARNING_THRESHOLD } from '../../game/config/facility.config';
import { TECH_NODE_DEFS } from '../../game/config/tech.config';
import { ACHIEVEMENT_DEFS } from '../../game/config/achievement.config';

export const ResourceBar: React.FC = () => {
  const { compute, totalEarnedCompute, metrics, isShutdown, pueLevel, satisfaction, reputation, influence, prestigeCount, techNodes, unlockedAchievements, hardware, rackCapacity, facilityRegions, procurementRequests, auditEvents } = useGameStore();
  const currentPue = PUE_DEFS[pueLevel]?.pue ?? 2.0;
  const usedRackUnits = calcUsedRackUnits(hardware);
  const rackUtilization = calcRackUtilization(hardware, rackCapacity);
  const regionCount = calcUnlockedRegionCount(facilityRegions);
  const crossRegionMultiplier = calcCrossRegionMultiplier(facilityRegions);
  const rackClass = rackUtilization >= 1
    ? 'glow-red'
    : rackUtilization >= CAPACITY_WARNING_THRESHOLD
      ? 'glow-yellow'
      : 'glow-blue';

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
        <span className="res-label">RACK</span>
        <span className={`res-value ${rackClass}`}>{usedRackUnits}/{rackCapacity}U</span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">REGIONS</span>
        <span className={`res-value ${regionCount >= 2 ? 'glow-green' : 'glow-blue'}`}>
          {regionCount}/3{crossRegionMultiplier > 1 ? ' ×1.25' : ''}
        </span>
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
        <span className="res-label">PROCUREMENT</span>
        <span className={`res-value ${procurementRequests.length > 0 ? 'glow-yellow' : 'glow-green-dim'}`}>
          {procurementRequests.length} PR
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">AUDITS</span>
        <span className={`res-value ${auditEvents.length > 0 ? 'glow-red' : 'glow-green-dim'}`}>
          {auditEvents.length}
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">REPUTATION</span>
        <span className={`res-value ${reputation > 0 ? 'glow-purple' : 'glow-green-dim'}`}>
          {formatNumber(reputation, 0)} R
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">INFLUENCE</span>
        <span className={`res-value ${influence > 0 ? 'glow-purple' : 'glow-green-dim'}`}>
          {formatNumber(influence, 0)} I
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">TECH</span>
        <span className={`res-value ${techNodes.length > 0 ? 'glow-purple' : 'glow-green-dim'}`}>
          {techNodes.length}/{TECH_NODE_DEFS.length}
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">ACHIEVEMENTS</span>
        <span className={`res-value ${unlockedAchievements.length > 0 ? 'glow-yellow' : 'glow-green-dim'}`}>
          {unlockedAchievements.length}/{ACHIEVEMENT_DEFS.length}
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">PRESTIGE</span>
        <span className={`res-value ${prestigeCount > 0 ? 'glow-purple' : 'glow-green-dim'}`}>
          T{prestigeCount}
        </span>
      </div>

      <div className="resource-divider">║</div>

      <div className="resource-item">
        <span className="res-label">SATISFACTION</span>
        <span className={`res-value ${satisfaction >= 70 ? 'glow-green' : satisfaction >= 40 ? 'glow-yellow' : 'glow-red'}`}>
          {satisfaction.toFixed(0)}%
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
