import React from 'react';
import type { KPITarget, BoardYearResult } from '../../game/core/types';

interface Props {
  boardKPIs: KPITarget[];
  boardYearResults: BoardYearResult[];
  boardGameOver: boolean;
  boardPendingReview: boolean;
  onAcknowledge: () => void;
}

function KPIRow({ kpi }: { kpi: KPITarget }) {
  const pct = kpi.targetValue > 0 ? Math.min(100, (kpi.currentValue / kpi.targetValue) * 100) : 0;
  const color = kpi.isAchieved ? 'var(--tm-green)' : pct >= 70 ? 'var(--tm-yellow)' : 'var(--tm-red)';

  return (
    <div style={{ padding: '6px 8px', background: '#0d0d1a', borderRadius: 3, border: `1px solid ${kpi.isAchieved ? '#224422' : '#332'}`, marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
        <span style={{ color: '#aaa' }}>{kpi.description}</span>
        <span style={{ color }}>
          {kpi.isAchieved ? '✓' : '✗'} {kpi.currentValue.toFixed(1)} / {kpi.targetValue.toFixed(1)}
        </span>
      </div>
      <div style={{ background: '#1a1a1a', borderRadius: 2, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export const BoardPanel: React.FC<Props> = ({
  boardKPIs, boardYearResults, boardGameOver, boardPendingReview, onAcknowledge,
}) => {
  const achievedCount = boardKPIs.filter(k => k.isAchieved).length;
  const totalCount = boardKPIs.length;

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      {/* Game Over banner */}
      {boardGameOver && (
        <div style={{
          marginBottom: 12, padding: '10px 14px',
          background: '#1a0000', border: '2px solid var(--tm-red)',
          borderRadius: 6, textAlign: 'center',
        }}>
          <div style={{ color: 'var(--tm-red)', fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>GAME OVER</div>
          <div style={{ color: '#cc4444', fontSize: 11 }}>連續兩年未達成 KPI 目標，董事會更換經營團隊</div>
        </div>
      )}

      {/* Pending review notice */}
      {boardPendingReview && !boardGameOver && (
        <div style={{
          marginBottom: 12, padding: '8px 12px',
          background: '#1a1500', border: '1px solid var(--tm-yellow)',
          borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--tm-yellow)', fontSize: 11 }}>📋 董事會通知待確認</span>
          <button onClick={onAcknowledge} style={{
            padding: '2px 10px', fontSize: 11,
            background: '#1a1500', border: '1px solid var(--tm-yellow)',
            borderRadius: 3, color: 'var(--tm-yellow)', cursor: 'pointer',
          }}>確認</button>
        </div>
      )}

      {/* KPI Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, padding: '8px 10px', background: '#0d0d1a', borderRadius: 4, border: '1px solid #223' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: achievedCount === totalCount ? 'var(--tm-green)' : achievedCount >= totalCount * 0.5 ? 'var(--tm-yellow)' : 'var(--tm-red)', fontSize: 22, fontWeight: 'bold' }}>
            {achievedCount}/{totalCount}
          </div>
          <div style={{ color: '#888', fontSize: 10 }}>KPI 達成</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: boardYearResults.length > 0 ? 'var(--tm-cyan)' : '#555', fontSize: 18 }}>
            {boardYearResults.filter(r => !r.hadWarning).length}
          </div>
          <div style={{ color: '#888', fontSize: 10 }}>歷年達成</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: boardYearResults.reduce((s, r) => s + r.bonus, 0) > 0 ? 'var(--tm-green)' : '#555', fontSize: 14 }}>
            NT${(boardYearResults.reduce((s, r) => s + r.bonus, 0) / 1_000_000).toFixed(1)}M
          </div>
          <div style={{ color: '#888', fontSize: 10 }}>累計獎金</div>
        </div>
      </div>

      {/* Current KPIs */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>本年度 KPI</div>
        {boardKPIs.length === 0 ? (
          <div style={{ color: '#444', textAlign: 'center', padding: '12px 0', fontSize: 11 }}>尚無 KPI 資料</div>
        ) : (
          boardKPIs.map(kpi => <KPIRow key={kpi.id} kpi={kpi} />)
        )}
      </div>

      {/* Year results history */}
      {boardYearResults.length > 0 && (
        <div style={{ borderTop: '1px solid #223', paddingTop: 10 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>歷年結果</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[...boardYearResults].reverse().map(r => (
              <div key={r.year} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '4px 8px', background: '#0d0d1a', borderRadius: 3,
                border: `1px solid ${r.hadWarning ? '#553333' : '#224422'}`,
                fontSize: 11,
              }}>
                <span style={{ color: '#888', minWidth: 40 }}>{r.year}</span>
                <span style={{ color: r.hadWarning ? 'var(--tm-red)' : 'var(--tm-green)', minWidth: 30 }}>
                  {r.achievedCount}/{r.totalCount}
                </span>
                <span style={{ flex: 1, color: r.hadWarning ? '#cc4444' : '#888', fontSize: 10 }}>
                  {r.hadWarning ? '⚠ 警告' : '✓ 達標'}
                </span>
                {r.bonus > 0 && (
                  <span style={{ color: 'var(--tm-green)', fontSize: 10 }}>
                    +NT${(r.bonus / 1_000).toFixed(0)}K
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
