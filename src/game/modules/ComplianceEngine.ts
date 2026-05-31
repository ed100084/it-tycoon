import type {
  GameConfig, GameDate, IEventBus, IGameModule,
  ComplianceCertRecord, ComplianceCertsDef, ComplianceCertsConfig,
} from '../core/types';
import {
  ComplianceCertType, ComplianceCertStatus, ExpenseCategory, StaffRole,
} from '../core/types';
import { addMonths, monthsBetween } from '../../utils/gameDate';

// ─── Default config ────────────────────────────────────────────────────────────

const DEFAULT_CERT_DEFS: Record<ComplianceCertType, ComplianceCertsDef> = {
  [ComplianceCertType.ISO_27001]: { acquisitionCostNTD: 2_000_000, acquisitionMonths: 12, annualRenewalCostNTD: 500_000, validityYears: 3, prerequisiteSecAnalysts: 2, renewalMonths: 3 },
  [ComplianceCertType.SOC2]:      { acquisitionCostNTD: 1_500_000, acquisitionMonths: 9,  annualRenewalCostNTD: 400_000, validityYears: 2, prerequisiteSecAnalysts: 1, renewalMonths: 2 },
  [ComplianceCertType.HIPAA]:     { acquisitionCostNTD: 800_000,   acquisitionMonths: 6,  annualRenewalCostNTD: 200_000, validityYears: 3, prerequisiteSecAnalysts: 1, renewalMonths: 2 },
  [ComplianceCertType.PCI_DSS]:   { acquisitionCostNTD: 1_200_000, acquisitionMonths: 8,  annualRenewalCostNTD: 300_000, validityYears: 2, prerequisiteSecAnalysts: 1, renewalMonths: 2 },
  [ComplianceCertType.ISO_20000]: { acquisitionCostNTD: 1_000_000, acquisitionMonths: 10, annualRenewalCostNTD: 250_000, validityYears: 3, prerequisiteSecAnalysts: 1, renewalMonths: 2 },
  [ComplianceCertType.CSA_STAR]:  { acquisitionCostNTD: 600_000,   acquisitionMonths: 5,  annualRenewalCostNTD: 150_000, validityYears: 2, prerequisiteSecAnalysts: 1, renewalMonths: 1 },
};

const ALL_CERT_TYPES = Object.values(ComplianceCertType) as ComplianceCertType[];

// ─── Internal state ────────────────────────────────────────────────────────────

interface ComplianceEngineState {
  certs: Record<ComplianceCertType, ComplianceCertRecord>;
  secAnalystCount: number;
  lastRenewalYear: Record<ComplianceCertType, number>;
}

function buildInitialCerts(): Record<ComplianceCertType, ComplianceCertRecord> {
  const result = {} as Record<ComplianceCertType, ComplianceCertRecord>;
  for (const type of ALL_CERT_TYPES) {
    const def = DEFAULT_CERT_DEFS[type];
    result[type] = {
      type,
      status: ComplianceCertStatus.NotAcquired,
      acquiredAt: null,
      expiresAt: null,
      progressMonths: 0,
      requiredMonths: def.acquisitionMonths,
      annualRenewalCost: def.annualRenewalCostNTD,
      isRenewalInProgress: false,
    };
  }
  return result;
}

// ─── ComplianceEngine ─────────────────────────────────────────────────────────

export class ComplianceEngine implements IGameModule {
  readonly moduleId = 'ComplianceEngine';

  private bus!: IEventBus;
  private cfg!: ComplianceCertsConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubs: Array<() => void> = [];

  private state: ComplianceEngineState = {
    certs: buildInitialCerts(),
    secAnalystCount: 0,
    lastRenewalYear: {} as Record<ComplianceCertType, number>,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getCertifications(): ComplianceCertRecord[] {
    return ALL_CERT_TYPES.map(t => ({ ...this.state.certs[t] }));
  }

  getCert(type: ComplianceCertType): ComplianceCertRecord {
    return { ...this.state.certs[type] };
  }

  hasCert(type: ComplianceCertType): boolean {
    return this.state.certs[type].status === ComplianceCertStatus.Active ||
           this.state.certs[type].status === ComplianceCertStatus.Renewal;
  }

  getExpiredCerts(): ComplianceCertType[] {
    return ALL_CERT_TYPES.filter(t => this.state.certs[t].status === ComplianceCertStatus.Expired);
  }

  startAcquisition(type: ComplianceCertType): string | null {
    const cert = this.state.certs[type];
    if (cert.status !== ComplianceCertStatus.NotAcquired && cert.status !== ComplianceCertStatus.Expired) {
      return '認證已在進行中或已取得';
    }
    const def = this.cfg.certDefs[type];
    if (this.state.secAnalystCount < def.prerequisiteSecAnalysts) {
      return `前置條件不足：需要至少 ${def.prerequisiteSecAnalysts} 位資安分析師 / CISO`;
    }
    // Deduct acquisition cost
    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount: def.acquisitionCostNTD },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    cert.status = ComplianceCertStatus.InProgress;
    cert.progressMonths = 0;
    cert.requiredMonths = def.acquisitionMonths;

    this.bus.publish({
      type: 'compliance.acquisition_started',
      payload: { type, cost: def.acquisitionCostNTD, months: def.acquisitionMonths },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this._publishUpdate();
    return null;
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.complianceCerts ?? { certDefs: DEFAULT_CERT_DEFS };
    this.currentDate = { ...config.time.startDate };

    // Rebuild cert records with config-driven required months
    for (const type of ALL_CERT_TYPES) {
      this.state.certs[type].requiredMonths = this.cfg.certDefs[type].acquisitionMonths;
      this.state.certs[type].annualRenewalCost = this.cfg.certDefs[type].annualRenewalCostNTD;
    }

    this.unsubs.push(
      bus.subscribe('time.month_end', (e) => {
        const p = e.payload as { newDate: GameDate };
        this.currentDate = p.newDate;
        this._onMonthEnd();
      }, this.moduleId),

      bus.subscribe('staff.hired', (e) => {
        const p = e.payload as { role?: StaffRole };
        if (p.role === StaffRole.E3_SecAna || p.role === StaffRole.E5_CISO) {
          this.state.secAnalystCount++;
        }
      }, this.moduleId),

      bus.subscribe('staff.laid_off', (e) => {
        const p = e.payload as { role?: StaffRole };
        if (p.role === StaffRole.E3_SecAna || p.role === StaffRole.E5_CISO) {
          this.state.secAnalystCount = Math.max(0, this.state.secAnalystCount - 1);
        }
      }, this.moduleId),

      bus.subscribe('staff.resigned', (e) => {
        const p = e.payload as { role?: StaffRole };
        if (p.role === StaffRole.E3_SecAna || p.role === StaffRole.E5_CISO) {
          this.state.secAnalystCount = Math.max(0, this.state.secAnalystCount - 1);
        }
      }, this.moduleId),
    );
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return {
      certs: this.state.certs,
      secAnalystCount: this.state.secAnalystCount,
      lastRenewalYear: this.state.lastRenewalYear,
      currentDate: this.currentDate,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    if (saved.certs) {
      const raw = saved.certs as Record<string, ComplianceCertRecord>;
      for (const type of ALL_CERT_TYPES) {
        if (raw[type]) this.state.certs[type] = raw[type];
      }
    }
    this.state.secAnalystCount  = (saved.secAnalystCount as number) ?? 0;
    this.state.lastRenewalYear  = (saved.lastRenewalYear as Record<ComplianceCertType, number>) ?? {};
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      certs: this.state.certs,
      secAnalystCount: this.state.secAnalystCount,
      expiredCerts: this.getExpiredCerts(),
    });
  }

  destroy(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _onMonthEnd(): void {
    for (const type of ALL_CERT_TYPES) {
      const cert = this.state.certs[type];
      const def = this.cfg.certDefs[type];

      if (cert.status === ComplianceCertStatus.InProgress || cert.status === ComplianceCertStatus.Renewal) {
        cert.progressMonths++;
        if (cert.progressMonths >= cert.requiredMonths) {
          this._completeCert(type, def);
        }
      }

      if (cert.status === ComplianceCertStatus.Active && cert.expiresAt) {
        // Check if renewal should start
        const monthsToExpiry = monthsBetween(this.currentDate, cert.expiresAt);
        if (monthsToExpiry <= def.renewalMonths && !cert.isRenewalInProgress) {
          cert.isRenewalInProgress = true;
          cert.status = ComplianceCertStatus.Renewal;
          cert.progressMonths = 0;
          cert.requiredMonths = def.renewalMonths;
          this.bus.publish({
            type: 'compliance.cert_renewal_started',
            payload: { type },
            source: this.moduleId,
            gameDate: this.currentDate,
          });
        }

        // Check expiry
        if (
          this.currentDate.year > cert.expiresAt.year ||
          (this.currentDate.year === cert.expiresAt.year && this.currentDate.month >= cert.expiresAt.month)
        ) {
          cert.status = ComplianceCertStatus.Expired;
          cert.isRenewalInProgress = false;
          this.bus.publish({
            type: 'compliance.cert_expired',
            payload: { type },
            source: this.moduleId,
            gameDate: this.currentDate,
          });
        }

        // Annual renewal fee (charge once per year)
        if (this.currentDate.month === 1) {
          const lastYear = this.state.lastRenewalYear[type] ?? 0;
          if (lastYear < this.currentDate.year) {
            this.state.lastRenewalYear[type] = this.currentDate.year;
            this.bus.publish({
              type: 'finance.expense_requested',
              payload: {
                date: this.currentDate,
                category: ExpenseCategory.Compliance,
                amount: def.annualRenewalCostNTD,
                isCashExpense: true,
                description: `${type} 年度續審費`,
              },
              source: this.moduleId,
              gameDate: this.currentDate,
            });
          }
        }
      }
    }

    this._publishUpdate();
  }

  private _completeCert(type: ComplianceCertType, def: ComplianceCertsDef): void {
    const cert = this.state.certs[type];
    cert.acquiredAt = { ...this.currentDate };
    cert.expiresAt = addMonths(this.currentDate, def.validityYears * 12);
    cert.status = ComplianceCertStatus.Active;
    cert.isRenewalInProgress = false;
    cert.progressMonths = 0;
    cert.requiredMonths = def.acquisitionMonths;

    this.bus.publish({
      type: 'compliance.cert_acquired',
      payload: { type, expiresAt: cert.expiresAt },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this._publishUpdate();
  }

  private _publishUpdate(): void {
    this.bus.publish({
      type: 'compliance.updated',
      payload: { certs: this.state.certs },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }
}
