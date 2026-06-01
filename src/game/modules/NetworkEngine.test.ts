import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { NetworkEngine } from './NetworkEngine';
import { ISPProvider, BandwidthTier, RedundancyMode } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';

function build() {
  const bus = new EventBus();
  const ne = new NetworkEngine();
  ne.init(bus, DEFAULT_CONFIG);
  return { bus, ne };
}

function monthEnd(bus: EventBus, year: number, month: number) {
  bus.publish({ type: 'time.month_end', payload: { newDate: { year, month } }, source: 'test', gameDate: { year, month } });
}

describe('NetworkEngine', () => {
  it('1. initial totalBandwidthMbps is 0', () => {
    const { ne } = build();
    expect(ne.getNetworkState().totalBandwidthMbps).toBe(0);
  });

  it('2. addISPContract returns null on success', () => {
    const { ne } = build();
    const result = ne.addISPContract(ISPProvider.FarEasTone, BandwidthTier.B100M);
    expect(result).toBeNull();
  });

  it('3. addISPContract increases totalBandwidthMbps', () => {
    const { ne } = build();
    ne.addISPContract(ISPProvider.FarEasTone, BandwidthTier.B100M);
    expect(ne.getNetworkState().totalBandwidthMbps).toBe(100);
  });

  it('4. addISPContract publishes finance.expense_requested', () => {
    const { bus, ne } = build();
    const expenses: unknown[] = [];
    bus.subscribe('finance.expense_requested', e => expenses.push(e));
    ne.addISPContract(ISPProvider.FarEasTone, BandwidthTier.B100M);
    expect(expenses.length).toBeGreaterThanOrEqual(1);
  });

  it('5. removeISPContract decreases totalBandwidthMbps', () => {
    const { ne } = build();
    ne.addISPContract(ISPProvider.FarEasTone, BandwidthTier.B100M);
    const contractId = ne.getNetworkState().ispContracts[0].id;
    ne.removeISPContract(contractId);
    expect(ne.getNetworkState().totalBandwidthMbps).toBe(0);
  });

  it('6. redundancy mode can be changed', () => {
    const { ne } = build();
    ne.setRedundancyMode(RedundancyMode.DualISP);
    expect(ne.getNetworkState().redundancyMode).toBe(RedundancyMode.DualISP);
  });

  it('7. enableIXPeering fails before unlock year', () => {
    const { ne } = build();
    const err = ne.enableIXPeering(2004);
    expect(err).toBeTruthy();
    expect(ne.getNetworkState().ixPeering).toBe(false);
  });

  it('8. enableIXPeering succeeds at unlock year', () => {
    const { ne } = build();
    const err = ne.enableIXPeering(2005);
    expect(err).toBeNull();
    expect(ne.getNetworkState().ixPeering).toBe(true);
  });

  it('9. after ixPeering, getEffectiveMonthlyCost returns discounted amount', () => {
    const { ne } = build();
    ne.addISPContract(ISPProvider.FarEasTone, BandwidthTier.B1G);
    const costBefore = ne.getEffectiveMonthlyCost();
    // Reset and add contract after IX peering
    const { ne: ne2 } = build();
    ne2.enableIXPeering(2005);
    ne2.addISPContract(ISPProvider.FarEasTone, BandwidthTier.B1G);
    const costAfter = ne2.getEffectiveMonthlyCost();
    expect(costAfter).toBeLessThan(costBefore);
  });

  it('10. bandwidthUtilization updates when contract activated', () => {
    const { bus, ne } = build();
    ne.addISPContract(ISPProvider.FarEasTone, BandwidthTier.B100M);
    bus.publish({ type: 'contract.activated', payload: {}, source: 'test', gameDate: { year: 2000, month: 1 } });
    const state = ne.getNetworkState();
    expect(state.bandwidthUtilization).toBeGreaterThan(0);
  });

  it('11. qualityDegradationActive activates when over SLA threshold', () => {
    const { bus, ne } = build();
    // One 100M ISP contract = 100 Mbps total. Each contract.activated increments
    // activeCustomerContractCount; usedMbps = count * 10. Need count * 10 / 100 >= 0.95
    // => count >= 10. Fire 10 contract.activated events.
    ne.addISPContract(ISPProvider.APT, BandwidthTier.B100M);
    for (let i = 0; i < 10; i++) {
      bus.publish({ type: 'contract.activated', payload: {}, source: 'test', gameDate: { year: 2000, month: 1 } });
    }
    expect(ne.getNetworkState().qualityDegradationActive).toBe(true);
  });

  it('12. serialize/deserialize round-trips ixPeering and contracts', () => {
    const { ne } = build();
    ne.enableIXPeering(2005);
    ne.addISPContract(ISPProvider.Chunghwa, BandwidthTier.B1G);
    const serialized = ne.serialize();

    const { ne: ne2 } = build();
    ne2.deserialize(serialized);

    const state = ne2.getNetworkState();
    expect(state.ixPeering).toBe(true);
    expect(state.ispContracts).toHaveLength(1);
    expect(state.ispContracts[0].provider).toBe(ISPProvider.Chunghwa);
  });
});
