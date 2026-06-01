import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../core/EventBus';
import { CapacityPlanningEngine } from './CapacityPlanningEngine';
import { CapacityAlert } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function build() {
  const bus = new EventBus();
  const engine = new CapacityPlanningEngine();
  engine.init(bus, DEFAULT_CONFIG);
  return { bus, engine };
}

function monthEnd(bus: EventBus, year: number, month: number) {
  bus.publish({
    type: 'time.month_end',
    payload: { newDate: { year, month }, prevDate: { year, month: month - 1 || 12 }, totalMonthsElapsed: 1 },
    source: 'test',
    gameDate: { year, month },
  });
}

/** Push facility snapshot so rack utilization can be tested. */
function facilityUpdate(bus: EventBus, usedUnits: number, totalUnits: number, year = 2000, month = 1) {
  bus.publish({
    type: 'facility.updated',
    payload: { usedUnits, totalUnits },
    source: 'test',
    gameDate: { year, month },
  });
}

/** Push network snapshot. */
function networkUpdate(bus: EventBus, usedBandwidthMbps: number, totalBandwidthMbps: number, year = 2000, month = 1) {
  bus.publish({
    type: 'network.updated',
    payload: { usedBandwidthMbps, totalBandwidthMbps },
    source: 'test',
    gameDate: { year, month },
  });
}

/** Push staff coverage. */
function staffUpdate(bus: EventBus, coverageRatio: number, year = 2000, month = 1) {
  bus.publish({
    type: 'staff.updated',
    payload: { coverageRatio },
    source: 'test',
    gameDate: { year, month },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CapacityPlanningEngine', () => {

  it('1. starts with no alerts (all GREEN)', () => {
    const { engine } = build();
    const state = engine.getPlanningState();
    // No month_end has fired; all metric alerts should default to Green
    expect(state.metrics.rackUtilization.alert).toBe(CapacityAlert.Green);
    expect(state.metrics.bandwidthUtilization.alert).toBe(CapacityAlert.Green);
    expect(state.metrics.powerUtilization.alert).toBe(CapacityAlert.Green);
    expect(state.metrics.staffCoverage.alert).toBe(CapacityAlert.Green);
    // alerts array is empty before first report
    expect(state.alerts).toHaveLength(0);
  });

  it('2. starts with empty monthlyHistory', () => {
    const { engine } = build();
    expect(engine.getPlanningState().monthlyHistory).toHaveLength(0);
  });

  it('3. after one monthEnd, history has one entry', () => {
    const { bus, engine } = build();
    monthEnd(bus, 2000, 1);
    expect(engine.getPlanningState().monthlyHistory).toHaveLength(1);
  });

  it('4. _computeAlert returns Green below warning threshold (0.70)', () => {
    const { bus, engine } = build();
    // 60 / 100 = 0.60 → Green
    facilityUpdate(bus, 60, 100);
    monthEnd(bus, 2000, 1);
    expect(engine.getPlanningState().metrics.rackUtilization.alert).toBe(CapacityAlert.Green);
  });

  it('5. _computeAlert returns Yellow between warning (0.70) and critical (0.85)', () => {
    const { bus, engine } = build();
    // 75 / 100 = 0.75 → Yellow
    facilityUpdate(bus, 75, 100);
    monthEnd(bus, 2000, 1);
    expect(engine.getPlanningState().metrics.rackUtilization.alert).toBe(CapacityAlert.Yellow);
  });

  it('6. _computeAlert returns Red at or above critical threshold (0.85)', () => {
    const { bus, engine } = build();
    // 90 / 100 = 0.90 → Red
    facilityUpdate(bus, 90, 100);
    monthEnd(bus, 2000, 1);
    expect(engine.getPlanningState().metrics.rackUtilization.alert).toBe(CapacityAlert.Red);
  });

  it('7. recommendations are generated for RED metrics', () => {
    const { bus, engine } = build();
    // rack at 90% → Red
    facilityUpdate(bus, 90, 100);
    monthEnd(bus, 2000, 1);
    const recs = engine.getRecommendations();
    const rackRec = recs.find(r => r.type === 'rack');
    expect(rackRec).toBeDefined();
    expect(rackRec!.urgency).toBe(CapacityAlert.Red);
    expect(rackRec!.estimatedCostNTD).toBeGreaterThan(0);
  });

  it('8. recommendations empty when all metrics are Green', () => {
    const { bus, engine } = build();
    // All at 10% utilization → all Green
    facilityUpdate(bus, 10, 100);
    networkUpdate(bus, 10, 100);
    staffUpdate(bus, 1.0);   // full coverage → staffUtil = 0 → Green
    monthEnd(bus, 2000, 1);
    expect(engine.getRecommendations()).toHaveLength(0);
  });

  it('9. forecast increases when trend is consistently rising', () => {
    const { bus, engine } = build();
    // Fire 6 month-ends with steadily rising rack utilization
    const steps = [10, 20, 30, 40, 50, 60];
    steps.forEach((used, idx) => {
      facilityUpdate(bus, used, 100);
      monthEnd(bus, 2000, idx + 1);
    });
    const state = engine.getPlanningState();
    const forecast = state.metrics.rackUtilization.forecastedUtilization6M;
    const current  = state.metrics.rackUtilization.utilizationRate;
    // With avg delta ~0.10/month and forecastMonths=6, forecast should exceed current
    expect(forecast).toBeGreaterThan(current);
  });

  it('10. forecast always returns a value between 0 and 1', () => {
    const { bus, engine } = build();
    // Push utilization very high to stress the clamp
    facilityUpdate(bus, 100, 100);
    networkUpdate(bus, 100, 100);
    for (let m = 1; m <= 6; m++) {
      monthEnd(bus, 2000, m);
    }
    const state = engine.getPlanningState();
    const { rackUtilization, bandwidthUtilization } = state.metrics;
    expect(rackUtilization.forecastedUtilization6M).toBeGreaterThanOrEqual(0);
    expect(rackUtilization.forecastedUtilization6M).toBeLessThanOrEqual(1);
    expect(bandwidthUtilization.forecastedUtilization6M).toBeGreaterThanOrEqual(0);
    expect(bandwidthUtilization.forecastedUtilization6M).toBeLessThanOrEqual(1);
  });

  it('11. alerts array reflects the severity of each metric after monthEnd', () => {
    const { bus, engine } = build();
    // rack = Red (90%), bw = Yellow (75%), power = Green (0%), staff = Green (full)
    facilityUpdate(bus, 90, 100);
    networkUpdate(bus, 75, 100);
    staffUpdate(bus, 1.0);
    monthEnd(bus, 2000, 1);
    const { alerts, metrics } = engine.getPlanningState();
    expect(alerts).toHaveLength(4);
    expect(alerts).toContain(CapacityAlert.Red);
    expect(alerts).toContain(CapacityAlert.Yellow);
    expect(alerts).toContain(CapacityAlert.Green);
    // Spot-check the metric-level alerts match the aggregate array entries
    expect(metrics.rackUtilization.alert).toBe(CapacityAlert.Red);
    expect(metrics.bandwidthUtilization.alert).toBe(CapacityAlert.Yellow);
  });

  it('12. serialize/deserialize preserves monthlyHistory and lastReportDate', () => {
    const { bus, engine } = build();
    facilityUpdate(bus, 50, 100);
    monthEnd(bus, 2001, 3);
    monthEnd(bus, 2001, 4);

    const serialized = engine.serialize();

    const bus2 = new EventBus();
    const engine2 = new CapacityPlanningEngine();
    engine2.init(bus2, DEFAULT_CONFIG);
    engine2.deserialize(serialized);

    const state2 = engine2.getPlanningState();
    expect(state2.monthlyHistory).toHaveLength(2);
    expect(state2.lastReportDate).toEqual({ year: 2001, month: 4 });
    // History entries should have correct dates
    expect(state2.monthlyHistory[0].date).toEqual({ year: 2001, month: 3 });
    expect(state2.monthlyHistory[1].date).toEqual({ year: 2001, month: 4 });
  });

});
