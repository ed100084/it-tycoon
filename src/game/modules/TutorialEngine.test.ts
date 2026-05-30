import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../core/EventBus';
import { TutorialEngine, TUTORIAL_STEPS } from './TutorialEngine';
import { DEFAULT_CONFIG } from '../config/default.config';

function buildModule() {
  const bus = new EventBus();
  const tutorial = new TutorialEngine();
  tutorial.init(bus, DEFAULT_CONFIG);
  return { bus, tutorial };
}

// ─── Initialisation ───────────────────────────────────────────────────────────

describe('TutorialEngine — initialisation', () => {
  it('starts with no active step (not yet started)', () => {
    const { tutorial } = buildModule();
    expect(tutorial.getCurrentStep()).toBeNull();
  });

  it('is not completed on init', () => {
    const { tutorial } = buildModule();
    expect(tutorial.isCompleted()).toBe(false);
  });

  it('has not started on init', () => {
    const { tutorial } = buildModule();
    expect(tutorial.hasStarted()).toBe(false);
  });
});

// ─── start() ─────────────────────────────────────────────────────────────────

describe('TutorialEngine — start()', () => {
  it('returns step 0 after start()', () => {
    const { tutorial } = buildModule();
    tutorial.start();
    const step = tutorial.getCurrentStep();
    expect(step).not.toBeNull();
    expect(step!.index).toBe(0);
    expect(step!.id).toBe('welcome');
  });

  it('publishes tutorial.step_triggered with the first step', () => {
    const { bus, tutorial } = buildModule();
    const handler = vi.fn();
    bus.subscribe('tutorial.step_triggered', handler);
    tutorial.start();
    expect(handler).toHaveBeenCalledTimes(1);
    const payload = (handler.mock.calls[0][0] as { payload: { step: { id: string } } }).payload;
    expect(payload.step.id).toBe('welcome');
  });

  it('calling start() twice does not restart the tutorial', () => {
    const { bus, tutorial } = buildModule();
    const handler = vi.fn();
    bus.subscribe('tutorial.step_triggered', handler);
    tutorial.start();
    tutorial.start();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ─── nextStep() ───────────────────────────────────────────────────────────────

describe('TutorialEngine — nextStep()', () => {
  it('advances through all steps in order', () => {
    const { tutorial } = buildModule();
    tutorial.start();
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      const step = tutorial.getCurrentStep();
      expect(step!.index).toBe(i);
      if (i < TUTORIAL_STEPS.length - 1) tutorial.nextStep();
    }
  });

  it('completes after advancing past the last step', () => {
    const { tutorial } = buildModule();
    tutorial.start();
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) tutorial.nextStep();
    expect(tutorial.isCompleted()).toBe(true);
    expect(tutorial.getCurrentStep()).toBeNull();
  });

  it('publishes tutorial.completed when all steps are done', () => {
    const { bus, tutorial } = buildModule();
    const handler = vi.fn();
    bus.subscribe('tutorial.completed', handler);
    tutorial.start();
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) tutorial.nextStep();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('nextStep() is a no-op when already completed', () => {
    const { tutorial } = buildModule();
    tutorial.start();
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) tutorial.nextStep();
    expect(() => tutorial.nextStep()).not.toThrow();
    expect(tutorial.isCompleted()).toBe(true);
  });
});

// ─── skip() ───────────────────────────────────────────────────────────────────

describe('TutorialEngine — skip()', () => {
  it('marks tutorial as completed immediately', () => {
    const { tutorial } = buildModule();
    tutorial.start();
    tutorial.skip();
    expect(tutorial.isCompleted()).toBe(true);
  });

  it('clears the current step after skip', () => {
    const { tutorial } = buildModule();
    tutorial.start();
    tutorial.skip();
    expect(tutorial.getCurrentStep()).toBeNull();
  });

  it('publishes tutorial.completed when skipped', () => {
    const { bus, tutorial } = buildModule();
    const handler = vi.fn();
    bus.subscribe('tutorial.completed', handler);
    tutorial.start();
    tutorial.skip();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ─── serialize / deserialize ──────────────────────────────────────────────────

describe('TutorialEngine — serialize/deserialize', () => {
  it('serializes current state', () => {
    const { tutorial } = buildModule();
    tutorial.start();
    tutorial.nextStep();
    const state = tutorial.serialize();
    expect(state.currentStep).toBe(1);
    expect(state.everStarted).toBe(true);
    expect(state.completed).toBe(false);
  });

  it('restores state from serialized data', () => {
    const { tutorial } = buildModule();
    tutorial.deserialize({ completed: false, currentStep: 2, everStarted: true });
    const step = tutorial.getCurrentStep();
    expect(step!.index).toBe(2);
  });

  it('restores completed state so tutorial does not restart', () => {
    const { tutorial } = buildModule();
    tutorial.deserialize({ completed: true, currentStep: 5, everStarted: true });
    tutorial.start(); // should be no-op
    expect(tutorial.getCurrentStep()).toBeNull();
    expect(tutorial.isCompleted()).toBe(true);
  });

  it('getState() returns immutable snapshot', () => {
    const { tutorial } = buildModule();
    tutorial.start();
    const state = tutorial.getState();
    expect(state.everStarted).toBe(true);
  });
});
