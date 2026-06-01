import type {
  GameConfig,
  GameDate,
  IEventBus,
  IGameModule,
  InsuranceClaim,
  InsuranceConfig,
  InsurancePolicyDef,
  InsurancePolicy,
  InsuranceState,
  Money,
} from '../core/types';
import {
  ExpenseCategory,
  InsuranceType,
} from '../core/types';
import { addMonths } from '../../utils/gameDate';

// ─── Default config fallback ──────────────────────────────────────────────────

const DEFAULT_INSURANCE_CONFIG: InsuranceConfig = {
  policyDefs: {
    [InsuranceType.CyberSecurity]: {
      basePremiumRate: 0.01,
      coverageRate: 0.50,
      minAnnualPremiumNTD: 500_000,
      maxAnnualPremiumNTD: 5_000_000,
    },
    [InsuranceType.BusinessInterruption]: {
      basePremiumRate: 0.005,
      coverageRate: 0.60,
      minAnnualPremiumNTD: 500_000,
      maxAnnualPremiumNTD: 2_000_000,
    },
    [InsuranceType.DAndO]: {
      basePremiumRate: 0.003,
      coverageRate: 0.80,
      minAnnualPremiumNTD: 100_000,
      maxAnnualPremiumNTD: 500_000,
    },
    [InsuranceType.EAndO]: {
      basePremiumRate: 0.004,
      coverageRate: 0.70,
      minAnnualPremiumNTD: 200_000,
      maxAnnualPremiumNTD: 800_000,
    },
  },
  claimPremiumIncrease: 0.20,
  complianceDiscountRate: 0.10,
};

// ─── ID counter ───────────────────────────────────────────────────────────────

let _idCounter = 0;

function nextId(): string {
  return 'ins_' + (++_idCounter);
}

// ─── InsuranceEngine ──────────────────────────────────────────────────────────

export class InsuranceEngine implements IGameModule {
  readonly moduleId = 'InsuranceEngine';

  private bus!: IEventBus;
  private cfg!: InsuranceConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private annualRevenue: Money = 0;
  private unsubs: Array<() => void> = [];

  private state: InsuranceState = {
    policies: [],
    totalAnnualPremium: 0,
    totalCoverage: 0,
    claimsHistory: [],
    premiumMultiplier: 1.0,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getInsuranceState(): InsuranceState {
    return {
      policies: [...this.state.policies],
      totalAnnualPremium: this.state.totalAnnualPremium,
      totalCoverage: this.state.totalCoverage,
      claimsHistory: [...this.state.claimsHistory],
      premiumMultiplier: this.state.premiumMultiplier,
    };
  }

  /**
   * Purchase an insurance policy of the given type.
   * Returns null on success, or an error string on failure.
   */
  purchasePolicy(type: InsuranceType, annualRevenue: Money): string | null {
    const existing = this.state.policies.find(p => p.type === type && p.isActive);
    if (existing) {
      return `已有有效的 ${type} 保險保單`;
    }

    const def: InsurancePolicyDef = this.cfg.policyDefs[type];
    const rawPremium = annualRevenue * def.basePremiumRate * this.state.premiumMultiplier;
    const annualPremiumNTD = Math.round(
      Math.max(def.minAnnualPremiumNTD, Math.min(def.maxAnnualPremiumNTD, rawPremium)),
    ) as Money;

    const coverageAmount = Math.round(annualRevenue * def.coverageRate) as Money;

    // Deduct first-year premium via hardware.purchased (same convention as ComplianceEngine)
    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount: annualPremiumNTD },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    const policy: InsurancePolicy = {
      id: nextId(),
      type,
      annualPremiumNTD,
      coverageAmount,
      coverageRate: def.coverageRate,
      startDate: { ...this.currentDate },
      renewalDate: addMonths(this.currentDate, 12),
      isActive: true,
      claimCount: 0,
    };

    this.state.policies.push(policy);
    this._recalcTotals();

    this.bus.publish({
      type: 'insurance.policy_purchased',
      payload: { policyId: policy.id, type, annualPremiumNTD, coverageAmount },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    return null;
  }

  cancelPolicy(policyId: string): void {
    const idx = this.state.policies.findIndex(p => p.id === policyId);
    if (idx === -1) return;

    this.state.policies.splice(idx, 1);
    this._recalcTotals();

    this.bus.publish({
      type: 'insurance.policy_cancelled',
      payload: { policyId },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  getPolicy(type: InsuranceType): InsurancePolicy | undefined {
    return this.state.policies.find(p => p.type === type && p.isActive);
  }

  hasCoverage(type: InsuranceType): boolean {
    return this.state.policies.some(p => p.type === type && p.isActive);
  }

  /**
   * Process an insurance claim for a given loss.
   * Returns the covered amount (0 if no active policy of that type).
   */
  processClaim(type: InsuranceType, lossAmount: Money): Money {
    const policy = this.state.policies.find(p => p.type === type && p.isActive);
    if (!policy) return 0;

    const coveredAmount = Math.round(lossAmount * policy.coverageRate) as Money;

    const claim: InsuranceClaim = {
      date: { ...this.currentDate },
      type,
      originalLossNTD: lossAmount,
      coveredAmountNTD: coveredAmount,
    };

    this.state.claimsHistory.push(claim);
    if (this.state.claimsHistory.length > 30) {
      this.state.claimsHistory.shift();
    }

    policy.claimCount++;
    this.state.premiumMultiplier += this.cfg.claimPremiumIncrease;

    this._recalcTotals();

    this.bus.publish({
      type: 'insurance.claim_processed',
      payload: { policyId: policy.id, type, lossAmount, coveredAmount },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    return coveredAmount;
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.insurance ?? DEFAULT_INSURANCE_CONFIG;
    this.currentDate = { ...config.time.startDate };
    this.annualRevenue = 0;

    this.unsubs.push(
      bus.subscribe('time.month_end', (e) => {
        const p = e.payload as { newDate: GameDate };
        this.currentDate = p.newDate;
        this._onMonthEnd();
      }, this.moduleId),

      // Track annual revenue for premium renewal computation
      bus.subscribe('finance.monthly_settlement', (e) => {
        const p = e.payload as { totalRevenue?: Money; revenue?: Money };
        const monthly = p.revenue ?? p.totalRevenue ?? 0;
        // Rolling annualisation: approximate from monthly
        this.annualRevenue = monthly * 12;
      }, this.moduleId),

      // Auto-process claims when a security incident is resolved
      bus.subscribe('security.incident_resolved', (e) => {
        const p = e.payload as {
          incidentId?: string;
          financialImpact?: Money;
          lossAmount?: Money;
          incidentType?: string;
        };
        const loss = (p.financialImpact ?? p.lossAmount ?? 0) as Money;
        if (loss <= 0) return;

        // Attempt a CyberSecurity claim first; fall back to BusinessInterruption
        const cyberPolicy = this.state.policies.find(
          pol => pol.type === InsuranceType.CyberSecurity && pol.isActive,
        );
        if (cyberPolicy) {
          this.processClaim(InsuranceType.CyberSecurity, loss);
        } else {
          const biPolicy = this.state.policies.find(
            pol => pol.type === InsuranceType.BusinessInterruption && pol.isActive,
          );
          if (biPolicy) {
            this.processClaim(InsuranceType.BusinessInterruption, loss);
          }
        }
      }, this.moduleId),
    );
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return {
      policies: this.state.policies,
      totalAnnualPremium: this.state.totalAnnualPremium,
      totalCoverage: this.state.totalCoverage,
      claimsHistory: this.state.claimsHistory,
      premiumMultiplier: this.state.premiumMultiplier,
      currentDate: this.currentDate,
      annualRevenue: this.annualRevenue,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.policies          = (saved.policies as InsurancePolicy[]) ?? [];
    this.state.totalAnnualPremium = (saved.totalAnnualPremium as Money) ?? 0;
    this.state.totalCoverage     = (saved.totalCoverage as Money) ?? 0;
    this.state.claimsHistory     = (saved.claimsHistory as InsuranceClaim[]) ?? [];
    this.state.premiumMultiplier = (saved.premiumMultiplier as number) ?? 1.0;
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
    if (saved.annualRevenue !== undefined) this.annualRevenue = saved.annualRevenue as Money;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      policies: this.state.policies,
      totalAnnualPremium: this.state.totalAnnualPremium,
      totalCoverage: this.state.totalCoverage,
      claimsHistory: this.state.claimsHistory,
      premiumMultiplier: this.state.premiumMultiplier,
    });
  }

  destroy(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _onMonthEnd(): void {
    // Charge monthly insurance premium
    if (this.state.totalAnnualPremium > 0) {
      const monthlyPremium = Math.round(this.state.totalAnnualPremium / 12) as Money;
      this.bus.publish({
        type: 'finance.expense_requested',
        payload: {
          date: this.currentDate,
          category: ExpenseCategory.Insurance,
          amount: monthlyPremium,
          isCashExpense: true,
          description: '月度保險費',
        },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }

    // Renew policies whose renewalDate has arrived
    const revenue = this.annualRevenue;
    for (const policy of this.state.policies) {
      if (!policy.isActive) continue;
      const rd = policy.renewalDate;
      if (
        this.currentDate.year > rd.year ||
        (this.currentDate.year === rd.year && this.currentDate.month >= rd.month)
      ) {
        // Recompute premium at renewal
        const def = this.cfg.policyDefs[policy.type];
        const rawPremium = revenue * def.basePremiumRate * this.state.premiumMultiplier;
        const newPremium = Math.round(
          Math.max(def.minAnnualPremiumNTD, Math.min(def.maxAnnualPremiumNTD, rawPremium)),
        ) as Money;

        policy.annualPremiumNTD = newPremium;
        policy.renewalDate = addMonths(this.currentDate, 12);

        this.bus.publish({
          type: 'hardware.purchased',
          payload: { amount: newPremium },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }

    this._recalcTotals();

    this.bus.publish({
      type: 'insurance.updated',
      payload: {
        totalAnnualPremium: this.state.totalAnnualPremium,
        totalCoverage: this.state.totalCoverage,
        premiumMultiplier: this.state.premiumMultiplier,
      },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  private _recalcTotals(): void {
    let totalPremium = 0;
    let totalCoverage = 0;
    for (const policy of this.state.policies) {
      if (!policy.isActive) continue;
      totalPremium += policy.annualPremiumNTD;
      totalCoverage += policy.coverageAmount;
    }
    this.state.totalAnnualPremium = Math.round(totalPremium) as Money;
    this.state.totalCoverage = Math.round(totalCoverage) as Money;
  }
}
