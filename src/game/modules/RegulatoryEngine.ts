import type {
  GameConfig,
  GameDate,
  IEventBus,
  IGameModule,
  RegulationDef,
  RegulatoryAuditRecord,
  RegulatoryConfig,
  RegulatoryState,
} from '../core/types';
import {
  ExpenseCategory,
  RegComplianceStatus,
  RegulationId,
} from '../core/types';
import { addMonths, gameDateEquals } from '../../utils/gameDate';

// ─── Seeded random ─────────────────────────────────────────────────────────────

let _seed = 251;
function sr(): number {
  const x = Math.sin(_seed++ * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ─── Regulation definitions ────────────────────────────────────────────────────

const REGULATION_DEFS: Record<RegulationId, RegulationDef> = {
  [RegulationId.FSC_InfoSec]: {
    id:                        RegulationId.FSC_InfoSec,
    name:                      '金管會資安管理規定',
    effectiveYear:             2005,
    complianceCostNTD:         500_000,
    annualMaintenanceCostNTD:  120_000,
    penaltyNTD:                1_000_000,
    reputationPenalty:         5,
    description:               '金融監督管理委員會資訊安全管理規定',
  },
  [RegulationId.PersonalData]: {
    id:                        RegulationId.PersonalData,
    name:                      '個人資料保護法',
    effectiveYear:             2012,
    complianceCostNTD:         800_000,
    annualMaintenanceCostNTD:  200_000,
    penaltyNTD:                2_000_000,
    reputationPenalty:         8,
    description:               '個人資料保護法合規要求',
  },
  [RegulationId.GDPR]: {
    id:                        RegulationId.GDPR,
    name:                      'GDPR',
    effectiveYear:             2018,
    complianceCostNTD:         1_500_000,
    annualMaintenanceCostNTD:  400_000,
    penaltyNTD:                5_000_000,
    reputationPenalty:         10,
    description:               '歐盟一般資料保護規則',
  },
  [RegulationId.CriticalInfra]: {
    id:                        RegulationId.CriticalInfra,
    name:                      '關鍵基礎設施保護法',
    effectiveYear:             2020,
    complianceCostNTD:         2_000_000,
    annualMaintenanceCostNTD:  500_000,
    penaltyNTD:                3_000_000,
    reputationPenalty:         8,
    description:               '關鍵基礎設施保護相關法規',
  },
  [RegulationId.DigitalEconomy]: {
    id:                        RegulationId.DigitalEconomy,
    name:                      '數位經濟基本法',
    effectiveYear:             2023,
    complianceCostNTD:         300_000,
    annualMaintenanceCostNTD:  80_000,
    penaltyNTD:                500_000,
    reputationPenalty:         3,
    description:               '數位經濟基本法合規要求',
  },
};

const ALL_REGULATION_IDS = Object.values(RegulationId) as RegulationId[];

// ─── Internal state ────────────────────────────────────────────────────────────

interface RegulatoryEngineInternal {
  activeRegulations: RegulationId[];
  complianceStatus: Partial<Record<RegulationId, RegComplianceStatus>>;
  progressMonths: Partial<Record<RegulationId, number>>;
  totalFines: number;
  auditHistory: RegulatoryAuditRecord[];
  lastAuditDate: GameDate | null;
  nextAuditDate: GameDate | null;
}

// ─── RegulatoryEngine ─────────────────────────────────────────────────────────

export class RegulatoryEngine implements IGameModule {
  readonly moduleId = 'RegulatoryEngine';

  private bus!: IEventBus;
  private cfg!: RegulatoryConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubs: Array<() => void> = [];

  private state: RegulatoryEngineInternal = {
    activeRegulations: [],
    complianceStatus: {},
    progressMonths: {},
    totalFines: 0,
    auditHistory: [],
    lastAuditDate: null,
    nextAuditDate: null,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getRegulatoryState(): RegulatoryState {
    return {
      activeRegulations: [...this.state.activeRegulations],
      complianceStatus: { ...this.state.complianceStatus },
      totalFines: this.state.totalFines,
      auditHistory: this.state.auditHistory.map(r => ({ ...r })),
      lastAuditDate: this.state.lastAuditDate ? { ...this.state.lastAuditDate } : null,
      nextAuditDate: this.state.nextAuditDate ? { ...this.state.nextAuditDate } : null,
    };
  }

  startCompliance(id: RegulationId): string | null {
    const status = this.state.complianceStatus[id];
    if (
      status === RegComplianceStatus.InProgress ||
      status === RegComplianceStatus.Compliant
    ) {
      return '合規作業已在進行中或已完成';
    }
    if (!this.state.activeRegulations.includes(id)) {
      return '此法規尚未生效';
    }

    const def = REGULATION_DEFS[id];

    // Deduct compliance cost via hardware.purchased
    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount: def.complianceCostNTD },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    this.state.complianceStatus[id] = RegComplianceStatus.InProgress;
    this.state.progressMonths[id] = 0;

    this.bus.publish({
      type: 'regulatory.compliance_started',
      payload: { regulationId: id, cost: def.complianceCostNTD },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    return null;
  }

  getRequiredRegulations(currentYear: number): RegulationDef[] {
    return ALL_REGULATION_IDS
      .map(id => REGULATION_DEFS[id])
      .filter(def => def.effectiveYear <= currentYear);
  }

  isCompliant(id: RegulationId): boolean {
    return this.state.complianceStatus[id] === RegComplianceStatus.Compliant;
  }

  canBidFinancialContract(): boolean {
    return this.isCompliant(RegulationId.FSC_InfoSec);
  }

  canBidHealthcareContract(): boolean {
    return this.isCompliant(RegulationId.PersonalData);
  }

  canBidMultinationalContract(): boolean {
    return this.isCompliant(RegulationId.GDPR);
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.regulatory ?? {
      auditFrequencyMonthsMin: 10,
      auditFrequencyMonthsMax: 14,
      auditFailReputationPenalty: 10,
    };
    this.currentDate = { ...config.time.startDate };

    this.unsubs.push(
      bus.subscribe('time.month_end', (e) => {
        const p = e.payload as { newDate: GameDate };
        this.currentDate = p.newDate;
        this._onMonthEnd();
      }, this.moduleId),
    );
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return {
      activeRegulations: this.state.activeRegulations,
      complianceStatus: this.state.complianceStatus,
      progressMonths: this.state.progressMonths,
      totalFines: this.state.totalFines,
      auditHistory: this.state.auditHistory,
      lastAuditDate: this.state.lastAuditDate,
      nextAuditDate: this.state.nextAuditDate,
      currentDate: this.currentDate,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    if (saved.activeRegulations) {
      this.state.activeRegulations = saved.activeRegulations as RegulationId[];
    }
    if (saved.complianceStatus) {
      this.state.complianceStatus = saved.complianceStatus as Partial<Record<RegulationId, RegComplianceStatus>>;
    }
    if (saved.progressMonths) {
      this.state.progressMonths = saved.progressMonths as Partial<Record<RegulationId, number>>;
    }
    this.state.totalFines   = (saved.totalFines as number) ?? 0;
    this.state.auditHistory = (saved.auditHistory as RegulatoryAuditRecord[]) ?? [];
    this.state.lastAuditDate = (saved.lastAuditDate as GameDate | null) ?? null;
    this.state.nextAuditDate = (saved.nextAuditDate as GameDate | null) ?? null;
    if (saved.currentDate) {
      this.currentDate = saved.currentDate as GameDate;
    }
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze(this.getRegulatoryState() as unknown as Record<string, unknown>);
  }

  destroy(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _onMonthEnd(): void {
    const currentYear = this.currentDate.year;

    // Activate newly effective regulations
    for (const id of ALL_REGULATION_IDS) {
      const def = REGULATION_DEFS[id];
      if (
        def.effectiveYear <= currentYear &&
        !this.state.activeRegulations.includes(id)
      ) {
        this.state.activeRegulations.push(id);
        // Only set NonCompliant if not already started
        if (
          this.state.complianceStatus[id] == null ||
          this.state.complianceStatus[id] === RegComplianceStatus.NotActive
        ) {
          this.state.complianceStatus[id] = RegComplianceStatus.NonCompliant;
        }
        this.bus.publish({
          type: 'regulatory.regulation_activated',
          payload: { regulationId: id, year: currentYear },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }

    // Process each active regulation
    for (const id of this.state.activeRegulations) {
      const def = REGULATION_DEFS[id];
      const status = this.state.complianceStatus[id];

      // Advance InProgress → Compliant after 3 months
      if (status === RegComplianceStatus.InProgress) {
        const prev = this.state.progressMonths[id] ?? 0;
        const next = prev + 1;
        this.state.progressMonths[id] = next;

        if (next >= 3) {
          this.state.complianceStatus[id] = RegComplianceStatus.Compliant;
          this.state.progressMonths[id] = 0;
          this.bus.publish({
            type: 'regulatory.became_compliant',
            payload: { regulationId: id },
            source: this.moduleId,
            gameDate: this.currentDate,
          });
        }
      }

      // Charge monthly maintenance for Compliant regulations
      if (this.state.complianceStatus[id] === RegComplianceStatus.Compliant) {
        const monthlyMaintenance = Math.ceil(def.annualMaintenanceCostNTD / 12);
        this.bus.publish({
          type: 'finance.expense_requested',
          payload: {
            date: this.currentDate,
            category: ExpenseCategory.Compliance,
            amount: monthlyMaintenance,
            isCashExpense: true,
            description: `${def.name} 月度維護費`,
          },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }

    // Run audit if nextAuditDate matches current date
    if (
      this.state.nextAuditDate &&
      gameDateEquals(this.currentDate, this.state.nextAuditDate)
    ) {
      this._runAudit();
    }

    // Schedule first audit if we have active regulations and no audit scheduled yet
    if (
      this.state.activeRegulations.length > 0 &&
      this.state.nextAuditDate === null
    ) {
      this._scheduleNextAudit();
    }
  }

  private _runAudit(): void {
    this.state.lastAuditDate = { ...this.currentDate };

    for (const id of this.state.activeRegulations) {
      const def = REGULATION_DEFS[id];
      const status = this.state.complianceStatus[id];

      let passed: boolean;
      if (status === RegComplianceStatus.Compliant) {
        passed = true;
      } else if (status === RegComplianceStatus.NonCompliant) {
        // 30% fail means 70% chance to fail == 30% chance to pass
        passed = sr() < 0.30;
      } else {
        // InProgress — partial compliance, 50% pass
        passed = sr() < 0.50;
      }

      const fine = passed ? 0 : def.penaltyNTD;

      if (!passed) {
        this.state.totalFines += fine;

        // Publish fine as expense
        this.bus.publish({
          type: 'finance.expense_requested',
          payload: {
            date: this.currentDate,
            category: ExpenseCategory.Compliance,
            amount: fine,
            isCashExpense: true,
            description: `${def.name} 稽核罰款`,
          },
          source: this.moduleId,
          gameDate: this.currentDate,
        });

        // Apply reputation penalty
        this.bus.publish({
          type: 'reputation.penalty',
          payload: {
            delta: -def.reputationPenalty,
            reason: `${def.name} 稽核未通過`,
          },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }

      const record: RegulatoryAuditRecord = {
        date: { ...this.currentDate },
        regulationId: id,
        passed,
        fine,
      };
      this.state.auditHistory.push(record);

      this.bus.publish({
        type: 'regulatory.audit_result',
        payload: { regulationId: id, passed, fine, date: this.currentDate },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }

    // Keep last 20 audit records
    if (this.state.auditHistory.length > 20) {
      this.state.auditHistory = this.state.auditHistory.slice(-20);
    }

    this._scheduleNextAudit();
  }

  private _scheduleNextAudit(): void {
    const { auditFrequencyMonthsMin, auditFrequencyMonthsMax } = this.cfg;
    const range = auditFrequencyMonthsMax - auditFrequencyMonthsMin;
    const offset = Math.round(sr() * range) + auditFrequencyMonthsMin;
    this.state.nextAuditDate = addMonths(this.currentDate, offset);
  }
}
