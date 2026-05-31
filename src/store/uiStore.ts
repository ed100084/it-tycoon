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
import type { TutorialStep } from '../game/modules/TutorialEngine';
import type { TutorialEngine } from '../game/modules/TutorialEngine';
import type { GameEngine } from '../game/core/GameEngine';
import type { TimeEngine } from '../game/modules/TimeEngine';
import type { FinanceEngine } from '../game/modules/FinanceEngine';
import type { FacilityManager } from '../game/modules/FacilityManager';
import type { HardwareCatalog } from '../game/modules/HardwareCatalog';
import type { SoftwareCatalog } from '../game/modules/SoftwareCatalog';
import type { ContractManager } from '../game/modules/ContractManager';
import type { StaffManager } from '../game/modules/StaffManager';
import type { SecurityEngine } from '../game/modules/SecurityEngine';
import type { EventTimeline } from '../game/modules/EventTimeline';
import type { TechTree } from '../game/modules/TechTree';
import type { ReputationEngine } from '../game/modules/ReputationEngine';
import type {
  StaffMember, JobOpening, ShiftMode, Incident, TechNode, HistoricalEvent,
  GlobalModifier, EconomicCycleState, EventDecision,
  Achievement, Competitor, ActiveRandomEvent, RegionMaintenanceState,
  TechDebtItem, TechDebtLevel, ComplianceCertRecord, ComplianceCertType,
  AcquisitionTarget, EnergyState, ElectricityStrategy, ActiveEventChain,
} from '../game/core/types';
import type { AchievementEngine } from '../game/modules/AchievementEngine';
import type { CompetitorEngine } from '../game/modules/CompetitorEngine';
import type { StrategyEngine } from '../game/modules/StrategyEngine';
import type { CustomerEngine } from '../game/modules/CustomerEngine';
import type { VendorEngine } from '../game/modules/VendorEngine';
import type { BoardEngine } from '../game/modules/BoardEngine';
import type { TechDebtEngine } from '../game/modules/TechDebtEngine';
import type { ComplianceEngine } from '../game/modules/ComplianceEngine';
import type { ExpansionEngine } from '../game/modules/ExpansionEngine';
import type { EnergyEngine } from '../game/modules/EnergyEngine';
import type {
  NamedCustomer, VendorRelationship, KPITarget, BoardYearResult,
  StrategyScores, CertificationType, DRDrill,
} from '../game/core/types';

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

  // Staff
  staffList: StaffMember[];
  jobOpenings: JobOpening[];
  shiftMode: ShiftMode | null;
  monthlyPayroll: Money;

  // Security
  activeIncidents: Incident[];
  securityPostureScore: number;
  securityComplianceScore: number;

  // EventTimeline
  triggeredEvents: HistoricalEvent[];
  activeModifiers: GlobalModifier[];
  pendingDecisions: EventDecision[];
  economicCycle: EconomicCycleState | null;

  // TechTree
  techNodes: TechNode[];

  // Reputation
  satisfactionScore: number;

  // Finance history (last 12 months)
  plHistory: PLStatement[];

  // Tutorial
  tutorialStep: TutorialStep | null;

  // Achievements
  achievements: Achievement[];

  // Competitors
  competitors: Competitor[];
  playerMarketShare: number;

  // Random events (pending player decision)
  activeRandomEvents: ActiveRandomEvent[];

  // Maintenance
  maintenanceStates: Record<FacilityRegion, RegionMaintenanceState> | null;

  // Strategy
  strategyScores: StrategyScores;
  strategyDominantRoute: string | null;
  strategyEstablishedRoutes: string[];

  // Customers
  namedCustomers: NamedCustomer[];

  // Vendors
  vendors: VendorRelationship[];

  // Board / KPI
  boardKPIs: KPITarget[];
  boardYearResults: BoardYearResult[];
  boardGameOver: boolean;
  boardPendingReview: boolean;

  // DR Drills
  drDrills: DRDrill[];

  // Tech Debt
  techDebtPoints: number;
  techDebtLevel: TechDebtLevel;
  techDebtItems: TechDebtItem[];

  // Compliance
  complianceCerts: ComplianceCertRecord[];
  expiredCertCount: number;

  // Expansion
  expansionTargets: AcquisitionTarget[];
  hasSecondFacility: boolean;

  // Energy
  energyState: EnergyState | null;

  // Event chains
  activeEventChains: ActiveEventChain[];

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
  postJobOpening: (role: import('../game/core/types').StaffRole) => void;
  hireStaff: (openingId: string) => void;
  layoffStaff: (staffId: string) => void;
  startTechResearch: (nodeId: string) => void;
  cancelTechResearch: (nodeId: string) => void;
  makeTimelineDecision: (decisionId: string, optionIndex: number) => void;
  resolveRandomEvent: (instanceId: string, optionIndex: number) => void;
  sendForCertification: (staffId: string, type: CertificationType) => void;
  payStaffBonus: () => void;
  setMentor: (juniorId: string, mentorId: string | null) => void;
  startDRDrill: (costNTD: number) => void;
  acknowledgeBoard: () => void;
  startRefactoring: (points: number) => void;
  startCertAcquisition: (type: ComplianceCertType) => void;
  acquireExpansionTarget: (targetId: string) => void;
  openSecondFacility: () => void;
  setEnergyStrategy: (strategy: ElectricityStrategy) => void;
  installSolar: () => void;
  installStorage: () => void;
  resolveEventChain: (chainId: string) => void;
  setOnCallMode: (mode: ShiftMode) => void;
  scheduleMaintenance: (region: FacilityRegion, offPeak: boolean) => void;
  performGeneratorMaintenance: (region: FacilityRegion) => void;
  nextTutorialStep: () => void;
  skipTutorial: () => void;
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

  staffList: [],
  jobOpenings: [],
  shiftMode: null,
  monthlyPayroll: 0,

  activeIncidents: [],
  securityPostureScore: 100,
  securityComplianceScore: 70,

  triggeredEvents: [],
  activeModifiers: [],
  pendingDecisions: [],
  economicCycle: null,

  techNodes: [],

  satisfactionScore: 75,

  plHistory: [],
  tutorialStep: null,

  achievements: [],
  competitors: [],
  playerMarketShare: 0.40,
  activeRandomEvents: [],
  maintenanceStates: null,

  strategyScores: { government: 0, startup: 0, enterprise: 0 },
  strategyDominantRoute: null,
  strategyEstablishedRoutes: [],
  namedCustomers: [],
  vendors: [],
  boardKPIs: [],
  boardYearResults: [],
  boardGameOver: false,
  boardPendingReview: false,
  drDrills: [],

  techDebtPoints: 0,
  techDebtLevel: 'HEALTHY' as TechDebtLevel,
  techDebtItems: [],
  complianceCerts: [],
  expiredCertCount: 0,
  expansionTargets: [],
  hasSecondFacility: false,
  energyState: null,
  activeEventChains: [],

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

  postJobOpening(role) {
    const engine = get()._engine;
    if (!engine) return;
    const sm = engine.getModule<StaffManager>('StaffManager');
    sm.postJobOpening(role);
    set({ jobOpenings: sm.getJobOpenings() });
  },

  hireStaff(openingId) {
    const engine = get()._engine;
    if (!engine) return;
    const sm = engine.getModule<StaffManager>('StaffManager');
    sm.hire(openingId);
    set({ staffList: sm.getStaff(), jobOpenings: sm.getJobOpenings(), monthlyPayroll: sm.calculateMonthlyPayroll() });
  },

  layoffStaff(staffId) {
    const engine = get()._engine;
    if (!engine) return;
    const sm = engine.getModule<StaffManager>('StaffManager');
    sm.layoff(staffId);
    set({ staffList: sm.getStaff(), monthlyPayroll: sm.calculateMonthlyPayroll() });
  },

  startTechResearch(nodeId) {
    const engine = get()._engine;
    if (!engine) return;
    const tt = engine.getModule<TechTree>('TechTree');
    tt.startResearch(nodeId);
    set({ techNodes: tt.getNodes() });
  },

  cancelTechResearch(nodeId) {
    const engine = get()._engine;
    if (!engine) return;
    const tt = engine.getModule<TechTree>('TechTree');
    tt.cancelResearch(nodeId);
    set({ techNodes: tt.getNodes() });
  },

  makeTimelineDecision(decisionId, optionIndex) {
    const engine = get()._engine;
    if (!engine) return;
    const et = engine.getModule<EventTimeline>('EventTimeline');
    et.makeDecision(decisionId, optionIndex);
    set({ pendingDecisions: et.getPendingDecisions(), activeModifiers: et.getActiveModifiers() });
  },

  resolveRandomEvent(instanceId, optionIndex) {
    const engine = get()._engine;
    if (!engine) return;
    const et = engine.getModule<EventTimeline>('EventTimeline');
    et.resolveRandomEvent(instanceId, optionIndex);
    set({ activeRandomEvents: et.getActiveRandomEvents() });
  },

  sendForCertification(staffId, type) {
    const engine = get()._engine;
    if (!engine) return;
    const sm = engine.getModule<import('../game/modules/StaffManager').StaffManager>('StaffManager');
    sm.sendForCertification(staffId, type);
    set({ staffList: sm.getStaff() });
  },

  payStaffBonus() {
    const engine = get()._engine;
    if (!engine) return;
    const sm = engine.getModule<import('../game/modules/StaffManager').StaffManager>('StaffManager');
    sm.payBonus();
    set({ staffList: sm.getStaff() });
  },

  setMentor(juniorId, mentorId) {
    const engine = get()._engine;
    if (!engine) return;
    const sm = engine.getModule<import('../game/modules/StaffManager').StaffManager>('StaffManager');
    sm.setMentor(juniorId, mentorId);
    set({ staffList: sm.getStaff() });
  },

  startDRDrill(costNTD) {
    const engine = get()._engine;
    if (!engine) return;
    const sec = engine.getModule<SecurityEngine>('SecurityEngine');
    sec.startDRDrill(costNTD);
    set({ securityComplianceScore: sec.getComplianceScore() });
  },

  acknowledgeBoard() {
    const engine = get()._engine;
    if (!engine) return;
    const be = engine.getModule<BoardEngine>('BoardEngine');
    be.acknowledgeReview();
    set({ boardPendingReview: false });
  },

  startRefactoring(points) {
    const engine = get()._engine;
    if (!engine) return;
    const tde = engine.getModule<TechDebtEngine>('TechDebtEngine');
    tde.startRefactoring(points);
    set({ techDebtPoints: tde.getTotalPoints(), techDebtLevel: tde.getLevel(), techDebtItems: tde.getItems() });
  },

  startCertAcquisition(type) {
    const engine = get()._engine;
    if (!engine) return;
    const ce = engine.getModule<ComplianceEngine>('ComplianceEngine');
    ce.startAcquisition(type);
    set({ complianceCerts: ce.getCertifications(), expiredCertCount: ce.getExpiredCerts().length });
  },

  acquireExpansionTarget(targetId) {
    const engine = get()._engine;
    if (!engine) return;
    const ee = engine.getModule<ExpansionEngine>('ExpansionEngine');
    ee.acquireTarget(targetId);
    set({ expansionTargets: ee.getAcquisitions(), hasSecondFacility: ee.hasSecondFacility() });
  },

  openSecondFacility() {
    const engine = get()._engine;
    if (!engine) return;
    const ee = engine.getModule<ExpansionEngine>('ExpansionEngine');
    ee.openSecondFacility();
    set({ hasSecondFacility: ee.hasSecondFacility() });
  },

  setEnergyStrategy(strategy) {
    const engine = get()._engine;
    if (!engine) return;
    const en = engine.getModule<EnergyEngine>('EnergyEngine');
    en.setStrategy(strategy);
    set({ energyState: en.getEnergyState() });
  },

  installSolar() {
    const engine = get()._engine;
    if (!engine) return;
    const en = engine.getModule<EnergyEngine>('EnergyEngine');
    const time = engine.getModule<TimeEngine>('TimeEngine');
    en.installSolar(time.getCurrentDate().year);
    set({ energyState: en.getEnergyState() });
  },

  installStorage() {
    const engine = get()._engine;
    if (!engine) return;
    const en = engine.getModule<EnergyEngine>('EnergyEngine');
    const time = engine.getModule<TimeEngine>('TimeEngine');
    en.installStorage(time.getCurrentDate().year);
    set({ energyState: en.getEnergyState() });
  },

  resolveEventChain(chainId) {
    const engine = get()._engine;
    if (!engine) return;
    const et = engine.getModule<EventTimeline>('EventTimeline');
    et.resolveChainStep(chainId);
    set({ activeEventChains: et.getActiveChains() });
  },

  setOnCallMode(mode) {
    const engine = get()._engine;
    if (!engine) return;
    const sm = engine.getModule<StaffManager>('StaffManager');
    sm.setShiftMode(mode);
    set({ shiftMode: sm.getShiftMode() });
  },

  scheduleMaintenance(region, offPeak) {
    const engine = get()._engine;
    if (!engine) return;
    const fm = engine.getModule<FacilityManager>('FacilityManager');
    fm.scheduleMaintenance(region, offPeak);
    set({ maintenanceStates: fm.getAllMaintenanceStates() });
  },

  performGeneratorMaintenance(region) {
    const engine = get()._engine;
    if (!engine) return;
    const fm = engine.getModule<FacilityManager>('FacilityManager');
    fm.performGeneratorMaintenance(region);
    set({ maintenanceStates: fm.getAllMaintenanceStates() });
  },

  nextTutorialStep() {
    const engine = get()._engine;
    if (!engine) return;
    const tutorial = engine.getModule<TutorialEngine>('TutorialEngine');
    tutorial.nextStep();
    set({ tutorialStep: tutorial.getCurrentStep() });
  },

  skipTutorial() {
    const engine = get()._engine;
    if (!engine) return;
    const tutorial = engine.getModule<TutorialEngine>('TutorialEngine');
    tutorial.skip();
    set({ tutorialStep: null });
  },

  _connectEngine(engine) {
    const time = engine.getModule<TimeEngine>('TimeEngine');
    const finance = engine.getModule<FinanceEngine>('FinanceEngine');
    const fm = engine.getModule<FacilityManager>('FacilityManager');
    const hw = engine.getModule<HardwareCatalog>('HardwareCatalog');
    const sw = engine.getModule<SoftwareCatalog>('SoftwareCatalog');
    const cm = engine.getModule<ContractManager>('ContractManager');
    const sm = engine.getModule<StaffManager>('StaffManager');
    const sec = engine.getModule<SecurityEngine>('SecurityEngine');
    const et = engine.getModule<EventTimeline>('EventTimeline');
    const tt = engine.getModule<TechTree>('TechTree');
    const rep = engine.getModule<ReputationEngine>('ReputationEngine');
    const tutorial = engine.getModule<TutorialEngine>('TutorialEngine');
    const ach = engine.getModule<AchievementEngine>('AchievementEngine');
    const comp = engine.getModule<CompetitorEngine>('CompetitorEngine');
    const strat = engine.getModule<StrategyEngine>('StrategyEngine');
    const cust = engine.getModule<CustomerEngine>('CustomerEngine');
    const vend = engine.getModule<VendorEngine>('VendorEngine');
    const board = engine.getModule<BoardEngine>('BoardEngine');

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
      staffList: sm.getStaff(),
      jobOpenings: sm.getJobOpenings(),
      shiftMode: sm.getShiftMode(),
      monthlyPayroll: sm.calculateMonthlyPayroll(),
      activeIncidents: sec.getActiveIncidents(),
      securityPostureScore: sec.getSecurityPostureScore(),
      securityComplianceScore: sec.getComplianceScore(),
      triggeredEvents: et.getTriggeredEvents(),
      activeModifiers: et.getActiveModifiers(),
      pendingDecisions: et.getPendingDecisions(),
      activeRandomEvents: et.getActiveRandomEvents(),
      economicCycle: et.getEconomicCycle(),
      techNodes: tt.getNodes(),
      satisfactionScore: rep.getSatisfactionScore(),
      plHistory: finance.getPLHistory(12),
      achievements: ach.getAchievements(),
      competitors: comp.getCompetitors(),
      playerMarketShare: comp.getPlayerMarketShare(),
      maintenanceStates: fm.getAllMaintenanceStates(),
      strategyScores: strat.getScores(),
      strategyDominantRoute: strat.getDominantRoute(),
      strategyEstablishedRoutes: strat.getEstablishedRoutes(),
      namedCustomers: cust.getCustomers(),
      vendors: vend.getVendors(),
      boardKPIs: board.getKPIs(),
      boardYearResults: board.getYearResults(),
      boardGameOver: board.isGameOver(),
      boardPendingReview: board.isPendingReview(),
      drDrills: sec.getDRDrills(),
    });

    // Start tutorial if not completed (after a brief delay so UI is mounted)
    setTimeout(() => {
      tutorial.start();
      set({ tutorialStep: tutorial.getCurrentStep() });
    }, 800);

    const tde = engine.getModule<TechDebtEngine>('TechDebtEngine');
    const compEng = engine.getModule<ComplianceEngine>('ComplianceEngine');
    const expan = engine.getModule<ExpansionEngine>('ExpansionEngine');
    const en = engine.getModule<EnergyEngine>('EnergyEngine');

    set({
      techDebtPoints: tde.getTotalPoints(),
      techDebtLevel: tde.getLevel(),
      techDebtItems: tde.getItems(),
      complianceCerts: compEng.getCertifications(),
      expiredCertCount: compEng.getExpiredCerts().length,
      expansionTargets: expan.getAcquisitions(),
      hasSecondFacility: expan.hasSecondFacility(),
      energyState: en.getEnergyState(),
      activeEventChains: et.getActiveChains(),
    });

    const bus = engine.bus;

    bus.subscribe('time.month_end', () => {
      set({
        currentDate: time.getCurrentDate(),
        cash: finance.getCash(),
        lastPL: finance.getLastMonthPL(),
        activeLoans: finance.getActiveLoans(),
        creditRating: finance.getCreditRating(),
        plHistory: finance.getPLHistory(12),
        facilityRegions: fm.getRegions(),
        availableHardwareModels: hw.getAvailableModels(time.getCurrentDate()),
        hardwareAssets: hw.getAssets(),
        softwareLicenses: sw.getLicenses(),
        complianceScore: sw.getComplianceScore(),
        pendingRFPs: cm.getPendingRFPs(),
        activeContracts: cm.getActiveContracts(),
        monthlyRevenueEstimate: cm.getMonthlyRevenueEstimate(),
        staffList: sm.getStaff(),
        jobOpenings: sm.getJobOpenings(),
        shiftMode: sm.getShiftMode(),
        monthlyPayroll: sm.calculateMonthlyPayroll(),
        activeIncidents: sec.getActiveIncidents(),
        securityPostureScore: sec.getSecurityPostureScore(),
        securityComplianceScore: sec.getComplianceScore(),
        triggeredEvents: et.getTriggeredEvents(),
        activeModifiers: et.getActiveModifiers(),
        pendingDecisions: et.getPendingDecisions(),
        activeRandomEvents: et.getActiveRandomEvents(),
        economicCycle: et.getEconomicCycle(),
        techNodes: tt.getNodes(),
        satisfactionScore: rep.getSatisfactionScore(),
        achievements: ach.getAchievements(),
        competitors: comp.getCompetitors(),
        playerMarketShare: comp.getPlayerMarketShare(),
        maintenanceStates: fm.getAllMaintenanceStates(),
        strategyScores: strat.getScores(),
        strategyDominantRoute: strat.getDominantRoute(),
        strategyEstablishedRoutes: strat.getEstablishedRoutes(),
        namedCustomers: cust.getCustomers(),
        vendors: vend.getVendors(),
        boardKPIs: board.getKPIs(),
        boardYearResults: board.getYearResults(),
        boardGameOver: board.isGameOver(),
        boardPendingReview: board.isPendingReview(),
        drDrills: sec.getDRDrills(),
        techDebtPoints: tde.getTotalPoints(),
        techDebtLevel: tde.getLevel(),
        techDebtItems: tde.getItems(),
        complianceCerts: compEng.getCertifications(),
        expiredCertCount: compEng.getExpiredCerts().length,
        expansionTargets: expan.getAcquisitions(),
        hasSecondFacility: expan.hasSecondFacility(),
        energyState: en.getEnergyState(),
        activeEventChains: et.getActiveChains(),
      });
    });

    bus.subscribe('techdebt.updated', () => {
      set({ techDebtPoints: tde.getTotalPoints(), techDebtLevel: tde.getLevel(), techDebtItems: tde.getItems() });
    });

    bus.subscribe('compliance.updated', () => {
      set({ complianceCerts: compEng.getCertifications(), expiredCertCount: compEng.getExpiredCerts().length });
    });

    bus.subscribe('compliance.cert_acquired', () => {
      set({ complianceCerts: compEng.getCertifications(), expiredCertCount: compEng.getExpiredCerts().length });
    });

    bus.subscribe('compliance.cert_expired', () => {
      set({ complianceCerts: compEng.getCertifications(), expiredCertCount: compEng.getExpiredCerts().length });
    });

    bus.subscribe('expansion.acquisition_started', () => {
      set({ expansionTargets: expan.getAcquisitions() });
    });

    bus.subscribe('expansion.integration_completed', () => {
      set({ expansionTargets: expan.getAcquisitions() });
    });

    bus.subscribe('expansion.second_facility_opened', () => {
      set({ hasSecondFacility: true });
    });

    bus.subscribe('energy.updated', () => {
      set({ energyState: en.getEnergyState() });
    });

    bus.subscribe('timeline.chain_triggered', () => {
      set({ activeEventChains: et.getActiveChains() });
    });

    bus.subscribe('timeline.chain_step_resolved', () => {
      set({ activeEventChains: et.getActiveChains() });
    });

    bus.subscribe('timeline.chain_escalated', () => {
      set({ activeEventChains: et.getActiveChains() });
    });

    bus.subscribe('timeline.chain_completed', () => {
      set({ activeEventChains: et.getActiveChains() });
    });

    bus.subscribe('achievement.unlocked', () => {
      set({ achievements: ach.getAchievements() });
    });

    bus.subscribe('competitor.state_changed', () => {
      set({ competitors: comp.getCompetitors(), playerMarketShare: comp.getPlayerMarketShare() });
    });

    bus.subscribe('timeline.random_event', () => {
      set({ activeRandomEvents: et.getActiveRandomEvents() });
    });

    bus.subscribe('timeline.random_event_resolved', () => {
      set({ activeRandomEvents: et.getActiveRandomEvents() });
    });

    bus.subscribe('facility.maintenance_completed', () => {
      set({ maintenanceStates: fm.getAllMaintenanceStates() });
    });

    bus.subscribe('facility.maintenance_scheduled', () => {
      set({ maintenanceStates: fm.getAllMaintenanceStates() });
    });

    bus.subscribe('facility.generator_maintained', () => {
      set({ maintenanceStates: fm.getAllMaintenanceStates() });
    });

    bus.subscribe('tutorial.step_triggered', () => {
      set({ tutorialStep: tutorial.getCurrentStep() });
    });

    bus.subscribe('tutorial.completed', () => {
      set({ tutorialStep: null });
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

    bus.subscribe('staff.hired', () => {
      set({ staffList: sm.getStaff(), jobOpenings: sm.getJobOpenings(), monthlyPayroll: sm.calculateMonthlyPayroll() });
    });

    bus.subscribe('staff.laid_off', () => {
      set({ staffList: sm.getStaff(), monthlyPayroll: sm.calculateMonthlyPayroll() });
    });

    bus.subscribe('staff.resigned', () => {
      set({ staffList: sm.getStaff(), monthlyPayroll: sm.calculateMonthlyPayroll() });
    });

    bus.subscribe('security.incident_triggered', () => {
      set({ activeIncidents: sec.getActiveIncidents(), securityPostureScore: sec.getSecurityPostureScore() });
    });

    bus.subscribe('security.incident_resolved', () => {
      set({ activeIncidents: sec.getActiveIncidents(), securityPostureScore: sec.getSecurityPostureScore() });
    });

    bus.subscribe('security.incident_timed_out', () => {
      set({ activeIncidents: sec.getActiveIncidents() });
    });

    bus.subscribe('timeline.historical_event', () => {
      set({ triggeredEvents: et.getTriggeredEvents(), activeModifiers: et.getActiveModifiers() });
    });

    bus.subscribe('timeline.decision_required', () => {
      set({ pendingDecisions: et.getPendingDecisions() });
    });

    bus.subscribe('timeline.economic_cycle_changed', () => {
      set({ economicCycle: et.getEconomicCycle() });
    });

    bus.subscribe('techtree.research_completed', () => {
      set({ techNodes: tt.getNodes() });
    });

    bus.subscribe('techtree.research_started', () => {
      set({ techNodes: tt.getNodes() });
    });

    bus.subscribe('reputation.satisfaction_changed', () => {
      set({ satisfactionScore: rep.getSatisfactionScore() });
    });

    bus.subscribe('strategy.route_established', () => {
      set({
        strategyScores: strat.getScores(),
        strategyDominantRoute: strat.getDominantRoute(),
        strategyEstablishedRoutes: strat.getEstablishedRoutes(),
      });
    });

    bus.subscribe('customer.acquired', () => {
      set({ namedCustomers: cust.getCustomers() });
    });

    bus.subscribe('customer.churned', () => {
      set({ namedCustomers: cust.getCustomers() });
    });

    bus.subscribe('vendor.level_up', () => {
      set({ vendors: vend.getVendors() });
    });

    bus.subscribe('vendor.platinum_unlocked', (e) => {
      const p = e.payload as { message: string };
      set({ vendors: vend.getVendors() });
      // toast is handled in GameLayout
      void p;
    });

    bus.subscribe('board.kpi_set', () => {
      set({ boardKPIs: board.getKPIs() });
    });

    bus.subscribe('board.quarterly_review', () => {
      set({ boardKPIs: board.getKPIs(), boardPendingReview: board.isPendingReview() });
    });

    bus.subscribe('board.year_end_result', () => {
      set({
        boardKPIs: board.getKPIs(),
        boardYearResults: board.getYearResults(),
        boardPendingReview: board.isPendingReview(),
      });
    });

    bus.subscribe('board.game_over', () => {
      set({ boardGameOver: true, boardPendingReview: true });
    });

    bus.subscribe('staff.certification_completed', () => {
      set({ staffList: sm.getStaff() });
    });

    bus.subscribe('security.dr_drill_started', () => {
      set({ drDrills: sec.getDRDrills() });
    });

    bus.subscribe('security.dr_drill_completed', () => {
      set({ drDrills: sec.getDRDrills(), securityComplianceScore: sec.getComplianceScore() });
    });
  },
}));
