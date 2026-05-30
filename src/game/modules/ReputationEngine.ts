import type {
  EntityId, GameConfig, GameDate, IEventBus, IGameModule,
  SatisfactionSnapshot, SatisfactionModifier, ReputationEffects, ReputationConfig,
} from '../core/types';
import { CustomerTier, IncidentSeverity, IncidentType } from '../core/types';
import { addMonths } from '../../utils/gameDate';

// ─── Internal state ───────────────────────────────────────────────────────────

interface ReputationState {
  overallScore: number;
  scoreByTier: Record<CustomerTier, number>;
  history: SatisfactionSnapshot[];
  activeModifiers: SatisfactionModifier[];
  coverageRatio: number;
  consecutiveLowScoreMonths: number;
}

const COVERAGE_PENALTY_ID = 'coverage_penalty';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function initialScoreByTier(score: number): Record<CustomerTier, number> {
  return {
    [CustomerTier.Individual]:    score,
    [CustomerTier.SMB]:           score,
    [CustomerTier.Enterprise]:    score,
    [CustomerTier.Government]:    score,
    [CustomerTier.Multinational]: score,
  };
}

// ─── Module ───────────────────────────────────────────────────────────────────

export class ReputationEngine implements IGameModule {
  readonly moduleId = 'ReputationEngine';

  private bus!: IEventBus;
  private cfg!: ReputationConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };

  private state: ReputationState = {
    overallScore: 75,
    scoreByTier: initialScoreByTier(75),
    history: [],
    activeModifiers: [],
    coverageRatio: 1.0,
    consecutiveLowScoreMonths: 0,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getSatisfactionScore(): number {
    return this.state.overallScore;
  }

  getSatisfactionByTier(): Record<CustomerTier, number> {
    return { ...this.state.scoreByTier };
  }

  getSatisfactionHistory(): SatisfactionSnapshot[] {
    return [...this.state.history];
  }

  getActiveModifiers(): SatisfactionModifier[] {
    return [...this.state.activeModifiers];
  }

  getReputationEffects(): ReputationEffects {
    const score = this.state.overallScore;
    const consecutive = this.state.consecutiveLowScoreMonths;

    if (score >= this.cfg.highSatisfactionThreshold) {
      return {
        rfpFrequencyMod: 1.2,
        renewalSuccessRateBonus: this.cfg.renewalBonusAtHighSatisfaction,
        pricingPower: 0.10,
        contractLossProbabilityMod: 0.7,
      };
    }

    if (score >= this.cfg.lowSatisfactionThreshold) {
      return {
        rfpFrequencyMod: 1.0,
        renewalSuccessRateBonus: 0,
        pricingPower: 0,
        contractLossProbabilityMod: 1.0,
      };
    }

    const contractLossMod =
      score < this.cfg.criticalSatisfactionThreshold && consecutive >= 2 ? 2.0 : 1.5;

    return {
      rfpFrequencyMod: 0.7,
      renewalSuccessRateBonus: -0.3,
      pricingPower: 0,
      contractLossProbabilityMod: contractLossMod,
    };
  }

  updateContractSatisfaction(contractId: EntityId, delta: number, reason: string): void {
    this.addModifier(`Contract ${contractId}: ${reason}`, delta, true, 'contract');
    const prevScore = this.state.overallScore;
    this.state.overallScore = clamp(prevScore + delta, 0, 100);
    this.bus.publish({
      type: 'reputation.satisfaction_changed',
      payload: { score: this.state.overallScore, delta, reason },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.reputation ?? this.defaultReputationConfig();
    this.currentDate = { ...config.time.startDate };
    this.state.overallScore = this.cfg.initialScore;
    this.state.scoreByTier = initialScoreByTier(this.cfg.initialScore);

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = { ...p.newDate };
      this.onMonthEnd();
    }, this.moduleId);

    bus.subscribe('security.incident_resolved', (e) => {
      const p = e.payload as { incidentId: EntityId; type: IncidentType; severity: IncidentSeverity; downtimeHours: number };
      this.onIncidentResolved(p);
    }, this.moduleId);

    bus.subscribe('security.incident_timed_out', (e) => {
      const p = e.payload as { incidentId: EntityId; extraLoss: number };
      this.onIncidentTimedOut(p);
    }, this.moduleId);

    bus.subscribe('contract.terminated', (e) => {
      const p = e.payload as { contractId: EntityId; tier: CustomerTier };
      this.onContractTerminated(p);
    }, this.moduleId);

    bus.subscribe('contract.renewed', (e) => {
      const p = e.payload as { contractId: EntityId; tier: CustomerTier };
      this.onContractRenewed(p);
    }, this.moduleId);

    bus.subscribe('staff.insufficient_coverage', (e) => {
      const p = e.payload as { ratio: number };
      this.onInsufficientCoverage(p.ratio);
    }, this.moduleId);

    bus.subscribe('staff.coverage_changed', (e) => {
      const p = e.payload as { ratio: number };
      this.state.coverageRatio = p.ratio;
    }, this.moduleId);

    bus.subscribe('security.audit_passed', () => {
      this.addModifier('Security audit passed', 5, true, 'security_audit');
    }, this.moduleId);
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return { ...this.state, currentDate: this.currentDate };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.overallScore           = (saved.overallScore as number) ?? this.cfg.initialScore;
    this.state.scoreByTier            = (saved.scoreByTier as Record<CustomerTier, number>) ?? initialScoreByTier(this.cfg.initialScore);
    this.state.history                = (saved.history as SatisfactionSnapshot[]) ?? [];
    this.state.activeModifiers        = (saved.activeModifiers as SatisfactionModifier[]) ?? [];
    this.state.coverageRatio          = (saved.coverageRatio as number) ?? 1.0;
    this.state.consecutiveLowScoreMonths = (saved.consecutiveLowScoreMonths as number) ?? 0;
    if (saved.currentDate) {
      this.currentDate = saved.currentDate as GameDate;
    }
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      overallScore:              this.state.overallScore,
      scoreByTier:               this.state.scoreByTier,
      history:                   this.state.history,
      activeModifiers:           this.state.activeModifiers,
      coverageRatio:             this.state.coverageRatio,
      consecutiveLowScoreMonths: this.state.consecutiveLowScoreMonths,
      effects:                   this.getReputationEffects(),
    });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Private: event handlers ──────────────────────────────────────────────

  private onMonthEnd(): void {
    const prevScore = this.state.overallScore;

    const activeNonOneTime = this.state.activeModifiers.filter(m => !m.isOneTime && !this.isExpired(m));
    let delta = activeNonOneTime.reduce((sum, m) => sum + m.delta, 0);

    const naturalRecovery =
      this.state.overallScore < this.cfg.naturalRecoveryThreshold &&
      this.state.coverageRatio >= 1.0;
    if (naturalRecovery) {
      delta += this.cfg.naturalRecoveryPerMonth;
    }

    this.state.overallScore = clamp(this.state.overallScore + delta, 0, 100);

    if (this.state.overallScore < this.cfg.lowSatisfactionThreshold) {
      this.state.consecutiveLowScoreMonths++;
    } else {
      this.state.consecutiveLowScoreMonths = 0;
    }

    this.state.activeModifiers = this.state.activeModifiers.filter(
      m => !m.isOneTime && !this.isExpired(m),
    );

    const positiveFactors = activeNonOneTime
      .filter(m => m.delta > 0)
      .map(m => m.description);
    if (naturalRecovery) positiveFactors.push('natural recovery');
    const negativeFactors = activeNonOneTime
      .filter(m => m.delta < 0)
      .map(m => m.description);

    const snapshot: SatisfactionSnapshot = {
      date: { ...this.currentDate },
      score: this.state.overallScore,
      delta: this.state.overallScore - prevScore,
      topPositiveFactors: positiveFactors.slice(0, 3),
      topNegativeFactors: negativeFactors.slice(0, 3),
    };
    this.state.history.push(snapshot);
    if (this.state.history.length > 36) {
      this.state.history.shift();
    }

    const totalDelta = this.state.overallScore - prevScore;
    this.bus.publish({
      type: 'reputation.satisfaction_changed',
      payload: { score: this.state.overallScore, delta: totalDelta, reason: 'monthly_settlement' },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    if (this.state.overallScore >= this.cfg.highSatisfactionThreshold) {
      this.bus.publish({
        type: 'reputation.high_satisfaction',
        payload: { score: this.state.overallScore },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }

    if (this.state.overallScore < this.cfg.lowSatisfactionThreshold) {
      this.bus.publish({
        type: 'reputation.low_satisfaction_warning',
        payload: { score: this.state.overallScore },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }
  }

  private onIncidentResolved(p: { incidentId: EntityId; type: IncidentType; severity: IncidentSeverity; downtimeHours: number }): void {
    if (p.type === IncidentType.DataBreach) {
      this.addModifier('Data breach resolved', -15, true, 'security');
    } else if (p.type === IncidentType.Ransomware) {
      this.addModifier('Ransomware resolved', -10, true, 'security');
    } else if (p.severity === IncidentSeverity.P1) {
      this.addModifier('P1 incident resolved successfully', 3, true, 'security');
    } else if (p.severity === IncidentSeverity.P2) {
      this.addModifier('P2 incident resolved successfully', 1, true, 'security');
    }
  }

  private onIncidentTimedOut(p: { incidentId: EntityId; extraLoss: number }): void {
    const rawPenalty = Math.min(p.extraLoss * 5, 20);
    this.addModifier('P1 incident timed out', -rawPenalty, true, 'security');
  }

  private onContractTerminated(p: { contractId: EntityId; tier: CustomerTier }): void {
    const isLarge = p.tier === CustomerTier.Enterprise || p.tier === CustomerTier.Government;
    this.addModifier(`Contract terminated (${p.tier})`, isLarge ? -10 : -5, true, 'contract');
  }

  private onContractRenewed(p: { contractId: EntityId; tier: CustomerTier }): void {
    const isLarge = p.tier === CustomerTier.Enterprise || p.tier === CustomerTier.Government;
    this.addModifier(`Contract renewed (${p.tier})`, isLarge ? 5 : 2, true, 'contract');
  }

  private onInsufficientCoverage(ratio: number): void {
    const existing = this.state.activeModifiers.findIndex(m => m.source === COVERAGE_PENALTY_ID);
    if (existing !== -1) {
      this.state.activeModifiers.splice(existing, 1);
    }

    if (ratio >= 1.0) return;

    let delta: number;
    if (ratio >= 0.7) {
      delta = -2;
    } else if (ratio >= 0.5) {
      delta = -5;
    } else {
      delta = -10;
    }

    const mod: SatisfactionModifier = {
      id: COVERAGE_PENALTY_ID,
      description: `Insufficient staff coverage (${Math.round(ratio * 100)}%)`,
      delta,
      isOneTime: false,
      source: COVERAGE_PENALTY_ID,
      appliedAt: { ...this.currentDate },
      expiresAt: null,
    };
    this.state.activeModifiers.push(mod);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private addModifier(description: string, delta: number, isOneTime: boolean, source: string, durationMonths?: number): void {
    const mod: SatisfactionModifier = {
      id: crypto.randomUUID(),
      description,
      delta,
      isOneTime,
      source,
      appliedAt: { ...this.currentDate },
      expiresAt: durationMonths ? addMonths(this.currentDate, durationMonths) : null,
    };
    this.state.activeModifiers.push(mod);
  }

  private isExpired(mod: SatisfactionModifier): boolean {
    if (!mod.expiresAt) return false;
    const e = mod.expiresAt;
    return (
      this.currentDate.year > e.year ||
      (this.currentDate.year === e.year && this.currentDate.month >= e.month)
    );
  }

  private defaultReputationConfig(): ReputationConfig {
    return {
      initialScore: 75,
      naturalRecoveryPerMonth: 1,
      naturalRecoveryThreshold: 80,
      highSatisfactionThreshold: 80,
      lowSatisfactionThreshold: 50,
      criticalSatisfactionThreshold: 40,
      renewalBonusAtHighSatisfaction: 0.40,
      priceIncreaseRange: [0.05, 0.15],
    };
  }
}
