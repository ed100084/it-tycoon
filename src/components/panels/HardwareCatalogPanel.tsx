import React, { useState } from 'react';
import { FacilityRegion, AssetStatus, PurchasePaymentMethod } from '../../game/core/types';
import type { HardwareAsset, HardwareModel } from '../../game/core/types';

interface Props {
  availableModels: HardwareModel[];
  assets: HardwareAsset[];
  currentYear: number;
  onPurchase: (modelId: string, qty: number, region: FacilityRegion, method: PurchasePaymentMethod) => void;
  onDispose: (assetId: string) => void;
}

const REGION_LABELS: Record<FacilityRegion, string> = {
  [FacilityRegion.North]: '北區',
  [FacilityRegion.Central]: '中區',
  [FacilityRegion.South]: '南區',
};

const STATUS_COLORS: Record<AssetStatus, string> = {
  [AssetStatus.InTransit]:  '#ffaa44',
  [AssetStatus.Installing]: '#44aaff',
  [AssetStatus.Active]:     '#44ff88',
  [AssetStatus.Failed]:     '#ff4444',
  [AssetStatus.EOL]:        '#ff8844',
  [AssetStatus.Disposed]:   '#666',
};

export const HardwareCatalogPanel: React.FC<Props> = ({
  availableModels,
  assets,
  onPurchase,
  onDispose,
}) => {
  const [tab, setTab] = useState<'catalog' | 'assets'>('catalog');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [region, setRegion] = useState<FacilityRegion>(FacilityRegion.North);
  const [method, setMethod] = useState<PurchasePaymentMethod>(PurchasePaymentMethod.Cash);

  const activeAssets = assets.filter(a => a.status !== AssetStatus.Disposed);

  const handleBuy = () => {
    if (!selectedModel) return;
    onPurchase(selectedModel, qty, region, method);
    setSelectedModel(null);
    setQty(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <h3 style={{ margin: 0, color: '#ccddff', fontSize: 15 }}>硬體目錄</h3>

      <div style={{ display: 'flex', gap: 4 }}>
        {(['catalog', 'assets'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
              background: tab === t ? '#2a3a5a' : '#1a1a2a',
              border: `1px solid ${tab === t ? '#4488cc' : '#444'}`,
              color: tab === t ? '#88ccff' : '#aaa',
            }}
          >
            {t === 'catalog' ? '購買目錄' : `已安裝 (${activeAssets.length})`}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {availableModels.map(model => (
              <div
                key={model.id}
                onClick={() => setSelectedModel(model.id === selectedModel ? null : model.id)}
                style={{
                  padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${model.id === selectedModel ? '#4488cc' : '#444'}`,
                  background: model.id === selectedModel ? '#1a2a3a' : '#11151a',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#ddd' }}>{model.name}</span>
                  <span style={{ color: '#aaffaa' }}>NT${model.pricing.basePriceNTD.toLocaleString()}</span>
                </div>
                <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                  {model.specs.rackUnits}U · {model.specs.powerWatts}W · EOL {model.eolYear}
                  {model.isODM && ' · ODM-25%'}
                  {model.isPremium && ' · Premium+25%'}
                </div>
              </div>
            ))}
          </div>

          {selectedModel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px', border: '1px solid #446', borderRadius: 4, background: '#12151e' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
                  數量:
                  <input
                    type="number" min={1} max={50} value={qty}
                    onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                    style={{ width: 50, padding: '2px 4px', background: '#222', border: '1px solid #555', borderRadius: 3, color: '#eee', fontSize: 12 }}
                  />
                </label>
                <select
                  value={region}
                  onChange={e => setRegion(e.target.value as FacilityRegion)}
                  style={{ padding: '2px 6px', background: '#222', border: '1px solid #555', borderRadius: 3, color: '#eee', fontSize: 12 }}
                >
                  {Object.values(FacilityRegion).map(r => (
                    <option key={r} value={r}>{REGION_LABELS[r]}</option>
                  ))}
                </select>
                <select
                  value={method}
                  onChange={e => setMethod(e.target.value as PurchasePaymentMethod)}
                  style={{ padding: '2px 6px', background: '#222', border: '1px solid #555', borderRadius: 3, color: '#eee', fontSize: 12 }}
                >
                  <option value={PurchasePaymentMethod.Cash}>現金</option>
                  <option value={PurchasePaymentMethod.Installment}>分期24月</option>
                  <option value={PurchasePaymentMethod.RequisitionForm}>簽呈-25%</option>
                </select>
              </div>
              <button
                onClick={handleBuy}
                style={{ padding: '5px 10px', background: '#1a3a1a', border: '1px solid #4a8a4a', borderRadius: 4, color: '#88ff88', cursor: 'pointer', fontSize: 12 }}
              >
                確認採購
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'assets' && (
        <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeAssets.length === 0 && (
            <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 16 }}>尚無安裝硬體</div>
          )}
          {activeAssets.map(asset => (
            <div key={asset.id} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #444', background: '#11151a', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#ddd' }}>{asset.modelId}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: STATUS_COLORS[asset.status], fontSize: 11 }}>{asset.status}</span>
                  {asset.status === AssetStatus.Active && (
                    <button
                      onClick={() => onDispose(asset.id)}
                      style={{ padding: '1px 6px', background: '#3a1a1a', border: '1px solid #884444', borderRadius: 3, color: '#ff8888', cursor: 'pointer', fontSize: 10 }}
                    >
                      汰換
                    </button>
                  )}
                </div>
              </div>
              <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                {REGION_LABELS[asset.region]} · 帳面: NT${asset.bookValue.toLocaleString()}
                {asset.isEOL && <span style={{ color: '#ff6644', marginLeft: 6 }}>EOL +{asset.monthsSinceEOL}月</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
