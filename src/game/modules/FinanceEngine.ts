import type {
  BalanceSheet,
  CreditRating,
  CreditRatingFactor,
  EntityId,
  ExpenseEntry,
  GameConfig,
  GameDate,
  IEventBus,
  IGameModule,
  IncomeEntry,
  Loan,
  Money,
  PLStatement,
  ServiceType,
} from '../core/types';
import { CreditRating as CR, ExpenseCategory } from '../core/types';
import { addMonths, monthsBetween } from '../../utils/gameDate';

// ─── Internal state ───────────────────────────────────────────────────────────

interface FinanceEngineState {
  cash: Money;
  currentMonthIncome: IncomeEntry[];
  currentMonthExpense: ExpenseEntry[];
  plHistory: PLStatement[];
  loans: Loan[];
  creditScore: number;
  creditRating: CreditRating;
  consecutiveProfitMonths: number;
  consecutiveLossMonths: number;
  lastCreditUpdateDate: GameDate | null;
  baseInterestRate: number;
  inflationRate: number;
  exchangeRateMod: number;
  econHardwareMod: number;
  slaBreachPenaltyThisMonth: Money;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function zeroPL(date: GameDate): PLStatement {
  return {
    date,
    income: {
      colocation: 0, vps: 0, saas: 0, bandwidth: 0, msp: 0,
      draas: 0, mssp: 0, aiCompute: 0, profServices: 0, training: 0, total: 0,
    },
    expenses: {
      hardwareDepreciation: 0, softwareLicense: 0, electricity: 0, bandwidth: 0,
      staffSalary: 0, facilityRent: 0, maintenanceContracts: 0, insurance: 0,
      compliance: 0, slaBreachPenalty: 0, loanInterest: 0, other: 0, total: 0,
    },
    preTaxProfit: 0,
    taxAmount: 0,
    netProfit: 0,
  };
}

function scoreToCreditRating(score: number): CreditRating {
  if (score >= 90) return CR.AAA;
  if (score >= 75) return CR.AA;
  if (score >= 60) return CR.A;
  if (score >= 45) return CR.BBB;
  if (score >= 30) return CR.BB;
  if (score >= 15) return CR.B;
  return CR.Insolvent;
}

/** Equal-payment loan amortisation: monthly payment (principal + interest). */
function calcMonthlyPayment(principal: Money, annualRate: number, months: number): Money {
  if (annualRate === 0 || months === 0) return Math.ceil(principal / months);
  const r = annualRate / 12;
  const pmt = principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.ceil(pmt);
}

function getCentralBankRate(
  history: Array<{ fromYear: number; rate: number }>,
  year: number,
): number {
  let rate = history[0].rate;
  for (const entry of history) {
    if (year >= entry.fromYear) rate = entry.rate;
    else break;
  }
  return rate;
}

// ─── FinanceEngine ────────────────────────────────────────────────────────────

export class FinanceEngine implements IGameModule {
  readonly moduleId = 'FinanceEngine';

  private bus!: IEventBus;
  private cfg!: GameConfig['finance'];
  private currentDate!: GameDate;

  private state: FinanceEngineState = {
    cash: 0,
    currentMonthIncome: [],
    currentMonthExpense: [],
    plHistory: [],
    loans: [],
    creditScore: 60,
    creditRating: CR.A,
    consecutiveProfitMonths: 0,
    consecutiveLossMonths: 0,
    lastCreditUpdateDate: null,
    baseInterestRate: 0.0525,
    inflationRate: 0.02,
    exchangeRateMod: 1.0,
    econHardwareMod: 1.0,
    slaBreachPenaltyThisMonth: 0,
  };

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.finance;
    this.currentDate = { ...config.time.startDate };
    this.state.cash = config.meta.startCash;
    this.state.baseInterestRate = getCentralBankRate(
      config.finance.centralBankRateHistory,
      config.meta.startYear,
    );

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { prevDate: GameDate; newDate: GameDate };
      this.currentDate = p.newDate;
      this.runMonthlySettlement(p.prevDate);
    }, this.moduleId);

    bus.subscribe('time.quarter_end', (e) => {
      this.runQuarterlyUpdate(e.gameDate);
    }, this.moduleId);

    bus.subscribe('time.year_end', (e) => {
      const payload = e.payload as { year: number };
      this.runYearEndAdjustment(payload.year);
    }, this.moduleId);

    // Accept income/expense from other modules
    bus.subscribe('contract.revenue_collected', (e) => {
      this.recordIncome(e.payload as IncomeEntry);
    }, this.moduleId);

    bus.subscribe('contract.sla_breach_penalty', (e) => {
      const payload = e.payload as { amount: Money; contractId?: EntityId };
      this.state.slaBreachPenaltyThisMonth += payload.amount;
      this.recordExpense({
        date: this.currentDate,
        category: ExpenseCategory.SLABreach,
        referenceId: payload.contractId,
        amount: payload.amount,
        isCashExpense: true,
        description: '合約 SLA 違約賠償',
      });
    }, this.moduleId);

    bus.subscribe('staff.salary_due', (e) => {
      this.recordExpense(e.payload as ExpenseEntry);
    }, this.moduleId);

    bus.subscribe('facility.rent_due', (e) => {
      this.recordExpense(e.payload as ExpenseEntry);
    }, this.moduleId);

    bus.subscribe('facility.electricity_due', (e) => {
      this.recordExpense(e.payload as ExpenseEntry);
    }, this.moduleId);

    bus.subscribe('software.license_fee_due', (e) => {
      this.recordExpense(e.payload as ExpenseEntry);
    }, this.moduleId);

    bus.subscribe('hardware.purchased', (e) => {
      const payload = e.payload as { amount: Money; referenceId?: EntityId };
      this.state.cash -= payload.amount;
    }, this.moduleId);

    bus.subscribe('hardware.monthly_depreciation', (e) => {
      this.recordExpense(e.payload as ExpenseEntry);
    }, this.moduleId);

    bus.subscribe('techtree.investment_made', (e) => {
      const payload = e.payload as { amount: Money };
      this.state.cash -= payload.amount;
    }, this.moduleId);

    // Generic expense hook used by newer modules (TechDebt, Compliance, Energy, etc.)
    bus.subscribe('finance.expense_requested', (e) => {
      this.recordExpense(e.payload as ExpenseEntry);
    }, this.moduleId);

    bus.subscribe('timeline.economic_modifier_changed', (e) => {
      const p = e.payload as {
        exchangeRateMod?: number;
        econHardwareMod?: number;
        inflationRate?: number;
        baseInterestRate?: number;
      };
      if (p.exchangeRateMod !== undefined) this.state.exchangeRateMod = p.exchangeRateMod;
      if (p.econHardwareMod !== undefined) this.state.econHardwareMod = p.econHardwareMod;
      if (p.inflationRate !== undefined) this.state.inflationRate = p.inflationRate;
      if (p.baseInterestRate !== undefined) this.state.baseInterestRate = p.baseInterestRate;
    }, this.moduleId);
  }

  // ── Monthly settlement ────────────────────────────────────────────

  private runMonthlySettlement(settlementDate: GameDate): void {
    const pl = zeroPL(settlementDate);

    // Aggregate income by service type
    for (const entry of this.state.currentMonthIncome) {
      pl.income.total += entry.amount;
      switch (entry.type as ServiceType) {
        case 'COLOCATION':    pl.income.colocation   += entry.amount; break;
        case 'VPS':           pl.income.vps           += entry.amount; break;
        case 'SAAS':          pl.income.saas          += entry.amount; break;
        case 'BANDWIDTH':     pl.income.bandwidth     += entry.amount; break;
        case 'MSP':           pl.income.msp           += entry.amount; break;
        case 'DRAAS':         pl.income.draas         += entry.amount; break;
        case 'MSSP':          pl.income.mssp          += entry.amount; break;
        case 'AI_COMPUTE':    pl.income.aiCompute     += entry.amount; break;
        case 'PROF_SERVICES': pl.income.profServices  += entry.amount; break;
        case 'TRAINING':      pl.income.training      += entry.amount; break;
      }
    }

    // Aggregate expenses by category
    for (const entry of this.state.currentMonthExpense) {
      pl.expenses.total += entry.amount;
      switch (entry.category) {
        case ExpenseCategory.HardwareDepreciation: pl.expenses.hardwareDepreciation += entry.amount; break;
        case ExpenseCategory.SoftwareLicense:      pl.expenses.softwareLicense      += entry.amount; break;
        case ExpenseCategory.Electricity:          pl.expenses.electricity          += entry.amount; break;
        case ExpenseCategory.Bandwidth:            pl.expenses.bandwidth            += entry.amount; break;
        case ExpenseCategory.StaffSalary:          pl.expenses.staffSalary          += entry.amount; break;
        case ExpenseCategory.FacilityRent:         pl.expenses.facilityRent         += entry.amount; break;
        case ExpenseCategory.Maintenance:          pl.expenses.maintenanceContracts += entry.amount; break;
        case ExpenseCategory.Insurance:            pl.expenses.insurance            += entry.amount; break;
        case ExpenseCategory.Compliance:           pl.expenses.compliance           += entry.amount; break;
        case ExpenseCategory.SLABreach:            pl.expenses.slaBreachPenalty     += entry.amount; break;
        case ExpenseCategory.LoanInterest:         pl.expenses.loanInterest         += entry.amount; break;
        default:                                   pl.expenses.other                += entry.amount; break;
      }
    }

    // Loan payments
    let totalLoanCash = 0;
    for (const loan of this.state.loans) {
      if (loan.remainingBalance <= 0) continue;
      const interestThisMonth = Math.ceil(loan.remainingBalance * (loan.annualRate / 12));
      const principalThisMonth = Math.min(
        loan.monthlyPayment - interestThisMonth,
        loan.remainingBalance,
      );
      const payment = principalThisMonth + interestThisMonth;

      if (this.state.cash < payment) {
        loan.isOverdue = true;
        this.bus.publish({
          type: 'finance.loan_overdue',
          payload: { loanId: loan.id },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      } else {
        loan.remainingBalance -= principalThisMonth;
        totalLoanCash += payment;
        this.recordExpense({
          date: settlementDate,
          category: ExpenseCategory.LoanInterest,
          referenceId: loan.id,
          amount: interestThisMonth,
          isCashExpense: true,
          description: '貸款利息',
        });
        pl.expenses.loanInterest += interestThisMonth;
        pl.expenses.total += interestThisMonth;
      }
    }

    // Cash settlement (only cash expenses, not depreciation)
    const cashExpenses = this.state.currentMonthExpense
      .filter(e => e.isCashExpense)
      .reduce((s, e) => s + e.amount, 0);

    this.state.cash += pl.income.total;
    this.state.cash -= cashExpenses;
    this.state.cash -= totalLoanCash;

    // Tax
    pl.preTaxProfit = pl.income.total - pl.expenses.total;
    if (pl.preTaxProfit > 0) {
      pl.taxAmount = Math.floor(pl.preTaxProfit * this.cfg.corporateTaxRate);
    }
    pl.netProfit = pl.preTaxProfit - pl.taxAmount;

    // Track consecutive profit/loss
    if (pl.netProfit > 0) {
      this.state.consecutiveProfitMonths++;
      this.state.consecutiveLossMonths = 0;
    } else if (pl.netProfit < 0) {
      this.state.consecutiveLossMonths++;
      this.state.consecutiveProfitMonths = 0;
    }

    // Snapshot
    this.state.plHistory.push(pl);
    if (this.state.plHistory.length > 36) this.state.plHistory.shift();

    // Reset month buffers
    this.state.currentMonthIncome = [];
    this.state.currentMonthExpense = [];
    this.state.slaBreachPenaltyThisMonth = 0;

    // Publish settlement
    this.bus.publish({
      type: 'finance.monthly_settlement',
      payload: pl,
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    // Failure / warning checks
    this.checkFailureConditions();
    this.checkCashWarning(pl.expenses.total);
  }

  private checkFailureConditions(): void {
    if (this.state.cash <= 0) {
      this.bus.publish({
        type: 'finance.cash_depleted',
        payload: {},
        gameDate: this.currentDate,
        source: this.moduleId,
      });
      this.bus.publish({
        type: 'game.pause_requested',
        payload: { reason: 'cash_warning' },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
      return;
    }

    if (
      this.state.consecutiveLossMonths >= this.cfg.bankruptcyConsecutiveLossMonths &&
      this.state.creditRating === CR.Insolvent
    ) {
      this.bus.publish({
        type: 'finance.bankruptcy_risk',
        payload: { consecutiveLossMonths: this.state.consecutiveLossMonths },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private checkCashWarning(monthlyExpenses: Money): void {
    if (monthlyExpenses > 0 && this.state.cash < monthlyExpenses * this.cfg.cashWarningMultiplier) {
      this.bus.publish({
        type: 'finance.cash_warning',
        payload: { cash: this.state.cash, monthlyExpenses },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
      this.bus.publish({
        type: 'game.pause_requested',
        payload: { reason: 'cash_warning' },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  // ── Quarterly update (credit rating) ─────────────────────────────

  private runQuarterlyUpdate(date: GameDate): void {
    if (
      this.state.lastCreditUpdateDate !== null &&
      monthsBetween(this.state.lastCreditUpdateDate, date) < this.cfg.creditRatingUpdateIntervalMonths
    ) {
      return;
    }
    this.state.lastCreditUpdateDate = date;

    const factors = this.computeCreditFactors();
    const delta = factors.reduce((s, f) => s + f.deltaScore, 0);
    const oldRating = this.state.creditRating;

    this.state.creditScore = Math.max(0, Math.min(100, this.state.creditScore + delta));
    const newRating = scoreToCreditRating(this.state.creditScore);

    if (newRating !== oldRating) {
      this.state.creditRating = newRating;
      this.bus.publish({
        type: 'finance.credit_rating_changed',
        payload: { from: oldRating, to: newRating, score: this.state.creditScore },
        gameDate: date,
        source: this.moduleId,
      });
    }
  }

  private computeCreditFactors(): CreditRatingFactor[] {
    const factors: CreditRatingFactor[] = [];
    const recent = this.state.plHistory.slice(-3);

    // Consecutive profit months
    if (this.state.consecutiveProfitMonths > 0) {
      factors.push({ factor: 'consecutive_profit', deltaScore: 0.5, description: `連續獲利 ${this.state.consecutiveProfitMonths} 個月` });
    }
    // Consecutive loss months
    if (this.state.consecutiveLossMonths > 0) {
      factors.push({ factor: 'consecutive_loss', deltaScore: -2, description: `連續虧損 ${this.state.consecutiveLossMonths} 個月` });
    }

    // Cash coverage
    const avgExpenses = recent.length > 0
      ? recent.reduce((s, pl) => s + pl.expenses.total, 0) / recent.length
      : 0;
    if (avgExpenses > 0) {
      const coverage = this.state.cash / avgExpenses;
      if (coverage > 6) {
        factors.push({ factor: 'cash_coverage_high', deltaScore: 1, description: `現金覆蓋率 ${coverage.toFixed(1)}x（高）` });
      } else if (coverage < 2) {
        factors.push({ factor: 'cash_coverage_low', deltaScore: -2, description: `現金覆蓋率 ${coverage.toFixed(1)}x（低）` });
      }
    }

    // Debt ratio
    const totalLoan = this.state.loans.reduce((s, l) => s + l.remainingBalance, 0);
    if (totalLoan > 0 && this.state.cash > 0) {
      const ratio = totalLoan / (this.state.cash + totalLoan);
      if (ratio < 0.3) {
        factors.push({ factor: 'low_debt_ratio', deltaScore: 1, description: `負債比率 ${(ratio * 100).toFixed(0)}%（低）` });
      } else if (ratio > 0.7) {
        factors.push({ factor: 'high_debt_ratio', deltaScore: -3, description: `負債比率 ${(ratio * 100).toFixed(0)}%（高）` });
      }
    }

    return factors;
  }

  // ── Year-end ──────────────────────────────────────────────────────

  private runYearEndAdjustment(year: number): void {
    const newRate = getCentralBankRate(this.cfg.centralBankRateHistory, year + 1);
    if (newRate !== this.state.baseInterestRate) {
      this.state.baseInterestRate = newRate;
    }
    this.bus.publish({
      type: 'finance.inflation_adjustment',
      payload: { rate: this.state.inflationRate, year },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  // ── Public API ────────────────────────────────────────────────────

  getCash(): Money { return this.state.cash; }

  getMonthlyPLPreview(): PLStatement {
    const pl = zeroPL(this.currentDate);
    for (const e of this.state.currentMonthIncome) pl.income.total += e.amount;
    for (const e of this.state.currentMonthExpense) pl.expenses.total += e.amount;
    pl.preTaxProfit = pl.income.total - pl.expenses.total;
    pl.netProfit = pl.preTaxProfit > 0
      ? Math.floor(pl.preTaxProfit * (1 - this.cfg.corporateTaxRate))
      : pl.preTaxProfit;
    return pl;
  }

  getLastMonthPL(): PLStatement | null {
    return this.state.plHistory.at(-1) ?? null;
  }

  getPLHistory(months = 12): PLStatement[] {
    return this.state.plHistory.slice(-months);
  }

  getBalanceSheet(): BalanceSheet {
    const loanBalance = this.state.loans.reduce((s, l) => s + l.remainingBalance, 0);
    const cash = this.state.cash;
    return {
      date: this.currentDate,
      assets: { cash, hardwareBookValue: 0, accountsReceivable: 0, totalAssets: cash },
      liabilities: { loanBalance, accountsPayable: 0, totalLiabilities: loanBalance },
      equity: cash - loanBalance,
    };
  }

  getCreditRating(): CreditRating { return this.state.creditRating; }
  getCreditScore(): number { return this.state.creditScore; }

  getActiveLoans(): Loan[] {
    return this.state.loans.filter(l => l.remainingBalance > 0);
  }

  applyForLoan(amount: Money, termMonths: number): EntityId | null {
    const terms = this.cfg.loanTerms[this.state.creditRating];
    if (!terms || terms.maxMultiple === 0) return null;

    const recentPL = this.state.plHistory.slice(-3);
    const avgMonthlyRevenue = recentPL.length > 0
      ? recentPL.reduce((s, pl) => s + pl.income.total, 0) / recentPL.length
      : 0;
    const maxAmount = avgMonthlyRevenue * terms.maxMultiple;
    if (amount > maxAmount) return null;
    if (termMonths > terms.maxMonths) return null;

    const effectiveRate = terms.annualRate + this.state.baseInterestRate;
    const loan: Loan = {
      id: crypto.randomUUID(),
      principal: amount,
      remainingBalance: amount,
      annualRate: effectiveRate,
      monthlyPayment: calcMonthlyPayment(amount, effectiveRate, termMonths),
      startDate: this.currentDate,
      endDate: addMonths(this.currentDate, termMonths),
      isOverdue: false,
    };
    this.state.loans.push(loan);
    this.state.cash += amount;

    this.bus.publish({
      type: 'finance.loan_approved',
      payload: loan,
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    return loan.id;
  }

  repayLoan(loanId: EntityId): boolean {
    const loan = this.state.loans.find(l => l.id === loanId);
    if (!loan || loan.remainingBalance <= 0) return false;
    if (this.state.cash < loan.remainingBalance) return false;

    this.state.cash -= loan.remainingBalance;
    loan.remainingBalance = 0;

    this.bus.publish({
      type: 'finance.loan_repaid',
      payload: { loanId },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    return true;
  }

  recordIncome(entry: IncomeEntry): void {
    this.state.currentMonthIncome.push(entry);
  }

  recordExpense(entry: ExpenseEntry): void {
    this.state.currentMonthExpense.push(entry);
  }

  getCurrentBaseInterestRate(): number { return this.state.baseInterestRate; }

  getCreditRatingFactors(): CreditRatingFactor[] {
    return this.computeCreditFactors();
  }

  // ── IGameModule ───────────────────────────────────────────────────

  tick(_deltaMs: number): void { /* no per-frame work needed */ }

  serialize(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this.state)) as Record<string, unknown>;
  }

  deserialize(raw: Record<string, unknown>): void {
    this.state = raw as unknown as FinanceEngineState;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      cash: this.state.cash,
      creditRating: this.state.creditRating,
      creditScore: this.state.creditScore,
      consecutiveProfitMonths: this.state.consecutiveProfitMonths,
      consecutiveLossMonths: this.state.consecutiveLossMonths,
      lastPL: this.state.plHistory.at(-1) ?? null,
      activeLoanCount: this.state.loans.filter(l => l.remainingBalance > 0).length,
    });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }
}
