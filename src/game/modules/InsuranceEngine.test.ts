import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { InsuranceEngine } from './InsuranceEngine';
import { InsuranceType } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function build() {
  const bus = new EventBus();
  const ie = new InsuranceEngine();
  ie.init(bus, DEFAULT_CONFIG);
  return { bus, ie };
}

const ANNUAL_REVENUE = 10_000_000; // NT$10M — gives computable premiums within range

// ─── 1. No policies initially ─────────────────────────────────────────────────

describe('InsuranceEngine — initial state', () => {
  it('1. no policies initially', () => {
    const { ie } = build();
    const state = ie.getInsuranceState();
    expect(state.policies).toHaveLength(0);
    expect(state.totalAnnualPremium).toBe(0);
    expect(state.totalCoverage).toBe(0);
    expect(state.claimsHistory).toHaveLength(0);
    expect(state.premiumMultiplier).toBe(1.0);
  });
});

// ─── 2. purchasePolicy returns null (success) ─────────────────────────────────

describe('InsuranceEngine — purchasePolicy', () => {
  it('2. purchasePolicy returns null on success', () => {
    const { ie } = build();
    const result = ie.purchasePolicy(InsuranceType.CyberSecurity, ANNUAL_REVENUE);
    expect(result).toBeNull();
  });

  it('3. purchasePolicy adds policy to list', () => {
    const { ie } = build();
    ie.purchasePolicy(InsuranceType.CyberSecurity, ANNUAL_REVENUE);
    const state = ie.getInsuranceState();
    expect(state.policies).toHaveLength(1);
    expect(state.policies[0].type).toBe(InsuranceType.CyberSecurity);
    expect(state.policies[0].isActive).toBe(true);
  });

  it('4. purchasePolicy charges first-year premium via hardware.purchased', () => {
    const { bus, ie } = build();
    const purchases: unknown[] = [];
    bus.subscribe('hardware.purchased', e => purchases.push(e));

    ie.purchasePolicy(InsuranceType.CyberSecurity, ANNUAL_REVENUE);

    expect(purchases).toHaveLength(1);
    const payload = (purchases[0] as { payload: { amount: number } }).payload;
    // CyberSecurity: basePremiumRate 0.01 × 10M × multiplier 1.0 = 100,000 → clamped to min 500,000
    expect(payload.amount).toBeGreaterThanOrEqual(
      DEFAULT_CONFIG.insurance!.policyDefs[InsuranceType.CyberSecurity].minAnnualPremiumNTD,
    );
    expect(payload.amount).toBeLessThanOrEqual(
      DEFAULT_CONFIG.insurance!.policyDefs[InsuranceType.CyberSecurity].maxAnnualPremiumNTD,
    );
  });

  it('5. duplicate policy type returns error string', () => {
    const { ie } = build();
    ie.purchasePolicy(InsuranceType.DAndO, ANNUAL_REVENUE);
    const result = ie.purchasePolicy(InsuranceType.DAndO, ANNUAL_REVENUE);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });
});

// ─── 6. cancelPolicy removes it ──────────────────────────────────────────────

describe('InsuranceEngine — cancelPolicy', () => {
  it('6. cancelPolicy removes the policy from the list', () => {
    const { ie } = build();
    ie.purchasePolicy(InsuranceType.EAndO, ANNUAL_REVENUE);
    const state = ie.getInsuranceState();
    expect(state.policies).toHaveLength(1);
    const policyId = state.policies[0].id;

    ie.cancelPolicy(policyId);

    expect(ie.getInsuranceState().policies).toHaveLength(0);
    expect(ie.hasCoverage(InsuranceType.EAndO)).toBe(false);
  });
});

// ─── 7-8. hasCoverage ────────────────────────────────────────────────────────

describe('InsuranceEngine — hasCoverage', () => {
  it('7. hasCoverage returns false for a type that has no active policy', () => {
    const { ie } = build();
    expect(ie.hasCoverage(InsuranceType.BusinessInterruption)).toBe(false);
  });

  it('8. hasCoverage returns true after purchasing a policy of that type', () => {
    const { ie } = build();
    ie.purchasePolicy(InsuranceType.BusinessInterruption, ANNUAL_REVENUE);
    expect(ie.hasCoverage(InsuranceType.BusinessInterruption)).toBe(true);
  });
});

// ─── 9-11. processClaim ──────────────────────────────────────────────────────

describe('InsuranceEngine — processClaim', () => {
  it('9. processClaim returns 0 when no active policy of that type', () => {
    const { ie } = build();
    const covered = ie.processClaim(InsuranceType.CyberSecurity, 1_000_000);
    expect(covered).toBe(0);
  });

  it('10. processClaim returns covered amount equal to lossAmount × coverageRate', () => {
    const { ie } = build();
    ie.purchasePolicy(InsuranceType.CyberSecurity, ANNUAL_REVENUE);

    const loss = 1_000_000;
    const covered = ie.processClaim(InsuranceType.CyberSecurity, loss);

    // CyberSecurity coverageRate = 0.50
    const expectedCoverageRate =
      DEFAULT_CONFIG.insurance!.policyDefs[InsuranceType.CyberSecurity].coverageRate;
    expect(covered).toBe(Math.round(loss * expectedCoverageRate));
  });

  it('11. processClaim increases premiumMultiplier by claimPremiumIncrease', () => {
    const { ie } = build();
    ie.purchasePolicy(InsuranceType.DAndO, ANNUAL_REVENUE);

    const multiplierBefore = ie.getInsuranceState().premiumMultiplier;
    ie.processClaim(InsuranceType.DAndO, 500_000);
    const multiplierAfter = ie.getInsuranceState().premiumMultiplier;

    const increase = DEFAULT_CONFIG.insurance!.claimPremiumIncrease;
    expect(multiplierAfter).toBeCloseTo(multiplierBefore + increase, 5);
  });
});

// ─── 12. serialize / deserialize ─────────────────────────────────────────────

describe('InsuranceEngine — serialize / deserialize', () => {
  it('12. serialize/deserialize preserves policies and claimsHistory', () => {
    const { ie } = build();

    // Purchase two policies and file one claim
    ie.purchasePolicy(InsuranceType.CyberSecurity, ANNUAL_REVENUE);
    ie.purchasePolicy(InsuranceType.EAndO, ANNUAL_REVENUE);
    ie.processClaim(InsuranceType.CyberSecurity, 2_000_000);

    const snapshot = ie.serialize();

    const { ie: ie2 } = build();
    ie2.deserialize(snapshot);

    const restored = ie2.getInsuranceState();
    expect(restored.policies).toHaveLength(2);
    expect(restored.claimsHistory).toHaveLength(1);
    expect(restored.claimsHistory[0].type).toBe(InsuranceType.CyberSecurity);
    expect(restored.premiumMultiplier).toBeCloseTo(
      1.0 + DEFAULT_CONFIG.insurance!.claimPremiumIncrease,
      5,
    );
  });
});
