import React, { useEffect, useState } from 'react';
import { TimeBar } from './hud/TimeBar';
import { FinancePanel } from './panels/FinancePanel';
import { EventLogPanel, pushEventLog } from './panels/EventLogPanel';
import { StaffPanel } from './panels/StaffPanel';
import { SecurityPanel } from './panels/SecurityPanel';
import { EventTimelinePanel } from './panels/EventTimelinePanel';
import { TechTreePanel } from './panels/TechTreePanel';
import { ReputationPanel } from './panels/ReputationPanel';
import { useUIStore } from '../store/uiStore';

const formatTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
};

type CenterTab = 'staff' | 'security' | 'timeline' | 'techtree' | 'reputation';

const TAB_LABELS: Record<CenterTab, string> = {
  staff:      '人員',
  security:   '資安',
  timeline:   '時間軸',
  techtree:   '科技樹',
  reputation: '聲譽',
};

export const GameLayout: React.FC = () => {
  const {
    saveGame, _engine,
    staffList, jobOpenings, shiftMode, monthlyPayroll,
    activeIncidents, securityPostureScore, securityComplianceScore,
    triggeredEvents, activeModifiers, pendingDecisions, economicCycle,
    techNodes,
    satisfactionScore,
    postJobOpening, hireStaff, layoffStaff,
    startTechResearch, cancelTechResearch,
    makeTimelineDecision,
  } = useUIStore();

  const clockRef = React.useRef<HTMLSpanElement>(null);
  const [centerTab, setCenterTab] = useState<CenterTab>('staff');

  useEffect(() => {
    const id = setInterval(() => {
      if (clockRef.current) clockRef.current.textContent = formatTime();
    }, 1000);
    return () => clearInterval(id);
  }, []);

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
      bus.subscribe('security.incident_triggered', (e) => {
        const inc = e.payload as { severity: string; type: string };
        const color = inc.severity === 'P1' ? 'var(--tm-red)' : inc.severity === 'P2' ? '#ff8844' : 'var(--tm-yellow)';
        pushEventLog(e, `⚠ [${inc.severity}] 資安事件：${inc.type}`, color);
        setCenterTab('security');
      }),
      bus.subscribe('timeline.historical_event', (e) => {
        const ev = e.payload as { name: string };
        pushEventLog(e, `📅 歷史事件：${ev.name}`, 'var(--tm-purple)');
        setCenterTab('timeline');
      }),
      bus.subscribe('timeline.decision_required', () => {
        setCenterTab('timeline');
      }),
      bus.subscribe('staff.resigned', (e) => {
        const p = e.payload as { name: string; role: string };
        pushEventLog(e, `👋 員工離職：${p.name} (${p.role})`, 'var(--tm-yellow)');
      }),
      bus.subscribe('techtree.research_completed', (e) => {
        const p = e.payload as { nodeName: string };
        pushEventLog(e, `🔬 科技解鎖：${p.nodeName}`, 'var(--tm-cyan)');
      }),
      bus.subscribe('reputation.low_satisfaction_warning', (e) => {
        const p = e.payload as { score: number };
        pushEventLog(e, `⚠ 客戶滿意度警告：${p.score.toFixed(0)}`, 'var(--tm-red)');
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

      <main className="game-main game-main-v3">
        <aside className="sidebar-left">
          <FinancePanel />
        </aside>

        <section className="center-panel">
          <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Tab bar */}
            <div style={{
              display: 'flex', gap: 4, padding: '6px 8px',
              borderBottom: '1px solid #334', background: '#0a0a0a',
            }}>
              {(Object.keys(TAB_LABELS) as CenterTab[]).map(tab => (
                <button key={tab} onClick={() => setCenterTab(tab)} style={{
                  padding: '3px 12px', fontSize: 11,
                  background: centerTab === tab ? '#1a3a1a' : '#111',
                  border: `1px solid ${centerTab === tab ? '#558855' : '#334'}`,
                  borderRadius: 3,
                  color: centerTab === tab ? 'var(--tm-green)' : '#666',
                  cursor: 'pointer',
                }}>
                  {TAB_LABELS[tab]}
                  {tab === 'security' && activeIncidents.length > 0 && (
                    <span style={{ marginLeft: 4, color: 'var(--tm-red)', fontWeight: 'bold' }}>
                      ({activeIncidents.length})
                    </span>
                  )}
                  {tab === 'timeline' && pendingDecisions.length > 0 && (
                    <span style={{ marginLeft: 4, color: 'var(--tm-yellow)', fontWeight: 'bold' }}>!</span>
                  )}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', fontSize: 10, color: '#555', alignSelf: 'center' }}>
                滿意度：<span style={{
                  color: satisfactionScore >= 80 ? 'var(--tm-green)' : satisfactionScore >= 50 ? 'var(--tm-cyan)' : 'var(--tm-red)',
                }}>{satisfactionScore.toFixed(0)}</span>
              </div>
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {centerTab === 'staff' && (
                <StaffPanel
                  staffList={staffList}
                  jobOpenings={jobOpenings}
                  shiftMode={shiftMode}
                  monthlyPayroll={monthlyPayroll}
                  onPostOpening={postJobOpening}
                  onHire={hireStaff}
                  onLayoff={layoffStaff}
                />
              )}
              {centerTab === 'security' && (
                <SecurityPanel
                  activeIncidents={activeIncidents}
                  securityPostureScore={securityPostureScore}
                  securityComplianceScore={securityComplianceScore}
                />
              )}
              {centerTab === 'timeline' && (
                <EventTimelinePanel
                  triggeredEvents={triggeredEvents}
                  activeModifiers={activeModifiers}
                  pendingDecisions={pendingDecisions}
                  economicCycle={economicCycle}
                  onMakeDecision={makeTimelineDecision}
                />
              )}
              {centerTab === 'techtree' && (
                <TechTreePanel
                  techNodes={techNodes}
                  onStartResearch={startTechResearch}
                  onCancelResearch={cancelTechResearch}
                />
              )}
              {centerTab === 'reputation' && (
                <ReputationPanel satisfactionScore={satisfactionScore} />
              )}
            </div>
          </div>
        </section>

        <aside className="sidebar-right">
          <EventLogPanel />
        </aside>
      </main>

      <footer className="game-footer">
        <span className="footer-text">
          IT-TYCOON v3.0 · Phase 3 完整 · 5 模組 + 5 UI + 407 測試通過
        </span>
        <span className="footer-warn">
          ⚠ Phase 3 — StaffManager · SecurityEngine · EventTimeline · TechTree · ReputationEngine
        </span>
      </footer>
    </div>
  );
};
