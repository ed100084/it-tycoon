import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { ChangeManagementEngine } from './ChangeManagementEngine';
import { ChangeType, ChangeStatus } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';

function build() {
  const bus = new EventBus();
  const cm = new ChangeManagementEngine();
  cm.init(bus, DEFAULT_CONFIG);
  return { bus, cm };
}

function monthEnd(bus: EventBus, year = 2000, month = 2) {
  bus.publish({
    type: 'time.month_end',
    payload: { newDate: { year, month } },
    source: 'test',
    gameDate: { year, month },
  });
}

describe('ChangeManagementEngine', () => {
  it('1. maturityLevel starts at 0', () => {
    const { cm } = build();
    expect(cm.getState_CM().maturityLevel).toBe(0);
  });

  it('2. submitChange returns a change ID string', () => {
    const { cm } = build();
    const id = cm.submitChange(ChangeType.Standard, 'Patch OS');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('3. Standard change is immediately Completed', () => {
    const { cm } = build();
    const id = cm.submitChange(ChangeType.Standard, 'Deploy patch');
    const log = cm.getState_CM().changeLog;
    const entry = log.find(c => c.id === id);
    expect(entry).toBeDefined();
    expect(entry!.status).toBe(ChangeStatus.Completed);
  });

  it('4. Emergency change has status Completed or Failed after submit', () => {
    const { cm } = build();
    const id = cm.submitChange(ChangeType.Emergency, 'Emergency hotfix');
    const log = cm.getState_CM().changeLog;
    const entry = log.find(c => c.id === id);
    expect(entry).toBeDefined();
    expect([ChangeStatus.Completed, ChangeStatus.Failed]).toContain(entry!.status);
  });

  it('5. Normal change is initially Pending', () => {
    const { cm } = build();
    const id = cm.submitChange(ChangeType.Normal, 'Scheduled upgrade');
    const pending = cm.getState_CM().pendingChanges;
    const entry = pending.find(c => c.id === id);
    expect(entry).toBeDefined();
    expect(entry!.status).toBe(ChangeStatus.Pending);
  });

  it('6. Normal change executes after monthEnd', () => {
    const { bus, cm } = build();
    const id = cm.submitChange(ChangeType.Normal, 'Scheduled upgrade');

    // The change is scheduled for month 2 (addMonths from month 1 + 1)
    monthEnd(bus, 2000, 2);

    // Should no longer be in pending
    const pending = cm.getState_CM().pendingChanges;
    expect(pending.find(c => c.id === id)).toBeUndefined();

    // Should now be in the log
    const log = cm.getState_CM().changeLog;
    const entry = log.find(c => c.id === id);
    expect(entry).toBeDefined();
    expect([ChangeStatus.Completed, ChangeStatus.Failed]).toContain(entry!.status);
  });

  it('7. shadowChangeCount increments on recordShadowChange', () => {
    const { cm } = build();
    cm.recordShadowChange('Manual change without approval');
    expect(cm.getState_CM().shadowChangeCount).toBe(1);
    cm.recordShadowChange('Another shadow change');
    expect(cm.getState_CM().shadowChangeCount).toBe(2);
  });

  it('8. shadow change publishes change.shadow_failed with ~30% probability', () => {
    // Run many iterations to confirm the event fires with roughly 30% frequency
    const ITERATIONS = 1000;
    let failCount = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const bus = new EventBus();
      const cm = new ChangeManagementEngine();
      cm.init(bus, DEFAULT_CONFIG);
      bus.subscribe('change.shadow_failed', () => { failCount++; });
      cm.recordShadowChange('Shadow op');
    }

    // Expect roughly 30% — allow wide margin (15%–45%) given seeded RNG
    const rate = failCount / ITERATIONS;
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.45);
  });

  it('9. cabEnabled starts false, enableCAB sets it true', () => {
    const { cm } = build();
    expect(cm.getState_CM().cabEnabled).toBe(false);
    cm.enableCAB();
    expect(cm.getState_CM().cabEnabled).toBe(true);
  });

  it('10. CAB charges finance.expense_requested on month_end when enabled', () => {
    const { bus, cm } = build();
    cm.enableCAB();

    const expenses: unknown[] = [];
    bus.subscribe('finance.expense_requested', e => expenses.push(e));
    monthEnd(bus, 2000, 2);

    expect(expenses.length).toBeGreaterThan(0);
  });

  it('11. totalChanges increases per completed change', () => {
    const { cm } = build();
    const before = cm.getState_CM().totalChanges;
    cm.submitChange(ChangeType.Standard, 'Change A');
    cm.submitChange(ChangeType.Standard, 'Change B');
    const after = cm.getState_CM().totalChanges;
    // Both standard changes execute immediately; totalChanges should have gone up by 2
    expect(after).toBe(before + 2);
  });

  it('12. serialize/deserialize preserves maturityLevel and shadowChangeCount', () => {
    const { cm } = build();

    // Submit enough standard changes to trigger maturity level 1 (threshold = 5)
    for (let i = 0; i < 5; i++) {
      cm.submitChange(ChangeType.Standard, `Change ${i}`);
    }
    cm.recordShadowChange('Shadow op 1');
    cm.recordShadowChange('Shadow op 2');

    const saved = cm.serialize();
    const bus2 = new EventBus();
    const cm2 = new ChangeManagementEngine();
    cm2.init(bus2, DEFAULT_CONFIG);
    cm2.deserialize(saved);

    expect(cm2.getState_CM().maturityLevel).toBe(cm.getState_CM().maturityLevel);
    expect(cm2.getState_CM().shadowChangeCount).toBe(cm.getState_CM().shadowChangeCount);
  });
});
