import type {
  GameConfig, GameDate, IEventBus, IGameModule,
  EnergyState, EnergyConfig,
} from '../core/types';
import { ElectricityStrategy, ExpenseCategory } from '../core/types';
import { addMonths } from '../../utils/gameDate';

// ─── Seeded random ─────────────────────────────────────────────────────────────

let _seed = 131;
function sr(): number {
  const x = Math.sin(_seed++ * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ─── Default config ────────────────────────────────────────────────────────────

const DEFAULT_ENERGY_CONFIG: EnergyConfig = {
  solarUnlockYear: 2015,
  solarInstallCost: 5_000_000,
  solarMonthlyReduction: 0.12,
  storageUnlockYear: 2018,
  storageInstallCost: 3_000_000,
  storagePeakSavings: 0.08,
  carbonTaxStartYear: 2020,
  carbonTaxMonthly: 100_000,
  greenEsgDiscount: 0.30,
  spotVolatility: 0.20,
  fixed1YDiscount: 0.05,
  fixed3YDiscount: 0.15,
  fixed3YPrepayMonths: 3,
  esgRfpBonus: 0.20,
  esgThresholdForBonus: 70,
};

// ─── EnergyEngine ─────────────────────────────────────────────────────────────

export class EnergyEngine implements IGameModule {
  readonly moduleId = 'EnergyEngine';

  private bus!: IEventBus;
  private cfg!: EnergyConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubs: Array<() => void> = [];

  private state: EnergyState = {
    strategy: ElectricityStrategy.Spot,
    hasSolar: false,
    hasStorage: false,
    esgScore: 30,
    carbonTaxActive: false,
    monthlyElectricityCostMultiplier: 1.0,
    fixedContractExpiry: null,
    esgBonusTriggered: false,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getEnergyState(): EnergyState { return { ...this.state }; }

  getESGScore(): number { return this.state.esgScore; }

  getEffectiveElectricityCostMultiplier(): number {
    return this.state.monthlyElectricityCostMultiplier;
  }

  setStrategy(strategy: ElectricityStrategy): string | null {
    if (strategy === this.state.strategy) return null;

    // Fixed 3Y requires prepayment (deduct 3 months of base electricity cost)
    if (strategy === ElectricityStrategy.Fixed3Y) {
      const prepay = this.cfg.carbonTaxMonthly * this.cfg.fixed3YPrepayMonths;
      this.bus.publish({
        type: 'hardware.purchased',
        payload: { amount: prepay },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
      this.state.fixedContractExpiry = addMonths(this.currentDate, 36);
    } else if (strategy === ElectricityStrategy.Fixed1Y) {
      this.state.fixedContractExpiry = addMonths(this.currentDate, 12);
    } else {
      this.state.fixedContractExpiry = null;
    }

    this.state.strategy = strategy;
    this._recalcMultiplier();

    this.bus.publish({
      type: 'energy.strategy_changed',
      payload: { strategy },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this._publishUpdate();
    return null;
  }

  installSolar(currentYear: number): string | null {
    if (currentYear < this.cfg.solarUnlockYear) {
      return `太陽能板在 ${this.cfg.solarUnlockYear} 年後可安裝`;
    }
    if (this.state.hasSolar) return '太陽能板已安裝';

    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount: this.cfg.solarInstallCost },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this.state.hasSolar = true;
    this.state.esgScore = Math.min(100, this.state.esgScore + 20);
    this._recalcMultiplier();
    this._checkEsgBonus();

    this.bus.publish({
      type: 'energy.solar_installed',
      payload: { cost: this.cfg.solarInstallCost },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this._publishUpdate();
    return null;
  }

  installStorage(currentYear: number): string | null {
    if (currentYear < this.cfg.storageUnlockYear) {
      return `儲能設備在 ${this.cfg.storageUnlockYear} 年後可安裝`;
    }
    if (this.state.hasStorage) return '儲能設備已安裝';

    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount: this.cfg.storageInstallCost },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this.state.hasStorage = true;
    this.state.esgScore = Math.min(100, this.state.esgScore + 15);
    this._recalcMultiplier();
    this._checkEsgBonus();

    this.bus.publish({
      type: 'energy.storage_installed',
      payload: { cost: this.cfg.storageInstallCost },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this._publishUpdate();
    return null;
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.energy ?? DEFAULT_ENERGY_CONFIG;
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
    return { ...this.state, currentDate: this.currentDate };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.strategy          = (saved.strategy as ElectricityStrategy) ?? ElectricityStrategy.Spot;
    this.state.hasSolar          = (saved.hasSolar as boolean) ?? false;
    this.state.hasStorage        = (saved.hasStorage as boolean) ?? false;
    this.state.esgScore          = (saved.esgScore as number) ?? 30;
    this.state.carbonTaxActive   = (saved.carbonTaxActive as boolean) ?? false;
    this.state.monthlyElectricityCostMultiplier = (saved.monthlyElectricityCostMultiplier as number) ?? 1.0;
    this.state.fixedContractExpiry = (saved.fixedContractExpiry as GameDate | null) ?? null;
    this.state.esgBonusTriggered = (saved.esgBonusTriggered as boolean) ?? false;
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
    this._recalcMultiplier();
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
    // Check fixed contract expiry
    if (this.state.fixedContractExpiry) {
      const exp = this.state.fixedContractExpiry;
      if (
        this.currentDate.year > exp.year ||
        (this.currentDate.year === exp.year && this.currentDate.month >= exp.month)
      ) {
        this.state.fixedContractExpiry = null;
        this.state.strategy = ElectricityStrategy.Spot;
      }
    }

    // Activate carbon tax
    if (!this.state.carbonTaxActive && this.currentDate.year >= this.cfg.carbonTaxStartYear) {
      this.state.carbonTaxActive = true;
    }

    this._recalcMultiplier();

    // Charge carbon tax
    if (this.state.carbonTaxActive) {
      const discount = this.state.hasSolar ? this.cfg.greenEsgDiscount : 0;
      const taxAmount = Math.round(this.cfg.carbonTaxMonthly * (1 - discount));
      this.bus.publish({
        type: 'finance.expense_requested',
        payload: {
          date: this.currentDate,
          category: ExpenseCategory.Compliance,
          amount: taxAmount,
          isCashExpense: true,
          description: `碳稅${this.state.hasSolar ? '（綠能折扣）' : ''}`,
        },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }

    this._publishUpdate();
  }

  private _recalcMultiplier(): void {
    let mult = 1.0;

    switch (this.state.strategy) {
      case ElectricityStrategy.Spot: {
        const delta = (sr() * 2 - 1) * this.cfg.spotVolatility;
        mult = 1.0 + delta;
        break;
      }
      case ElectricityStrategy.Fixed1Y:
        mult = 1.0 - this.cfg.fixed1YDiscount;
        break;
      case ElectricityStrategy.Fixed3Y:
        mult = 1.0 - this.cfg.fixed3YDiscount;
        break;
    }

    if (this.state.hasSolar) {
      mult -= this.cfg.solarMonthlyReduction;
    }
    if (this.state.hasStorage) {
      mult -= this.cfg.storagePeakSavings;
    }

    this.state.monthlyElectricityCostMultiplier = Math.max(0.1, mult);
  }

  private _checkEsgBonus(): void {
    if (!this.state.esgBonusTriggered && this.state.esgScore >= this.cfg.esgThresholdForBonus) {
      this.state.esgBonusTriggered = true;
      this.bus.publish({
        type: 'energy.esg_threshold_reached',
        payload: { score: this.state.esgScore, rfpBonus: this.cfg.esgRfpBonus },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }
  }

  private _publishUpdate(): void {
    this.bus.publish({
      type: 'energy.updated',
      payload: { ...this.state },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }
}
