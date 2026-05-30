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
  RegionMaintenanceState,
} from '../core/types';

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

let _fmSeed = 500;
function fmRand(): number {
  const x = Math.sin(_fmSeed++ * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const MAINTENANCE_INTERVAL_MONTHS = 6;
const GENERATOR_MAINTENANCE_INTERVAL_MONTHS = 3;
const TYPHOON_OUTAGE_PROBABILITY_NO_MAINT = 0.30;

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

function defaultMaintenanceState(): RegionMaintenanceState {
  return {
    lastMaintenanceDate: null,
    monthsSinceMaintenance: 0,
    maintenanceDue: false,
    isUnderMaintenance: false,
    maintenanceCompletesAt: null,
    generatorLastMaintenance: null,
    generatorMonthsSinceMaintenance: 0,
    generatorMaintenanceDue: false,
    generatorHealthy: true,
    peakSeasonActive: false,
  };
}

interface FacilityManagerState {
  regions: Record<FacilityRegion, FacilityRegionState>;
  maintenanceStates: Record<FacilityRegion, RegionMaintenanceState>;
  globalPUEBonus: number;
  econElecMod: number;
  geoRedundancyActive: boolean;
  lastMonthlyRevenue: Money;
  peakSeasonPUEMod: number;
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
    maintenanceStates: {} as Record<FacilityRegion, RegionMaintenanceState>,
    globalPUEBonus: 0,
    econElecMod: 1.0,
    geoRedundancyActive: false,
    lastMonthlyRevenue: 0,
    peakSeasonPUEMod: 0,
  };

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.facility ?? DEFAULT_FACILITY_CONFIG;
    this.currentDate = { ...config.time.startDate };

    for (const region of Object.values(FacilityRegion)) {
      this.state.regions[region] = makeFacilityRegionState(region, this.cfg);
      this.state.maintenanceStates[region] = defaultMaintenanceState();
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
    this.updatePeakSeason();
    for (const region of Object.values(FacilityRegion)) {
      const r = this.state.regions[region];
      if (!r.isUnlocked) continue;
      this.tickMaintenance(region);
      this.checkTyphoon(region);
      this.emitElectricityDue(region);
      this.emitRentDue(region);
      this.checkCapacityWarning(region);
    }
    this.updateGeoRedundancy();
  }

  private updatePeakSeason(): void {
    const month = this.currentDate.month;
    const inPeak = month >= 6 && month <= 9;
    this.state.peakSeasonPUEMod = inPeak ? 0.1 : 0;
    for (const region of Object.values(FacilityRegion)) {
      const maint = this.state.maintenanceStates[region];
      maint.peakSeasonActive = inPeak;
    }
  }

  private tickMaintenance(region: FacilityRegion): void {
    const maint = this.state.maintenanceStates[region];

    // Tick maintenance counters
    maint.monthsSinceMaintenance++;
    maint.generatorMonthsSinceMaintenance++;

    // Complete scheduled maintenance
    if (maint.isUnderMaintenance && maint.maintenanceCompletesAt) {
      const done =
        this.currentDate.year > maint.maintenanceCompletesAt.year ||
        (this.currentDate.year === maint.maintenanceCompletesAt.year &&
          this.currentDate.month >= maint.maintenanceCompletesAt.month);
      if (done) {
        maint.isUnderMaintenance = false;
        maint.maintenanceCompletesAt = null;
        maint.lastMaintenanceDate = { ...this.currentDate };
        maint.monthsSinceMaintenance = 0;
        maint.maintenanceDue = false;
        this.bus.publish({
          type: 'facility.maintenance_completed',
          payload: { region },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }

    // Check if maintenance is due
    if (maint.monthsSinceMaintenance >= MAINTENANCE_INTERVAL_MONTHS) {
      maint.maintenanceDue = true;
      this.bus.publish({
        type: 'facility.maintenance_due',
        payload: { region, monthsOverdue: maint.monthsSinceMaintenance - MAINTENANCE_INTERVAL_MONTHS },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
      // Overdue: double failure rate signal
      if (maint.monthsSinceMaintenance > MAINTENANCE_INTERVAL_MONTHS) {
        this.bus.publish({
          type: 'facility.maintenance_overdue',
          payload: { region, failureRateMod: 2.0 },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }

    // Generator maintenance due
    if (maint.generatorMonthsSinceMaintenance >= GENERATOR_MAINTENANCE_INTERVAL_MONTHS) {
      maint.generatorMaintenanceDue = true;
      if (!maint.generatorHealthy) return; // already degraded
      // Small chance generator degrades if overdue
      if (maint.generatorMonthsSinceMaintenance > GENERATOR_MAINTENANCE_INTERVAL_MONTHS + 1) {
        maint.generatorHealthy = false;
      }
    }
  }

  private checkTyphoon(region: FacilityRegion): void {
    // Typhoon season: July–October
    const month = this.currentDate.month;
    if (month < 7 || month > 10) return;

    // Only affects high climate risk regions (South) most heavily
    const r = this.state.regions[region];
    const baseProbability = r.climateRisk === 'HIGH' ? 0.12 : r.climateRisk === 'MEDIUM' ? 0.06 : 0.02;
    if (fmRand() > baseProbability) return;

    const maint = this.state.maintenanceStates[region];
    const outageProbability = maint.generatorHealthy ? 0.0 : TYPHOON_OUTAGE_PROBABILITY_NO_MAINT;

    this.bus.publish({
      type: 'facility.typhoon_event',
      payload: {
        region,
        outageProbability,
        generatorHealthy: maint.generatorHealthy,
        month,
      },
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    if (fmRand() < outageProbability) {
      // Power outage
      this.bus.publish({
        type: 'facility.power_outage',
        payload: { region, durationHours: 2 + Math.floor(fmRand() * 6) },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
      this.bus.publish({
        type: 'reputation.modifier_added',
        payload: { delta: -10, description: '颱風停電事件', isOneTime: true, source: 'typhoon' },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
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
    return Math.max(1.0, basePUE - this.state.globalPUEBonus + this.state.peakSeasonPUEMod);
  }

  // ── Public API ────────────────────────────────────────────────────

  getRegions(): FacilityRegionState[] {
    return Object.values(this.state.regions);
  }

  getMaintenanceState(region: FacilityRegion): RegionMaintenanceState {
    return { ...this.state.maintenanceStates[region] };
  }

  getAllMaintenanceStates(): Record<FacilityRegion, RegionMaintenanceState> {
    const out = {} as Record<FacilityRegion, RegionMaintenanceState>;
    for (const r of Object.values(FacilityRegion)) {
      out[r] = { ...this.state.maintenanceStates[r] };
    }
    return out;
  }

  /** Schedule routine maintenance for a region. offPeak = schedule during weekend/night hours. */
  scheduleMaintenance(region: FacilityRegion, offPeak = false): boolean {
    const r = this.state.regions[region];
    if (!r?.isUnlocked) return false;
    const maint = this.state.maintenanceStates[region];
    if (maint.isUnderMaintenance) return false;

    maint.isUnderMaintenance = true;
    maint.maintenanceCompletesAt = {
      year: this.currentDate.month === 12 ? this.currentDate.year + 1 : this.currentDate.year,
      month: this.currentDate.month === 12 ? 1 : this.currentDate.month + 1,
    };

    // Cost: base maintenance cost (1% of monthly rent)
    const baseCost = Math.round(r.monthlyRent * 0.01);
    const cost = offPeak ? Math.round(baseCost * 1.5) : baseCost;

    this.bus.publish({
      type: 'facility.maintenance_scheduled',
      payload: { region, offPeak, cost },
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    if (cost > 0) {
      this.bus.publish({
        type: 'finance.expense_requested',
        payload: {
          category: ExpenseCategory.Maintenance,
          amount: cost,
          date: this.currentDate,
          description: `Routine maintenance — ${region}${offPeak ? ' (off-peak)' : ''}`,
          isCashExpense: true,
        },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
    return true;
  }

  /** Perform generator maintenance (quarterly recommended). */
  performGeneratorMaintenance(region: FacilityRegion): boolean {
    const r = this.state.regions[region];
    if (!r?.isUnlocked) return false;
    const maint = this.state.maintenanceStates[region];

    maint.generatorHealthy = true;
    maint.generatorLastMaintenance = { ...this.currentDate };
    maint.generatorMonthsSinceMaintenance = 0;
    maint.generatorMaintenanceDue = false;

    const cost = 15_000;
    this.bus.publish({
      type: 'facility.generator_maintained',
      payload: { region },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    this.bus.publish({
      type: 'finance.expense_requested',
      payload: {
        category: ExpenseCategory.Maintenance,
        amount: cost,
        date: this.currentDate,
        description: `Generator maintenance — ${region}`,
        isCashExpense: true,
      },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    return true;
  }

  getPeakSeasonPUEMod(): number {
    return this.state.peakSeasonPUEMod;
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
      maintenanceStates: this.state.maintenanceStates,
      globalPUEBonus: this.state.globalPUEBonus,
      econElecMod: this.state.econElecMod,
      geoRedundancyActive: this.state.geoRedundancyActive,
      lastMonthlyRevenue: this.state.lastMonthlyRevenue,
      peakSeasonPUEMod: this.state.peakSeasonPUEMod,
      currentDate: this.currentDate,
    };
  }

  deserialize(raw: Record<string, unknown>): void {
    const s = raw as unknown as FacilityManagerState & { currentDate: GameDate };
    this.state = {
      regions: s.regions,
      maintenanceStates: (s.maintenanceStates as Record<FacilityRegion, RegionMaintenanceState>) ?? this.state.maintenanceStates,
      globalPUEBonus: s.globalPUEBonus,
      econElecMod: s.econElecMod,
      geoRedundancyActive: s.geoRedundancyActive,
      lastMonthlyRevenue: s.lastMonthlyRevenue,
      peakSeasonPUEMod: s.peakSeasonPUEMod ?? 0,
    };
    // Ensure maintenance states exist for all regions
    for (const region of Object.values(FacilityRegion)) {
      if (!this.state.maintenanceStates[region]) {
        this.state.maintenanceStates[region] = defaultMaintenanceState();
      }
    }
    if (s.currentDate) this.currentDate = s.currentDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this.state, currentDate: this.currentDate });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }
}
