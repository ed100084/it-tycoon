import type {
  GameConfig, GameDate, IEventBus, IGameModule,
  StrategyConfig, StrategyRoute, StrategyScores,
} from '../core/types';

interface StrategyState {
  scores: StrategyScores;
  totalScore: number;
  establishedRoutes: StrategyRoute[];
  dominantRoute: StrategyRoute | null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  establishThreshold: 0.60,
  reputationBonusOnEstablish: 5,
  rfpBoostOnRoute: 0.30,
};

export class StrategyEngine implements IGameModule {
  readonly moduleId = 'StrategyEngine';

  private bus!: IEventBus;
  private cfg!: StrategyConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };

  private state: StrategyState = {
    scores: { government: 0, startup: 0, enterprise: 0 },
    totalScore: 0,
    establishedRoutes: [],
    dominantRoute: null,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getScores(): StrategyScores {
    return { ...this.state.scores };
  }

  getPercentages(): { government: number; startup: number; enterprise: number } {
    if (this.state.totalScore === 0) {
      return { government: 1 / 3, startup: 1 / 3, enterprise: 1 / 3 };
    }
    return {
      government: this.state.scores.government / this.state.totalScore,
      startup: this.state.scores.startup / this.state.totalScore,
      enterprise: this.state.scores.enterprise / this.state.totalScore,
    };
  }

  getDominantRoute(): StrategyRoute | null {
    return this.state.dominantRoute;
  }

  getEstablishedRoutes(): StrategyRoute[] {
    return [...this.state.establishedRoutes];
  }

  getRFPModifier(routeHint: StrategyRoute): number {
    const pct = this.getPercentages();
    const key = routeHint.toLowerCase() as keyof typeof pct;
    if (this.state.establishedRoutes.includes(routeHint) && pct[key] >= this.cfg.establishThreshold) {
      return 1 + this.cfg.rfpBoostOnRoute;
    }
    return 1.0;
  }

  addScore(route: StrategyRoute, points: number): void {
    const key = route.toLowerCase() as keyof StrategyScores;
    this.state.scores[key] = clamp(this.state.scores[key] + points, 0, 9999);
    this.recalc();
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.strategy ?? DEFAULT_STRATEGY_CONFIG;
    this.currentDate = { ...config.time.startDate };

    // Contract signed → determine route
    bus.subscribe('contract.signed', (e) => {
      const p = e.payload as { serviceType?: string; clientTier?: string };
      this.onContractSigned(p.serviceType ?? '', p.clientTier ?? '');
    }, this.moduleId);

    // Tech research completed → determine route
    bus.subscribe('techtree.research_completed', (e) => {
      const p = e.payload as { nodeId: string; category?: string };
      this.onTechResearched(p.category ?? '');
    }, this.moduleId);

    // Staff hired → minor route signal
    bus.subscribe('staff.hired', (e) => {
      const p = e.payload as { role: string };
      this.onStaffHired(p.role);
    }, this.moduleId);

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
    }, this.moduleId);
  }

  tick(_deltaMs: number): void { /* no continuous logic */ }

  serialize(): Record<string, unknown> {
    return {
      scores: this.state.scores,
      totalScore: this.state.totalScore,
      establishedRoutes: this.state.establishedRoutes,
      dominantRoute: this.state.dominantRoute,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    if (saved.scores) this.state.scores = saved.scores as StrategyScores;
    if (typeof saved.totalScore === 'number') this.state.totalScore = saved.totalScore;
    if (saved.establishedRoutes) this.state.establishedRoutes = saved.establishedRoutes as StrategyRoute[];
    if (saved.dominantRoute !== undefined) this.state.dominantRoute = saved.dominantRoute as StrategyRoute | null;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      scores: this.state.scores,
      percentages: this.getPercentages(),
      dominantRoute: this.state.dominantRoute,
      establishedRoutes: this.state.establishedRoutes,
    });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private onContractSigned(serviceType: string, clientTier: string): void {
    const svc = serviceType.toUpperCase();
    const tier = clientTier.toUpperCase();
    if (tier === 'GOVERNMENT' || svc === 'DRAAS' || svc === 'MSSP') {
      this.addScore('GOVERNMENT', 3);
    } else if (svc === 'VPS' || svc === 'SAAS' || tier === 'SMB') {
      this.addScore('STARTUP', 3);
    } else if (svc === 'AI_COMPUTE' || svc === 'MSP' || tier === 'ENTERPRISE' || tier === 'MULTINATIONAL') {
      this.addScore('ENTERPRISE', 3);
    } else {
      // Generic — split 1 to each
      this.addScore('GOVERNMENT', 1);
      this.addScore('STARTUP', 1);
      this.addScore('ENTERPRISE', 1);
    }
  }

  private onTechResearched(category: string): void {
    const cat = category.toUpperCase();
    if (cat === 'SECURITY_DEFENSE' || cat === 'RISK_CONTROL') {
      this.addScore('GOVERNMENT', 2);
    } else if (cat === 'CLOUD_COMPETE' || cat === 'COST_CONTROL') {
      this.addScore('STARTUP', 2);
    } else if (cat === 'AI_INFRA' || cat === 'SCALE_ECONOMY') {
      this.addScore('ENTERPRISE', 2);
    }
  }

  private onStaffHired(role: string): void {
    const r = role.toUpperCase();
    if (r.includes('CISO') || r.includes('SEC')) {
      this.addScore('GOVERNMENT', 1);
    } else if (r.includes('CLOUD')) {
      this.addScore('STARTUP', 1);
    } else if (r.includes('AI')) {
      this.addScore('ENTERPRISE', 1);
    }
  }

  private recalc(): void {
    const s = this.state.scores;
    this.state.totalScore = s.government + s.startup + s.enterprise;
    const pct = this.getPercentages();

    // Find new dominant
    let dominant: StrategyRoute | null = null;
    if (pct.government >= this.cfg.establishThreshold) dominant = 'GOVERNMENT';
    else if (pct.startup >= this.cfg.establishThreshold) dominant = 'STARTUP';
    else if (pct.enterprise >= this.cfg.establishThreshold) dominant = 'ENTERPRISE';

    this.state.dominantRoute = dominant;

    // Check for newly established routes
    if (dominant && !this.state.establishedRoutes.includes(dominant)) {
      this.state.establishedRoutes.push(dominant);
      this.bus.publish({
        type: 'strategy.route_established',
        payload: {
          route: dominant,
          reputationBonus: this.cfg.reputationBonusOnEstablish,
          percentages: pct,
        },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }
  }
}
