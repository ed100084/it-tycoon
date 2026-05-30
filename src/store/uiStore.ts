/**
 * Thin Zustand layer that mirrors the GameEngine state for React components.
 * Components never touch the GameEngine or EventBus directly — they read from
 * this store and call actions here (which delegate to the engine).
 */
import { create } from 'zustand';
import type { GameDate, GameSpeed, Money, PLStatement, CreditRating, PauseReason, Loan } from '../game/core/types';
import type { GameEngine } from '../game/core/GameEngine';
import type { TimeEngine } from '../game/modules/TimeEngine';
import type { FinanceEngine } from '../game/modules/FinanceEngine';

export interface UIState {
  // Time
  currentDate: GameDate;
  speed: GameSpeed;
  isPaused: boolean;
  pauseReason: PauseReason | null;

  // Finance
  cash: Money;
  creditRating: CreditRating | null;
  lastPL: PLStatement | null;
  activeLoans: Loan[];

  // Engine ref (not reactive, just for actions)
  _engine: GameEngine | null;

  // Actions
  setSpeed: (speed: GameSpeed) => void;
  resume: () => void;
  applyForLoan: (amount: Money, termMonths: number) => string | null;
  saveGame: () => void;
  _connectEngine: (engine: GameEngine) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  currentDate: { year: 2000, month: 1 },
  speed: 1,
  isPaused: false,
  pauseReason: null,
  cash: 0,
  creditRating: null,
  lastPL: null,
  activeLoans: [],
  _engine: null,

  setSpeed(speed) {
    const engine = get()._engine;
    if (!engine) return;
    const time = engine.getModule<TimeEngine>('TimeEngine');
    time.setSpeed(speed);
  },

  resume() {
    const engine = get()._engine;
    if (!engine) return;
    const time = engine.getModule<TimeEngine>('TimeEngine');
    time.resume();
  },

  applyForLoan(amount, termMonths) {
    const engine = get()._engine;
    if (!engine) return null;
    const finance = engine.getModule<FinanceEngine>('FinanceEngine');
    return finance.applyForLoan(amount, termMonths);
  },

  saveGame() {
    get()._engine?.save();
  },

  _connectEngine(engine) {
    const time = engine.getModule<TimeEngine>('TimeEngine');
    const finance = engine.getModule<FinanceEngine>('FinanceEngine');

    // Sync initial state
    set({
      _engine: engine,
      currentDate: time.getCurrentDate(),
      speed: time.getSpeed(),
      isPaused: time.isPaused(),
      pauseReason: null,
      cash: finance.getCash(),
      creditRating: finance.getCreditRating(),
      lastPL: finance.getLastMonthPL(),
      activeLoans: finance.getActiveLoans(),
    });

    // Subscribe to events to keep store in sync
    const bus = engine.bus;

    bus.subscribe('time.month_end', () => {
      set({
        currentDate: time.getCurrentDate(),
        cash: finance.getCash(),
        lastPL: finance.getLastMonthPL(),
        activeLoans: finance.getActiveLoans(),
        creditRating: finance.getCreditRating(),
      });
    });

    bus.subscribe('time.paused', (e) => {
      const p = e.payload as { reason: PauseReason; speed: GameSpeed };
      set({ isPaused: true, pauseReason: p.reason, speed: 0 });
    });

    bus.subscribe('time.resumed', (e) => {
      const p = e.payload as { speed: GameSpeed };
      set({ isPaused: false, pauseReason: null, speed: p.speed });
    });

    bus.subscribe('time.speed_changed', (e) => {
      const p = e.payload as { from: GameSpeed; to: GameSpeed };
      set({ speed: p.to, isPaused: p.to === 0 });
    });

    bus.subscribe('finance.monthly_settlement', () => {
      set({
        cash: finance.getCash(),
        lastPL: finance.getLastMonthPL(),
        creditRating: finance.getCreditRating(),
        activeLoans: finance.getActiveLoans(),
      });
    });

    bus.subscribe('finance.loan_approved', () => {
      set({ cash: finance.getCash(), activeLoans: finance.getActiveLoans() });
    });
  },
}));
