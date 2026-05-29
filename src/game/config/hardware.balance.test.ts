import { describe, it, expect } from 'vitest';
import { HARDWARE_DEFS } from './hardware.config';
import { FACILITY_REGION_DEFS } from './facility.config';
import { PRESTIGE1_THRESHOLD } from './game.config';
import { calcBulkCost, computeTickMetrics } from '../systems/hardware';

// A generous-but-finite estimate of the rack capacity a dedicated player can
// reach within a single prestige run: every region unlocked at base capacity
// plus ten expansions each. Facility state resets on prestige, so any unlock
// gate that exceeds this is effectively unreachable in normal play.
const MAX_REACHABLE_RACK_U = FACILITY_REGION_DEFS.reduce(
  (total, def) => total + def.baseCapacity + 10 * def.expansionUnits,
  0
);

describe('hardware unlock gates', () => {
  it('starts with T0 always visible', () => {
    expect(HARDWARE_DEFS[0].unlockAt).toBe(0);
  });

  it('gates every later tier behind a positive count of the previous tier', () => {
    for (let i = 1; i < HARDWARE_DEFS.length; i++) {
      expect(HARDWARE_DEFS[i].unlockAt).toBeGreaterThan(0);
    }
  });

  it('keeps every unlock gate reachable in rack space within one run', () => {
    for (let i = 1; i < HARDWARE_DEFS.length; i++) {
      const def = HARDWARE_DEFS[i];
      const prev = HARDWARE_DEFS[i - 1];
      const rackNeeded = def.unlockAt * prev.uSize;
      expect(
        rackNeeded,
        `${def.id} requires owning ${def.unlockAt}x ${prev.id} = ${rackNeeded}U (> ${MAX_REACHABLE_RACK_U}U reachable)`
      ).toBeLessThanOrEqual(MAX_REACHABLE_RACK_U);
    }
  });

  it('keeps every unlock gate affordable before the first prestige', () => {
    for (let i = 1; i < HARDWARE_DEFS.length; i++) {
      const def = HARDWARE_DEFS[i];
      const prev = HARDWARE_DEFS[i - 1];
      const gateCost = calcBulkCost(prev.id, 0, def.unlockAt);
      expect(
        gateCost,
        `${def.id} gate costs ${gateCost.toExponential(2)} CF (>= prestige threshold)`
      ).toBeLessThan(PRESTIGE1_THRESHOLD);
    }
  });
});

describe('progression curve invariants', () => {
  it('produces positive net CPS for every tier at the base PUE', () => {
    for (const def of HARDWARE_DEFS) {
      const metrics = computeTickMetrics({ [def.id]: { owned: 1, upgradeLevel: 1 } }, 0);
      expect(metrics.netCPS, `${def.id} net CPS`).toBeGreaterThan(0);
    }
  });

  it('improves rack efficiency (CPS per U) monotonically with tier', () => {
    const efficiencies = HARDWARE_DEFS.map((def) => def.baseCps / def.uSize);
    for (let i = 1; i < efficiencies.length; i++) {
      expect(
        efficiencies[i],
        `${HARDWARE_DEFS[i].id} CPS/U should exceed ${HARDWARE_DEFS[i - 1].id}`
      ).toBeGreaterThan(efficiencies[i - 1]);
    }
  });
});
