import { describe, it, expect } from 'vitest';
import {
  createDefaultStaff,
  calcStaffHireCost,
  calcStaffSalaryPerSecond,
  calcStaffCoverage,
  calcStaffHeadcount,
  calcWorkload,
  calcCoverageRatio,
  calcStaffEffects,
} from './staff';
import {
  STAFF_AUDIT_COST_FLOOR,
  STAFF_COST_GROWTH,
  STAFF_FREE_WORKLOAD,
  STAFF_ROLE_DEFS,
  WORKLOAD_PER_CONTRACT,
} from '../config/staff.config';
import type { ActiveContract, StaffState } from '../models/types';

const noc = STAFF_ROLE_DEFS.find((d) => d.id === 'noc')!;
const contract = (): ActiveContract => ({
  id: 'c', clientName: 'x', serviceType: 'vps', reservedUnits: 1, payoutPerSecond: 1,
  slaPenaltyPerSecond: 0, completionReward: 0, startedAt: 0, endsAt: 100, breachSeconds: 0, totalPaid: 0,
});

describe('createDefaultStaff', () => {
  it('starts every role at zero', () => {
    const staff = createDefaultStaff();
    expect(calcStaffHeadcount(staff)).toBe(0);
    STAFF_ROLE_DEFS.forEach((d) => expect(staff[d.id]).toBe(0));
  });
});

describe('calcStaffHireCost', () => {
  it('returns base cost for the first hire', () => {
    expect(calcStaffHireCost('noc', 0)).toBe(noc.hireBaseCost);
  });

  it('grows geometrically per head', () => {
    expect(calcStaffHireCost('noc', 2)).toBe(Math.ceil(noc.hireBaseCost * STAFF_COST_GROWTH ** 2));
  });
});

describe('aggregates', () => {
  const staff: StaffState = { noc: 2, syseng: 1, secana: 0, manager: 0 };

  it('sums salary, coverage and headcount', () => {
    const syseng = STAFF_ROLE_DEFS.find((d) => d.id === 'syseng')!;
    expect(calcStaffHeadcount(staff)).toBe(3);
    expect(calcStaffSalaryPerSecond(staff)).toBe(2 * noc.salaryPerSecond + syseng.salaryPerSecond);
    expect(calcStaffCoverage(staff)).toBe(2 * noc.coverage + syseng.coverage);
  });
});

describe('calcWorkload', () => {
  it('counts hardware units plus weighted contracts', () => {
    const workload = calcWorkload({ T0: { owned: 4, upgradeLevel: 1 } }, [contract(), contract()]);
    expect(workload).toBe(4 + 2 * WORKLOAD_PER_CONTRACT);
  });
});

describe('calcCoverageRatio', () => {
  it('is fully covered while workload is within the free allowance', () => {
    expect(calcCoverageRatio(0, STAFF_FREE_WORKLOAD)).toBe(1);
    expect(calcCoverageRatio(0, STAFF_FREE_WORKLOAD - 5)).toBe(1);
  });

  it('measures coverage against billable workload above the allowance', () => {
    // billable = 120 - 20 = 100; coverage 50 -> ratio 0.5
    expect(calcCoverageRatio(50, STAFF_FREE_WORKLOAD + 100)).toBeCloseTo(0.5, 6);
  });

  it('can exceed 1 when overstaffed', () => {
    expect(calcCoverageRatio(200, STAFF_FREE_WORKLOAD + 100)).toBeCloseTo(2, 6);
  });
});

describe('calcStaffEffects', () => {
  it('is neutral with no staff', () => {
    const e = calcStaffEffects(createDefaultStaff());
    expect(e).toMatchObject({
      salaryPerSecond: 0,
      coverage: 0,
      satisfactionRecoveryMultiplier: 1,
      procurementSpeedMultiplier: 1,
      auditCostMultiplier: 1,
      contractIncomeMultiplier: 1,
    });
  });

  it('raises the matching multiplier per specialty', () => {
    expect(calcStaffEffects({ noc: 5, syseng: 0, secana: 0, manager: 0 }).satisfactionRecoveryMultiplier).toBeCloseTo(1 + 5 * 0.012, 6);
    expect(calcStaffEffects({ noc: 0, syseng: 3, secana: 0, manager: 0 }).procurementSpeedMultiplier).toBeCloseTo(1 + 3 * 0.06, 6);
    expect(calcStaffEffects({ noc: 0, syseng: 0, secana: 0, manager: 4 }).contractIncomeMultiplier).toBeCloseTo(1 + 4 * 0.03, 6);
  });

  it('reduces audit cost but never below the floor', () => {
    expect(calcStaffEffects({ noc: 0, syseng: 0, secana: 2, manager: 0 }).auditCostMultiplier).toBeCloseTo(1 - 2 * 0.03, 6);
    expect(calcStaffEffects({ noc: 0, syseng: 0, secana: 1000, manager: 0 }).auditCostMultiplier).toBe(STAFF_AUDIT_COST_FLOOR);
  });
});
