import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { EnergyEngine } from './EnergyEngine';
import { ElectricityStrategy } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';

function build() {
  const bus = new EventBus();
  const ee = new EnergyEngine();
  ee.init(bus, DEFAULT_CONFIG);
  return { bus, ee };
}

function monthEnd(bus: EventBus, year: number, month: number) {
  bus.publish({ type: 'time.month_end', payload: { newDate: { year, month } }, source: 'test', gameDate: { year, month } });
}

describe('EnergyEngine — initial state', () => {
  it('1. starts with SPOT strategy', () => {
    const { ee } = build();
    expect(ee.getEnergyState().strategy).toBe(ElectricityStrategy.Spot);
  });

  it('2. no solar initially', () => {
    const { ee } = build();
    expect(ee.getEnergyState().hasSolar).toBe(false);
  });

  it('3. no storage initially', () => {
    const { ee } = build();
    expect(ee.getEnergyState().hasStorage).toBe(false);
  });

  it('4. ESG score starts at 30', () => {
    const { ee } = build();
    expect(ee.getESGScore()).toBe(30);
  });

  it('5. carbon tax not active before 2020', () => {
    const { ee } = build();
    expect(ee.getEnergyState().carbonTaxActive).toBe(false);
  });
});

describe('EnergyEngine — setStrategy', () => {
  it('6. setStrategy changes the active strategy', () => {
    const { ee } = build();
    ee.setStrategy(ElectricityStrategy.Fixed1Y);
    expect(ee.getEnergyState().strategy).toBe(ElectricityStrategy.Fixed1Y);
  });

  it('7. Fixed3Y requires prepayment', () => {
    const { bus, ee } = build();
    const purchases: unknown[] = [];
    bus.subscribe('hardware.purchased', e => purchases.push(e));
    ee.setStrategy(ElectricityStrategy.Fixed3Y);
    expect(purchases).toHaveLength(1);
  });
});

describe('EnergyEngine — solar / storage', () => {
  it('8. installSolar fails before 2015', () => {
    const { ee } = build();
    const err = ee.installSolar(2010);
    expect(err).toBeTruthy();
  });

  it('9. installSolar succeeds from 2015', () => {
    const { ee } = build();
    const err = ee.installSolar(2015);
    expect(err).toBeNull();
    expect(ee.getEnergyState().hasSolar).toBe(true);
  });

  it('10. solar increases ESG score by 20', () => {
    const { ee } = build();
    const before = ee.getESGScore();
    ee.installSolar(2015);
    expect(ee.getESGScore()).toBe(before + 20);
  });

  it('11. installStorage fails before 2018', () => {
    const { ee } = build();
    const err = ee.installStorage(2016);
    expect(err).toBeTruthy();
  });

  it('12. carbon tax activates at 2020', () => {
    const { bus, ee } = build();
    monthEnd(bus, 2020, 1);
    expect(ee.getEnergyState().carbonTaxActive).toBe(true);
  });
});

describe('EnergyEngine — cost multiplier', () => {
  it('13. Fixed1Y discount reduces multiplier', () => {
    const { ee } = build();
    ee.setStrategy(ElectricityStrategy.Fixed1Y);
    expect(ee.getEffectiveElectricityCostMultiplier()).toBeCloseTo(0.95, 2);
  });

  it('14. serialize/deserialize preserves state', () => {
    const { ee } = build();
    ee.installSolar(2015);
    ee.setStrategy(ElectricityStrategy.Fixed1Y);
    const serialized = ee.serialize();
    const ee2 = new EnergyEngine();
    ee2.init(new EventBus(), DEFAULT_CONFIG);
    ee2.deserialize(serialized);
    expect(ee2.getEnergyState().hasSolar).toBe(true);
    expect(ee2.getEnergyState().strategy).toBe(ElectricityStrategy.Fixed1Y);
  });
});
