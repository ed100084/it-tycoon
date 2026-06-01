import type {
  GameConfig, GameDate, IEventBus, IGameModule,
  ChangeRequest, ChangeManagementState, ChangeManagementConfig,
} from '../core/types';
import { ChangeType, ChangeStatus, ExpenseCategory } from '../core/types';
import { addMonths } from '../../utils/gameDate';

// ─── Seeded random ─────────────────────────────────────────────────────────────

let _seed = 173;
function sr(): number {
  const x = Math.sin(_seed++ * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ─── Default config ────────────────────────────────────────────────────────────

const DEFAULT_CM_CONFIG: ChangeManagementConfig = {
  emergencyFailureRisk: 0.30,
  shadowChangeFailureRisk: 0.30,
  normalChangeDelayMonths: 1,
  cabCostPerMonthNTD: 40_000,
  maturityLevelThresholds: [0, 5, 15, 30, 50, 80],
};

// ─── ChangeManagementEngine ────────────────────────────────────────────────────

export class ChangeManagementEngine implements IGameModule {
  readonly moduleId = 'ChangeManagementEngine';

  private bus!: IEventBus;
  private cfg!: ChangeManagementConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubs: Array<() => void> = [];
  private _idCounter = 0;

  private state: ChangeManagementState = {
    maturityLevel: 0,
    pendingChanges: [],
    changeLog: [],
    cabEnabled: false,
    shadowChangeCount: 0,
    totalChanges: 0,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getState_CM(): ChangeManagementState {
    return {
      maturityLevel: this.state.maturityLevel,
      pendingChanges: [...this.state.pendingChanges],
      changeLog: [...this.state.changeLog],
      cabEnabled: this.state.cabEnabled,
      shadowChangeCount: this.state.shadowChangeCount,
      totalChanges: this.state.totalChanges,
    };
  }

  submitChange(type: ChangeType, title: string): string {
    const id = 'chg_' + (++this._idCounter);

    if (type === ChangeType.Standard) {
      const cr: ChangeRequest = {
        id,
        type,
        title,
        status: ChangeStatus.Approved,
        submittedAt: { ...this.currentDate },
        scheduledAt: null,
        completedAt: null,
        failureRisk: 0.05,
        actuallyFailed: false,
        isShadow: false,
      };
      cr.status = ChangeStatus.Executing;
      this._executeChange(cr);
    } else if (type === ChangeType.Emergency) {
      const cr: ChangeRequest = {
        id,
        type,
        title,
        status: ChangeStatus.Executing,
        submittedAt: { ...this.currentDate },
        scheduledAt: null,
        completedAt: null,
        failureRisk: this.cfg.emergencyFailureRisk,
        actuallyFailed: false,
        isShadow: false,
      };
      this.bus.publish({
        type: 'change.emergency_executed',
        payload: { changeId: id, title },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
      this._executeChange(cr);
    } else {
      // Normal — delayed
      const cr: ChangeRequest = {
        id,
        type,
        title,
        status: ChangeStatus.Pending,
        submittedAt: { ...this.currentDate },
        scheduledAt: addMonths(this.currentDate, this.cfg.normalChangeDelayMonths),
        completedAt: null,
        failureRisk: Math.max(0.05, this.cfg.emergencyFailureRisk - this.state.maturityLevel * 0.04),
        actuallyFailed: false,
        isShadow: false,
      };
      this.state.pendingChanges.push(cr);
    }

    return id;
  }

  recordShadowChange(title: string): void {
    this.state.shadowChangeCount++;
    if (sr() < this.cfg.shadowChangeFailureRisk) {
      this.bus.publish({
        type: 'change.shadow_failed',
        payload: { title, shadowChangeCount: this.state.shadowChangeCount },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
      // Trigger incident
      this.bus.publish({
        type: 'incident.trigger_requested',
        payload: { reason: 'shadow_change', title },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }
  }

  enableCAB(): void {
    this.state.cabEnabled = true;
  }

  disableCAB(): void {
    this.state.cabEnabled = false;
  }

  upgradeMaturity(): void {
    const thresholds = this.cfg.maturityLevelThresholds;
    const nextLevel = this.state.maturityLevel + 1;
    if (nextLevel < thresholds.length && this.state.totalChanges >= thresholds[nextLevel]) {
      this.state.maturityLevel = nextLevel;
      this.bus.publish({
        type: 'change.maturity_upgraded',
        payload: { maturityLevel: this.state.maturityLevel },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.changeManagement ?? DEFAULT_CM_CONFIG;
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
    return {
      maturityLevel: this.state.maturityLevel,
      pendingChanges: this.state.pendingChanges,
      changeLog: this.state.changeLog,
      cabEnabled: this.state.cabEnabled,
      shadowChangeCount: this.state.shadowChangeCount,
      totalChanges: this.state.totalChanges,
      currentDate: this.currentDate,
      _idCounter: this._idCounter,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.maturityLevel    = (saved.maturityLevel as number) ?? 0;
    this.state.pendingChanges   = (saved.pendingChanges as ChangeRequest[]) ?? [];
    this.state.changeLog        = (saved.changeLog as ChangeRequest[]) ?? [];
    this.state.cabEnabled       = (saved.cabEnabled as boolean) ?? false;
    this.state.shadowChangeCount = (saved.shadowChangeCount as number) ?? 0;
    this.state.totalChanges     = (saved.totalChanges as number) ?? 0;
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
    if (saved._idCounter !== undefined) this._idCounter = saved._idCounter as number;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      maturityLevel: this.state.maturityLevel,
      cabEnabled: this.state.cabEnabled,
      shadowChangeCount: this.state.shadowChangeCount,
      totalChanges: this.state.totalChanges,
      pendingChangesCount: this.state.pendingChanges.length,
    });
  }

  destroy(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _onMonthEnd(): void {
    // Charge CAB cost if enabled
    if (this.state.cabEnabled) {
      this.bus.publish({
        type: 'finance.expense_requested',
        payload: {
          date: this.currentDate,
          category: ExpenseCategory.Other,
          amount: this.cfg.cabCostPerMonthNTD,
          isCashExpense: true,
          description: 'CAB (Change Advisory Board) 月費',
        },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }

    // Process pending Normal changes whose scheduledAt <= currentDate
    const due: ChangeRequest[] = [];
    const remaining: ChangeRequest[] = [];
    for (const cr of this.state.pendingChanges) {
      if (cr.scheduledAt && this._dateGte(this.currentDate, cr.scheduledAt)) {
        due.push(cr);
      } else {
        remaining.push(cr);
      }
    }
    this.state.pendingChanges = remaining;

    for (const cr of due) {
      // Recalculate failure risk at execution time based on current maturity
      cr.failureRisk = Math.max(0.05, this.cfg.emergencyFailureRisk - this.state.maturityLevel * 0.04);
      this._executeChange(cr);
    }
  }

  private _executeChange(cr: ChangeRequest): void {
    const roll = sr();
    if (roll < cr.failureRisk) {
      cr.actuallyFailed = true;
      cr.status = ChangeStatus.Failed;
    } else {
      cr.actuallyFailed = false;
      cr.status = ChangeStatus.Completed;
    }
    cr.completedAt = { ...this.currentDate };
    this.state.totalChanges++;

    // Trim changeLog to last 20
    this.state.changeLog.push(cr);
    if (this.state.changeLog.length > 20) {
      this.state.changeLog.splice(0, this.state.changeLog.length - 20);
    }

    if (cr.actuallyFailed) {
      this.bus.publish({
        type: 'change.failed',
        payload: { changeId: cr.id, title: cr.title, type: cr.type },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    } else {
      this.bus.publish({
        type: 'change.completed',
        payload: { changeId: cr.id, title: cr.title, type: cr.type },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }

    this._checkMaturityUpgrade();
  }

  private _checkMaturityUpgrade(): void {
    const thresholds = this.cfg.maturityLevelThresholds;
    const nextLevel = this.state.maturityLevel + 1;
    if (nextLevel < thresholds.length && this.state.totalChanges >= thresholds[nextLevel]) {
      this.state.maturityLevel = nextLevel;
      this.bus.publish({
        type: 'change.maturity_upgraded',
        payload: { maturityLevel: this.state.maturityLevel },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }
  }

  /** Returns true if a >= b (date comparison) */
  private _dateGte(a: GameDate, b: GameDate): boolean {
    if (a.year !== b.year) return a.year > b.year;
    return a.month >= b.month;
  }
}
