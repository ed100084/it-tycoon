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

export interface ZoneState {
  id: string;
  name: string;
  capacity: number;
  used: number;
  unlocked: boolean;
  cpsMultiplier: number;
  powerMultiplier: number;
}

export interface AuditEvent {
  id: string;
  type: 'iso27001' | 'moh' | 'client' | 'drill';
  title: string;
  description: string;
  timeLimit: number;
  active: boolean;
  startedAt: number;
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

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'milestone' | 'hardware' | 'audit' | 'efficiency' | 'expansion' | 'bureaucracy';
  condition: (state: SaveData) => boolean;
  unlocked: boolean;
}

export interface SaveData {
  version: number;
  compute: number;
  totalEarnedCompute: number;
  hardware: Record<string, HardwareState>;
  pueLevel: number;
  isShutdown: boolean;
  satisfaction: number;
  reputation: number;
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
