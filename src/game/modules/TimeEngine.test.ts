import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { TimeEngine } from './TimeEngine';
import { DEFAULT_CONFIG } from '../config/default.config';
import type { GameConfig, TimeMonthEndPayload } from '../core/types';

const makeConfig = (overrides: Partial<GameConfig['time']> = {}): GameConfig => ({
  ...DEFAULT_CONFIG,
  time: { ...DEFAULT_CONFIG.time, autoPauseOnMonthEnd: false, ...overrides },
});

function buildEngine(cfg: GameConfig = makeConfig()) {
  const bus = new EventBus();
  const time = new TimeEngine();
  time.init(bus, cfg);
  return { bus, time };
}

describe('TimeEngine', () => {
  it('starts at the configured start date', () => {
    const { time } = buildEngine();
    expect(time.getCurrentDate()).toEqual({ year: 2000, month: 1 });
  });

  it('does not advance time when paused', () => {
    const { time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100 }));
    time.pause('user');
    time.tick(200);
    expect(time.getCurrentDate()).toEqual({ year: 2000, month: 1 });
  });

  it('advances one month when accumulatedMs reaches msPerGameMonth', () => {
    const { time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100 }));
    time.tick(100);
    expect(time.getCurrentDate()).toEqual({ year: 2000, month: 2 });
  });

  it('advances multiple months in one tick with high speed', () => {
    const { time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100 }));
    time.setSpeed(4);
    time.tick(100); // 4 effective months
    expect(time.getCurrentDate()).toEqual({ year: 2000, month: 5 });
  });

  it('publishes time.month_end with correct payload', () => {
    const { bus, time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100 }));
    const handler = vi.fn();
    bus.subscribe<TimeMonthEndPayload>('time.month_end', handler);
    time.tick(100);
    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0][0].payload as TimeMonthEndPayload;
    expect(payload.prevDate).toEqual({ year: 2000, month: 1 });
    expect(payload.newDate).toEqual({ year: 2000, month: 2 });
    expect(payload.totalMonthsElapsed).toBe(1);
  });

  it('publishes time.quarter_end on months 3, 6, 9, 12', () => {
    const { bus, time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 10 }));
    const quarters: number[] = [];
    bus.subscribe('time.quarter_end', (e) => {
      quarters.push((e.payload as { date: { month: number } }).date.month);
    });
    time.setSpeed(8);
    time.tick(10 * 3); // 24 months at 8x
    expect(quarters).toContain(3);
    expect(quarters).toContain(6);
    expect(quarters).toContain(9);
    expect(quarters).toContain(12);
  });

  it('publishes time.year_end when crossing December→January', () => {
    const { bus, time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 10 }));
    const yearsEnded: number[] = [];
    bus.subscribe('time.year_end', (e) => {
      yearsEnded.push((e.payload as { year: number }).year);
    });
    time.setSpeed(8);
    time.tick(10 * 2); // 16 months at 8x → crosses year 2000
    expect(yearsEnded).toContain(2000);
  });

  it('autoPauseOnMonthEnd pauses after advancing', () => {
    const { time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100, autoPauseOnMonthEnd: true }));
    time.tick(100);
    expect(time.isPaused()).toBe(true);
  });

  it('resume restores speed', () => {
    const { time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100, autoPauseOnMonthEnd: true }));
    time.setSpeed(2);
    time.tick(100); // will pause
    time.resume();
    expect(time.isPaused()).toBe(false);
    expect(time.getSpeed()).toBe(2);
  });

  it('setSpeed(0) pauses the engine', () => {
    const { time } = buildEngine();
    time.setSpeed(0);
    expect(time.isPaused()).toBe(true);
  });

  it('speed multiplier correct: 2x processes twice as many months', () => {
    const { time: t1 } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100 }));
    const { time: t2 } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100 }));
    t2.setSpeed(2);
    t1.tick(200); // 2 months at 1x
    t2.tick(100); // 2 months at 2x
    expect(t1.getCurrentDate()).toEqual(t2.getCurrentDate());
  });

  it('serialize/deserialize round-trips state', () => {
    const cfg = makeConfig({ msPerGameMonthAt1x: 100 });
    const { time } = buildEngine(cfg);
    time.tick(150); // 1 month, 50ms accumulated
    const snap = time.serialize();

    const bus2 = new EventBus();
    const time2 = new TimeEngine();
    time2.init(bus2, cfg);
    time2.deserialize(snap);
    expect(time2.getCurrentDate()).toEqual(time.getCurrentDate());
    expect(time2.isPaused()).toBe(time.isPaused());
  });

  it('jumpToDate sets the date directly', () => {
    const { time } = buildEngine();
    time.jumpToDate({ year: 2023, month: 6 });
    expect(time.getCurrentDate()).toEqual({ year: 2023, month: 6 });
  });

  it('game.pause_requested event pauses the engine', () => {
    const { bus, time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100 }));
    bus.publish({
      type: 'game.pause_requested',
      payload: { reason: 'p1_incident' },
      gameDate: { year: 2000, month: 1 },
      source: 'Test',
    });
    expect(time.isPaused()).toBe(true);
  });

  it('game.resume_requested event resumes the engine', () => {
    const { bus, time } = buildEngine(makeConfig({ msPerGameMonthAt1x: 100 }));
    time.pause('user');
    bus.publish({
      type: 'game.resume_requested',
      payload: {},
      gameDate: { year: 2000, month: 1 },
      source: 'Test',
    });
    expect(time.isPaused()).toBe(false);
  });
});
