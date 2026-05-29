import type { ContractServiceType } from '../models/types';

export interface ContractTemplate {
  serviceType: ContractServiceType;
  label: string;                // short service label shown in the UI
  clientNames: string[];        // pool of flavour client names
  reservedUnits: number;        // rack U the contract occupies
  basePayoutPerSecond: number;  // CF/s at the moment it first unlocks
  durationSeconds: number;      // contract length once signed
  baseSigningBonus: number;     // one-off CF on accept (before scaling)
  slaPenaltyPerSecond: number;  // satisfaction lost per second of downtime
  completionReward: number;     // satisfaction granted on completion
  minTotalEarned: number;       // unlock gate (total earned compute)
}

// Contracts trade scarce rack U for steady CF income. Each tier unlocks as the
// player's economy grows; payout/bonus scale up with progress (see
// CONTRACT_PAYOUT_MAX_SCALE) so a template stays relevant before the next one
// takes over. Units and duration are fixed per template.
export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    serviceType: 'colocation',
    label: 'Colocation',
    clientNames: ['本地會計事務所', '社區診所', '小型電商', '在地媒體'],
    reservedUnits: 10,
    basePayoutPerSecond: 8,
    durationSeconds: 120,
    baseSigningBonus: 120,
    slaPenaltyPerSecond: 0.3,
    completionReward: 2,
    minTotalEarned: 500,
  },
  {
    serviceType: 'vps',
    label: 'VPS',
    clientNames: ['區域連鎖門市', '線上遊戲工作室', '物流平台', 'SaaS 新創'],
    reservedUnits: 25,
    basePayoutPerSecond: 90,
    durationSeconds: 180,
    baseSigningBonus: 1500,
    slaPenaltyPerSecond: 0.45,
    completionReward: 3,
    minTotalEarned: 50_000,
  },
  {
    serviceType: 'managed',
    label: 'Managed',
    clientNames: ['上市製造商', '區域銀行', '醫學中心', '電信子公司'],
    reservedUnits: 60,
    basePayoutPerSecond: 1100,
    durationSeconds: 240,
    baseSigningBonus: 18_000,
    slaPenaltyPerSecond: 0.6,
    completionReward: 4,
    minTotalEarned: 5_000_000,
  },
  {
    serviceType: 'cloud',
    label: 'Cloud',
    clientNames: ['中央部會', '跨國雲端商', '國家級研究院', '大型串流平台'],
    reservedUnits: 150,
    basePayoutPerSecond: 15_000,
    durationSeconds: 300,
    baseSigningBonus: 250_000,
    slaPenaltyPerSecond: 0.8,
    completionReward: 5,
    minTotalEarned: 500_000_000,
  },
];

export const CONTRACT_FIRST_OFFER_DELAY = 60;       // seconds before the first offer
export const CONTRACT_OFFER_INTERVAL_BASE = 90;     // base seconds between offers
export const CONTRACT_OFFER_INTERVAL_VARIANCE = 60; // added random spread
export const CONTRACT_OFFER_WINDOW = 75;            // seconds an offer stays open
export const MAX_PENDING_OFFERS = 3;
export const MAX_ACTIVE_CONTRACTS = 12;
export const CONTRACT_PAYOUT_MAX_SCALE = 8;         // cap on progress scaling
// Accumulated downtime (seconds) during a contract before the client walks.
export const CONTRACT_BREACH_TERMINATION_SECONDS = 25;
// Satisfaction hit when a contract is terminated early for SLA failure
// (expressed as a multiple of its completion reward).
export const CONTRACT_TERMINATION_PENALTY_MULTIPLIER = 2.5;

export const CONTRACT_SERVICE_LABELS: Record<ContractServiceType, string> = {
  colocation: 'Colocation',
  vps: 'VPS',
  managed: 'Managed Hosting',
  cloud: 'Cloud Platform',
};
