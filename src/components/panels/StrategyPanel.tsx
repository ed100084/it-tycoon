import React from 'react';
import type { StrategyScores } from '../../game/core/types';

const ROUTE_LABELS: Record<string, string> = {
  GOVERNMENT: '🏛️ 政府機關',
  STARTUP:    '🚀 新創企業',
  ENTERPRISE: '🏢 大型企業',
};

const ROUTE_COLORS: Record<string, string> = {
  GOVERNMENT: '#4488ff',
  STARTUP:    '#44ff88',
  ENTERPRISE: '#ff8844',
};

const ROUTE_DESCRIPTIONS: Record<string, string> = {
  GOVERNMENT: '穩定合約、嚴格合規、政府採購加速。適合 DRaaS、MSSP 服務。',
  STARTUP:    '快速成長、靈活定價、口碑效應強。適合 VPS、SaaS 服務。',
  ENTERPRISE: 'AI 算力、大型 MSP、高 ARPU。適合 AI 運算與大型外包。',
};

function PctBar({ route, pct, isDominant }: { route: string; pct: number; isDominant: boolean }) {
  const color = ROUTE_COLORS[route] ?? '#888';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
        <span style={{ color: isDominant ? color : '#888' }}>
          {ROUTE_LABELS[route] ?? route}
          {isDominant && <span style={{ marginLeft: 6, fontSize: 9, background: `${color}33`, padding: '1px 4px', borderRadius: 2, color }}>主力</span>}
        </span>
        <span style={{ color }}>{Math.round(pct * 100)}%</span>
      </div>
      <div style={{ background: '#1a1a1a', borderRadius: 3, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, transition: 'width 0.4s' }} />
      </div>
      <div style={{ color: '#555', fontSize: 10, marginTop: 3 }}>{ROUTE_DESCRIPTIONS[route]}</div>
    </div>
  );
}

interface Props {
  strategyScores: StrategyScores;
  strategyDominantRoute: string | null;
  strategyEstablishedRoutes: string[];
}

export const StrategyPanel: React.FC<Props> = ({
  strategyScores, strategyDominantRoute, strategyEstablishedRoutes,
}) => {
  const total = strategyScores.government + strategyScores.startup + strategyScores.enterprise;
  const pcts = total === 0
    ? { government: 1 / 3, startup: 1 / 3, enterprise: 1 / 3 }
    : {
        government: strategyScores.government / total,
        startup: strategyScores.startup / total,
        enterprise: strategyScores.enterprise / total,
      };

  const routes: Array<{ key: string; route: string; pct: number; score: number }> = [
    { key: 'GOVERNMENT', route: 'GOVERNMENT', pct: pcts.government, score: strategyScores.government },
    { key: 'STARTUP',    route: 'STARTUP',    pct: pcts.startup,    score: strategyScores.startup },
    { key: 'ENTERPRISE', route: 'ENTERPRISE', pct: pcts.enterprise, score: strategyScores.enterprise },
  ];

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 12, padding: '8px 10px', background: '#0d0d1a', borderRadius: 4, border: '1px solid #223' }}>
        <div style={{ color: '#888', fontSize: 10, marginBottom: 4 }}>策略方向（由合約、科技、人才決定）</div>
        {strategyDominantRoute ? (
          <div style={{ color: ROUTE_COLORS[strategyDominantRoute] ?? '#aaa', fontWeight: 'bold' }}>
            主力路線：{ROUTE_LABELS[strategyDominantRoute] ?? strategyDominantRoute}
          </div>
        ) : (
          <div style={{ color: '#555' }}>尚未確立主力路線（需超過 60% 集中度）</div>
        )}
      </div>

      {/* Route bars */}
      {routes.map(r => (
        <PctBar key={r.key} route={r.route} pct={r.pct} isDominant={r.route === strategyDominantRoute} />
      ))}

      {/* Established routes */}
      {strategyEstablishedRoutes.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #223', paddingTop: 8 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>已確立路線</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {strategyEstablishedRoutes.map(r => (
              <span key={r} style={{
                padding: '2px 8px', borderRadius: 10, fontSize: 10,
                background: `${ROUTE_COLORS[r] ?? '#888'}22`,
                border: `1px solid ${ROUTE_COLORS[r] ?? '#888'}66`,
                color: ROUTE_COLORS[r] ?? '#888',
              }}>
                {ROUTE_LABELS[r] ?? r}
              </span>
            ))}
          </div>
          <div style={{ color: '#555', fontSize: 10, marginTop: 6 }}>
            已確立路線的 RFP 投標加成 +30%
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, padding: '6px 8px', background: '#0d0d0d', borderRadius: 3, fontSize: 10, color: '#555' }}>
        策略分數由簽署合約、研究科技、雇用員工自動累積。建議集中發展一條路線以獲得加成效果。
      </div>
    </div>
  );
};
