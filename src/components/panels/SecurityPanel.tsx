import React from 'react';
import { IncidentSeverity, IncidentType } from '../../game/core/types';
import type { Incident, DRDrill } from '../../game/core/types';

const SEV_COLORS: Record<IncidentSeverity, string> = {
  [IncidentSeverity.P1]: 'var(--tm-red)',
  [IncidentSeverity.P2]: '#ff8844',
  [IncidentSeverity.P3]: 'var(--tm-yellow)',
  [IncidentSeverity.P4]: '#aaaaaa',
};

const TYPE_LABELS: Partial<Record<IncidentType, string>> = {
  [IncidentType.HardwareFailure]:   '硬體故障',
  [IncidentType.NetworkOutage]:     '網路中斷',
  [IncidentType.CapacityAlarm]:     '容量告警',
  [IncidentType.PowerAnomaly]:      '電力異常',
  [IncidentType.CoolingFailure]:    '冷卻故障',
  [IncidentType.Ransomware]:        '勒索軟體',
  [IncidentType.DataBreach]:        '資料外洩',
  [IncidentType.SocialEngineering]: '社交工程',
  [IncidentType.APTAttack]:         'APT 攻擊',
  [IncidentType.DDoS]:              'DDoS',
  [IncidentType.ComplianceGap]:     '合規缺口',
  [IncidentType.InsiderThreat]:     '內部威脅',
  [IncidentType.SupplyChainAttack]: '供應鏈攻擊',
};

interface Props {
  activeIncidents: Incident[];
  securityPostureScore: number;
  securityComplianceScore: number;
  drDrills?: DRDrill[];
  onStartDRDrill?: (cost: number) => void;
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
        <span style={{ color: '#aaa' }}>{label}</span>
        <span style={{ color }}>{score.toFixed(0)}</span>
      </div>
      <div style={{ background: '#1a1a1a', borderRadius: 2, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, score)}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

const DR_DRILL_COST = 200_000;

export const SecurityPanel: React.FC<Props> = ({
  activeIncidents, securityPostureScore, securityComplianceScore,
  drDrills = [], onStartDRDrill,
}) => {
  const passedDrills = drDrills.filter(d => d.status === 'passed').length;
  const latestDrill = drDrills.length > 0 ? drDrills[drDrills.length - 1] : null;

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      {/* Scores */}
      <div style={{ marginBottom: 12 }}>
        <ScoreBar label="安全態勢" score={securityPostureScore} color={securityPostureScore >= 70 ? 'var(--tm-green)' : securityPostureScore >= 40 ? 'var(--tm-yellow)' : 'var(--tm-red)'} />
        <ScoreBar label="合規分數" score={securityComplianceScore} color={securityComplianceScore >= 80 ? 'var(--tm-green)' : securityComplianceScore >= 60 ? 'var(--tm-yellow)' : 'var(--tm-red)'} />
      </div>

      {/* DR Drill section */}
      <div style={{ marginBottom: 12, padding: '8px 10px', background: '#0d0d1a', borderRadius: 4, border: '1px solid #223' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ color: '#aaa', fontSize: 11 }}>🔄 DR 容災演練</div>
            <div style={{ color: '#555', fontSize: 10 }}>通過演練提升合規分數 +8%，費用 NT$200K</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--tm-cyan)', fontSize: 11 }}>通過：{passedDrills} 次</div>
          </div>
        </div>
        {latestDrill && (
          <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>
            最近一次：{latestDrill.startedAt.year}/{String(latestDrill.startedAt.month).padStart(2, '0')} —{' '}
            <span style={{ color: latestDrill.status === 'passed' ? 'var(--tm-green)' : latestDrill.status === 'failed' ? 'var(--tm-red)' : 'var(--tm-yellow)' }}>
              {latestDrill.status === 'passed' ? '通過' : latestDrill.status === 'failed' ? '失敗' : '進行中'}
            </span>
          </div>
        )}
        {onStartDRDrill && (
          <button onClick={() => onStartDRDrill(DR_DRILL_COST)} style={{
            padding: '3px 12px', fontSize: 11,
            background: '#0d1a0d', border: '1px solid #448844',
            borderRadius: 3, color: 'var(--tm-green)', cursor: 'pointer', width: '100%',
          }}>
            執行 DR 演練 (NT${(DR_DRILL_COST / 1000).toFixed(0)}K)
          </button>
        )}
      </div>

      {/* Active incidents */}
      <div style={{ borderTop: '1px solid #334', paddingTop: 8 }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>
          活躍事件 ({activeIncidents.length})
        </div>

        {activeIncidents.length === 0 ? (
          <div style={{ color: '#444', textAlign: 'center', padding: '16px 0', fontSize: 11 }}>
            ✓ 目前無活躍資安事件
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activeIncidents.map(inc => (
              <div key={inc.id} style={{
                padding: '6px 8px', background: '#0d0d1a',
                borderRadius: 3, border: `1px solid ${SEV_COLORS[inc.severity]}44`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ color: SEV_COLORS[inc.severity], fontWeight: 'bold', fontSize: 11 }}>
                    [{inc.severity}]
                  </span>
                  <span style={{ flex: 1 }}>{TYPE_LABELS[inc.type] ?? inc.type}</span>
                  <span style={{ color: '#666', fontSize: 10 }}>{inc.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#666' }}>
                  <span>已過 {inc.elapsedHours.toFixed(0)}h / 時限 {inc.deadlineHours}h</span>
                  {inc.isBreached && <span style={{ color: 'var(--tm-red)' }}>⚠ 超時</span>}
                  {inc.financialImpact > 0 && (
                    <span style={{ color: 'var(--tm-red)' }}>損失：NT${inc.financialImpact.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
