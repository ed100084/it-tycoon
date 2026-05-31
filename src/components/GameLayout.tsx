import React, { useEffect, useState } from 'react';
import { TimeBar } from './hud/TimeBar';
import { FinancePanel } from './panels/FinancePanel';
import { EventLogPanel, pushEventLog } from './panels/EventLogPanel';
import { FacilityManagerPanel } from './panels/FacilityManagerPanel';
import { HardwareCatalogPanel } from './panels/HardwareCatalogPanel';
import { SoftwareCatalogPanel } from './panels/SoftwareCatalogPanel';
import { ContractManagerPanel } from './panels/ContractManagerPanel';
import { StaffPanel } from './panels/StaffPanel';
import { SecurityPanel } from './panels/SecurityPanel';
import { EventTimelinePanel } from './panels/EventTimelinePanel';
import { TechTreePanel } from './panels/TechTreePanel';
import { ReputationPanel } from './panels/ReputationPanel';
import { CustomerPanel } from './panels/CustomerPanel';
import { VendorPanel } from './panels/VendorPanel';
import { BoardPanel } from './panels/BoardPanel';
import { StrategyPanel } from './panels/StrategyPanel';
import { TutorialOverlay } from './ui/TutorialOverlay';
import { ToastContainer } from './ui/ToastContainer';
import { EventModal } from './ui/EventModal';
import { useUIStore } from '../store/uiStore';
import { useToastStore } from '../store/toastStore';

const formatTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
};

function fmtCash(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `NT$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `NT$${(n / 1_000).toFixed(0)}K`;
  return `NT$${n.toLocaleString()}`;
}

type CenterTab =
  | 'facility' | 'hardware' | 'software' | 'contract'
  | 'staff' | 'security' | 'timeline' | 'techtree' | 'reputation'
  | 'customers' | 'vendors' | 'board' | 'strategy';

const TAB_LABELS: Record<CenterTab, string> = {
  facility:   '🏢 機房',
  hardware:   '🖥️ 硬體',
  software:   '💿 軟體',
  contract:   '📋 合約',
  staff:      '👥 人員',
  security:   '🔒 資安',
  timeline:   '📅 時間軸',
  techtree:   '🔬 科技樹',
  reputation: '⭐ 聲譽',
  customers:  '🤝 客戶',
  vendors:    '🏭 供應商',
  board:      '📊 董事會',
  strategy:   '🗺️ 策略',
};

const TAB_ORDER: CenterTab[] = [
  'facility', 'hardware', 'software', 'contract',
  'staff', 'security', 'timeline', 'techtree', 'reputation',
  'customers', 'vendors', 'board', 'strategy',
];

export const GameLayout: React.FC = () => {
  const {
    saveGame, _engine,
    cash, creditRating,
    currentDate,
    facilityRegions, upgradeCooling, expandCapacity, unlockRegion,
    availableHardwareModels, hardwareAssets, purchaseHardware, disposeHardware,
    availableSoftwareProducts, softwareLicenses, complianceScore, purchaseSoftware, cancelSoftwareLicense,
    pendingRFPs, activeContracts, monthlyRevenueEstimate, submitContractBid, declineRFP, declineContractRenewal,
    staffList, jobOpenings, shiftMode, monthlyPayroll,
    activeIncidents, securityPostureScore, securityComplianceScore,
    triggeredEvents, activeModifiers, pendingDecisions, economicCycle,
    activeRandomEvents,
    techNodes,
    satisfactionScore,
    achievements,
    competitors,
    playerMarketShare,
    maintenanceStates,
    strategyScores, strategyDominantRoute, strategyEstablishedRoutes,
    namedCustomers,
    vendors,
    boardKPIs, boardYearResults, boardGameOver, boardPendingReview,
    drDrills,
    isPaused,
    postJobOpening, hireStaff, layoffStaff,
    startTechResearch, cancelTechResearch,
    makeTimelineDecision, resolveRandomEvent,
    scheduleMaintenance, performGeneratorMaintenance,
    sendForCertification, payStaffBonus, setMentor,
    startDRDrill, acknowledgeBoard,
    setSpeed,
  } = useUIStore();

  const { addToast, showModal } = useToastStore();

  const clockRef = React.useRef<HTMLSpanElement>(null);
  const [centerTab, setCenterTab] = useState<CenterTab>('facility');

  useEffect(() => {
    const id = setInterval(() => {
      if (clockRef.current) clockRef.current.textContent = formatTime();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // EventBus subscriptions — event log + toasts + modals
  useEffect(() => {
    if (!_engine) return;
    const bus = _engine.bus;
    const unsubs = [
      bus.subscribe('finance.monthly_settlement', (e) => {
        const pl = e.payload as { netProfit: number };
        const color = pl.netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        const sign = pl.netProfit >= 0 ? '+' : '';
        pushEventLog(e, `月結算：稅後淨利 ${sign}NT$${pl.netProfit.toLocaleString()}`, color);
        if (pl.netProfit >= 0) {
          addToast('success', `月結算淨利 ${sign}NT$${(pl.netProfit / 1000).toFixed(0)}K`);
        } else {
          addToast('warning', `月結算虧損 NT$${(pl.netProfit / 1000).toFixed(0)}K`);
        }
      }),
      bus.subscribe('finance.cash_warning', (e) => {
        pushEventLog(e, '⚠ 現金餘額低於警戒線（月支出 ×2）', 'var(--accent-yellow)');
        addToast('warning', '⚠ 現金餘額低於警戒線！');
      }),
      bus.subscribe('finance.loan_approved', (e) => {
        const loan = e.payload as { principal: number };
        pushEventLog(e, `✓ 貸款核准：NT$${loan.principal.toLocaleString()}`, 'var(--accent-cyan)');
        addToast('info', `貸款核准 NT$${(loan.principal / 1_000_000).toFixed(1)}M`);
      }),
      bus.subscribe('finance.credit_rating_changed', (e) => {
        const p = e.payload as { from: string; to: string };
        const color = p.from < p.to ? 'var(--accent-green)' : 'var(--accent-red)';
        pushEventLog(e, `信用評等：${p.from} → ${p.to}`, color);
        addToast(p.to > p.from ? 'success' : 'warning', `信用評等 ${p.from} → ${p.to}`);
      }),
      bus.subscribe('finance.cash_depleted', (e) => {
        pushEventLog(e, '⛔ 現金歸零！緊急狀況', 'var(--accent-red)');
        addToast('error', '⛔ 現金歸零！緊急狀況', 8000);
      }),
      bus.subscribe('time.year_end', (e) => {
        const p = e.payload as { year: number };
        pushEventLog(e, `── ${p.year} 年度結算完成 ──`, 'var(--accent-purple)');
        addToast('info', `${p.year} 年度結算完成`);
      }),
      bus.subscribe('security.incident_triggered', (e) => {
        const inc = e.payload as { severity: string; type: string; id: string };
        const color = inc.severity === 'P1' ? 'var(--accent-red)' : inc.severity === 'P2' ? '#f97316' : 'var(--accent-yellow)';
        pushEventLog(e, `⚠ [${inc.severity}] 資安事件：${inc.type}`, color);
        setCenterTab('security');
        if (inc.severity === 'P1' || inc.severity === 'P2') {
          // Pause and show modal for critical incidents
          setSpeed(0);
          showModal({
            title: `[${inc.severity}] 資安事件：${inc.type}`,
            body: `偵測到 ${inc.severity} 等級資安事件！請立即前往資安面板處理。`,
            severity: inc.severity === 'P1' ? 'critical' : 'warning',
          });
        } else {
          addToast('warning', `[${inc.severity}] ${inc.type}`);
        }
      }),
      bus.subscribe('timeline.historical_event', (e) => {
        const ev = e.payload as { name: string; description?: string };
        pushEventLog(e, `📅 歷史事件：${ev.name}`, 'var(--accent-purple)');
        setCenterTab('timeline');
        setSpeed(0);
        showModal({
          title: `📅 歷史事件：${ev.name}`,
          body: ev.description ?? '全球重大歷史事件正在影響 IT 產業。請查看時間軸面板了解詳情。',
          severity: 'info',
        });
      }),
      bus.subscribe('timeline.decision_required', () => {
        setCenterTab('timeline');
        addToast('warning', '⚠ 需要決策！請前往時間軸面板。');
      }),
      bus.subscribe('staff.resigned', (e) => {
        const p = e.payload as { name: string; role: string };
        pushEventLog(e, `👋 員工離職：${p.name} (${p.role})`, 'var(--accent-yellow)');
        addToast('warning', `員工離職：${p.name}`);
      }),
      bus.subscribe('staff.hired', (e) => {
        const p = e.payload as { name: string; role: string };
        pushEventLog(e, `✓ 員工雇用：${p.name} (${p.role})`, 'var(--accent-green)');
        addToast('success', `雇用成功：${p.name}`);
      }),
      bus.subscribe('contract.signed', (e) => {
        const p = e.payload as { clientName?: string };
        pushEventLog(e, `✓ 合約簽署${p.clientName ? `：${p.clientName}` : ''}`, 'var(--accent-green)');
        addToast('success', `合約簽署成功${p.clientName ? `：${p.clientName}` : ''}`);
      }),
      bus.subscribe('hardware.installed', (e) => {
        const p = e.payload as { modelId?: string };
        pushEventLog(e, `🖥️ 硬體安裝完成${p.modelId ? `：${p.modelId}` : ''}`, 'var(--accent-cyan)');
        addToast('success', `硬體安裝完成`);
      }),
      bus.subscribe('techtree.research_completed', (e) => {
        const p = e.payload as { nodeName: string };
        pushEventLog(e, `🔬 科技解鎖：${p.nodeName}`, 'var(--accent-cyan)');
        addToast('success', `科技解鎖：${p.nodeName}`);
      }),
      bus.subscribe('reputation.low_satisfaction_warning', (e) => {
        const p = e.payload as { score: number };
        pushEventLog(e, `⚠ 客戶滿意度警告：${p.score.toFixed(0)}`, 'var(--accent-red)');
        addToast('error', `客戶滿意度過低：${p.score.toFixed(0)}`);
      }),
      bus.subscribe('achievement.unlocked', (e) => {
        const p = e.payload as { name: string; icon: string; description: string };
        pushEventLog(e, `🏆 成就解鎖：${p.icon} ${p.name}`, 'var(--tm-green, #44ff88)');
        addToast('success', `🏆 成就解鎖：${p.icon} ${p.name}`, 5000);
        showModal({
          title: `🏆 成就解鎖！`,
          body: `${p.icon} **${p.name}**\n${p.description}`,
          severity: 'info',
        });
      }),
      bus.subscribe('timeline.random_event', (e) => {
        const ev = e.payload as { name: string; description: string; icon: string };
        pushEventLog(e, `${ev.icon} 隨機事件：${ev.name}`, 'var(--accent-purple)');
        setCenterTab('timeline');
        setSpeed(0);
        showModal({
          title: `${ev.icon} 隨機事件：${ev.name}`,
          body: ev.description,
          severity: 'warning',
        });
        addToast('warning', `${ev.icon} 隨機事件：${ev.name} — 請前往時間軸面板決策`);
      }),
      bus.subscribe('facility.maintenance_due', (e) => {
        const p = e.payload as { region: string };
        pushEventLog(e, `🔧 ${p.region} 需要例行維護`, 'var(--accent-yellow)');
        addToast('warning', `機房 ${p.region} 需要例行維護`);
      }),
      bus.subscribe('facility.power_outage', (e) => {
        const p = e.payload as { region: string; durationHours: number };
        pushEventLog(e, `⚡ 颱風停電：${p.region} (${p.durationHours}小時)`, 'var(--accent-red)');
        setSpeed(0);
        showModal({
          title: '⚡ 停電警告',
          body: `${p.region} 因颱風停電，預計停電 ${p.durationHours} 小時。SLA 違約不可避免。`,
          severity: 'critical',
        });
        addToast('error', `⚡ ${p.region} 停電 ${p.durationHours} 小時！`, 6000);
      }),
      bus.subscribe('facility.typhoon_event', (e) => {
        const p = e.payload as { region: string; generatorHealthy: boolean };
        if (!p.generatorHealthy) {
          pushEventLog(e, `🌀 颱風警報：${p.region} 油機異常，停電風險！`, 'var(--accent-red)');
          addToast('error', `🌀 ${p.region} 颱風 + 油機異常，請立即保養！`, 6000);
        } else {
          pushEventLog(e, `🌀 颱風警報：${p.region} — 油機正常保護`, 'var(--accent-yellow)');
          addToast('warning', `🌀 颱風警報：${p.region}`);
        }
      }),
      bus.subscribe('customer.acquired', (e) => {
        const p = e.payload as { name: string; industry: string };
        pushEventLog(e, `🤝 新客戶：${p.name}`, 'var(--accent-green)');
      }),
      bus.subscribe('customer.churned', (e) => {
        const p = e.payload as { name: string };
        pushEventLog(e, `👋 客戶流失：${p.name}`, 'var(--accent-red)');
        addToast('warning', `客戶流失：${p.name}`);
      }),
      bus.subscribe('customer.referral_available', (e) => {
        const p = e.payload as { referrerName: string; prospectName: string };
        pushEventLog(e, `💌 推薦客戶：${p.referrerName} 推薦 ${p.prospectName}`, 'var(--accent-cyan)');
        addToast('info', `客戶推薦：${p.prospectName}`);
      }),
      bus.subscribe('vendor.level_up', (e) => {
        const p = e.payload as { vendorName: string; toLevel: string; discount: number };
        pushEventLog(e, `🏭 供應商升級：${p.vendorName} → ${p.toLevel}`, 'var(--accent-cyan)');
        addToast('success', `${p.vendorName} 升為 ${p.toLevel}！折扣 ${Math.round(p.discount * 100)}%`);
      }),
      bus.subscribe('vendor.platinum_unlocked', (e) => {
        const p = e.payload as { vendorName: string; message: string };
        pushEventLog(e, `💎 ${p.vendorName} 達到 Platinum！`, 'var(--accent-cyan)');
        showModal({ title: `💎 ${p.vendorName} 白金合作`, body: p.message, severity: 'info' });
      }),
      bus.subscribe('strategy.route_established', (e) => {
        const p = e.payload as { route: string };
        pushEventLog(e, `🗺️ 策略路線確立：${p.route}`, 'var(--accent-purple)');
        addToast('success', `策略路線確立：${p.route}！RFP 投標加成 +30%`);
      }),
      bus.subscribe('board.quarterly_review', (e) => {
        const p = e.payload as { quarter: number; achievedCount: number; totalCount: number };
        pushEventLog(e, `📊 Q${p.quarter} 季報：KPI ${p.achievedCount}/${p.totalCount} 達成`, 'var(--accent-purple)');
        addToast('info', `Q${p.quarter} 季報：${p.achievedCount}/${p.totalCount} KPI 達成`);
      }),
      bus.subscribe('board.year_end_result', (e) => {
        const p = e.payload as { year: number; achievedCount: number; totalCount: number; bonus: number; hadWarning: boolean };
        const color = p.hadWarning ? 'var(--accent-red)' : 'var(--accent-green)';
        pushEventLog(e, `📊 ${p.year} 年度董事會：${p.achievedCount}/${p.totalCount} KPI`, color);
        if (p.hadWarning) {
          setCenterTab('board');
          showModal({ title: `⚠ ${p.year} 年度警告`, body: `本年度未達標 KPI 超半數（${p.achievedCount}/${p.totalCount}），董事會發出警告。連續兩年失敗將觸發 Game Over！`, severity: 'warning' });
        } else if (p.bonus > 0) {
          addToast('success', `年度達標！獎金 NT$${(p.bonus / 1000).toFixed(0)}K`);
        }
      }),
      bus.subscribe('board.bonus_awarded', (e) => {
        const p = e.payload as { amount: number; year: number };
        pushEventLog(e, `🏆 ${p.year} 年度獎金：NT$${p.amount.toLocaleString()}`, 'var(--accent-green)');
      }),
      bus.subscribe('board.game_over', (e) => {
        const p = e.payload as { reason: string };
        pushEventLog(e, `💀 GAME OVER：${p.reason}`, 'var(--accent-red)');
        setSpeed(0);
        setCenterTab('board');
        showModal({ title: '💀 GAME OVER', body: p.reason, severity: 'critical' });
      }),
      bus.subscribe('security.dr_drill_started', (e) => {
        pushEventLog(e, '🔄 DR 容災演練開始', 'var(--accent-cyan)');
        addToast('info', 'DR 演練進行中…');
      }),
      bus.subscribe('security.dr_drill_completed', (e) => {
        const p = e.payload as { status: string; complianceBonus: number };
        const passed = p.status === 'passed';
        pushEventLog(e, `🔄 DR 演練${passed ? '通過' : '失敗'}`, passed ? 'var(--accent-green)' : 'var(--accent-red)');
        addToast(passed ? 'success' : 'error', `DR 演練${passed ? `通過！合規 +${p.complianceBonus.toFixed(0)}%` : '失敗'}`);
      }),
      bus.subscribe('staff.certification_completed', (e) => {
        const p = e.payload as { staffName: string; certType: string };
        pushEventLog(e, `🏅 認證取得：${p.staffName} — ${p.certType}`, 'var(--accent-green)');
        addToast('success', `${p.staffName} 取得 ${p.certType} 認證！`);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [_engine, addToast, showModal, setSpeed]);

  const handleSave = () => saveGame();

  const handleNewGame = () => {
    if (confirm('⚠ Start a new game? All progress will be lost.')) {
      _engine?.clearSave();
      window.location.reload();
    }
  };

  const cashColor = cash < 500_000 ? 'var(--accent-red)' : cash < 2_000_000 ? 'var(--accent-yellow)' : 'var(--accent-cyan)';

  const satisfactionColor = satisfactionScore >= 80
    ? 'var(--accent-green)'
    : satisfactionScore >= 50
      ? 'var(--accent-cyan)'
      : 'var(--accent-red)';

  return (
    <div className={`game-layout crt-content${isPaused ? ' is-paused' : ''}`}>
      <header className="game-header">
        <div className="header-left">
          <span className="game-title">IT-TYCOON</span>
          <span className="game-version">v3.0</span>
        </div>

        <div className="header-center">
          <TimeBar />
        </div>

        <div className="header-right">
          <div className="header-stat">
            <span className="header-stat-label">現金</span>
            <span className="header-stat-value" style={{ color: cashColor }}>{fmtCash(cash)}</span>
          </div>
          <div className="header-stat" style={{ borderRight: 'none' }}>
            <span className="header-stat-label">信用</span>
            <span className="header-stat-value" style={{ color: creditRatingColor(creditRating ?? 'A') }}>{creditRating ?? '—'}</span>
          </div>
          <span ref={clockRef} className="header-clock">{formatTime()}</span>
          <button className="crt-btn btn-save" onClick={handleSave}>💾 儲存</button>
          <button className="crt-btn btn-new-game" onClick={handleNewGame}>新遊戲</button>
        </div>
      </header>

      <main className="game-main game-main-v3">
        <aside className="sidebar-left">
          <FinancePanel />
        </aside>

        <section className="center-panel">
          <div className="tab-bar">
            {TAB_ORDER.map(tab => (
              <button
                key={tab}
                className={`tab-btn${centerTab === tab ? ' active' : ''}`}
                onClick={() => setCenterTab(tab)}
              >
                {TAB_LABELS[tab]}
                {tab === 'security' && activeIncidents.length > 0 && (
                  <span className="tab-badge danger">{activeIncidents.length}</span>
                )}
                {tab === 'timeline' && (pendingDecisions.length > 0 || activeRandomEvents.length > 0) && (
                  <span className="tab-badge warn">{pendingDecisions.length + activeRandomEvents.length}</span>
                )}
                {tab === 'contract' && pendingRFPs.length > 0 && (
                  <span className="tab-badge info">{pendingRFPs.length}</span>
                )}
                {tab === 'board' && boardPendingReview && (
                  <span className="tab-badge warn">!</span>
                )}
                {tab === 'board' && boardGameOver && (
                  <span className="tab-badge danger">!</span>
                )}
              </button>
            ))}
            <div className="tab-satisfaction">
              <span>滿意度</span>
              <span className="tab-satisfaction-value" style={{ color: satisfactionColor }}>
                {satisfactionScore.toFixed(0)}
              </span>
            </div>
          </div>

          <div className="tab-content">
            {centerTab === 'facility' && (
              <FacilityManagerPanel
                regions={facilityRegions}
                maintenanceStates={maintenanceStates}
                onUpgradeCooling={upgradeCooling}
                onExpandCapacity={expandCapacity}
                onUnlockRegion={unlockRegion}
                onScheduleMaintenance={scheduleMaintenance}
                onGeneratorMaintenance={performGeneratorMaintenance}
              />
            )}
            {centerTab === 'hardware' && (
              <HardwareCatalogPanel
                availableModels={availableHardwareModels}
                assets={hardwareAssets}
                currentYear={currentDate.year}
                onPurchase={purchaseHardware}
                onDispose={disposeHardware}
              />
            )}
            {centerTab === 'software' && (
              <SoftwareCatalogPanel
                availableProducts={availableSoftwareProducts}
                licenses={softwareLicenses}
                complianceScore={complianceScore}
                currentYear={currentDate.year}
                onPurchase={purchaseSoftware}
                onCancel={cancelSoftwareLicense}
              />
            )}
            {centerTab === 'contract' && (
              <ContractManagerPanel
                pendingRFPs={pendingRFPs}
                activeContracts={activeContracts}
                monthlyRevenue={monthlyRevenueEstimate}
                onSubmitBid={submitContractBid}
                onDeclineRFP={declineRFP}
                onDeclineRenewal={declineContractRenewal}
              />
            )}
            {centerTab === 'staff' && (
              <StaffPanel
                staffList={staffList}
                jobOpenings={jobOpenings}
                shiftMode={shiftMode}
                monthlyPayroll={monthlyPayroll}
                onPostOpening={postJobOpening}
                onHire={hireStaff}
                onLayoff={layoffStaff}
                onSendForCertification={sendForCertification}
                onPayBonus={payStaffBonus}
                onSetMentor={setMentor}
              />
            )}
            {centerTab === 'security' && (
              <SecurityPanel
                activeIncidents={activeIncidents}
                securityPostureScore={securityPostureScore}
                securityComplianceScore={securityComplianceScore}
                drDrills={drDrills}
                onStartDRDrill={startDRDrill}
              />
            )}
            {centerTab === 'timeline' && (
              <EventTimelinePanel
                triggeredEvents={triggeredEvents}
                activeModifiers={activeModifiers}
                pendingDecisions={pendingDecisions}
                activeRandomEvents={activeRandomEvents}
                economicCycle={economicCycle}
                onMakeDecision={makeTimelineDecision}
                onResolveRandomEvent={resolveRandomEvent}
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
              <ReputationPanel
                satisfactionScore={satisfactionScore}
                achievements={achievements}
                competitors={competitors}
                playerMarketShare={playerMarketShare}
              />
            )}
            {centerTab === 'customers' && (
              <CustomerPanel namedCustomers={namedCustomers} />
            )}
            {centerTab === 'vendors' && (
              <VendorPanel vendors={vendors} />
            )}
            {centerTab === 'board' && (
              <BoardPanel
                boardKPIs={boardKPIs}
                boardYearResults={boardYearResults}
                boardGameOver={boardGameOver}
                boardPendingReview={boardPendingReview}
                onAcknowledge={acknowledgeBoard}
              />
            )}
            {centerTab === 'strategy' && (
              <StrategyPanel
                strategyScores={strategyScores}
                strategyDominantRoute={strategyDominantRoute}
                strategyEstablishedRoutes={strategyEstablishedRoutes}
              />
            )}
          </div>
        </section>

        <aside className="sidebar-right">
          <EventLogPanel />
        </aside>
      </main>

      <footer className="game-footer">
        <span className="footer-text">IT-TYCOON v3.0 · Phase 1-3 完整版</span>
        <span className="footer-warn">
          機房 · 硬體 · 軟體 · 合約 · 人員 · 資安 · 時間軸 · 科技樹 · 聲譽
        </span>
      </footer>

      {/* Overlays */}
      <TutorialOverlay />
      <ToastContainer />
      <EventModal />
    </div>
  );
};

function creditRatingColor(rating: string): string {
  switch (rating) {
    case 'AAA': case 'AA': return 'var(--accent-green)';
    case 'A':   case 'BBB': return 'var(--accent-cyan)';
    case 'BB': return 'var(--accent-yellow)';
    case 'B':  return 'var(--accent-orange)';
    default:   return 'var(--accent-red)';
  }
}
