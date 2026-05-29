import { describe, it, expect } from 'vitest';
import {
  calcContractReservedUnits,
  calcContractIncomePerSecond,
  contractPayoutScale,
  createContractOffer,
  signContract,
  getOfferRemainingSeconds,
  isContractOfferExpired,
  getContractRemainingSeconds,
  canSpawnContractOffer,
} from './contracts';
import {
  CONTRACT_OFFER_WINDOW,
  CONTRACT_PAYOUT_MAX_SCALE,
  CONTRACT_TEMPLATES,
  MAX_ACTIVE_CONTRACTS,
  MAX_PENDING_OFFERS,
} from '../config/contract.config';
import type { ActiveContract, ContractOffer } from '../models/types';

const contract = (over: Partial<ActiveContract> = {}): ActiveContract => ({
  id: 'C1',
  clientName: 'Client',
  serviceType: 'colocation',
  reservedUnits: 10,
  payoutPerSecond: 8,
  slaPenaltyPerSecond: 0.3,
  completionReward: 2,
  startedAt: 0,
  endsAt: 120,
  breachSeconds: 0,
  totalPaid: 0,
  ...over,
});

describe('contract aggregates', () => {
  it('sums reserved units and income across active contracts', () => {
    const list = [contract({ reservedUnits: 10, payoutPerSecond: 8 }), contract({ id: 'C2', reservedUnits: 25, payoutPerSecond: 90 })];
    expect(calcContractReservedUnits(list)).toBe(35);
    expect(calcContractIncomePerSecond(list)).toBe(98);
  });

  it('returns zero for an empty portfolio', () => {
    expect(calcContractReservedUnits([])).toBe(0);
    expect(calcContractIncomePerSecond([])).toBe(0);
  });
});

describe('contractPayoutScale', () => {
  it('is 1 at the unlock threshold', () => {
    expect(contractPayoutScale(500, 500)).toBe(1);
  });

  it('grows with the square root of progress', () => {
    expect(contractPayoutScale(2000, 500)).toBeCloseTo(2, 6); // sqrt(4)
  });

  it('caps at the configured maximum', () => {
    expect(contractPayoutScale(1e12, 500)).toBe(CONTRACT_PAYOUT_MAX_SCALE);
  });
});

describe('createContractOffer', () => {
  it('returns null before any template is unlocked', () => {
    const minGate = Math.min(...CONTRACT_TEMPLATES.map((t) => t.minTotalEarned));
    expect(createContractOffer(0, minGate - 1)).toBeNull();
  });

  it('produces a well-formed, capacity-bounded offer once unlocked', () => {
    const offer = createContractOffer(100, 1_000)!;
    expect(offer).not.toBeNull();
    expect(offer.reservedUnits).toBeGreaterThan(0);
    expect(offer.payoutPerSecond).toBeGreaterThan(0);
    expect(offer.signingBonus).toBeGreaterThanOrEqual(0);
    expect(offer.expiresAt).toBe(100 + CONTRACT_OFFER_WINDOW);
    expect(CONTRACT_TEMPLATES.some((t) => t.serviceType === offer.serviceType)).toBe(true);
  });
});

describe('signContract', () => {
  it('carries offer terms into a running contract with a fresh clock', () => {
    const offer: ContractOffer = {
      id: 'CON-1',
      clientName: 'Acme',
      serviceType: 'vps',
      reservedUnits: 25,
      payoutPerSecond: 90,
      durationSeconds: 180,
      signingBonus: 1500,
      slaPenaltyPerSecond: 0.45,
      completionReward: 3,
      createdAt: 10,
      expiresAt: 85,
    };
    const signed = signContract(offer, 50);
    expect(signed.id).toBe('CON-1');
    expect(signed.reservedUnits).toBe(25);
    expect(signed.payoutPerSecond).toBe(90);
    expect(signed.startedAt).toBe(50);
    expect(signed.endsAt).toBe(230); // 50 + 180
    expect(signed.breachSeconds).toBe(0);
    expect(signed.totalPaid).toBe(0);
  });
});

describe('timers', () => {
  const offer: ContractOffer = {
    id: 'o', clientName: 'c', serviceType: 'colocation', reservedUnits: 10,
    payoutPerSecond: 8, durationSeconds: 120, signingBonus: 100,
    slaPenaltyPerSecond: 0.3, completionReward: 2, createdAt: 0, expiresAt: 75,
  };

  it('reports offer remaining time and expiry', () => {
    expect(getOfferRemainingSeconds(offer, 50)).toBe(25);
    expect(isContractOfferExpired(offer, 50)).toBe(false);
    expect(isContractOfferExpired(offer, 75)).toBe(true);
  });

  it('reports active contract remaining time, clamped at zero', () => {
    expect(getContractRemainingSeconds(contract({ endsAt: 120 }), 90)).toBe(30);
    expect(getContractRemainingSeconds(contract({ endsAt: 120 }), 200)).toBe(0);
  });
});

describe('canSpawnContractOffer', () => {
  const makeOffers = (n: number): ContractOffer[] =>
    Array.from({ length: n }, (_, i) => ({ ...offerBase, id: `o${i}` }));
  const offerBase: ContractOffer = {
    id: 'o', clientName: 'c', serviceType: 'colocation', reservedUnits: 10,
    payoutPerSecond: 8, durationSeconds: 120, signingBonus: 100,
    slaPenaltyPerSecond: 0.3, completionReward: 2, createdAt: 0, expiresAt: 75,
  };

  it('blocks when the pending-offer cap is reached', () => {
    expect(canSpawnContractOffer(makeOffers(MAX_PENDING_OFFERS), [])).toBe(false);
    expect(canSpawnContractOffer(makeOffers(MAX_PENDING_OFFERS - 1), [])).toBe(true);
  });

  it('blocks when the active-contract cap is reached', () => {
    const active = Array.from({ length: MAX_ACTIVE_CONTRACTS }, (_, i) => contract({ id: `a${i}` }));
    expect(canSpawnContractOffer([], active)).toBe(false);
  });
});
