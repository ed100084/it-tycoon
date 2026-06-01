import type {
  CloudStrategyState, CloudStrategyConfig,
  GameConfig, GameDate, IEventBus, IGameModule, Money,
} from '../core/types';
import { CloudStrategy, ServiceType } from '../core/types';

// ─── Default config ────────────────────────────────────────────────────────────

const DEFAULT_CLOUD_STRATEGY_CONFIG: CloudStrategyConfig = {
  cloudCompeteStartYear:    2010,
  dataSovereigntyStartYear: 2018,
  cloudPressureGrowthPerYear: 5,
  hybridInvestmentCostNTD: 3_000_000,
  mspTransformCostNTD:    10_000_000,
  baseMigrationRiskPerMonth: 0.005,
  hybridRevenuePerContract:  200_000,
  mspRevenueMultiplier:      1.30,
};

// ─── CloudStrategyEngine ───────────────────────────────────────────────────────

export class CloudStrategyEngine implements IGameModule {
  readonly moduleId = 'CloudStrategyEngine';

  private bus!: IEventBus;
  private cfg!: CloudStrategyConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubs: Array<() => void> = [];

  private state: CloudStrategyState = {
    strategy:                    CloudStrategy.OnPrem,
    cloudPressure:               0,
    migrationRiskPerMonth:       DEFAULT_CLOUD_STRATEGY_CONFIG.baseMigrationRiskPerMonth,
    hybridContractCount:         0,
    cloudRevenueMonthly:         0,
    cloudCompeteActive:          false,
    dataSovereigntyOpportunity:  false,
    hybridInvestmentDone:        false,
    mspTransformDone:            false,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getCloudState(): CloudStrategyState {
    return { ...this.state };
  }

  /**
   * Switch to a new cloud strategy.
   * Returns a string error message if the transition is not allowed,
   * or null on success.
   */
  setStrategy(strategy: CloudStrategy): string | null {
    if (strategy === this.state.strategy) return null;

    if (strategy === CloudStrategy.OnPrem) {
      this.state.strategy = CloudStrategy.OnPrem;
      this._publishStrategyChanged();
      this._publishUpdate();
      return null;
    }

    if (strategy === CloudStrategy.Hybrid) {
      if (!this.state.hybridInvestmentDone) {
        // Deduct investment cost via hardware.purchased event
        this._deductCost(this.cfg.hybridInvestmentCostNTD);
        this.state.hybridInvestmentDone = true;
      }
      this.state.strategy = CloudStrategy.Hybrid;
      this._publishStrategyChanged();
      this._publishUpdate();
      return null;
    }

    if (strategy === CloudStrategy.MSP) {
      if (this.state.strategy !== CloudStrategy.Hybrid) {
        return 'Must be on Hybrid strategy before transitioning to MSP';
      }
      // Deduct MSP transformation cost
      this._deductCost(this.cfg.mspTransformCostNTD);
      this.state.mspTransformDone = true;
      this.state.strategy = CloudStrategy.MSP;
      this._publishStrategyChanged();
      this._publishUpdate();
      return null;
    }

    return 'Unknown strategy';
  }

  /** Record a new hybrid cloud contract. */
  addHybridContract(): void {
    this.state.hybridContractCount++;
    this.state.cloudRevenueMonthly =
      (this.state.cloudRevenueMonthly as Money) + this.cfg.hybridRevenuePerContract;

    this.bus.publish({
      type: 'cloud.hybrid_contract_added',
      payload: {
        count:               this.state.hybridContractCount,
        cloudRevenueMonthly: this.state.cloudRevenueMonthly,
      },
      source:   this.moduleId,
      gameDate: this.currentDate,
    });
    this._publishUpdate();
  }

  /**
   * Returns the effective monthly migration risk, modified by current strategy:
   *   OnPrem   → base × 1.5
   *   Hybrid   → base × 0.5
   *   MSP      → base × 0.2
   */
  getMigrationRisk(): number {
    const base = this.cfg.baseMigrationRiskPerMonth;
    switch (this.state.strategy) {
      case CloudStrategy.OnPrem:  return base * 1.5;
      case CloudStrategy.Hybrid:  return base * 0.5;
      case CloudStrategy.MSP:     return base * 0.2;
    }
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.cloudStrategy ?? DEFAULT_CLOUD_STRATEGY_CONFIG;
    this.currentDate = { ...config.time.startDate };

    // Re-sync migrationRiskPerMonth from config after cfg is set
    this.state.migrationRiskPerMonth = this.cfg.baseMigrationRiskPerMonth;

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
    return { ...this.state, currentDate: this.currentDate };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.strategy                   = (saved.strategy as CloudStrategy)       ?? CloudStrategy.OnPrem;
    this.state.cloudPressure              = (saved.cloudPressure as number)          ?? 0;
    this.state.migrationRiskPerMonth      = (saved.migrationRiskPerMonth as number)  ?? (this.cfg?.baseMigrationRiskPerMonth ?? DEFAULT_CLOUD_STRATEGY_CONFIG.baseMigrationRiskPerMonth);
    this.state.hybridContractCount        = (saved.hybridContractCount as number)    ?? 0;
    this.state.cloudRevenueMonthly        = (saved.cloudRevenueMonthly as Money)     ?? 0;
    this.state.cloudCompeteActive         = (saved.cloudCompeteActive as boolean)    ?? false;
    this.state.dataSovereigntyOpportunity = (saved.dataSovereigntyOpportunity as boolean) ?? false;
    this.state.hybridInvestmentDone       = (saved.hybridInvestmentDone as boolean)  ?? false;
    this.state.mspTransformDone           = (saved.mspTransformDone as boolean)      ?? false;
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this.state });
  }

  destroy(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _onMonthEnd(): void {
    const year = this.currentDate.year;

    // Activate cloud competition pressure
    if (year >= this.cfg.cloudCompeteStartYear) {
      this.state.cloudCompeteActive = true;

      // Grow cloudPressure based on strategy
      let growthFactor: number;
      switch (this.state.strategy) {
        case CloudStrategy.OnPrem:  growthFactor = 1.5;  break;
        case CloudStrategy.Hybrid:  growthFactor = 0.5;  break;
        case CloudStrategy.MSP:     growthFactor = 0.2;  break;
      }
      const monthlyGrowth = (this.cfg.cloudPressureGrowthPerYear / 12) * growthFactor;
      this.state.cloudPressure = Math.min(100, Math.max(0, this.state.cloudPressure + monthlyGrowth));
    }

    // Trigger data sovereignty opportunity
    if (
      year >= this.cfg.dataSovereigntyStartYear &&
      !this.state.dataSovereigntyOpportunity
    ) {
      this.state.dataSovereigntyOpportunity = true;
      this.bus.publish({
        type: 'cloud.sovereignty_opportunity',
        payload: { year },
        source:   this.moduleId,
        gameDate: this.currentDate,
      });
    }

    // MSP revenue income
    if (this.state.strategy === CloudStrategy.MSP && this.state.cloudRevenueMonthly > 0) {
      const mspIncome = Math.round(
        this.state.cloudRevenueMonthly * this.cfg.mspRevenueMultiplier,
      );
      this.bus.publish({
        type: 'finance.income_recorded',
        payload: {
          type:        ServiceType.MSP,
          amount:      mspIncome,
          date:        this.currentDate,
          description: 'MSP cloud revenue',
        },
        source:   this.moduleId,
        gameDate: this.currentDate,
      });
    }

    // Update migration risk state field
    this.state.migrationRiskPerMonth = this.getMigrationRisk();

    this._publishUpdate();
  }

  private _deductCost(amount: Money): void {
    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount },
      source:   this.moduleId,
      gameDate: this.currentDate,
    });
  }

  private _publishStrategyChanged(): void {
    this.bus.publish({
      type: 'cloud.strategy_changed',
      payload: { strategy: this.state.strategy },
      source:   this.moduleId,
      gameDate: this.currentDate,
    });
  }

  private _publishUpdate(): void {
    this.bus.publish({
      type: 'cloud.state_updated',
      payload: { ...this.state },
      source:   this.moduleId,
      gameDate: this.currentDate,
    });
  }
}
