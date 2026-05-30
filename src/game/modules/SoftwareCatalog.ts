import { addMonths, monthsBetween } from '../../utils/gameDate';
import {
  LicenseStatus,
  ComplianceRiskLevel,
  SoftwareEffectType,
  ExpenseCategory,
} from '../core/types';
import type {
  EntityId,
  GameConfig,
  GameDate,
  IEventBus,
  IGameModule,
  Money,
  SoftwareLicense,
  SoftwareModuleConfig,
  SoftwareProduct,
} from '../core/types';
import { SOFTWARE_CATALOG, SOFTWARE_CATALOG_BY_ID } from '../config/software.catalog';

// ─── Default config fallback ──────────────────────────────────────────────────

const DEFAULT_SW_CONFIG: SoftwareModuleConfig = {
  eosWarningMonthsBefore: 3,
  eosSecurityMultipliers: { quarter1: 1.2, quarter2: 1.5, quarter3plus: 2.0 },
  eosComplianceScorePenalty: { quarter1: -30, quarter2: -50, quarter3plus: -70 },
  compliancePenaltyAmount: 500_000,
};

// ─── Internal state ───────────────────────────────────────────────────────────

interface SoftwareCatalogState {
  licenses: SoftwareLicense[];
  complianceScore: number;
  eosRiskMultiplier: number;
}

// ─── SoftwareCatalog ─────────────────────────────────────────────────────────

export class SoftwareCatalog implements IGameModule {
  readonly moduleId = 'SoftwareCatalog';

  private bus!: IEventBus;
  private cfg!: SoftwareModuleConfig;
  private currentDate!: GameDate;

  private state: SoftwareCatalogState = {
    licenses: [],
    complianceScore: 100,
    eosRiskMultiplier: 1.0,
  };

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.software ?? DEFAULT_SW_CONFIG;
    this.currentDate = { ...config.time.startDate };

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
      this.onMonthEnd();
    }, this.moduleId);
  }

  tick(_deltaMs: number): void {}

  // ── Private helpers ───────────────────────────────────────────────

  private onMonthEnd(): void {
    this.updateEOSStatus();
    this.emitLicenseFees();
    this.recalculateCompliance();
  }

  private updateEOSStatus(): void {
    for (const license of this.state.licenses) {
      if (license.status === LicenseStatus.Cancelled) continue;
      const monthsUntilEOS = monthsBetween(this.currentDate, license.eosDate);
      const monthsPastEOS = monthsBetween(license.eosDate, this.currentDate);

      if (monthsPastEOS > 0) {
        license.monthsSinceEOS = monthsPastEOS;
        license.status = LicenseStatus.EosExpired;
        license.complianceRiskLevel = this.calcComplianceRisk(monthsPastEOS);
        this.bus.publish({
          type: 'software.eos_expired',
          payload: { licenseId: license.id, productId: license.productId },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      } else if (monthsUntilEOS <= this.cfg.eosWarningMonthsBefore && !license.eosWarningShown) {
        license.eosWarningShown = true;
        license.status = LicenseStatus.EosWarning;
        license.complianceRiskLevel = ComplianceRiskLevel.Low;
        this.bus.publish({
          type: 'software.eos_warning',
          payload: { licenseId: license.id, monthsUntilEOS },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }

      // Auto-renew annual subscriptions
      if (
        license.isAutoRenew &&
        license.status === LicenseStatus.Active &&
        monthsBetween(this.currentDate, license.renewalDate) === 0
      ) {
        license.renewalDate = addMonths(license.renewalDate, 12);
      }
    }
  }

  private calcComplianceRisk(monthsPastEOS: number): ComplianceRiskLevel {
    if (monthsPastEOS >= 7) return ComplianceRiskLevel.Critical;
    if (monthsPastEOS >= 4) return ComplianceRiskLevel.High;
    if (monthsPastEOS >= 1) return ComplianceRiskLevel.Medium;
    return ComplianceRiskLevel.Low;
  }

  private emitLicenseFees(): void {
    const total = this.calculateMonthlyLicenseCost();
    if (total <= 0) return;
    const breakdown = this.state.licenses
      .filter(l => l.status === LicenseStatus.Active || l.status === LicenseStatus.EosWarning)
      .map(l => ({ licenseId: l.id, amount: Math.round(l.annualCostNTD / 12) }));

    this.bus.publish({
      type: 'software.license_fee_due',
      payload: { totalAmount: total, breakdown },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    this.bus.publish({
      type: 'finance.expense_requested',
      payload: {
        category: ExpenseCategory.SoftwareLicense,
        amount: total,
        date: this.currentDate,
        description: 'Monthly software license fees',
        isCashExpense: true,
      },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  private recalculateCompliance(): void {
    let score = 100;
    let eosRisk = 1.0;

    for (const license of this.state.licenses) {
      if (license.status !== LicenseStatus.EosExpired) continue;
      const m = license.monthsSinceEOS;
      if (m >= 7) {
        score += this.cfg.eosComplianceScorePenalty.quarter3plus;
        eosRisk = Math.max(eosRisk, this.cfg.eosSecurityMultipliers.quarter3plus);
        // Compliance penalty after 7 months
        this.bus.publish({
          type: 'software.compliance_penalty',
          payload: {
            amount: this.cfg.compliancePenaltyAmount,
            reason: `EOS violation: ${license.productId}`,
          },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
        this.bus.publish({
          type: 'finance.expense_requested',
          payload: {
            category: ExpenseCategory.Compliance,
            amount: this.cfg.compliancePenaltyAmount,
            date: this.currentDate,
            description: `Compliance penalty — EOS violation`,
            isCashExpense: true,
          },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      } else if (m >= 4) {
        score += this.cfg.eosComplianceScorePenalty.quarter2;
        eosRisk = Math.max(eosRisk, this.cfg.eosSecurityMultipliers.quarter2);
      } else if (m >= 1) {
        score += this.cfg.eosComplianceScorePenalty.quarter1;
        eosRisk = Math.max(eosRisk, this.cfg.eosSecurityMultipliers.quarter1);
      }
    }

    score = Math.max(0, Math.min(100, score));
    const oldScore = this.state.complianceScore;
    this.state.complianceScore = score;
    this.state.eosRiskMultiplier = eosRisk;

    if (score !== oldScore) {
      this.bus.publish({
        type: 'software.compliance_changed',
        payload: { score, delta: score - oldScore, reason: 'EOS status update' },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
    if (eosRisk !== 1.0) {
      this.bus.publish({
        type: 'software.eos_security_modifier',
        payload: { multiplier: eosRisk },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }

    // Emit virtualization bonus update
    const densityBonus = this.getVirtualizationDensityBonus();
    this.bus.publish({
      type: 'software.virtualization_changed',
      payload: { densityBonus },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  private generateId(): EntityId {
    return crypto.randomUUID();
  }

  // ── Public API ────────────────────────────────────────────────────

  getAvailableProducts(date: GameDate): SoftwareProduct[] {
    return SOFTWARE_CATALOG.filter(p => p.unlockYear <= date.year);
  }

  getProduct(productId: string): SoftwareProduct | null {
    return SOFTWARE_CATALOG_BY_ID.get(productId) ?? null;
  }

  getLicenses(): SoftwareLicense[] {
    return this.state.licenses;
  }

  getLicense(licenseId: EntityId): SoftwareLicense | null {
    return this.state.licenses.find(l => l.id === licenseId) ?? null;
  }

  purchaseLicense(productId: string, _serverId?: EntityId): SoftwareLicense {
    const product = SOFTWARE_CATALOG_BY_ID.get(productId);
    if (!product) throw new Error(`Unknown product: ${productId}`);

    const eosDate: GameDate = {
      year: product.eosYear === 9999 ? 9999 : product.eosYear,
      month: product.eosMonth ?? 12,
    };

    const license: SoftwareLicense = {
      id: this.generateId(),
      productId,
      version: product.name,
      licenseType: product.licenseType,
      purchaseDate: this.currentDate,
      renewalDate: addMonths(this.currentDate, 12),
      eosDate,
      eosWarningShown: false,
      monthsSinceEOS: 0,
      status: LicenseStatus.Active,
      assignedServerIds: [],
      annualCostNTD: product.annualCostNTD,
      isAutoRenew: true,
      complianceRiskLevel: ComplianceRiskLevel.None,
    };

    this.state.licenses.push(license);

    this.bus.publish({
      type: 'software.license_purchased',
      payload: license,
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    if (product.annualCostNTD > 0) {
      this.bus.publish({
        type: 'finance.expense_requested',
        payload: {
          category: ExpenseCategory.SoftwareLicense,
          amount: product.annualCostNTD,
          date: this.currentDate,
          description: `License purchase — ${product.name}`,
          isCashExpense: true,
        },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }

    return license;
  }

  cancelSubscription(licenseId: EntityId): boolean {
    const license = this.state.licenses.find(l => l.id === licenseId);
    if (!license || license.status === LicenseStatus.Cancelled) return false;
    license.status = LicenseStatus.Cancelled;
    license.isAutoRenew = false;
    return true;
  }

  upgrade(licenseId: EntityId, targetVersion: string): SoftwareLicense {
    const old = this.state.licenses.find(l => l.id === licenseId);
    if (!old) throw new Error(`License not found: ${licenseId}`);
    const newProduct = SOFTWARE_CATALOG_BY_ID.get(targetVersion);
    if (!newProduct) throw new Error(`Unknown target product: ${targetVersion}`);
    old.status = LicenseStatus.Cancelled;
    return this.purchaseLicense(targetVersion);
  }

  getComplianceScore(): number {
    return this.state.complianceScore;
  }

  getEosWarningLicenses(): SoftwareLicense[] {
    return this.state.licenses.filter(l => l.status === LicenseStatus.EosWarning);
  }

  getEosExpiredLicenses(): SoftwareLicense[] {
    return this.state.licenses.filter(l => l.status === LicenseStatus.EosExpired);
  }

  calculateMonthlyLicenseCost(): Money {
    return this.state.licenses
      .filter(l => l.status === LicenseStatus.Active || l.status === LicenseStatus.EosWarning)
      .reduce((sum, l) => sum + Math.round(l.annualCostNTD / 12), 0);
  }

  getVirtualizationDensityBonus(): number {
    let bonus = 1.0;
    for (const license of this.state.licenses) {
      if (license.status !== LicenseStatus.Active) continue;
      const product = SOFTWARE_CATALOG_BY_ID.get(license.productId);
      if (!product) continue;
      for (const effect of product.effects) {
        if (effect.type === SoftwareEffectType.VirtualizationDensity) {
          bonus = Math.max(bonus, effect.value);
        }
      }
    }
    return bonus;
  }

  // ── IGameModule ───────────────────────────────────────────────────

  serialize(): Record<string, unknown> {
    return {
      licenses: this.state.licenses,
      complianceScore: this.state.complianceScore,
      eosRiskMultiplier: this.state.eosRiskMultiplier,
      currentDate: this.currentDate,
    };
  }

  deserialize(raw: Record<string, unknown>): void {
    const s = raw as unknown as SoftwareCatalogState & { currentDate: GameDate };
    this.state = {
      licenses: s.licenses,
      complianceScore: s.complianceScore,
      eosRiskMultiplier: s.eosRiskMultiplier,
    };
    if (s.currentDate) this.currentDate = s.currentDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this.state });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }
}
