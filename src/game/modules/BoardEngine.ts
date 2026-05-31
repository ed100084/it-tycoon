import type {
  GameConfig, GameDate, IEventBus, IGameModule, Money,
  BoardConfig, KPITarget, KPIType, BoardYearResult,
} from '../core/types';

const DEFAULT_BOARD_CONFIG: BoardConfig = {
  bonusMonthsOfRevenue: 1,
  partialBonusMonthsOfRevenue: 0.25,
  warningThreshold: 0.50,
  gameOverConsecutiveFailYears: 2,
  kpiRevenueGrowthTarget: 0.15,
  kpiCustomerCountTarget: 5,
  kpiSlaRateTarget: 95,
  kpiGrossMarginTarget: 20,
};

interface BoardState {
  currentYearKPIs: KPITarget[];
  consecutiveFailYears: number;
  lastReviewYear: number | null;
  yearResults: BoardYearResult[];
  gameOver: boolean;
  lastYearRevenue: Money;
  monthlyRevenue: Money;
  currentSLARate: number;
  currentCustomerCount: number;
  currentGrossMarginPct: number;
  pendingReview: boolean;
}


export class BoardEngine implements IGameModule {
  readonly moduleId = 'BoardEngine';

  private bus!: IEventBus;
  private cfg!: BoardConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };

  private state: BoardState = {
    currentYearKPIs: [],
    consecutiveFailYears: 0,
    lastReviewYear: null,
    yearResults: [],
    gameOver: false,
    lastYearRevenue: 0,
    monthlyRevenue: 0,
    currentSLARate: 100,
    currentCustomerCount: 0,
    currentGrossMarginPct: 0,
    pendingReview: false,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getKPIs(): KPITarget[] {
    return this.state.currentYearKPIs.map(k => ({ ...k }));
  }

  getYearResults(): BoardYearResult[] {
    return [...this.state.yearResults];
  }

  isGameOver(): boolean {
    return this.state.gameOver;
  }

  getConsecutiveFailYears(): number {
    return this.state.consecutiveFailYears;
  }

  isPendingReview(): boolean {
    return this.state.pendingReview;
  }

  acknowledgeReview(): void {
    this.state.pendingReview = false;
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.board ?? DEFAULT_BOARD_CONFIG;
    this.currentDate = { ...config.time.startDate };

    if (this.state.currentYearKPIs.length === 0) {
      this.setNewYearKPIs(this.currentDate.year);
    }

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
      this.onMonthEnd();
    }, this.moduleId);

    bus.subscribe('time.year_end', (e) => {
      const p = e.payload as { year: number };
      this.onYearEnd(p.year);
    }, this.moduleId);

    bus.subscribe('finance.monthly_settlement', (e) => {
      const p = e.payload as { revenue?: Money; totalRevenue?: Money; netProfit?: Money; grossMarginPct?: number };
      if (typeof p.revenue === 'number') this.state.monthlyRevenue = p.revenue;
      if (typeof p.totalRevenue === 'number') this.state.monthlyRevenue = p.totalRevenue;
      if (typeof p.grossMarginPct === 'number') this.state.currentGrossMarginPct = p.grossMarginPct;
      this.refreshKPIProgress();
    }, this.moduleId);

    bus.subscribe('contract.sla_updated', (e) => {
      const p = e.payload as { overallSLARate?: number };
      if (typeof p.overallSLARate === 'number') {
        this.state.currentSLARate = p.overallSLARate;
      }
    }, this.moduleId);

    bus.subscribe('customer.acquired', () => {
      this.state.currentCustomerCount++;
      this.refreshKPIProgress();
    }, this.moduleId);

    bus.subscribe('customer.churned', () => {
      this.state.currentCustomerCount = Math.max(0, this.state.currentCustomerCount - 1);
      this.refreshKPIProgress();
    }, this.moduleId);
  }

  tick(_deltaMs: number): void { /* month-driven */ }

  serialize(): Record<string, unknown> {
    return {
      currentYearKPIs: this.state.currentYearKPIs,
      consecutiveFailYears: this.state.consecutiveFailYears,
      lastReviewYear: this.state.lastReviewYear,
      yearResults: this.state.yearResults,
      gameOver: this.state.gameOver,
      lastYearRevenue: this.state.lastYearRevenue,
      monthlyRevenue: this.state.monthlyRevenue,
      currentSLARate: this.state.currentSLARate,
      currentCustomerCount: this.state.currentCustomerCount,
      currentGrossMarginPct: this.state.currentGrossMarginPct,
      pendingReview: this.state.pendingReview,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    if (saved.currentYearKPIs) this.state.currentYearKPIs = saved.currentYearKPIs as KPITarget[];
    if (typeof saved.consecutiveFailYears === 'number') this.state.consecutiveFailYears = saved.consecutiveFailYears;
    if (saved.lastReviewYear !== undefined) this.state.lastReviewYear = saved.lastReviewYear as number | null;
    if (saved.yearResults) this.state.yearResults = saved.yearResults as BoardYearResult[];
    if (typeof saved.gameOver === 'boolean') this.state.gameOver = saved.gameOver;
    if (typeof saved.lastYearRevenue === 'number') this.state.lastYearRevenue = saved.lastYearRevenue;
    if (typeof saved.monthlyRevenue === 'number') this.state.monthlyRevenue = saved.monthlyRevenue;
    if (typeof saved.currentSLARate === 'number') this.state.currentSLARate = saved.currentSLARate;
    if (typeof saved.currentCustomerCount === 'number') this.state.currentCustomerCount = saved.currentCustomerCount;
    if (typeof saved.currentGrossMarginPct === 'number') this.state.currentGrossMarginPct = saved.currentGrossMarginPct;
    if (typeof saved.pendingReview === 'boolean') this.state.pendingReview = saved.pendingReview;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      kpis: this.state.currentYearKPIs,
      yearResults: this.state.yearResults,
      consecutiveFailYears: this.state.consecutiveFailYears,
      gameOver: this.state.gameOver,
      pendingReview: this.state.pendingReview,
    });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private onMonthEnd(): void {
    this.refreshKPIProgress();

    // Quarterly review (months 3, 6, 9)
    const m = this.currentDate.month;
    if ((m === 3 || m === 6 || m === 9) && this.state.lastReviewYear !== this.currentDate.year + m / 100) {
      this.state.lastReviewYear = this.currentDate.year + m / 100;
      this.publishQuarterlyReview();
    }
  }

  private refreshKPIProgress(): void {
    for (const kpi of this.state.currentYearKPIs) {
      kpi.currentValue = this.getCurrentValueForKPI(kpi.type);
      kpi.isAchieved = kpi.currentValue >= kpi.targetValue;
    }
  }

  private getCurrentValueForKPI(type: KPIType): number {
    switch (type) {
      case 'revenue_growth': {
        if (this.state.lastYearRevenue === 0) return 0;
        const annualRev = this.state.monthlyRevenue * 12;
        return ((annualRev - this.state.lastYearRevenue) / this.state.lastYearRevenue) * 100;
      }
      case 'customer_count':
        return this.state.currentCustomerCount;
      case 'sla_rate':
        return this.state.currentSLARate;
      case 'gross_margin':
        return this.state.currentGrossMarginPct;
    }
  }

  private setNewYearKPIs(year: number): void {
    const prevAnnualRevenue = this.state.monthlyRevenue * 12 || this.state.lastYearRevenue;
    const kpis: KPITarget[] = [
      {
        id: 'kpi_revenue_growth',
        type: 'revenue_growth',
        description: `年營收成長率 > ${Math.round(this.cfg.kpiRevenueGrowthTarget * 100)}%`,
        targetValue: this.cfg.kpiRevenueGrowthTarget * 100,
        currentValue: 0,
        isAchieved: false,
      },
      {
        id: 'kpi_customer_count',
        type: 'customer_count',
        description: `活躍客戶數 ≥ ${this.cfg.kpiCustomerCountTarget + Math.floor(year / 5)}`,
        targetValue: this.cfg.kpiCustomerCountTarget + Math.floor((year - 2000) / 5),
        currentValue: this.state.currentCustomerCount,
        isAchieved: false,
      },
      {
        id: 'kpi_sla_rate',
        type: 'sla_rate',
        description: `SLA 達成率 ≥ ${this.cfg.kpiSlaRateTarget}%`,
        targetValue: this.cfg.kpiSlaRateTarget,
        currentValue: this.state.currentSLARate,
        isAchieved: false,
      },
      {
        id: 'kpi_gross_margin',
        type: 'gross_margin',
        description: `毛利率 ≥ ${this.cfg.kpiGrossMarginTarget}%`,
        targetValue: this.cfg.kpiGrossMarginTarget,
        currentValue: this.state.currentGrossMarginPct,
        isAchieved: false,
      },
    ];
    this.state.currentYearKPIs = kpis;
    void prevAnnualRevenue;

    this.bus.publish({
      type: 'board.kpi_set',
      payload: { year, kpis },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  private publishQuarterlyReview(): void {
    this.refreshKPIProgress();
    const achieved = this.state.currentYearKPIs.filter(k => k.isAchieved).length;
    const total = this.state.currentYearKPIs.length;
    this.bus.publish({
      type: 'board.quarterly_review',
      payload: {
        quarter: Math.ceil(this.currentDate.month / 3) as 1 | 2 | 3 | 4,
        achievedCount: achieved,
        totalCount: total,
        kpis: this.state.currentYearKPIs,
      },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this.state.pendingReview = true;
  }

  private onYearEnd(year: number): void {
    this.refreshKPIProgress();
    const achieved = this.state.currentYearKPIs.filter(k => k.isAchieved).length;
    const total = this.state.currentYearKPIs.length;
    const achievedRate = total > 0 ? achieved / total : 0;

    let bonus: Money = 0;
    let hadWarning = false;

    const annualRevenue = this.state.monthlyRevenue * 12;

    if (achievedRate >= 1.0) {
      bonus = Math.round(annualRevenue * this.cfg.bonusMonthsOfRevenue / 12);
      this.state.consecutiveFailYears = 0;
    } else if (achievedRate >= this.cfg.warningThreshold) {
      bonus = Math.round(annualRevenue * this.cfg.partialBonusMonthsOfRevenue / 12);
      this.state.consecutiveFailYears = 0;
    } else {
      hadWarning = true;
      this.state.consecutiveFailYears++;
    }

    const result: BoardYearResult = { year, achievedCount: achieved, totalCount: total, bonus, hadWarning };
    this.state.yearResults.push(result);
    this.state.pendingReview = true;

    this.bus.publish({
      type: 'board.year_end_result',
      payload: {
        year,
        achievedCount: achieved,
        totalCount: total,
        bonus,
        hadWarning,
        consecutiveFailYears: this.state.consecutiveFailYears,
      },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    if (bonus > 0) {
      this.bus.publish({
        type: 'board.bonus_awarded',
        payload: { amount: bonus, year },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }

    // Game over check
    if (this.state.consecutiveFailYears >= this.cfg.gameOverConsecutiveFailYears) {
      this.state.gameOver = true;
      this.bus.publish({
        type: 'board.game_over',
        payload: {
          reason: '連續兩年未達成 KPI 目標，董事會決議更換經營團隊',
          consecutiveFailYears: this.state.consecutiveFailYears,
        },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }

    // Store revenue for next year's growth calc
    this.state.lastYearRevenue = annualRevenue;

    // Set next year KPIs
    this.setNewYearKPIs(year + 1);
  }
}
