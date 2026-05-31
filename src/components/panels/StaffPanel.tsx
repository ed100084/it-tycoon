import React, { useState } from 'react';
import { StaffRole, StaffStatus, ShiftMode } from '../../game/core/types';
import type { StaffMember, JobOpening, CertificationType } from '../../game/core/types';

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

const ALL_CERT_TYPES: CertificationType[] = ['CCNA', 'AWS_SAA', 'CISSP', 'ITIL', 'PMP'];

const CERT_LABELS: Record<CertificationType, string> = {
  CCNA:    'CCNA',
  AWS_SAA: 'AWS SAA',
  CISSP:   'CISSP',
  ITIL:    'ITIL',
  PMP:     'PMP',
};

interface Props {
  staffList: StaffMember[];
  jobOpenings: JobOpening[];
  shiftMode: ShiftMode | null;
  monthlyPayroll: number;
  onPostOpening: (role: StaffRole) => void;
  onHire: (openingId: string) => void;
  onLayoff: (staffId: string) => void;
  onSendForCertification?: (staffId: string, type: CertificationType) => void;
  onPayBonus?: () => void;
  onSetMentor?: (juniorId: string, mentorId: string | null) => void;
  onSetShiftMode?: (mode: ShiftMode) => void;
}

function MoraleBar({ morale }: { morale: number }) {
  const color = morale >= 70 ? 'var(--tm-green)' : morale >= 40 ? 'var(--tm-yellow)' : 'var(--tm-red)';
  return (
    <div title={`士氣：${morale}`} style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 50 }}>
      <div style={{ flex: 1, background: '#1a1a1a', height: 4, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${morale}%`, height: '100%', background: color }} />
      </div>
      <span style={{ color, fontSize: 9, minWidth: 18 }}>{morale}</span>
    </div>
  );
}

const SHIFT_LABELS: Record<ShiftMode, string> = {
  [ShiftMode.DayOnly]:    '日間制',
  [ShiftMode.TwoShift]:   '雙班制',
  [ShiftMode.ThreeShift]: '三班制',
  [ShiftMode.OnCall]:     'On-Call',
  [ShiftMode.AIOps]:      'AIOps',
};

export const StaffPanel: React.FC<Props> = ({
  staffList, jobOpenings, shiftMode, monthlyPayroll,
  onPostOpening, onHire, onLayoff,
  onSendForCertification, onPayBonus, onSetMentor, onSetShiftMode,
}) => {
  const [tab, setTab] = useState<'staff' | 'recruit' | 'develop'>('staff');
  const [selectedForCert, setSelectedForCert] = useState<string | null>(null);

  const readyToHire = jobOpenings.filter(o => o.status === 'interview_ready');
  const recruiting  = jobOpenings.filter(o => o.status === 'recruiting');

  const activeStaff = staffList.filter(s =>
    s.status === StaffStatus.Active || s.status === StaffStatus.Assigned || s.status === StaffStatus.InTraining,
  );

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, borderBottom: '1px solid #334', paddingBottom: 6 }}>
        {(['staff', 'recruit', 'develop'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '2px 10px', fontSize: 11,
            background: tab === t ? '#1a3a1a' : '#111',
            border: `1px solid ${tab === t ? '#558855' : '#334'}`,
            borderRadius: 3, color: tab === t ? 'var(--tm-green)' : '#777', cursor: 'pointer',
          }}>
            {t === 'staff' ? `員工 (${staffList.length})` : t === 'recruit' ? `招募 (${readyToHire.length})` : '人才培育'}
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
                  padding: '5px 8px', background: '#0d0d1a', borderRadius: 3,
                  border: '1px solid #223',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <MoraleBar morale={s.morale ?? 80} />
                    {s.certifications && s.certifications.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {s.certifications.map(c => (
                          <span key={c.type} style={{
                            fontSize: 9, padding: '1px 4px', borderRadius: 2,
                            background: '#0d1a0d', border: '1px solid #448844', color: 'var(--tm-green)',
                          }}>
                            {CERT_LABELS[c.type] ?? c.type}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.mentorId && (
                      <span style={{ fontSize: 9, color: '#88aaff' }}>
                        👨‍🏫 導師
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {shiftMode && (
            <div style={{ marginTop: 10, fontSize: 11 }}>
              <span style={{ opacity: 0.7 }}>排班制度：</span>
              <span style={{ color: '#88aaff', marginLeft: 4 }}>{SHIFT_LABELS[shiftMode] ?? shiftMode}</span>
              {onSetShiftMode && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {Object.values(ShiftMode).filter(m => m !== ShiftMode.AIOps).map(m => (
                    <button
                      key={m}
                      className={`crt-btn${shiftMode === m ? ' active' : ''}`}
                      style={{ fontSize: 10, padding: '2px 6px', ...(shiftMode === m ? { borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' } : {}) }}
                      onClick={() => onSetShiftMode(m)}
                    >
                      {SHIFT_LABELS[m]}
                    </button>
                  ))}
                </div>
              )}
              {shiftMode === ShiftMode.OnCall && (
                <div style={{ color: 'var(--accent-yellow)', fontSize: 10, marginTop: 4 }}>
                  ⚠ On-Call：夜間回應 ×1.5 | 士氣 -5/月 | 需人力 ×1.2
                </div>
              )}
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

      {tab === 'develop' && (
        <div>
          {/* Pay bonus */}
          {onPayBonus && (
            <div style={{ marginBottom: 12, padding: '8px 10px', background: '#0d1a0d', borderRadius: 4, border: '1px solid #334' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'var(--tm-green)', fontSize: 11, marginBottom: 2 }}>💰 發放績效獎金</div>
                  <div style={{ color: '#555', fontSize: 10 }}>全員士氣 +15，費用 = 月薪資總額</div>
                </div>
                <button onClick={onPayBonus} style={{
                  padding: '4px 12px', fontSize: 11,
                  background: '#0d1a0d', border: '1px solid #448844',
                  borderRadius: 3, color: 'var(--tm-green)', cursor: 'pointer',
                }}>發放</button>
              </div>
            </div>
          )}

          {/* Certifications */}
          {onSendForCertification && (
            <div>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>🏅 送訓認證</div>
              {activeStaff.length === 0 ? (
                <div style={{ color: '#444', textAlign: 'center', padding: '12px 0', fontSize: 11 }}>無可送訓員工</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {activeStaff.map(s => (
                    <div key={s.id} style={{
                      padding: '5px 8px', background: '#0d0d1a', borderRadius: 3, border: '1px solid #223',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ flex: 1 }}>{s.name}</span>
                        <span style={{ color: '#aaa', fontSize: 10 }}>{ROLE_LABELS[s.role]}</span>
                        <button
                          onClick={() => setSelectedForCert(selectedForCert === s.id ? null : s.id)}
                          style={{
                            padding: '1px 6px', fontSize: 10,
                            background: selectedForCert === s.id ? '#1a1a0d' : '#0d1a0d',
                            border: `1px solid ${selectedForCert === s.id ? 'var(--tm-yellow)' : '#448844'}`,
                            borderRadius: 3, color: selectedForCert === s.id ? 'var(--tm-yellow)' : 'var(--tm-green)', cursor: 'pointer',
                          }}
                        >
                          {selectedForCert === s.id ? '取消' : '選擇認證'}
                        </button>
                      </div>
                      {selectedForCert === s.id && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid #222' }}>
                          {ALL_CERT_TYPES.map((type: CertificationType) => {
                            const hasCert = s.certifications?.some(c => c.type === type);
                            return (
                              <button
                                key={type}
                                disabled={!!hasCert}
                                onClick={() => { onSendForCertification(s.id, type); setSelectedForCert(null); }}
                                style={{
                                  padding: '2px 6px', fontSize: 9,
                                  background: hasCert ? '#0a0a0a' : '#0d1a0d',
                                  border: `1px solid ${hasCert ? '#222' : '#448844'}`,
                                  borderRadius: 2, color: hasCert ? '#333' : '#aaccaa',
                                  cursor: hasCert ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {hasCert ? '✓ ' : ''}{CERT_LABELS[type] ?? type}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mentor assignments */}
          {onSetMentor && activeStaff.length > 1 && (
            <div style={{ marginTop: 12, borderTop: '1px solid #223', paddingTop: 10 }}>
              <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>👨‍🏫 導師制度</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {activeStaff.filter(s => !s.mentorId).map(junior => {
                  const potentialMentors = activeStaff.filter(m => m.id !== junior.id && m.monthsInService > junior.monthsInService);
                  if (potentialMentors.length === 0) return null;
                  return (
                    <div key={junior.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 8px', background: '#0d0d1a', borderRadius: 3, border: '1px solid #223',
                    }}>
                      <span style={{ flex: 1, fontSize: 11 }}>{junior.name}</span>
                      <select
                        defaultValue=""
                        onChange={e => { if (e.target.value) onSetMentor(junior.id, e.target.value); }}
                        style={{
                          background: '#0d1a0d', border: '1px solid #448844',
                          borderRadius: 3, color: '#aaccaa', padding: '1px 4px', fontSize: 10, cursor: 'pointer',
                        }}
                      >
                        <option value="">指派導師…</option>
                        {potentialMentors.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.monthsInService}m)</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {activeStaff.filter(s => s.mentorId).map(s => {
                  const mentor = activeStaff.find(m => m.id === s.mentorId);
                  return mentor ? (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 8px', background: '#0d0d1a', borderRadius: 3, border: '1px solid #223', fontSize: 11,
                    }}>
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span style={{ color: '#88aaff', fontSize: 10 }}>👨‍🏫 {mentor.name}</span>
                      <button
                        onClick={() => onSetMentor(s.id, null)}
                        style={{
                          padding: '1px 5px', fontSize: 9,
                          background: '#1a0d0d', border: '1px solid #553333',
                          borderRadius: 3, color: '#cc4444', cursor: 'pointer',
                        }}
                      >移除</button>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
