import React from 'react';
import type { CapacityPlanningState, CapacityMetric, CapacityRecommendation } from '../../game/core/types';
import { CapacityAlert } from '../../game/core/types';

interface CapacityPlanningPanelProps {
  planningState: CapacityPlanningState | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALERT_COLOR: Record<CapacityAlert, string> = {
  [CapacityAlert.Green]:  'var(--accent-green)',
  [CapacityAlert.Yellow]: 'var(--accent-yellow)',
  [CapacityAlert.Red]:    'var(--accent-red)',
};

const ALERT_LABEL: Record<CapacityAlert, string> = {
  [CapacityAlert.Green]:  '正常',
  [CapacityAlert.Yellow]: '警告',
  [CapacityAlert.Red]:    '緊急',
};

const REC_TYPE_ICON: Record<CapacityRecommendation['type'], string> = {
  rack:      '🗄',
  bandwidth: '🌐',
  power:     '⚡',
  staff:     '👤',
};

const REC_TYPE_LABEL: Record<CapacityRecommendation['type'], string> = {
  rack:      '機櫃',
  bandwidth: '頻寬',
  power:     '電力',
  staff:     '人力',
};

const MONTH_ZH = ['一月', '二月', '三月', '四月', '五月', '六月',
                  '七月', '八月', '九月', '十月', '十一月', '十二月'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `NT$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `NT$${(n / 1_000).toFixed(0)}K`;
  return `NT$${n}`;
}

function barColor(alert: CapacityAlert): string {
  return ALERT_COLOR[alert];
}

function monthLabel(date: { year: number; month: number } | null | undefined): string {
  if (!date) return '';
  const m = MONTH_ZH[(date.month - 1) % 12] ?? `${date.month}月`;
  return `${date.year} ${m}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const MetricGauge: React.FC<{ label: string; metric: CapacityMetric }> = ({ label, metric }) => {
  const { utilizationRate, forecastedUtilization6M, alert } = metric;
  const color = barColor(alert);
  const clampedUtil = Math.min(100, Math.max(0, utilizationRate));
  const clampedForecast = Math.min(100, Math.max(0, forecastedUtilization6M));

  return (
    <div
      className="capacity-metric-gauge"
      style={{
        border: `1px solid ${color}33`,
        borderRadius: 6,
        padding: '8px 10px',
        background: 'rgba(0,0,0,0.25)',
      }}
    >
      {/* Label + alert badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: '0.88em', opacity: 0.85 }}>{label}</span>
        <span
          style={{
            fontSize: '0.75em',
            color,
            border: `1px solid ${color}`,
            borderRadius: 4,
            padding: '1px 5px',
            lineHeight: 1.3,
          }}
        >
          {ALERT_LABEL[alert]}
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          marginBottom: 5,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${clampedUtil}%`,
            background: color,
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Numbers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82em' }}>
        <span>
          現況：<span style={{ color, fontWeight: 'bold' }}>{pct(utilizationRate)}</span>
        </span>
        <span style={{ opacity: 0.7 }}>
          預測(6M)：<span style={{ color: clampedForecast >= 80 ? 'var(--accent-red)' : 'var(--accent-yellow)' }}>
            {pct(forecastedUtilization6M)}
          </span>
        </span>
      </div>
    </div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

export const CapacityPlanningPanel: React.FC<CapacityPlanningPanelProps> = ({ planningState }) => {
  if (!planningState) {
    return (
      <div className="crt-panel">
        <div className="panel-body" style={{ opacity: 0.5 }}>容量規劃系統尚未啟動...</div>
      </div>
    );
  }

  const { metrics, alerts, recommendations, monthlyHistory } = planningState;

  // Alert counts
  const alertCounts = alerts.reduce<Record<CapacityAlert, number>>(
    (acc, a) => { acc[a] = (acc[a] ?? 0) + 1; return acc; },
    { [CapacityAlert.Green]: 0, [CapacityAlert.Yellow]: 0, [CapacityAlert.Red]: 0 },
  );

  // Last 6 months of history
  const recentHistory = monthlyHistory.slice(-6);

  const gauges: Array<{ label: string; metric: CapacityMetric }> = [
    { label: '機櫃使用率',  metric: metrics.rackUtilization },
    { label: '頻寬使用率',  metric: metrics.bandwidthUtilization },
    { label: '電力使用率',  metric: metrics.powerUtilization },
    { label: '人力覆蓋率',  metric: metrics.staffCoverage },
  ];

  return (
    <div className="crt-panel capacity-planning-panel" style={{ marginTop: '12px' }}>
      <div className="panel-header">📊 容量規劃</div>
      <div className="panel-body">

        {/* ── 4 Metric Gauges in 2×2 grid ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {gauges.map(({ label, metric }) => (
            <MetricGauge key={label} label={label} metric={metric} />
          ))}
        </div>

        {/* ── Alerts Summary ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ opacity: 0.7, fontSize: '0.85em', marginBottom: 6 }}>警示摘要</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {([CapacityAlert.Red, CapacityAlert.Yellow, CapacityAlert.Green] as CapacityAlert[]).map(level => (
              <div
                key={level}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  border: `1px solid ${ALERT_COLOR[level]}55`,
                  borderRadius: 5,
                  background: `${ALERT_COLOR[level]}11`,
                }}
              >
                <span style={{ color: ALERT_COLOR[level], fontWeight: 'bold', fontSize: '1.1em' }}>
                  {alertCounts[level]}
                </span>
                <span style={{ color: ALERT_COLOR[level], fontSize: '0.85em' }}>
                  {ALERT_LABEL[level]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recommendations ── */}
        {recommendations.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ opacity: 0.7, fontSize: '0.85em', marginBottom: 6 }}>
              建議事項 ({recommendations.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recommendations.map((rec, i) => {
                const urgencyColor = ALERT_COLOR[rec.urgency];
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '6px 10px',
                      border: `1px solid ${urgencyColor}33`,
                      borderRadius: 5,
                      background: 'rgba(0,0,0,0.2)',
                    }}
                  >
                    {/* Type icon */}
                    <span style={{ fontSize: '1.1em', flexShrink: 0, marginTop: 1 }}>
                      {REC_TYPE_ICON[rec.type]}
                    </span>

                    {/* Description + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.87em', lineHeight: 1.4, marginBottom: 4 }}>
                        <span style={{ opacity: 0.55, fontSize: '0.85em', marginRight: 4 }}>
                          [{REC_TYPE_LABEL[rec.type]}]
                        </span>
                        {rec.description}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8em' }}>
                        {/* Urgency badge */}
                        <span
                          style={{
                            color: urgencyColor,
                            border: `1px solid ${urgencyColor}`,
                            borderRadius: 3,
                            padding: '0 5px',
                          }}
                        >
                          {ALERT_LABEL[rec.urgency]}
                        </span>
                        {/* Cost */}
                        <span style={{ opacity: 0.65 }}>
                          預估費用：{fmtMoney(rec.estimatedCostNTD)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Capacity Trend (last 6 months) ── */}
        {recentHistory.length > 0 && (
          <div>
            <div style={{ opacity: 0.7, fontSize: '0.85em', marginBottom: 6 }}>容量趨勢（近 6 個月）</div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '0.82em',
                lineHeight: 1.8,
                background: 'rgba(0,0,0,0.25)',
                borderRadius: 5,
                padding: '8px 10px',
                overflowX: 'auto',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', gap: 0, opacity: 0.55, marginBottom: 4 }}>
                <span style={{ width: 90, flexShrink: 0 }}>月份</span>
                <span style={{ width: 58, textAlign: 'right', flexShrink: 0 }}>機櫃</span>
                <span style={{ width: 58, textAlign: 'right', flexShrink: 0 }}>頻寬</span>
                <span style={{ width: 58, textAlign: 'right', flexShrink: 0 }}>電力</span>
                <span style={{ width: 58, textAlign: 'right', flexShrink: 0 }}>人力</span>
              </div>
              {recentHistory.map((snap, i) => {
                const highRack  = snap.rackUtil    >= 80;
                const highBw    = snap.bwUtil       >= 80;
                const highPow   = snap.powerUtil    >= 80;
                const lowStaff  = snap.staffCoverage < 70;
                return (
                  <div key={i} style={{ display: 'flex', gap: 0 }}>
                    <span style={{ width: 90, flexShrink: 0, opacity: 0.75 }}>
                      {monthLabel(snap.date)}
                    </span>
                    <span style={{ width: 58, textAlign: 'right', flexShrink: 0, color: highRack ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                      {pct(snap.rackUtil)}
                    </span>
                    <span style={{ width: 58, textAlign: 'right', flexShrink: 0, color: highBw ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                      {pct(snap.bwUtil)}
                    </span>
                    <span style={{ width: 58, textAlign: 'right', flexShrink: 0, color: highPow ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                      {pct(snap.powerUtil)}
                    </span>
                    <span style={{ width: 58, textAlign: 'right', flexShrink: 0, color: lowStaff ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
                      {pct(snap.staffCoverage)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ opacity: 0.4, fontSize: '0.75em', marginTop: 4 }}>
              閾值：機/頻/電 ≥80% 為紅；人力 &lt;70% 為黃
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
