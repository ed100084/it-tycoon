import type { StaffRoleId } from '../models/types';

/** Which game-system friction a role reduces (one specialty per role). */
export type StaffEffectKind =
  | 'satisfactionRecovery' // multiplies the passive satisfaction recovery rate
  | 'procurementSpeed'     // multiplies procurement speed (faster lead times)
  | 'auditCost'            // reduces the cost of audit responses
  | 'contractIncome';      // multiplies recurring contract payouts

export interface StaffRoleDefinition {
  id: StaffRoleId;
  name: string;
  nameZh: string;
  hireBaseCost: number;     // CF for the first hire (scales by STAFF_COST_GROWTH)
  salaryPerSecond: number;  // recurring CF drain per head while employed
  coverage: number;         // workload units a single head can cover
  effectKind: StaffEffectKind;
  effectPerHead: number;    // contribution per head (see calcStaffEffects)
  description: string;
}

export const STAFF_COST_GROWTH = 1.18;

export const STAFF_ROLE_DEFS: StaffRoleDefinition[] = [
  {
    id: 'noc',
    name: 'NOC Operator',
    nameZh: 'NOC 維運工程師',
    hireBaseCost: 4_000,
    salaryPerSecond: 2,
    coverage: 6,
    effectKind: 'satisfactionRecovery',
    effectPerHead: 0.012,
    description: '24x7 監控值班，穩定營運、加快滿意度回復。',
  },
  {
    id: 'syseng',
    name: 'Systems Engineer',
    nameZh: '系統工程師',
    hireBaseCost: 40_000,
    salaryPerSecond: 12,
    coverage: 18,
    effectKind: 'procurementSpeed',
    effectPerHead: 0.06,
    description: '負責部署與自動化，縮短採購交付前置時間。',
  },
  {
    id: 'secana',
    name: 'Security Analyst',
    nameZh: '資安分析師',
    hireBaseCost: 400_000,
    salaryPerSecond: 80,
    coverage: 45,
    effectKind: 'auditCost',
    effectPerHead: 0.03,
    description: '預先備妥稽核證據與控制措施，降低稽核應對成本。',
  },
  {
    id: 'manager',
    name: 'Operations Manager',
    nameZh: '維運經理',
    hireBaseCost: 4_000_000,
    salaryPerSecond: 500,
    coverage: 120,
    effectKind: 'contractIncome',
    effectPerHead: 0.03,
    description: '經營客戶關係與服務品質，提升合約收入。',
  },
];

// Workload the founder/automation handles for free before staffing pressure starts.
export const STAFF_FREE_WORKLOAD = 20;
// Each active contract adds this much to operational workload.
export const WORKLOAD_PER_CONTRACT = 3;
// Satisfaction lost per second at zero coverage (scaled by the shortfall ratio).
export const STAFF_UNDERSTAFFED_PENALTY = 0.08;
// Audit-cost multiplier can never drop below this floor, however many analysts.
export const STAFF_AUDIT_COST_FLOOR = 0.2;
