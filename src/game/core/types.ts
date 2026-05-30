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
