// ─── Scalar types ─────────────────────────────────────────────────────────────

/** Integer NTD. All amounts in the game are whole NTD with no sub-unit precision. */
export type Money = number;

/** Year/month pair; day is not tracked (month is smallest granularity). */
export interface GameDate {
  readonly year: number;   // 2000–2040
  readonly month: number;  // 1–12
}

/** All persistent entities use UUID strings. */
export type EntityId = string;

/** 0 = paused; other values = speed multiplier. */
export type GameSpeed = 0 | 1 | 2 | 4 | 8;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum HardwareCategory {
  Server       = 'SERVER',
  Storage      = 'STORAGE',
  Networking   = 'NETWORKING',
  UPS          = 'UPS',
  Cooling      = 'COOLING',
  Rack         = 'RACK',
  EnvMonitor   = 'ENV_MONITOR',
  FireSuppress = 'FIRE_SUPPRESS',
  GPU          = 'GPU',
}

export enum SoftwareCategory {
  OS             = 'OS',
  Virtualization = 'VIRTUALIZATION',
  Container      = 'CONTAINER',
  Database       = 'DATABASE',
  Backup         = 'BACKUP',
  Security       = 'SECURITY',
  Monitoring     = 'MONITORING',
  ITSM           = 'ITSM',
}

export enum LicenseType {
  PerpetualWithSA    = 'PERPETUAL_SA',
  AnnualSubscription = 'ANNUAL_SUB',
  OpenSource         = 'OPEN_SOURCE',
  SaaS               = 'SAAS',
}

export enum ServiceType {
  Colocation   = 'COLOCATION',
  VPS          = 'VPS',
  SaaS         = 'SAAS',
  Bandwidth    = 'BANDWIDTH',
  MSP          = 'MSP',
  DRaaS        = 'DRAAS',
  MSSP         = 'MSSP',
  AICompute    = 'AI_COMPUTE',
  ProfServices = 'PROF_SERVICES',
  Training     = 'TRAINING',
}

export enum ContractStatus {
  Active     = 'ACTIVE',
  Expired    = 'EXPIRED',
  Terminated = 'TERMINATED',
  Pending    = 'PENDING',
}

export enum CustomerTier {
  Individual    = 'INDIVIDUAL',
  SMB           = 'SMB',
  Enterprise    = 'ENTERPRISE',
  Government    = 'GOVERNMENT',
  Multinational = 'MULTINATIONAL',
}

export enum StaffRole {
  E1_NOC       = 'E1_NOC',
  E2_SysEng    = 'E2_SYS_ENG',
  E3_SecAna    = 'E3_SEC_ANA',
  E3_Senior    = 'E3_SENIOR',
  E4_CloudArch = 'E4_CLOUD_ARCH',
  E4_AIEng     = 'E4_AI_ENG',
  E5_CISO      = 'E5_CISO',
}

export enum IncidentSeverity {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
}

export enum EconomicCycle {
  Boom       = 'BOOM',
  Normal     = 'NORMAL',
  Recession  = 'RECESSION',
  Depression = 'DEPRESSION',
}

export enum CreditRating {
  AAA      = 'AAA',
  AA       = 'AA',
  A        = 'A',
  BBB      = 'BBB',
  BB       = 'BB',
  B        = 'B',
  Insolvent = 'INSOLVENT',
}

export enum FacilityRegion {
  North   = 'NORTH',
  Central = 'CENTRAL',
  South   = 'SOUTH',
}

export enum TechNodeStatus {
  Locked     = 'LOCKED',
  Available  = 'AVAILABLE',
  InProgress = 'IN_PROGRESS',
  Completed  = 'COMPLETED',
}

export enum ExpenseCategory {
  HardwareDepreciation = 'HARDWARE_DEPRECIATION',
  SoftwareLicense      = 'SOFTWARE_LICENSE',
  Electricity          = 'ELECTRICITY',
  Bandwidth            = 'BANDWIDTH',
  StaffSalary          = 'STAFF_SALARY',
  FacilityRent         = 'FACILITY_RENT',
  Maintenance          = 'MAINTENANCE',
  Insurance            = 'INSURANCE',
  Compliance           = 'COMPLIANCE',
  SLABreach            = 'SLA_BREACH',
  LoanInterest         = 'LOAN_INTEREST',
  HardwarePurchase     = 'HARDWARE_PURCHASE',
  TechTreeInvestment   = 'TECH_TREE_INVESTMENT',
  Other                = 'OTHER',
}

// ─── Event system ─────────────────────────────────────────────────────────────

export interface GameEvent<TPayload = unknown> {
  readonly id: EntityId;
  readonly type: string;
  readonly payload: TPayload;
  readonly gameDate: GameDate;
  readonly source: string;
  readonly wallTime: number;
}

export type EventHandler<T = unknown> = (event: GameEvent<T>) => void;
export type Unsubscribe = () => void;

export interface IEventBus {
  publish<T>(event: Omit<GameEvent<T>, 'id' | 'wallTime'>): void;
  subscribe<T>(type: string, handler: EventHandler<T>, moduleId?: string): Unsubscribe;
  subscribeMany(types: string[], handler: EventHandler, moduleId?: string): Unsubscribe;
  unsubscribeAll(sourceModuleId: string): void;
  getHistory(type: string, limit?: number): GameEvent[];
}

// ─── Module interface ─────────────────────────────────────────────────────────

export interface IGameModule {
  readonly moduleId: string;
  init(bus: IEventBus, config: GameConfig): void;
  tick(deltaMs: number): void;
  serialize(): Record<string, unknown>;
  deserialize(state: Record<string, unknown>): void;
  getState(): Readonly<Record<string, unknown>>;
  destroy(): void;
}

// ─── Config types ─────────────────────────────────────────────────────────────

export type GameMode = 'standard' | 'hard' | 'sandbox';

export interface TimeConfig {
  msPerGameMonthAt1x: number;
  startDate: GameDate;
  autoPauseOnP1: boolean;
  autoPauseOnP2: boolean;
  autoPauseOnRFP: boolean;
  autoPauseOnMajorEvent: boolean;
  autoPauseOnMonthEnd: boolean;
  autoPauseOnCashWarning: boolean;
  autoPauseOnEOLWarning: boolean;
  autoPauseOnContractExpiry: boolean;
}

export interface LoanTermConfig {
  maxMultiple: number;
  annualRate: number;
  maxMonths: number;
}

export interface FinanceConfig {
  corporateTaxRate: number;
  staffBenefitMultiplier: number;
  creditRatingUpdateIntervalMonths: number;
  bankruptcyConsecutiveLossMonths: number;
  cashWarningMultiplier: number;
  slaBreachPayoutCap: number;
  depreciation: {
    server: number;
    networking: number;
    storage: number;
    ups: number;
    facility: number;
    residualRate: number;
  };
  loanTerms: Record<CreditRating, LoanTermConfig>;
  centralBankRateHistory: Array<{ fromYear: number; rate: number }>;
}

export interface GameConfig {
  meta: {
    startYear: number;
    startMonth: number;
    startCash: Money;
    gameMode: GameMode;
  };
  time: TimeConfig;
  finance: FinanceConfig;
  facility?: FacilityModuleConfig;
  hardware?: HardwareModuleConfig;
  software?: SoftwareModuleConfig;
  contract?: ContractModuleConfig;
}

// ─── Save / load ──────────────────────────────────────────────────────────────

export interface SaveFile {
  version: string;
  savedAt: number;
  gameDate: GameDate;
  modules: Record<string, Record<string, unknown>>;
}

// ─── Finance data structures ──────────────────────────────────────────────────

export interface PLStatement {
  date: GameDate;
  income: {
    colocation: Money;
    vps: Money;
    saas: Money;
    bandwidth: Money;
    msp: Money;
    draas: Money;
    mssp: Money;
    aiCompute: Money;
    profServices: Money;
    training: Money;
    total: Money;
  };
  expenses: {
    hardwareDepreciation: Money;
    softwareLicense: Money;
    electricity: Money;
    bandwidth: Money;
    staffSalary: Money;
    facilityRent: Money;
    maintenanceContracts: Money;
    insurance: Money;
    compliance: Money;
    slaBreachPenalty: Money;
    loanInterest: Money;
    other: Money;
    total: Money;
  };
  preTaxProfit: Money;
  taxAmount: Money;
  netProfit: Money;
}

export interface BalanceSheet {
  date: GameDate;
  assets: {
    cash: Money;
    hardwareBookValue: Money;
    accountsReceivable: Money;
    totalAssets: Money;
  };
  liabilities: {
    loanBalance: Money;
    accountsPayable: Money;
    totalLiabilities: Money;
  };
  equity: Money;
}

export interface Loan {
  id: EntityId;
  principal: Money;
  remainingBalance: Money;
  annualRate: number;
  monthlyPayment: Money;
  startDate: GameDate;
  endDate: GameDate;
  isOverdue: boolean;
}

export interface IncomeEntry {
  date: GameDate;
  type: ServiceType;
  contractId?: EntityId;
  amount: Money;
  description: string;
}

export interface ExpenseEntry {
  date: GameDate;
  category: ExpenseCategory;
  referenceId?: EntityId;
  amount: Money;
  isCashExpense: boolean;
  description: string;
}

export interface CreditRatingFactor {
  factor: string;
  deltaScore: number;
  description: string;
}

// ─── Phase 2 enums ───────────────────────────────────────────────────────────

export enum CoolingLevel {
  Open      = 0,
  BasicAC   = 1,
  HotAisle  = 2,
  Chiller   = 3,
  InRow     = 4,
  Liquid    = 5,
  Immersion = 6,
}

export enum ClimateRisk {
  Low    = 'LOW',
  Medium = 'MEDIUM',
  High   = 'HIGH',
}

export enum HardwareBrand {
  Dell       = 'DELL',
  HP_HPE     = 'HP_HPE',
  IBM        = 'IBM',
  Cisco      = 'CISCO',
  Juniper    = 'JUNIPER',
  Arista     = 'ARISTA',
  Fortinet   = 'FORTINET',
  PaloAlto   = 'PALO_ALTO',
  Supermicro = 'SUPERMICRO',
  APC        = 'APC',
  Eaton      = 'EATON',
  Vertiv     = 'VERTIV',
  NetApp     = 'NETAPP',
  PureStorage = 'PURE_STORAGE',
  NVIDIA     = 'NVIDIA',
  Other      = 'OTHER',
}

export enum CapacityUnit {
  VPS            = 'vps',
  ColoClients    = 'colo_clients',
  StorageMult    = 'storage_multiplier',
  SecurityLevel  = 'security_level',
  PowerProtect   = 'power_protect_level',
  PUEReduction   = 'pue_reduction',
  BackupCoverage = 'backup_coverage',
  NetworkPerf    = 'network_perf',
}

export enum AssetStatus {
  InTransit  = 'IN_TRANSIT',
  Installing = 'INSTALLING',
  Active     = 'ACTIVE',
  Failed     = 'FAILED',
  EOL        = 'EOL',
  Disposed   = 'DISPOSED',
}

export enum MaintenanceType {
  Warranty   = 'WARRANTY',
  NBD        = 'NBD',
  FourHour   = 'FOUR_HOUR',
  ThirdParty = 'THIRD_PARTY',
  None       = 'NONE',
}

export enum PurchasePaymentMethod {
  Cash            = 'CASH',
  Installment     = 'INSTALLMENT',
  RequisitionForm = 'REQUISITION',
}

export enum LicenseStatus {
  Active     = 'ACTIVE',
  EosWarning = 'EOS_WARNING',
  EosExpired = 'EOS_EXPIRED',
  Cancelled  = 'CANCELLED',
  Upgrading  = 'UPGRADING',
}

export enum ComplianceRiskLevel {
  None     = 'NONE',
  Low      = 'LOW',
  Medium   = 'MEDIUM',
  High     = 'HIGH',
  Critical = 'CRITICAL',
}

export enum SoftwareEffectType {
  VirtualizationDensity = 'VIRT_DENSITY',
  StoragePerformance    = 'STORAGE_PERF',
  BackupCoverage        = 'BACKUP_COVERAGE',
  SecurityDetection     = 'SEC_DETECTION',
  IncidentResponseTime  = 'IRT_REDUCTION',
  ComplianceScore       = 'COMPLIANCE_SCORE',
}

// ─── Facility data structures ─────────────────────────────────────────────────

export interface FacilityRegionState {
  region: FacilityRegion;
  isUnlocked: boolean;
  totalUnits: number;
  usedUnits: number;
  utilizationRate: number;
  coolingLevel: CoolingLevel;
  pue: number;
  totalWatts: number;
  monthlyRent: Money;
  assignedStaffIds: EntityId[];
  climateRisk: ClimateRisk;
  expansionCount: number;
}

// ─── Hardware data structures ─────────────────────────────────────────────────

export interface HardwareModel {
  id: string;
  name: string;
  category: HardwareCategory;
  era: number;
  unlockYear: number;
  eolYear: number;
  specs: {
    rackUnits: number;
    powerWatts: number;
    serviceCapacity: number;
    capacityUnit: CapacityUnit;
  };
  pricing: {
    basePriceNTD: Money;
    maintenanceRatePerYear: number;
    warrantyYears: number;
  };
  brand: HardwareBrand;
  isODM: boolean;
  isPremium: boolean;
  failureRateBase: number;
  tags: string[];
}

export interface HardwareAsset {
  id: EntityId;
  modelId: string;
  region: FacilityRegion;
  purchaseDate: GameDate;
  purchasePrice: Money;
  bookValue: Money;
  accumulatedDepreciation: Money;
  status: AssetStatus;
  warrantyExpiry: GameDate;
  eolDate: GameDate;
  eolWarningShown: boolean;
  monthsSinceEOL: number;
  maintenanceType: MaintenanceType;
  isEOL: boolean;
  isInstalled: boolean;
  installationCompleteDate: GameDate | null;
  purchaseOrderId: EntityId;
}

export interface PurchaseOrder {
  id: EntityId;
  modelId: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  paymentMethod: PurchasePaymentMethod;
  deliveryDate: GameDate;
  status: 'pending' | 'delivered' | 'cancelled';
  installationEngineerRequired: boolean;
}

export interface DisposalResult {
  assetId: EntityId;
  salvageValue: Money;
  date: GameDate;
}

export interface DepreciationSummary {
  totalMonthlyDepreciation: Money;
  byAsset: Array<{ assetId: EntityId; amount: Money }>;
}

// ─── Software data structures ─────────────────────────────────────────────────

export interface SoftwareEffect {
  type: SoftwareEffectType;
  value: number;
}

export interface SoftwareProduct {
  id: string;
  name: string;
  category: SoftwareCategory;
  licenseType: LicenseType;
  vendor: string;
  unlockYear: number;
  eosYear: number;
  eosMonth?: number;
  annualCostNTD: Money;
  effects: SoftwareEffect[];
  isFreeOpenSource: boolean;
  upgradePathFrom?: string[];
  notes?: string;
}

export interface SoftwareLicense {
  id: EntityId;
  productId: string;
  version: string;
  licenseType: LicenseType;
  purchaseDate: GameDate;
  renewalDate: GameDate;
  eosDate: GameDate;
  eosWarningShown: boolean;
  monthsSinceEOS: number;
  status: LicenseStatus;
  assignedServerIds: EntityId[];
  annualCostNTD: Money;
  isAutoRenew: boolean;
  complianceRiskLevel: ComplianceRiskLevel;
}

// ─── Contract data structures ─────────────────────────────────────────────────

export interface SpecialRequirement {
  type: 'iso27001' | 'three_shift' | 'geo_redundancy' | 'gpu_nodes' | 'custom';
  description: string;
  isMet: boolean;
}

export interface FeasibilityReport {
  spaceOk: boolean;
  techStackOk: boolean;
  staffOk: boolean;
  slaAchievable: boolean;
  missingRequirements: string[];
}

export interface RFP {
  id: EntityId;
  clientId: EntityId;
  clientName: string;
  clientTier: CustomerTier;
  serviceType: ServiceType;
  budgetRange: { min: Money; max: Money };
  contractDurationMonths: number;
  slaRequirement: number;
  specialRequirements: SpecialRequirement[];
  expiresAt: GameDate;
  estimatedFeasibility: FeasibilityReport;
  competitorPresence: boolean;
  generatedDate: GameDate;
}

export interface BidParams {
  monthlyFeeNTD: Money;
  slaLevel: number;
  contractDurationMonths: number;
  breachPenaltyMultiplier: number;
  specialServices: ServiceType[];
}

export interface BidSubmission {
  rfpId: EntityId;
  bid: BidParams;
  submittedAt: GameDate;
  resultExpectedAt: GameDate;
  winProbability: number;
}

export interface SLAMonthRecord {
  date: GameDate;
  uptimePercent: number;
  slaBreached: boolean;
  penaltyAmount: Money;
  incidentIds: EntityId[];
}

export interface Contract {
  id: EntityId;
  clientId: EntityId;
  clientName: string;
  clientTier: CustomerTier;
  serviceType: ServiceType;
  status: ContractStatus;
  monthlyFeeNTD: Money;
  slaLevel: number;
  startDate: GameDate;
  endDate: GameDate;
  renewalNoticeMonths: number;
  breachPenaltyMultiplier: number;
  specialServices: ServiceType[];
  slaRecord: SLAMonthRecord[];
  clientSatisfaction: number;
  totalRevenue: Money;
  totalPenaltiesPaid: Money;
}

export interface SLADashboard {
  overallSLARate: number;
  atRiskContracts: Array<{
    contractId: EntityId;
    clientName: string;
    monthlyFee: Money;
    slaRate: number;
  }>;
  monthlySLASummary: Array<{
    date: GameDate;
    breachCount: number;
    totalPenalties: Money;
  }>;
}

// ─── Module configs ───────────────────────────────────────────────────────────

export interface FacilityModuleConfig {
  regions: Record<FacilityRegion, {
    initialUnits: number;
    baseMonthlyRent: Money;
    performanceBonus: number;
    climateRisk: ClimateRisk;
    unlockMinMonthlyRevenue?: Money;
  }>;
  coolingLevels: Record<CoolingLevel, {
    pue: number;
    investmentCost: Money;
    unlockYear: number;
  }>;
  expansionCostMultiplier: number;
  expansionCapacityMultiplier: number;
  capacityWarningThreshold: number;
  geoRedundancyThreshold: number;
  geoRedundancySLABonus: number;
  electricityRates: Array<{ fromYear: number; ratePerKwh: number }>;
  hoursPerMonth: number;
}

export interface HardwareModuleConfig {
  eolWarningMonthsBefore: number;
  installationMonthsPerUnit: number;
  largePurchaseThreshold: Money;
  requisitionDeliveryDelay: number;
  requisitionDiscount: number;
  installmentMonths: number;
  eolFailureMultipliers: [number, number, number, number];
  salvageValueRate: number;
}

export interface SoftwareModuleConfig {
  eosWarningMonthsBefore: number;
  eosSecurityMultipliers: {
    quarter1: number;
    quarter2: number;
    quarter3plus: number;
  };
  eosComplianceScorePenalty: {
    quarter1: number;
    quarter2: number;
    quarter3plus: number;
  };
  compliancePenaltyAmount: Money;
}

export interface ContractModuleConfig {
  rfpResponseWindowMonths: number;
  renewalNoticeMonths: number;
  baseRFPsPerMonth: number;
  maxMonthlyPenaltyCap: number;
  churnProbabilities: {
    dataBreachAndLate: number;
    consecutiveSLABreach: number;
    p1Over24Hours: number;
    lowSatisfactionProlonged: number;
    competitorOffer: number;
  };
}

// ─── Time engine payloads ─────────────────────────────────────────────────────

export type PauseReason =
  | 'user'
  | 'p1_incident'
  | 'p2_incident'
  | 'rfp_received'
  | 'month_end'
  | 'major_event'
  | 'cash_warning'
  | 'eol_warning'
  | 'contract_expiry';

export interface TimeMonthEndPayload {
  prevDate: GameDate;
  newDate: GameDate;
  totalMonthsElapsed: number;
}

export interface TimeQuarterEndPayload {
  date: GameDate;
  quarter: 1 | 2 | 3 | 4;
}

export interface TimeYearEndPayload {
  year: number;
}

export interface TimePausedPayload {
  reason: PauseReason;
  speed: GameSpeed;
}

export interface TimeResumedPayload {
  speed: GameSpeed;
}

export interface TimeSpeedChangedPayload {
  from: GameSpeed;
  to: GameSpeed;
}
