import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { ExpansionEngine } from './ExpansionEngine';
import { AcquisitionStatus } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';

function build() {
  const bus = new EventBus();
  const ee = new ExpansionEngine();
  ee.init(bus, DEFAULT_CONFIG);
  return { bus, ee };
}

function advanceToYear(bus: EventBus, year: number) {
  for (let m = 0; m < (year - 2000) * 12; m++) {
    const y = 2000 + Math.floor(m / 12);
    const mo = (m % 12) + 2;
    bus.publish({ type: 'time.month_end', payload: { newDate: { year: y, month: mo > 12 ? 1 : mo } }, source: 'test', gameDate: { year: y, month: 1 } });
  }
}

describe('ExpansionEngine — initial state', () => {
  it('1. starts with no second facility', () => {
    const { ee } = build();
    expect(ee.hasSecondFacility()).toBe(false);
  });

  it('2. DR ability bonus is 0 initially', () => {
    const { ee } = build();
    expect(ee.getDRAbilityBonus()).toBe(0);
  });

  it('3. 3 acquisition targets loaded from config', () => {
    const { ee } = build();
    expect(ee.getAcquisitions()).toHaveLength(3);
  });
});

describe('ExpansionEngine — getAvailableTargets', () => {
  it('4. no targets available in year 2000', () => {
    const { ee } = build();
    expect(ee.getAvailableTargets(2000)).toHaveLength(0);
  });

  it('5. first target available from 2008', () => {
    const { ee } = build();
    expect(ee.getAvailableTargets(2008)).toHaveLength(1);
  });

  it('6. two targets available from 2010', () => {
    const { ee } = build();
    expect(ee.getAvailableTargets(2010)).toHaveLength(2);
  });

  it('7. all three targets available from 2015', () => {
    const { ee } = build();
    expect(ee.getAvailableTargets(2015)).toHaveLength(3);
  });
});

describe('ExpansionEngine — acquireTarget', () => {
  it('8. acquireTarget returns error before unlock year', () => {
    const { ee } = build();
    const err = ee.acquireTarget('acq_01');
    expect(err).toBeTruthy();
  });

  it('9. acquireTarget publishes expansion.acquisition_started', () => {
    const { bus, ee } = build();
    // Simulate year 2008
    bus.publish({ type: 'time.month_end', payload: { newDate: { year: 2008, month: 1 } }, source: 'test', gameDate: { year: 2008, month: 1 } });
    const events: unknown[] = [];
    bus.subscribe('expansion.acquisition_started', e => events.push(e));
    ee.acquireTarget('acq_01');
    expect(events).toHaveLength(1);
  });

  it('10. target status becomes Integrating after acquisition', () => {
    const { bus, ee } = build();
    bus.publish({ type: 'time.month_end', payload: { newDate: { year: 2008, month: 1 } }, source: 'test', gameDate: { year: 2008, month: 1 } });
    ee.acquireTarget('acq_01');
    const target = ee.getAcquisitions().find(t => t.id === 'acq_01');
    expect(target?.status).toBe(AcquisitionStatus.Integrating);
  });
});

describe('ExpansionEngine — second facility', () => {
  it('11. openSecondFacility returns error before unlock year', () => {
    const { ee } = build();
    const err = ee.openSecondFacility();
    expect(err).toBeTruthy();
  });

  it('12. serialize/deserialize preserves hasSecondFacility', () => {
    const { bus, ee } = build();
    bus.publish({ type: 'time.month_end', payload: { newDate: { year: 2010, month: 1 } }, source: 'test', gameDate: { year: 2010, month: 1 } });
    ee.openSecondFacility();
    const serialized = ee.serialize();
    const ee2 = new ExpansionEngine();
    ee2.init(new EventBus(), DEFAULT_CONFIG);
    ee2.deserialize(serialized);
    expect(ee2.hasSecondFacility()).toBe(true);
  });
});
