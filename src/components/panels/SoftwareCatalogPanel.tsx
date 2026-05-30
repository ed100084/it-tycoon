import React, { useState } from 'react';
import { LicenseStatus } from '../../game/core/types';
import type { SoftwareLicense, SoftwareProduct } from '../../game/core/types';

interface Props {
  availableProducts: SoftwareProduct[];
  licenses: SoftwareLicense[];
  complianceScore: number;
  currentYear?: number;
  onPurchase: (productId: string) => void;
  onCancel: (licenseId: string) => void;
}

const STATUS_COLOR: Record<LicenseStatus, string> = {
  [LicenseStatus.Active]:     '#44ff88',
  [LicenseStatus.EosWarning]: '#ffaa44',
  [LicenseStatus.EosExpired]: '#ff4444',
  [LicenseStatus.Cancelled]:  '#666',
  [LicenseStatus.Upgrading]:  '#44aaff',
};

const STATUS_LABEL: Record<LicenseStatus, string> = {
  [LicenseStatus.Active]:     '正常',
  [LicenseStatus.EosWarning]: 'EOS 警告',
  [LicenseStatus.EosExpired]: 'EOS 過期',
  [LicenseStatus.Cancelled]:  '已取消',
  [LicenseStatus.Upgrading]:  '升級中',
};

function ComplianceBar({ score }: { score: number }) {
  const color = score >= 80 ? '#44ff88' : score >= 50 ? '#ffaa44' : '#ff4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, color, minWidth: 32, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

export const SoftwareCatalogPanel: React.FC<Props> = ({
  availableProducts,
  licenses,
  complianceScore,
  currentYear,
  onPurchase,
  onCancel,
}) => {
  const [tab, setTab] = useState<'products' | 'licenses'>('products');

  const activeLicenses = licenses.filter(l => l.status !== LicenseStatus.Cancelled);
  const ownedProductIds = new Set(activeLicenses.map(l => l.productId));
  const monthlyTotal = licenses
    .filter(l => l.status === LicenseStatus.Active || l.status === LicenseStatus.EosWarning)
    .reduce((s, l) => s + Math.round(l.annualCostNTD / 12), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#ccddff', fontSize: 15 }}>軟體授權管理</h3>
        <span style={{ fontSize: 11, color: '#aaa' }}>月費: NT${monthlyTotal.toLocaleString()}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#aaa' }}>
          <span>合規分數</span>
        </div>
        <ComplianceBar score={complianceScore} />
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {(['products', 'licenses'] as const).map(t => (
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
            {t === 'products' ? '可購買' : `授權 (${activeLicenses.length})`}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {availableProducts.map(product => {
            const owned = ownedProductIds.has(product.id);
            const isEos = currentYear !== undefined && product.eosYear !== 9999 && currentYear > product.eosYear;
            return (
              <div
                key={product.id}
                style={{
                  padding: '6px 8px', borderRadius: 4,
                  border: `1px solid ${owned ? '#446644' : isEos ? '#664422' : '#444'}`,
                  background: owned ? '#111a11' : isEos ? '#1a1208' : '#11151a',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: isEos ? '#cc8855' : '#ddd' }}>{product.name}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isEos && (
                      <span style={{ fontSize: 10, color: '#ff8844', background: '#3a1a0a', padding: '1px 5px', borderRadius: 3 }}>
                        EOS 過期
                      </span>
                    )}
                    <span style={{ color: product.isFreeOpenSource ? '#88ff88' : '#ffcc44', fontSize: 11 }}>
                      {product.isFreeOpenSource ? '免費' : `NT${product.annualCostNTD.toLocaleString()}/年`}
                    </span>
                    {!owned && (
                      <button
                        onClick={() => onPurchase(product.id)}
                        style={{ padding: '1px 8px', background: '#1a3a1a', border: '1px solid #4a8a4a', borderRadius: 3, color: '#88ff88', cursor: 'pointer', fontSize: 11 }}
                      >
                        購買
                      </button>
                    )}
                    {owned && <span style={{ color: '#44ff88', fontSize: 10 }}>✓ 已有</span>}
                  </div>
                </div>
                <div style={{ color: '#777', fontSize: 11, marginTop: 2 }}>
                  {product.vendor} · EOS {product.eosYear === 9999 ? '無限期' : product.eosYear}
                  {product.effects.map((e, i) => (
                    <span key={i} style={{ marginLeft: 6, color: '#88aaff' }}>
                      {e.type} +{e.value}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'licenses' && (
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeLicenses.length === 0 && (
            <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 16 }}>尚無授權</div>
          )}
          {activeLicenses.map(license => (
            <div key={license.id} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #444', background: '#11151a', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#ddd' }}>{license.productId}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: STATUS_COLOR[license.status], fontSize: 11 }}>{STATUS_LABEL[license.status]}</span>
                  {license.status === LicenseStatus.Active && (
                    <button
                      onClick={() => onCancel(license.id)}
                      style={{ padding: '1px 6px', background: '#3a1a1a', border: '1px solid #884444', borderRadius: 3, color: '#ff8888', cursor: 'pointer', fontSize: 10 }}
                    >
                      取消
                    </button>
                  )}
                </div>
              </div>
              <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                月費: NT${Math.round(license.annualCostNTD / 12).toLocaleString()}
                · EOS: {license.eosDate.year === 9999 ? '無限期' : `${license.eosDate.year}/${license.eosDate.month}`}
                {license.monthsSinceEOS > 0 && (
                  <span style={{ color: '#ff6644', marginLeft: 6 }}>逾期 {license.monthsSinceEOS} 月</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
