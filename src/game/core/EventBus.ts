import type {
  EntityId,
  EventHandler,
  GameDate,
  GameEvent,
  IEventBus,
  Unsubscribe,
} from './types';

interface HandlerEntry {
  moduleId: string;
  handler: EventHandler;
}

export class EventBus implements IEventBus {
  private handlers = new Map<string, HandlerEntry[]>();
  private history = new Map<string, GameEvent[]>();
  private readonly maxHistoryPerType = 100;

  // Guard against re-entrant publish chains
  private publishing = false;
  private deferred: Array<() => void> = [];

  private generateId(): EntityId {
    return crypto.randomUUID();
  }

  publish<T>(event: Omit<GameEvent<T>, 'id' | 'wallTime'>): void {
    const full: GameEvent<T> = {
      ...event,
      id: this.generateId(),
      wallTime: Date.now(),
    };

    this.recordHistory(full);

    if (this.publishing) {
      // Defer to prevent reentrancy — mirrors the spec's queueMicrotask guidance
      this.deferred.push(() => this.dispatch(full));
      return;
    }

    this.publishing = true;
    try {
      this.dispatch(full);
      // Drain deferred queue
      while (this.deferred.length > 0) {
        const fn = this.deferred.shift()!;
        fn();
      }
    } finally {
      this.publishing = false;
    }
  }

  private dispatch(event: GameEvent): void {
    const entries = this.handlers.get(event.type) ?? [];
    for (const entry of entries) {
      entry.handler(event);
    }
  }

  private recordHistory(event: GameEvent): void {
    if (!this.history.has(event.type)) {
      this.history.set(event.type, []);
    }
    const list = this.history.get(event.type)!;
    list.push(event);
    if (list.length > this.maxHistoryPerType) {
      list.shift();
    }
  }

  subscribe<T>(type: string, handler: EventHandler<T>, moduleId = '__anon__'): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    const entry: HandlerEntry = { moduleId, handler: handler as EventHandler };
    this.handlers.get(type)!.push(entry);

    return () => {
      const list = this.handlers.get(type);
      if (!list) return;
      const idx = list.indexOf(entry);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  subscribeMany(types: string[], handler: EventHandler, moduleId = '__anon__'): Unsubscribe {
    const unsubs = types.map(t => this.subscribe(t, handler, moduleId));
    return () => unsubs.forEach(u => u());
  }

  unsubscribeAll(moduleId: string): void {
    for (const [type, list] of this.handlers.entries()) {
      this.handlers.set(type, list.filter(e => e.moduleId !== moduleId));
    }
  }

  getHistory(type: string, limit = 20): GameEvent[] {
    const list = this.history.get(type) ?? [];
    return list.slice(-limit);
  }

  /** Inject a fixed gameDate for the next publish (test helper). */
  publishWithDate<T>(
    type: string,
    payload: T,
    source: string,
    gameDate: GameDate,
  ): void {
    this.publish({ type, payload, source, gameDate });
  }
}
