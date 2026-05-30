import React from 'react';
import { CoolingLevel, FacilityRegion } from '../../game/core/types';
import type { FacilityRegionState } from '../../game/core/types';

interface Props {
  regions: FacilityRegionState[];
  onUpgradeCooling: (region: FacilityRegion, level: CoolingLevel) => void;
  onExpandCapacity: (region: FacilityRegion) => void;
  onUnlockRegion: (region: FacilityRegion) => void;
}

const COOLING_LABELS: Record<CoolingLevel, string> = {
  [CoolingLevel.Open]:      '開放式機架',
  [CoolingLevel.BasicAC]:   '基礎空調',
  [CoolingLevel.HotAisle]:  '熱通道封閉',
  [CoolingLevel.Chiller]:   '冰水主機',
  [CoolingLevel.InRow]:     'In-Row 冷卻',
  [CoolingLevel.Liquid]:    '液冷系統',
  [CoolingLevel.Immersion]: '浸沒式冷卻',
};

const REGION_LABELS: Record<FacilityRegion, string> = {
  [FacilityRegion.North]:   '北區機房',
  [FacilityRegion.Central]: '中區機房',
  [FacilityRegion.South]:   '南區機房',
};

function UtilBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = rate >= 0.85 ? '#ff4444' : rate >= 0.70 ? '#ffaa00' : '#44ff88';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 8, background: '#333', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function RegionCard({ region, onUpgrade, onExpand, onUnlock }: {
  region: FacilityRegionState;
  onUpgrade: (level: CoolingLevel) => void;
  onExpand: () => void;
  onUnlock: () => void;
}) {
  if (!region.isUnlocked) {
    return (
      <div style={{
        border: '1px solid #444', borderRadius: 6, padding: 12, opacity: 0.6,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontWeight: 'bold', color: '#aaa' }}>{REGION_LABELS[region.region]} — 未解鎖</div>
        <button
          onClick={onUnlock}
          style={{ padding: '4px 10px', background: '#1a3a1a', border: '1px solid #4a8a4a', borderRadius: 4, color: '#88ff88', cursor: 'pointer', fontSize: 12 }}
        >
          解鎖區域
        </button>
      </div>
    );
  }

  const nextLevel = region.coolingLevel < CoolingLevel.Immersion
    ? (region.coolingLevel + 1) as CoolingLevel
    : null;

  return (
    <div style={{ border: '1px solid #556', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontWeight: 'bold', color: '#ccddff', fontSize: 14 }}>
        {REGION_LABELS[region.region]}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
        <div style={{ color: '#aaa' }}>機架容量</div>
        <div style={{ color: '#eee', textAlign: 'right' }}>{region.usedUnits} / {region.totalUnits} U</div>

        <div style={{ color: '#aaa' }}>使用率</div>
        <div style={{ gridColumn: '1/-1' }}>
          <UtilBar rate={region.utilizationRate} />
        </div>

        <div style={{ color: '#aaa' }}>冷卻等級</div>
        <div style={{ color: '#88ccff', textAlign: 'right' }}>{COOLING_LABELS[region.coolingLevel]}</div>

        <div style={{ color: '#aaa' }}>PUE</div>
        <div style={{ color: '#ffcc44', textAlign: 'right' }}>{region.pue.toFixed(2)}</div>

        <div style={{ color: '#aaa' }}>功耗</div>
        <div style={{ color: '#eee', textAlign: 'right' }}>{region.totalWatts.toLocaleString()} W</div>

        <div style={{ color: '#aaa' }}>月租金</div>
        <div style={{ color: '#eee', textAlign: 'right' }}>NT${region.monthlyRent.toLocaleString()}</div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        <button
          onClick={onExpand}
          style={{ flex: 1, padding: '4px 8px', background: '#1a2a3a', border: '1px solid #4488aa', borderRadius: 4, color: '#88ccff', cursor: 'pointer', fontSize: 11 }}
        >
          擴建容量
        </button>
        {nextLevel !== null && (
          <button
            onClick={() => onUpgrade(nextLevel)}
            style={{ flex: 1, padding: '4px 8px', background: '#1a1a3a', border: '1px solid #6666aa', borderRadius: 4, color: '#aaaaff', cursor: 'pointer', fontSize: 11 }}
          >
            升級冷卻
          </button>
        )}
      </div>
    </div>
  );
}

export const FacilityManagerPanel: React.FC<Props> = ({
  regions,
  onUpgradeCooling,
  onExpandCapacity,
  onUnlockRegion,
}) => {
  const totalRent = regions
    .filter(r => r.isUnlocked)
    .reduce((s, r) => s + r.monthlyRent, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#ccddff', fontSize: 15 }}>機房設施管理</h3>
        <span style={{ fontSize: 11, color: '#aaa' }}>月租合計: NT${totalRent.toLocaleString()}</span>
      </div>

      {regions.map(region => (
        <RegionCard
          key={region.region}
          region={region}
          onUpgrade={(level) => onUpgradeCooling(region.region, level)}
          onExpand={() => onExpandCapacity(region.region)}
          onUnlock={() => onUnlockRegion(region.region)}
        />
      ))}
    </div>
  );
};
