import React from 'react';
import type { NamedCustomer } from '../../game/core/types';

const INDUSTRY_ICONS: Record<string, string> = {
  healthcare: '🏥', finance: '🏦', tech: '💻',
  government: '🏛️', ecommerce: '🛒', manufacturing: '🏭',
};

const SIZE_COLORS: Record<string, string> = {
  XL: 'var(--tm-red)', L: '#ff8844', M: 'var(--tm-yellow)', S: '#aaa',
};

function LoyaltyBar({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--tm-green)' : score >= 40 ? 'var(--tm-yellow)' : 'var(--tm-red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 80 }}>
      <div style={{ flex: 1, background: '#1a1a1a', height: 4, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color }} />
      </div>
      <span style={{ color, fontSize: 10, minWidth: 22, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

interface Props {
  namedCustomers: NamedCustomer[];
}

export const CustomerPanel: React.FC<Props> = ({ namedCustomers }) => {
  const active = namedCustomers.filter(c => c.status === 'active');
  const churned = namedCustomers.filter(c => c.status === 'churned');

  const avgLoyalty = active.length > 0
    ? Math.round(active.reduce((s, c) => s + c.loyaltyScore, 0) / active.length)
    : 0;

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, padding: '8px 10px', background: '#0d0d1a', borderRadius: 4, border: '1px solid #223' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--tm-green)', fontSize: 18, fontWeight: 'bold' }}>{active.length}</div>
          <div style={{ color: '#888', fontSize: 10 }}>活躍客戶</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: avgLoyalty >= 70 ? 'var(--tm-green)' : avgLoyalty >= 40 ? 'var(--tm-yellow)' : 'var(--tm-red)', fontSize: 18, fontWeight: 'bold' }}>{avgLoyalty}</div>
          <div style={{ color: '#888', fontSize: 10 }}>平均忠誠度</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888', fontSize: 18 }}>{churned.length}</div>
          <div style={{ color: '#888', fontSize: 10 }}>已流失</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--tm-cyan)', fontSize: 18, fontWeight: 'bold' }}>
            {active.filter(c => c.totalRevenue > 0).length}
          </div>
          <div style={{ color: '#888', fontSize: 10 }}>有收入客戶</div>
        </div>
      </div>

      {/* Active customers */}
      {active.length === 0 ? (
        <div style={{ color: '#444', textAlign: 'center', padding: '24px 0', fontSize: 11 }}>
          尚無客戶。簽署合約後將自動建立客戶關係。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {active.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 8px', background: '#0d0d1a', borderRadius: 3,
              border: '1px solid #223',
            }}>
              <span style={{ fontSize: 14 }}>{INDUSTRY_ICONS[c.industry] ?? '🏢'}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{c.name}</span>
              <span style={{ color: SIZE_COLORS[c.size] ?? '#aaa', fontSize: 10, minWidth: 14 }}>{c.size}</span>
              <LoyaltyBar score={c.loyaltyScore} />
              <div style={{ textAlign: 'right', minWidth: 70 }}>
                <div style={{ color: 'var(--tm-cyan)', fontSize: 10 }}>
                  NT${(c.totalRevenue / 1_000).toFixed(0)}K
                </div>
                <div style={{ color: '#555', fontSize: 9 }}>{c.monthsAsCustomer}m</div>
              </div>
              {c.lastSurveyScore !== null && (
                <div style={{
                  minWidth: 28, textAlign: 'center', fontSize: 10,
                  color: c.lastSurveyScore >= 70 ? 'var(--tm-green)' : c.lastSurveyScore >= 40 ? 'var(--tm-yellow)' : 'var(--tm-red)',
                }}>
                  ★{c.lastSurveyScore}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {churned.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid #223', paddingTop: 8 }}>
          <div style={{ color: '#555', fontSize: 10, marginBottom: 4 }}>已流失 ({churned.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {churned.map(c => (
              <span key={c.id} style={{ color: '#444', fontSize: 10, background: '#111', padding: '2px 6px', borderRadius: 2 }}>
                {INDUSTRY_ICONS[c.industry] ?? '🏢'} {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
