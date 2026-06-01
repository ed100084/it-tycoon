import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { RegulatoryEngine } from './RegulatoryEngine';
import { RegulationId, RegComplianceStatus } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';
import type { GameDate } from '../core/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function build() {
  const bus = new EventBus();
  const re = new RegulatoryEngine();
  re.init(bus, DEFAULT_CONFIG);
  return { bus, re };
}

function monthEnd(bus: EventBus, year: number, month: number) {
  const date: GameDate = { year, month };
  bus.publish({
    type: 'time.month_end',
    payload: { newDate: date },
    source: 'test',
    gameDate: date,
  });
}

/**
 * Advance by the given number of months starting from the given year/month
 * (the starting date is treated as "already elapsed", so the first tick is
 * startYear/startMonth + 1 month).
 */
function advanceMonths(
  bus: EventBus,
  months: number,
  startYear = 2000,
  startMonth = 1,
) {
  let y = startYear;
  let m = startMonth;
  for (let i = 0; i < months; i++) {
    m++;
    if (m > 12) { m = 1; y++; }
    monthEnd(bus, y, m);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegulatoryEngine', () => {
  it('1. initial activeRegulations is empty', () => {
    const { re } = build();
    expect(re.getRegulatoryState().activeRegulations).toHaveLength(0);
  });

  it('2. regulations become active in the correct year', () => {
    const { bus, re } = build();
    // Advance to Jan 2005 — FSC_InfoSec (effectiveYear=2005) should activate
    advanceMonths(bus, 12 * 5, 2000, 1); // reaches 2005/01
    const state = re.getRegulatoryState();
    expect(state.activeRegulations).toContain(RegulationId.FSC_InfoSec);
    // PersonalData (2012) should not be active yet
    expect(state.activeRegulations).not.toContain(RegulationId.PersonalData);
  });

  it('3. startCompliance deducts cost via hardware.purchased', () => {
    const { bus, re } = build();
    // Activate FSC_InfoSec by reaching 2005
    advanceMonths(bus, 12 * 5, 2000, 1);
    const purchases: unknown[] = [];
    bus.subscribe('hardware.purchased', e => purchases.push(e));
    re.startCompliance(RegulationId.FSC_InfoSec);
    expect(purchases).toHaveLength(1);
  });

  it('4. startCompliance sets status to InProgress', () => {
    const { bus, re } = build();
    advanceMonths(bus, 12 * 5, 2000, 1);
    re.startCompliance(RegulationId.FSC_InfoSec);
    expect(re.getRegulatoryState().complianceStatus[RegulationId.FSC_InfoSec]).toBe(
      RegComplianceStatus.InProgress,
    );
  });

  it('5. status advances to Compliant after 3 months', () => {
    const { bus, re } = build();
    // Reach 2005
    advanceMonths(bus, 12 * 5, 2000, 1); // now at 2005/01
    re.startCompliance(RegulationId.FSC_InfoSec);
    // Advance 3 more months (2005/02, 2005/03, 2005/04)
    advanceMonths(bus, 3, 2005, 1);
    expect(re.getRegulatoryState().complianceStatus[RegulationId.FSC_InfoSec]).toBe(
      RegComplianceStatus.Compliant,
    );
  });

  it('6. annualMaintenanceCost charged monthly for Compliant regulation', () => {
    const { bus, re } = build();
    advanceMonths(bus, 12 * 5, 2000, 1); // 2005/01
    re.startCompliance(RegulationId.FSC_InfoSec);
    advanceMonths(bus, 3, 2005, 1); // now Compliant at 2005/04

    const expenses: Array<{ payload: { amount: number } }> = [];
    bus.subscribe('finance.expense_requested', e =>
      expenses.push(e as { payload: { amount: number } }),
    );
    // Tick one more month — should charge 1/12 of 120_000 = 10_000
    advanceMonths(bus, 1, 2005, 4);
    const maintenanceExpenses = expenses.filter(e => e.payload.amount === Math.ceil(120_000 / 12));
    expect(maintenanceExpenses.length).toBeGreaterThanOrEqual(1);
  });

  it('7. getRequiredRegulations returns correct set for a given year', () => {
    const { re } = build();
    const required2010 = re.getRequiredRegulations(2010);
    // FSC_InfoSec (2005) and PersonalData (2012) — only 2005 is <= 2010
    const ids = required2010.map(d => d.id);
    expect(ids).toContain(RegulationId.FSC_InfoSec);
    expect(ids).not.toContain(RegulationId.PersonalData);
    expect(ids).not.toContain(RegulationId.GDPR);

    const required2023 = re.getRequiredRegulations(2023);
    const ids2023 = required2023.map(d => d.id);
    expect(ids2023).toContain(RegulationId.DigitalEconomy);
  });

  it('8. isCompliant returns false for NonCompliant regulation', () => {
    const { bus, re } = build();
    // Reach 2005 — FSC_InfoSec activates as NonCompliant
    advanceMonths(bus, 12 * 5, 2000, 1);
    expect(re.isCompliant(RegulationId.FSC_InfoSec)).toBe(false);
  });

  it('9. isCompliant returns true after becoming Compliant', () => {
    const { bus, re } = build();
    advanceMonths(bus, 12 * 5, 2000, 1); // 2005/01
    re.startCompliance(RegulationId.FSC_InfoSec);
    advanceMonths(bus, 3, 2005, 1); // 3 months → Compliant
    expect(re.isCompliant(RegulationId.FSC_InfoSec)).toBe(true);
  });

  it('10. canBidFinancialContract is false when not compliant', () => {
    const { bus, re } = build();
    advanceMonths(bus, 12 * 5, 2000, 1); // FSC_InfoSec active but NonCompliant
    expect(re.canBidFinancialContract()).toBe(false);
  });

  it('11. canBidFinancialContract is true after FSC_InfoSec compliant', () => {
    const { bus, re } = build();
    advanceMonths(bus, 12 * 5, 2000, 1);
    re.startCompliance(RegulationId.FSC_InfoSec);
    advanceMonths(bus, 3, 2005, 1);
    expect(re.canBidFinancialContract()).toBe(true);
  });

  it('12. serialize/deserialize preserves complianceStatus and totalFines', () => {
    const { bus, re } = build();
    advanceMonths(bus, 12 * 5, 2000, 1);
    re.startCompliance(RegulationId.FSC_InfoSec);
    // Manually inject a fine to verify totalFines round-trips
    const serialized = re.serialize() as Record<string, unknown>;
    (serialized as { totalFines: number }).totalFines = 999_000;

    const re2 = new RegulatoryEngine();
    re2.init(new EventBus(), DEFAULT_CONFIG);
    re2.deserialize(serialized);

    const state2 = re2.getRegulatoryState();
    expect(state2.complianceStatus[RegulationId.FSC_InfoSec]).toBe(
      RegComplianceStatus.InProgress,
    );
    expect(state2.totalFines).toBe(999_000);
  });
});
