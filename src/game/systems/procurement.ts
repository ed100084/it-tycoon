import { HARDWARE_DEFS } from '../config/hardware.config';
import {
  PROCUREMENT_BASE_LEAD_TIME,
  PROCUREMENT_REQUIRED_TIER,
  PROCUREMENT_TIER_LEAD_TIME_MULTIPLIER,
} from '../config/procurement.config';
import type { ProcurementRequest } from '../models/types';

const HARDWARE_BY_ID = new Map(HARDWARE_DEFS.map((def) => [def.id, def]));

export function requiresProcurement(tierId: string): boolean {
  const def = HARDWARE_BY_ID.get(tierId);
  return Boolean(def && def.tier >= PROCUREMENT_REQUIRED_TIER);
}

export function calcProcurementLeadTime(tierId: string): number {
  const def = HARDWARE_BY_ID.get(tierId);
  if (!def) return PROCUREMENT_BASE_LEAD_TIME;
  const tierOffset = Math.max(0, def.tier - PROCUREMENT_REQUIRED_TIER);
  return Math.ceil(PROCUREMENT_BASE_LEAD_TIME * Math.pow(PROCUREMENT_TIER_LEAD_TIME_MULTIPLIER, tierOffset));
}

export function calcAdjustedProcurementLeadTime(tierId: string, speedMultiplier: number): number {
  const leadTime = calcProcurementLeadTime(tierId);
  if (!Number.isFinite(speedMultiplier) || speedMultiplier <= 0) return leadTime;
  return Math.max(5, Math.ceil(leadTime / speedMultiplier));
}

export function calcProcurementRackUnits(requests: ProcurementRequest[]): number {
  return requests.reduce((total, request) => {
    const def = HARDWARE_BY_ID.get(request.tierId);
    if (!def || request.status === 'delivered') return total;
    return total + def.uSize * request.qty;
  }, 0);
}

export function createProcurementRequest(
  tierId: string,
  qty: number,
  cost: number,
  gameTime: number,
  speedMultiplier = 1
): ProcurementRequest {
  const leadTime = calcAdjustedProcurementLeadTime(tierId, speedMultiplier);
  return {
    id: `PR-${Math.floor(gameTime)}-${tierId}-${Math.random().toString(36).slice(2, 7)}`,
    tierId,
    qty,
    cost,
    submittedAt: gameTime,
    readyAt: gameTime + leadTime,
    status: 'pending',
  };
}
