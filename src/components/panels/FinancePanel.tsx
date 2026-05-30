import React, { useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import type { PLStatement } from '../../game/core/types';

function fmtNTD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `NT$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `NT$${(n / 1_000).toFixed(0)}K`;
  return `NT$${n.toLocaleString()}`;
}

function PLRow({ label, value, negative = false }: { label: string; value: number; negative?: boolean }) {
  const color = negative
    ? 'var(--tm-red)'
    : value > 0 ? 'var(--tm-green)' : 'var(--tm-text-dim)';
  return (
    <div className="pl-row">
      <span className="pl-label">{label}</span>
      <span className="pl-value" style={{ color }}>{fmtNTD(negative ? -value : value)}</span>
    </div>
  );
}

function PLSummary({ pl }: { pl: PLStatement }) {
  return (
    <div className="pl-summary">
      <div className="pl-section-title">上月損益</div>
      <PLRow label="營業收入" value={pl.income.total} />
      <PLRow label="營業支出" value={pl.expenses.total} negative />
      <div className="pl-divider" />
      <PLRow label="稅前淨利" value={pl.preTaxProfit} />
      <PLRow label="所得稅 (17%)" value={pl.taxAmount} negative />
      <div className="pl-divider" />
      <div className="pl-row pl-net">
        <span className="pl-label">稅後淨利</span>
        <span
          className="pl-value"
          style={{ color: pl.netProfit >= 0 ? 'var(--tm-green)' : 'var(--tm-red)', fontWeight: 'bold' }}
        >
          {fmtNTD(pl.netProfit)}
        </span>
      </div>
    </div>
  );
}

const CHART_HEIGHT = 56;

function PLTrendChart({ history }: { history: PLStatement[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (history.length === 0) return null;

  const maxVal = Math.max(
    1,
    ...history.map((p) => Math.max(p.income.total, p.expenses.total)),
  );

  return (
    <div className="pl-chart">
      <div className="pl-section-title" style={{ padding: '8px 14px 4px' }}>
        趨勢（近 {history.length} 個月）
      </div>
      <div className="pl-chart-bars">
        {history.map((pl, i) => {
          const revH = Math.max(2, (pl.income.total / maxVal) * CHART_HEIGHT);
          const expH = Math.max(2, (pl.expenses.total / maxVal) * CHART_HEIGHT);
          const isProfit = pl.netProfit >= 0;
          const isHovered = hovered === i;
          return (
            <div
              key={i}
              className="pl-chart-col"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && (
                <div className="pl-chart-tooltip">
                  <div>{pl.date.year}/{pl.date.month}</div>
                  <div style={{ color: 'var(--accent-green)' }}>收入 {fmtNTD(pl.income.total)}</div>
                  <div style={{ color: 'var(--accent-red)' }}>支出 {fmtNTD(pl.expenses.total)}</div>
                  <div style={{ color: isProfit ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    淨利 {fmtNTD(pl.netProfit)}
                  </div>
                </div>
              )}
              <div className="pl-chart-col-bars" style={{ height: CHART_HEIGHT }}>
                <div className="pl-bar pl-bar-rev" style={{ height: revH }} />
                <div className="pl-bar pl-bar-exp" style={{ height: expH }} />
              </div>
              <div className={`pl-chart-month-label ${isProfit ? 'profit' : 'loss'}`}>
                {pl.date.month}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const FinancePanel: React.FC = () => {
  const { cash, creditRating, lastPL, activeLoans, plHistory } = useUIStore();

  const totalDebt = activeLoans.reduce((s, l) => s + l.remainingBalance, 0);

  return (
    <div className="panel finance-panel">
      <div className="panel-title">▸ FINANCE OVERVIEW</div>

      <div className="finance-metrics">
        <div className="metric-block">
          <div className="metric-label">現金餘額</div>
          <div
            className="metric-value"
            style={{ color: cash < 500_000 ? 'var(--tm-red)' : 'var(--tm-cyan)', fontSize: '1.4em' }}
          >
            {fmtNTD(cash)}
          </div>
        </div>

        <div className="metric-block">
          <div className="metric-label">信用評等</div>
          <div
            className="metric-value"
            style={{ color: creditRatingColor(creditRating ?? 'A'), fontSize: '1.4em' }}
          >
            {creditRating ?? '—'}
          </div>
        </div>

        <div className="metric-block">
          <div className="metric-label">貸款餘額</div>
          <div className="metric-value" style={{ color: totalDebt > 0 ? 'var(--tm-yellow)' : 'var(--tm-text-dim)' }}>
            {totalDebt > 0 ? fmtNTD(totalDebt) : '—'}
          </div>
        </div>
      </div>

      {lastPL ? (
        <PLSummary pl={lastPL} />
      ) : (
        <div className="pl-empty">尚無月結算資料 — 等待首次月末結算</div>
      )}

      {plHistory.length > 0 && <PLTrendChart history={plHistory} />}

      {activeLoans.length > 0 && (
        <div className="loan-list">
          <div className="pl-section-title">有效貸款</div>
          {activeLoans.map(loan => (
            <div key={loan.id} className="loan-row">
              <span>{fmtNTD(loan.remainingBalance)}</span>
              <span style={{ color: 'var(--tm-text-dim)' }}>
                {(loan.annualRate * 100).toFixed(1)}% / 月繳 {fmtNTD(loan.monthlyPayment)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function creditRatingColor(rating: string): string {
  switch (rating) {
    case 'AAA': case 'AA': return 'var(--tm-green)';
    case 'A': case 'BBB': return 'var(--tm-cyan)';
    case 'BB': return 'var(--tm-yellow)';
    case 'B': return 'var(--tm-orange, #ff9944)';
    default: return 'var(--tm-red)';
  }
}
