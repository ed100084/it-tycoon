import {
  STAFF_AUDIT_COST_FLOOR,
  STAFF_COST_GROWTH,
  STAFF_FREE_WORKLOAD,
  STAFF_ROLE_DEFS,
  WORKLOAD_PER_CONTRACT,
} from '../config/staff.config';
import { getTotalOwnedHardware } from './hardware';
import type { ActiveContract, HardwareState, StaffRoleId, StaffState } from '../models/types';

const ROLE_BY_ID = new Map(STAFF_ROLE_DEFS.map((def) => [def.id, def]));

export function createDefaultStaff(): StaffState {
  return Object.fromEntries(STAFF_ROLE_DEFS.map((def) => [def.id, 0])) as StaffState;
}

export function calcStaffHireCost(roleId: StaffRoleId, owned: number): number {
  const def = ROLE_BY_ID.get(roleId);
  if (!def) return Infinity;
  return Math.ceil(def.hireBaseCost * Math.pow(STAFF_COST_GROWTH, Math.max(0, owned)));
}

export function calcStaffSalaryPerSecond(staff: StaffState): number {
  return STAFF_ROLE_DEFS.reduce((total, def) => total + (staff[def.id] ?? 0) * def.salaryPerSecond, 0);
}

export function calcStaffCoverage(staff: StaffState): number {
  return STAFF_ROLE_DEFS.reduce((total, def) => total + (staff[def.id] ?? 0) * def.coverage, 0);
}

export function calcStaffHeadcount(staff: StaffState): number {
  return STAFF_ROLE_DEFS.reduce((total, def) => total + (staff[def.id] ?? 0), 0);
}

/** Operational workload that needs staffing coverage. */
export function calcWorkload(hardware: Record<string, HardwareState>, contracts: ActiveContract[]): number {
  return getTotalOwnedHardware(hardware) + contracts.length * WORKLOAD_PER_CONTRACT;
}

/**
 * Coverage ratio in [0, ∞). Workload below STAFF_FREE_WORKLOAD is handled for
 * free, so a small operation is always fully covered (ratio 1). Above that,
 * ratio = coverage / billable-workload; >= 1 means fully staffed.
 */
export function calcCoverageRatio(coverage: number, workload: number): number {
  const billable = workload - STAFF_FREE_WORKLOAD;
  if (billable <= 0) return 1;
  return coverage / billable;
}

export interface StaffEffects {
  salaryPerSecond: number;
  coverage: number;
  satisfactionRecoveryMultiplier: number; // >= 1
  procurementSpeedMultiplier: number;      // >= 1
  auditCostMultiplier: number;             // <= 1, floored
  contractIncomeMultiplier: number;        // >= 1
}

export function calcStaffEffects(staff: StaffState): StaffEffects {
  const effects: StaffEffects = {
    salaryPerSecond: 0,
    coverage: 0,
    satisfactionRecoveryMultiplier: 1,
    procurementSpeedMultiplier: 1,
    auditCostMultiplier: 1,
    contractIncomeMultiplier: 1,
  };

  for (const def of STAFF_ROLE_DEFS) {
    const count = staff[def.id] ?? 0;
    if (count <= 0) continue;
    effects.salaryPerSecond += count * def.salaryPerSecond;
    effects.coverage += count * def.coverage;
    const bonus = count * def.effectPerHead;
    switch (def.effectKind) {
      case 'satisfactionRecovery':
        effects.satisfactionRecoveryMultiplier += bonus;
        break;
      case 'procurementSpeed':
        effects.procurementSpeedMultiplier += bonus;
        break;
      case 'auditCost':
        effects.auditCostMultiplier = Math.max(STAFF_AUDIT_COST_FLOOR, effects.auditCostMultiplier - bonus);
        break;
      case 'contractIncome':
        effects.contractIncomeMultiplier += bonus;
        break;
    }
  }

  return effects;
}
