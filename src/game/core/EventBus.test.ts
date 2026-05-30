import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './EventBus';

const mockDate = { year: 2000, month: 1 };

describe('EventBus', () => {
  it('delivers an event to a subscriber', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe('test.event', handler);
    bus.publish({ type: 'test.event', payload: { x: 1 }, gameDate: mockDate, source: 'Test' });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].payload).toEqual({ x: 1 });
  });

  it('does not deliver to other event types', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe('test.a', handler);
    bus.publish({ type: 'test.b', payload: {}, gameDate: mockDate, source: 'Test' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe stops delivery', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.subscribe('test.event', handler);
    unsub();
    bus.publish({ type: 'test.event', payload: {}, gameDate: mockDate, source: 'Test' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('subscribeMany subscribes to multiple types', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribeMany(['ev.a', 'ev.b'], handler);
    bus.publish({ type: 'ev.a', payload: {}, gameDate: mockDate, source: 'Test' });
    bus.publish({ type: 'ev.b', payload: {}, gameDate: mockDate, source: 'Test' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('unsubscribeAll removes all handlers for a moduleId', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe('ev.x', handler, 'ModuleA');
    bus.unsubscribeAll('ModuleA');
    bus.publish({ type: 'ev.x', payload: {}, gameDate: mockDate, source: 'Test' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('records event history', () => {
    const bus = new EventBus();
    bus.publish({ type: 'h.event', payload: { n: 1 }, gameDate: mockDate, source: 'Test' });
    bus.publish({ type: 'h.event', payload: { n: 2 }, gameDate: mockDate, source: 'Test' });
    const hist = bus.getHistory('h.event');
    expect(hist).toHaveLength(2);
    expect((hist[1].payload as { n: number }).n).toBe(2);
  });

  it('getHistory returns at most `limit` entries', () => {
    const bus = new EventBus();
    for (let i = 0; i < 10; i++) {
      bus.publish({ type: 'many', payload: i, gameDate: mockDate, source: 'Test' });
    }
    expect(bus.getHistory('many', 3)).toHaveLength(3);
  });

  it('defers events published from inside a handler', () => {
    const bus = new EventBus();
    const order: string[] = [];

    bus.subscribe('outer', () => {
      order.push('outer-handler');
      bus.publish({ type: 'inner', payload: {}, gameDate: mockDate, source: 'Test' });
      order.push('after-inner-publish');
    });

    bus.subscribe('inner', () => {
      order.push('inner-handler');
    });

    bus.publish({ type: 'outer', payload: {}, gameDate: mockDate, source: 'Test' });
    // inner-handler must fire after outer handler completes (deferred)
    expect(order).toEqual(['outer-handler', 'after-inner-publish', 'inner-handler']);
  });

  it('delivers events to multiple subscribers in registration order', () => {
    const bus = new EventBus();
    const order: number[] = [];
    bus.subscribe('multi', () => order.push(1));
    bus.subscribe('multi', () => order.push(2));
    bus.publish({ type: 'multi', payload: {}, gameDate: mockDate, source: 'Test' });
    expect(order).toEqual([1, 2]);
  });

  it('event has an id and wallTime', () => {
    const bus = new EventBus();
    let captured: unknown;
    bus.subscribe('ev', (e) => { captured = e; });
    bus.publish({ type: 'ev', payload: {}, gameDate: mockDate, source: 'Test' });
    expect((captured as { id: string }).id).toBeTruthy();
    expect(typeof (captured as { wallTime: number }).wallTime).toBe('number');
  });
});
