import React, { useState } from 'react';
import type { Achievement, Competitor } from '../../game/core/types';

interface Props {
  satisfactionScore: number;
  achievements: Achievement[];
  competitors: Competitor[];
  playerMarketShare: number;
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

function MarketBar({ label, share, color }: { label: string; share: number; color: string }) {
  const pct = Math.round(share * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: '#ccc' }}>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ background: '#1a1a2a', borderRadius: 3, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

const SPECIALTY_LABELS: Record<string, string> = {
  colo: 'Colo 強項',
  vps: 'VPS 強項',
  ai: 'AI/ML 強項',
};

export const ReputationPanel: React.FC<Props> = ({
  satisfactionScore,
  achievements,
  competitors,
  playerMarketShare,
}) => {
  const [tab, setTab] = useState<'reputation' | 'achievements' | 'market'>('reputation');
  const color = getScoreColor(satisfactionScore);
  const label = getScoreLabel(satisfactionScore);

  const unlockedCount = achievements.filter(a => a.unlockedAt !== null).length;

  const rfpMod = satisfactionScore >= 80 ? 1.2 : satisfactionScore >= 50 ? 1.0 : 0.7;
  const renewalBonus = satisfactionScore >= 80 ? '+40%' : satisfactionScore >= 50 ? '0%' : '-30%';
  const pricePower = satisfactionScore >= 80 ? '可漲價 5–15%' : '—';
  const lossRisk = satisfactionScore >= 80 ? '×0.7' : satisfactionScore >= 50 ? '×1.0' : satisfactionScore >= 40 ? '×1.5' : '×2.0';

  const tabs = [
    { id: 'reputation' as const, label: '⭐ 聲譽' },
    { id: 'achievements' as const, label: `🏆 成就 (${unlockedCount}/${achievements.length})` },
    { id: 'market' as const, label: '📊 市場' },
  ];

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid #334', paddingBottom: 8 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: 11,
              background: tab === t.id ? '#1a2a3a' : 'transparent',
              border: tab === t.id ? '1px solid #4488aa' : '1px solid #334',
              borderRadius: 4,
              color: tab === t.id ? '#88ccff' : '#888',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Reputation tab ── */}
      {tab === 'reputation' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 48, fontWeight: 'bold', color, lineHeight: 1 }}>
              {satisfactionScore.toFixed(0)}
            </div>
            <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>客戶滿意度</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ background: '#1a1a1a', borderRadius: 4, height: 10, overflow: 'hidden', margin: '0 auto', maxWidth: 200 }}>
                <div style={{ width: `${satisfactionScore}%`, height: '100%', background: color, transition: 'width 0.5s' }} />
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
        </>
      )}

      {/* ── Achievements tab ── */}
      {tab === 'achievements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
            已解鎖 {unlockedCount} / {achievements.length} 個成就
          </div>
          <div style={{
            background: '#1a1a2a', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 8,
          }}>
            <div style={{
              width: `${(unlockedCount / Math.max(1, achievements.length)) * 100}%`,
              height: '100%', background: 'var(--tm-cyan)',
            }} />
          </div>
          {achievements.map(ach => {
            const unlocked = ach.unlockedAt !== null;
            return (
              <div
                key={ach.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  padding: '6px 8px',
                  borderRadius: 4,
                  background: unlocked ? '#0d2a1a' : '#111',
                  border: unlocked ? '1px solid #2a5a2a' : '1px solid #222',
                  opacity: unlocked ? 1 : 0.5,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, minWidth: 24, textAlign: 'center' }}>
                  {ach.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: unlocked ? 'var(--tm-green)' : '#666',
                  }}>
                    {ach.name}
                    {unlocked && ach.unlockedAt && (
                      <span style={{ fontSize: 10, color: '#557755', marginLeft: 6, fontWeight: 'normal' }}>
                        {ach.unlockedAt.year}/{ach.unlockedAt.month}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#777', marginTop: 2 }}>{ach.description}</div>
                  {(ach.rewardReputation || ach.rewardCash) && (
                    <div style={{ fontSize: 10, color: '#558855', marginTop: 2 }}>
                      獎勵：{ach.rewardReputation ? `聲譽 +${ach.rewardReputation}` : ''}
                      {ach.rewardCash ? `NT$${(ach.rewardCash / 1000).toFixed(0)}K 獎金` : ''}
                    </div>
                  )}
                </div>
                {unlocked && (
                  <span style={{ color: 'var(--tm-green)', fontSize: 16 }}>✓</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Market Competition tab ── */}
      {tab === 'market' && (
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>台灣 IDC 市場佔有率</div>
          <MarketBar label="▶ 我方" share={playerMarketShare} color="var(--tm-cyan)" />
          {competitors.map(comp => (
            <MarketBar
              key={comp.id}
              label={comp.name}
              share={comp.marketShare}
              color={comp.techLevel >= 4 ? 'var(--tm-red)' : '#ff8844'}
            />
          ))}
          <div style={{
            fontSize: 10, color: '#555', marginTop: 4, marginBottom: 12,
            borderBottom: '1px solid #223', paddingBottom: 8,
          }}>
            (市場其他業者：{Math.max(0, Math.round((1 - playerMarketShare - competitors.reduce((s, c) => s + c.marketShare, 0)) * 100))}%)
          </div>

          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>競爭對手詳情</div>
          {competitors.map(comp => (
            <div
              key={comp.id}
              style={{
                padding: '8px',
                marginBottom: 6,
                background: '#111',
                border: '1px solid #2a2a3a',
                borderRadius: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#ccddff', fontSize: 12 }}>{comp.name}</span>
                <span style={{ fontSize: 10, color: '#557', background: '#1a1a2a', padding: '1px 5px', borderRadius: 3 }}>
                  {SPECIALTY_LABELS[comp.specialty] ?? comp.specialty}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 3 }}>{comp.description}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', marginTop: 6, fontSize: 10 }}>
                <span style={{ color: '#555' }}>聲譽</span>
                <span style={{ color: '#aaa' }}>{comp.reputation.toFixed(0)}</span>
                <span style={{ color: '#555' }}>技術等級</span>
                <span style={{ color: '#aaa' }}>{'★'.repeat(Math.round(comp.techLevel))}{'☆'.repeat(5 - Math.round(comp.techLevel))}</span>
                <span style={{ color: '#555' }}>定價指數</span>
                <span style={{ color: comp.pricingIndex < 1 ? 'var(--tm-red)' : '#aaa' }}>×{comp.pricingIndex.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
