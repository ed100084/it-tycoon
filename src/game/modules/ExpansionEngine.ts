import type {
  GameConfig, GameDate, IEventBus, IGameModule,
  AcquisitionTarget, ExpansionConfig,
} from '../core/types';
import { AcquisitionStatus } from '../core/types';
import { addMonths } from '../../utils/gameDate';

// ─── Default config ────────────────────────────────────────────────────────────

const DEFAULT_EXPANSION_CONFIG: ExpansionConfig = {
  acquisitionUnlockYear: 2008,
  newFacilityUnlockYear: 2010,
  integrationMonths: 6,
  integrationMoralePenalty: -15,
  integrationTechDebt: 30,
  drAbilityBonusFromSecondCity: 50,
  acquisitionTargets: [
    { id: 'acq_01', name: '台中資科', city: '台中', annualRevenue: 12_000_000, customerCount: 4, techDebtInherit: 25, acquisitionMultiplier: 2.5, status: AcquisitionStatus.Available, availableFromYear: 2008 },
    { id: 'acq_02', name: '南部IDC',  city: '台南', annualRevenue: 20_000_000, customerCount: 5, techDebtInherit: 35, acquisitionMultiplier: 3.0, status: AcquisitionStatus.Available, availableFromYear: 2010 },
    { id: 'acq_03', name: '雲端新創', city: '台北', annualRevenue: 30_000_000, customerCount: 3, techDebtInherit: 40, acquisitionMultiplier: 3.5, status: AcquisitionStatus.Available, availableFromYear: 2015 },
  ],
};

// ─── Internal state ────────────────────────────────────────────────────────────

interface IntegrationRecord {
  targetId: string;
  targetName: string;
  customersAdded: number;
  techDebt: number;
  integrationCompletesAt: GameDate;
}

interface ExpansionEngineState {
  targets: AcquisitionTarget[];
  integrations: IntegrationRecord[];
  hasSecondFacility: boolean;
  secondFacilityOpened: boolean;
}

// ─── ExpansionEngine ──────────────────────────────────────────────────────────

export class ExpansionEngine implements IGameModule {
  readonly moduleId = 'ExpansionEngine';

  private bus!: IEventBus;
  private cfg!: ExpansionConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubs: Array<() => void> = [];

  private state: ExpansionEngineState = {
    targets: [],
    integrations: [],
    hasSecondFacility: false,
    secondFacilityOpened: false,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getAvailableTargets(currentYear: number): AcquisitionTarget[] {
    return this.state.targets.filter(
      t => t.status === AcquisitionStatus.Available && t.availableFromYear <= currentYear,
    );
  }

  getAcquisitions(): AcquisitionTarget[] {
    return this.state.targets.map(t => ({ ...t }));
  }

  hasSecondFacility(): boolean { return this.state.hasSecondFacility; }

  getDRAbilityBonus(): number {
    return this.state.hasSecondFacility ? this.cfg.drAbilityBonusFromSecondCity : 0;
  }

  acquireTarget(targetId: string): string | null {
    if (this.currentDate.year < this.cfg.acquisitionUnlockYear) {
      return `併購功能在 ${this.cfg.acquisitionUnlockYear} 年後解鎖`;
    }
    const target = this.state.targets.find(t => t.id === targetId);
    if (!target) return '找不到併購目標';
    if (target.status !== AcquisitionStatus.Available) return '該目標目前不可用';
    if (target.availableFromYear > this.currentDate.year) {
      return `${target.name} 在 ${target.availableFromYear} 年後才可併購`;
    }

    const cost = Math.round(target.annualRevenue * target.acquisitionMultiplier);
    // Deduct cost immediately
    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount: cost },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    target.status = AcquisitionStatus.Integrating;

    const integrationCompletesAt = addMonths(this.currentDate, this.cfg.integrationMonths);
    this.state.integrations.push({
      targetId,
      targetName: target.name,
      customersAdded: target.customerCount,
      techDebt: target.techDebtInherit,
      integrationCompletesAt,
    });

    this.bus.publish({
      type: 'expansion.acquisition_started',
      payload: { targetId, name: target.name, cost, integrationMonths: this.cfg.integrationMonths },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    // Apply morale penalty immediately
    this.bus.publish({
      type: 'staff.morale_penalty',
      payload: { delta: this.cfg.integrationMoralePenalty, reason: `整合 ${target.name} 期間士氣下降` },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    return null;
  }

  openSecondFacility(): string | null {
    if (this.currentDate.year < this.cfg.newFacilityUnlockYear) {
      return `異地機房在 ${this.cfg.newFacilityUnlockYear} 年後解鎖`;
    }
    if (this.state.hasSecondFacility) return '已有第二機房';
    const cost = 50_000_000;
    this.bus.publish({
      type: 'hardware.purchased',
      payload: { amount: cost },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    this.state.hasSecondFacility = true;
    this.state.secondFacilityOpened = true;
    this.bus.publish({
      type: 'expansion.second_facility_opened',
      payload: { cost, drBonus: this.cfg.drAbilityBonusFromSecondCity },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    return null;
  }

  acceptBuyout(offeredPrice: number): void {
    this.bus.publish({
      type: 'expansion.buyout_accepted',
      payload: { price: offeredPrice, finalScore: offeredPrice },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.expansion ?? DEFAULT_EXPANSION_CONFIG;
    this.currentDate = { ...config.time.startDate };
    // Deep-clone targets from config so we can mutate status
    this.state.targets = this.cfg.acquisitionTargets.map(t => ({ ...t }));

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
      targets: this.state.targets,
      integrations: this.state.integrations,
      hasSecondFacility: this.state.hasSecondFacility,
      currentDate: this.currentDate,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    this.state.targets           = (saved.targets as AcquisitionTarget[]) ?? this.cfg?.acquisitionTargets?.map(t => ({ ...t })) ?? [];
    this.state.integrations      = (saved.integrations as IntegrationRecord[]) ?? [];
    this.state.hasSecondFacility = (saved.hasSecondFacility as boolean) ?? false;
    if (saved.currentDate) this.currentDate = saved.currentDate as GameDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      targets: this.state.targets,
      hasSecondFacility: this.state.hasSecondFacility,
      integrations: this.state.integrations,
      drAbilityBonus: this.getDRAbilityBonus(),
    });
  }

  destroy(): void {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _onMonthEnd(): void {
    const completed: IntegrationRecord[] = [];
    const remaining: IntegrationRecord[] = [];

    for (const integ of this.state.integrations) {
      const done =
        this.currentDate.year > integ.integrationCompletesAt.year ||
        (this.currentDate.year === integ.integrationCompletesAt.year &&
         this.currentDate.month >= integ.integrationCompletesAt.month);

      if (done) {
        completed.push(integ);
      } else {
        remaining.push(integ);
      }
    }

    this.state.integrations = remaining;

    for (const integ of completed) {
      const target = this.state.targets.find(t => t.id === integ.targetId);
      if (target) target.status = AcquisitionStatus.Completed;

      this.bus.publish({
        type: 'expansion.integration_completed',
        payload: { targetId: integ.targetId, name: integ.targetName, customersAdded: integ.customersAdded },
        source: this.moduleId,
        gameDate: this.currentDate,
      });

      // Inherit tech debt
      if (integ.techDebt > 0) {
        this.bus.publish({
          type: 'techdebt.cascade_failure',
          payload: { affectedCount: 0, description: `整合 ${integ.targetName}：繼承技術債 ${integ.techDebt} 點`, inheritedPoints: integ.techDebt },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }

      // Publish acquired customers
      for (let i = 0; i < integ.customersAdded; i++) {
        this.bus.publish({
          type: 'expansion.customer_inherited',
          payload: { sourceName: integ.targetName, index: i },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }
  }
}
