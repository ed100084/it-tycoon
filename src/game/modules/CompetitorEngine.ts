import type {
  Competitor,
  GameConfig,
  GameDate,
  IEventBus,
  IGameModule,
} from '../core/types';

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

let _seed = 777;
function sRand(): number {
  const x = Math.sin(_seed++ * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ─── Initial competitor definitions ──────────────────────────────────────────

const INITIAL_COMPETITORS: Competitor[] = [
  {
    id: 'chunghsin_data',
    name: '中信數據',
    specialty: 'colo',
    marketShare: 0.25,
    pricingIndex: 1.0,
    techLevel: 3,
    reputation: 70,
    description: '老牌穩定，價格中等，Colo 強',
  },
  {
    id: 'cloud_express',
    name: '雲端快線',
    specialty: 'vps',
    marketShare: 0.15,
    pricingIndex: 0.8,
    techLevel: 2,
    reputation: 55,
    description: '新創積極，低價搶市，VPS 強',
  },
  {
    id: 'mega_tech',
    name: '巨量科技',
    specialty: 'ai',
    marketShare: 0.20,
    pricingIndex: 1.3,
    techLevel: 5,
    reputation: 80,
    description: '技術導向，高價高品質，AI/ML 強',
  },
];

// ─── Internal state ───────────────────────────────────────────────────────────

interface CompetitorState {
  competitors: Competitor[];
  playerMarketShare: number;
  rfpWinProbabilityMod: number;
}

// ─── CompetitorEngine ─────────────────────────────────────────────────────────

export class CompetitorEngine implements IGameModule {
  readonly moduleId = 'CompetitorEngine';

  private bus!: IEventBus;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private monthsSinceQuarterUpdate = 0;

  private state: CompetitorState = {
    competitors: INITIAL_COMPETITORS.map(c => ({ ...c })),
    playerMarketShare: 0.40,
    rfpWinProbabilityMod: 1.0,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getCompetitors(): Competitor[] {
    return [...this.state.competitors];
  }

  getPlayerMarketShare(): number {
    return this.state.playerMarketShare;
  }

  /** Multiplier applied to RFP win probability (0.7–1.1). */
  getRFPWinProbabilityMod(): number {
    return this.state.rfpWinProbabilityMod;
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.currentDate = { ...config.time.startDate };

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = { ...p.newDate };
      this.monthsSinceQuarterUpdate++;
      if (this.monthsSinceQuarterUpdate >= 3) {
        this.monthsSinceQuarterUpdate = 0;
        this.onQuarterEnd();
      }
    }, this.moduleId);

    // React to player winning/losing contracts to adjust player market share
    bus.subscribe('contract.signed', () => {
      this.state.playerMarketShare = Math.min(0.80, this.state.playerMarketShare + 0.01);
      this.recalcRFPMod();
    }, this.moduleId);

    bus.subscribe('contract.terminated', () => {
      this.state.playerMarketShare = Math.max(0.05, this.state.playerMarketShare - 0.02);
      this.recalcRFPMod();
    }, this.moduleId);
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return { ...this.state, currentDate: this.currentDate };
  }

  deserialize(saved: Record<string, unknown>): void {
    if (Array.isArray(saved.competitors)) {
      this.state.competitors = saved.competitors as Competitor[];
    }
    this.state.playerMarketShare = (saved.playerMarketShare as number) ?? 0.40;
    this.state.rfpWinProbabilityMod = (saved.rfpWinProbabilityMod as number) ?? 1.0;
    if (saved.currentDate) {
      this.currentDate = saved.currentDate as GameDate;
    }
  }

  getState(): Readonly<Record<string, unknown>> {
    return {
      competitors: this.state.competitors,
      playerMarketShare: this.state.playerMarketShare,
      rfpWinProbabilityMod: this.state.rfpWinProbabilityMod,
    };
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private onQuarterEnd(): void {
    for (const comp of this.state.competitors) {
      // Small market-share fluctuation
      const delta = (sRand() - 0.5) * 0.03;
      comp.marketShare = Math.max(0.05, Math.min(0.45, comp.marketShare + delta));

      // Tech level slowly increases over time (once per year on average)
      if (this.currentDate.year >= 2005 && sRand() < 0.08) {
        comp.techLevel = Math.min(5, comp.techLevel + 0.5);
      }

      // Reputation slight drift
      const repDelta = (sRand() - 0.5) * 2;
      comp.reputation = Math.max(30, Math.min(95, comp.reputation + repDelta));
    }

    // Player's market share is eroded by total competitor strength
    const totalCompShare = this.state.competitors.reduce((s, c) => s + c.marketShare, 0);
    const pressure = Math.max(0, totalCompShare - 0.55) * 0.02;
    this.state.playerMarketShare = Math.max(0.05, this.state.playerMarketShare - pressure);

    this.recalcRFPMod();

    this.bus.publish({
      type: 'competitor.state_changed',
      payload: {
        competitors: this.state.competitors,
        playerMarketShare: this.state.playerMarketShare,
      },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  private recalcRFPMod(): void {
    // Based on player market share vs total competitor share
    const totalComp = this.state.competitors.reduce((s, c) => s + c.marketShare, 0);
    if (totalComp > 0.70) {
      this.state.rfpWinProbabilityMod = 0.75;
    } else if (totalComp > 0.55) {
      this.state.rfpWinProbabilityMod = 0.90;
    } else if (totalComp < 0.40) {
      this.state.rfpWinProbabilityMod = 1.10;
    } else {
      this.state.rfpWinProbabilityMod = 1.0;
    }
  }
}
