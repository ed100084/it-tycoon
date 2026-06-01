import React from 'react';
import { CloudStrategy } from '../../game/core/types';
import type { CloudStrategyState } from '../../game/core/types';

interface CloudStrategyPanelProps {
  cloudState: CloudStrategyState | null;
  currentYear: number;
  onSetStrategy: (strategy: CloudStrategy) => void;
}

const STRATEGY_LABELS: Record<CloudStrategy, string> = {
  [CloudStrategy.OnPrem]: '純地端',
  [CloudStrategy.Hybrid]: '混合雲',
  [CloudStrategy.MSP]:    'MSP轉型',
};

const STRATEGY_DESCRIPTIONS: Record<CloudStrategy, string> = {
  [CloudStrategy.OnPrem]:
    '固守IDC，不碰雲端。雲端壓力高時客戶流失風險較高。',
  [CloudStrategy.Hybrid]:
    '混合雲架構顧問，需投資 NT$3M。降低客戶流失，開拓新市場。',
  [CloudStrategy.MSP]:
    '轉型為 MSP/CSP，需先完成混合雲投資 + 追加 NT$10M。高風險高報酬。',
};

function pressureColor(pressure: number): string {
  if (pressure >= 70) return 'var(--accent-red)';
  if (pressure >= 40) return 'var(--accent-yellow)';
  return 'var(--accent-green)';
}

function formatNTD(amount: number): string {
  if (amount >= 1_000_000) return `NT$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `NT$${(amount / 1_000).toFixed(0)}K`;
  return `NT$${amount}`;
}

export const CloudStrategyPanel: React.FC<CloudStrategyPanelProps> = ({
  cloudState,
  currentYear,
  onSetStrategy,
}) => {
  if (!cloudState) {
    return (
      <div className="crt-panel">
        <div className="panel-body">載入中...</div>
      </div>
    );
  }

  const {
    strategy,
    cloudPressure,
    migrationRiskPerMonth,
    hybridContractCount,
    cloudRevenueMonthly,
    dataSovereigntyOpportunity,
    hybridInvestmentDone,
    mspTransformDone,
  } = cloudState;

  const pColor = pressureColor(cloudPressure);

  const isStrategyDisabled = (s: CloudStrategy): boolean => {
    if (s === CloudStrategy.Hybrid) return false;
    if (s === CloudStrategy.MSP) return !hybridInvestmentDone;
    return false;
  };

  return (
    <div className="crt-panel cloud-strategy-panel">
      <div className="panel-header">☁️ 雲端策略</div>
      <div className="panel-body">

        {/* Cloud pressure gauge */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ opacity: 0.8 }}>公有雲競爭壓力</span>
            <span style={{ color: pColor, fontWeight: 'bold' }}>
              {cloudPressure.toFixed(0)} / 100
            </span>
          </div>
          <div
            style={{
              height: 10,
              background: 'var(--bg-secondary, #1a1a2e)',
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid var(--border-dim, #333)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(cloudPressure, 100)}%`,
                background: pColor,
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {cloudPressure >= 70 && (
            <div style={{ color: 'var(--accent-red)', fontSize: '0.82em', marginTop: 4 }}>
              ⚠ 競爭壓力極高，客戶流失風險上升
            </div>
          )}
        </div>

        {/* Strategy selector */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>當前策略：</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {(Object.values(CloudStrategy) as CloudStrategy[]).map(s => {
              const disabled = isStrategyDisabled(s);
              const isActive = strategy === s;
              return (
                <button
                  key={s}
                  className={`crt-btn${isActive ? ' active' : ''}`}
                  disabled={disabled}
                  style={
                    isActive
                      ? { borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }
                      : disabled
                        ? { opacity: 0.4, cursor: 'not-allowed' }
                        : {}
                  }
                  onClick={() => !disabled && onSetStrategy(s)}
                >
                  {STRATEGY_LABELS[s]}
                </button>
              );
            })}
          </div>

          {/* Current strategy description */}
          <div
            style={{
              fontSize: '0.87em',
              color: 'var(--fg-dim, #aaa)',
              background: 'var(--bg-secondary, #12122a)',
              border: '1px solid var(--border-dim, #333)',
              borderRadius: 4,
              padding: '8px 10px',
            }}
          >
            {STRATEGY_DESCRIPTIONS[strategy]}
          </div>
        </div>

        {/* Investment status */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>投資進度：</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: hybridInvestmentDone ? 'var(--accent-green)' : 'var(--fg-dim, #666)', fontSize: '0.88em' }}>
              {hybridInvestmentDone ? '✓' : '○'} 混合雲投資 NT$3M
            </span>
            <span style={{ color: mspTransformDone ? 'var(--accent-green)' : 'var(--fg-dim, #666)', fontSize: '0.88em' }}>
              {mspTransformDone ? '✓' : '○'} MSP 追加 NT$10M
            </span>
          </div>
        </div>

        {/* Hybrid contracts & cloud revenue */}
        {(strategy === CloudStrategy.Hybrid || strategy === CloudStrategy.MSP) && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 10px',
              border: '1px solid var(--border-dim, #333)',
              borderRadius: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ opacity: 0.8 }}>混合雲合約數：</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                {hybridContractCount} 個
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.8 }}>月雲端營收：</span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>
                {formatNTD(cloudRevenueMonthly)} / 月
              </span>
            </div>
          </div>
        )}

        {/* Data sovereignty opportunity banner */}
        {dataSovereigntyOpportunity && currentYear >= 2018 && (
          <div
            style={{
              padding: '8px 10px',
              marginBottom: 12,
              background: 'rgba(255, 200, 50, 0.08)',
              border: '1px solid var(--accent-yellow)',
              borderRadius: 4,
              color: 'var(--accent-yellow)',
              fontSize: '0.88em',
              fontWeight: 'bold',
            }}
          >
            ⚡ 個資法/GDPR 資料主權回流機會
            <div style={{ fontWeight: 'normal', marginTop: 3, opacity: 0.85 }}>
              企業資料主權意識提升，地端 IDC 需求回溫
            </div>
          </div>
        )}

        {/* Migration risk indicator */}
        <div style={{ marginTop: 4 }}>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>每月客戶遷移風險：</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background:
                  migrationRiskPerMonth >= 0.05
                    ? 'var(--accent-red)'
                    : migrationRiskPerMonth >= 0.02
                      ? 'var(--accent-yellow)'
                      : 'var(--accent-green)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color:
                  migrationRiskPerMonth >= 0.05
                    ? 'var(--accent-red)'
                    : migrationRiskPerMonth >= 0.02
                      ? 'var(--accent-yellow)'
                      : 'var(--accent-green)',
                fontWeight: 'bold',
              }}
            >
              {(migrationRiskPerMonth * 100).toFixed(1)}%
            </span>
            <span style={{ opacity: 0.65, fontSize: '0.85em' }}>
              {migrationRiskPerMonth >= 0.05
                ? '高風險 — 強烈建議升級策略'
                : migrationRiskPerMonth >= 0.02
                  ? '中風險 — 考慮混合雲投資'
                  : '低風險'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
