import React from 'react';
import {
  RegulationId,
  RegComplianceStatus,
  type RegulatoryState,
} from '../../game/core/types';

interface RegulatoryPanelProps {
  regulatoryState: RegulatoryState | null;
  currentYear: number;
  onStartCompliance: (id: RegulationId) => void;
}

interface RegMeta {
  name: string;
  effectiveYear: number;
  annualMaintenanceCostNTD: number;
}

const REGULATION_META: Record<RegulationId, RegMeta> = {
  [RegulationId.FSC_InfoSec]:    { name: '金管會資安管理辦法', effectiveYear: 2005, annualMaintenanceCostNTD: 120_000 },
  [RegulationId.PersonalData]:   { name: '個資法',             effectiveYear: 2012, annualMaintenanceCostNTD: 200_000 },
  [RegulationId.GDPR]:           { name: 'GDPR',               effectiveYear: 2018, annualMaintenanceCostNTD: 400_000 },
  [RegulationId.CriticalInfra]:  { name: '資安管理法',         effectiveYear: 2020, annualMaintenanceCostNTD: 500_000 },
  [RegulationId.DigitalEconomy]: { name: '數位經濟法草案',     effectiveYear: 2023, annualMaintenanceCostNTD:  80_000 },
};

const STATUS_LABEL: Record<RegComplianceStatus, string> = {
  [RegComplianceStatus.NotActive]:    '未生效',
  [RegComplianceStatus.InProgress]:   '處理中',
  [RegComplianceStatus.Compliant]:    '已合規',
  [RegComplianceStatus.NonCompliant]: '未合規',
};

const STATUS_COLOR: Record<RegComplianceStatus, string> = {
  [RegComplianceStatus.NotActive]:    'var(--fg-dim, #666)',
  [RegComplianceStatus.InProgress]:   'var(--accent-yellow, #e6c84a)',
  [RegComplianceStatus.Compliant]:    'var(--accent-green, #4ae68a)',
  [RegComplianceStatus.NonCompliant]: 'var(--accent-red, #e64a4a)',
};

function fmtDate(d: { year: number; month: number } | null): string {
  if (!d) return '—';
  return `${d.year}/${String(d.month).padStart(2, '0')}`;
}

export const RegulatoryPanel: React.FC<RegulatoryPanelProps> = ({
  regulatoryState,
  currentYear,
  onStartCompliance,
}) => {
  if (!regulatoryState) {
    return (
      <div className="crt-panel regulatory-panel">
        <div className="panel-header">📜 法規遵循</div>
        <div className="panel-body" style={{ opacity: 0.5 }}>載入中…</div>
      </div>
    );
  }

  const { complianceStatus, totalFines, auditHistory, nextAuditDate } = regulatoryState;

  const activeRegs = (Object.values(RegulationId) as RegulationId[]).filter(
    id => REGULATION_META[id].effectiveYear <= currentYear,
  );

  const recentAuditHistory = [...auditHistory].reverse().slice(0, 5);

  return (
    <div className="crt-panel regulatory-panel">
      <div className="panel-header">📜 法規遵循</div>
      <div className="panel-body">

        {/* Summary row */}
        <div className="reg-summary-row" style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <span style={{ opacity: 0.6, fontSize: '0.85em' }}>累計罰款</span>
            <div
              style={{
                fontSize: '1.15em',
                fontWeight: 700,
                color: totalFines > 0 ? 'var(--accent-red, #e64a4a)' : 'inherit',
              }}
            >
              NT${totalFines.toLocaleString()}
            </div>
          </div>
          <div>
            <span style={{ opacity: 0.6, fontSize: '0.85em' }}>下次稽核日期</span>
            <div style={{ fontSize: '1.15em', fontWeight: 700 }}>
              {fmtDate(nextAuditDate)}
            </div>
          </div>
        </div>

        {/* Regulations list */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.9em', fontWeight: 600, marginBottom: 8, opacity: 0.8 }}>法規清單</div>
          <div className="reg-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeRegs.map(id => {
              const meta = REGULATION_META[id];
              const status = complianceStatus[id] ?? RegComplianceStatus.NotActive;
              const color = STATUS_COLOR[status];
              const canStart = status !== RegComplianceStatus.InProgress && status !== RegComplianceStatus.Compliant;
              return (
                <div
                  key={id}
                  className="reg-card"
                  style={{
                    background: 'var(--bg-card, rgba(255,255,255,0.04))',
                    border: '1px solid var(--border, rgba(255,255,255,0.1))',
                    borderRadius: 6,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600 }}>{meta.name}</div>
                    <div style={{ fontSize: '0.78em', opacity: 0.55 }}>施行年：{meta.effectiveYear}</div>
                  </div>

                  <span
                    style={{
                      color,
                      fontSize: '0.82em',
                      fontWeight: 700,
                      border: `1px solid ${color}`,
                      borderRadius: 4,
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {STATUS_LABEL[status]}
                  </span>

                  {status === RegComplianceStatus.Compliant && (
                    <span style={{ fontSize: '0.78em', opacity: 0.65, whiteSpace: 'nowrap' }}>
                      年維護 NT${meta.annualMaintenanceCostNTD.toLocaleString()}
                    </span>
                  )}

                  <button
                    className="crt-btn"
                    style={{ fontSize: '0.8em', whiteSpace: 'nowrap' }}
                    disabled={!canStart}
                    onClick={() => onStartCompliance(id)}
                  >
                    開始合規
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Audit history */}
        {recentAuditHistory.length > 0 && (
          <div>
            <div style={{ fontSize: '0.9em', fontWeight: 600, marginBottom: 8, opacity: 0.8 }}>稽核紀錄（最近 5 筆）</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82em' }}>
              <thead>
                <tr style={{ opacity: 0.55, textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>日期</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>法規</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>結果</th>
                  <th style={{ padding: '4px 8px', fontWeight: 500 }}>罰款</th>
                </tr>
              </thead>
              <tbody>
                {recentAuditHistory.map((rec, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: '1px solid var(--border, rgba(255,255,255,0.07))',
                      color: rec.passed ? 'var(--accent-green, #4ae68a)' : 'var(--accent-red, #e64a4a)',
                    }}
                  >
                    <td style={{ padding: '5px 8px' }}>{fmtDate(rec.date)}</td>
                    <td style={{ padding: '5px 8px', color: 'inherit' }}>
                      {REGULATION_META[rec.regulationId]?.name ?? rec.regulationId}
                    </td>
                    <td style={{ padding: '5px 8px', fontWeight: 700 }}>
                      {rec.passed ? '通過' : '未通過'}
                    </td>
                    <td style={{ padding: '5px 8px' }}>
                      {rec.fine > 0 ? `NT$${rec.fine.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
