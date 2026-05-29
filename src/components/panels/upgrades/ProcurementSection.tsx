import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import { HARDWARE_DEFS } from '../../../game/config/hardware.config';
import { formatDuration, formatNumber } from '../../../utils/format';

export const ProcurementSection: React.FC = () => {
  const { procurementRequests, gameTime } = useGameStore();

  return (
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
  );
};
