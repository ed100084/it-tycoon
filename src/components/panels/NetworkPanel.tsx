import React, { useState } from 'react';
import { ISPProvider, BandwidthTier, RedundancyMode } from '../../game/core/types';
import type { NetworkState } from '../../game/core/types';

interface NetworkPanelProps {
  networkState: NetworkState | null;
  currentYear: number;
  onAddISP: (provider: ISPProvider, tier: BandwidthTier) => void;
  onRemoveISP: (contractId: string) => void;
  onSetRedundancy: (mode: RedundancyMode) => void;
  onEnableIX: () => void;
}

const PROVIDER_LABELS: Record<ISPProvider, string> = {
  [ISPProvider.Chunghwa]:   '中華電信',
  [ISPProvider.FarEasTone]: '遠傳電信',
  [ISPProvider.APT]:        '亞太電信',
};

const TIER_LABELS: Record<BandwidthTier, string> = {
  [BandwidthTier.B100M]: '100 Mbps',
  [BandwidthTier.B1G]:   '1 Gbps',
  [BandwidthTier.B10G]:  '10 Gbps',
  [BandwidthTier.B100G]: '100 Gbps',
};

const REDUNDANCY_LABELS: Record<RedundancyMode, string> = {
  [RedundancyMode.SingleLink]: '單線路',
  [RedundancyMode.DualISP]:    '雙 ISP',
  [RedundancyMode.BGPMulti]:   'BGP 多路',
};

const IX_UNLOCK_YEAR = 2005;

function formatBandwidth(mbps: number): string {
  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(mbps % 1000 === 0 ? 0 : 1)} Gbps`;
  }
  return `${mbps} Mbps`;
}

function UtilizationBar({ pct, degraded }: { pct: number; degraded: boolean }) {
  const color = degraded
    ? 'var(--tm-red)'
    : pct >= 0.8
    ? 'var(--tm-yellow)'
    : 'var(--tm-green)';

  return (
    <div style={{ background: '#1a1a1a', borderRadius: 2, height: 7, overflow: 'hidden', marginTop: 3 }}>
      <div
        style={{
          width: `${Math.min(100, pct * 100).toFixed(1)}%`,
          height: '100%',
          background: color,
          transition: 'width 0.3s',
        }}
      />
    </div>
  );
}

export const NetworkPanel: React.FC<NetworkPanelProps> = ({
  networkState,
  currentYear,
  onAddISP,
  onRemoveISP,
  onSetRedundancy,
  onEnableIX,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<ISPProvider>(ISPProvider.Chunghwa);
  const [selectedTier, setSelectedTier] = useState<BandwidthTier>(BandwidthTier.B100M);

  if (!networkState) {
    return (
      <div style={{ fontSize: 12, color: '#555', textAlign: 'center', paddingTop: 24 }}>
        網路資料載入中…
      </div>
    );
  }

  const {
    ispContracts,
    totalBandwidthMbps,
    usedBandwidthMbps,
    redundancyMode,
    ixPeering,
    bandwidthUtilization,
    qualityDegradationActive,
  } = networkState;

  const ixUnlocked = currentYear >= IX_UNLOCK_YEAR;

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>

      {/* Bandwidth summary */}
      <div style={{ marginBottom: 12, padding: '8px 10px', background: '#0d0d1a', borderRadius: 4, border: '1px solid #223' }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>頻寬使用狀況</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ color: 'var(--tm-cyan)', fontSize: 14, fontWeight: 'bold' }}>
            {formatBandwidth(totalBandwidthMbps)}
          </span>
          <span style={{ color: '#666', fontSize: 11 }}>
            已使用 {formatBandwidth(usedBandwidthMbps)}
          </span>
          <span style={{ color: '#888', fontSize: 11 }}>
            {(bandwidthUtilization * 100).toFixed(1)}%
          </span>
        </div>
        <UtilizationBar pct={bandwidthUtilization} degraded={qualityDegradationActive} />
        {qualityDegradationActive && (
          <div style={{ marginTop: 5, color: 'var(--tm-red)', fontSize: 11, fontWeight: 'bold' }}>
            警告：頻寬過載，服務品質下降中
          </div>
        )}
      </div>

      {/* IX Peering */}
      <div style={{ marginBottom: 12, padding: '8px 10px', background: '#0d0d1a', borderRadius: 4, border: '1px solid #223' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#aaa', fontSize: 11, marginBottom: 2 }}>IX 對等互連</div>
            {!ixUnlocked && (
              <div style={{ color: '#555', fontSize: 10 }}>解鎖條件：{IX_UNLOCK_YEAR} 年後可用</div>
            )}
            {ixUnlocked && !ixPeering && (
              <div style={{ color: '#555', fontSize: 10 }}>啟用後可降低頻寬費用</div>
            )}
            {ixPeering && (
              <div style={{ color: 'var(--tm-green)', fontSize: 10 }}>已啟用</div>
            )}
          </div>
          {ixUnlocked && !ixPeering && (
            <button
              className="crt-btn"
              onClick={onEnableIX}
              style={{ fontSize: 11, padding: '3px 10px' }}
            >
              啟用 IX
            </button>
          )}
          {!ixUnlocked && (
            <span style={{ color: '#444', fontSize: 11 }}>未解鎖</span>
          )}
          {ixPeering && (
            <span style={{ color: 'var(--tm-green)', fontSize: 11 }}>✓ 已連線</span>
          )}
        </div>
      </div>

      {/* Redundancy mode */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 5 }}>備援模式</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.values(RedundancyMode).map(mode => (
            <button
              key={mode}
              className="crt-btn"
              onClick={() => onSetRedundancy(mode)}
              style={{
                flex: 1,
                fontSize: 10,
                padding: '4px 0',
                background: redundancyMode === mode ? '#1a2a1a' : undefined,
                borderColor: redundancyMode === mode ? 'var(--tm-green)' : undefined,
                color: redundancyMode === mode ? 'var(--tm-green)' : undefined,
              }}
            >
              {REDUNDANCY_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* ISP contracts list */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 5 }}>
          ISP 合約 ({ispContracts.length})
        </div>
        {ispContracts.length === 0 ? (
          <div style={{ color: '#444', textAlign: 'center', padding: '12px 0', fontSize: 11 }}>
            尚未簽署任何 ISP 合約
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ispContracts.map(contract => (
              <div
                key={contract.id}
                style={{
                  padding: '6px 8px',
                  background: '#0d0d1a',
                  borderRadius: 3,
                  border: '1px solid #223',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ color: 'var(--tm-cyan)', fontSize: 11, fontWeight: 'bold' }}>
                      {PROVIDER_LABELS[contract.provider]}
                    </span>
                    <span style={{ color: '#aaa', fontSize: 10 }}>
                      {TIER_LABELS[contract.tier]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#666' }}>
                    <span>月費 NT${contract.monthlyFeeNTD.toLocaleString()}</span>
                    <span>可靠度 {(contract.reliability * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <button
                  className="crt-btn"
                  onClick={() => onRemoveISP(contract.id)}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderColor: '#aa3333',
                    color: 'var(--tm-red)',
                    background: '#1a0d0d',
                    flexShrink: 0,
                  }}
                >
                  解約
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add ISP section */}
      <div style={{ padding: '8px 10px', background: '#0d0d1a', borderRadius: 4, border: '1px solid #223' }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>新增 ISP</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            className="crt-select"
            value={selectedProvider}
            onChange={e => setSelectedProvider(e.target.value as ISPProvider)}
            style={{ flex: 1, fontSize: 11, padding: '3px 4px' }}
          >
            {Object.values(ISPProvider).map(p => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
          <select
            className="crt-select"
            value={selectedTier}
            onChange={e => setSelectedTier(e.target.value as BandwidthTier)}
            style={{ flex: 1, fontSize: 11, padding: '3px 4px' }}
          >
            {Object.values(BandwidthTier).map(t => (
              <option key={t} value={t}>{TIER_LABELS[t]}</option>
            ))}
          </select>
          <button
            className="crt-btn"
            onClick={() => onAddISP(selectedProvider, selectedTier)}
            style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0 }}
          >
            新增
          </button>
        </div>
      </div>
    </div>
  );
};
