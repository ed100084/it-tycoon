import React, { useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import type { PLStatement } from '../../game/core/types';

function fmtNTD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `NT$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `NT$${(n / 1_000).toFixed(0)}K`;
  return `NT$${n.toLocaleString()}`;
}

function creditRatingColor(rating: string): string {
  switch (rating) {
    case 'AAA': case 'AA': return 'var(--tm-green)';
    case 'A': case 'BBB': return 'var(--tm-cyan)';
    case 'BB': return 'var(--tm-yellow)';
    case 'B': return 'var(--accent-orange, #ff9944)';
    default: return 'var(--tm-red)';
  }
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      flex: 1,
      background: '#0d1520',
      border: '1px solid #223',
      borderRadius: 5,
      padding: '8px 10px',
      minWidth: 80,
    }}>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 'bold', color: color ?? 'var(--tm-text)' }}>{value}</div>
    </div>
  );
}

// ── Cost structure bar ────────────────────────────────────────────────────────

function CostBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  if (amount <= 0 || total <= 0) return null;
  const pct = Math.min(100, (amount / total) * 100);
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
        <span style={{ color: '#777' }}>{label}</span>
        <span style={{ color: '#aaa' }}>{fmtNTD(amount)} ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ height: 5, background: '#1a1a2a', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

// ── P&L trend chart ───────────────────────────────────────────────────────────

const CHART_HEIGHT = 56;

function PLTrendChart({ history }: { history: PLStatement[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (history.length === 0) return null;

  const maxVal = Math.max(1, ...history.map(p => Math.max(p.income.total, p.expenses.total)));

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

// ── Main panel ────────────────────────────────────────────────────────────────

export const FinancePanel: React.FC = () => {
  const { cash, creditRating, lastPL, activeLoans, plHistory } = useUIStore();

  const totalDebt = activeLoans.reduce((s, l) => s + l.remainingBalance, 0);

  const grossMargin = lastPL
    ? lastPL.income.total > 0
      ? ((lastPL.income.total - lastPL.expenses.total) / lastPL.income.total) * 100
      : 0
    : 0;

  const netProfit = lastPL?.netProfit ?? 0;
  const revenue = lastPL?.income.total ?? 0;
  const expenses = lastPL?.expenses.total ?? 0;

  return (
    <div className="panel finance-panel">
      <div className="panel-title">▸ FINANCE OVERVIEW</div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px 4px' }}>
        <KPICard
          label="現金餘額"
          value={fmtNTD(cash)}
          color={cash < 500_000 ? 'var(--tm-red)' : 'var(--tm-cyan)'}
        />
        <KPICard
          label="信用評等"
          value={creditRating ?? '—'}
          color={creditRatingColor(creditRating ?? 'A')}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 12px 8px' }}>
        <KPICard
          label="月營收"
          value={fmtNTD(revenue)}
          color="var(--tm-green)"
        />
        <KPICard
          label="月支出"
          value={fmtNTD(expenses)}
          color="var(--tm-red)"
        />
        <KPICard
          label="月淨利"
          value={fmtNTD(netProfit)}
          color={netProfit >= 0 ? 'var(--tm-green)' : 'var(--tm-red)'}
        />
        <KPICard
          label="毛利率"
          value={`${grossMargin.toFixed(1)}%`}
          color={grossMargin >= 20 ? 'var(--tm-green)' : grossMargin >= 0 ? 'var(--tm-yellow)' : 'var(--tm-red)'}
        />
      </div>

      {/* Cost structure */}
      {lastPL && lastPL.expenses.total > 0 && (
        <div className="pl-summary" style={{ paddingTop: 6 }}>
          <div className="pl-section-title">成本結構</div>
          <div style={{ padding: '0 14px 8px' }}>
            <CostBar label="硬體折舊" amount={lastPL.expenses.hardwareDepreciation} total={lastPL.expenses.total} color="#4488cc" />
            <CostBar label="人員薪資" amount={lastPL.expenses.staffSalary} total={lastPL.expenses.total} color="#cc6644" />
            <CostBar label="電費" amount={lastPL.expenses.electricity} total={lastPL.expenses.total} color="#ccaa22" />
            <CostBar label="場地租金" amount={lastPL.expenses.facilityRent} total={lastPL.expenses.total} color="#4466aa" />
            <CostBar label="軟體授權" amount={lastPL.expenses.softwareLicense} total={lastPL.expenses.total} color="#8855aa" />
            <CostBar label="SLA 罰款" amount={lastPL.expenses.slaBreachPenalty} total={lastPL.expenses.total} color="#cc2222" />
            <CostBar label="其他" amount={lastPL.expenses.other} total={lastPL.expenses.total} color="#666" />
          </div>
        </div>
      )}

      {lastPL ? (
        <div className="pl-summary">
          <div className="pl-section-title">上月損益</div>
          {[
            { label: '營業收入', value: lastPL.income.total, color: 'var(--tm-green)' },
            { label: '營業支出', value: -lastPL.expenses.total, color: 'var(--tm-red)' },
            { label: '稅前淨利', value: lastPL.preTaxProfit, color: undefined },
            { label: '所得稅 (17%)', value: -lastPL.taxAmount, color: 'var(--tm-red)' },
          ].map(row => (
            <div key={row.label} className="pl-row">
              <span className="pl-label">{row.label}</span>
              <span className="pl-value" style={{ color: row.color ?? (row.value >= 0 ? 'var(--tm-green)' : 'var(--tm-red)') }}>
                {fmtNTD(row.value)}
              </span>
            </div>
          ))}
          <div className="pl-divider" />
          <div className="pl-row pl-net">
            <span className="pl-label">稅後淨利</span>
            <span className="pl-value" style={{ color: lastPL.netProfit >= 0 ? 'var(--tm-green)' : 'var(--tm-red)', fontWeight: 'bold' }}>
              {fmtNTD(lastPL.netProfit)}
            </span>
          </div>
        </div>
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

      {totalDebt > 0 && (
        <div style={{ padding: '4px 14px 8px', fontSize: 11, color: 'var(--tm-yellow)' }}>
          總負債: {fmtNTD(totalDebt)}
        </div>
      )}
    </div>
  );
};
