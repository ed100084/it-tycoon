import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import { getAuditRemainingSeconds } from '../../../game/systems/audit';
import { formatDuration, formatNumber } from '../../../utils/format';

export const AuditSection: React.FC = () => {
  const { compute, auditEvents, resolvedAudits, failedAudits, gameTime, resolveAudit } = useGameStore();

  return (
    <div className="upgrade-section">
      <div className="upgrade-section-title">─── AUDIT EVENTS ───</div>

      <div className="audit-summary">
        <span>Passed: <span className="glow-green">{resolvedAudits}</span></span>
        <span>Failed: <span className={failedAudits > 0 ? 'glow-red' : 'glow-green-dim'}>{failedAudits}</span></span>
      </div>

      {auditEvents.length === 0 ? (
        <div className="audit-empty glow-green-dim">
          No active audits
        </div>
      ) : (
        <div className="audit-list">
          {auditEvents.map((audit) => {
            const remaining = getAuditRemainingSeconds(audit, gameTime);
            const canResolve = compute >= audit.responseCost;
            const urgencyClass = remaining < 20 ? 'glow-red' : remaining < 45 ? 'glow-yellow' : 'glow-blue';

            return (
              <div key={audit.id} className="audit-card">
                <div className="audit-card-top">
                  <span>{audit.title}</span>
                  <span className={urgencyClass}>{formatDuration(remaining)}</span>
                </div>
                <div className="audit-desc">{audit.description}</div>
                <div className="audit-meta">
                  Cost {formatNumber(audit.responseCost)} CF · Penalty -{audit.satisfactionPenalty}% satisfaction
                </div>
                <button
                  className={`crt-btn audit-btn ${canResolve ? '' : 'disabled'}`}
                  onClick={() => resolveAudit(audit.id)}
                  disabled={!canResolve}
                >
                  [ SUBMIT EVIDENCE ]
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
