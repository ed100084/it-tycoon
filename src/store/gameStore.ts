import { create } from 'zustand';
import { HARDWARE_DEFS, MAX_UPGRADE_LEVEL_V02 } from '../game/config/hardware.config';
import { PUE_DEFS, MAX_PUE_LEVEL_V02 } from '../game/config/pue.config';
import { CLICK_BASE_VALUE, INITIAL_STATE } from '../game/config/game.config';
import {
  calcHardwareCost,
  calcBulkCost,
  calcUpgradeCost,
  computeTickMetrics,
  GameTickMetrics,
} from '../game/systems/hardware';
import {
  saveToStorage,
  loadFromStorage,
  migrateSave,
  calcOfflineEarnings,
} from '../game/systems/save';
import type { HardwareState, OfflineEarningsReport } from '../game/models/types';

export interface GameStore {
  // Core resources
  compute: number;
  totalEarnedCompute: number;

  // Hardware
  hardware: Record<string, HardwareState>;

  // Power & Cooling
  pueLevel: number;
  isShutdown: boolean;

  // Soft stats
  satisfaction: number;
  reputation: number;
  influence: number;
  prestigeCount: number;

  // Meta
  lastSaveTime: number;
  gameTime: number;
  unlockedAchievements: string[];
  techNodes: string[];

  // Derived (updated each tick)
  metrics: GameTickMetrics;

  // Offline
  offlineReport: OfflineEarningsReport | null;

  // Actions
  click: () => void;
  buyHardware: (tierId: string, qty: number) => void;
  upgradeHardware: (tierId: string) => void;
  upgradePUE: () => void;
  tick: (dt: number) => void;
  saveGame: () => void;
  loadGame: () => void;
  newGame: () => void;
  dismissOfflineReport: () => void;
}

const emptyMetrics: GameTickMetrics = {
  totalCPS: 0,
  totalPowerCost: 0,
  netCPS: 0,
  perHardware: {},
};

const defaultHardware = (): Record<string, HardwareState> =>
  Object.fromEntries(HARDWARE_DEFS.map((d) => [d.id, { owned: 0, upgradeLevel: 1 }]));

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  ...INITIAL_STATE,
  hardware: defaultHardware(),
  lastSaveTime: Date.now(),
  metrics: emptyMetrics,
  offlineReport: null,

  click: () => {
    const value = CLICK_BASE_VALUE;
    set((s) => ({
      compute: s.compute + value,
      totalEarnedCompute: s.totalEarnedCompute + value,
      isShutdown: s.isShutdown && s.compute + value > 0 ? false : s.isShutdown,
    }));
  },

  buyHardware: (tierId, qty) => {
    const { compute, hardware } = get();
    const hw = hardware[tierId] ?? { owned: 0, upgradeLevel: 1 };
    const cost = qty === 1 ? calcHardwareCost(tierId, hw.owned) : calcBulkCost(tierId, hw.owned, qty);
    if (compute < cost) return;

    set((s) => {
      const prevHw = s.hardware[tierId] ?? { owned: 0, upgradeLevel: 1 };
      const newHardware = {
        ...s.hardware,
        [tierId]: { ...prevHw, owned: prevHw.owned + qty },
      };
      return {
        compute: s.compute - cost,
        hardware: newHardware,
        metrics: computeTickMetrics(newHardware, s.pueLevel),
        // Auto-restart if compute is still positive
        isShutdown: s.isShutdown && s.compute - cost > 0 ? false : s.isShutdown,
      };
    });
  },

  upgradeHardware: (tierId) => {
    const { compute, hardware } = get();
    const hw = hardware[tierId];
    if (!hw || hw.upgradeLevel >= MAX_UPGRADE_LEVEL_V02) return;

    const cost = calcUpgradeCost(tierId, hw.upgradeLevel);
    if (compute < cost) return;

    set((s) => {
      const prevHw = s.hardware[tierId];
      const newHardware = {
        ...s.hardware,
        [tierId]: { ...prevHw, upgradeLevel: prevHw.upgradeLevel + 1 },
      };
      return {
        compute: s.compute - cost,
        hardware: newHardware,
        metrics: computeTickMetrics(newHardware, s.pueLevel),
      };
    });
  },

  upgradePUE: () => {
    const { compute, pueLevel } = get();
    const nextLevel = pueLevel + 1;
    if (nextLevel > MAX_PUE_LEVEL_V02 || nextLevel >= PUE_DEFS.length) return;

    const cost = PUE_DEFS[nextLevel].cost;
    if (compute < cost) return;

    set((s) => {
      const newPueLevel = s.pueLevel + 1;
      return {
        compute: s.compute - cost,
        pueLevel: newPueLevel,
        metrics: computeTickMetrics(s.hardware, newPueLevel),
      };
    });
  },

  tick: (dt: number) => {
    const { hardware, pueLevel } = get();
    const metrics = computeTickMetrics(hardware, pueLevel);
    const gain = metrics.netCPS * dt;

    set((s) => {
      const newCompute = s.compute + gain;

      if (newCompute < 0 && !s.isShutdown) {
        // Shutdown!
        return {
          compute: 0,
          isShutdown: true,
          metrics,
          gameTime: s.gameTime + dt,
        };
      }

      if (s.isShutdown) {
        // During shutdown, clicking is the only way to gain compute
        return { metrics, gameTime: s.gameTime + dt };
      }

      const earned = Math.max(0, metrics.totalCPS * dt);
      return {
        compute: newCompute,
        totalEarnedCompute: s.totalEarnedCompute + earned,
        metrics,
        gameTime: s.gameTime + dt,
      };
    });
  },

  saveGame: () => {
    const s = get();
    saveToStorage({
      version: 1,
      compute: s.compute,
      totalEarnedCompute: s.totalEarnedCompute,
      hardware: s.hardware,
      pueLevel: s.pueLevel,
      isShutdown: s.isShutdown,
      satisfaction: s.satisfaction,
      reputation: s.reputation,
      influence: s.influence,
      prestigeCount: s.prestigeCount,
      lastSaveTime: Date.now(),
      gameTime: s.gameTime,
      unlockedAchievements: s.unlockedAchievements,
      techNodes: s.techNodes,
    });
  },

  loadGame: () => {
    const raw = loadFromStorage();
    if (!raw) return;
    const data = migrateSave(raw);

    const report = calcOfflineEarnings(data.hardware, data.pueLevel, data.lastSaveTime, data.isShutdown);
    const newCompute = data.compute + report.earnings;

    const hardware = {
      ...defaultHardware(),
      ...data.hardware,
    };

    const metrics = computeTickMetrics(hardware, data.pueLevel);

    set({
      compute: newCompute,
      totalEarnedCompute: data.totalEarnedCompute + report.earnings,
      hardware,
      pueLevel: data.pueLevel,
      isShutdown: data.isShutdown,
      satisfaction: data.satisfaction ?? 75,
      reputation: data.reputation ?? 0,
      influence: data.influence ?? 0,
      prestigeCount: data.prestigeCount ?? 0,
      lastSaveTime: data.lastSaveTime,
      gameTime: data.gameTime ?? 0,
      unlockedAchievements: data.unlockedAchievements ?? [],
      techNodes: data.techNodes ?? [],
      metrics,
      offlineReport: report.elapsed > 5 ? report : null,
    });
  },

  newGame: () => {
    const hardware = defaultHardware();
    set({
      ...INITIAL_STATE,
      hardware,
      lastSaveTime: Date.now(),
      metrics: emptyMetrics,
      offlineReport: null,
    });
  },

  dismissOfflineReport: () => set({ offlineReport: null }),
}));
