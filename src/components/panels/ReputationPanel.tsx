import React from 'react';

interface Props {
  satisfactionScore: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--tm-green)';
  if (score >= 50) return 'var(--tm-cyan)';
  if (score >= 40) return 'var(--tm-yellow)';
  return 'var(--tm-red)';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '卓越 — 自動續約率 +40%，可要求漲價';
  if (score >= 50) return '正常 — 標準合約條件';
  if (score >= 40) return '不佳 — 合約到期幾乎不續約';
  return '危機 — 合約提前終止風險 +30%';
}

export const ReputationPanel: React.FC<Props> = ({ satisfactionScore }) => {
  const color = getScoreColor(satisfactionScore);
  const label = getScoreLabel(satisfactionScore);

  const rfpMod = satisfactionScore >= 80 ? 1.2 : satisfactionScore >= 50 ? 1.0 : 0.7;
  const renewalBonus = satisfactionScore >= 80 ? '+40%' : satisfactionScore >= 50 ? '0%' : '-30%';
  const pricePower = satisfactionScore >= 80 ? '可漲價 5–15%' : '—';
  const lossRisk = satisfactionScore >= 80 ? '×0.7' : satisfactionScore >= 50 ? '×1.0' : satisfactionScore >= 40 ? '×1.5' : '×2.0';

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 48, fontWeight: 'bold', color, lineHeight: 1 }}>
          {satisfactionScore.toFixed(0)}
        </div>
        <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>客戶滿意度</div>
        <div style={{ marginTop: 8 }}>
          <div style={{ background: '#1a1a1a', borderRadius: 4, height: 10, overflow: 'hidden', margin: '0 auto', maxWidth: 200 }}>
            <div style={{
              width: `${satisfactionScore}%`, height: '100%',
              background: color, transition: 'width 0.5s',
            }} />
          </div>
        </div>
        <div style={{ color, fontSize: 11, marginTop: 8 }}>{label}</div>
      </div>

      <div style={{ borderTop: '1px solid #334', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'RFP 頻率修正', value: `×${rfpMod.toFixed(1)}` },
          { label: '續約成功率修正', value: renewalBonus },
          { label: '定價能力', value: pricePower },
          { label: '合約流失風險', value: lossRisk },
        ].map(({ label: l, value }) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#777' }}>{l}</span>
            <span style={{ color: '#ccc' }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 10, color: '#444', borderTop: '1px solid #223', paddingTop: 8 }}>
        <div>影響滿意度的因素：</div>
        <div style={{ marginTop: 4, lineHeight: 1.6 }}>
          • P1 事件處理成功 +3 ／ 超時 −5/hr<br/>
          • 資料外洩 −15 ／ 勒索軟體 −10<br/>
          • 大型合約續簽 +5 ／ 流失 −10<br/>
          • 人力覆蓋不足 −2 至 −10/月<br/>
          • 自然回復：+1/月（分數 &lt; 80）
        </div>
      </div>
    </div>
  );
};
