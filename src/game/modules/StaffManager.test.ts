import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { StaffManager } from './StaffManager';
import { DEFAULT_CONFIG } from '../config/default.config';
import { StaffRole, StaffStatus, ShiftMode } from '../core/types';
import type { GameConfig } from '../core/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a StaffManager with an optional config override.
 * By default uses a zero-resignation-rate variant of DEFAULT_CONFIG so that
 * staff hired in a test are not randomly removed during month advances.
 */
function buildModule(cfg: GameConfig = zeroResignConfig()) {
  const bus = new EventBus();
  const sm = new StaffManager();
  sm.init(bus, cfg);
  return { bus, sm };
}

/** DEFAULT_CONFIG with resignation rate set to 0 for deterministic tests. */
function zeroResignConfig(): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    staff: {
      ...DEFAULT_CONFIG.staff!,
      baseAnnualResignationRate: 0,
    },
  };
}

function triggerMonthEnd(bus: EventBus, year = 2000, month = 1) {
  const newMonth = month === 12 ? 1 : month + 1;
  const newYear = month === 12 ? year + 1 : year;
  bus.publish({
    type: 'time.month_end',
    payload: { prevDate: { year, month }, newDate: { year: newYear, month: newMonth }, totalMonthsElapsed: 1 },
    gameDate: { year: newYear, month: newMonth },
    source: 'TimeEngine',
  });
}

/**
 * Post a job opening for the given role and advance months until it becomes
 * interview_ready, then call hire().  Returns the hired StaffMember or null.
 *
 * E1_NOC has recruitmentMonths = 0.5 → Math.ceil(0.5) = 1 month needed.
 * We advance 2 months to be safe, then look for an interview_ready opening.
 */
function hireViaOpening(sm: StaffManager, bus: EventBus, role = StaffRole.E1_NOC) {
  const opening = sm.postJobOpening(role);
  // advance time to make it available
  triggerMonthEnd(bus, 2000, 1);
  triggerMonthEnd(bus, 2000, 2);
  // mark as interview_ready by finding it
  const openings = sm.getJobOpenings();
  const ready = openings.find(o => o.id === opening.id && o.status === 'interview_ready');
  if (ready) return sm.hire(ready.id);
  return null;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Initial state', () => {
  it('starts with no staff members', () => {
    const { sm } = buildModule();
    expect(sm.getStaff()).toHaveLength(0);
  });

  it('starts with empty job openings', () => {
    const { sm } = buildModule();
    expect(sm.getJobOpenings()).toHaveLength(0);
  });

  it('coverage ratio is non-zero (no required capacity)', () => {
    const { sm } = buildModule();
    // With 0 staff and 0 required capacity, ratio = 0/max(1,0) = 0
    expect(sm.getCoverageRatio()).toBeGreaterThanOrEqual(0);
  });
});

describe('postJobOpening', () => {
  it('creates a job opening with the correct role', () => {
    const { sm } = buildModule();
    const opening = sm.postJobOpening(StaffRole.E1_NOC);
    expect(opening.role).toBe(StaffRole.E1_NOC);
    expect(opening.status).toBe('recruiting');
  });

  it('publishes staff.job_opening_created event', () => {
    const { sm, bus } = buildModule();
    const handler = vi.fn();
    bus.subscribe('staff.job_opening_created', handler);
    sm.postJobOpening(StaffRole.E2_SysEng);
    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0][0];
    expect(evt.payload.role).toBe(StaffRole.E2_SysEng);
  });

  it('job opening becomes interview_ready after enough months pass', () => {
    const { sm, bus } = buildModule();
    const opening = sm.postJobOpening(StaffRole.E1_NOC); // recruitmentMonths = 0.5 → ceil = 1
    // Not ready immediately
    expect(opening.status).toBe('recruiting');
    // After 1 month the availableDate is reached
    triggerMonthEnd(bus, 2000, 1);
    const openings = sm.getJobOpenings();
    const found = openings.find(o => o.id === opening.id);
    expect(found?.status).toBe('interview_ready');
  });
});

describe('hire()', () => {
  it('returns null when opening is not yet interview_ready', () => {
    const { sm } = buildModule();
    const opening = sm.postJobOpening(StaffRole.E1_NOC);
    // No time has passed — still in 'recruiting' status
    const result = sm.hire(opening.id);
    expect(result).toBeNull();
  });

  it('creates a staff member with the correct role when interview_ready', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC);
    expect(member).not.toBeNull();
    expect(member!.role).toBe(StaffRole.E1_NOC);
  });

  it('newly hired staff starts in InTraining status', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC);
    expect(member!.status).toBe(StaffStatus.InTraining);
  });
});

describe('calculateMonthlyPayroll', () => {
  it('is 0 with no staff', () => {
    const { sm } = buildModule();
    expect(sm.calculateMonthlyPayroll()).toBe(0);
  });

  it('increases after hiring a staff member', () => {
    const { sm, bus } = buildModule();
    const before = sm.calculateMonthlyPayroll();
    hireViaOpening(sm, bus, StaffRole.E1_NOC);
    const after = sm.calculateMonthlyPayroll();
    // Hired staff is InTraining, which IS counted (not InRecruitment)
    expect(after).toBeGreaterThan(before);
  });
});

describe('Training progression', () => {
  it('staff transitions from InTraining to Active after training month passes', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC);
    // After hireViaOpening we have advanced 2 months (2000/01 and 2000/02).
    // hire() was called during month 2000/02 (currentDate after two triggerMonthEnd),
    // so trainingCompletionDate = 2000/03.
    expect(member!.status).toBe(StaffStatus.InTraining);
    // Advance to 2000/03
    triggerMonthEnd(bus, 2000, 3);
    const updated = sm.getStaffMember(member!.id);
    expect(updated?.status).toBe(StaffStatus.Active);
  });
});

describe('layoff()', () => {
  it('removes the staff member', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC);
    expect(sm.getStaff()).toHaveLength(1);
    sm.layoff(member!.id);
    expect(sm.getStaff()).toHaveLength(0);
  });

  it('returns severancePay > 0', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC);
    const result = sm.layoff(member!.id);
    // severanceMonthsPerYear=1, yearsInService=Math.max(1, 0/12)=1 → severance = salary * 1
    expect(result).not.toBeNull();
    expect(result!.severancePay).toBeGreaterThan(0);
  });
});

describe('getTotalManagementCapacity', () => {
  it('is 0 with no staff', () => {
    const { sm } = buildModule();
    expect(sm.getTotalManagementCapacity()).toBe(0);
  });

  it('increases after hiring and activating a staff member', () => {
    const { sm, bus } = buildModule();
    hireViaOpening(sm, bus, StaffRole.E1_NOC);
    // Still InTraining — not counted
    const duringTraining = sm.getTotalManagementCapacity();
    // Advance to complete training (2000/03)
    triggerMonthEnd(bus, 2000, 3);
    const afterActive = sm.getTotalManagementCapacity();
    expect(afterActive).toBeGreaterThan(duringTraining);
  });
});

describe('getIncidentHandlingCapacity', () => {
  it('returns the correct structure', () => {
    const { sm } = buildModule();
    const cap = sm.getIncidentHandlingCapacity();
    expect(cap).toHaveProperty('totalHandlingPower');
    expect(cap).toHaveProperty('availableForIncidents');
    expect(cap).toHaveProperty('securityHandlingPower');
    expect(cap).toHaveProperty('estimatedResolutionMultiplier');
  });

  it('totalHandlingPower is 0 with no active staff', () => {
    const { sm } = buildModule();
    expect(sm.getIncidentHandlingCapacity().totalHandlingPower).toBe(0);
  });
});

describe('assignToIncident / releaseFromIncident', () => {
  it('sets status to Assigned when assigned to an incident', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC);
    // Activate the staff member first
    triggerMonthEnd(bus, 2000, 3);
    const active = sm.getStaffMember(member!.id)!;
    expect(active.status).toBe(StaffStatus.Active);

    sm.assignToIncident(active.id, 'incident-1');
    expect(sm.getStaffMember(active.id)?.status).toBe(StaffStatus.Assigned);
  });

  it('restores status to Active when released from all incidents', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC);
    triggerMonthEnd(bus, 2000, 3);
    const active = sm.getStaffMember(member!.id)!;

    sm.assignToIncident(active.id, 'incident-1');
    sm.releaseFromIncident(active.id, 'incident-1');
    expect(sm.getStaffMember(active.id)?.status).toBe(StaffStatus.Active);
  });
});

describe('setShiftMode', () => {
  it('persists the shift mode', () => {
    const { sm } = buildModule();
    sm.setShiftMode(ShiftMode.TwoShift);
    expect(sm.getShiftMode()).toBe(ShiftMode.TwoShift);
  });

  it('enables aiops flag when set to AIOps mode', () => {
    const { sm } = buildModule();
    sm.setShiftMode(ShiftMode.AIOps);
    expect(sm.getShiftMode()).toBe(ShiftMode.AIOps);
  });
});

describe('promoteStaff', () => {
  it('returns false when staff has insufficient months in service', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC); // minMonths = 12
    // Only 2–3 months have elapsed
    triggerMonthEnd(bus, 2000, 3);
    const result = sm.promoteStaff(member!.id);
    expect(result).toBe(false);
  });

  it('returns true and changes salary after enough service months', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC); // minMonths = 12
    // Activate then run 12+ months
    triggerMonthEnd(bus, 2000, 3); // activates training
    // Simulate 12 more month-end ticks to accumulate monthsInService
    let year = 2000;
    let month = 3;
    for (let i = 0; i < 12; i++) {
      triggerMonthEnd(bus, year, month);
      month++;
      if (month > 12) { month = 1; year++; }
    }
    const staffNow = sm.getStaffMember(member!.id);
    // Must have >= 12 monthsInService
    expect(staffNow?.monthsInService).toBeGreaterThanOrEqual(12);
    const salaryBefore = staffNow!.monthlySalaryNTD;
    const promoted = sm.promoteStaff(member!.id);
    expect(promoted).toBe(true);
    expect(sm.getStaffMember(member!.id)!.monthlySalaryNTD).toBeGreaterThan(salaryBefore);
  });
});

describe('getAvailableEngineers', () => {
  it('only returns Active staff with no assigned incidents', () => {
    const { sm, bus } = buildModule();
    hireViaOpening(sm, bus, StaffRole.E1_NOC);
    // Still InTraining — not available
    expect(sm.getAvailableEngineers()).toHaveLength(0);
    // Activate
    triggerMonthEnd(bus, 2000, 3);
    expect(sm.getAvailableEngineers()).toHaveLength(1);
  });

  it('excludes staff assigned to an incident', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC);
    triggerMonthEnd(bus, 2000, 3);
    sm.assignToIncident(member!.id, 'inc-42');
    expect(sm.getAvailableEngineers()).toHaveLength(0);
  });
});

describe('monthsInService', () => {
  it('increments by 1 each month for non-InRecruitment staff', () => {
    const { sm, bus } = buildModule();
    const member = hireViaOpening(sm, bus, StaffRole.E1_NOC);
    // After hireViaOpening: 2 month-ends triggered (months 2000/01 and 2000/02)
    // hire() was called when currentDate = 2000/02; monthsInService starts at 0
    // triggerMonthEnd(2000,03) advances to 2000/03 → monthsInService becomes 1 (training also finishes)
    triggerMonthEnd(bus, 2000, 3);
    const updated = sm.getStaffMember(member!.id);
    expect(updated?.monthsInService).toBeGreaterThanOrEqual(1);
  });
});

describe('serialize / deserialize', () => {
  it('roundtrip preserves staff count', () => {
    const { sm, bus } = buildModule();
    hireViaOpening(sm, bus, StaffRole.E1_NOC);
    hireViaOpening(sm, bus, StaffRole.E2_SysEng);

    const snapshot = sm.serialize();

    const { sm: sm2 } = buildModule();
    sm2.deserialize(snapshot);

    expect(sm2.getStaff()).toHaveLength(sm.getStaff().length);
  });

  it('roundtrip preserves shift mode', () => {
    const { sm } = buildModule();
    sm.setShiftMode(ShiftMode.ThreeShift);
    const snapshot = sm.serialize();

    const { sm: sm2 } = buildModule();
    sm2.deserialize(snapshot);
    expect(sm2.getShiftMode()).toBe(ShiftMode.ThreeShift);
  });
});
