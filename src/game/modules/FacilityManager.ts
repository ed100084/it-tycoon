// addMonths used in FacilityManager via event payloads only
import {
  CoolingLevel,
  ClimateRisk,
  FacilityRegion,
  ExpenseCategory,
} from '../core/types';
import type {
  EntityId,
  FacilityModuleConfig,
  FacilityRegionState,
  GameConfig,
  GameDate,
  IEventBus,
  IGameModule,
  Money,
} from '../core/types';

// ─── Default config fallback ──────────────────────────────────────────────────

const DEFAULT_FACILITY_CONFIG: FacilityModuleConfig = {
  regions: {
    [FacilityRegion.North]: {
      initialUnits: 100,
      baseMonthlyRent: 200_000,
      performanceBonus: 1.0,
      climateRisk: ClimateRisk.Low,
    },
    [FacilityRegion.Central]: {
      initialUnits: 500,
      baseMonthlyRent: 800_000,
      performanceBonus: 1.15,
      climateRisk: ClimateRisk.Medium,
      unlockMinMonthlyRevenue: 1_000_000,
    },
    [FacilityRegion.South]: {
      initialUnits: 2000,
      baseMonthlyRent: 2_500_000,
      performanceBonus: 1.30,
      climateRisk: ClimateRisk.High,
      unlockMinMonthlyRevenue: 10_000_000,
    },
  },
  coolingLevels: {
    [CoolingLevel.Open]:      { pue: 2.00, investmentCost: 0,          unlockYear: 2000 },
    [CoolingLevel.BasicAC]:   { pue: 1.80, investmentCost: 500_000,    unlockYear: 2000 },
    [CoolingLevel.HotAisle]:  { pue: 1.60, investmentCost: 1_500_000,  unlockYear: 2002 },
    [CoolingLevel.Chiller]:   { pue: 1.40, investmentCost: 5_000_000,  unlockYear: 2005 },
    [CoolingLevel.InRow]:     { pue: 1.25, investmentCost: 8_000_000,  unlockYear: 2008 },
    [CoolingLevel.Liquid]:    { pue: 1.10, investmentCost: 15_000_000, unlockYear: 2013 },
    [CoolingLevel.Immersion]: { pue: 1.05, investmentCost: 30_000_000, unlockYear: 2018 },
  },
  expansionCostMultiplier: 24,
  expansionCapacityMultiplier: 0.5,
  capacityWarningThreshold: 0.85,
  geoRedundancyThreshold: 0.50,
  geoRedundancySLABonus: -0.30,
  electricityRates: [{ fromYear: 2000, ratePerKwh: 2.50 }],
  hoursPerMonth: 744,
};

// ─── Internal state ───────────────────────────────────────────────────────────

interface FacilityManagerState {
  regions: Record<FacilityRegion, FacilityRegionState>;
  globalPUEBonus: number;
  econElecMod: number;
  geoRedundancyActive: boolean;
  lastMonthlyRevenue: Money;
}

function getElectricityRate(
  rates: Array<{ fromYear: number; ratePerKwh: number }>,
  year: number,
): number {
  let rate = rates[0].ratePerKwh;
  for (const r of rates) {
    if (year >= r.fromYear) rate = r.ratePerKwh;
    else break;
  }
  return rate;
}

function makeFacilityRegionState(
  region: FacilityRegion,
  cfg: FacilityModuleConfig,
): FacilityRegionState {
  const regionCfg = cfg.regions[region];
  const coolingCfg = cfg.coolingLevels[CoolingLevel.Open];
  return {
    region,
    isUnlocked: region === FacilityRegion.North,
    totalUnits: regionCfg.initialUnits,
    usedUnits: 0,
    utilizationRate: 0,
    coolingLevel: CoolingLevel.Open,
    pue: coolingCfg.pue,
    totalWatts: 0,
    monthlyRent: regionCfg.baseMonthlyRent,
    assignedStaffIds: [],
    climateRisk: regionCfg.climateRisk,
    expansionCount: 0,
  };
}

// ─── FacilityManager ──────────────────────────────────────────────────────────

export class FacilityManager implements IGameModule {
  readonly moduleId = 'FacilityManager';

  private bus!: IEventBus;
  private cfg!: FacilityModuleConfig;
  private currentDate!: GameDate;

  private state: FacilityManagerState = {
    regions: {} as Record<FacilityRegion, FacilityRegionState>,
    globalPUEBonus: 0,
    econElecMod: 1.0,
    geoRedundancyActive: false,
    lastMonthlyRevenue: 0,
  };

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.facility ?? DEFAULT_FACILITY_CONFIG;
    this.currentDate = { ...config.time.startDate };

    for (const region of Object.values(FacilityRegion)) {
      this.state.regions[region] = makeFacilityRegionState(region, this.cfg);
    }

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
      this.onMonthEnd();
    }, this.moduleId);

    bus.subscribe('hardware.installed', (e) => {
      const p = e.payload as { region: FacilityRegion; watts: number; units: number };
      this.onHardwareInstalled(p.region, p.watts, p.units);
    }, this.moduleId);

    bus.subscribe('hardware.removed', (e) => {
      const p = e.payload as { region: FacilityRegion; watts: number; units: number };
      this.onHardwareRemoved(p.region, p.watts, p.units);
    }, this.moduleId);

    bus.subscribe('finance.monthly_settlement', (e) => {
      const p = e.payload as { totalRevenue?: Money };
      if (p.totalRevenue !== undefined) {
        this.state.lastMonthlyRevenue = p.totalRevenue;
        this.checkRegionUnlocks();
      }
    }, this.moduleId);
  }

  tick(_deltaMs: number): void {
    // Time-based logic handled in event handlers
  }

  // ── Private helpers ───────────────────────────────────────────────

  private onMonthEnd(): void {
    for (const region of Object.values(FacilityRegion)) {
      const r = this.state.regions[region];
      if (!r.isUnlocked) continue;
      this.emitElectricityDue(region);
      this.emitRentDue(region);
      this.checkCapacityWarning(region);
    }
    this.updateGeoRedundancy();
  }

  private emitElectricityDue(region: FacilityRegion): void {
    const amount = this.estimateMonthlyElectricity(region);
    if (amount <= 0) return;
    this.bus.publish({
      type: 'facility.electricity_due',
      payload: { region, amount, date: this.currentDate },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    this.bus.publish({
      type: 'finance.expense_requested',
      payload: {
        category: ExpenseCategory.Electricity,
        amount,
        date: this.currentDate,
        description: `Electricity — ${region}`,
        isCashExpense: true,
      },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  private emitRentDue(region: FacilityRegion): void {
    const amount = this.state.regions[region].monthlyRent;
    this.bus.publish({
      type: 'facility.rent_due',
      payload: { region, amount, date: this.currentDate },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    this.bus.publish({
      type: 'finance.expense_requested',
      payload: {
        category: ExpenseCategory.FacilityRent,
        amount,
        date: this.currentDate,
        description: `Rent — ${region}`,
        isCashExpense: true,
      },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  private checkCapacityWarning(region: FacilityRegion): void {
    const r = this.state.regions[region];
    if (r.utilizationRate >= this.cfg.capacityWarningThreshold) {
      this.bus.publish({
        type: 'facility.capacity_warning',
        payload: { region, utilizationRate: r.utilizationRate },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private checkRegionUnlocks(): void {
    for (const region of [FacilityRegion.Central, FacilityRegion.South]) {
      const r = this.state.regions[region];
      if (r.isUnlocked) continue;
      const minRevenue = this.cfg.regions[region].unlockMinMonthlyRevenue;
      if (minRevenue !== undefined && this.state.lastMonthlyRevenue >= minRevenue) {
        r.isUnlocked = true;
        this.bus.publish({
          type: 'facility.region_unlocked',
          payload: { region },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }
  }

  private updateGeoRedundancy(): void {
    const allUnlocked = Object.values(FacilityRegion).every(
      r => this.state.regions[r].isUnlocked,
    );
    const allMeetThreshold = Object.values(FacilityRegion).every(
      r => this.state.regions[r].utilizationRate >= this.cfg.geoRedundancyThreshold,
    );
    const active = allUnlocked && allMeetThreshold;
    if (active !== this.state.geoRedundancyActive) {
      this.state.geoRedundancyActive = active;
      this.bus.publish({
        type: 'facility.geo_redundancy_changed',
        payload: { active },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private onHardwareInstalled(region: FacilityRegion, watts: number, units: number): void {
    const r = this.state.regions[region];
    if (!r) return;
    r.totalWatts += watts;
    r.usedUnits += units;
    r.utilizationRate = r.totalUnits > 0 ? r.usedUnits / r.totalUnits : 0;
  }

  private onHardwareRemoved(region: FacilityRegion, watts: number, units: number): void {
    const r = this.state.regions[region];
    if (!r) return;
    r.totalWatts = Math.max(0, r.totalWatts - watts);
    r.usedUnits = Math.max(0, r.usedUnits - units);
    r.utilizationRate = r.totalUnits > 0 ? r.usedUnits / r.totalUnits : 0;
  }

  private computePUE(region: FacilityRegion): number {
    const level = this.state.regions[region].coolingLevel;
    const basePUE = this.cfg.coolingLevels[level].pue;
    return Math.max(1.0, basePUE - this.state.globalPUEBonus);
  }

  // ── Public API ────────────────────────────────────────────────────

  getRegions(): FacilityRegionState[] {
    return Object.values(this.state.regions);
  }

  getRegion(region: FacilityRegion): FacilityRegionState | null {
    return this.state.regions[region] ?? null;
  }

  getGlobalPUE(): number {
    let totalWatts = 0;
    let weightedPUE = 0;
    for (const region of Object.values(FacilityRegion)) {
      const r = this.state.regions[region];
      if (!r.isUnlocked || r.totalWatts === 0) continue;
      totalWatts += r.totalWatts;
      weightedPUE += this.computePUE(region) * r.totalWatts;
    }
    return totalWatts > 0 ? weightedPUE / totalWatts : this.cfg.coolingLevels[CoolingLevel.Open].pue;
  }

  unlockRegion(region: FacilityRegion): boolean {
    const r = this.state.regions[region];
    if (r.isUnlocked) return false;
    r.isUnlocked = true;
    this.bus.publish({
      type: 'facility.region_unlocked',
      payload: { region },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    return true;
  }

  estimateMonthlyElectricity(region: FacilityRegion): Money {
    const r = this.state.regions[region];
    if (!r.isUnlocked || r.totalWatts === 0) return 0;
    const rate = getElectricityRate(this.cfg.electricityRates, this.currentDate.year);
    const pue = this.computePUE(region);
    const kwh = (r.totalWatts * this.cfg.hoursPerMonth) / 1000;
    return Math.round(kwh * rate * pue * this.state.econElecMod);
  }

  getTotalMonthlyElectricity(): Money {
    return Object.values(FacilityRegion).reduce(
      (sum, r) => sum + this.estimateMonthlyElectricity(r),
      0,
    );
  }

  getTotalMonthlyRent(): Money {
    return Object.values(FacilityRegion).reduce((sum, r) => {
      const s = this.state.regions[r];
      return sum + (s.isUnlocked ? s.monthlyRent : 0);
    }, 0);
  }

  upgradeCooling(region: FacilityRegion, level: CoolingLevel): boolean {
    const r = this.state.regions[region];
    if (!r.isUnlocked) return false;
    if (level <= r.coolingLevel) return false;
    const levelCfg = this.cfg.coolingLevels[level];
    if (this.currentDate.year < levelCfg.unlockYear) return false;

    const cost = levelCfg.investmentCost;
    const oldPUE = r.pue;
    r.coolingLevel = level;
    r.pue = this.computePUE(region);

    this.bus.publish({
      type: 'facility.cooling_upgraded',
      payload: { region, level, newPUE: r.pue },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    this.bus.publish({
      type: 'facility.pue_changed',
      payload: { region, oldPUE, newPUE: r.pue },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    if (cost > 0) {
      this.bus.publish({
        type: 'finance.expense_requested',
        payload: {
          category: ExpenseCategory.Other,
          amount: cost,
          date: this.currentDate,
          description: `Cooling upgrade — ${region} to level ${level}`,
          isCashExpense: true,
        },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
    return true;
  }

  expandCapacity(region: FacilityRegion): boolean {
    const r = this.state.regions[region];
    if (!r.isUnlocked) return false;
    const cost = r.monthlyRent * this.cfg.expansionCostMultiplier;
    const addedUnits = Math.floor(r.totalUnits * this.cfg.expansionCapacityMultiplier);
    r.totalUnits += addedUnits;
    r.expansionCount++;
    r.utilizationRate = r.totalUnits > 0 ? r.usedUnits / r.totalUnits : 0;

    this.bus.publish({
      type: 'facility.expansion_completed',
      payload: { region, newCapacity: r.totalUnits },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    this.bus.publish({
      type: 'finance.expense_requested',
      payload: {
        category: ExpenseCategory.Other,
        amount: cost,
        date: this.currentDate,
        description: `Capacity expansion — ${region}`,
        isCashExpense: true,
      },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    return true;
  }

  assignEngineer(region: FacilityRegion, staffId: EntityId): void {
    const r = this.state.regions[region];
    if (r && !r.assignedStaffIds.includes(staffId)) {
      r.assignedStaffIds.push(staffId);
    }
  }

  getUsedUnits(region: FacilityRegion): number {
    return this.state.regions[region]?.usedUnits ?? 0;
  }

  hasGeoRedundancy(): boolean {
    return this.state.geoRedundancyActive;
  }

  hasCoolingLevel(level: CoolingLevel): boolean {
    return Object.values(this.state.regions).some(
      r => r.isUnlocked && r.coolingLevel >= level,
    );
  }

  // ── IGameModule ───────────────────────────────────────────────────

  serialize(): Record<string, unknown> {
    return {
      regions: this.state.regions,
      globalPUEBonus: this.state.globalPUEBonus,
      econElecMod: this.state.econElecMod,
      geoRedundancyActive: this.state.geoRedundancyActive,
      lastMonthlyRevenue: this.state.lastMonthlyRevenue,
      currentDate: this.currentDate,
    };
  }

  deserialize(raw: Record<string, unknown>): void {
    const s = raw as unknown as FacilityManagerState & { currentDate: GameDate };
    this.state = {
      regions: s.regions,
      globalPUEBonus: s.globalPUEBonus,
      econElecMod: s.econElecMod,
      geoRedundancyActive: s.geoRedundancyActive,
      lastMonthlyRevenue: s.lastMonthlyRevenue,
    };
    if (s.currentDate) this.currentDate = s.currentDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this.state, currentDate: this.currentDate });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }
}
