import type {
  GameConfig, GameDate, IEventBus, IGameModule,
  CapacityPlanningState, CapacityPlanningConfig,
  CapacityMetric, CapacityRecommendation, CapacityMonthSnapshot,
} from '../core/types';
import { CapacityAlert } from '../core/types';

// ─── Default config ────────────────────────────────────────────────────────────

const DEFAULT_CAPACITY_PLANNING_CONFIG: CapacityPlanningConfig = {
  warningThreshold: 0.70,
  criticalThreshold: 0.85,
  forecastMonths: 6,
  historyMonths: 6,
};

// ─── CapacityPlanningEngine ────────────────────────────────────────────────────

export class CapacityPlanningEngine implements IGameModule {
  readonly moduleId = 'CapacityPlanningEngine';

  private bus!: IEventBus;
  private cfg!: CapacityPlanningConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubs: Array<() => void> = [];

  // Internal snapshot values updated by event subscriptions
  private rackUsed   = 0;
  private rackTotal  = 100;
  private bwUsed     = 0;
  private bwTotal    = 100;
  private powerUsed  = 0;
  private powerTotal = 100;
  private staffCov   = 1.0;

  // Persisted state
  private metrics: CapacityPlanningState['metrics'] = this._buildDefaultMetrics();
  private alerts: CapacityAlert[] = [];
  private recommendations: CapacityRecommendation[] = [];
  private lastReportDate: GameDate | null = null;
  private monthlyHistory: CapacityMonthSnapshot[] = [];

  // ── Public API ───────────────────────────────────────────────────────────

  getPlanningState(): CapacityPlanningState {
    return {
      metrics: {
        rackUtilization:      { ...this.metrics.rackUtilization,      trend: [...this.metrics.rackUtilization.trend] },
        bandwidthUtilization: { ...this.metrics.bandwidthUtilization, trend: [...this.metrics.bandwidthUtilization.trend] },
        powerUtilization:     { ...this.metrics.powerUtilization,     trend: [...this.metrics.powerUtilization.trend] },
        staffCoverage:        { ...this.metrics.staffCoverage,        trend: [...this.metrics.staffCoverage.trend] },
      },
      alerts:          [...this.alerts],
      recommendations: this.recommendations.map(r => ({ ...r })),
      lastReportDate:  this.lastReportDate ? { ...this.lastReportDate } : null,
      monthlyHistory:  this.monthlyHistory.map(s => ({ ...s })),
    };
  }

  getCurrentAlerts(): CapacityAlert[] {
    return [...this.alerts];
  }

  getRecommendations(): CapacityRecommendation[] {
    return this.recommendations.map(r => ({ ...r }));
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.capacityPlanning ?? DEFAULT_CAPACITY_PLANNING_CONFIG;
    this.currentDate = { ...config.time.startDate };

    this.unsubs.push(
      bus.subscribe<{ newDate: GameDate }>(
        'time.month_end',
        (e) => {
          this.currentDate = e.payload.newDate;
          this._onMonthEnd();
        },
        this.moduleId,
      ),

      bus.subscribe<{ usedUnits: number; totalUnits: number }>(
        'facility.updated',
        (e) => {
          const p = e.payload;
          if (typeof p.usedUnits  === 'number') this.rackUsed  = p.usedUnits;
          if (typeof p.totalUnits === 'number') this.rackTotal = p.totalUnits > 0 ? p.totalUnits : 100;
        },
        this.moduleId,
      ),

      bus.subscribe<{ usedBandwidthMbps?: number; totalBandwidthMbps?: number; bandwidthUtilization?: number }>(
        'network.updated',
        (e) => {
          const p = e.payload;
          if (typeof p.usedBandwidthMbps  === 'number') this.bwUsed  = p.usedBandwidthMbps;
          if (typeof p.totalBandwidthMbps === 'number') this.bwTotal = p.totalBandwidthMbps > 0 ? p.totalBandwidthMbps : 100;
        },
        this.moduleId,
      ),

      bus.subscribe<{ coverageRatio?: number }>(
        'staff.updated',
        (e) => {
          const p = e.payload;
          if (typeof p.coverageRatio === 'number') this.staffCov = p.coverageRatio;
        },
        this.moduleId,
      ),

      bus.subscribe<{ coverageRatio?: number }>(
        'staff.coverage_updated',
        (e) => {
          const p = e.payload;
          if (typeof p.coverageRatio === 'number') this.staffCov = p.coverageRatio;
        },
        this.moduleId,
      ),
    );
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return {
      metrics: {
        rackUtilization:      { ...this.metrics.rackUtilization,      trend: [...this.metrics.rackUtilization.trend] },
        bandwidthUtilization: { ...this.metrics.bandwidthUtilization, trend: [...this.metrics.bandwidthUtilization.trend] },
        powerUtilization:     { ...this.metrics.powerUtilization,     trend: [...this.metrics.powerUtilization.trend] },
        staffCoverage:        { ...this.metrics.staffCoverage,        trend: [...this.metrics.staffCoverage.trend] },
      },
      alerts:          [...this.alerts],
      recommendations: this.recommendations.map(r => ({ ...r })),
      lastReportDate:  this.lastReportDate ? { ...this.lastReportDate } : null,
      monthlyHistory:  this.monthlyHistory.map(s => ({ ...s })),
      currentDate:     { ...this.currentDate },
      rackUsed:        this.rackUsed,
      rackTotal:       this.rackTotal,
      bwUsed:          this.bwUsed,
      bwTotal:         this.bwTotal,
      powerUsed:       this.powerUsed,
      powerTotal:      this.powerTotal,
      staffCov:        this.staffCov,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    if (saved.metrics) {
      const m = saved.metrics as CapacityPlanningState['metrics'];
      this.metrics = {
        rackUtilization:      this._hydrateMetric(m.rackUtilization,      'Rack Utilization'),
        bandwidthUtilization: this._hydrateMetric(m.bandwidthUtilization, 'Bandwidth Utilization'),
        powerUtilization:     this._hydrateMetric(m.powerUtilization,     'Power Utilization'),
        staffCoverage:        this._hydrateMetric(m.staffCoverage,        'Staff Coverage'),
      };
    }
    this.alerts          = (saved.alerts as CapacityAlert[] | undefined) ?? [];
    this.recommendations = (saved.recommendations as CapacityRecommendation[] | undefined) ?? [];
    this.lastReportDate  = (saved.lastReportDate as GameDate | null | undefined) ?? null;
    this.monthlyHistory  = (saved.monthlyHistory as CapacityMonthSnapshot[] | undefined) ?? [];
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
    if (typeof saved.rackUsed   === 'number') this.rackUsed   = saved.rackUsed;
    if (typeof saved.rackTotal  === 'number') this.rackTotal  = saved.rackTotal;
    if (typeof saved.bwUsed     === 'number') this.bwUsed     = saved.bwUsed;
    if (typeof saved.bwTotal    === 'number') this.bwTotal    = saved.bwTotal;
    if (typeof saved.powerUsed  === 'number') this.powerUsed  = saved.powerUsed;
    if (typeof saved.powerTotal === 'number') this.powerTotal = saved.powerTotal;
    if (typeof saved.staffCov   === 'number') this.staffCov   = saved.staffCov;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze(this.serialize());
  }

  destroy(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _onMonthEnd(): void {
    const rackUtil  = this.rackTotal  > 0 ? this.rackUsed  / this.rackTotal  : 0;
    const bwUtil    = this.bwTotal    > 0 ? this.bwUsed    / this.bwTotal    : 0;
    const powerUtil = this.powerTotal > 0 ? this.powerUsed / this.powerTotal : 0;
    // staffCoverage is a ratio: 1.0 = fully covered → utilization = 1 - coverage (inverse)
    // But we store staffCoverage AS the "utilization" metric (how stressed the staff are).
    // Per spec, staffCoverage metric tracks the ratio itself (higher = better), so we
    // invert it for alert thresholds: if coverage is 0.6 it means 40% under-staffed.
    const staffUtil = Math.max(0, 1 - this.staffCov);

    // Snapshot for history
    const snapshot: CapacityMonthSnapshot = {
      date:         { ...this.currentDate },
      rackUtil,
      bwUtil,
      powerUtil,
      staffCoverage: this.staffCov,
    };
    this.monthlyHistory.push(snapshot);
    if (this.monthlyHistory.length > this.cfg.historyMonths) {
      this.monthlyHistory.shift();
    }

    // Rebuild trend arrays from history
    const rackTrend  = this.monthlyHistory.map(s => s.rackUtil);
    const bwTrend    = this.monthlyHistory.map(s => s.bwUtil);
    const powerTrend = this.monthlyHistory.map(s => s.powerUtil);
    // For staff metric, trend is the stress level (1 - coverage)
    const staffTrend = this.monthlyHistory.map(s => Math.max(0, 1 - s.staffCoverage));

    this._updateMetrics({
      rackUtil,
      bwUtil,
      powerUtil,
      staffUtil,
      rackTrend,
      bwTrend,
      powerTrend,
      staffTrend,
    });

    // Compute top-level alerts array (one per metric, deduplicated by severity)
    this.alerts = [
      this.metrics.rackUtilization.alert,
      this.metrics.bandwidthUtilization.alert,
      this.metrics.powerUtilization.alert,
      this.metrics.staffCoverage.alert,
    ];

    this.recommendations = this._buildRecommendations();
    this.lastReportDate = { ...this.currentDate };

    this.bus.publish({
      type: 'capacity.report_generated',
      payload: this.getPlanningState(),
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  private _updateMetrics(data: {
    rackUtil: number;
    bwUtil: number;
    powerUtil: number;
    staffUtil: number;
    rackTrend: number[];
    bwTrend: number[];
    powerTrend: number[];
    staffTrend: number[];
  }): void {
    this.metrics.rackUtilization = {
      name: 'Rack Utilization',
      currentValue:  this.rackUsed,
      maxValue:      this.rackTotal,
      utilizationRate: data.rackUtil,
      trend:          data.rackTrend,
      forecastedUtilization6M: this._forecast(data.rackTrend),
      alert: this._computeAlert(data.rackUtil),
    };

    this.metrics.bandwidthUtilization = {
      name: 'Bandwidth Utilization',
      currentValue:  this.bwUsed,
      maxValue:      this.bwTotal,
      utilizationRate: data.bwUtil,
      trend:          data.bwTrend,
      forecastedUtilization6M: this._forecast(data.bwTrend),
      alert: this._computeAlert(data.bwUtil),
    };

    this.metrics.powerUtilization = {
      name: 'Power Utilization',
      currentValue:  this.powerUsed,
      maxValue:      this.powerTotal,
      utilizationRate: data.powerUtil,
      trend:          data.powerTrend,
      forecastedUtilization6M: this._forecast(data.powerTrend),
      alert: this._computeAlert(data.powerUtil),
    };

    // Staff coverage metric: currentValue = staffCov (0–1), maxValue = 1
    this.metrics.staffCoverage = {
      name: 'Staff Coverage',
      currentValue:  this.staffCov,
      maxValue:      1,
      utilizationRate: data.staffUtil,
      trend:          data.staffTrend,
      forecastedUtilization6M: this._forecast(data.staffTrend),
      alert: this._computeAlert(data.staffUtil),
    };
  }

  private _computeAlert(util: number): CapacityAlert {
    if (util >= this.cfg.criticalThreshold) return CapacityAlert.Red;
    if (util >= this.cfg.warningThreshold)  return CapacityAlert.Yellow;
    return CapacityAlert.Green;
  }

  private _forecast(trend: number[]): number {
    if (trend.length === 0) return 0;
    if (trend.length === 1) return Math.min(1, Math.max(0, trend[0]));

    // Average monthly delta
    let totalDelta = 0;
    for (let i = 1; i < trend.length; i++) {
      totalDelta += trend[i] - trend[i - 1];
    }
    const avgDelta = totalDelta / (trend.length - 1);
    const last     = trend[trend.length - 1];
    const forecast = last + avgDelta * this.cfg.forecastMonths;
    return Math.min(1, Math.max(0, forecast));
  }

  private _buildRecommendations(): CapacityRecommendation[] {
    const recs: CapacityRecommendation[] = [];

    const checks: Array<{
      alert: CapacityAlert;
      type: CapacityRecommendation['type'];
      redDesc: string;
      yellowDesc: string;
      redCost: number;
      yellowCost: number;
    }> = [
      {
        alert:      this.metrics.rackUtilization.alert,
        type:       'rack',
        redDesc:    'Critical rack utilization — expand data centre capacity immediately.',
        yellowDesc: 'Rack utilization is approaching warning levels — plan expansion.',
        redCost:    3_000_000,
        yellowCost: 500_000,
      },
      {
        alert:      this.metrics.bandwidthUtilization.alert,
        type:       'bandwidth',
        redDesc:    'Critical bandwidth saturation — upgrade ISP contract immediately.',
        yellowDesc: 'Bandwidth utilization is trending high — evaluate next-tier ISP.',
        redCost:    800_000,
        yellowCost: 200_000,
      },
      {
        alert:      this.metrics.powerUtilization.alert,
        type:       'power',
        redDesc:    'Critical power draw — install additional UPS/PDU capacity now.',
        yellowDesc: 'Power utilization nearing threshold — review power budgets.',
        redCost:    2_000_000,
        yellowCost: 300_000,
      },
      {
        alert:      this.metrics.staffCoverage.alert,
        type:       'staff',
        redDesc:    'Staff severely under-staffed — hire additional engineers immediately.',
        yellowDesc: 'Staff coverage below optimal — consider opening new positions.',
        redCost:    1_200_000,
        yellowCost: 600_000,
      },
    ];

    for (const c of checks) {
      if (c.alert === CapacityAlert.Red) {
        recs.push({
          type:             c.type,
          description:      c.redDesc,
          urgency:          CapacityAlert.Red,
          estimatedCostNTD: c.redCost,
        });
      } else if (c.alert === CapacityAlert.Yellow) {
        recs.push({
          type:             c.type,
          description:      c.yellowDesc,
          urgency:          CapacityAlert.Yellow,
          estimatedCostNTD: c.yellowCost,
        });
      }
    }

    return recs;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private _buildDefaultMetrics(): CapacityPlanningState['metrics'] {
    const blank = (name: string): CapacityMetric => ({
      name,
      currentValue:           0,
      maxValue:               100,
      utilizationRate:        0,
      trend:                  [],
      forecastedUtilization6M: 0,
      alert:                  CapacityAlert.Green,
    });
    return {
      rackUtilization:      blank('Rack Utilization'),
      bandwidthUtilization: blank('Bandwidth Utilization'),
      powerUtilization:     blank('Power Utilization'),
      staffCoverage:        blank('Staff Coverage'),
    };
  }

  private _hydrateMetric(raw: CapacityMetric | undefined, fallbackName: string): CapacityMetric {
    if (!raw) return this._buildDefaultMetrics().rackUtilization; // reuse shape
    return {
      name:                    raw.name    ?? fallbackName,
      currentValue:            raw.currentValue            ?? 0,
      maxValue:                raw.maxValue                ?? 100,
      utilizationRate:         raw.utilizationRate         ?? 0,
      trend:                   Array.isArray(raw.trend) ? [...raw.trend] : [],
      forecastedUtilization6M: raw.forecastedUtilization6M ?? 0,
      alert:                   raw.alert                  ?? CapacityAlert.Green,
    };
  }
}
