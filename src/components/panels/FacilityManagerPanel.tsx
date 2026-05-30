import React, { useState } from 'react';
import { CoolingLevel, FacilityRegion } from '../../game/core/types';
import type { FacilityRegionState, RegionMaintenanceState } from '../../game/core/types';

interface Props {
  regions: FacilityRegionState[];
  maintenanceStates: Record<FacilityRegion, RegionMaintenanceState> | null;
  onUpgradeCooling: (region: FacilityRegion, level: CoolingLevel) => void;
  onExpandCapacity: (region: FacilityRegion) => void;
  onUnlockRegion: (region: FacilityRegion) => void;
  onScheduleMaintenance: (region: FacilityRegion, offPeak: boolean) => void;
  onGeneratorMaintenance: (region: FacilityRegion) => void;
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
      <div style={{ flex: 1, height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

// ── Rack floor view ───────────────────────────────────────────────────────────

function RackFloorView({ region }: { region: FacilityRegionState }) {
  const [selectedRack, setSelectedRack] = useState<number | null>(null);
  if (!region.isUnlocked) return null;

  // Estimate number of racks (~42U per rack)
  const U_PER_RACK = 42;
  const totalRacks = Math.max(1, Math.ceil(region.totalUnits / U_PER_RACK));
  const usedRacks = Math.ceil(region.usedUnits / U_PER_RACK);
  const cols = Math.min(totalRacks, 8);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>機房俯視圖（每格 = 1 機櫃 42U）</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 3,
        padding: 6,
        background: '#0a0a14',
        borderRadius: 4,
        border: '1px solid #223',
      }}>
        {Array.from({ length: totalRacks }, (_, i) => {
          const isUsed = i < usedRacks;
          const isMaint = false; // future: individual rack maintenance
          const utilFraction = i < usedRacks - 1 ? 1.0 : (i === usedRacks - 1 ? (region.usedUnits % U_PER_RACK) / U_PER_RACK || 1.0 : 0);
          const rackColor =
            !isUsed ? '#1a1a1a' :
            utilFraction >= 0.8 ? '#cc2222' :
            utilFraction >= 0.6 ? '#cc8800' :
            '#22aa44';
          const animClass =
            !isUsed ? '' :
            isMaint ? 'rack-maint' :
            'rack-active';

          return (
            <div
              key={i}
              className={animClass}
              onClick={() => setSelectedRack(selectedRack === i ? null : i)}
              title={isUsed ? `機櫃 ${i + 1}（已使用）` : `機櫃 ${i + 1}（空置）`}
              style={{
                width: '100%',
                paddingBottom: '100%',
                position: 'relative',
                borderRadius: 2,
                background: rackColor,
                cursor: 'pointer',
                border: selectedRack === i ? '1px solid #88ccff' : '1px solid transparent',
                boxSizing: 'border-box',
              }}
            >
              {isUsed && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 6, color: '#ffffff88' }}>▊</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {selectedRack !== null && (
        <div style={{ marginTop: 4, padding: '4px 8px', background: '#111', borderRadius: 4, fontSize: 10, color: '#aaa' }}>
          機櫃 {selectedRack + 1} — {selectedRack < usedRacks ? '已裝機' : '空置'}
          {selectedRack < usedRacks && (
            <span style={{ marginLeft: 8, color: '#88ff88' }}>
              約 {Math.round(Math.min(U_PER_RACK, region.usedUnits - selectedRack * U_PER_RACK))} U 已用
            </span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, background: '#22aa44', display: 'inline-block', borderRadius: 2 }} />
          &lt;60%
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, background: '#cc8800', display: 'inline-block', borderRadius: 2 }} />
          60–80%
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, background: '#cc2222', display: 'inline-block', borderRadius: 2 }} />
          &gt;80%
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, background: '#1a1a1a', display: 'inline-block', borderRadius: 2, border: '1px solid #333' }} />
          空置
        </span>
      </div>
    </div>
  );
}

// ── Maintenance section ───────────────────────────────────────────────────────

function MaintenanceCard({
  maint,
  onSchedule,
  onGeneratorMaint,
}: {
  region: FacilityRegion;
  maint: RegionMaintenanceState;
  onSchedule: (offPeak: boolean) => void;
  onGeneratorMaint: () => void;
}) {
  return (
    <div style={{
      background: '#0d1a0d',
      border: `1px solid ${maint.maintenanceDue ? '#aa5500' : '#1a3a1a'}`,
      borderRadius: 4,
      padding: 8,
      marginTop: 8,
    }}>
      <div style={{ fontSize: 11, color: '#88cc88', marginBottom: 6, fontWeight: 'bold' }}>
        🔧 維護排程
        {maint.maintenanceDue && (
          <span style={{ color: '#ff8800', marginLeft: 6, fontSize: 10 }}>⚠ 需要維護</span>
        )}
        {maint.isUnderMaintenance && (
          <span style={{ color: '#ffcc00', marginLeft: 6, fontSize: 10 }}>⚙ 維護中</span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 10 }}>
        <span style={{ color: '#555' }}>距上次維護</span>
        <span style={{ color: maint.monthsSinceMaintenance >= 6 ? '#ff8800' : '#aaa' }}>
          {maint.monthsSinceMaintenance} 個月前
        </span>
        <span style={{ color: '#555' }}>油機狀態</span>
        <span style={{ color: maint.generatorHealthy ? '#44ff88' : '#ff4444' }}>
          {maint.generatorHealthy ? '正常' : '需保養'}
          {maint.generatorMaintenanceDue && !maint.generatorHealthy ? ' ⚠' : ''}
        </span>
        <span style={{ color: '#555' }}>夏季負載</span>
        <span style={{ color: maint.peakSeasonActive ? '#ffcc00' : '#555' }}>
          {maint.peakSeasonActive ? '進行中 PUE+0.1' : '非旺季'}
        </span>
      </div>
      {!maint.isUnderMaintenance && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button
            onClick={() => onSchedule(false)}
            style={{
              flex: 1, padding: '3px 6px', fontSize: 10,
              background: '#1a2a1a', border: '1px solid #3a5a3a',
              borderRadius: 3, color: '#88cc88', cursor: 'pointer',
            }}
          >
            排定維護
          </button>
          <button
            onClick={() => onSchedule(true)}
            style={{
              flex: 1, padding: '3px 6px', fontSize: 10,
              background: '#1a1a2a', border: '1px solid #2a3a5a',
              borderRadius: 3, color: '#8888cc', cursor: 'pointer',
            }}
          >
            離峰維護 (+50%)
          </button>
        </div>
      )}
      {(maint.generatorMaintenanceDue || !maint.generatorHealthy) && (
        <button
          onClick={onGeneratorMaint}
          style={{
            width: '100%', marginTop: 4, padding: '3px 6px', fontSize: 10,
            background: '#2a1a0a', border: '1px solid #6a3a0a',
            borderRadius: 3, color: '#ffaa44', cursor: 'pointer',
          }}
        >
          🔋 油機保養 (NT$15,000)
        </button>
      )}
    </div>
  );
}

// ── Region card ───────────────────────────────────────────────────────────────

function RegionCard({
  region,
  maint,
  onUpgrade,
  onExpand,
  onUnlock,
  onScheduleMaint,
  onGeneratorMaint,
}: {
  region: FacilityRegionState;
  maint: RegionMaintenanceState | null;
  onUpgrade: (level: CoolingLevel) => void;
  onExpand: () => void;
  onUnlock: () => void;
  onScheduleMaint: (offPeak: boolean) => void;
  onGeneratorMaint: () => void;
}) {
  const [showFloor, setShowFloor] = useState(false);

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
        <button
          onClick={() => setShowFloor(v => !v)}
          style={{ flex: 1, padding: '4px 8px', background: '#111', border: '1px solid #334', borderRadius: 4, color: '#888', cursor: 'pointer', fontSize: 11 }}
        >
          {showFloor ? '收起俯視圖' : '🗺 俯視圖'}
        </button>
      </div>

      {showFloor && <RackFloorView region={region} />}

      {maint && (
        <MaintenanceCard
          region={region.region}
          maint={maint}
          onSchedule={onScheduleMaint}
          onGeneratorMaint={onGeneratorMaint}
        />
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export const FacilityManagerPanel: React.FC<Props> = ({
  regions,
  maintenanceStates,
  onUpgradeCooling,
  onExpandCapacity,
  onUnlockRegion,
  onScheduleMaintenance,
  onGeneratorMaintenance,
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
          maint={maintenanceStates?.[region.region] ?? null}
          onUpgrade={(level) => onUpgradeCooling(region.region, level)}
          onExpand={() => onExpandCapacity(region.region)}
          onUnlock={() => onUnlockRegion(region.region)}
          onScheduleMaint={(offPeak) => onScheduleMaintenance(region.region, offPeak)}
          onGeneratorMaint={() => onGeneratorMaintenance(region.region)}
        />
      ))}
    </div>
  );
};
