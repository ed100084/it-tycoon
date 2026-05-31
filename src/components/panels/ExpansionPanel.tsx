import React from 'react';
import type { AcquisitionTarget } from '../../game/core/types';
import { AcquisitionStatus } from '../../game/core/types';

interface ExpansionPanelProps {
  targets: AcquisitionTarget[];
  currentYear: number;
  hasSecondFacility: boolean;
  onAcquire: (targetId: string) => void;
  onOpenFacility: () => void;
}

const STATUS_LABELS: Record<AcquisitionStatus, string> = {
  [AcquisitionStatus.Available]:   '可收購',
  [AcquisitionStatus.Integrating]: '整合中',
  [AcquisitionStatus.Completed]:   '已完成',
  [AcquisitionStatus.Declined]:    '已婉拒',
};

const STATUS_COLORS: Record<AcquisitionStatus, string> = {
  [AcquisitionStatus.Available]:   'var(--accent-cyan)',
  [AcquisitionStatus.Integrating]: 'var(--accent-yellow)',
  [AcquisitionStatus.Completed]:   'var(--accent-green)',
  [AcquisitionStatus.Declined]:    'var(--fg-dim, #666)',
};

function fmtM(n: number): string {
  return `NT$${(n / 1_000_000).toFixed(1)}M`;
}

export const ExpansionPanel: React.FC<ExpansionPanelProps> = ({
  targets,
  currentYear,
  hasSecondFacility,
  onAcquire,
  onOpenFacility,
}) => {
  const acquisitionUnlocked = currentYear >= 2008;
  const facilityUnlocked = currentYear >= 2010;

  return (
    <div className="crt-panel expansion-panel">
      <div className="panel-header">🏢 併購與擴張</div>
      <div className="panel-body">

        {/* Second Facility */}
        <div className="expansion-section">
          <div className="expansion-section-title" style={{ color: 'var(--accent-cyan)' }}>
            異地機房（{facilityUnlocked ? '已解鎖' : `${2010} 年解鎖`}）
          </div>
          {hasSecondFacility ? (
            <div style={{ color: 'var(--accent-green)' }}>✓ 第二機房已開設（DR 能力 +50%）</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <span style={{ opacity: 0.7, fontSize: '0.88em' }}>成本 NT$50M | DR 能力 +50%</span>
              <button
                className="crt-btn"
                disabled={!facilityUnlocked}
                onClick={onOpenFacility}
              >
                開設異地機房
              </button>
            </div>
          )}
        </div>

        {/* Acquisitions */}
        <div className="expansion-section" style={{ marginTop: 16 }}>
          <div className="expansion-section-title" style={{ color: 'var(--accent-purple, #c084fc)' }}>
            IDC 併購（{acquisitionUnlocked ? '已解鎖' : `${2008} 年解鎖`}）
          </div>
          {!acquisitionUnlocked && (
            <div style={{ opacity: 0.6, marginTop: 6 }}>2008 年後解鎖</div>
          )}
          {acquisitionUnlocked && targets.map(target => {
            const available = target.status === AcquisitionStatus.Available && target.availableFromYear <= currentYear;
            const cost = Math.round(target.annualRevenue * target.acquisitionMultiplier);
            return (
              <div key={target.id} className="expansion-target-card">
                <div className="target-header">
                  <span className="target-name">{target.name}</span>
                  <span style={{ color: STATUS_COLORS[target.status], marginLeft: 8 }}>
                    [{STATUS_LABELS[target.status]}]
                  </span>
                </div>
                <div className="target-details">
                  <span>📍 {target.city}</span>
                  <span style={{ marginLeft: 12 }}>收購價 {fmtM(cost)}</span>
                  <span style={{ marginLeft: 12 }}>客戶 +{target.customerCount}</span>
                  <span style={{ marginLeft: 12, color: 'var(--accent-yellow)' }}>
                    技術債 +{target.techDebtInherit}
                  </span>
                </div>
                {target.availableFromYear > currentYear && (
                  <div style={{ opacity: 0.6, fontSize: '0.82em' }}>
                    {target.availableFromYear} 年後可收購
                  </div>
                )}
                {available && (
                  <button
                    className="crt-btn"
                    style={{ marginTop: 6 }}
                    onClick={() => onAcquire(target.id)}
                  >
                    啟動收購
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
