import React, { useState } from 'react';
import type { TechDebtItem } from '../../game/core/types';
import { TechDebtLevel } from '../../game/core/types';

interface TechDebtPanelProps {
  totalPoints: number;
  level: TechDebtLevel;
  items: TechDebtItem[];
  onStartRefactoring: (points: number) => void;
}

const LEVEL_COLORS: Record<TechDebtLevel, string> = {
  [TechDebtLevel.Healthy]:  'var(--accent-green)',
  [TechDebtLevel.Warning]:  'var(--accent-yellow)',
  [TechDebtLevel.Danger]:   '#f97316',
  [TechDebtLevel.Critical]: 'var(--accent-red)',
};

const LEVEL_LABELS: Record<TechDebtLevel, string> = {
  [TechDebtLevel.Healthy]:  '健康',
  [TechDebtLevel.Warning]:  '注意',
  [TechDebtLevel.Danger]:   '危險',
  [TechDebtLevel.Critical]: '臨界',
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `NT$${(n / 1_000_000).toFixed(1)}M`;
  return `NT$${(n / 1_000).toFixed(0)}K`;
}

export const TechDebtPanel: React.FC<TechDebtPanelProps> = ({
  totalPoints,
  level,
  items,
  onStartRefactoring,
}) => {
  const [refactorPts, setRefactorPts] = useState(10);
  const color = LEVEL_COLORS[level];
  const pct = Math.min(100, totalPoints);
  const cost = refactorPts * 50_000;

  return (
    <div className="crt-panel techdebt-panel" style={{ marginTop: '12px' }}>
      <div className="panel-header" style={{ color }}>⚙ 技術債儀表</div>
      <div className="panel-body">
        <div className="techdebt-gauge-row">
          <span style={{ color }}>【{LEVEL_LABELS[level]}】</span>
          <span style={{ color, fontWeight: 'bold', marginLeft: 8 }}>{totalPoints} / 100 pts</span>
        </div>
        <div className="techdebt-bar-bg">
          <div
            className="techdebt-bar"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>

        {level === TechDebtLevel.Critical && (
          <div className="techdebt-warning" style={{ color: 'var(--accent-red)', marginTop: 6 }}>
            ⚠ 每月 20% 機率觸發連鎖故障！
          </div>
        )}

        <div className="techdebt-refactor" style={{ marginTop: 10 }}>
          <span>系統重構：</span>
          <input
            type="number"
            min={1}
            max={100}
            value={refactorPts}
            onChange={e => setRefactorPts(Math.max(1, Number(e.target.value)))}
            style={{ width: 60, margin: '0 8px' }}
          />
          <span>pts = {fmtMoney(cost)}</span>
          <button
            className="crt-btn"
            style={{ marginLeft: 8 }}
            onClick={() => onStartRefactoring(refactorPts)}
          >
            投入重構
          </button>
        </div>

        {items.length > 0 && (
          <div className="techdebt-items" style={{ marginTop: 10 }}>
            <div style={{ opacity: 0.7, marginBottom: 4 }}>債項清單 ({items.length})：</div>
            {items.slice(-8).map(item => (
              <div key={item.id} className="techdebt-item-row">
                <span style={{ color: 'var(--accent-yellow)' }}>[{item.points}pt]</span>
                <span style={{ marginLeft: 6 }}>{item.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
