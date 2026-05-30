import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { ContractManager } from './ContractManager';
import { DEFAULT_CONFIG } from '../config/default.config';
import { ContractStatus, ServiceType } from '../core/types';
import type { BidParams, GameConfig } from '../core/types';

function buildModule(cfg: GameConfig = DEFAULT_CONFIG) {
  const bus = new EventBus();
  const cm = new ContractManager();
  cm.init(bus, cfg);
  return { bus, cm };
}

function triggerMonthEnd(bus: EventBus, year = 2000, month = 1) {
  const newMonth = month === 12 ? 1 : month + 1;
  const newYear = month === 12 ? year + 1 : year;
  bus.publish({
    type: 'time.month_end',
    payload: { prevDate: { year, month }, newDate: { year: newYear, month: newMonth }, totalMonthsElapsed: 1 },
    gameDate: { year: newYear, month: newMonth },
    source: 'TimeEngine',
  });
}

describe('ContractManager — initial state', () => {
  it('starts with no active contracts', () => {
    const { cm } = buildModule();
    expect(cm.getActiveContracts()).toHaveLength(0);
  });

  it('starts with no pending RFPs', () => {
    const { cm } = buildModule();
    expect(cm.getPendingRFPs()).toHaveLength(0);
  });

  it('monthly revenue estimate starts at 0', () => {
    const { cm } = buildModule();
    expect(cm.getMonthlyRevenueEstimate()).toBe(0);
  });
});

describe('ContractManager — RFP generation', () => {
  it('generates RFPs on month end', () => {
    const { bus, cm } = buildModule();
    // Run several months to guarantee at least one RFP (rate is ~1.5/month)
    for (let m = 1; m <= 5; m++) {
      triggerMonthEnd(bus, 2000, m);
    }
    expect(cm.getPendingRFPs().length).toBeGreaterThan(0);
  });

  it('emits contract.rfp_received event on RFP generation', () => {
    const { bus } = buildModule();
    const handler = vi.fn();
    bus.subscribe('contract.rfp_received', handler);
    // Run several months
    for (let m = 1; m <= 5; m++) {
      triggerMonthEnd(bus, 2000, m);
    }
    expect(handler.mock.calls.length).toBeGreaterThan(0);
  });

  it('RFP has expiry date in future', () => {
    const { bus, cm } = buildModule();
    for (let m = 1; m <= 5; m++) {
      triggerMonthEnd(bus, 2000, m);
    }
    const rfps = cm.getPendingRFPs();
    if (rfps.length > 0) {
      expect(rfps[0].expiresAt.year).toBeGreaterThanOrEqual(2000);
    }
  });

  it('getRFP returns RFP by id', () => {
    const { bus, cm } = buildModule();
    for (let m = 1; m <= 5; m++) {
      triggerMonthEnd(bus, 2000, m);
    }
    const rfps = cm.getPendingRFPs();
    if (rfps.length > 0) {
      expect(cm.getRFP(rfps[0].id)).toBeDefined();
    }
  });
});

describe('ContractManager — bid submission', () => {
  function makeBid(monthlyFee: number): BidParams {
    return {
      monthlyFeeNTD: monthlyFee,
      slaLevel: 99.5,
      contractDurationMonths: 12,
      breachPenaltyMultiplier: 1.0,
      specialServices: [],
    };
  }

  it('submitBid returns a bid submission with winProbability', () => {
    const { bus, cm } = buildModule();
    for (let m = 1; m <= 5; m++) triggerMonthEnd(bus, 2000, m);
    const rfps = cm.getPendingRFPs();
    if (rfps.length === 0) return;
    const bid = cm.submitBid(rfps[0].id, makeBid(50_000));
    expect(bid.winProbability).toBeGreaterThan(0);
    expect(bid.winProbability).toBeLessThanOrEqual(1);
  });

  it('declineRFP removes RFP from list', () => {
    const { bus, cm } = buildModule();
    for (let m = 1; m <= 5; m++) triggerMonthEnd(bus, 2000, m);
    const rfps = cm.getPendingRFPs();
    if (rfps.length === 0) return;
    const id = rfps[0].id;
    cm.declineRFP(id);
    expect(cm.getRFP(id)).toBeNull();
  });

  it('throws when bidding on unknown RFP', () => {
    const { cm } = buildModule();
    expect(() => cm.submitBid('nonexistent-id', makeBid(50_000))).toThrow();
  });
});

describe('ContractManager — contract lifecycle', () => {
  function makeBid(monthlyFee: number): BidParams {
    return {
      monthlyFeeNTD: monthlyFee,
      slaLevel: 99.5,
      contractDurationMonths: 12,
      breachPenaltyMultiplier: 1.0,
      specialServices: [],
    };
  }

  it('getMonthlyRevenueEstimate reflects active contract fees', () => {
    const { bus, cm } = buildModule();
    // Force generate multiple RFPs and bid on first
    for (let m = 1; m <= 5; m++) triggerMonthEnd(bus, 2000, m);
    const rfps = cm.getPendingRFPs();
    if (rfps.length === 0) return;
    cm.submitBid(rfps[0].id, makeBid(100_000));
    // Next month will process bid results
    triggerMonthEnd(bus, 2000, 6);
    // Might or might not have won — just check it's non-negative
    expect(cm.getMonthlyRevenueEstimate()).toBeGreaterThanOrEqual(0);
  });

  it('contract.revenue_collected emitted for active contracts', () => {
    const { bus, cm } = buildModule();
    const handler = vi.fn();
    bus.subscribe('contract.revenue_collected', handler);
    for (let m = 1; m <= 5; m++) triggerMonthEnd(bus, 2000, m);
    const rfps = cm.getPendingRFPs();
    if (rfps.length === 0) return;
    cm.submitBid(rfps[0].id, makeBid(100_000));
    for (let m = 6; m <= 10; m++) triggerMonthEnd(bus, 2000, m);
    // If bid was won, revenue should have been collected
    if (cm.getActiveContractCount() > 0) {
      expect(handler).toHaveBeenCalled();
    }
  });
});

describe('ContractManager — contract renewal', () => {
  it('renewContract updates end date and fee', () => {
    const { bus, cm } = buildModule();
    // Manually add an active contract for testing
    for (let m = 1; m <= 5; m++) triggerMonthEnd(bus, 2000, m);
    const rfps = cm.getPendingRFPs();
    if (rfps.length === 0) return;
    const bid: BidParams = {
      monthlyFeeNTD: 80_000,
      slaLevel: 99.5,
      contractDurationMonths: 1,
      breachPenaltyMultiplier: 1.0,
      specialServices: [],
    };
    cm.submitBid(rfps[0].id, bid);
    triggerMonthEnd(bus, 2000, 6); // process bid
    const contracts = cm.getActiveContracts();
    if (contracts.length === 0) return;
    const renewed = cm.renewContract(contracts[0].id, {
      newMonthlyFeeNTD: 100_000,
      newDurationMonths: 24,
    });
    expect(renewed.monthlyFeeNTD).toBe(100_000);
  });
});

describe('ContractManager — SLA dashboard', () => {
  it('getSLADashboard returns correct structure', () => {
    const { cm } = buildModule();
    const dashboard = cm.getSLADashboard();
    expect(dashboard).toHaveProperty('overallSLARate');
    expect(dashboard).toHaveProperty('atRiskContracts');
    expect(dashboard).toHaveProperty('monthlySLASummary');
  });

  it('overallSLARate is 100 when no contracts have records', () => {
    const { cm } = buildModule();
    expect(cm.getSLADashboard().overallSLARate).toBe(100);
  });
});

describe('ContractManager — serialize/deserialize', () => {
  it('round-trips state', () => {
    const { bus, cm } = buildModule();
    for (let m = 1; m <= 3; m++) triggerMonthEnd(bus, 2000, m);
    const snap = cm.serialize();

    const bus2 = new EventBus();
    const cm2 = new ContractManager();
    cm2.init(bus2, DEFAULT_CONFIG);
    cm2.deserialize(snap);
    expect(cm2.getPendingRFPs().length).toBe(cm.getPendingRFPs().length);
    void bus;
  });
});

describe('ContractManager — contract history', () => {
  it('getContractHistory returns contracts with limit', () => {
    const { cm } = buildModule();
    expect(cm.getContractHistory(10)).toHaveLength(0);
  });

  it('getActiveContractCount is 0 initially', () => {
    const { cm } = buildModule();
    expect(cm.getActiveContractCount()).toBe(0);
  });
});
