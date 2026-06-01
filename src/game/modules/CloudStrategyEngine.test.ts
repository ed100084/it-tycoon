import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { CloudStrategyEngine } from './CloudStrategyEngine';
import { CloudStrategy } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';

function build() {
  const bus = new EventBus();
  const cse = new CloudStrategyEngine();
  cse.init(bus, DEFAULT_CONFIG);
  return { bus, cse };
}

function monthEnd(bus: EventBus, year: number, month: number) {
  bus.publish({
    type: 'time.month_end',
    payload: { newDate: { year, month } },
    source: 'test',
    gameDate: { year, month },
  });
}

describe('CloudStrategyEngine', () => {
  it('1. initial strategy is OnPrem', () => {
    const { cse } = build();
    expect(cse.getCloudState().strategy).toBe(CloudStrategy.OnPrem);
  });

  it('2. cloudPressure starts at 0', () => {
    const { cse } = build();
    expect(cse.getCloudState().cloudPressure).toBe(0);
  });

  it('3. cloudCompeteActive is false before 2010', () => {
    const { cse } = build();
    expect(cse.getCloudState().cloudCompeteActive).toBe(false);
  });

  it('4. cloudCompeteActive becomes true after 2010 month_end', () => {
    const { bus, cse } = build();
    monthEnd(bus, 2010, 1);
    expect(cse.getCloudState().cloudCompeteActive).toBe(true);
  });

  it('5. cloudPressure grows after multiple month_end events post-2010', () => {
    const { bus, cse } = build();
    monthEnd(bus, 2010, 1);
    monthEnd(bus, 2010, 2);
    monthEnd(bus, 2010, 3);
    expect(cse.getCloudState().cloudPressure).toBeGreaterThan(0);
  });

  it('6. setStrategy to Hybrid deducts investment cost via hardware.purchased', () => {
    const { bus, cse } = build();
    const purchases: unknown[] = [];
    bus.subscribe('hardware.purchased', (e) => purchases.push(e));
    cse.setStrategy(CloudStrategy.Hybrid);
    expect(purchases).toHaveLength(1);
    const payload = (purchases[0] as { payload: { amount: number } }).payload;
    expect(payload.amount).toBe(DEFAULT_CONFIG.cloudStrategy!.hybridInvestmentCostNTD);
  });

  it('7. setStrategy to MSP fails if not Hybrid first', () => {
    const { cse } = build();
    // Currently OnPrem
    const err = cse.setStrategy(CloudStrategy.MSP);
    expect(err).toBeTruthy();
    expect(cse.getCloudState().strategy).toBe(CloudStrategy.OnPrem);
  });

  it('8. setStrategy to MSP succeeds when already Hybrid', () => {
    const { cse } = build();
    cse.setStrategy(CloudStrategy.Hybrid);
    const err = cse.setStrategy(CloudStrategy.MSP);
    expect(err).toBeNull();
    expect(cse.getCloudState().strategy).toBe(CloudStrategy.MSP);
  });

  it('9. dataSovereigntyOpportunity triggers in 2018', () => {
    const { bus, cse } = build();
    const events: unknown[] = [];
    bus.subscribe('cloud.sovereignty_opportunity', (e) => events.push(e));
    monthEnd(bus, 2018, 1);
    expect(cse.getCloudState().dataSovereigntyOpportunity).toBe(true);
    expect(events).toHaveLength(1);
  });

  it('10. addHybridContract increments hybridContractCount', () => {
    const { cse } = build();
    expect(cse.getCloudState().hybridContractCount).toBe(0);
    cse.addHybridContract();
    expect(cse.getCloudState().hybridContractCount).toBe(1);
    cse.addHybridContract();
    expect(cse.getCloudState().hybridContractCount).toBe(2);
  });

  it('11. getMigrationRisk for MSP is lower than OnPrem', () => {
    const { cse } = build();
    const riskOnPrem = cse.getMigrationRisk(); // OnPrem strategy
    cse.setStrategy(CloudStrategy.Hybrid);
    cse.setStrategy(CloudStrategy.MSP);
    const riskMSP = cse.getMigrationRisk();
    expect(riskMSP).toBeLessThan(riskOnPrem);
  });

  it('12. serialize/deserialize preserves strategy and cloudPressure', () => {
    const { bus, cse } = build();
    cse.setStrategy(CloudStrategy.Hybrid);
    monthEnd(bus, 2010, 1);
    monthEnd(bus, 2010, 2);
    const pressureBefore = cse.getCloudState().cloudPressure;

    const serialized = cse.serialize();

    const bus2 = new EventBus();
    const cse2 = new CloudStrategyEngine();
    cse2.init(bus2, DEFAULT_CONFIG);
    cse2.deserialize(serialized);

    expect(cse2.getCloudState().strategy).toBe(CloudStrategy.Hybrid);
    expect(cse2.getCloudState().cloudPressure).toBeCloseTo(pressureBefore, 5);
  });
});
