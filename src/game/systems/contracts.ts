import {
  CONTRACT_FIRST_OFFER_DELAY,
  CONTRACT_OFFER_INTERVAL_BASE,
  CONTRACT_OFFER_INTERVAL_VARIANCE,
  CONTRACT_OFFER_WINDOW,
  CONTRACT_PAYOUT_MAX_SCALE,
  CONTRACT_TEMPLATES,
  MAX_ACTIVE_CONTRACTS,
  MAX_PENDING_OFFERS,
  type ContractTemplate,
} from '../config/contract.config';
import type { ActiveContract, ContractOffer } from '../models/types';

export function calcContractReservedUnits(contracts: ActiveContract[]): number {
  return contracts.reduce((total, contract) => total + Math.max(0, contract.reservedUnits), 0);
}

export function calcContractIncomePerSecond(contracts: ActiveContract[]): number {
  return contracts.reduce((total, contract) => total + Math.max(0, contract.payoutPerSecond), 0);
}

export function calcInitialContractOfferAt(now: number): number {
  return now + CONTRACT_FIRST_OFFER_DELAY;
}

export function calcNextContractOfferAt(now: number): number {
  return now + CONTRACT_OFFER_INTERVAL_BASE + Math.random() * CONTRACT_OFFER_INTERVAL_VARIANCE;
}

export function canSpawnContractOffer(offers: ContractOffer[], contracts: ActiveContract[]): boolean {
  return offers.length < MAX_PENDING_OFFERS && contracts.length < MAX_ACTIVE_CONTRACTS;
}

/** Progress scaling so a template stays relevant as the economy grows. */
export function contractPayoutScale(totalEarned: number, minTotalEarned: number): number {
  if (!Number.isFinite(totalEarned) || minTotalEarned <= 0) return 1;
  const raw = Math.sqrt(totalEarned / minTotalEarned);
  return Math.min(CONTRACT_PAYOUT_MAX_SCALE, Math.max(1, raw));
}

function eligibleTemplates(totalEarned: number): ContractTemplate[] {
  return CONTRACT_TEMPLATES.filter((template) => totalEarned >= template.minTotalEarned);
}

export function createContractOffer(now: number, totalEarned: number): ContractOffer | null {
  const eligible = eligibleTemplates(totalEarned);
  if (eligible.length === 0) return null;

  const template = eligible[Math.floor(Math.random() * eligible.length)];
  const scale = contractPayoutScale(totalEarned, template.minTotalEarned);
  const clientName = template.clientNames[Math.floor(Math.random() * template.clientNames.length)];

  return {
    id: `CON-${Math.floor(now)}-${template.serviceType}-${Math.random().toString(36).slice(2, 7)}`,
    clientName,
    serviceType: template.serviceType,
    reservedUnits: template.reservedUnits,
    payoutPerSecond: Math.ceil(template.basePayoutPerSecond * scale),
    durationSeconds: template.durationSeconds,
    signingBonus: Math.ceil(template.baseSigningBonus * scale),
    slaPenaltyPerSecond: template.slaPenaltyPerSecond,
    completionReward: template.completionReward,
    createdAt: now,
    expiresAt: now + CONTRACT_OFFER_WINDOW,
  };
}

export function getOfferRemainingSeconds(offer: ContractOffer, now: number): number {
  return Math.max(0, offer.expiresAt - now);
}

export function isContractOfferExpired(offer: ContractOffer, now: number): boolean {
  return getOfferRemainingSeconds(offer, now) <= 0;
}

export function getContractRemainingSeconds(contract: ActiveContract, now: number): number {
  return Math.max(0, contract.endsAt - now);
}

export function signContract(offer: ContractOffer, now: number): ActiveContract {
  return {
    id: offer.id,
    clientName: offer.clientName,
    serviceType: offer.serviceType,
    reservedUnits: offer.reservedUnits,
    payoutPerSecond: offer.payoutPerSecond,
    slaPenaltyPerSecond: offer.slaPenaltyPerSecond,
    completionReward: offer.completionReward,
    startedAt: now,
    endsAt: now + offer.durationSeconds,
    breachSeconds: 0,
    totalPaid: 0,
  };
}
