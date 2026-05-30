import { addMonths, getQuarter, isQuarterEnd } from '../../utils/gameDate';
import type {
  GameConfig,
  GameDate,
  GameSpeed,
  IEventBus,
  IGameModule,
  PauseReason,
  TimePausedPayload,
  TimeQuarterEndPayload,
  TimeResumedPayload,
  TimeSpeedChangedPayload,
} from '../core/types';

interface TimeEngineState {
  currentDate: GameDate;
  speed: GameSpeed;
  isPaused: boolean;
  pauseReason: PauseReason | null;
  speedBeforePause: GameSpeed;
  accumulatedMs: number;
  skipMonthSummary: boolean;
  totalMonthsElapsed: number;
}

export class TimeEngine implements IGameModule {
  readonly moduleId = 'TimeEngine';

  private bus!: IEventBus;
  private cfg!: GameConfig['time'];

  private state: TimeEngineState = {
    currentDate: { year: 2000, month: 1 },
    speed: 1,
    isPaused: false,
    pauseReason: null,
    speedBeforePause: 1,
    accumulatedMs: 0,
    skipMonthSummary: false,
    totalMonthsElapsed: 0,
  };

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.time;
    this.state.currentDate = { ...config.time.startDate };

    bus.subscribe('game.pause_requested', (e) => {
      const payload = e.payload as { reason: PauseReason };
      this.pause(payload.reason);
    }, this.moduleId);

    bus.subscribe('game.resume_requested', () => {
      this.resume();
    }, this.moduleId);

    bus.subscribe('game.speed_changed', (e) => {
      const payload = e.payload as { speed: GameSpeed };
      this.setSpeed(payload.speed);
    }, this.moduleId);
  }

  tick(deltaMs: number): void {
    if (this.state.isPaused || this.state.speed === 0) return;

    const msPerMonth = this.cfg.msPerGameMonthAt1x;
    this.state.accumulatedMs += deltaMs * this.state.speed;

    while (this.state.accumulatedMs >= msPerMonth) {
      this.state.accumulatedMs -= msPerMonth;
      this.advanceOneMonth();
      // Pause after advancing so further months aren't processed this tick
      if (this.state.isPaused) break;
    }
  }

  private advanceOneMonth(): void {
    const prevDate = this.state.currentDate;
    const newDate = addMonths(prevDate, 1);
    this.state.currentDate = newDate;
    this.state.totalMonthsElapsed++;

    this.bus.publish({
      type: 'time.month_end',
      payload: {
        prevDate,
        newDate,
        totalMonthsElapsed: this.state.totalMonthsElapsed,
      },
      gameDate: newDate,
      source: this.moduleId,
    });

    if (isQuarterEnd(newDate)) {
      const payload: TimeQuarterEndPayload = { date: newDate, quarter: getQuarter(newDate) };
      this.bus.publish({ type: 'time.quarter_end', payload, gameDate: newDate, source: this.moduleId });
    }

    if (newDate.month === 1) {
      this.bus.publish({
        type: 'time.year_end',
        payload: { year: prevDate.year },
        gameDate: newDate,
        source: this.moduleId,
      });
    }

    if (!this.state.skipMonthSummary && this.cfg.autoPauseOnMonthEnd) {
      this.pause('month_end');
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  getCurrentDate(): GameDate {
    return this.state.currentDate;
  }

  getSpeed(): GameSpeed {
    return this.state.speed;
  }

  setSpeed(speed: GameSpeed): void {
    if (speed === this.state.speed) return;
    const from = this.state.speed;
    this.state.speed = speed;
    if (speed === 0) {
      this.state.isPaused = true;
    } else {
      this.state.isPaused = false;
      this.state.pauseReason = null;
    }
    const payload: TimeSpeedChangedPayload = { from, to: speed };
    this.bus.publish({ type: 'time.speed_changed', payload, gameDate: this.state.currentDate, source: this.moduleId });
  }

  pause(reason: PauseReason): void {
    if (this.state.isPaused) return;
    this.state.speedBeforePause = this.state.speed;
    this.state.isPaused = true;
    this.state.pauseReason = reason;
    const payload: TimePausedPayload = { reason, speed: this.state.speedBeforePause };
    this.bus.publish({ type: 'time.paused', payload, gameDate: this.state.currentDate, source: this.moduleId });
  }

  resume(): void {
    if (!this.state.isPaused) return;
    this.state.isPaused = false;
    this.state.pauseReason = null;
    const speed = this.state.speedBeforePause || 1;
    this.state.speed = speed;
    const payload: TimeResumedPayload = { speed };
    this.bus.publish({ type: 'time.resumed', payload, gameDate: this.state.currentDate, source: this.moduleId });
  }

  isPaused(): boolean {
    return this.state.isPaused;
  }

  setSkipMonthSummary(skip: boolean): void {
    this.state.skipMonthSummary = skip;
  }

  jumpToDate(date: GameDate): void {
    this.state.currentDate = { ...date };
  }

  // ── IGameModule ───────────────────────────────────────────────────

  serialize(): Record<string, unknown> {
    return { ...this.state };
  }

  deserialize(raw: Record<string, unknown>): void {
    const s = raw as unknown as TimeEngineState;
    this.state = {
      currentDate: s.currentDate,
      speed: s.speed,
      isPaused: s.isPaused,
      pauseReason: s.pauseReason,
      speedBeforePause: s.speedBeforePause,
      accumulatedMs: s.accumulatedMs,
      skipMonthSummary: s.skipMonthSummary,
      totalMonthsElapsed: s.totalMonthsElapsed,
    };
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this.state });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }
}
