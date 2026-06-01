import React, { useState } from 'react';
import {
  ChangeType,
  ChangeStatus,
} from '../../game/core/types';
import type { ChangeManagementState } from '../../game/core/types';

interface ChangeManagementPanelProps {
  cmState: ChangeManagementState | null;
  onSubmitChange: (type: ChangeType, title: string) => void;
  onEnableCAB: () => void;
  onDisableCAB: () => void;
}

const TYPE_LABELS: Record<ChangeType, string> = {
  [ChangeType.Standard]:  '標準',
  [ChangeType.Normal]:    '一般',
  [ChangeType.Emergency]: '緊急',
};

const TYPE_COLORS: Record<ChangeType, string> = {
  [ChangeType.Standard]:  'var(--accent-green)',
  [ChangeType.Normal]:    'var(--accent-cyan)',
  [ChangeType.Emergency]: 'var(--accent-red)',
};

const STATUS_LABELS: Record<ChangeStatus, string> = {
  [ChangeStatus.Pending]:   '待審',
  [ChangeStatus.Approved]:  '已核准',
  [ChangeStatus.Executing]: '執行中',
  [ChangeStatus.Completed]: '已完成',
  [ChangeStatus.Failed]:    '失敗',
  [ChangeStatus.Rejected]:  '已拒絕',
};

const STATUS_COLORS: Record<ChangeStatus, string> = {
  [ChangeStatus.Pending]:   'var(--accent-yellow)',
  [ChangeStatus.Approved]:  'var(--accent-cyan)',
  [ChangeStatus.Executing]: 'var(--accent-yellow)',
  [ChangeStatus.Completed]: 'var(--accent-green)',
  [ChangeStatus.Failed]:    'var(--accent-red)',
  [ChangeStatus.Rejected]:  '#f97316',
};

function maturityColor(level: number): string {
  if (level <= 1) return 'var(--accent-red)';
  if (level <= 3) return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

function maturityLabel(level: number): string {
  const labels = ['初始', '重複', '已定義', '受管理', '量化', '最佳化'];
  return labels[Math.min(level, 5)] ?? '最佳化';
}

export const ChangeManagementPanel: React.FC<ChangeManagementPanelProps> = ({
  cmState,
  onSubmitChange,
  onEnableCAB,
  onDisableCAB,
}) => {
  const [formType, setFormType] = useState<ChangeType>(ChangeType.Standard);
  const [formTitle, setFormTitle] = useState('');

  if (!cmState) {
    return (
      <div className="crt-panel change-management-panel">
        <div className="panel-header">📋 變更管理 (ITIL)</div>
        <div className="panel-body" style={{ opacity: 0.5 }}>尚未初始化</div>
      </div>
    );
  }

  const {
    maturityLevel,
    totalChanges,
    shadowChangeCount,
    cabEnabled,
    pendingChanges,
    changeLog,
  } = cmState;

  const mColor = maturityColor(maturityLevel);
  const mLabel = maturityLabel(maturityLevel);

  function handleSubmit() {
    const trimmed = formTitle.trim();
    if (!trimmed) return;
    onSubmitChange(formType, trimmed);
    setFormTitle('');
  }

  const logSlice = changeLog.slice(-5).reverse();

  return (
    <div className="crt-panel change-management-panel">
      <div className="panel-header">📋 變更管理 (ITIL)</div>
      <div className="panel-body">

        {/* Maturity */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ opacity: 0.7 }}>ITIL 成熟度：</span>
          <span style={{ color: mColor, fontWeight: 'bold' }}>
            Lv.{maturityLevel} — {mLabel}
          </span>
          <span style={{ marginLeft: 8, opacity: 0.6, fontSize: '0.85em' }}>(0–5)</span>
        </div>

        {/* Totals */}
        <div style={{ marginBottom: 8, fontSize: '0.9em' }}>
          <span style={{ opacity: 0.7 }}>總變更數：</span>
          <span style={{ fontWeight: 'bold' }}>{totalChanges}</span>
          <span style={{ marginLeft: 16, opacity: 0.7 }}>影子變更：</span>
          <span style={{ color: shadowChangeCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 'bold' }}>
            {shadowChangeCount}
          </span>
        </div>

        {/* CAB */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ opacity: 0.7 }}>CAB 狀態：</span>
          <span style={{ color: cabEnabled ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 'bold' }}>
            {cabEnabled ? '啟用' : '停用'}
          </span>
          {cabEnabled ? (
            <button className="crt-btn" style={{ fontSize: '0.82em' }} onClick={onDisableCAB}>
              停用 CAB
            </button>
          ) : (
            <button className="crt-btn" style={{ fontSize: '0.82em' }} onClick={onEnableCAB}>
              啟用 CAB
            </button>
          )}
        </div>

        {/* Pending Changes */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ opacity: 0.7, marginBottom: 4, fontSize: '0.88em' }}>
            待處理變更 ({pendingChanges.length})：
          </div>
          {pendingChanges.length === 0 ? (
            <div style={{ opacity: 0.45, fontSize: '0.85em' }}>— 無待處理變更 —</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pendingChanges.map(req => (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.85em',
                    padding: '3px 6px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 3,
                  }}
                >
                  <span
                    style={{
                      color: TYPE_COLORS[req.type],
                      border: `1px solid ${TYPE_COLORS[req.type]}`,
                      borderRadius: 3,
                      padding: '0 5px',
                      fontSize: '0.82em',
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_LABELS[req.type]}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.title}
                  </span>
                  <span style={{ color: STATUS_COLORS[req.status], flexShrink: 0 }}>
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Change Form */}
        <div
          style={{
            marginBottom: 14,
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ opacity: 0.7, marginBottom: 6, fontSize: '0.88em' }}>提交新變更：</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="crt-select"
              value={formType}
              onChange={e => setFormType(e.target.value as ChangeType)}
              style={{ fontSize: '0.85em' }}
            >
              {Object.values(ChangeType).map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <input
              className="crt-input"
              type="text"
              placeholder="變更標題（最多 30 字）"
              maxLength={30}
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              style={{ flex: 1, minWidth: 120, fontSize: '0.85em' }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
            <button
              className="crt-btn"
              style={{ fontSize: '0.85em', flexShrink: 0 }}
              onClick={handleSubmit}
              disabled={!formTitle.trim()}
            >
              提交
            </button>
          </div>
        </div>

        {/* Change Log */}
        <div>
          <div style={{ opacity: 0.7, marginBottom: 4, fontSize: '0.88em' }}>
            變更記錄（最近 5 筆）：
          </div>
          {logSlice.length === 0 ? (
            <div style={{ opacity: 0.45, fontSize: '0.85em' }}>— 尚無記錄 —</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {logSlice.map(req => (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.82em',
                    opacity: 0.85,
                  }}
                >
                  <span style={{ color: TYPE_COLORS[req.type], flexShrink: 0 }}>
                    [{TYPE_LABELS[req.type]}]
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.title}
                  </span>
                  <span
                    style={{
                      color: req.status === ChangeStatus.Completed
                        ? 'var(--accent-green)'
                        : req.status === ChangeStatus.Failed
                          ? 'var(--accent-red)'
                          : STATUS_COLORS[req.status],
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
