import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import {
  calcCrossRegionMultiplier,
  calcRegionExpansionCost,
  calcRegionUnlockReady,
  calcRackUtilization,
  calcUsedRackUnits,
} from '../../../game/systems/facility';
import { CAPACITY_WARNING_THRESHOLD, FACILITY_REGION_DEFS } from '../../../game/config/facility.config';
import { formatNumber } from '../../../utils/format';

export const FacilitySection: React.FC = () => {
  const { compute, hardware, rackCapacity, facilityRegions, expandRegion, unlockRegion } = useGameStore();
  const usedRackUnits = calcUsedRackUnits(hardware);
  const rackUtilization = calcRackUtilization(hardware, rackCapacity);
  const crossRegionMultiplier = calcCrossRegionMultiplier(facilityRegions);

  return (
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
  );
};
