import type { GameConfig, IEventBus, IGameModule, SaveFile } from './types';
import { EventBus } from './EventBus';

const SAVE_VERSION = '3.0.0';
const SAVE_KEY = 'it-tycoon-v3';

export class GameEngine {
  readonly bus: IEventBus;
  private modules: Map<string, IGameModule> = new Map();
  private config: GameConfig;
  private rafHandle = 0;
  private lastTimestamp = 0;
  private running = false;

  constructor(config: GameConfig) {
    this.config = config;
    this.bus = new EventBus();
  }

  // ── Module registration ───────────────────────────────────────────

  register(module: IGameModule): this {
    if (this.running) throw new Error(`Cannot register module '${module.moduleId}' after engine started`);
    this.modules.set(module.moduleId, module);
    return this;
  }

  getModule<T extends IGameModule>(id: string): T {
    const m = this.modules.get(id);
    if (!m) throw new Error(`Module '${id}' not found`);
    return m as T;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    for (const m of this.modules.values()) {
      m.init(this.bus, this.config);
    }
    this.running = true;
    this.lastTimestamp = performance.now();
    this.scheduleFrame();
  }

  stop(): void {
    if (!this.running) return;
    cancelAnimationFrame(this.rafHandle);
    this.running = false;
    for (const m of this.modules.values()) m.destroy();
  }

  /** Used by tests to advance time without RAF. */
  tickOnce(deltaMs: number): void {
    for (const m of this.modules.values()) m.tick(deltaMs);
  }

  private scheduleFrame(): void {
    this.rafHandle = requestAnimationFrame(this.onFrame);
  }

  private onFrame = (timestamp: number): void => {
    if (!this.running) return;
    const deltaMs = Math.min(timestamp - this.lastTimestamp, 500);
    this.lastTimestamp = timestamp;
    for (const m of this.modules.values()) m.tick(deltaMs);
    this.scheduleFrame();
  };

  // ── Save / load ───────────────────────────────────────────────────

  save(): void {
    const time = this.getModule('TimeEngine');
    const timeState = time.getState() as { currentDate: { year: number; month: number } };
    const file: SaveFile = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      gameDate: timeState.currentDate,
      modules: {},
    };
    for (const [id, m] of this.modules.entries()) {
      file.modules[id] = m.serialize();
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(file));
    } catch {
      // Storage quota exceeded — silent fail
    }
  }

  load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const file = JSON.parse(raw) as SaveFile;
      if (!file.version || !file.modules) return false;
      for (const [id, m] of this.modules.entries()) {
        if (file.modules[id]) {
          m.deserialize(file.modules[id]);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  clearSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
