import React, { useState } from 'react';
import { StaffRole, StaffStatus, ShiftMode } from '../../game/core/types';
import type { StaffMember, JobOpening } from '../../game/core/types';

const ROLE_LABELS: Record<StaffRole, string> = {
  [StaffRole.E1_NOC]:       'E1 NOC 監控員',
  [StaffRole.E2_SysEng]:    'E2 系統工程師',
  [StaffRole.E3_SecAna]:    'E3 資安分析師',
  [StaffRole.E3_Senior]:    'E3 資深工程師',
  [StaffRole.E4_CloudArch]: 'E4 雲端架構師',
  [StaffRole.E4_AIEng]:     'E4 AI 工程師',
  [StaffRole.E5_CISO]:      'E5 資安長',
};

const STATUS_COLORS: Record<StaffStatus, string> = {
  [StaffStatus.Active]:        'var(--tm-green)',
  [StaffStatus.InTraining]:    'var(--tm-yellow)',
  [StaffStatus.Assigned]:      'var(--tm-cyan)',
  [StaffStatus.InRecruitment]: '#888',
  [StaffStatus.ResignPending]: 'var(--tm-red)',
  [StaffStatus.OnLeave]:       '#88aaff',
};

interface Props {
  staffList: StaffMember[];
  jobOpenings: JobOpening[];
  shiftMode: ShiftMode | null;
  monthlyPayroll: number;
  onPostOpening: (role: StaffRole) => void;
  onHire: (openingId: string) => void;
  onLayoff: (staffId: string) => void;
}

export const StaffPanel: React.FC<Props> = ({
  staffList, jobOpenings, shiftMode, monthlyPayroll,
  onPostOpening, onHire, onLayoff,
}) => {
  const [tab, setTab] = useState<'staff' | 'recruit'>('staff');

  const readyToHire = jobOpenings.filter(o => o.status === 'interview_ready');
  const recruiting  = jobOpenings.filter(o => o.status === 'recruiting');

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, borderBottom: '1px solid #334', paddingBottom: 6 }}>
        {(['staff', 'recruit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '2px 10px', fontSize: 11,
            background: tab === t ? '#1a3a1a' : '#111',
            border: `1px solid ${tab === t ? '#558855' : '#334'}`,
            borderRadius: 3, color: tab === t ? 'var(--tm-green)' : '#777', cursor: 'pointer',
          }}>
            {t === 'staff' ? `員工 (${staffList.length})` : `招募 (${readyToHire.length})`}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', color: 'var(--tm-red)', fontSize: 11 }}>
          月薪資：NT${monthlyPayroll.toLocaleString()}
        </div>
      </div>

      {tab === 'staff' && (
        <div>
          <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.values(StaffRole).map(role => (
              <button key={role} onClick={() => onPostOpening(role)} style={{
                padding: '2px 8px', fontSize: 10,
                background: '#0d1f0d', border: '1px solid #445544',
                borderRadius: 3, color: '#aaccaa', cursor: 'pointer',
              }}>
                + {ROLE_LABELS[role]}
              </button>
            ))}
          </div>

          {staffList.length === 0 ? (
            <div style={{ color: '#555', textAlign: 'center', padding: '20px 0' }}>尚無員工</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {staffList.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', background: '#0d0d1a', borderRadius: 3,
                  border: '1px solid #223',
                }}>
                  <span style={{ color: STATUS_COLORS[s.status], fontSize: 10, minWidth: 60 }}>{s.status}</span>
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <span style={{ color: '#aaa', fontSize: 10 }}>{ROLE_LABELS[s.role]}</span>
                  <span style={{ color: '#88aaff', fontSize: 10 }}>NT${s.monthlySalaryNTD.toLocaleString()}</span>
                  <span style={{ color: '#666', fontSize: 10 }}>{s.monthsInService}m</span>
                  <button onClick={() => onLayoff(s.id)} style={{
                    padding: '1px 5px', fontSize: 10,
                    background: '#1a0d0d', border: '1px solid #553333',
                    borderRadius: 3, color: '#cc4444', cursor: 'pointer',
                  }}>解僱</button>
                </div>
              ))}
            </div>
          )}

          {shiftMode && (
            <div style={{ marginTop: 8, color: '#555', fontSize: 10 }}>
              班別模式：<span style={{ color: '#88aaff' }}>{shiftMode}</span>
            </div>
          )}
        </div>
      )}

      {tab === 'recruit' && (
        <div>
          {readyToHire.length > 0 && (
            <div>
              <div style={{ color: 'var(--tm-green)', marginBottom: 6, fontSize: 11 }}>▸ 面試通過（可錄用）</div>
              {readyToHire.map(o => (
                <div key={o.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', background: '#0d1a0d', borderRadius: 3,
                  border: '1px solid #334', marginBottom: 4,
                }}>
                  <span style={{ flex: 1 }}>{o.candidateName}</span>
                  <span style={{ color: '#aaa', fontSize: 10 }}>{ROLE_LABELS[o.role]}</span>
                  <button onClick={() => onHire(o.id)} style={{
                    padding: '1px 8px', fontSize: 10,
                    background: '#0d1a0d', border: '1px solid #448844',
                    borderRadius: 3, color: 'var(--tm-green)', cursor: 'pointer',
                  }}>錄用</button>
                </div>
              ))}
            </div>
          )}

          {recruiting.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: '#777', marginBottom: 6, fontSize: 11 }}>▸ 招募中</div>
              {recruiting.map(o => (
                <div key={o.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', background: '#111', borderRadius: 3,
                  border: '1px solid #222', marginBottom: 4, color: '#666',
                }}>
                  <span style={{ flex: 1 }}>{ROLE_LABELS[o.role]}</span>
                  <span style={{ fontSize: 10 }}>
                    可面試：{o.availableDate.year}/{String(o.availableDate.month).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {readyToHire.length === 0 && recruiting.length === 0 && (
            <div style={{ color: '#555', textAlign: 'center', padding: '20px 0' }}>
              無待處理招募。點擊上方「員工」頁籤新增職缺。
            </div>
          )}
        </div>
      )}
    </div>
  );
};
