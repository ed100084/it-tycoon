import React, { useEffect } from 'react';
import { TimeBar } from './hud/TimeBar';
import { FinancePanel } from './panels/FinancePanel';
import { EventLogPanel, pushEventLog } from './panels/EventLogPanel';
import { useUIStore } from '../store/uiStore';

const formatTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
};

export const GameLayout: React.FC = () => {
  const { saveGame, _engine } = useUIStore();
  const clockRef = React.useRef<HTMLSpanElement>(null);

  // Live wall clock
  useEffect(() => {
    const id = setInterval(() => {
      if (clockRef.current) clockRef.current.textContent = formatTime();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Wire event log to EventBus
  useEffect(() => {
    if (!_engine) return;
    const bus = _engine.bus;
    const unsubs = [
      bus.subscribe('finance.monthly_settlement', (e) => {
        const pl = e.payload as { netProfit: number };
        const color = pl.netProfit >= 0 ? 'var(--tm-green)' : 'var(--tm-red)';
        const sign = pl.netProfit >= 0 ? '+' : '';
        pushEventLog(e, `月結算：稅後淨利 ${sign}NT$${pl.netProfit.toLocaleString()}`, color);
      }),
      bus.subscribe('finance.cash_warning', (e) => {
        pushEventLog(e, '⚠ 現金餘額低於警戒線（月支出 ×2）', 'var(--tm-yellow)');
      }),
      bus.subscribe('finance.loan_approved', (e) => {
        const loan = e.payload as { principal: number };
        pushEventLog(e, `✓ 貸款核准：NT$${loan.principal.toLocaleString()}`, 'var(--tm-cyan)');
      }),
      bus.subscribe('finance.credit_rating_changed', (e) => {
        const p = e.payload as { from: string; to: string };
        const color = p.from < p.to ? 'var(--tm-green)' : 'var(--tm-red)';
        pushEventLog(e, `信用評等：${p.from} → ${p.to}`, color);
      }),
      bus.subscribe('finance.cash_depleted', (e) => {
        pushEventLog(e, '⛔ 現金歸零！緊急狀況', 'var(--tm-red)');
      }),
      bus.subscribe('time.year_end', (e) => {
        const p = e.payload as { year: number };
        pushEventLog(e, `── ${p.year} 年度結算完成 ──`, 'var(--tm-purple)');
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [_engine]);

  const handleSave = () => saveGame();

  const handleNewGame = () => {
    if (confirm('⚠ Start a new game? All progress will be lost.')) {
      _engine?.clearSave();
      window.location.reload();
    }
  };

  return (
    <div className="game-layout crt-content">
      {/* Header */}
      <header className="game-header">
        <div className="header-left">
          <span className="game-title">IT-TYCOON</span>
          <span className="game-version">v3.0</span>
        </div>
        <div className="header-center">
          <TimeBar />
        </div>
        <div className="header-right">
          <span ref={clockRef} className="header-clock">{formatTime()}</span>
          <button className="crt-btn btn-save" onClick={handleSave}>[ 💾 SAVE ]</button>
          <button className="crt-btn btn-new-game" onClick={handleNewGame}>[ NEW ]</button>
        </div>
      </header>

      {/* Main content */}
      <main className="game-main game-main-v3">
        <aside className="sidebar-left">
          <FinancePanel />
        </aside>

        <section className="center-panel">
          <div className="panel center-placeholder">
            <div className="panel-title">▸ DATACENTER — 北區 (Phase 1)</div>
            <div className="placeholder-text">
              <p>Phase 1 核心引擎已載入。</p>
              <p>FacilityManager、HardwareCatalog、ContractManager 等模組將在 Phase 2 實作。</p>
              <p style={{ color: 'var(--tm-text-dim)', marginTop: '1rem' }}>
                當前遊戲時間由 TimeEngine 驅動，財務由 FinanceEngine 管理。
                按 <strong>Space</strong> 暫停/繼續，或使用右上角速度控制。
              </p>
            </div>
          </div>
        </section>

        <aside className="sidebar-right">
          <EventLogPanel />
        </aside>
      </main>

      {/* Footer */}
      <footer className="game-footer">
        <span className="footer-text">
          IT-TYCOON v3.0 · 管理模擬 · React 19 + TypeScript + Zustand ·
          Auto-save every 30s
        </span>
        <span className="footer-warn">
          ⚠ Phase 1 MVP — EventBus + TimeEngine + FinanceEngine
        </span>
      </footer>
    </div>
  );
};
