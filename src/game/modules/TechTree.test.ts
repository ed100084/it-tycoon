import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { TechTree } from './TechTree';
import { DEFAULT_CONFIG } from '../config/default.config';
import { TechNodeStatus, TechCategory } from '../core/types';
import type { GameConfig } from '../core/types';

function buildModule(cfg: GameConfig = DEFAULT_CONFIG) {
  const bus = new EventBus();
  const tt = new TechTree();
  tt.init(bus, cfg);
  return { bus, tt };
}

function triggerMonthEnd(bus: EventBus, year = 2000, month = 1) {
  const newMonth = month === 12 ? 1 : month + 1;
  const newYear = month === 12 ? year + 1 : year;
  bus.publish({
    type: 'time.month_end',
    payload: { prevDate: { year, month }, newDate: { year: newYear, month: newMonth }, totalMonthsElapsed: 1 },
    gameDate: { year: newYear, month: newMonth },
    source: 'TimeEngine',
  });
}

/**
 * Advance the bus from (fromYear, fromMonth) by enough month-end events so
 * that TechTree's internal currentDate reaches (targetYear, 1).
 *
 * Tracks the simulated "current month" so each triggerMonthEnd call receives
 * the correct prevDate year/month pair.
 */
function advanceToYear(
  bus: EventBus,
  targetYear: number,
  fromYear = 2000,
  fromMonth = 1,
): void {
  let year = fromYear;
  let month = fromMonth;
  const totalMonths = (targetYear - fromYear) * 12 - (fromMonth - 1);
  for (let i = 0; i < totalMonths; i++) {
    triggerMonthEnd(bus, year, month);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

describe('TechTree — node catalogue', () => {
  it('getNodes() returns 40 or more nodes', () => {
    const { tt } = buildModule();
    expect(tt.getNodes().length).toBeGreaterThanOrEqual(40);
  });

  it('all nodes start with status Locked or Available — none InProgress or Completed', () => {
    const { tt } = buildModule();
    const invalid = tt.getNodes().filter(
      n => n.status === TechNodeStatus.InProgress || n.status === TechNodeStatus.Completed,
    );
    expect(invalid).toHaveLength(0);
  });

  it('VIRTUALIZATION (unlockYear 2001) starts as Locked when game begins at 2000/01', () => {
    const { tt } = buildModule();
    const node = tt.getNode('VIRTUALIZATION');
    expect(node).not.toBeNull();
    expect(node!.status).toBe(TechNodeStatus.Locked);
  });
});

describe('TechTree — availability', () => {
  it('getAvailableNodes() at 2000/01 returns only nodes with unlockYear <= 2000 and no prereqs', () => {
    const { tt } = buildModule();
    const available = tt.getAvailableNodes({ year: 2000, month: 1 });
    for (const node of available) {
      expect(node.unlockYear).toBeLessThanOrEqual(2000);
      expect(node.prerequisites).toHaveLength(0);
    }
    expect(available.length).toBeGreaterThan(0);
  });

  it('startResearch("VIRTUALIZATION") returns false in year 2000 (not yet unlocked)', () => {
    const { tt } = buildModule();
    expect(tt.startResearch('VIRTUALIZATION')).toBe(false);
  });

  it('after advancing to 2001, VIRTUALIZATION becomes Available', () => {
    const { bus, tt } = buildModule();
    advanceToYear(bus, 2001);
    const node = tt.getNode('VIRTUALIZATION');
    expect(node!.status).toBe(TechNodeStatus.Available);
  });
});

describe('TechTree — startResearch', () => {
  it('startResearch("VIRTUALIZATION") in 2001 returns true', () => {
    const { bus, tt } = buildModule();
    advanceToYear(bus, 2001);
    expect(tt.startResearch('VIRTUALIZATION')).toBe(true);
  });

  it('startResearch emits techtree.investment_made event', () => {
    const { bus, tt } = buildModule();
    advanceToYear(bus, 2001);
    const handler = vi.fn();
    bus.subscribe('techtree.investment_made', handler);
    tt.startResearch('VIRTUALIZATION');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].payload).toMatchObject({ nodeId: 'VIRTUALIZATION' });
  });

  it('startResearch emits techtree.research_started event', () => {
    const { bus, tt } = buildModule();
    advanceToYear(bus, 2001);
    const handler = vi.fn();
    bus.subscribe('techtree.research_started', handler);
    tt.startResearch('VIRTUALIZATION');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].payload).toMatchObject({ nodeId: 'VIRTUALIZATION' });
  });
});

describe('TechTree — research completion', () => {
  /**
   * Helper: advance to 2001, start VIRTUALIZATION, then tick 2 month-end events
   * to drive progressMonths from 0 to 2 (implementationMonths = 2).
   */
  function setupCompleted() {
    const { bus, tt } = buildModule();
    advanceToYear(bus, 2001);       // 12 month-end events → currentDate = 2001/01
    tt.startResearch('VIRTUALIZATION');
    // Trigger 2 more month-end events so progressMonths reaches implementationMonths (2)
    triggerMonthEnd(bus, 2001, 1);  // progressMonths → 1
    triggerMonthEnd(bus, 2001, 2);  // progressMonths → 2, completes
    return { bus, tt };
  }

  it('VIRTUALIZATION transitions to Completed after 2 month-end ticks post-startResearch', () => {
    const { tt } = setupCompleted();
    expect(tt.getNode('VIRTUALIZATION')!.status).toBe(TechNodeStatus.Completed);
  });

  it('techtree.research_completed event is published when node completes', () => {
    const { bus, tt } = buildModule();
    advanceToYear(bus, 2001);
    tt.startResearch('VIRTUALIZATION');
    const handler = vi.fn();
    bus.subscribe('techtree.research_completed', handler);
    triggerMonthEnd(bus, 2001, 1);
    triggerMonthEnd(bus, 2001, 2);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].payload).toMatchObject({ nodeId: 'VIRTUALIZATION' });
  });

  it('isNodeCompleted returns true after node finishes', () => {
    const { tt } = setupCompleted();
    expect(tt.isNodeCompleted('VIRTUALIZATION')).toBe(true);
  });

  it('getCompletedNodes() includes the completed node', () => {
    const { tt } = setupCompleted();
    const ids = tt.getCompletedNodes().map(n => n.id);
    expect(ids).toContain('VIRTUALIZATION');
  });

  it('getCompletedNodeCount() increments correctly with each completion', () => {
    const { tt: tt0 } = buildModule();
    expect(tt0.getCompletedNodeCount()).toBe(0);

    const { tt } = setupCompleted();
    expect(tt.getCompletedNodeCount()).toBe(1);
  });
});

describe('TechTree — cancelResearch', () => {
  it('cancelResearch resets an in-progress node back to Available and emits refund event', () => {
    const { bus, tt } = buildModule();
    advanceToYear(bus, 2001);
    tt.startResearch('VIRTUALIZATION');
    expect(tt.getNode('VIRTUALIZATION')!.status).toBe(TechNodeStatus.InProgress);

    const refundHandler = vi.fn();
    bus.subscribe('techtree.research_cancelled', refundHandler);

    const result = tt.cancelResearch('VIRTUALIZATION');
    expect(result).toBe(true);
    expect(tt.getNode('VIRTUALIZATION')!.status).toBe(TechNodeStatus.Available);
    expect(refundHandler).toHaveBeenCalledOnce();
    // Refund should be 50% of 300,000 = 150,000
    expect(refundHandler.mock.calls[0][0].payload.refund).toBe(150_000);
  });
});

describe('TechTree — mutual exclusion', () => {
  it('completing ZERO_TRUST locks CONVENIENCE_FIRST permanently', () => {
    // ZERO_TRUST requires SOC_CENTER and BACKUP_ARCH; it unlocks at 2017.
    // For this test we directly check the mutual-exclusion side-effect using
    // the lower-level path: advance far enough, complete the prerequisites,
    // then complete ZERO_TRUST and verify CONVENIENCE_FIRST is Locked.
    const { bus, tt } = buildModule();

    // CONVENIENCE_FIRST is available from 2001 (no prereqs); check it's available at 2001
    advanceToYear(bus, 2001);
    const cfNode = tt.getNode('CONVENIENCE_FIRST');
    expect(cfNode!.status).toBe(TechNodeStatus.Available);

    // Advance to year 2010 to unlock SEC_AWARENESS (2001) → SOC_CENTER (2010) path
    advanceToYear(bus, 2010, 2001);
    tt.startResearch('SEC_AWARENESS');          // 1 month
    triggerMonthEnd(bus, 2010, 1);             // completes SEC_AWARENESS

    // Now SOC_CENTER is available (unlockYear 2010, prereq SEC_AWARENESS met)
    tt.startResearch('SOC_CENTER');            // 4 months
    triggerMonthEnd(bus, 2010, 2);
    triggerMonthEnd(bus, 2010, 3);
    triggerMonthEnd(bus, 2010, 4);
    triggerMonthEnd(bus, 2010, 5);             // SOC_CENTER completes

    // BACKUP_ARCH is available from 2004 with no prereqs; complete it
    tt.startResearch('BACKUP_ARCH');           // 2 months
    triggerMonthEnd(bus, 2010, 6);
    triggerMonthEnd(bus, 2010, 7);             // BACKUP_ARCH completes

    // Advance to 2017 to unlock ZERO_TRUST
    advanceToYear(bus, 2017, 2010);
    tt.startResearch('ZERO_TRUST');            // 6 months
    triggerMonthEnd(bus, 2017, 1);
    triggerMonthEnd(bus, 2017, 2);
    triggerMonthEnd(bus, 2017, 3);
    triggerMonthEnd(bus, 2017, 4);
    triggerMonthEnd(bus, 2017, 5);
    triggerMonthEnd(bus, 2017, 6);             // ZERO_TRUST completes

    expect(tt.isNodeCompleted('ZERO_TRUST')).toBe(true);
    expect(tt.getNode('CONVENIENCE_FIRST')!.status).toBe(TechNodeStatus.Locked);
  });
});

describe('TechTree — active effects', () => {
  it('getActiveEffects() returns effects only for completed nodes', () => {
    const { bus, tt } = buildModule();
    // Before any completions, no active effects
    expect(tt.getActiveEffects()).toHaveLength(0);

    // Complete VIRTUALIZATION
    advanceToYear(bus, 2001);
    tt.startResearch('VIRTUALIZATION');
    triggerMonthEnd(bus, 2001, 1);
    triggerMonthEnd(bus, 2001, 2);

    const effects = tt.getActiveEffects();
    expect(effects.length).toBeGreaterThan(0);
    expect(effects[0].nodeId).toBe('VIRTUALIZATION');
  });
});

describe('TechTree — prerequisite enforcement', () => {
  it('STORAGE_VIRT cannot be started before VIRTUALIZATION is completed', () => {
    const { bus, tt } = buildModule();
    // Advance to 2005 (STORAGE_VIRT unlockYear) but do NOT complete VIRTUALIZATION
    advanceToYear(bus, 2005);
    // Node should still be Locked due to missing prereq
    const storNode = tt.getNode('STORAGE_VIRT');
    expect(storNode!.status).toBe(TechNodeStatus.Locked);
    expect(tt.startResearch('STORAGE_VIRT')).toBe(false);
  });
});

describe('TechTree — getInProgressNodes', () => {
  it('getInProgressNodes() returns only nodes currently in progress', () => {
    const { bus, tt } = buildModule();
    expect(tt.getInProgressNodes()).toHaveLength(0);

    advanceToYear(bus, 2001);
    tt.startResearch('VIRTUALIZATION');
    expect(tt.getInProgressNodes()).toHaveLength(1);
    expect(tt.getInProgressNodes()[0].id).toBe('VIRTUALIZATION');

    // After completion, in-progress list is empty again
    triggerMonthEnd(bus, 2001, 1);
    triggerMonthEnd(bus, 2001, 2);
    expect(tt.getInProgressNodes()).toHaveLength(0);
  });
});

describe('TechTree — serialize / deserialize', () => {
  it('serialize/deserialize preserves completed nodes and progress', () => {
    const { bus, tt } = buildModule();
    advanceToYear(bus, 2001);
    tt.startResearch('VIRTUALIZATION');
    triggerMonthEnd(bus, 2001, 1);
    triggerMonthEnd(bus, 2001, 2);
    expect(tt.isNodeCompleted('VIRTUALIZATION')).toBe(true);

    const snapshot = tt.serialize();

    // Build a fresh TechTree and restore state
    const bus2 = new EventBus();
    const tt2 = new TechTree();
    tt2.init(bus2, DEFAULT_CONFIG);
    tt2.deserialize(snapshot);

    expect(tt2.isNodeCompleted('VIRTUALIZATION')).toBe(true);
    expect(tt2.getCompletedNodeCount()).toBe(1);
    expect(tt2.getNode('VIRTUALIZATION')!.status).toBe(TechNodeStatus.Completed);
  });
});
