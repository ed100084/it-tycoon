/**
 * Thin Zustand layer that mirrors the GameEngine state for React components.
 * Components never touch the GameEngine or EventBus directly — they read from
 * this store and call actions here (which delegate to the engine).
 */
import { create } from 'zustand';
import type {
  BidParams,
  Contract,
  CreditRating,
  FacilityRegion,
  FacilityRegionState,
  GameDate,
  GameSpeed,
  HardwareAsset,
  HardwareModel,
  Loan,
  Money,
  PauseReason,
  PLStatement,
  PurchasePaymentMethod,
  RFP,
  SoftwareLicense,
  SoftwareProduct,
  CoolingLevel,
} from '../game/core/types';
import type { GameEngine } from '../game/core/GameEngine';
import type { TimeEngine } from '../game/modules/TimeEngine';
import type { FinanceEngine } from '../game/modules/FinanceEngine';
import type { FacilityManager } from '../game/modules/FacilityManager';
import type { HardwareCatalog } from '../game/modules/HardwareCatalog';
import type { SoftwareCatalog } from '../game/modules/SoftwareCatalog';
import type { ContractManager } from '../game/modules/ContractManager';

export interface UIState {
  // Time
  currentDate: GameDate;
  speed: GameSpeed;
  isPaused: boolean;
  pauseReason: PauseReason | null;

  // Finance
  cash: Money;
  creditRating: CreditRating | null;
  lastPL: PLStatement | null;
  activeLoans: Loan[];

  // Facility
  facilityRegions: FacilityRegionState[];

  // Hardware
  availableHardwareModels: HardwareModel[];
  hardwareAssets: HardwareAsset[];

  // Software
  availableSoftwareProducts: SoftwareProduct[];
  softwareLicenses: SoftwareLicense[];
  complianceScore: number;

  // Contracts
  pendingRFPs: RFP[];
  activeContracts: Contract[];
  monthlyRevenueEstimate: Money;

  // Engine ref (not reactive, just for actions)
  _engine: GameEngine | null;

  // Actions
  setSpeed: (speed: GameSpeed) => void;
  resume: () => void;
  applyForLoan: (amount: Money, termMonths: number) => string | null;
  saveGame: () => void;
  upgradeCooling: (region: FacilityRegion, level: CoolingLevel) => void;
  expandCapacity: (region: FacilityRegion) => void;
  unlockRegion: (region: FacilityRegion) => void;
  purchaseHardware: (modelId: string, qty: number, region: FacilityRegion, method: PurchasePaymentMethod) => void;
  disposeHardware: (assetId: string) => void;
  purchaseSoftware: (productId: string) => void;
  cancelSoftwareLicense: (licenseId: string) => void;
  submitContractBid: (rfpId: string, bid: BidParams) => void;
  declineRFP: (rfpId: string) => void;
  declineContractRenewal: (contractId: string) => void;
  _connectEngine: (engine: GameEngine) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  currentDate: { year: 2000, month: 1 },
  speed: 1,
  isPaused: false,
  pauseReason: null,
  cash: 0,
  creditRating: null,
  lastPL: null,
  activeLoans: [],
  facilityRegions: [],
  availableHardwareModels: [],
  hardwareAssets: [],
  availableSoftwareProducts: [],
  softwareLicenses: [],
  complianceScore: 100,
  pendingRFPs: [],
  activeContracts: [],
  monthlyRevenueEstimate: 0,
  _engine: null,

  setSpeed(speed) {
    const engine = get()._engine;
    if (!engine) return;
    engine.getModule<TimeEngine>('TimeEngine').setSpeed(speed);
  },

  resume() {
    const engine = get()._engine;
    if (!engine) return;
    engine.getModule<TimeEngine>('TimeEngine').resume();
  },

  applyForLoan(amount, termMonths) {
    const engine = get()._engine;
    if (!engine) return null;
    return engine.getModule<FinanceEngine>('FinanceEngine').applyForLoan(amount, termMonths);
  },

  saveGame() {
    get()._engine?.save();
  },

  upgradeCooling(region, level) {
    const engine = get()._engine;
    if (!engine) return;
    const fm = engine.getModule<FacilityManager>('FacilityManager');
    fm.upgradeCooling(region, level);
    set({ facilityRegions: fm.getRegions() });
  },

  expandCapacity(region) {
    const engine = get()._engine;
    if (!engine) return;
    const fm = engine.getModule<FacilityManager>('FacilityManager');
    fm.expandCapacity(region);
    set({ facilityRegions: fm.getRegions() });
  },

  unlockRegion(region) {
    const engine = get()._engine;
    if (!engine) return;
    const fm = engine.getModule<FacilityManager>('FacilityManager');
    fm.unlockRegion(region);
    set({ facilityRegions: fm.getRegions() });
  },

  purchaseHardware(modelId, qty, region, method) {
    const engine = get()._engine;
    if (!engine) return;
    const hw = engine.getModule<HardwareCatalog>('HardwareCatalog');
    hw.purchase(modelId, qty, region, method);
    set({ hardwareAssets: hw.getAssets() });
  },

  disposeHardware(assetId) {
    const engine = get()._engine;
    if (!engine) return;
    const hw = engine.getModule<HardwareCatalog>('HardwareCatalog');
    hw.dispose(assetId);
    set({ hardwareAssets: hw.getAssets() });
  },

  purchaseSoftware(productId) {
    const engine = get()._engine;
    if (!engine) return;
    const sw = engine.getModule<SoftwareCatalog>('SoftwareCatalog');
    sw.purchaseLicense(productId);
    set({ softwareLicenses: sw.getLicenses(), complianceScore: sw.getComplianceScore() });
  },

  cancelSoftwareLicense(licenseId) {
    const engine = get()._engine;
    if (!engine) return;
    const sw = engine.getModule<SoftwareCatalog>('SoftwareCatalog');
    sw.cancelSubscription(licenseId);
    set({ softwareLicenses: sw.getLicenses() });
  },

  submitContractBid(rfpId, bid) {
    const engine = get()._engine;
    if (!engine) return;
    const cm = engine.getModule<ContractManager>('ContractManager');
    cm.submitBid(rfpId, bid);
    set({ pendingRFPs: cm.getPendingRFPs() });
  },

  declineRFP(rfpId) {
    const engine = get()._engine;
    if (!engine) return;
    const cm = engine.getModule<ContractManager>('ContractManager');
    cm.declineRFP(rfpId);
    set({ pendingRFPs: cm.getPendingRFPs() });
  },

  declineContractRenewal(contractId) {
    const engine = get()._engine;
    if (!engine) return;
    const cm = engine.getModule<ContractManager>('ContractManager');
    cm.declineRenewal(contractId);
    set({ activeContracts: cm.getActiveContracts() });
  },

  _connectEngine(engine) {
    const time = engine.getModule<TimeEngine>('TimeEngine');
    const finance = engine.getModule<FinanceEngine>('FinanceEngine');
    const fm = engine.getModule<FacilityManager>('FacilityManager');
    const hw = engine.getModule<HardwareCatalog>('HardwareCatalog');
    const sw = engine.getModule<SoftwareCatalog>('SoftwareCatalog');
    const cm = engine.getModule<ContractManager>('ContractManager');

    set({
      _engine: engine,
      currentDate: time.getCurrentDate(),
      speed: time.getSpeed(),
      isPaused: time.isPaused(),
      pauseReason: null,
      cash: finance.getCash(),
      creditRating: finance.getCreditRating(),
      lastPL: finance.getLastMonthPL(),
      activeLoans: finance.getActiveLoans(),
      facilityRegions: fm.getRegions(),
      availableHardwareModels: hw.getAvailableModels(time.getCurrentDate()),
      hardwareAssets: hw.getAssets(),
      availableSoftwareProducts: sw.getAvailableProducts(time.getCurrentDate()),
      softwareLicenses: sw.getLicenses(),
      complianceScore: sw.getComplianceScore(),
      pendingRFPs: cm.getPendingRFPs(),
      activeContracts: cm.getActiveContracts(),
      monthlyRevenueEstimate: cm.getMonthlyRevenueEstimate(),
    });

    const bus = engine.bus;

    bus.subscribe('time.month_end', () => {
      set({
        currentDate: time.getCurrentDate(),
        cash: finance.getCash(),
        lastPL: finance.getLastMonthPL(),
        activeLoans: finance.getActiveLoans(),
        creditRating: finance.getCreditRating(),
        facilityRegions: fm.getRegions(),
        availableHardwareModels: hw.getAvailableModels(time.getCurrentDate()),
        hardwareAssets: hw.getAssets(),
        softwareLicenses: sw.getLicenses(),
        complianceScore: sw.getComplianceScore(),
        pendingRFPs: cm.getPendingRFPs(),
        activeContracts: cm.getActiveContracts(),
        monthlyRevenueEstimate: cm.getMonthlyRevenueEstimate(),
      });
    });

    bus.subscribe('time.paused', (e) => {
      const p = e.payload as { reason: PauseReason; speed: GameSpeed };
      set({ isPaused: true, pauseReason: p.reason, speed: 0 });
    });

    bus.subscribe('time.resumed', (e) => {
      const p = e.payload as { speed: GameSpeed };
      set({ isPaused: false, pauseReason: null, speed: p.speed });
    });

    bus.subscribe('time.speed_changed', (e) => {
      const p = e.payload as { from: GameSpeed; to: GameSpeed };
      set({ speed: p.to, isPaused: p.to === 0 });
    });

    bus.subscribe('finance.monthly_settlement', () => {
      set({
        cash: finance.getCash(),
        lastPL: finance.getLastMonthPL(),
        creditRating: finance.getCreditRating(),
        activeLoans: finance.getActiveLoans(),
      });
    });

    bus.subscribe('finance.loan_approved', () => {
      set({ cash: finance.getCash(), activeLoans: finance.getActiveLoans() });
    });

    bus.subscribe('contract.rfp_received', () => {
      set({ pendingRFPs: cm.getPendingRFPs() });
    });

    bus.subscribe('contract.signed', () => {
      set({
        activeContracts: cm.getActiveContracts(),
        monthlyRevenueEstimate: cm.getMonthlyRevenueEstimate(),
      });
    });

    bus.subscribe('hardware.installed', () => {
      set({ facilityRegions: fm.getRegions(), hardwareAssets: hw.getAssets() });
    });

    bus.subscribe('hardware.removed', () => {
      set({ facilityRegions: fm.getRegions(), hardwareAssets: hw.getAssets() });
    });

    bus.subscribe('software.compliance_changed', () => {
      set({ complianceScore: sw.getComplianceScore() });
    });
  },
}));
