export const GAME_VERSION = 3; // save data version (v2 contracts, v3 staff)
export const SAVE_KEY = 'it-tycoon-save-v1';

/** Human-facing release version shown in the UI (header, footer, boot screen). */
export const APP_VERSION = 'v1.3';

export const TICK_INTERVAL_MS = 100; // 10 ticks per second
export const TICK_DELTA = TICK_INTERVAL_MS / 1000; // 0.1 seconds per tick (nominal)
// Largest dt a single tick will advance the simulation by. Caps the catch-up
// jump when the tab was backgrounded and setInterval was throttled; longer gaps
// are handled by the offline-earnings path on reload instead.
export const MAX_TICK_DELTA = 2; // seconds

export const AUTO_SAVE_INTERVAL_MS = 30000; // auto-save every 30 seconds

export const MAX_OFFLINE_HOURS = 24;
export const MAX_OFFLINE_SECONDS = MAX_OFFLINE_HOURS * 3600;

export const CLICK_BASE_VALUE = 1;

export const PRESTIGE1_THRESHOLD = 1e10; // total earned compute needed
export const PRESTIGE2_THRESHOLD = 500;  // total reputation needed

export const INITIAL_STATE = {
  compute: 0,
  totalEarnedCompute: 0,
  pueLevel: 0,
  isShutdown: false,
  satisfaction: 75,
  reputation: 0,
  totalEarnedReputation: 0,
  influence: 0,
  prestigeCount: 0,
  gameTime: 0,
  unlockedAchievements: [] as string[],
  techNodes: [] as string[],
};
