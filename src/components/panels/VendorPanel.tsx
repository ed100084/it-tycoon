import React from 'react';
import type { VendorRelationship, VendorLevel } from '../../game/core/types';

const LEVEL_COLORS: Record<VendorLevel, string> = {
  Bronze:   '#cd7f32',
  Silver:   '#c0c0c0',
  Gold:     '#ffd700',
  Platinum: '#e5e4e2',
};

const LEVEL_ICONS: Record<VendorLevel, string> = {
  Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎',
};

const VENDOR_ICONS: Record<string, string> = {
  DELL: '🖥️', HPE: '🗄️', CISCO: '🌐', FORTINET: '🔒', MICROSOFT: '☁️', VMWARE: '⚙️',
};

function RelBar({ score }: { score: number }) {
  const color = score >= 85 ? '#e5e4e2' : score >= 60 ? '#ffd700' : score >= 30 ? '#c0c0c0' : '#cd7f32';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
      <div style={{ flex: 1, background: '#1a1a1a', height: 5, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, transition: 'width 0.4s' }} />
      </div>
      <span style={{ color, fontSize: 10, minWidth: 24, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

interface Props {
  vendors: VendorRelationship[];
}

export const VendorPanel: React.FC<Props> = ({ vendors }) => {
  const totalSpend = vendors.reduce((s, v) => s + v.totalPurchases, 0);
  const goldPlat = vendors.filter(v => v.level === 'Gold' || v.level === 'Platinum').length;

  // Concentration risk
  const riskVendor = totalSpend > 0
    ? vendors.find(v => v.totalPurchases / totalSpend > 0.60)
    : null;

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, padding: '8px 10px', background: '#0d0d1a', borderRadius: 4, border: '1px solid #223' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--tm-cyan)', fontSize: 18, fontWeight: 'bold' }}>{vendors.length}</div>
          <div style={{ color: '#888', fontSize: 10 }}>供應商</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#ffd700', fontSize: 18, fontWeight: 'bold' }}>{goldPlat}</div>
          <div style={{ color: '#888', fontSize: 10 }}>Gold+</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--tm-green)', fontSize: 14, fontWeight: 'bold' }}>
            NT${(totalSpend / 1_000_000).toFixed(1)}M
          </div>
          <div style={{ color: '#888', fontSize: 10 }}>總採購額</div>
        </div>
      </div>

      {/* Concentration risk warning */}
      {riskVendor && (
        <div style={{
          marginBottom: 10, padding: '6px 10px', background: '#1a0d0d',
          border: '1px solid #553333', borderRadius: 4, fontSize: 11, color: '#ff8844',
        }}>
          ⚠ 供應商集中風險：{riskVendor.name} 佔採購量 {Math.round(riskVendor.totalPurchases / totalSpend * 100)}%
        </div>
      )}

      {/* Vendor list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {vendors.map(v => (
          <div key={v.vendorId} style={{
            padding: '6px 10px', background: '#0d0d1a', borderRadius: 4,
            border: `1px solid ${LEVEL_COLORS[v.level]}33`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 14 }}>{VENDOR_ICONS[v.vendorId] ?? '🏭'}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{v.name}</span>
              <span style={{ color: LEVEL_COLORS[v.level], fontSize: 11 }}>
                {LEVEL_ICONS[v.level]} {v.level}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RelBar score={v.relationshipLevel} />
              <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                {v.discountRate > 0 && (
                  <span style={{ color: 'var(--tm-green)' }}>
                    -{Math.round(v.discountRate * 100)}% 折扣
                  </span>
                )}
                {v.priorityDelivery && (
                  <span style={{ color: 'var(--tm-cyan)' }}>⚡ 優先交貨</span>
                )}
                {v.discountRate === 0 && !v.priorityDelivery && (
                  <span style={{ color: '#444' }}>無額外優惠</span>
                )}
              </div>
            </div>
            <div style={{ marginTop: 4, fontSize: 10, color: '#555' }}>
              採購：NT${(v.totalPurchases / 1_000).toFixed(0)}K
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, padding: '6px 8px', background: '#0d0d0d', borderRadius: 3, fontSize: 10, color: '#555' }}>
        購買硬體時自動累積供應商關係積分。Gold 獲得折扣，Platinum 享有優先交貨與獨家商品。
      </div>
    </div>
  );
};
