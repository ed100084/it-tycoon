import {
  AUDIT_EVENT_DEFS,
  AUDIT_INTERVAL_BASE,
  AUDIT_INTERVAL_VARIANCE,
  FIRST_AUDIT_DELAY,
  MAX_ACTIVE_AUDITS,
} from '../config/audit.config';
import type { AuditEvent } from '../models/types';

export function calcInitialAuditAt(now: number): number {
  return now + FIRST_AUDIT_DELAY;
}

export function calcNextAuditAt(now: number): number {
  return now + AUDIT_INTERVAL_BASE + Math.random() * AUDIT_INTERVAL_VARIANCE;
}

export function canSpawnAudit(activeAudits: AuditEvent[]): boolean {
  return activeAudits.length < MAX_ACTIVE_AUDITS;
}

export function createAuditEvent(
  now: number,
  totalEarnedCompute: number,
  satisfaction: number,
  costMultiplier = 1
): AuditEvent | null {
  const eligible = AUDIT_EVENT_DEFS.filter((def) => totalEarnedCompute >= def.minTotalEarned);
  if (eligible.length === 0) return null;

  const def = eligible[Math.floor(Math.random() * eligible.length)];
  const pressureMultiplier = satisfaction < 50 ? 1.25 : satisfaction > 80 ? 0.9 : 1;
  return {
    id: `AUD-${Math.floor(now)}-${def.type}-${Math.random().toString(36).slice(2, 7)}`,
    type: def.type,
    title: def.title,
    description: def.description,
    timeLimit: def.timeLimit,
    active: true,
    startedAt: now,
    responseCost: Math.ceil(def.baseCost * pressureMultiplier * costMultiplier),
    satisfactionPenalty: def.satisfactionPenalty,
    satisfactionReward: def.satisfactionReward,
  };
}

export function getAuditRemainingSeconds(audit: AuditEvent, now: number): number {
  return Math.max(0, audit.startedAt + audit.timeLimit - now);
}

export function isAuditExpired(audit: AuditEvent, now: number): boolean {
  return getAuditRemainingSeconds(audit, now) <= 0;
}
