import React from 'react';
import { InsuranceType } from '../../game/core/types';
import type { InsuranceState } from '../../game/core/types';

interface InsurancePanelProps {
  insuranceState: InsuranceState | null;
  monthlyRevenue: number;
  onPurchasePolicy: (type: InsuranceType) => void;
  onCancelPolicy: (policyId: string) => void;
}

const TYPE_NAMES: Record<InsuranceType, string> = {
  [InsuranceType.CyberSecurity]:        '資安保險',
  [InsuranceType.BusinessInterruption]: '營運中斷險',
  [InsuranceType.DAndO]:                'D&O 董監責任險',
  [InsuranceType.EAndO]:                'E&O 專業責任險',
};

const TYPE_DESCS: Record<InsuranceType, string> = {
  [InsuranceType.CyberSecurity]:        '降低資安事件財損 50%',
  [InsuranceType.BusinessInterruption]: '降低停機損失 60%',
  [InsuranceType.DAndO]:                '保障董監事因決策失誤所生法律責任',
  [InsuranceType.EAndO]:                '保障專業服務疏失所生賠償責任',
};

// Estimated base premium rates relative to annual revenue
const BASE_PREMIUM_RATES: Record<InsuranceType, number> = {
  [InsuranceType.CyberSecurity]:        0.012,
  [InsuranceType.BusinessInterruption]: 0.008,
  [InsuranceType.DAndO]:                0.006,
  [InsuranceType.EAndO]:                0.005,
};

const ALL_TYPES: InsuranceType[] = [
  InsuranceType.CyberSecurity,
  InsuranceType.BusinessInterruption,
  InsuranceType.DAndO,
  InsuranceType.EAndO,
];

function ntd(value: number): string {
  if (value >= 1_000_000) return `NT$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `NT$${(value / 1_000).toFixed(0)}K`;
  return `NT$${value.toLocaleString()}`;
}

export const InsurancePanel: React.FC<InsurancePanelProps> = ({
  insuranceState,
  monthlyRevenue,
  onPurchasePolicy,
  onCancelPolicy,
}) => {
  const annualRevenue = monthlyRevenue * 12;

  const activeMap = React.useMemo(() => {
    const map: Partial<Record<InsuranceType, typeof insuranceState extends null ? never : InsuranceState['policies'][number]>> = {};
    if (insuranceState) {
      for (const p of insuranceState.policies) {
        map[p.type] = p;
      }
    }
    return map;
  }, [insuranceState]);

  const multiplier = insuranceState?.premiumMultiplier ?? 1;
  const totalAnnual = insuranceState?.totalAnnualPremium ?? 0;
  const totalCoverage = insuranceState?.totalCoverage ?? 0;
  const claimsHistory = insuranceState?.claimsHistory ?? [];
  const recentClaims = claimsHistory.slice(-5).reverse();

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #334' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ color: '#aaa', fontSize: 11 }}>年繳總保費</div>
            <div style={{ color: 'var(--tm-red)', fontSize: 15, fontWeight: 'bold' }}>
              {ntd(totalAnnual)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#aaa', fontSize: 11 }}>總保障額度</div>
            <div style={{ color: 'var(--tm-cyan)', fontSize: 15, fontWeight: 'bold' }}>
              {ntd(totalCoverage)}
            </div>
          </div>
        </div>

        {multiplier > 1 && (
          <div style={{
            marginTop: 8, padding: '4px 8px',
            background: '#1a0000', border: '1px solid var(--tm-red)',
            borderRadius: 3, color: 'var(--tm-red)', fontSize: 11,
          }}>
            ⚠ 理賠記錄使保費上漲 {((multiplier - 1) * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Insurance types */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>保險項目</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ALL_TYPES.map(type => {
            const policy = activeMap[type];
            const estimatedPremium = Math.round(annualRevenue * BASE_PREMIUM_RATES[type] * multiplier);

            return (
              <div key={type} style={{
                padding: '8px 10px',
                background: '#0d0d1a',
                borderRadius: 4,
                border: policy ? '1px solid #336633' : '1px solid #223',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: policy ? 'var(--tm-green)' : 'var(--tm-text)', fontWeight: 'bold', fontSize: 11 }}>
                      {TYPE_NAMES[type]}
                      {policy && <span style={{ marginLeft: 6, color: 'var(--tm-green)', fontSize: 10 }}>● 生效中</span>}
                    </div>
                    <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>{TYPE_DESCS[type]}</div>
                  </div>
                </div>

                {policy ? (
                  <div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#aaa', marginBottom: 6 }}>
                      <span>年保費：<span style={{ color: 'var(--tm-red)' }}>{ntd(policy.annualPremiumNTD)}</span></span>
                      <span>理賠率：<span style={{ color: 'var(--tm-cyan)' }}>{(policy.coverageRate * 100).toFixed(0)}%</span></span>
                      <span>理賠次數：<span style={{ color: 'var(--tm-yellow)' }}>{policy.claimCount}</span></span>
                    </div>
                    <button
                      onClick={() => onCancelPolicy(policy.id)}
                      style={{
                        padding: '2px 10px', fontSize: 10,
                        background: '#1a0000', border: '1px solid #883333',
                        borderRadius: 3, color: '#cc6666', cursor: 'pointer', width: '100%',
                      }}
                    >
                      取消保單
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>
                      估計年保費：<span style={{ color: '#aaa' }}>{ntd(estimatedPremium)}</span>
                    </div>
                    <button
                      onClick={() => onPurchasePolicy(type)}
                      style={{
                        padding: '2px 10px', fontSize: 10,
                        background: '#0d1a0d', border: '1px solid #448844',
                        borderRadius: 3, color: 'var(--tm-green)', cursor: 'pointer', width: '100%',
                      }}
                    >
                      投保
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Claims history */}
      <div style={{ borderTop: '1px solid #334', paddingTop: 8 }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>
          理賠記錄（最近 {Math.min(5, recentClaims.length)} 筆）
        </div>

        {recentClaims.length === 0 ? (
          <div style={{ color: '#444', textAlign: 'center', padding: '12px 0', fontSize: 11 }}>
            ✓ 尚無理賠記錄
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentClaims.map((claim, idx) => (
              <div key={idx} style={{
                padding: '5px 8px',
                background: '#0d0d1a',
                borderRadius: 3,
                border: '1px solid #223',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ color: 'var(--tm-text)', fontSize: 11 }}>{TYPE_NAMES[claim.type]}</span>
                  <span style={{ color: '#666', fontSize: 10 }}>
                    {claim.date.year}/{String(claim.date.month).padStart(2, '0')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                  <span style={{ color: '#666' }}>損失：<span style={{ color: 'var(--tm-red)' }}>{ntd(claim.originalLossNTD)}</span></span>
                  <span style={{ color: '#666' }}>理賠：<span style={{ color: 'var(--tm-green)' }}>{ntd(claim.coveredAmountNTD)}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
