import type {
  GameConfig, GameDate, IEventBus, IGameModule,
  TechDebtItem, TechDebtConfig,
} from '../core/types';
import { TechDebtLevel } from '../core/types';

// ─── Seeded random ─────────────────────────────────────────────────────────────

let _seed = 77;
function sr(): number {
  const x = Math.sin(_seed++ * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ─── Default config ────────────────────────────────────────────────────────────

const DEFAULT_TECH_DEBT_CONFIG: TechDebtConfig = {
  eolSoftwarePointsPerMonth: 5,
  skippedMaintenancePoints: 3,
  shortStaffedContractPoints: 2,
  eolHardwareOver2YrsPointsPerMonth: 4,
  emergencyWorkaroundPoints: 1,
  criticalCascadeFailureChance: 0.20,
  criticalThreshold: 81,
  dangerThreshold: 61,
  warningThreshold: 31,
  maxPoints: 100,
  refactorCostPerPoint: 50_000,
};

// ─── Internal state ────────────────────────────────────────────────────────────

interface TechDebtState {
  items: TechDebtItem[];
  totalPoints: number;
  hasEOLSoftware: boolean;
  hasEOLHardwareOver2Yrs: boolean;
  staffCoverageRatio: number;
  activeContracts: number;
}

// ─── TechDebtEngine ────────────────────────────────────────────────────────────

export class TechDebtEngine implements IGameModule {
  readonly moduleId = 'TechDebtEngine';

  private bus!: IEventBus;
  private cfg!: TechDebtConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubs: Array<() => void> = [];

  private state: TechDebtState = {
    items: [],
    totalPoints: 0,
    hasEOLSoftware: false,
    hasEOLHardwareOver2Yrs: false,
    staffCoverageRatio: 1.0,
    activeContracts: 0,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getTotalPoints(): number { return this.state.totalPoints; }

  getLevel(): TechDebtLevel {
    const p = this.state.totalPoints;
    const c = this.cfg;
    if (p >= c.criticalThreshold) return TechDebtLevel.Critical;
    if (p >= c.dangerThreshold)   return TechDebtLevel.Danger;
    if (p >= c.warningThreshold)  return TechDebtLevel.Warning;
    return TechDebtLevel.Healthy;
  }

  getItems(): TechDebtItem[] { return [...this.state.items]; }

  addDebt(source: string, points: number, description: string): void {
    const item: TechDebtItem = {
      id: crypto.randomUUID(),
      source,
      points,
      addedAt: { ...this.currentDate },
      description,
    };
    this.state.items.push(item);
    this.state.totalPoints = Math.min(
      this.cfg.maxPoints,
      this.state.totalPoints + points,
    );
    this._publishUpdate();
  }

  reduceDebt(points: number): void {
    const reduced = Math.min(points, this.state.totalPoints);
    this.state.totalPoints = Math.max(0, this.state.totalPoints - points);
    // Remove smallest items first up to reduced amount
    let remaining = reduced;
    this.state.items = this.state.items.filter(item => {
      if (remaining <= 0) return true;
      remaining -= item.points;
      return remaining < 0;
    });
    this._publishUpdate();
  }

  startRefactoring(points: number): string | null {
    if (points <= 0) return '重構點數必須大於 0';
    const cost = points * this.cfg.refactorCostPerPoint;
    // Deduct cost
    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount: cost },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this.bus.publish({
      type: 'techdebt.refactoring_started',
      payload: { points, cost },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this.reduceDebt(points);
    return null;
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.techDebt ?? DEFAULT_TECH_DEBT_CONFIG;
    this.currentDate = { ...config.time.startDate };

    this.unsubs.push(
      bus.subscribe('time.month_end', (e) => {
        const p = e.payload as { newDate: GameDate };
        this.currentDate = p.newDate;
        this._onMonthEnd();
      }, this.moduleId),

      bus.subscribe('software.eos_warning', () => {
        this.state.hasEOLSoftware = true;
      }, this.moduleId),

      bus.subscribe('software.compliance_changed', (e) => {
        const p = e.payload as { hasEOSLicense?: boolean };
        if (p.hasEOSLicense !== undefined) {
          this.state.hasEOLSoftware = p.hasEOSLicense;
        }
      }, this.moduleId),

      bus.subscribe('hardware.eol_warning', (e) => {
        const p = e.payload as { monthsSinceEOL?: number };
        if (p.monthsSinceEOL !== undefined && p.monthsSinceEOL > 24) {
          this.state.hasEOLHardwareOver2Yrs = true;
        }
      }, this.moduleId),

      bus.subscribe('facility.maintenance_skipped', () => {
        this.addDebt('maintenance_skip', this.cfg.skippedMaintenancePoints, '跳過維護窗口');
      }, this.moduleId),

      bus.subscribe('staff.coverage_changed', (e) => {
        const p = e.payload as { ratio?: number };
        if (p.ratio !== undefined) this.state.staffCoverageRatio = p.ratio;
      }, this.moduleId),

      bus.subscribe('contract.signed', () => {
        this.state.activeContracts++;
      }, this.moduleId),

      bus.subscribe('contract.terminated', () => {
        this.state.activeContracts = Math.max(0, this.state.activeContracts - 1);
      }, this.moduleId),
    );
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return {
      items: this.state.items,
      totalPoints: this.state.totalPoints,
      hasEOLSoftware: this.state.hasEOLSoftware,
      hasEOLHardwareOver2Yrs: this.state.hasEOLHardwareOver2Yrs,
      staffCoverageRatio: this.state.staffCoverageRatio,
      activeContracts: this.state.activeContracts,
      currentDate: this.currentDate,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.items               = (saved.items as TechDebtItem[]) ?? [];
    this.state.totalPoints         = (saved.totalPoints as number) ?? 0;
    this.state.hasEOLSoftware      = (saved.hasEOLSoftware as boolean) ?? false;
    this.state.hasEOLHardwareOver2Yrs = (saved.hasEOLHardwareOver2Yrs as boolean) ?? false;
    this.state.staffCoverageRatio  = (saved.staffCoverageRatio as number) ?? 1.0;
    this.state.activeContracts     = (saved.activeContracts as number) ?? 0;
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      totalPoints: this.state.totalPoints,
      level: this.getLevel(),
      items: this.state.items,
      hasEOLSoftware: this.state.hasEOLSoftware,
    });
  }

  destroy(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _onMonthEnd(): void {
    // Monthly EOL software debt
    if (this.state.hasEOLSoftware) {
      this.addDebt('eol_software', this.cfg.eolSoftwarePointsPerMonth, 'EOL 軟體未升級（每月累積）');
    }

    // Monthly EOL hardware (>2yr) debt
    if (this.state.hasEOLHardwareOver2Yrs) {
      this.addDebt('eol_hardware', this.cfg.eolHardwareOver2YrsPointsPerMonth, 'EOL 硬體超過 2 年未汰換（每月累積）');
    }

    // Short-staffed contracts
    if (this.state.staffCoverageRatio < 0.5 && this.state.activeContracts > 0) {
      this.addDebt('short_staffed', this.cfg.shortStaffedContractPoints, '人手不足硬接合約');
    }

    // Cascade failure at critical level
    if (this.getLevel() === TechDebtLevel.Critical) {
      if (sr() < this.cfg.criticalCascadeFailureChance) {
        const affectedCount = 1 + Math.floor(sr() * 3);
        this.bus.publish({
          type: 'techdebt.cascade_failure',
          payload: { affectedCount, description: `技術債臨界：${affectedCount} 台設備同時故障` },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }

    this._publishUpdate();
  }

  private _publishUpdate(): void {
    this.bus.publish({
      type: 'techdebt.updated',
      payload: { totalPoints: this.state.totalPoints, level: this.getLevel(), items: this.state.items },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }
}
