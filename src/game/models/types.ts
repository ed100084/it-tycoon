export interface HardwareDefinition {
  id: string;
  name: string;
  tier: number;
  baseCost: number;
  baseCps: number;
  watts: number;
  uSize: number;
  ascii: string[];
  description: string;
  unlockAt: number; // units of the PREVIOUS tier the player must own before this tier appears (0 = always visible)
}

export interface PUEDefinition {
  level: number;
  name: string;
  nameZh: string;
  pue: number;
  cost: number;
  description: string;
}

export interface UpgradeLevel {
  level: number;
  label: string;
  multiplier: number;
  costMultiplier: number; // relative to hardware baseCost
}

export interface HardwareState {
  owned: number;
  upgradeLevel: number; // 1-5
}

export interface FacilityRegionState {
  unlocked: boolean;
  capacity: number;
  expansionCount: number;
}

export type ProcurementStatus = 'pending' | 'ready' | 'blocked' | 'delivered';

export interface ProcurementRequest {
  id: string;
  tierId: string;
  qty: number;
  cost: number;
  submittedAt: number;
  readyAt: number;
  status: ProcurementStatus;
}

export type ContractServiceType = 'colocation' | 'vps' | 'managed' | 'cloud';

/** A pending customer offer the player can accept or decline. */
export interface ContractOffer {
  id: string;
  clientName: string;
  serviceType: ContractServiceType;
  reservedUnits: number;        // rack U the contract occupies while active
  payoutPerSecond: number;      // CF/s paid while the datacenter is online
  durationSeconds: number;      // total contract length once signed
  signingBonus: number;         // one-off CF paid on accept
  slaPenaltyPerSecond: number;  // satisfaction lost per second of downtime (SLA breach)
  completionReward: number;     // satisfaction granted on successful completion
  createdAt: number;
  expiresAt: number;            // gameTime when the offer lapses if not accepted
}

/** A signed, running contract. */
export interface ActiveContract {
  id: string;
  clientName: string;
  serviceType: ContractServiceType;
  reservedUnits: number;
  payoutPerSecond: number;
  slaPenaltyPerSecond: number;
  completionReward: number;
  startedAt: number;
  endsAt: number;               // gameTime when the contract completes
  breachSeconds: number;        // accumulated downtime during this contract
  totalPaid: number;            // CF earned from this contract so far
}

export type StaffRoleId = 'noc' | 'syseng' | 'secana' | 'manager';

/** Headcount per staff role. */
export type StaffState = Record<StaffRoleId, number>;

export type AuditEventType = 'iso27001' | 'moh' | 'client' | 'drill';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  title: string;
  description: string;
  timeLimit: number;
  active: boolean;
  startedAt: number;
  responseCost: number;
  satisfactionPenalty: number;
  satisfactionReward: number;
}

export type AchievementCategory =
  | 'milestone'
  | 'hardware'
  | 'audit'
  | 'efficiency'
  | 'expansion'
  | 'bureaucracy'
  | 'prestige'
  | 'technology'
  | 'contract'
  | 'staff';

export interface SaveData {
  version: number;
  compute: number;
  totalEarnedCompute: number;
  hardware: Record<string, HardwareState>;
  pueLevel: number;
  isShutdown: boolean;
  emergencyClicks?: number;
  rackCapacity?: number;
  facilityRegions?: Record<string, FacilityRegionState>;
  procurementRequests?: ProcurementRequest[];
  auditEvents?: AuditEvent[];
  nextAuditAt?: number;
  resolvedAudits?: number;
  failedAudits?: number;
  contracts?: ActiveContract[];
  contractOffers?: ContractOffer[];
  nextContractOfferAt?: number;
  completedContracts?: number;
  breachedContracts?: number;
  totalContractsSigned?: number;
  totalContractRevenue?: number;
  staff?: Record<string, number>;
  totalStaffHired?: number;
  satisfaction: number;
  reputation: number;
  totalEarnedReputation: number;
  influence: number;
  prestigeCount: number;
  lastSaveTime: number;
  gameTime: number;
  unlockedAchievements: string[];
  techNodes: string[];
}

export interface OfflineEarningsReport {
  elapsed: number;
  earnings: number;
  wasShutdown: boolean;
}
