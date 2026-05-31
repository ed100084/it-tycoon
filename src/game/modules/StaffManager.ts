import type {
  EntityId, GameConfig, GameDate, IEventBus, IGameModule, Money,
  StaffMember, StaffConfig, StaffRoleConfig, JobOpening, LayoffResult,
  IncidentHandlingCapacity, CertificationType, CertificationInProgress,
  StaffCertification,
} from '../core/types';
import { StaffRole, StaffStatus, ShiftMode } from '../core/types';
import { addMonths } from '../../utils/gameDate';

export const CERTIFICATION_DEFS: Record<CertificationType, { name: string; costNTD: Money; durationMonths: number; effectDescription: string }> = {
  CCNA:    { name: 'CCNA',    costNTD: 30_000,  durationMonths: 2, effectDescription: '網路維護效率 +20%' },
  AWS_SAA: { name: 'AWS SAA', costNTD: 50_000,  durationMonths: 3, effectDescription: '雲端服務品質 +15%' },
  CISSP:   { name: 'CISSP',   costNTD: 80_000,  durationMonths: 4, effectDescription: '資安防禦 +25%' },
  ITIL:    { name: 'ITIL',    costNTD: 40_000,  durationMonths: 2, effectDescription: 'SLA 達成率 +10%' },
  PMP:     { name: 'PMP',     costNTD: 60_000,  durationMonths: 3, effectDescription: '合約管理效率 +15%' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TW_SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '洪', '郭'];
const TW_GIVEN   = ['志明', '建宏', '家豪', '俊傑', '韋廷', '雅婷', '怡君', '淑芬', '佳蓉', '欣怡', '宗翰', '冠宇', '哲偉', '思穎', '芳瑜'];

let _nameSeq = 0;
function randomTWName(): string {
  const s = TW_SURNAMES[_nameSeq % TW_SURNAMES.length];
  const g = TW_GIVEN[Math.floor(_nameSeq / TW_SURNAMES.length) % TW_GIVEN.length];
  _nameSeq++;
  return `${s}${g}`;
}

function deterministicRand(seed: number): number {
  // Simple LCG for reproducibility in tests
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

let _randSeed = 1;
function seededRand(): number {
  return deterministicRand(_randSeed++);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function roleLevelFromRole(role: StaffRole): 1 | 2 | 3 | 4 | 5 {
  const map: Record<StaffRole, 1 | 2 | 3 | 4 | 5> = {
    [StaffRole.E1_NOC]:       1,
    [StaffRole.E2_SysEng]:    2,
    [StaffRole.E3_SecAna]:    3,
    [StaffRole.E3_Senior]:    3,
    [StaffRole.E4_CloudArch]: 4,
    [StaffRole.E4_AIEng]:     4,
    [StaffRole.E5_CISO]:      5,
  };
  return map[role];
}

function isSecuritySpecialist(role: StaffRole): boolean {
  return role === StaffRole.E3_SecAna || role === StaffRole.E5_CISO;
}

// ─── Internal state ───────────────────────────────────────────────────────────

interface StaffTechBonus {
  aiopsEnabled: boolean;
  trainingProgramEnabled: boolean;
  automationEnabled: boolean;
  managementCapacityBonus: number;
  promotionTimeReduction: number;
  resignationRateReduction: number;
}

interface StaffManagerState {
  staff: StaffMember[];
  jobOpenings: JobOpening[];
  shiftMode: ShiftMode;
  coverageRatio: number;
  requiredCapacityU: number;
  annualInflationRate: number;
  talentWarActive: boolean;
  recruitmentCostMod: number;
  resignationRateMod: number;
  techTreeBonuses: StaffTechBonus;
  certificationsInProgress: CertificationInProgress[];
}

// ─── Module ───────────────────────────────────────────────────────────────────

export class StaffManager implements IGameModule {
  readonly moduleId = 'StaffManager';

  private bus!: IEventBus;
  private cfg!: StaffConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };

  private state: StaffManagerState = {
    staff: [],
    jobOpenings: [],
    shiftMode: ShiftMode.DayOnly,
    coverageRatio: 1.0,
    requiredCapacityU: 0,
    annualInflationRate: 0.025,
    talentWarActive: false,
    recruitmentCostMod: 1.0,
    resignationRateMod: 1.0,
    certificationsInProgress: [],
    techTreeBonuses: {
      aiopsEnabled: false,
      trainingProgramEnabled: false,
      automationEnabled: false,
      managementCapacityBonus: 0,
      promotionTimeReduction: 0,
      resignationRateReduction: 0,
    },
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getStaff(): StaffMember[] { return [...this.state.staff]; }

  getStaffMember(staffId: EntityId): StaffMember | null {
    return this.state.staff.find(s => s.id === staffId) ?? null;
  }

  getCoverageRatio(): number { return this.state.coverageRatio; }

  getTotalManagementCapacity(): number {
    const bonus = 1 + this.state.techTreeBonuses.managementCapacityBonus;
    return this.state.staff
      .filter(s => s.status === StaffStatus.Active || s.status === StaffStatus.Assigned)
      .reduce((sum, s) => sum + s.managementCapacityU, 0) * bonus;
  }

  getIncidentHandlingCapacity(): IncidentHandlingCapacity {
    const available = this.state.staff.filter(
      s => s.status === StaffStatus.Active && s.assignedIncidentIds.length === 0,
    );
    const total = available.reduce((s, m) => s + m.handlingPower, 0);
    const sec   = available
      .filter(m => m.isSecuritySpecialist)
      .reduce((s, m) => s + m.handlingPower * 2, 0);
    return {
      totalHandlingPower: total,
      availableForIncidents: total,
      securityHandlingPower: sec,
      estimatedResolutionMultiplier: 1 + total,
    };
  }

  postJobOpening(role: StaffRole): JobOpening {
    const roleCfg = this.cfg.roles[role];
    const durMonths = roleCfg.recruitmentMonths;
    const availableDate = addMonths(this.currentDate, Math.ceil(durMonths));
    const opening: JobOpening = {
      id: crypto.randomUUID(),
      role,
      postedDate: { ...this.currentDate },
      recruitmentDurationMonths: durMonths,
      availableDate,
      status: 'recruiting',
      candidateName: randomTWName(),
    };
    this.state.jobOpenings.push(opening);
    this.bus.publish({
      type: 'staff.job_opening_created',
      payload: opening,
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    return opening;
  }

  hire(openingId: EntityId): StaffMember | null {
    const opening = this.state.jobOpenings.find(o => o.id === openingId && o.status === 'interview_ready');
    if (!opening) return null;
    opening.status = 'filled';

    const roleCfg = this.cfg.roles[opening.role];
    const qualityScore = clamp(0.95 + (seededRand() - 0.5) * 0.2, 0.9, 1.1);
    const member: StaffMember = {
      id: crypto.randomUUID(),
      name: opening.candidateName,
      role: opening.role,
      level: roleLevelFromRole(opening.role),
      monthlySalaryNTD: Math.round(roleCfg.baseSalaryNTD * qualityScore),
      hireDate: { ...this.currentDate },
      monthsInService: 0,
      qualityScore,
      status: StaffStatus.InTraining,
      promotionEligibleDate: addMonths(this.currentDate, roleCfg.promotionRequirements.minMonths),
      promotionCostNTD: roleCfg.promotionRequirements.cost,
      managementCapacityU: roleCfg.managementCapacityU,
      handlingPower: roleCfg.handlingPower,
      isSecuritySpecialist: isSecuritySpecialist(opening.role),
      assignedIncidentIds: [],
      assignedRegion: null,
      trainingCompletionDate: addMonths(this.currentDate, 1),
      satisfactionScore: 80,
      morale: 80,
      certifications: [],
      mentorId: null,
      skillLevel: roleLevelFromRole(opening.role),
    };
    this.state.staff.push(member);
    this.recalcCoverage();
    this.bus.publish({ type: 'staff.hired', payload: member, source: this.moduleId, gameDate: this.currentDate });
    return member;
  }

  layoff(staffId: EntityId): LayoffResult | null {
    const idx = this.state.staff.findIndex(s => s.id === staffId);
    if (idx === -1) return null;
    const member = this.state.staff[idx];
    const yearsInService = member.monthsInService / 12;
    const severancePay = Math.round(member.monthlySalaryNTD * this.cfg.severanceMonthsPerYear * Math.max(1, yearsInService));
    this.state.staff.splice(idx, 1);
    this.recalcCoverage();
    const result: LayoffResult = { staffId, severancePay, date: { ...this.currentDate } };
    this.bus.publish({ type: 'staff.laid_off', payload: result, source: this.moduleId, gameDate: this.currentDate });
    return result;
  }

  promoteStaff(staffId: EntityId): boolean {
    const member = this.state.staff.find(s => s.id === staffId);
    if (!member) return false;
    const roleCfg = this.cfg.roles[member.role];
    const eligible = member.monthsInService >= roleCfg.promotionRequirements.minMonths;
    if (!eligible) return false;
    const fromRole = member.role;
    member.monthlySalaryNTD = Math.round(member.monthlySalaryNTD * 1.15);
    member.managementCapacityU = Math.round(member.managementCapacityU * 1.2);
    member.level = Math.min(5, (member.level + 1)) as 1|2|3|4|5;
    this.bus.publish({
      type: 'staff.promoted',
      payload: { staffId, fromRole, toRole: member.role },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    return true;
  }

  setShiftMode(mode: ShiftMode): void {
    this.state.shiftMode = mode;
    if (mode === ShiftMode.AIOps) {
      this.state.techTreeBonuses.aiopsEnabled = true;
    }
    this.bus.publish({
      type: 'staff.coverage_changed',
      payload: { ratio: this.state.coverageRatio, mode },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  getShiftMode(): ShiftMode { return this.state.shiftMode; }

  /** On-call monthly allowance = headcount × NT$5,000 */
  getOnCallAllowance(): number {
    const activeCount = this.state.staff.filter(
      s => s.status === StaffStatus.Active || s.status === StaffStatus.Assigned,
    ).length;
    return activeCount * 5_000;
  }

  /** Night-time SLA response multiplier by shift mode */
  getNightResponseMultiplier(): number {
    switch (this.state.shiftMode) {
      case ShiftMode.DayOnly:    return 3.0;
      case ShiftMode.TwoShift:   return 1.3;
      case ShiftMode.ThreeShift: return 1.0;
      case ShiftMode.OnCall:     return 1.5;
      case ShiftMode.AIOps:      return 1.0;
    }
  }

  /** Staff headcount multiplier required for the shift mode */
  getStaffingMultiplier(): number {
    switch (this.state.shiftMode) {
      case ShiftMode.DayOnly:    return 1.0;
      case ShiftMode.TwoShift:   return 1.8;
      case ShiftMode.ThreeShift: return 2.5;
      case ShiftMode.OnCall:     return 1.2;
      case ShiftMode.AIOps:      return 1.1;
    }
  }

  calculateMonthlyPayroll(): Money {
    return this.state.staff.reduce((sum, s) => {
      if (s.status === StaffStatus.InRecruitment) return sum;
      return sum + Math.round(s.monthlySalaryNTD * this.cfg.benefitMultiplier);
    }, 0);
  }

  // ── Certification system ─────────────────────────────────────────────────

  getCertificationsInProgress(): CertificationInProgress[] {
    return [...this.state.certificationsInProgress];
  }

  sendForCertification(staffId: EntityId, type: CertificationType): boolean {
    const member = this.state.staff.find(s => s.id === staffId);
    if (!member) return false;
    if (member.certifications.some(c => c.type === type)) return false;
    if (this.state.certificationsInProgress.some(c => c.staffId === staffId)) return false;
    const def = CERTIFICATION_DEFS[type];
    const entry: CertificationInProgress = {
      staffId,
      type,
      startedAt: { ...this.currentDate },
      completesAt: addMonths(this.currentDate, def.durationMonths),
      costNTD: def.costNTD,
    };
    this.state.certificationsInProgress.push(entry);
    this.bus.publish({
      type: 'staff.certification_started',
      payload: { staffId, name: member.name, certType: type, cost: def.costNTD },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    return true;
  }

  // ── Morale system ────────────────────────────────────────────────────────

  payBonus(): void {
    const totalPayroll = this.calculateMonthlyPayroll();
    for (const member of this.state.staff.filter(s => s.status !== StaffStatus.InRecruitment)) {
      member.morale = Math.min(100, (member.morale ?? 80) + 15);
    }
    this.bus.publish({
      type: 'staff.bonus_paid',
      payload: { totalCost: totalPayroll, moraleBonus: 15 },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  // ── Mentor system ────────────────────────────────────────────────────────

  setMentor(juniorId: EntityId, mentorId: EntityId | null): boolean {
    const junior = this.state.staff.find(s => s.id === juniorId);
    if (!junior) return false;
    if (mentorId) {
      const mentor = this.state.staff.find(s => s.id === mentorId);
      if (!mentor || mentor.level < 3) return false;
    }
    junior.mentorId = mentorId;
    return true;
  }

  getAvailableEngineers(): StaffMember[] {
    return this.state.staff
      .filter(s => s.status === StaffStatus.Active && s.assignedIncidentIds.length === 0)
      .sort((a, b) => b.handlingPower - a.handlingPower);
  }

  assignToIncident(staffId: EntityId, incidentId: EntityId): void {
    const member = this.state.staff.find(s => s.id === staffId);
    if (member && !member.assignedIncidentIds.includes(incidentId)) {
      member.assignedIncidentIds.push(incidentId);
      member.status = StaffStatus.Assigned;
    }
  }

  releaseFromIncident(staffId: EntityId, incidentId: EntityId): void {
    const member = this.state.staff.find(s => s.id === staffId);
    if (member) {
      member.assignedIncidentIds = member.assignedIncidentIds.filter(id => id !== incidentId);
      if (member.assignedIncidentIds.length === 0) {
        member.status = StaffStatus.Active;
      }
    }
  }

  getJobOpenings(): JobOpening[] { return [...this.state.jobOpenings]; }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.staff ?? this.defaultStaffConfig();
    this.currentDate = { ...config.time.startDate };

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
      this.onMonthEnd();
    }, this.moduleId);

    bus.subscribe('time.year_end', () => {
      this.onYearEnd();
    }, this.moduleId);

    bus.subscribe('hardware.installed', () => {
      this.recalcCoverage();
    }, this.moduleId);

    bus.subscribe('hardware.removed', () => {
      this.recalcCoverage();
    }, this.moduleId);

    bus.subscribe('techtree.research_completed', (e) => {
      this.onTechTreeCompleted(e.payload as { nodeId: string; effects: Array<{ type: string; value: number }> });
    }, this.moduleId);

    bus.subscribe('timeline.talent_war', (e) => {
      const p = e.payload as { durationMonths: number };
      this.state.talentWarActive = true;
      this.state.resignationRateMod = 3.0;
      setTimeout(() => {
        this.state.talentWarActive = false;
        this.state.resignationRateMod = 1.0;
      }, p.durationMonths * 1000);
    }, this.moduleId);

    bus.subscribe('finance.consecutive_loss', () => {
      this.state.resignationRateMod = Math.min(this.state.resignationRateMod * 2, 4.0);
    }, this.moduleId);
  }

  tick(_deltaMs: number): void { /* no continuous computation needed */ }

  serialize(): Record<string, unknown> {
    return {
      staff: this.state.staff,
      jobOpenings: this.state.jobOpenings,
      shiftMode: this.state.shiftMode,
      coverageRatio: this.state.coverageRatio,
      requiredCapacityU: this.state.requiredCapacityU,
      annualInflationRate: this.state.annualInflationRate,
      talentWarActive: this.state.talentWarActive,
      recruitmentCostMod: this.state.recruitmentCostMod,
      resignationRateMod: this.state.resignationRateMod,
      techTreeBonuses: this.state.techTreeBonuses,
      certificationsInProgress: this.state.certificationsInProgress,
      currentDate: this.currentDate,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.staff         = (saved.staff as StaffMember[]) ?? [];
    this.state.jobOpenings   = (saved.jobOpenings as JobOpening[]) ?? [];
    this.state.shiftMode     = (saved.shiftMode as ShiftMode) ?? ShiftMode.DayOnly;
    this.state.coverageRatio = (saved.coverageRatio as number) ?? 1.0;
    this.state.requiredCapacityU = (saved.requiredCapacityU as number) ?? 0;
    this.state.annualInflationRate = (saved.annualInflationRate as number) ?? 0.025;
    this.state.talentWarActive = (saved.talentWarActive as boolean) ?? false;
    this.state.recruitmentCostMod = (saved.recruitmentCostMod as number) ?? 1.0;
    this.state.resignationRateMod = (saved.resignationRateMod as number) ?? 1.0;
    this.state.certificationsInProgress = (saved.certificationsInProgress as CertificationInProgress[]) ?? [];
    if (saved.techTreeBonuses) {
      Object.assign(this.state.techTreeBonuses, saved.techTreeBonuses);
    }
    if (saved.currentDate) {
      this.currentDate = saved.currentDate as GameDate;
    }
    // Back-fill new fields for saves that pre-date v3.1
    for (const s of this.state.staff) {
      if (s.morale === undefined) s.morale = 80;
      if (!s.certifications) s.certifications = [];
      if (s.mentorId === undefined) s.mentorId = null;
      if (s.skillLevel === undefined) s.skillLevel = s.level;
    }
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      staff: this.state.staff,
      jobOpenings: this.state.jobOpenings,
      shiftMode: this.state.shiftMode,
      coverageRatio: this.state.coverageRatio,
      requiredCapacityU: this.state.requiredCapacityU,
      monthlyPayroll: this.calculateMonthlyPayroll(),
      incidentHandlingCapacity: this.getIncidentHandlingCapacity(),
    });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private onMonthEnd(): void {
    // Advance job openings
    for (const opening of this.state.jobOpenings) {
      if (opening.status === 'recruiting') {
        const d = opening.availableDate;
        if (
          this.currentDate.year > d.year ||
          (this.currentDate.year === d.year && this.currentDate.month >= d.month)
        ) {
          opening.status = 'interview_ready';
        }
      }
    }

    // Advance training
    for (const member of this.state.staff) {
      if (member.status === StaffStatus.InTraining && member.trainingCompletionDate) {
        const tc = member.trainingCompletionDate;
        if (
          this.currentDate.year > tc.year ||
          (this.currentDate.year === tc.year && this.currentDate.month >= tc.month)
        ) {
          member.status = StaffStatus.Active;
          member.trainingCompletionDate = null;
        }
      }
      if (member.status !== StaffStatus.InRecruitment) {
        member.monthsInService++;
      }
    }

    // Payroll
    const totalPayroll = this.calculateMonthlyPayroll();
    const breakdown = this.state.staff
      .filter(s => s.status !== StaffStatus.InRecruitment)
      .map(s => ({ staffId: s.id, name: s.name, amount: Math.round(s.monthlySalaryNTD * this.cfg.benefitMultiplier) }));
    this.bus.publish({
      type: 'staff.salary_due',
      payload: { totalAmount: totalPayroll, breakdown },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    // On-call allowance + morale penalty
    if (this.state.shiftMode === ShiftMode.OnCall) {
      const allowance = this.getOnCallAllowance();
      if (allowance > 0) {
        this.bus.publish({
          type: 'finance.expense_requested',
          payload: {
            date: this.currentDate,
            category: 'STAFF_SALARY',
            amount: allowance,
            isCashExpense: true,
            description: 'On-Call 值班津貼',
          },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
      // Morale penalty for on-call stress
      for (const member of this.state.staff.filter(s => s.status !== StaffStatus.InRecruitment)) {
        member.morale = Math.max(0, (member.morale ?? 80) - 5);
      }
    }

    // Certification completion
    this.advanceCertifications();

    // Morale drift
    this.updateMorale();

    // Mentor skill growth
    this.applyMentorGrowth();

    // Resignation roll
    this.performResignationRoll();

    // Coverage update
    this.recalcCoverage();
  }

  private advanceCertifications(): void {
    const completed: CertificationInProgress[] = [];
    for (const cert of this.state.certificationsInProgress) {
      const d = cert.completesAt;
      if (
        this.currentDate.year > d.year ||
        (this.currentDate.year === d.year && this.currentDate.month >= d.month)
      ) {
        completed.push(cert);
      }
    }
    for (const cert of completed) {
      this.state.certificationsInProgress = this.state.certificationsInProgress.filter(c => c !== cert);
      const member = this.state.staff.find(s => s.id === cert.staffId);
      if (member && !member.certifications.some(c => c.type === cert.type)) {
        const earned: StaffCertification = { type: cert.type, earnedAt: { ...this.currentDate } };
        member.certifications.push(earned);
        member.morale = Math.min(100, (member.morale ?? 80) + 10);
        this.bus.publish({
          type: 'staff.certification_completed',
          payload: { staffId: cert.staffId, name: member.name, certType: cert.type },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }
  }

  private updateMorale(): void {
    for (const member of this.state.staff.filter(s => s.status !== StaffStatus.InRecruitment)) {
      const morale = member.morale ?? 80;
      // Natural drift toward 70
      const target = 70;
      const delta = (target - morale) * 0.05;
      member.morale = Math.max(0, Math.min(100, morale + delta));
    }
  }

  private applyMentorGrowth(): void {
    for (const member of this.state.staff) {
      if (!member.mentorId) continue;
      const mentor = this.state.staff.find(s => s.id === member.mentorId);
      if (!mentor || mentor.level < 3) { member.mentorId = null; continue; }
      // Mentored staff gain skill faster — raise qualityScore slightly
      member.qualityScore = Math.min(1.5, member.qualityScore + 0.002);
    }
  }

  private performResignationRoll(): void {
    const baseMonthlyRate = this.cfg.baseAnnualResignationRate / 12;
    for (const member of [...this.state.staff]) {
      if (member.status === StaffStatus.InRecruitment || member.status === StaffStatus.ResignPending) continue;
      let rate = baseMonthlyRate
        * this.state.resignationRateMod
        * (this.state.techTreeBonuses.resignationRateReduction > 0
          ? (1 - this.state.techTreeBonuses.resignationRateReduction)
          : 1);
      // Morale effects
      const morale = member.morale ?? 80;
      if (morale < 30) rate *= 3;
      else if (morale > 80) rate *= 0.5;
      // Talent war
      if (this.state.talentWarActive) rate *= 3;
      if (seededRand() < rate) {
        member.status = StaffStatus.ResignPending;
        // Remove after 1 month (simulate notice period)
        const idx = this.state.staff.findIndex(s => s.id === member.id);
        if (idx !== -1) {
          this.state.staff.splice(idx, 1);
          this.bus.publish({
            type: 'staff.resigned',
            payload: { staffId: member.id, role: member.role, name: member.name },
            source: this.moduleId,
            gameDate: this.currentDate,
          });
        }
      }
    }
  }

  private onYearEnd(): void {
    // Annual salary inflation
    for (const member of this.state.staff) {
      member.monthlySalaryNTD = Math.round(member.monthlySalaryNTD * (1 + this.state.annualInflationRate));
    }
  }

  private recalcCoverage(): void {
    const total = this.getTotalManagementCapacity();
    const required = Math.max(1, this.state.requiredCapacityU);
    const ratio = total / required;
    this.state.coverageRatio = ratio;

    this.bus.publish({
      type: 'staff.coverage_changed',
      payload: { ratio, mode: this.state.shiftMode },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    const thresholds = this.cfg.coverageRatioThresholds;
    if (ratio < thresholds.optimal) {
      const debuffs: string[] = [];
      if (ratio < thresholds.severe) debuffs.push('sla_penalty_severe', 'rep_penalty_severe');
      else if (ratio < thresholds.critical) debuffs.push('sla_penalty_critical', 'rep_penalty_critical');
      else if (ratio < thresholds.warning) debuffs.push('sla_penalty_warning', 'rep_penalty_warning');
      this.bus.publish({
        type: 'staff.insufficient_coverage',
        payload: { ratio, debuffs },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }
  }

  private onTechTreeCompleted(payload: { nodeId: string; effects: Array<{ type: string; value: number }> }): void {
    for (const eff of payload.effects ?? []) {
      switch (eff.type) {
        case 'MGMT_CAPACITY_BONUS':
          this.state.techTreeBonuses.managementCapacityBonus += eff.value;
          break;
        case 'RESIGNATION_REDUCTION':
          this.state.techTreeBonuses.resignationRateReduction += eff.value;
          break;
        case 'PROMOTION_TIME_REDUCTION':
          this.state.techTreeBonuses.promotionTimeReduction += eff.value;
          break;
      }
    }
    if (payload.nodeId === 'AIOPS_MONITORING') this.state.techTreeBonuses.aiopsEnabled = true;
    if (payload.nodeId === 'TALENT_PROGRAM') this.state.techTreeBonuses.trainingProgramEnabled = true;
    if (payload.nodeId === 'AUTOMATION_OPS') this.state.techTreeBonuses.automationEnabled = true;
  }

  private defaultStaffConfig(): StaffConfig {
    // Minimal fallback — real values come from default.config
    const makeRole = (sal: Money, cap: number, hp: number, rec: number, promo: { minMonths: number; cost: Money }, year: number): StaffRoleConfig => ({
      baseSalaryNTD: sal, managementCapacityU: cap, handlingPower: hp,
      recruitmentMonths: rec, promotionRequirements: promo, unlockYear: year,
    });
    return {
      roles: {
        [StaffRole.E1_NOC]:       makeRole(38_000,  10, 0.5, 0.5, { minMonths: 12, cost: 50_000  }, 2000),
        [StaffRole.E2_SysEng]:    makeRole(55_000,  20, 1.0, 1,   { minMonths: 18, cost: 80_000  }, 2000),
        [StaffRole.E3_SecAna]:    makeRole(72_000,  30, 2.0, 1.5, { minMonths: 24, cost: 120_000 }, 2001),
        [StaffRole.E3_Senior]:    makeRole(75_000,  35, 2.0, 1.5, { minMonths: 24, cost: 120_000 }, 2001),
        [StaffRole.E4_CloudArch]: makeRole(110_000, 50, 4.0, 2,   { minMonths: 36, cost: 200_000 }, 2005),
        [StaffRole.E4_AIEng]:     makeRole(120_000, 40, 4.0, 2,   { minMonths: 36, cost: 200_000 }, 2018),
        [StaffRole.E5_CISO]:      makeRole(180_000, 80, 8.0, 3,   { minMonths: 48, cost: 400_000 }, 2004),
      },
      benefitMultiplier: 1.3,
      baseAnnualResignationRate: 0.10,
      salaryInflationRate: 0.025,
      coverageRatioThresholds: { optimal: 1.0, warning: 0.7, critical: 0.5, severe: 0.3 },
      interviewQuestionCount: 3,
      severanceMonthsPerYear: 1,
    };
  }
}

// Needed by uiStore type imports
export type { StaffRoleConfig };
