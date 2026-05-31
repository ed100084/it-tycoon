import React from 'react';
import type { EnergyState } from '../../game/core/types';
import { ElectricityStrategy } from '../../game/core/types';

interface EnergyPanelProps {
  energyState: EnergyState | null;
  currentYear: number;
  onSetStrategy: (strategy: ElectricityStrategy) => void;
  onInstallSolar: () => void;
  onInstallStorage: () => void;
}

const STRATEGY_LABELS: Record<ElectricityStrategy, string> = {
  [ElectricityStrategy.Spot]:    '現貨（浮動 ±20%）',
  [ElectricityStrategy.Fixed1Y]: '固定 1 年（-5%）',
  [ElectricityStrategy.Fixed3Y]: '固定 3 年（-15%，需預付）',
};

export const EnergyPanel: React.FC<EnergyPanelProps> = ({
  energyState,
  currentYear,
  onSetStrategy,
  onInstallSolar,
  onInstallStorage,
}) => {
  if (!energyState) return <div className="crt-panel"><div className="panel-body">載入中...</div></div>;

  const {
    strategy, hasSolar, hasStorage, esgScore,
    carbonTaxActive, monthlyElectricityCostMultiplier,
  } = energyState;

  const esgColor = esgScore >= 70
    ? 'var(--accent-green)'
    : esgScore >= 40
      ? 'var(--accent-yellow)'
      : 'var(--fg-dim, #666)';

  const multPct = ((monthlyElectricityCostMultiplier - 1) * 100).toFixed(1);
  const multColor = monthlyElectricityCostMultiplier < 1 ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div className="crt-panel energy-panel">
      <div className="panel-header">⚡ 能源策略管理</div>
      <div className="panel-body">

        {/* ESG Score */}
        <div className="energy-esg-row">
          <span>ESG 評分：</span>
          <span style={{ color: esgColor, fontWeight: 'bold', marginLeft: 8 }}>{esgScore}/100</span>
          {esgScore >= 70 && (
            <span style={{ color: 'var(--accent-green)', marginLeft: 8, fontSize: '0.85em' }}>
              ✓ 大企業 RFP +20%
            </span>
          )}
        </div>
        <div className="esg-bar-bg" style={{ marginTop: 4 }}>
          <div className="esg-bar" style={{ width: `${esgScore}%`, background: esgColor }} />
        </div>

        {/* Cost Multiplier */}
        <div style={{ marginTop: 10 }}>
          電費倍率：
          <span style={{ color: multColor, fontWeight: 'bold', marginLeft: 8 }}>
            {multPct}% {monthlyElectricityCostMultiplier < 1 ? '節省' : '額外支出'}
          </span>
        </div>

        {/* Carbon Tax */}
        {carbonTaxActive && (
          <div style={{ color: 'var(--accent-yellow)', marginTop: 6 }}>
            ⚠ 碳稅啟動中
            {hasSolar && <span style={{ color: 'var(--accent-green)', marginLeft: 6 }}>（綠能折扣 -30%）</span>}
          </div>
        )}

        {/* Strategy selector */}
        <div className="energy-strategy-section" style={{ marginTop: 14 }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>電力採購策略：</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.values(ElectricityStrategy).map(s => (
              <button
                key={s}
                className={`crt-btn energy-strategy-btn${strategy === s ? ' active' : ''}`}
                style={strategy === s ? { borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' } : {}}
                onClick={() => onSetStrategy(s)}
              >
                {STRATEGY_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Green Investments */}
        <div className="energy-green-section" style={{ marginTop: 14 }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>綠能投資：</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            {hasSolar ? (
              <span style={{ color: 'var(--accent-green)' }}>☀ 太陽能板已安裝（電費 -12%，ESG +20）</span>
            ) : (
              <>
                <span style={{ opacity: 0.7, fontSize: '0.88em' }}>☀ 太陽能板 NT$5M（{currentYear >= 2015 ? '可安裝' : `2015年解鎖`}）</span>
                <button
                  className="crt-btn"
                  disabled={currentYear < 2015}
                  onClick={onInstallSolar}
                >
                  安裝太陽能
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {hasStorage ? (
              <span style={{ color: 'var(--accent-green)' }}>🔋 儲能設備已安裝（尖峰 -8%，ESG +15）</span>
            ) : (
              <>
                <span style={{ opacity: 0.7, fontSize: '0.88em' }}>🔋 儲能設備 NT$3M（{currentYear >= 2018 ? '可安裝' : `2018年解鎖`}）</span>
                <button
                  className="crt-btn"
                  disabled={currentYear < 2018}
                  onClick={onInstallStorage}
                >
                  安裝儲能
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
