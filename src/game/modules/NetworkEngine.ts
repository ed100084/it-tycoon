import type {
  GameConfig, GameDate, IEventBus, IGameModule,
  NetworkState, NetworkConfig, Money,
} from '../core/types';
import {
  ISPProvider, BandwidthTier, RedundancyMode, ExpenseCategory,
} from '../core/types';

let _seed = 179;
function sr(): number {
  const x = Math.sin(_seed++ * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  bandwidthTiers: {
    [BandwidthTier.B100M]: { mbps: 100,     monthlyFeeNTD:    50_000, unlockYear: 2000 },
    [BandwidthTier.B1G]:   { mbps: 1_000,   monthlyFeeNTD:   300_000, unlockYear: 2003 },
    [BandwidthTier.B10G]:  { mbps: 10_000,  monthlyFeeNTD: 2_000_000, unlockYear: 2008 },
    [BandwidthTier.B100G]: { mbps: 100_000, monthlyFeeNTD: 8_000_000, unlockYear: 2015 },
  },
  ispProviders: {
    [ISPProvider.Chunghwa]:   { reliability: 99.9, costMultiplier: 1.20 },
    [ISPProvider.FarEasTone]: { reliability: 99.5, costMultiplier: 1.00 },
    [ISPProvider.APT]:        { reliability: 98.5, costMultiplier: 0.80 },
  },
  ixPeeringUnlockYear: 2005,
  ixPeeringAnnualFeeNTD: 600_000,
  ixPeeringBandwidthDiscount: 0.20,
  utilizationWarningThreshold: 0.80,
  utilizationSLADegradationThreshold: 0.95,
  bandwidthMbpsPerContract: 10,
};

let _nextContractSeq = 1;
function newContractId(): string {
  return `isp-${Date.now()}-${_nextContractSeq++}`;
}

export class NetworkEngine implements IGameModule {
  readonly moduleId = 'NetworkEngine';

  private bus!: IEventBus;
  private cfg!: NetworkConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubs: Array<() => void> = [];
  private activeCustomerContractCount = 0;

  private state: NetworkState = {
    ispContracts: [],
    totalBandwidthMbps: 0,
    usedBandwidthMbps: 0,
    redundancyMode: RedundancyMode.SingleLink,
    ixPeering: false,
    bandwidthUtilization: 0,
    qualityDegradationActive: false,
  };

  getNetworkState(): NetworkState { return { ...this.state, ispContracts: [...this.state.ispContracts] }; }

  addISPContract(provider: ISPProvider, tier: BandwidthTier): string | null {
    const tierDef = this.cfg.bandwidthTiers[tier];
    const provDef = this.cfg.ispProviders[provider];
    const baseFee = Math.round(tierDef.monthlyFeeNTD * provDef.costMultiplier);
    const discount = this.state.ixPeering ? this.cfg.ixPeeringBandwidthDiscount : 0;
    const monthlyFee = Math.round(baseFee * (1 - discount));

    this.bus.publish({
      type: 'finance.expense_requested',
      payload: {
        date: this.currentDate,
        category: ExpenseCategory.Bandwidth,
        amount: monthlyFee,
        isCashExpense: true,
        description: `ISP 合約 ${provider} ${tier}`,
      },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    const contract = {
      id: newContractId(),
      provider,
      tier,
      monthlyFeeNTD: monthlyFee,
      reliability: provDef.reliability,
      startDate: { ...this.currentDate },
    };

    this.state.ispContracts = [...this.state.ispContracts, contract];
    this._recalcBandwidth();

    this.bus.publish({
      type: 'network.isp_added',
      payload: { contractId: contract.id, provider, tier, monthlyFeeNTD: monthlyFee },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    return null;
  }

  removeISPContract(contractId: string): void {
    this.state.ispContracts = this.state.ispContracts.filter(c => c.id !== contractId);
    this._recalcBandwidth();

    this.bus.publish({
      type: 'network.isp_removed',
      payload: { contractId },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  setRedundancyMode(mode: RedundancyMode): void {
    this.state.redundancyMode = mode;
    this.bus.publish({
      type: 'network.redundancy_changed',
      payload: { mode },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  enableIXPeering(currentYear: number): string | null {
    if (currentYear < this.cfg.ixPeeringUnlockYear) {
      return `IX Peering 在 ${this.cfg.ixPeeringUnlockYear} 年後可啟用`;
    }
    if (this.state.ixPeering) return 'IX Peering 已啟用';

    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount: this.cfg.ixPeeringAnnualFeeNTD },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    this.state.ixPeering = true;
    // Apply discount retroactively to existing contracts
    this.state.ispContracts = this.state.ispContracts.map(c => ({
      ...c,
      monthlyFeeNTD: Math.round(c.monthlyFeeNTD * (1 - this.cfg.ixPeeringBandwidthDiscount)),
    }));

    this.bus.publish({
      type: 'network.ix_peering_enabled',
      payload: { annualFeeNTD: this.cfg.ixPeeringAnnualFeeNTD },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    return null;
  }

  getEffectiveMonthlyCost(): Money {
    return this.state.ispContracts.reduce((sum, c) => sum + c.monthlyFeeNTD, 0);
  }

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.network ?? DEFAULT_NETWORK_CONFIG;
    this.currentDate = { ...config.time.startDate };

    this.unsubs.push(
      bus.subscribe('time.month_end', (e) => {
        const p = e.payload as { newDate: GameDate };
        this.currentDate = p.newDate;
        this._onMonthEnd();
      }, this.moduleId),

      bus.subscribe('contract.activated', () => {
        this.activeCustomerContractCount++;
        this._recalcUsage();
        this._checkUtilization();
      }, this.moduleId),

      bus.subscribe('contract.terminated', () => {
        this.activeCustomerContractCount = Math.max(0, this.activeCustomerContractCount - 1);
        this._recalcUsage();
        this._checkUtilization();
      }, this.moduleId),
    );
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return {
      ispContracts: this.state.ispContracts.map(c => ({ ...c })),
      totalBandwidthMbps: this.state.totalBandwidthMbps,
      usedBandwidthMbps: this.state.usedBandwidthMbps,
      redundancyMode: this.state.redundancyMode,
      ixPeering: this.state.ixPeering,
      bandwidthUtilization: this.state.bandwidthUtilization,
      qualityDegradationActive: this.state.qualityDegradationActive,
      activeCustomerContractCount: this.activeCustomerContractCount,
      currentDate: this.currentDate,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.ispContracts           = (saved.ispContracts as NetworkState['ispContracts']) ?? [];
    this.state.totalBandwidthMbps     = (saved.totalBandwidthMbps as number) ?? 0;
    this.state.usedBandwidthMbps      = (saved.usedBandwidthMbps as number) ?? 0;
    this.state.redundancyMode         = (saved.redundancyMode as RedundancyMode) ?? RedundancyMode.SingleLink;
    this.state.ixPeering              = (saved.ixPeering as boolean) ?? false;
    this.state.bandwidthUtilization   = (saved.bandwidthUtilization as number) ?? 0;
    this.state.qualityDegradationActive = (saved.qualityDegradationActive as boolean) ?? false;
    this.activeCustomerContractCount  = (saved.activeCustomerContractCount as number) ?? 0;
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this.state });
  }

  destroy(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  private _recalcBandwidth(): void {
    this.state.totalBandwidthMbps = this.state.ispContracts.reduce((sum, c) => {
      return sum + this.cfg.bandwidthTiers[c.tier].mbps;
    }, 0);
    this._recalcUsage();
    this._checkUtilization();
  }

  private _recalcUsage(): void {
    this.state.usedBandwidthMbps =
      this.activeCustomerContractCount * this.cfg.bandwidthMbpsPerContract;
    if (this.state.totalBandwidthMbps > 0) {
      this.state.bandwidthUtilization =
        this.state.usedBandwidthMbps / this.state.totalBandwidthMbps;
    } else {
      this.state.bandwidthUtilization = 0;
    }
  }

  private _checkUtilization(): void {
    const wasActive = this.state.qualityDegradationActive;
    this.state.qualityDegradationActive =
      this.state.bandwidthUtilization >= this.cfg.utilizationSLADegradationThreshold;

    if (this.state.qualityDegradationActive && !wasActive) {
      this.bus.publish({
        type: 'network.quality_degraded',
        payload: { utilization: this.state.bandwidthUtilization },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }
  }

  private _onMonthEnd(): void {
    // ISP reliability check — poor reliability may trigger a network outage event
    for (const contract of this.state.ispContracts) {
      const roll = sr() * 100;
      if (roll > contract.reliability) {
        this.bus.publish({
          type: 'network.isp_outage',
          payload: { contractId: contract.id, provider: contract.provider },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }

    // Charge monthly ISP fees
    for (const contract of this.state.ispContracts) {
      this.bus.publish({
        type: 'finance.expense_requested',
        payload: {
          date: this.currentDate,
          category: ExpenseCategory.Bandwidth,
          amount: contract.monthlyFeeNTD,
          isCashExpense: true,
          description: `ISP 月費 ${contract.provider} ${contract.tier}`,
        },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }

    this._recalcUsage();
    this._checkUtilization();
  }
}
