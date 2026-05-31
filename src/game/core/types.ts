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
  staff?: StaffConfig;
  security?: SecurityConfig;
  eventTimeline?: EventTimelineConfig;
  techTree?: TechTreeConfig;
  reputation?: ReputationConfig;
  strategy?: StrategyConfig;
  customer?: CustomerConfig;
  vendor?: VendorConfig;
  board?: BoardConfig;
  techDebt?: TechDebtConfig;
  complianceCerts?: ComplianceCertsConfig;
  expansion?: ExpansionConfig;
  energy?: EnergyConfig;
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

// ─── Staff types ──────────────────────────────────────────────────────────────

export enum StaffStatus {
  InRecruitment = 'IN_RECRUITMENT',
  InTraining    = 'IN_TRAINING',
  Active        = 'ACTIVE',
  OnLeave       = 'ON_LEAVE',
  Assigned      = 'ASSIGNED',
  ResignPending = 'RESIGN_PENDING',
}

export enum ShiftMode {
  DayOnly    = 'DAY_ONLY',
  TwoShift   = 'TWO_SHIFT',
  ThreeShift = 'THREE_SHIFT',
  OnCall     = 'ON_CALL',
  AIOps      = 'AIOPS',
}

export interface StaffMember {
  id: EntityId;
  name: string;
  role: StaffRole;
  level: 1 | 2 | 3 | 4 | 5;
  monthlySalaryNTD: Money;
  hireDate: GameDate;
  monthsInService: number;
  qualityScore: number;
  status: StaffStatus;
  promotionEligibleDate: GameDate;
  promotionCostNTD: Money;
  managementCapacityU: number;
  handlingPower: number;
  isSecuritySpecialist: boolean;
  assignedIncidentIds: EntityId[];
  assignedRegion: FacilityRegion | null;
  trainingCompletionDate: GameDate | null;
  satisfactionScore: number;
  // Talent growth system (added v3.1)
  morale: number;            // 0–100
  certifications: StaffCertification[];
  mentorId: EntityId | null;
  skillLevel: 1 | 2 | 3 | 4 | 5;
}

export interface JobOpening {
  id: EntityId;
  role: StaffRole;
  postedDate: GameDate;
  recruitmentDurationMonths: number;
  availableDate: GameDate;
  status: 'recruiting' | 'interview_ready' | 'filled' | 'cancelled';
  candidateName: string;
}

export interface InterviewResult {
  openingId: EntityId;
  score: number;
  qualityBonus: number;
}

export interface LayoffResult {
  staffId: EntityId;
  severancePay: Money;
  date: GameDate;
}

export interface IncidentHandlingCapacity {
  totalHandlingPower: number;
  availableForIncidents: number;
  securityHandlingPower: number;
  estimatedResolutionMultiplier: number;
}

// ─── Security types ───────────────────────────────────────────────────────────

export enum IncidentType {
  HardwareFailure   = 'HARDWARE_FAILURE',
  NetworkOutage     = 'NETWORK_OUTAGE',
  CapacityAlarm     = 'CAPACITY_ALARM',
  PowerAnomaly      = 'POWER_ANOMALY',
  CoolingFailure    = 'COOLING_FAILURE',
  Ransomware        = 'RANSOMWARE',
  DataBreach        = 'DATA_BREACH',
  SocialEngineering = 'SOCIAL_ENGINEERING',
  APTAttack         = 'APT_ATTACK',
  DDoS              = 'DDOS',
  ComplianceGap     = 'COMPLIANCE_GAP',
  InsiderThreat     = 'INSIDER_THREAT',
  SupplyChainAttack = 'SUPPLY_CHAIN_ATTACK',
}

export enum IncidentStatus {
  Active        = 'ACTIVE',
  Investigating = 'INVESTIGATING',
  Mitigating    = 'MITIGATING',
  Resolved      = 'RESOLVED',
  TimedOut      = 'TIMED_OUT',
}

export enum ResponseAction {
  PayRansom          = 'PAY_RANSOM',
  RestoreFromBackup  = 'RESTORE_BACKUP',
  WaitOut            = 'WAIT_OUT',
  StartInvestigation = 'START_INVESTIGATION',
  ReportToAuthority  = 'REPORT_AUTHORITY',
  WarrantyRepair     = 'WARRANTY_REPAIR',
  ThirdPartyRepair   = 'THIRD_PARTY_REPAIR',
  ReplaceSame        = 'REPLACE_SAME',
  ReplaceUpgrade     = 'REPLACE_UPGRADE',
  RunRequisition     = 'RUN_REQUISITION',
  AssignEngineer     = 'ASSIGN_ENGINEER',
  EscalateToManager  = 'ESCALATE',
}

export interface IncidentResponseRecord {
  action: ResponseAction;
  timestamp: GameDate;
  staffId?: EntityId;
  cost?: Money;
  result: string;
}

export interface Incident {
  id: EntityId;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  triggeredAt: GameDate;
  triggeredAtHour: number;
  resolvedAt: GameDate | null;
  deadlineHours: number;
  elapsedHours: number;
  isBreached: boolean;
  region: FacilityRegion | null;
  affectedContractIds: EntityId[];
  assignedStaffIds: EntityId[];
  responses: IncidentResponseRecord[];
  resolutionMethod: string | null;
  financialImpact: Money;
  downtimeHours: number;
}

// ─── EventTimeline types ──────────────────────────────────────────────────────

export enum EventEffectType {
  BaseInterestRate    = 'BASE_INTEREST_RATE',
  EconomicCycle       = 'ECONOMIC_CYCLE',
  ElectricityRate     = 'ELECTRICITY_RATE',
  ElectricityMod      = 'ELECTRICITY_MOD',
  HardwareCostMod     = 'HARDWARE_COST_MOD',
  DeliveryDelayMonths = 'DELIVERY_DELAY',
  SoftwarePriceChange = 'SOFTWARE_PRICE_CHANGE',
  ForcedEOS           = 'FORCED_EOS',
  RFPFrequencyMod     = 'RFP_FREQUENCY_MOD',
  ContractValueMod    = 'CONTRACT_VALUE_MOD',
  ClientBudgetMod     = 'CLIENT_BUDGET_MOD',
  ThreatLevelMod      = 'THREAT_LEVEL_MOD',
  SpecificThreatMod   = 'SPECIFIC_THREAT_MOD',
  StaffEfficiencyMod  = 'STAFF_EFFICIENCY_MOD',
  RecruitmentCostMod  = 'RECRUITMENT_COST_MOD',
  ResignationRateMod  = 'RESIGNATION_RATE_MOD',
  ExchangeRateMod     = 'EXCHANGE_RATE_MOD',
  InflationRateMod    = 'INFLATION_RATE_MOD',
}

export interface EventEffect {
  targetModule: string;
  effectType: EventEffectType;
  value: number;
  isMultiplier: boolean;
  description: string;
  incidentType?: IncidentType;
}

export interface EventDecisionOption {
  label: string;
  description: string;
  effects: EventEffect[];
  achievementHint?: string;
}

export interface EventDecisionTemplate {
  prompt: string;
  options: EventDecisionOption[];
  defaultOptionIndex: number;
  decisionWindowMonths: number;
}

export interface HistoricalEvent {
  id: string;
  name: string;
  year: number;
  month: number;
  description: string;
  isForced: boolean;
  durationMonths: number;
  effects: EventEffect[];
  decisions?: EventDecisionTemplate[];
  status: 'pending' | 'triggered' | 'expired';
  triggeredAt: GameDate | null;
  playerDecision: number | null;
  isAchievementRelated: boolean;
}

export interface EventDecision {
  id: EntityId;
  eventId: string;
  template: EventDecisionTemplate;
  triggeredAt: GameDate;
  expiresAt: GameDate;
  isExpired: boolean;
}

export interface DecisionOutcome {
  decisionId: EntityId;
  optionIndex: number;
  effectsApplied: EventEffect[];
  description: string;
}

export interface GlobalModifier {
  id: string;
  sourceEventId: string;
  effectType: EventEffectType;
  value: number;
  isMultiplier: boolean;
  startDate: GameDate;
  endDate: GameDate | null;
  description: string;
}

export interface EconomicCycleState {
  current: EconomicCycle;
  monthsInCurrentPhase: number;
  phaseDurationMonths: number;
  modifiers: {
    hardwareCostMod: number;
    electricityMod: number;
    clientBudgetMod: number;
    recruitmentCostMod: number;
  };
}

// ─── TechTree types ───────────────────────────────────────────────────────────

export enum TechCategory {
  Infrastructure  = 'INFRASTRUCTURE',
  Performance     = 'PERFORMANCE',
  CostControl     = 'COST_CONTROL',
  SpaceInnovation = 'SPACE_INNOVATION',
  Management      = 'MANAGEMENT',
  ScaleEconomy    = 'SCALE_ECONOMY',
  HRManagement    = 'HR_MANAGEMENT',
  SecurityDefense = 'SECURITY_DEFENSE',
  SupplyChain     = 'SUPPLY_CHAIN',
  RiskControl     = 'RISK_CONTROL',
  CloudCompete    = 'CLOUD_COMPETE',
  AIInfra         = 'AI_INFRA',
}

export enum TechEffectType {
  PUEReduction             = 'PUE_REDUCTION',
  CapacityBonus            = 'CAPACITY_BONUS',
  ExpansionCostReduction   = 'EXPANSION_COST_REDUCTION',
  HardwareCostReduction    = 'HARDWARE_COST_REDUCTION',
  ChipShortageReduction    = 'CHIP_SHORTAGE_REDUCTION',
  ExchangeRateReduction    = 'EXCHANGE_RATE_REDUCTION',
  ComplianceBonus          = 'COMPLIANCE_BONUS',
  SecurityEventReduction   = 'SECURITY_EVENT_REDUCTION',
  RansomwareImmunity       = 'RANSOMWARE_IMMUNITY',
  DDoSReduction            = 'DDOS_REDUCTION',
  APTDetectionBonus        = 'APT_DETECTION_BONUS',
  SocialEngReduction       = 'SOCIAL_ENG_REDUCTION',
  SLABreachRateReduction   = 'SLA_BREACH_REDUCTION',
  ServiceUnlock            = 'SERVICE_UNLOCK',
  ManagementCapacityBonus  = 'MGMT_CAPACITY_BONUS',
  PromotionTimeReduction   = 'PROMOTION_TIME_REDUCTION',
  ResignationRateReduction = 'RESIGNATION_REDUCTION',
  CreditRatingBonus        = 'CREDIT_RATING_BONUS',
  InsuranceCostReduction   = 'INSURANCE_COST_REDUCTION',
  PurchaseDelayReduction   = 'PURCHASE_DELAY_REDUCTION',
  IncidentResponseBonus    = 'INCIDENT_RESPONSE_BONUS',
  AuditPassRateBonus       = 'AUDIT_PASS_RATE_BONUS',
  AIServiceRevenueBonus    = 'AI_SERVICE_REVENUE_BONUS',
  AICapacityBonus          = 'AI_CAPACITY_BONUS',
}

export interface TechNodeEffect {
  type: TechEffectType;
  value: number;
  description: string;
}

export interface TechNode {
  id: string;
  name: string;
  category: TechCategory;
  description: string;
  effects: TechNodeEffect[];
  prerequisites: string[];
  mutuallyExclusiveWith?: string[];
  mutuallyExclusiveGroupId?: string;
  investmentCostNTD: Money;
  implementationMonths: number;
  unlockYear: number;
  status: TechNodeStatus;
  progressMonths: number;
  startedAt: GameDate | null;
  completedAt: GameDate | null;
}

export interface TechTreeEffect {
  nodeId: string;
  nodeName: string;
  type: TechEffectType;
  value: number;
  description: string;
}

// ─── Reputation types ─────────────────────────────────────────────────────────

export interface SatisfactionSnapshot {
  date: GameDate;
  score: number;
  delta: number;
  topPositiveFactors: string[];
  topNegativeFactors: string[];
}

export interface SatisfactionModifier {
  id: string;
  description: string;
  delta: number;
  isOneTime: boolean;
  source: string;
  appliedAt: GameDate;
  expiresAt: GameDate | null;
}

export interface ReputationEffects {
  rfpFrequencyMod: number;
  renewalSuccessRateBonus: number;
  pricingPower: number;
  contractLossProbabilityMod: number;
}

// ─── New config types ─────────────────────────────────────────────────────────

export interface StaffRoleConfig {
  baseSalaryNTD: Money;
  managementCapacityU: number;
  handlingPower: number;
  recruitmentMonths: number;
  promotionRequirements: { minMonths: number; cost: Money };
  unlockYear: number;
  unlockCondition?: string;
}

export interface StaffConfig {
  roles: Record<StaffRole, StaffRoleConfig>;
  benefitMultiplier: number;
  baseAnnualResignationRate: number;
  salaryInflationRate: number;
  coverageRatioThresholds: {
    optimal: number;
    warning: number;
    critical: number;
    severe: number;
  };
  interviewQuestionCount: number;
  severanceMonthsPerYear: number;
}

export interface SecurityConfig {
  baseIncidentRates: Record<IncidentType, number>;
  incidentSeverity: Record<IncidentType, IncidentSeverity>;
  baseResolutionHours: Record<IncidentType, number>;
  deadlineHours: Record<IncidentSeverity, number>;
  hourlyLossRate: Record<IncidentSeverity, number>;
  complianceScoreThresholds: {
    bonus: number;
    neutral: number;
    penalty1: number;
    penalty2: number;
  };
  ransomPaymentRate: number;
  dataBreachReportWindowHours: number;
}

export interface EventTimelineConfig {
  economicCycleDurationRange: [number, number];
  randomEventCooldownRange: [number, number];
  baseInflationRate: number;
  inflationVolatility: number;
  baseExchangeRate: number;
  exchangeRateMonthlyVolatility: number;
}

export interface TechTreeConfig {
  cancelRefundRate: number;
  milestoneRequiredNodes: number;
}

export interface ReputationConfig {
  initialScore: number;
  naturalRecoveryPerMonth: number;
  naturalRecoveryThreshold: number;
  highSatisfactionThreshold: number;
  lowSatisfactionThreshold: number;
  criticalSatisfactionThreshold: number;
  renewalBonusAtHighSatisfaction: number;
  priceIncreaseRange: [number, number];
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

// ─── Achievement types ─────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: GameDate | null;
  rewardReputation?: number;
  rewardCash?: Money;
}

// ─── Competitor types ──────────────────────────────────────────────────────────

export interface Competitor {
  id: string;
  name: string;
  specialty: string;
  marketShare: number;
  pricingIndex: number;
  techLevel: number;
  reputation: number;
  description: string;
}

// ─── Procurement types ────────────────────────────────────────────────────────

export type ProcurementTier = 'direct' | 'approval' | 'bidding';

// ─── Maintenance / facility runtime types ─────────────────────────────────────

export interface RegionMaintenanceState {
  lastMaintenanceDate: GameDate | null;
  monthsSinceMaintenance: number;
  maintenanceDue: boolean;
  isUnderMaintenance: boolean;
  maintenanceCompletesAt: GameDate | null;
  generatorLastMaintenance: GameDate | null;
  generatorMonthsSinceMaintenance: number;
  generatorMaintenanceDue: boolean;
  generatorHealthy: boolean;
  peakSeasonActive: boolean;
}

// ─── Random event types ───────────────────────────────────────────────────────

export interface RandomGameEvent {
  id: string;
  name: string;
  description: string;
  icon: string;
  options: Array<{
    label: string;
    description: string;
    effects: EventEffect[];
  }>;
  defaultOptionIndex: number;
  decisionWindowMonths: number;
}

export interface ActiveRandomEvent {
  id: string;
  instanceId: string;
  name: string;
  description: string;
  icon: string;
  options: Array<{ label: string; description: string; effects: EventEffect[] }>;
  defaultOptionIndex: number;
  triggeredAt: GameDate;
  expiresAt: GameDate;
  isExpired: boolean;
  decidedOptionIndex: number | null;
}

// ─── Strategy types ───────────────────────────────────────────────────────────

export type StrategyRoute = 'GOVERNMENT' | 'STARTUP' | 'ENTERPRISE';

export interface StrategyScores {
  government: number;
  startup: number;
  enterprise: number;
}

export interface StrategyConfig {
  establishThreshold: number;
  reputationBonusOnEstablish: number;
  rfpBoostOnRoute: number;
}

// ─── Customer types ───────────────────────────────────────────────────────────

export type CustomerIndustry = 'healthcare' | 'finance' | 'tech' | 'government' | 'ecommerce' | 'manufacturing';
export type CustomerSize = 'S' | 'M' | 'L' | 'XL';
export type CustomerLifecycleStatus = 'active' | 'churned';

export interface NamedCustomer {
  id: EntityId;
  name: string;
  industry: CustomerIndustry;
  size: CustomerSize;
  loyaltyScore: number;
  monthsAsCustomer: number;
  referralChance: number;
  status: CustomerLifecycleStatus;
  contractIds: EntityId[];
  totalRevenue: Money;
  lastSurveyScore: number | null;
  acquisitionDate: GameDate;
}

export interface CustomerConfig {
  referralCheckMonths: number;
  xlChurnReputationPenalty: number;
  sChurnReputationPenalty: number;
  surveyMonth: number;
  loyaltyRenewalBonus: number;
}

// ─── Vendor types ─────────────────────────────────────────────────────────────

export type VendorId = 'DELL' | 'HPE' | 'CISCO' | 'FORTINET' | 'MICROSOFT' | 'VMWARE';
export type VendorLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface VendorRelationship {
  vendorId: VendorId;
  name: string;
  relationshipLevel: number;
  discountRate: number;
  priorityDelivery: boolean;
  totalPurchases: Money;
  level: VendorLevel;
}

export interface VendorConfig {
  purchasePerPoint: Money;
  goldThreshold: number;
  platinumThreshold: number;
  silverThreshold: number;
  goldDiscount: number;
  platinumDiscount: number;
  concentrationRiskThreshold: number;
  deliverySpeedupMonths: number;
}

// ─── Staff certification types ────────────────────────────────────────────────

export type CertificationType = 'CCNA' | 'AWS_SAA' | 'CISSP' | 'ITIL' | 'PMP';

export interface CertificationDef {
  type: CertificationType;
  name: string;
  costNTD: Money;
  durationMonths: number;
  effectDescription: string;
  effectKey: string;
  effectValue: number;
}

export interface StaffCertification {
  type: CertificationType;
  earnedAt: GameDate;
}

export interface CertificationInProgress {
  staffId: EntityId;
  type: CertificationType;
  startedAt: GameDate;
  completesAt: GameDate;
  costNTD: Money;
}

// ─── DR Drill / Audit types ───────────────────────────────────────────────────

export interface DRDrill {
  id: EntityId;
  startedAt: GameDate;
  completesAt: GameDate;
  costNTD: Money;
  status: 'in_progress' | 'passed' | 'failed';
  successChance: number;
  yearOfDrill: number;
}

export interface AuditCheckItem {
  name: string;
  passed: boolean;
  points: number;
}

export interface SecurityAuditRecord {
  id: EntityId;
  year: number;
  triggeredAt: GameDate;
  status: 'in_progress' | 'passed' | 'failed';
  score: number;
  checklist: AuditCheckItem[];
}

// ─── Board / KPI types ────────────────────────────────────────────────────────

export type KPIType = 'revenue_growth' | 'customer_count' | 'sla_rate' | 'gross_margin';

export interface KPITarget {
  id: string;
  type: KPIType;
  description: string;
  targetValue: number;
  currentValue: number;
  isAchieved: boolean;
}

export interface BoardYearResult {
  year: number;
  achievedCount: number;
  totalCount: number;
  bonus: Money;
  hadWarning: boolean;
}

export interface BoardConfig {
  bonusMonthsOfRevenue: number;
  partialBonusMonthsOfRevenue: number;
  warningThreshold: number;
  gameOverConsecutiveFailYears: number;
  kpiRevenueGrowthTarget: number;
  kpiCustomerCountTarget: number;
  kpiSlaRateTarget: number;
  kpiGrossMarginTarget: number;
}

// ─── Tech Debt types ──────────────────────────────────────────────────────────

export enum TechDebtLevel {
  Healthy  = 'HEALTHY',
  Warning  = 'WARNING',
  Danger   = 'DANGER',
  Critical = 'CRITICAL',
}

export interface TechDebtItem {
  id: string;
  source: string;
  points: number;
  addedAt: GameDate;
  description: string;
}

export interface TechDebtConfig {
  eolSoftwarePointsPerMonth: number;
  skippedMaintenancePoints: number;
  shortStaffedContractPoints: number;
  eolHardwareOver2YrsPointsPerMonth: number;
  emergencyWorkaroundPoints: number;
  criticalCascadeFailureChance: number;
  criticalThreshold: number;
  dangerThreshold: number;
  warningThreshold: number;
  maxPoints: number;
  refactorCostPerPoint: Money;
}

// ─── Compliance cert types ────────────────────────────────────────────────────

export enum ComplianceCertType {
  ISO_27001 = 'ISO_27001',
  SOC2      = 'SOC2',
  HIPAA     = 'HIPAA',
  PCI_DSS   = 'PCI_DSS',
  ISO_20000 = 'ISO_20000',
  CSA_STAR  = 'CSA_STAR',
}

export enum ComplianceCertStatus {
  NotAcquired = 'NOT_ACQUIRED',
  InProgress  = 'IN_PROGRESS',
  Active      = 'ACTIVE',
  Renewal     = 'RENEWAL',
  Expired     = 'EXPIRED',
}

export interface ComplianceCertRecord {
  type: ComplianceCertType;
  status: ComplianceCertStatus;
  acquiredAt: GameDate | null;
  expiresAt: GameDate | null;
  progressMonths: number;
  requiredMonths: number;
  annualRenewalCost: Money;
  isRenewalInProgress: boolean;
}

export interface ComplianceCertsDef {
  acquisitionCostNTD: Money;
  acquisitionMonths: number;
  annualRenewalCostNTD: Money;
  validityYears: number;
  prerequisiteSecAnalysts: number;
  renewalMonths: number;
}

export interface ComplianceCertsConfig {
  certDefs: Record<ComplianceCertType, ComplianceCertsDef>;
}

// ─── Expansion types ──────────────────────────────────────────────────────────

export enum AcquisitionStatus {
  Available   = 'AVAILABLE',
  Integrating = 'INTEGRATING',
  Completed   = 'COMPLETED',
  Declined    = 'DECLINED',
}

export interface AcquisitionTarget {
  id: string;
  name: string;
  city: string;
  annualRevenue: Money;
  customerCount: number;
  techDebtInherit: number;
  acquisitionMultiplier: number;
  status: AcquisitionStatus;
  availableFromYear: number;
}

export interface ExpansionConfig {
  acquisitionUnlockYear: number;
  newFacilityUnlockYear: number;
  integrationMonths: number;
  integrationMoralePenalty: number;
  integrationTechDebt: number;
  drAbilityBonusFromSecondCity: number;
  acquisitionTargets: AcquisitionTarget[];
}

// ─── Event chain types ────────────────────────────────────────────────────────

export interface EventChainStep {
  id: string;
  name: string;
  description: string;
  resolutionWindowMonths: number;
  consequence: string;
  autoTriggerNextId: string | null;
}

export interface EventChain {
  id: string;
  name: string;
  icon: string;
  description: string;
  triggerCondition: 'always' | 'tech_debt_high' | 'staff_low' | 'cert_expired' | 'energy_spike';
  triggerYear?: number;
  steps: EventChainStep[];
}

export interface ActiveEventChain {
  chainId: string;
  chainName: string;
  chainIcon: string;
  currentStepIndex: number;
  stepStartDate: GameDate;
  resolutionDeadline: GameDate;
  isResolved: boolean;
  isEscalated: boolean;
}

// ─── Energy types ─────────────────────────────────────────────────────────────

export enum ElectricityStrategy {
  Spot    = 'SPOT',
  Fixed1Y = 'FIXED_1Y',
  Fixed3Y = 'FIXED_3Y',
}

export interface EnergyState {
  strategy: ElectricityStrategy;
  hasSolar: boolean;
  hasStorage: boolean;
  esgScore: number;
  carbonTaxActive: boolean;
  monthlyElectricityCostMultiplier: number;
  fixedContractExpiry: GameDate | null;
  esgBonusTriggered: boolean;
}

export interface EnergyConfig {
  solarUnlockYear: number;
  solarInstallCost: Money;
  solarMonthlyReduction: number;
  storageUnlockYear: number;
  storageInstallCost: Money;
  storagePeakSavings: number;
  carbonTaxStartYear: number;
  carbonTaxMonthly: Money;
  greenEsgDiscount: number;
  spotVolatility: number;
  fixed1YDiscount: number;
  fixed3YDiscount: number;
  fixed3YPrepayMonths: number;
  esgRfpBonus: number;
  esgThresholdForBonus: number;
}
