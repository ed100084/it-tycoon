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
  unlockAt: number; // tier index unlock threshold (0 = start unlocked)
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

export interface ZoneState {
  id: string;
  name: string;
  capacity: number;
  used: number;
  unlocked: boolean;
  cpsMultiplier: number;
  powerMultiplier: number;
}

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

export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number; // Reputation cost
  requires: string[];
  excludes: string[];
  effect: Record<string, number>;
  unlocked: boolean;
}

export type AchievementCategory =
  | 'milestone'
  | 'hardware'
  | 'audit'
  | 'efficiency'
  | 'expansion'
  | 'bureaucracy'
  | 'prestige'
  | 'technology';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  unlocked: boolean;
}

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
