import React from 'react';
import type { ComplianceCertRecord } from '../../game/core/types';
import { ComplianceCertType, ComplianceCertStatus } from '../../game/core/types';

interface CompliancePanelProps {
  certs: ComplianceCertRecord[];
  currentYear: number;
  onStartAcquisition: (type: ComplianceCertType) => void;
}

const CERT_NAMES: Record<ComplianceCertType, string> = {
  [ComplianceCertType.ISO_27001]: 'ISO 27001 資訊安全管理',
  [ComplianceCertType.SOC2]:      'SOC 2 雲端服務稽核',
  [ComplianceCertType.HIPAA]:     'HIPAA 醫療隱私',
  [ComplianceCertType.PCI_DSS]:   'PCI DSS 支付卡安全',
  [ComplianceCertType.ISO_20000]: 'ISO 20000 ITSM 服務管理',
  [ComplianceCertType.CSA_STAR]:  'CSA STAR 雲端安全',
};

const STATUS_COLORS: Record<ComplianceCertStatus, string> = {
  [ComplianceCertStatus.NotAcquired]: 'var(--fg-dim, #666)',
  [ComplianceCertStatus.InProgress]:  'var(--accent-yellow)',
  [ComplianceCertStatus.Active]:      'var(--accent-green)',
  [ComplianceCertStatus.Renewal]:     'var(--accent-cyan)',
  [ComplianceCertStatus.Expired]:     'var(--accent-red)',
};

const STATUS_LABELS: Record<ComplianceCertStatus, string> = {
  [ComplianceCertStatus.NotAcquired]: '未取得',
  [ComplianceCertStatus.InProgress]:  '申請中',
  [ComplianceCertStatus.Active]:      '有效',
  [ComplianceCertStatus.Renewal]:     '續審中',
  [ComplianceCertStatus.Expired]:     '已過期',
};

const CERT_DESC: Record<ComplianceCertType, string> = {
  [ComplianceCertType.ISO_27001]: '政府合約必備 | 需 2 位資安人員',
  [ComplianceCertType.SOC2]:      '雲端企業客戶要求',
  [ComplianceCertType.HIPAA]:     '醫療產業必備',
  [ComplianceCertType.PCI_DSS]:   '金融/電商必備',
  [ComplianceCertType.ISO_20000]: 'ITSM 成熟度認證',
  [ComplianceCertType.CSA_STAR]:  '雲端安全認證',
};

function fmtDate(d: { year: number; month: number } | null): string {
  if (!d) return '—';
  return `${d.year}/${String(d.month).padStart(2, '0')}`;
}

export const CompliancePanel: React.FC<CompliancePanelProps> = ({
  certs,
  onStartAcquisition,
}) => {
  const expiredCount = certs.filter(c => c.status === ComplianceCertStatus.Expired).length;

  return (
    <div className="crt-panel compliance-panel">
      <div className="panel-header">
        📜 合規認證管理
        {expiredCount > 0 && (
          <span style={{ color: 'var(--accent-red)', marginLeft: 12 }}>⚠ {expiredCount} 個認證已過期</span>
        )}
      </div>
      <div className="panel-body">
        <div className="compliance-grid">
          {certs.map(cert => {
            const color = STATUS_COLORS[cert.status];
            const canApply = cert.status === ComplianceCertStatus.NotAcquired || cert.status === ComplianceCertStatus.Expired;
            return (
              <div key={cert.type} className="compliance-cert-card">
                <div className="cert-card-header">
                  <span className="cert-name">{CERT_NAMES[cert.type]}</span>
                  <span className="cert-status-badge" style={{ color }}>
                    {STATUS_LABELS[cert.status]}
                  </span>
                </div>
                <div className="cert-desc" style={{ opacity: 0.7, fontSize: '0.82em' }}>
                  {CERT_DESC[cert.type]}
                </div>
                {cert.status === ComplianceCertStatus.InProgress && (
                  <div className="cert-progress-row">
                    <div className="cert-progress-bar-bg">
                      <div
                        className="cert-progress-bar"
                        style={{
                          width: `${Math.round((cert.progressMonths / cert.requiredMonths) * 100)}%`,
                          background: 'var(--accent-yellow)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.8em', marginLeft: 6 }}>
                      {cert.progressMonths}/{cert.requiredMonths} 個月
                    </span>
                  </div>
                )}
                {cert.status === ComplianceCertStatus.Active && (
                  <div style={{ fontSize: '0.82em', color: 'var(--accent-green)' }}>
                    到期：{fmtDate(cert.expiresAt)}
                  </div>
                )}
                {cert.status === ComplianceCertStatus.Renewal && (
                  <div style={{ fontSize: '0.82em', color: 'var(--accent-cyan)' }}>
                    續審中 {cert.progressMonths}/{cert.requiredMonths} 個月
                  </div>
                )}
                <div className="cert-card-footer">
                  <span style={{ fontSize: '0.78em', opacity: 0.6 }}>
                    年費 NT${cert.annualRenewalCost.toLocaleString()}
                  </span>
                  {canApply && (
                    <button
                      className="crt-btn"
                      style={{ marginLeft: 8, fontSize: '0.8em' }}
                      onClick={() => onStartAcquisition(cert.type)}
                    >
                      申請認證
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
