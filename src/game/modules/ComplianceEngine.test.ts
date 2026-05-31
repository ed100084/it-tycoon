import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { ComplianceEngine } from './ComplianceEngine';
import { ComplianceCertType, ComplianceCertStatus, StaffRole } from '../core/types';
import { DEFAULT_CONFIG } from '../config/default.config';

function build() {
  const bus = new EventBus();
  const ce = new ComplianceEngine();
  ce.init(bus, DEFAULT_CONFIG);
  return { bus, ce };
}

function advanceMonths(bus: EventBus, months: number, startYear = 2000, startMonth = 1) {
  let y = startYear; let m = startMonth;
  for (let i = 0; i < months; i++) {
    m++; if (m > 12) { m = 1; y++; }
    bus.publish({ type: 'time.month_end', payload: { newDate: { year: y, month: m } }, source: 'test', gameDate: { year: y, month: m } });
  }
}

function hireSecAnalyst(bus: EventBus) {
  bus.publish({ type: 'staff.hired', payload: { role: StaffRole.E3_SecAna, name: 'Test' }, source: 'test', gameDate: { year: 2000, month: 1 } });
}

describe('ComplianceEngine — initial state', () => {
  it('1. all 6 certs start as NotAcquired', () => {
    const { ce } = build();
    const certs = ce.getCertifications();
    expect(certs).toHaveLength(6);
    expect(certs.every(c => c.status === ComplianceCertStatus.NotAcquired)).toBe(true);
  });

  it('2. hasCert returns false for all initially', () => {
    const { ce } = build();
    expect(ce.hasCert(ComplianceCertType.ISO_27001)).toBe(false);
    expect(ce.hasCert(ComplianceCertType.SOC2)).toBe(false);
  });

  it('3. getExpiredCerts returns empty initially', () => {
    const { ce } = build();
    expect(ce.getExpiredCerts()).toHaveLength(0);
  });
});

describe('ComplianceEngine — startAcquisition', () => {
  it('4. fails when prerequisite analysts not met', () => {
    const { ce } = build();
    const err = ce.startAcquisition(ComplianceCertType.ISO_27001);
    expect(err).toBeTruthy();
  });

  it('5. fails for cert already in progress', () => {
    const { bus, ce } = build();
    hireSecAnalyst(bus);
    hireSecAnalyst(bus);
    ce.startAcquisition(ComplianceCertType.ISO_27001);
    const err = ce.startAcquisition(ComplianceCertType.ISO_27001);
    expect(err).toBeTruthy();
  });

  it('6. succeeds when prerequisites met', () => {
    const { bus, ce } = build();
    hireSecAnalyst(bus);
    hireSecAnalyst(bus);
    const err = ce.startAcquisition(ComplianceCertType.ISO_27001);
    expect(err).toBeNull();
  });

  it('7. cert status becomes InProgress after startAcquisition', () => {
    const { bus, ce } = build();
    hireSecAnalyst(bus);
    hireSecAnalyst(bus);
    ce.startAcquisition(ComplianceCertType.ISO_27001);
    expect(ce.getCert(ComplianceCertType.ISO_27001).status).toBe(ComplianceCertStatus.InProgress);
  });

  it('8. publishes hardware.purchased for acquisition cost', () => {
    const { bus, ce } = build();
    hireSecAnalyst(bus);
    hireSecAnalyst(bus);
    const purchases: unknown[] = [];
    bus.subscribe('hardware.purchased', e => purchases.push(e));
    ce.startAcquisition(ComplianceCertType.ISO_27001);
    expect(purchases).toHaveLength(1);
  });
});

describe('ComplianceEngine — cert lifecycle', () => {
  it('9. cert becomes Active after required months', () => {
    const { bus, ce } = build();
    hireSecAnalyst(bus);
    hireSecAnalyst(bus);
    ce.startAcquisition(ComplianceCertType.HIPAA); // 6 months
    advanceMonths(bus, 7);
    expect(ce.hasCert(ComplianceCertType.HIPAA)).toBe(true);
    expect(ce.getCert(ComplianceCertType.HIPAA).status).toBe(ComplianceCertStatus.Active);
  });

  it('10. hasCert returns true after acquisition', () => {
    const { bus, ce } = build();
    hireSecAnalyst(bus);
    ce.startAcquisition(ComplianceCertType.SOC2); // 9 months
    advanceMonths(bus, 10);
    expect(ce.hasCert(ComplianceCertType.SOC2)).toBe(true);
  });

  it('11. publishes compliance.cert_acquired on completion', () => {
    const { bus, ce } = build();
    hireSecAnalyst(bus);
    const acquired: unknown[] = [];
    bus.subscribe('compliance.cert_acquired', e => acquired.push(e));
    ce.startAcquisition(ComplianceCertType.CSA_STAR); // 5 months
    advanceMonths(bus, 6);
    expect(acquired).toHaveLength(1);
  });
});

describe('ComplianceEngine — serialize/deserialize', () => {
  it('12. serialize/deserialize preserves cert status', () => {
    const { bus, ce } = build();
    hireSecAnalyst(bus);
    hireSecAnalyst(bus);
    ce.startAcquisition(ComplianceCertType.ISO_27001);
    const serialized = ce.serialize();
    const ce2 = new ComplianceEngine();
    ce2.init(new EventBus(), DEFAULT_CONFIG);
    ce2.deserialize(serialized);
    expect(ce2.getCert(ComplianceCertType.ISO_27001).status).toBe(ComplianceCertStatus.InProgress);
  });
});
