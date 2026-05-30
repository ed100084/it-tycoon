import React, { useState } from 'react';
import { ContractStatus, ServiceType } from '../../game/core/types';
import type { Contract, RFP, BidParams } from '../../game/core/types';

interface Props {
  pendingRFPs: RFP[];
  activeContracts: Contract[];
  monthlyRevenue: number;
  onSubmitBid: (rfpId: string, bid: BidParams) => void;
  onDeclineRFP: (rfpId: string) => void;
  onDeclineRenewal: (contractId: string) => void;
}

const TIER_COLORS: Record<string, string> = {
  INDIVIDUAL: '#888',
  SMB: '#88ccff',
  ENTERPRISE: '#ffcc44',
  GOVERNMENT: '#ff8844',
  MULTINATIONAL: '#ff44ff',
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  [ServiceType.Colocation]:   '主機代管',
  [ServiceType.VPS]:          'VPS',
  [ServiceType.SaaS]:         'SaaS',
  [ServiceType.Bandwidth]:    '頻寬',
  [ServiceType.MSP]:          'MSP',
  [ServiceType.DRaaS]:        'DRaaS',
  [ServiceType.MSSP]:         'MSSP',
  [ServiceType.AICompute]:    'AI 算力',
  [ServiceType.ProfServices]: '顧問',
  [ServiceType.Training]:     '培訓',
};

function RFPCard({ rfp, onBid, onDecline }: {
  rfp: RFP;
  onBid: (bid: BidParams) => void;
  onDecline: () => void;
}) {
  const [bidFee, setBidFee] = useState(Math.round((rfp.budgetRange.min + rfp.budgetRange.max) / 2));
  const [sla] = useState(rfp.slaRequirement);
  const [duration] = useState(rfp.contractDurationMonths);
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ border: '1px solid #556', borderRadius: 6, padding: 10, fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ color: '#eee', fontWeight: 'bold' }}>{rfp.clientName}</span>
          <span style={{
            marginLeft: 8, fontSize: 10, padding: '1px 5px', borderRadius: 3,
            background: '#222', color: TIER_COLORS[rfp.clientTier] ?? '#aaa',
          }}>
            {rfp.clientTier}
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ padding: '1px 6px', background: '#1a2a1a', border: '1px solid #445544', borderRadius: 3, color: '#88aa88', cursor: 'pointer', fontSize: 10 }}
        >
          {expanded ? '收起' : '詳情'}
        </button>
      </div>

      <div style={{ marginTop: 4, color: '#aaa' }}>
        {SERVICE_LABELS[rfp.serviceType]} · SLA {rfp.slaRequirement}% · {rfp.contractDurationMonths}個月
      </div>
      <div style={{ color: '#888', fontSize: 11 }}>
        預算 NT${rfp.budgetRange.min.toLocaleString()} – NT${rfp.budgetRange.max.toLocaleString()}/月
        {rfp.competitorPresence && <span style={{ color: '#ff8844', marginLeft: 6 }}>⚡競爭</span>}
      </div>

      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ color: '#aaa', fontSize: 11 }}>
              報價 NT$
              <input
                type="number" value={bidFee} min={rfp.budgetRange.min}
                onChange={e => setBidFee(Number(e.target.value))}
                style={{ marginLeft: 4, width: 80, padding: '2px 4px', background: '#222', border: '1px solid #555', borderRadius: 3, color: '#eee', fontSize: 12 }}
              />
              /月
            </label>
            <span style={{ color: '#888', fontSize: 11 }}>
              SLA {sla}% · {duration}月合約
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onBid({
                monthlyFeeNTD: bidFee,
                slaLevel: sla,
                contractDurationMonths: duration,
                breachPenaltyMultiplier: 1.0,
                specialServices: [],
              })}
              style={{ flex: 1, padding: '4px 8px', background: '#1a3a1a', border: '1px solid #4a8a4a', borderRadius: 4, color: '#88ff88', cursor: 'pointer', fontSize: 12 }}
            >
              投標
            </button>
            <button
              onClick={onDecline}
              style={{ flex: 1, padding: '4px 8px', background: '#3a1a1a', border: '1px solid #884444', borderRadius: 4, color: '#ff8888', cursor: 'pointer', fontSize: 12 }}
            >
              放棄
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const ContractManagerPanel: React.FC<Props> = ({
  pendingRFPs,
  activeContracts,
  monthlyRevenue,
  onSubmitBid,
  onDeclineRFP,
  onDeclineRenewal,
}) => {
  const [tab, setTab] = useState<'rfp' | 'contracts'>('rfp');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#ccddff', fontSize: 15 }}>合約管理</h3>
        <span style={{ fontSize: 11, color: '#aaffaa' }}>月收入: NT${monthlyRevenue.toLocaleString()}</span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {(['rfp', 'contracts'] as const).map(t => (
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
            {t === 'rfp' ? `待處理 RFP (${pendingRFPs.length})` : `合約 (${activeContracts.length})`}
          </button>
        ))}
      </div>

      {tab === 'rfp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
          {pendingRFPs.length === 0 && (
            <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 16 }}>暫無待處理 RFP</div>
          )}
          {pendingRFPs.map(rfp => (
            <RFPCard
              key={rfp.id}
              rfp={rfp}
              onBid={bid => onSubmitBid(rfp.id, bid)}
              onDecline={() => onDeclineRFP(rfp.id)}
            />
          ))}
        </div>
      )}

      {tab === 'contracts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' }}>
          {activeContracts.length === 0 && (
            <div style={{ color: '#666', fontSize: 12, textAlign: 'center', padding: 16 }}>尚無活躍合約</div>
          )}
          {activeContracts.map(contract => {
            const recentSLA = contract.slaRecord.length > 0
              ? contract.slaRecord[contract.slaRecord.length - 1].uptimePercent
              : 100;
            const slaOk = recentSLA >= contract.slaLevel;
            return (
              <div key={contract.id} style={{ padding: '6px 8px', borderRadius: 4, border: `1px solid ${slaOk ? '#445' : '#844'}`, background: '#11151a', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#eee' }}>{contract.clientName}</span>
                  <span style={{ color: '#aaffaa', fontWeight: 'bold' }}>NT${contract.monthlyFeeNTD.toLocaleString()}/月</span>
                </div>
                <div style={{ color: '#888', marginTop: 2 }}>
                  {SERVICE_LABELS[contract.serviceType]} · SLA {contract.slaLevel}%
                  · 到期 {contract.endDate.year}/{String(contract.endDate.month).padStart(2, '0')}
                </div>
                <div style={{ marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: slaOk ? '#44ff88' : '#ff4444', fontSize: 11 }}>
                    最近可用率 {recentSLA.toFixed(2)}%
                  </span>
                  {contract.status === ContractStatus.Expired && (
                    <button
                      onClick={() => onDeclineRenewal(contract.id)}
                      style={{ padding: '1px 6px', background: '#3a1a1a', border: '1px solid #884444', borderRadius: 3, color: '#ff8888', cursor: 'pointer', fontSize: 10 }}
                    >
                      終止
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
