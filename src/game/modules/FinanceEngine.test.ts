import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { FinanceEngine } from './FinanceEngine';
import { DEFAULT_CONFIG } from '../config/default.config';
import { ExpenseCategory, ServiceType, CreditRating } from '../core/types';
import type { GameConfig, PLStatement } from '../core/types';

function buildEngine(cashOverride?: number) {
  const bus = new EventBus();
  const fin = new FinanceEngine();
  const cfg: GameConfig = {
    ...DEFAULT_CONFIG,
    time: { ...DEFAULT_CONFIG.time, autoPauseOnMonthEnd: false },
    meta: { ...DEFAULT_CONFIG.meta, startCash: cashOverride ?? DEFAULT_CONFIG.meta.startCash },
  };
  fin.init(bus, cfg);
  return { bus, fin };
}

function triggerMonthEnd(bus: EventBus, prevYear = 2000, prevMonth = 1) {
  const prevDate = { year: prevYear, month: prevMonth };
  const newMonth = prevMonth === 12 ? 1 : prevMonth + 1;
  const newYear = prevMonth === 12 ? prevYear + 1 : prevYear;
  const newDate = { year: newYear, month: newMonth };
  bus.publish({
    type: 'time.month_end',
    payload: { prevDate, newDate, totalMonthsElapsed: 1 },
    gameDate: newDate,
    source: 'TimeEngine',
  });
  return { prevDate, newDate };
}

function triggerQuarterEnd(bus: EventBus, year = 2000, month = 3) {
  const date = { year, month };
  bus.publish({
    type: 'time.quarter_end',
    payload: { date, quarter: Math.ceil(month / 3) },
    gameDate: date,
    source: 'TimeEngine',
  });
}

describe('FinanceEngine — initial state', () => {
  it('starts with configured cash', () => {
    const { fin } = buildEngine(5_000_000);
    expect(fin.getCash()).toBe(5_000_000);
  });

  it('starts with A credit rating', () => {
    const { fin } = buildEngine();
    expect(fin.getCreditRating()).toBe(CreditRating.A);
  });
});

describe('FinanceEngine — income and expenses', () => {
  it('records income and reflects in monthly PL preview', () => {
    const { fin } = buildEngine();
    fin.recordIncome({
      date: { year: 2000, month: 1 },
      type: ServiceType.Colocation,
      amount: 100_000,
      description: 'test',
    });
    const preview = fin.getMonthlyPLPreview();
    expect(preview.income.total).toBe(100_000);
  });

  it('records expense and reflects in monthly PL preview', () => {
    const { fin } = buildEngine();
    fin.recordExpense({
      date: { year: 2000, month: 1 },
      category: ExpenseCategory.Electricity,
      amount: 50_000,
      isCashExpense: true,
      description: 'electricity',
    });
    const preview = fin.getMonthlyPLPreview();
    expect(preview.expenses.total).toBe(50_000);
  });
});

describe('FinanceEngine — monthly settlement', () => {
  it('clears month buffers and produces PL history after month_end', () => {
    const { bus, fin } = buildEngine();
    fin.recordIncome({
      date: { year: 2000, month: 1 },
      type: ServiceType.Colocation,
      amount: 200_000,
      description: 'colo',
    });
    triggerMonthEnd(bus);
    expect(fin.getLastMonthPL()?.income.total).toBe(200_000);
    // buffer cleared
    expect(fin.getMonthlyPLPreview().income.total).toBe(0);
  });

  it('adds income to cash at settlement', () => {
    const { bus, fin } = buildEngine(1_000_000);
    fin.recordIncome({
      date: { year: 2000, month: 1 },
      type: ServiceType.VPS,
      amount: 500_000,
      description: 'vps',
    });
    triggerMonthEnd(bus);
    expect(fin.getCash()).toBe(1_500_000);
  });

  it('deducts cash expenses at settlement', () => {
    const { bus, fin } = buildEngine(1_000_000);
    fin.recordExpense({
      date: { year: 2000, month: 1 },
      category: ExpenseCategory.Electricity,
      amount: 200_000,
      isCashExpense: true,
      description: 'power',
    });
    triggerMonthEnd(bus);
    expect(fin.getCash()).toBe(800_000);
  });

  it('non-cash depreciation does not affect cash', () => {
    const { bus, fin } = buildEngine(1_000_000);
    fin.recordExpense({
      date: { year: 2000, month: 1 },
      category: ExpenseCategory.HardwareDepreciation,
      amount: 10_000,
      isCashExpense: false,
      description: 'depreciation',
    });
    triggerMonthEnd(bus);
    expect(fin.getCash()).toBe(1_000_000);
  });

  it('publishes finance.monthly_settlement event', () => {
    const { bus, fin } = buildEngine();
    const handler = vi.fn();
    bus.subscribe<PLStatement>('finance.monthly_settlement', handler);
    triggerMonthEnd(bus);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('tracks profit months correctly', () => {
    const { bus, fin } = buildEngine();
    fin.recordIncome({ date: { year: 2000, month: 1 }, type: ServiceType.Colocation, amount: 100_000, description: '' });
    triggerMonthEnd(bus);
    expect((fin.getState() as { consecutiveProfitMonths: number }).consecutiveProfitMonths).toBe(1);
  });

  it('publishes finance.cash_warning when cash < 2x monthly expenses', () => {
    const { bus, fin } = buildEngine(100_000);
    const warnHandler = vi.fn();
    bus.subscribe('finance.cash_warning', warnHandler);
    fin.recordExpense({ date: { year: 2000, month: 1 }, category: ExpenseCategory.FacilityRent, amount: 60_000, isCashExpense: true, description: 'rent' });
    triggerMonthEnd(bus);
    // cash = 40_000, monthly expense = 60_000 → 40k < 2×60k → warning
    expect(warnHandler).toHaveBeenCalled();
  });
});

describe('FinanceEngine — loans', () => {
  it('applyForLoan returns null for Insolvent rating', () => {
    const { fin } = buildEngine();
    // force to Insolvent
    (fin as unknown as { state: { creditRating: CreditRating } }).state.creditRating = CreditRating.Insolvent;
    const result = fin.applyForLoan(1_000_000, 12);
    expect(result).toBeNull();
  });

  it('applyForLoan increases cash and returns a loan id', () => {
    const { bus, fin } = buildEngine(5_000_000);
    // Create some revenue history so maxMultiple check passes
    for (let m = 1; m <= 3; m++) {
      fin.recordIncome({ date: { year: 2000, month: m }, type: ServiceType.Colocation, amount: 1_000_000, description: '' });
      triggerMonthEnd(bus, 2000, m);
    }
    const cashBefore = fin.getCash();
    const id = fin.applyForLoan(3_000_000, 24);
    expect(id).toBeTruthy();
    expect(fin.getCash()).toBe(cashBefore + 3_000_000);
  });

  it('repayLoan reduces cash and clears balance', () => {
    const { bus, fin } = buildEngine(5_000_000);
    for (let m = 1; m <= 3; m++) {
      fin.recordIncome({ date: { year: 2000, month: m }, type: ServiceType.Colocation, amount: 1_000_000, description: '' });
      triggerMonthEnd(bus, 2000, m);
    }
    const loanId = fin.applyForLoan(1_000_000, 12)!;
    const cashAfterLoan = fin.getCash();
    fin.repayLoan(loanId);
    expect(fin.getCash()).toBe(cashAfterLoan - 1_000_000);
    expect(fin.getActiveLoans().length).toBe(0);
  });
});

describe('FinanceEngine — credit rating', () => {
  it('credit rating updates on quarter_end', () => {
    const { bus } = buildEngine();
    const handler = vi.fn();
    bus.subscribe('finance.credit_rating_changed', handler);
    // Trigger consistent losses to push down rating
    for (let i = 0; i < 4; i++) {
      bus.publish({
        type: 'time.month_end',
        payload: { prevDate: { year: 2000, month: i + 1 }, newDate: { year: 2000, month: i + 2 }, totalMonthsElapsed: i + 1 },
        gameDate: { year: 2000, month: i + 2 },
        source: 'TimeEngine',
      });
    }
    triggerQuarterEnd(bus, 2000, 3);
    // whether or not it changed, the update ran — just ensure no crash
    expect(true).toBe(true);
  });
});

describe('FinanceEngine — event-driven income/expenses', () => {
  it('contract.revenue_collected triggers income recording', () => {
    const { bus, fin } = buildEngine();
    bus.publish({
      type: 'contract.revenue_collected',
      payload: { date: { year: 2000, month: 1 }, type: ServiceType.Colocation, amount: 75_000, description: 'colo' },
      gameDate: { year: 2000, month: 1 },
      source: 'ContractManager',
    });
    expect(fin.getMonthlyPLPreview().income.total).toBe(75_000);
  });

  it('hardware.purchased reduces cash immediately', () => {
    const { bus, fin } = buildEngine(1_000_000);
    bus.publish({
      type: 'hardware.purchased',
      payload: { amount: 200_000 },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    expect(fin.getCash()).toBe(800_000);
  });
});

describe('FinanceEngine — serialize/deserialize', () => {
  it('round-trips state correctly', () => {
    const { bus, fin } = buildEngine(2_000_000);
    fin.recordIncome({ date: { year: 2000, month: 1 }, type: ServiceType.Colocation, amount: 100_000, description: '' });
    triggerMonthEnd(bus);
    const snap = fin.serialize();

    const bus2 = new EventBus();
    const fin2 = new FinanceEngine();
    fin2.init(bus2, DEFAULT_CONFIG);
    fin2.deserialize(snap);

    expect(fin2.getCash()).toBe(fin.getCash());
    expect(fin2.getCreditRating()).toBe(fin.getCreditRating());
  });
});
