import { CreditRating } from '../core/types';
import type { GameConfig } from '../core/types';

export const DEFAULT_CONFIG: Readonly<GameConfig> = Object.freeze({
  meta: {
    startYear: 2000,
    startMonth: 1,
    startCash: 5_000_000,  // NT$5,000,000 (天使輪資金)
    gameMode: 'standard' as const,
  },
  time: {
    msPerGameMonthAt1x: 60_000,  // 60 秒現實 = 1 遊戲月 (1x)
    startDate: { year: 2000, month: 1 },
    autoPauseOnP1: true,
    autoPauseOnP2: true,
    autoPauseOnRFP: true,
    autoPauseOnMajorEvent: true,
    autoPauseOnMonthEnd: true,
    autoPauseOnCashWarning: true,
    autoPauseOnEOLWarning: false,
    autoPauseOnContractExpiry: true,
  },
  finance: {
    corporateTaxRate: 0.17,
    staffBenefitMultiplier: 1.3,
    creditRatingUpdateIntervalMonths: 3,
    bankruptcyConsecutiveLossMonths: 3,
    cashWarningMultiplier: 2,
    slaBreachPayoutCap: 3.0,
    depreciation: {
      server: 60,
      networking: 84,
      storage: 60,
      ups: 120,
      facility: 240,
      residualRate: 0.10,
    },
    loanTerms: {
      [CreditRating.AAA]:      { maxMultiple: 36, annualRate: 0.025, maxMonths: 84 },
      [CreditRating.AA]:       { maxMultiple: 24, annualRate: 0.035, maxMonths: 60 },
      [CreditRating.A]:        { maxMultiple: 18, annualRate: 0.045, maxMonths: 36 },
      [CreditRating.BBB]:      { maxMultiple: 12, annualRate: 0.065, maxMonths: 24 },
      [CreditRating.BB]:       { maxMultiple:  6, annualRate: 0.090, maxMonths: 12 },
      [CreditRating.B]:        { maxMultiple:  3, annualRate: 0.150, maxMonths:  6 },
      [CreditRating.Insolvent]:{ maxMultiple:  0, annualRate: 0.000, maxMonths:  0 },
    },
    centralBankRateHistory: [
      { fromYear: 2000, rate: 0.0525 },
      { fromYear: 2002, rate: 0.0175 },
      { fromYear: 2005, rate: 0.0325 },
      { fromYear: 2008, rate: 0.0125 },
      { fromYear: 2010, rate: 0.0150 },
      { fromYear: 2015, rate: 0.0125 },
      { fromYear: 2022, rate: 0.0475 },
      { fromYear: 2024, rate: 0.0350 },
    ],
  },
});
