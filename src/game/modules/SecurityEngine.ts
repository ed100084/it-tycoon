import type {
  EntityId, GameConfig, GameDate, IEventBus, IGameModule, Money,
  SecurityConfig, Incident, IncidentResponseRecord,
} from '../core/types';
import {
  IncidentType, IncidentSeverity, IncidentStatus, ResponseAction,
} from '../core/types';

// ─── Default config fallback ──────────────────────────────────────────────────

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  baseIncidentRates: {
    [IncidentType.HardwareFailure]:   0.05,
    [IncidentType.NetworkOutage]:     0.04,
    [IncidentType.CapacityAlarm]:     0.08,
    [IncidentType.PowerAnomaly]:      0.03,
    [IncidentType.CoolingFailure]:    0.02,
    [IncidentType.Ransomware]:        0.015,
    [IncidentType.DataBreach]:        0.01,
    [IncidentType.SocialEngineering]: 0.02,
    [IncidentType.APTAttack]:         0.005,
    [IncidentType.DDoS]:              0.025,
    [IncidentType.ComplianceGap]:     0.03,
    [IncidentType.InsiderThreat]:     0.008,
    [IncidentType.SupplyChainAttack]: 0.005,
  },
  incidentSeverity: {
    [IncidentType.HardwareFailure]:   IncidentSeverity.P3,
    [IncidentType.NetworkOutage]:     IncidentSeverity.P2,
    [IncidentType.CapacityAlarm]:     IncidentSeverity.P3,
    [IncidentType.PowerAnomaly]:      IncidentSeverity.P2,
    [IncidentType.CoolingFailure]:    IncidentSeverity.P2,
    [IncidentType.Ransomware]:        IncidentSeverity.P1,
    [IncidentType.DataBreach]:        IncidentSeverity.P1,
    [IncidentType.SocialEngineering]: IncidentSeverity.P3,
    [IncidentType.APTAttack]:         IncidentSeverity.P1,
    [IncidentType.DDoS]:              IncidentSeverity.P2,
    [IncidentType.ComplianceGap]:     IncidentSeverity.P4,
    [IncidentType.InsiderThreat]:     IncidentSeverity.P2,
    [IncidentType.SupplyChainAttack]: IncidentSeverity.P2,
  },
  baseResolutionHours: {
    [IncidentType.HardwareFailure]:   8,
    [IncidentType.NetworkOutage]:     4,
    [IncidentType.CapacityAlarm]:     2,
    [IncidentType.PowerAnomaly]:      6,
    [IncidentType.CoolingFailure]:    6,
    [IncidentType.Ransomware]:        72,
    [IncidentType.DataBreach]:        48,
    [IncidentType.SocialEngineering]: 12,
    [IncidentType.APTAttack]:         96,
    [IncidentType.DDoS]:              8,
    [IncidentType.ComplianceGap]:     24,
    [IncidentType.InsiderThreat]:     36,
    [IncidentType.SupplyChainAttack]: 48,
  },
  deadlineHours: {
    [IncidentSeverity.P1]: 4,
    [IncidentSeverity.P2]: 8,
    [IncidentSeverity.P3]: 24,
    [IncidentSeverity.P4]: 48,
  },
  hourlyLossRate: {
    [IncidentSeverity.P1]: 0.05,
    [IncidentSeverity.P2]: 0.02,
    [IncidentSeverity.P3]: 0.005,
    [IncidentSeverity.P4]: 0.001,
  },
  complianceScoreThresholds: { bonus: 80, neutral: 60, penalty1: 40, penalty2: 0 },
  ransomPaymentRate: 0.20,
  dataBreachReportWindowHours: 72,
};

// ─── Internal state ───────────────────────────────────────────────────────────

interface SecurityEngineState {
  activeIncidents: Incident[];
  incidentHistory: Incident[];
  complianceScore: number;
  securityPostureScore: number;
  eosRiskMultiplier: number;
  eolHardwareRisk: number;
  defenseModifiers: Record<IncidentType, number>;
  threatLevelMod: number;
  monthlyRevenue: number;
}

function makeDefaultDefenseModifiers(): Record<IncidentType, number> {
  return {
    [IncidentType.HardwareFailure]:   0,
    [IncidentType.NetworkOutage]:     0,
    [IncidentType.CapacityAlarm]:     0,
    [IncidentType.PowerAnomaly]:      0,
    [IncidentType.CoolingFailure]:    0,
    [IncidentType.Ransomware]:        0,
    [IncidentType.DataBreach]:        0,
    [IncidentType.SocialEngineering]: 0,
    [IncidentType.APTAttack]:         0,
    [IncidentType.DDoS]:              0,
    [IncidentType.ComplianceGap]:     0,
    [IncidentType.InsiderThreat]:     0,
    [IncidentType.SupplyChainAttack]: 0,
  };
}

// ─── SecurityEngine ───────────────────────────────────────────────────────────

let _randSeed = 1;

function seededRand(): number {
  const x = Math.sin(_randSeed++ * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export class SecurityEngine implements IGameModule {
  readonly moduleId = 'SecurityEngine';

  private bus!: IEventBus;
  private cfg!: SecurityConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private staffCoverageRatio: number = 1.0;

  private state: SecurityEngineState = {
    activeIncidents: [],
    incidentHistory: [],
    complianceScore: 70,
    securityPostureScore: 70,
    eosRiskMultiplier: 1.0,
    eolHardwareRisk: 0.0,
    defenseModifiers: makeDefaultDefenseModifiers(),
    threatLevelMod: 1.0,
    monthlyRevenue: 0,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getActiveIncidents(): Incident[] {
    return [...this.state.activeIncidents];
  }

  getIncident(id: EntityId): Incident | null {
    return (
      this.state.activeIncidents.find(i => i.id === id) ??
      this.state.incidentHistory.find(i => i.id === id) ??
      null
    );
  }

  getIncidentHistory(limit = 50): Incident[] {
    return this.state.incidentHistory.slice(-limit);
  }

  getSecurityPostureScore(): number {
    return this.state.securityPostureScore;
  }

  getComplianceScore(): number {
    return this.state.complianceScore;
  }

  respondToIncident(incidentId: EntityId, action: ResponseAction): void {
    const incident = this.state.activeIncidents.find(i => i.id === incidentId);
    if (!incident) return;

    const response: IncidentResponseRecord = {
      action,
      timestamp: { ...this.currentDate },
      result: '',
    };

    switch (action) {
      case ResponseAction.PayRansom: {
        const amount = Math.round(this.state.monthlyRevenue * this.cfg.ransomPaymentRate) as Money;
        response.result = 'Ransom paid — system restored';
        response.cost = amount;
        this.resolveIncident(incident, 'ransom_paid');
        this.bus.publish({
          type: 'security.penalty_incurred',
          payload: { amount, reason: 'Ransom payment' },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
        break;
      }
      case ResponseAction.RestoreFromBackup: {
        response.result = 'Restore from backup initiated (24h)';
        // Mark with a future resolution — advance elapsed hours by 24 on next tick
        // For simplicity: treat as resolved immediately at simulation boundary
        this.resolveIncident(incident, 'backup_restore');
        break;
      }
      case ResponseAction.StartInvestigation: {
        response.result = 'Investigation started';
        incident.status = IncidentStatus.Investigating;
        break;
      }
      case ResponseAction.ReportToAuthority: {
        response.result = 'Reported to authority — compliance credit applied';
        this.resolveIncident(incident, 'reported_authority');
        const prev = this.state.complianceScore;
        this.state.complianceScore = clamp(this.state.complianceScore + 5, 0, 100);
        this.bus.publish({
          type: 'security.compliance_changed',
          payload: { score: this.state.complianceScore, delta: this.state.complianceScore - prev },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
        break;
      }
      case ResponseAction.AssignEngineer: {
        response.result = 'Engineer assigned — mitigating';
        incident.status = IncidentStatus.Mitigating;
        break;
      }
      default: {
        response.result = 'Incident resolved';
        this.resolveIncident(incident, action);
        break;
      }
    }

    incident.responses.push(response);
  }

  getThreatAssessment(): {
    baseRates: Record<IncidentType, number>;
    modifiedRates: Record<IncidentType, number>;
    topThreats: IncidentType[];
    complianceScore: number;
  } {
    const baseRates = { ...this.cfg.baseIncidentRates };
    const complianceMod = this.complianceMod();
    const modifiedRates = {} as Record<IncidentType, number>;

    for (const type of Object.values(IncidentType)) {
      modifiedRates[type] =
        baseRates[type] *
        this.state.eosRiskMultiplier *
        (1 + this.state.eolHardwareRisk) *
        (1 - this.state.defenseModifiers[type]) *
        this.state.threatLevelMod *
        complianceMod;
    }

    const topThreats = (Object.values(IncidentType) as IncidentType[])
      .slice()
      .sort((a, b) => modifiedRates[b] - modifiedRates[a])
      .slice(0, 3);

    return { baseRates, modifiedRates, topThreats, complianceScore: this.state.complianceScore };
  }

  getIncidentDeadlineHours(incidentId: EntityId): number {
    const incident = this.getIncident(incidentId);
    if (!incident) return 0;
    return this.cfg.deadlineHours[incident.severity];
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.security ?? DEFAULT_SECURITY_CONFIG;
    this.currentDate = { ...config.time.startDate };

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
      this.onMonthEnd();
    }, this.moduleId);

    bus.subscribe('hardware.eol_expired', () => {
      this.state.eolHardwareRisk = Math.min(0.5, this.state.eolHardwareRisk + 0.1);
    }, this.moduleId);

    bus.subscribe('software.eos_security_modifier', (e) => {
      const p = e.payload as { multiplier: number };
      this.state.eosRiskMultiplier = p.multiplier;
    }, this.moduleId);

    bus.subscribe('software.compliance_changed', (e) => {
      const p = e.payload as { score: number };
      const prev = this.state.complianceScore;
      this.state.complianceScore = clamp(p.score, 0, 100);
      if (this.state.complianceScore !== prev) {
        this.bus.publish({
          type: 'security.compliance_changed',
          payload: { score: this.state.complianceScore, delta: this.state.complianceScore - prev },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }, this.moduleId);

    bus.subscribe('techtree.research_completed', (e) => {
      const p = e.payload as { nodeId: string; effects: Array<{ type: string; value: number }> };
      this.onTechTreeCompleted(p);
    }, this.moduleId);

    bus.subscribe('timeline.historical_event', (e) => {
      const p = e.payload as { effects: Array<{ effectType: string; value: number; isMultiplier: boolean; incidentType?: IncidentType }> };
      for (const eff of p.effects ?? []) {
        if (eff.effectType === 'THREAT_LEVEL_MOD') {
          this.state.threatLevelMod = eff.isMultiplier
            ? this.state.threatLevelMod * eff.value
            : eff.value;
        }
      }
    }, this.moduleId);

    bus.subscribe('finance.monthly_settlement', (e) => {
      const p = e.payload as { totalRevenue?: number; revenue?: number };
      this.state.monthlyRevenue = p.revenue ?? p.totalRevenue ?? this.state.monthlyRevenue;
    }, this.moduleId);

    bus.subscribe('staff.coverage_changed', (e) => {
      const p = e.payload as { ratio: number };
      this.staffCoverageRatio = p.ratio;
    }, this.moduleId);
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return {
      ...this.state,
      currentDate: this.currentDate,
      staffCoverageRatio: this.staffCoverageRatio,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.activeIncidents       = (saved.activeIncidents as Incident[]) ?? [];
    this.state.incidentHistory       = (saved.incidentHistory as Incident[]) ?? [];
    this.state.complianceScore       = (saved.complianceScore as number) ?? 70;
    this.state.securityPostureScore  = (saved.securityPostureScore as number) ?? 70;
    this.state.eosRiskMultiplier     = (saved.eosRiskMultiplier as number) ?? 1.0;
    this.state.eolHardwareRisk       = (saved.eolHardwareRisk as number) ?? 0.0;
    this.state.threatLevelMod        = (saved.threatLevelMod as number) ?? 1.0;
    this.state.monthlyRevenue        = (saved.monthlyRevenue as number) ?? 0;
    if (saved.defenseModifiers) {
      Object.assign(this.state.defenseModifiers, saved.defenseModifiers);
    }
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
    if (saved.staffCoverageRatio !== undefined) this.staffCoverageRatio = saved.staffCoverageRatio as number;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      activeIncidents: this.state.activeIncidents,
      incidentHistory: this.state.incidentHistory,
      complianceScore: this.state.complianceScore,
      securityPostureScore: this.state.securityPostureScore,
      eosRiskMultiplier: this.state.eosRiskMultiplier,
      eolHardwareRisk: this.state.eolHardwareRisk,
      defenseModifiers: this.state.defenseModifiers,
      threatLevelMod: this.state.threatLevelMod,
      monthlyRevenue: this.state.monthlyRevenue,
    });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private onMonthEnd(): void {
    this.rollIncidents();
    this.advanceActiveIncidents();
    this.recalcSecurityPosture();
  }

  private complianceMod(): number {
    const t = this.cfg.complianceScoreThresholds;
    const s = this.state.complianceScore;
    if (s >= t.bonus)   return 0.8;
    if (s >= t.neutral) return 1.0;
    if (s >= t.penalty1) return 1.3;
    return 2.0;
  }

  private rollIncidents(): void {
    const complianceMod = this.complianceMod();
    for (const type of Object.values(IncidentType)) {
      const baseRate = this.cfg.baseIncidentRates[type];
      const rate =
        baseRate *
        this.state.eosRiskMultiplier *
        (1 + this.state.eolHardwareRisk) *
        (1 - this.state.defenseModifiers[type]) *
        this.state.threatLevelMod *
        complianceMod;

      if (seededRand() < rate) {
        this.generateIncident(type);
      }
    }
  }

  private generateIncident(type: IncidentType): void {
    const severity = this.cfg.incidentSeverity[type];
    const deadlineHours = this.cfg.deadlineHours[severity];

    const incident: Incident = {
      id: crypto.randomUUID() as EntityId,
      type,
      severity,
      status: IncidentStatus.Active,
      triggeredAt: { ...this.currentDate },
      triggeredAtHour: 0,
      resolvedAt: null,
      deadlineHours,
      elapsedHours: 0,
      isBreached: false,
      region: null,
      affectedContractIds: [],
      assignedStaffIds: [],
      responses: [],
      resolutionMethod: null,
      financialImpact: 0,
      downtimeHours: 0,
    };

    this.state.activeIncidents.push(incident);

    this.bus.publish({
      type: 'security.incident_triggered',
      payload: incident,
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    // P1/P2 auto-pause request
    if (severity === IncidentSeverity.P1 || severity === IncidentSeverity.P2) {
      this.bus.publish({
        type: 'time.pause_requested',
        payload: { reason: severity === IncidentSeverity.P1 ? 'p1_incident' : 'p2_incident' },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private advanceActiveIncidents(): void {
    const HOURS_PER_MONTH = 720;
    const toTimeout: Incident[] = [];

    for (const incident of this.state.activeIncidents) {
      if (
        incident.status === IncidentStatus.Resolved ||
        incident.status === IncidentStatus.TimedOut
      ) continue;

      incident.elapsedHours += HOURS_PER_MONTH;
      incident.downtimeHours += HOURS_PER_MONTH;

      // Accumulate financial impact
      const lossRate = this.cfg.hourlyLossRate[incident.severity];
      incident.financialImpact += Math.round(this.state.monthlyRevenue * lossRate * HOURS_PER_MONTH);

      if (incident.elapsedHours > incident.deadlineHours && !incident.isBreached) {
        incident.isBreached = true;
        toTimeout.push(incident);
      }
    }

    for (const incident of toTimeout) {
      this.timeoutIncident(incident);
    }

    // Flush fully-resolved / timed-out incidents to history
    const remaining: Incident[] = [];
    for (const incident of this.state.activeIncidents) {
      if (
        incident.status === IncidentStatus.Resolved ||
        incident.status === IncidentStatus.TimedOut
      ) {
        this.state.incidentHistory.push(incident);
        if (this.state.incidentHistory.length > 50) {
          this.state.incidentHistory.shift();
        }
      } else {
        remaining.push(incident);
      }
    }
    this.state.activeIncidents = remaining;
  }

  private timeoutIncident(incident: Incident): void {
    incident.status = IncidentStatus.TimedOut;
    const extraLoss = Math.round(incident.financialImpact * 0.5);
    incident.financialImpact += extraLoss;

    // Compliance penalty for timed-out incidents
    const prev = this.state.complianceScore;
    const penalty = incident.severity === IncidentSeverity.P1 ? 10
      : incident.severity === IncidentSeverity.P2 ? 5
      : incident.severity === IncidentSeverity.P3 ? 2
      : 1;
    this.state.complianceScore = clamp(this.state.complianceScore - penalty, 0, 100);

    this.bus.publish({
      type: 'security.incident_timed_out',
      payload: { incidentId: incident.id, extraLoss },
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    if (this.state.complianceScore !== prev) {
      this.bus.publish({
        type: 'security.compliance_changed',
        payload: { score: this.state.complianceScore, delta: this.state.complianceScore - prev },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }

    if (extraLoss > 0) {
      this.bus.publish({
        type: 'security.penalty_incurred',
        payload: { amount: extraLoss, reason: `Incident timeout: ${incident.type}` },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private resolveIncident(incident: Incident, method: string): void {
    incident.status = IncidentStatus.Resolved;
    incident.resolvedAt = { ...this.currentDate };
    incident.resolutionMethod = method;

    this.bus.publish({
      type: 'security.incident_resolved',
      payload: {
        incidentId: incident.id,
        downtimeHours: incident.downtimeHours,
        method,
      },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  private recalcSecurityPosture(): void {
    let score = 100;

    // Each active incident degrades posture
    score -= this.state.activeIncidents.length * 5;

    // EOL hardware risk
    score -= this.state.eolHardwareRisk * 20;

    // EOS software risk
    score -= (this.state.eosRiskMultiplier - 1) * 15;

    // Compliance contribution
    score += (this.state.complianceScore - 70) * 0.2;

    // Defense modifiers are beneficial
    const totalDefense = Object.values(this.state.defenseModifiers).reduce((s, v) => s + v, 0);
    score += totalDefense * 3;

    // Staff coverage
    score += (this.staffCoverageRatio - 1) * 10;

    this.state.securityPostureScore = clamp(Math.round(score), 0, 100);
  }

  private onTechTreeCompleted(payload: { nodeId: string; effects: Array<{ type: string; value: number }> }): void {
    for (const eff of payload.effects ?? []) {
      switch (eff.type) {
        case 'SECURITY_EVENT_REDUCTION':
          // Reduce all incident rates by value
          for (const type of Object.values(IncidentType)) {
            this.state.defenseModifiers[type] = clamp(
              this.state.defenseModifiers[type] + eff.value, 0, 1,
            );
          }
          break;
        case 'RANSOMWARE_IMMUNITY':
          this.state.defenseModifiers[IncidentType.Ransomware] = clamp(
            this.state.defenseModifiers[IncidentType.Ransomware] + eff.value, 0, 1,
          );
          break;
        case 'DDOS_REDUCTION':
          this.state.defenseModifiers[IncidentType.DDoS] = clamp(
            this.state.defenseModifiers[IncidentType.DDoS] + eff.value, 0, 1,
          );
          break;
        case 'APT_DETECTION_BONUS':
          this.state.defenseModifiers[IncidentType.APTAttack] = clamp(
            this.state.defenseModifiers[IncidentType.APTAttack] + eff.value, 0, 1,
          );
          break;
        case 'SOCIAL_ENG_REDUCTION':
          this.state.defenseModifiers[IncidentType.SocialEngineering] = clamp(
            this.state.defenseModifiers[IncidentType.SocialEngineering] + eff.value, 0, 1,
          );
          break;
        case 'COMPLIANCE_BONUS': {
          const prev = this.state.complianceScore;
          this.state.complianceScore = clamp(this.state.complianceScore + eff.value, 0, 100);
          if (this.state.complianceScore !== prev) {
            this.bus.publish({
              type: 'security.compliance_changed',
              payload: { score: this.state.complianceScore, delta: this.state.complianceScore - prev },
              gameDate: this.currentDate,
              source: this.moduleId,
            });
          }
          break;
        }
      }
    }
  }
}
