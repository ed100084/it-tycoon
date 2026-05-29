import { create } from 'zustand';
import { HARDWARE_DEFS, MAX_UPGRADE_LEVEL_V02 } from '../game/config/hardware.config';
import { PUE_DEFS, MAX_PUE_LEVEL_V02 } from '../game/config/pue.config';
import { CLICK_BASE_VALUE, GAME_VERSION, INITIAL_STATE } from '../game/config/game.config';
import {
  calcHardwareCost,
  calcBulkCost,
  calcUpgradeCost,
  computeTickMetrics,
  GameTickMetrics,
} from '../game/systems/hardware';
import {
  saveToStorage,
  loadFromStorage,
  migrateSave,
  calcOfflineEarnings,
} from '../game/systems/save';
import {
  calcCrossRegionMultiplier,
  calcRackUtilization,
  calcRegionExpansionCost,
  calcRegionUnlockReady,
  calcTotalRackCapacity,
  calcUsedRackUnits,
  canInstallHardware,
  createDefaultFacilityRegions,
} from '../game/systems/facility';
import { FACILITY_REGION_DEFS, type FacilityRegionId } from '../game/config/facility.config';
import {
  calcContractReservedUnits,
  calcInitialContractOfferAt,
  calcNextContractOfferAt,
  canSpawnContractOffer,
  createContractOffer,
  isContractOfferExpired,
  signContract,
} from '../game/systems/contracts';
import {
  CONTRACT_BREACH_TERMINATION_SECONDS,
  CONTRACT_TERMINATION_PENALTY_MULTIPLIER,
} from '../game/config/contract.config';
import {
  SATISFACTION_CAPACITY_PENALTY,
  SATISFACTION_RECOVERY_RATE,
  SATISFACTION_SHUTDOWN_PENALTY,
  PROCUREMENT_SATISFACTION_ON_DELIVERY,
  PROCUREMENT_SATISFACTION_PENDING_PENALTY,
} from '../game/config/procurement.config';
import {
  calcProcurementRackUnits,
  createProcurementRequest,
  requiresProcurement,
} from '../game/systems/procurement';
import {
  calcInitialAuditAt,
  calcNextAuditAt,
  canSpawnAudit,
  createAuditEvent,
  isAuditExpired,
} from '../game/systems/audit';
import { PRESTIGE_SATISFACTION_BONUS } from '../game/config/prestige.config';
import {
  calcInfluenceMultiplier,
  calcPrestigeInfluenceGain,
  calcPrestigeReputationGain,
  calcReputationMultiplier,
} from '../game/systems/prestige';
import { calcTechEffects, canUnlockTechNode, getTechNode } from '../game/systems/tech';
import { ACHIEVEMENT_DEFS } from '../game/config/achievement.config';
import {
  evaluateAchievementUnlocks,
  mergeAchievementUnlocks,
} from '../game/systems/achievements';
import type { ActiveContract, AuditEvent, ContractOffer, FacilityRegionState, HardwareState, OfflineEarningsReport, ProcurementRequest } from '../game/models/types';

export interface GameStore {
  // Core resources
  compute: number;
  totalEarnedCompute: number;

  // Hardware
  hardware: Record<string, HardwareState>;
  procurementRequests: ProcurementRequest[];

  // Power & Cooling
  pueLevel: number;
  isShutdown: boolean;
  emergencyClicks: number;
  shutdownBuffer: number;
  rackCapacity: number;
  facilityRegions: Record<FacilityRegionId, FacilityRegionState>;

  // Soft stats
  satisfaction: number;
  reputation: number;
  totalEarnedReputation: number;
  influence: number;
  prestigeCount: number;
  auditEvents: AuditEvent[];
  nextAuditAt: number;
  resolvedAudits: number;
  failedAudits: number;

  // Contracts
  contracts: ActiveContract[];
  contractOffers: ContractOffer[];
  nextContractOfferAt: number;
  completedContracts: number;
  breachedContracts: number;
  totalContractsSigned: number;
  totalContractRevenue: number;

  // Meta
  lastSaveTime: number;
  gameTime: number;
  unlockedAchievements: string[];
  recentAchievementIds: string[];
  techNodes: string[];

  // Derived (updated each tick)
  metrics: GameTickMetrics;

  // Offline
  offlineReport: OfflineEarningsReport | null;

  // Actions
  click: () => void;
  buyHardware: (tierId: string, qty: number) => void;
  upgradeHardware: (tierId: string) => void;
  upgradePUE: () => void;
  expandRegion: (regionId: FacilityRegionId) => void;
  unlockRegion: (regionId: FacilityRegionId) => void;
  resolveAudit: (auditId: string) => void;
  acceptContract: (offerId: string) => void;
  declineContract: (offerId: string) => void;
  prestige: () => void;
  prestigeTier2: () => void;
  unlockTechNode: (nodeId: string) => void;
  tick: (dt: number) => void;
  saveGame: () => void;
  loadGame: () => void;
  newGame: () => void;
  dismissOfflineReport: () => void;
}

const emptyMetrics: GameTickMetrics = {
  totalCPS: 0,
  totalPowerCost: 0,
  netCPS: 0,
  perHardware: {},
};

const defaultHardware = (): Record<string, HardwareState> =>
  Object.fromEntries(HARDWARE_DEFS.map((d) => [d.id, { owned: 0, upgradeLevel: 1 }]));

const clampNumber = (value: number | undefined, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const clampInteger = (value: number | undefined, fallback: number, min: number, max: number): number =>
  Math.floor(clampNumber(value, fallback, min, max));

const normalizeHardware = (savedHardware: Record<string, HardwareState>): Record<string, HardwareState> =>
  Object.fromEntries(
    HARDWARE_DEFS.map((def) => {
      const saved = savedHardware[def.id];
      return [
        def.id,
        {
          owned: clampInteger(saved?.owned, 0, 0, Number.MAX_SAFE_INTEGER),
          upgradeLevel: clampInteger(saved?.upgradeLevel, 1, 1, MAX_UPGRADE_LEVEL_V02),
        },
      ];
    })
  );

const normalizeFacilityRegions = (
  savedRegions: Partial<Record<FacilityRegionId, FacilityRegionState>> | undefined,
  legacyRackCapacity?: number
): Record<FacilityRegionId, FacilityRegionState> => {
  const defaults = createDefaultFacilityRegions();
  const regions = Object.fromEntries(
    FACILITY_REGION_DEFS.map((def) => {
      const saved = savedRegions?.[def.id];
      const defaultRegion = defaults[def.id];
      return [
        def.id,
        {
          unlocked: typeof saved?.unlocked === 'boolean' ? saved.unlocked : defaultRegion.unlocked,
          capacity: clampInteger(saved?.capacity, defaultRegion.capacity, def.baseCapacity, Number.MAX_SAFE_INTEGER),
          expansionCount: clampInteger(saved?.expansionCount, defaultRegion.expansionCount, 0, Number.MAX_SAFE_INTEGER),
        },
      ];
    })
  ) as Record<FacilityRegionId, FacilityRegionState>;

  if (!savedRegions && typeof legacyRackCapacity === 'number') {
    regions.north.capacity = clampInteger(legacyRackCapacity, regions.north.capacity, 1, Number.MAX_SAFE_INTEGER);
  }

  return regions;
};

const normalizeProcurementRequests = (requests: ProcurementRequest[] | undefined): ProcurementRequest[] => {
  if (!Array.isArray(requests)) return [];
  return requests
    .filter((request) => request && typeof request.tierId === 'string')
    .map((request) => ({
      id: typeof request.id === 'string' ? request.id : `PR-${request.tierId}-${request.submittedAt ?? 0}`,
      tierId: request.tierId,
      qty: clampInteger(request.qty, 1, 1, Number.MAX_SAFE_INTEGER),
      cost: clampNumber(request.cost, 0, 0, Number.MAX_SAFE_INTEGER),
      submittedAt: clampNumber(request.submittedAt, 0, 0, Number.MAX_SAFE_INTEGER),
      readyAt: clampNumber(request.readyAt, 0, 0, Number.MAX_SAFE_INTEGER),
      status: request.status === 'ready' || request.status === 'blocked' ? request.status : 'pending',
    }));
};

const normalizeAuditEvents = (events: AuditEvent[] | undefined): AuditEvent[] => {
  if (!Array.isArray(events)) return [];
  return events
    .filter((event) => event && typeof event.id === 'string' && typeof event.type === 'string')
    .map((event) => ({
      id: event.id,
      type: event.type,
      title: typeof event.title === 'string' ? event.title : 'Audit Event',
      description: typeof event.description === 'string' ? event.description : '',
      timeLimit: clampNumber(event.timeLimit, 90, 1, Number.MAX_SAFE_INTEGER),
      active: event.active !== false,
      startedAt: clampNumber(event.startedAt, 0, 0, Number.MAX_SAFE_INTEGER),
      responseCost: clampNumber(event.responseCost, 1000, 0, Number.MAX_SAFE_INTEGER),
      satisfactionPenalty: clampNumber(event.satisfactionPenalty, 5, 0, 100),
      satisfactionReward: clampNumber(event.satisfactionReward, 2, 0, 100),
    }));
};

const CONTRACT_SERVICE_TYPES = new Set(['colocation', 'vps', 'managed', 'cloud']);

const normalizeContracts = (contracts: ActiveContract[] | undefined): ActiveContract[] => {
  if (!Array.isArray(contracts)) return [];
  return contracts
    .filter((c) => c && typeof c.id === 'string' && CONTRACT_SERVICE_TYPES.has(c.serviceType))
    .map((c) => ({
      id: c.id,
      clientName: typeof c.clientName === 'string' ? c.clientName : 'Client',
      serviceType: c.serviceType,
      reservedUnits: clampInteger(c.reservedUnits, 0, 0, Number.MAX_SAFE_INTEGER),
      payoutPerSecond: clampNumber(c.payoutPerSecond, 0, 0, Number.MAX_SAFE_INTEGER),
      slaPenaltyPerSecond: clampNumber(c.slaPenaltyPerSecond, 0, 0, 100),
      completionReward: clampNumber(c.completionReward, 0, 0, 100),
      startedAt: clampNumber(c.startedAt, 0, 0, Number.MAX_SAFE_INTEGER),
      endsAt: clampNumber(c.endsAt, 0, 0, Number.MAX_SAFE_INTEGER),
      breachSeconds: clampNumber(c.breachSeconds, 0, 0, Number.MAX_SAFE_INTEGER),
      totalPaid: clampNumber(c.totalPaid, 0, 0, Number.MAX_SAFE_INTEGER),
    }));
};

const normalizeContractOffers = (offers: ContractOffer[] | undefined): ContractOffer[] => {
  if (!Array.isArray(offers)) return [];
  return offers
    .filter((o) => o && typeof o.id === 'string' && CONTRACT_SERVICE_TYPES.has(o.serviceType))
    .map((o) => ({
      id: o.id,
      clientName: typeof o.clientName === 'string' ? o.clientName : 'Client',
      serviceType: o.serviceType,
      reservedUnits: clampInteger(o.reservedUnits, 0, 0, Number.MAX_SAFE_INTEGER),
      payoutPerSecond: clampNumber(o.payoutPerSecond, 0, 0, Number.MAX_SAFE_INTEGER),
      durationSeconds: clampNumber(o.durationSeconds, 60, 1, Number.MAX_SAFE_INTEGER),
      signingBonus: clampNumber(o.signingBonus, 0, 0, Number.MAX_SAFE_INTEGER),
      slaPenaltyPerSecond: clampNumber(o.slaPenaltyPerSecond, 0, 0, 100),
      completionReward: clampNumber(o.completionReward, 0, 0, 100),
      createdAt: clampNumber(o.createdAt, 0, 0, Number.MAX_SAFE_INTEGER),
      expiresAt: clampNumber(o.expiresAt, 0, 0, Number.MAX_SAFE_INTEGER),
    }));
};

const normalizeAchievementIds = (achievementIds: string[] | undefined): string[] => {
  if (!Array.isArray(achievementIds)) return [];
  const validIds = new Set(ACHIEVEMENT_DEFS.map((achievement) => achievement.id));
  return [...new Set(achievementIds.filter((achievementId) => validIds.has(achievementId)))];
};

const calcGlobalCpsMultiplier = (
  facilityRegions: Record<FacilityRegionId, FacilityRegionState>,
  reputation: number,
  influence: number,
  techNodes: string[]
): number => (
  calcCrossRegionMultiplier(facilityRegions)
  * calcReputationMultiplier(reputation)
  * calcInfluenceMultiplier(influence)
  * calcTechEffects(techNodes).cpsMultiplier
);

const calcEffectiveRackCapacity = (
  facilityRegions: Record<FacilityRegionId, FacilityRegionState>,
  techNodes: string[]
): number => Math.ceil(calcTotalRackCapacity(facilityRegions) * calcTechEffects(techNodes).rackCapacityMultiplier);

const createInitialFacilityRegions = () => createDefaultFacilityRegions();

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  ...INITIAL_STATE,
  hardware: defaultHardware(),
  procurementRequests: [],
  facilityRegions: createInitialFacilityRegions(),
  rackCapacity: calcEffectiveRackCapacity(createInitialFacilityRegions(), INITIAL_STATE.techNodes),
  lastSaveTime: Date.now(),
  metrics: emptyMetrics,
  offlineReport: null,
  emergencyClicks: 0,
  shutdownBuffer: 0,
  auditEvents: [],
  nextAuditAt: calcInitialAuditAt(0),
  resolvedAudits: 0,
  failedAudits: 0,
  contracts: [],
  contractOffers: [],
  nextContractOfferAt: calcInitialContractOfferAt(0),
  completedContracts: 0,
  breachedContracts: 0,
  totalContractsSigned: 0,
  totalContractRevenue: 0,
  recentAchievementIds: [],

  click: () => {
    set((s) => {
      const techEffects = calcTechEffects(s.techNodes);
      const clickValue = CLICK_BASE_VALUE * techEffects.clickMultiplier;
      const newCompute = s.compute + clickValue;
      if (s.isShutdown) {
        const newClicks = s.emergencyClicks + 1;
        const powerCost5s = s.metrics.totalPowerCost * 5;
        const canRestart = newClicks >= 10 || (powerCost5s > 0 && newCompute >= powerCost5s);
        return {
          compute: newCompute,
          totalEarnedCompute: s.totalEarnedCompute + clickValue,
          emergencyClicks: canRestart ? 0 : newClicks,
          isShutdown: !canRestart,
          shutdownBuffer: canRestart ? 5.0 : 0,
        };
      }
      return {
        compute: newCompute,
        totalEarnedCompute: s.totalEarnedCompute + clickValue,
      };
    });
  },

  buyHardware: (tierId, qty) => {
    const { compute, hardware, rackCapacity, procurementRequests, contracts, gameTime } = get();
    const hw = hardware[tierId] ?? { owned: 0, upgradeLevel: 1 };
    const cost = qty === 1 ? calcHardwareCost(tierId, hw.owned) : calcBulkCost(tierId, hw.owned, qty);
    const effectiveRackCapacity = rackCapacity - calcProcurementRackUnits(procurementRequests) - calcContractReservedUnits(contracts);
    if (compute < cost) return;
    if (!canInstallHardware(tierId, qty, hardware, effectiveRackCapacity)) return;

    if (requiresProcurement(tierId)) {
      const techEffects = calcTechEffects(get().techNodes);
      set((s) => ({
        compute: s.compute - cost,
        procurementRequests: [
          ...s.procurementRequests,
          createProcurementRequest(tierId, qty, cost, gameTime, techEffects.procurementSpeedMultiplier),
        ],
        satisfaction: clampNumber(s.satisfaction - 0.75, INITIAL_STATE.satisfaction, 0, 100),
      }));
      return;
    }

    set((s) => {
      const prevHw = s.hardware[tierId] ?? { owned: 0, upgradeLevel: 1 };
      const currentEffectiveCapacity = s.rackCapacity - calcProcurementRackUnits(s.procurementRequests) - calcContractReservedUnits(s.contracts);
      if (!canInstallHardware(tierId, qty, s.hardware, currentEffectiveCapacity)) return {};
      const newHardware = {
        ...s.hardware,
        [tierId]: { ...prevHw, owned: prevHw.owned + qty },
      };
      return {
        compute: s.compute - cost,
        hardware: newHardware,
        metrics: computeTickMetrics(
          newHardware,
          s.pueLevel,
          calcGlobalCpsMultiplier(s.facilityRegions, s.reputation, s.influence, s.techNodes),
          calcTechEffects(s.techNodes).powerCostMultiplier
        ),
        // Auto-restart if compute is still positive
        isShutdown: s.isShutdown && s.compute - cost > 0 ? false : s.isShutdown,
      };
    });
  },

  upgradeHardware: (tierId) => {
    const { compute, hardware } = get();
    const hw = hardware[tierId];
    if (!hw || hw.upgradeLevel >= MAX_UPGRADE_LEVEL_V02) return;

    const cost = calcUpgradeCost(tierId, hw.upgradeLevel);
    if (compute < cost) return;

    set((s) => {
      const prevHw = s.hardware[tierId];
      const newHardware = {
        ...s.hardware,
        [tierId]: { ...prevHw, upgradeLevel: prevHw.upgradeLevel + 1 },
      };
      return {
        compute: s.compute - cost,
        hardware: newHardware,
        metrics: computeTickMetrics(
          newHardware,
          s.pueLevel,
          calcGlobalCpsMultiplier(s.facilityRegions, s.reputation, s.influence, s.techNodes),
          calcTechEffects(s.techNodes).powerCostMultiplier
        ),
      };
    });
  },

  upgradePUE: () => {
    const { compute, pueLevel } = get();
    const nextLevel = pueLevel + 1;
    if (nextLevel > MAX_PUE_LEVEL_V02 || nextLevel >= PUE_DEFS.length) return;

    const cost = PUE_DEFS[nextLevel].cost;
    if (compute < cost) return;

    set((s) => {
      const newPueLevel = s.pueLevel + 1;
      return {
        compute: s.compute - cost,
        pueLevel: newPueLevel,
        metrics: computeTickMetrics(
          s.hardware,
          newPueLevel,
          calcGlobalCpsMultiplier(s.facilityRegions, s.reputation, s.influence, s.techNodes),
          calcTechEffects(s.techNodes).powerCostMultiplier
        ),
      };
    });
  },

  expandRegion: (regionId) => {
    const { compute, facilityRegions } = get();
    const region = facilityRegions[regionId];
    const def = FACILITY_REGION_DEFS.find((r) => r.id === regionId);
    if (!region?.unlocked || !def) return;

    const cost = calcRegionExpansionCost(regionId, facilityRegions);
    if (compute < cost) return;

    set((s) => {
      const prevRegion = s.facilityRegions[regionId];
      if (!prevRegion?.unlocked) return {};
      const nextRegions = {
        ...s.facilityRegions,
        [regionId]: {
          ...prevRegion,
          capacity: prevRegion.capacity + def.expansionUnits,
          expansionCount: prevRegion.expansionCount + 1,
        },
      };
      return {
        compute: s.compute - cost,
        facilityRegions: nextRegions,
        rackCapacity: calcEffectiveRackCapacity(nextRegions, s.techNodes),
      };
    });
  },

  unlockRegion: (regionId) => {
    const { compute, hardware, facilityRegions } = get();
    const def = FACILITY_REGION_DEFS.find((r) => r.id === regionId);
    const region = facilityRegions[regionId];
    if (!def || !region || region.unlocked) return;
    if (!calcRegionUnlockReady(regionId, hardware, facilityRegions)) return;
    if (compute < def.unlockCost) return;

    set((s) => {
      if (!calcRegionUnlockReady(regionId, s.hardware, s.facilityRegions)) return {};
      const prevRegion = s.facilityRegions[regionId];
      const nextRegions = {
        ...s.facilityRegions,
        [regionId]: {
          ...prevRegion,
          unlocked: true,
          capacity: Math.max(prevRegion.capacity, def.baseCapacity),
        },
      };
      return {
        compute: s.compute - def.unlockCost,
        facilityRegions: nextRegions,
        rackCapacity: calcEffectiveRackCapacity(nextRegions, s.techNodes),
        metrics: computeTickMetrics(
          s.hardware,
          s.pueLevel,
          calcGlobalCpsMultiplier(nextRegions, s.reputation, s.influence, s.techNodes),
          calcTechEffects(s.techNodes).powerCostMultiplier
        ),
      };
    });
  },

  resolveAudit: (auditId) => {
    const audit = get().auditEvents.find((event) => event.id === auditId);
    if (!audit) return;
    if (get().compute < audit.responseCost) return;

    set((s) => ({
      compute: s.compute - audit.responseCost,
      auditEvents: s.auditEvents.filter((event) => event.id !== auditId),
      resolvedAudits: s.resolvedAudits + 1,
      satisfaction: clampNumber(s.satisfaction + audit.satisfactionReward, INITIAL_STATE.satisfaction, 0, 100),
    }));
  },

  acceptContract: (offerId) => {
    set((s) => {
      const offer = s.contractOffers.find((o) => o.id === offerId);
      if (!offer) return {};
      const reservedUnits =
        calcUsedRackUnits(s.hardware)
        + calcProcurementRackUnits(s.procurementRequests)
        + calcContractReservedUnits(s.contracts);
      const freeUnits = s.rackCapacity - reservedUnits;
      if (offer.reservedUnits > freeUnits) return {};

      return {
        contractOffers: s.contractOffers.filter((o) => o.id !== offerId),
        contracts: [...s.contracts, signContract(offer, s.gameTime)],
        compute: s.compute + offer.signingBonus,
        totalEarnedCompute: s.totalEarnedCompute + offer.signingBonus,
        totalContractsSigned: s.totalContractsSigned + 1,
        totalContractRevenue: s.totalContractRevenue + offer.signingBonus,
      };
    });
  },

  declineContract: (offerId) => {
    set((s) => ({ contractOffers: s.contractOffers.filter((o) => o.id !== offerId) }));
  },

  prestige: () => {
    const s = get();
    const reputationGain = calcPrestigeReputationGain(
      s.totalEarnedCompute,
      calcTechEffects(s.techNodes).prestigeReputationMultiplier
    );
    if ((s.hardware.T5?.owned ?? 0) < 1) return;
    if (reputationGain <= 0) return;

    const hardware = defaultHardware();
    const facilityRegions = createDefaultFacilityRegions();
    set({
      compute: INITIAL_STATE.compute,
      totalEarnedCompute: INITIAL_STATE.totalEarnedCompute,
      hardware,
      procurementRequests: [],
      pueLevel: INITIAL_STATE.pueLevel,
      isShutdown: false,
      emergencyClicks: 0,
      shutdownBuffer: 0,
      facilityRegions,
      rackCapacity: calcEffectiveRackCapacity(facilityRegions, s.techNodes),
      satisfaction: clampNumber(INITIAL_STATE.satisfaction + PRESTIGE_SATISFACTION_BONUS, INITIAL_STATE.satisfaction, 0, 100),
      reputation: s.reputation + reputationGain,
      totalEarnedReputation: s.totalEarnedReputation + reputationGain,
      influence: s.influence,
      prestigeCount: s.prestigeCount + 1,
      auditEvents: [],
      nextAuditAt: calcInitialAuditAt(0),
      resolvedAudits: s.resolvedAudits,
      failedAudits: s.failedAudits,
      contracts: [],
      contractOffers: [],
      nextContractOfferAt: calcInitialContractOfferAt(0),
      completedContracts: s.completedContracts,
      breachedContracts: s.breachedContracts,
      totalContractsSigned: s.totalContractsSigned,
      totalContractRevenue: s.totalContractRevenue,
      lastSaveTime: Date.now(),
      gameTime: INITIAL_STATE.gameTime,
      unlockedAchievements: s.unlockedAchievements,
      techNodes: s.techNodes,
      metrics: emptyMetrics,
      offlineReport: null,
    });
  },

  prestigeTier2: () => {
    const s = get();
    const influenceGain = calcPrestigeInfluenceGain(s.totalEarnedReputation);
    if (influenceGain <= 0) return;

    const hardware = defaultHardware();
    const facilityRegions = createDefaultFacilityRegions();
    set({
      compute: INITIAL_STATE.compute,
      totalEarnedCompute: INITIAL_STATE.totalEarnedCompute,
      hardware,
      procurementRequests: [],
      pueLevel: INITIAL_STATE.pueLevel,
      isShutdown: false,
      emergencyClicks: 0,
      shutdownBuffer: 0,
      facilityRegions,
      rackCapacity: calcEffectiveRackCapacity(facilityRegions, s.techNodes),
      satisfaction: clampNumber(INITIAL_STATE.satisfaction + PRESTIGE_SATISFACTION_BONUS, INITIAL_STATE.satisfaction, 0, 100),
      reputation: INITIAL_STATE.reputation,
      totalEarnedReputation: INITIAL_STATE.totalEarnedReputation,
      influence: s.influence + influenceGain,
      prestigeCount: s.prestigeCount + 1,
      auditEvents: [],
      nextAuditAt: calcInitialAuditAt(0),
      resolvedAudits: s.resolvedAudits,
      failedAudits: s.failedAudits,
      contracts: [],
      contractOffers: [],
      nextContractOfferAt: calcInitialContractOfferAt(0),
      completedContracts: s.completedContracts,
      breachedContracts: s.breachedContracts,
      totalContractsSigned: s.totalContractsSigned,
      totalContractRevenue: s.totalContractRevenue,
      lastSaveTime: Date.now(),
      gameTime: INITIAL_STATE.gameTime,
      unlockedAchievements: s.unlockedAchievements,
      recentAchievementIds: s.recentAchievementIds,
      techNodes: s.techNodes,
      metrics: emptyMetrics,
      offlineReport: null,
    });
  },

  unlockTechNode: (nodeId) => {
    const s = get();
    const node = getTechNode(nodeId);
    if (!node || !canUnlockTechNode(nodeId, s.techNodes, s.reputation)) return;

    set((state) => {
      if (!canUnlockTechNode(nodeId, state.techNodes, state.reputation)) return {};
      const nextTechNodes = [...state.techNodes, nodeId];
      const nextReputation = state.reputation - node.cost;
      const techEffects = calcTechEffects(nextTechNodes);
      return {
        reputation: nextReputation,
        techNodes: nextTechNodes,
        rackCapacity: calcEffectiveRackCapacity(state.facilityRegions, nextTechNodes),
        metrics: computeTickMetrics(
          state.hardware,
          state.pueLevel,
          calcGlobalCpsMultiplier(state.facilityRegions, nextReputation, state.influence, nextTechNodes),
          techEffects.powerCostMultiplier
        ),
      };
    });
  },

  tick: (dt: number) => {
    set((s) => {
      const withAchievementUnlocks = (next: Partial<GameStore>): Partial<GameStore> => {
        const checkState = { ...s, ...next };
        const newlyUnlocked = evaluateAchievementUnlocks(checkState, s.unlockedAchievements);
        if (newlyUnlocked.length === 0) return next;
        return {
          ...next,
          unlockedAchievements: mergeAchievementUnlocks(s.unlockedAchievements, newlyUnlocked),
          recentAchievementIds: [...newlyUnlocked, ...s.recentAchievementIds].slice(0, 3),
        };
      };
      const techEffects = calcTechEffects(s.techNodes);
      const nextGameTime = s.gameTime + dt;
      const contractReservedUnits = calcContractReservedUnits(s.contracts);
      const capacityForHardware = s.rackCapacity - contractReservedUnits;
      let hardware = s.hardware;
      let deliveredCount = 0;
      const procurementRequests = s.procurementRequests.flatMap((request) => {
        if (request.readyAt > s.gameTime + dt) return [request.status === 'blocked' ? { ...request, status: 'pending' as const } : request];
        if (!canInstallHardware(request.tierId, request.qty, hardware, capacityForHardware)) {
          return [{ ...request, status: 'blocked' as const }];
        }

        const prevHw = hardware[request.tierId] ?? { owned: 0, upgradeLevel: 1 };
        hardware = {
          ...hardware,
          [request.tierId]: { ...prevHw, owned: prevHw.owned + request.qty },
        };
        deliveredCount++;
        return [];
      });

      const metrics = computeTickMetrics(
        hardware,
        s.pueLevel,
        calcGlobalCpsMultiplier(s.facilityRegions, s.reputation, s.influence, s.techNodes),
        techEffects.powerCostMultiplier
      );
      const rackUtilization = calcRackUtilization(hardware, s.rackCapacity);
      const pendingPenalty = procurementRequests.length * PROCUREMENT_SATISFACTION_PENDING_PENALTY * dt;
      const capacityPenalty = rackUtilization >= 0.85 ? SATISFACTION_CAPACITY_PENALTY * dt : 0;
      const shutdownPenalty = s.isShutdown ? SATISFACTION_SHUTDOWN_PENALTY * dt : 0;
      const recovery = !s.isShutdown && rackUtilization < 0.85
        ? SATISFACTION_RECOVERY_RATE * techEffects.satisfactionRecoveryMultiplier * dt
        : 0;
      let failedAudits = s.failedAudits;
      const expiredAudits = s.auditEvents.filter((event) => isAuditExpired(event, nextGameTime));
      let auditEvents = s.auditEvents.filter((event) => !isAuditExpired(event, nextGameTime));
      let nextAuditAt = s.nextAuditAt;
      let auditPenalty = expiredAudits.reduce((total, event) => total + event.satisfactionPenalty, 0);
      if (expiredAudits.length > 0) failedAudits += expiredAudits.length;

      if (nextGameTime >= nextAuditAt) {
        if (canSpawnAudit(auditEvents)) {
          const nextAudit = createAuditEvent(nextGameTime, s.totalEarnedCompute, s.satisfaction, techEffects.auditCostMultiplier);
          if (nextAudit) auditEvents = [...auditEvents, nextAudit];
        }
        nextAuditAt = calcNextAuditAt(nextGameTime);
      }

      // ─── Contracts ───
      // Online contracts pay CF/s; while shut down they accrue downtime, lose
      // satisfaction, and (past the breach cap) terminate early. Reaching the
      // end date completes the contract for a satisfaction reward.
      let completedContracts = s.completedContracts;
      let breachedContracts = s.breachedContracts;
      let contractIncome = 0;
      let contractSatisfaction = 0;
      const nextContracts: ActiveContract[] = [];
      for (const contract of s.contracts) {
        let breachSeconds = contract.breachSeconds;
        let totalPaid = contract.totalPaid;
        if (s.isShutdown) {
          breachSeconds += dt;
          contractSatisfaction -= contract.slaPenaltyPerSecond * dt;
        } else {
          const pay = contract.payoutPerSecond * dt;
          contractIncome += pay;
          totalPaid += pay;
        }
        if (breachSeconds >= CONTRACT_BREACH_TERMINATION_SECONDS) {
          breachedContracts += 1;
          contractSatisfaction -= contract.completionReward * CONTRACT_TERMINATION_PENALTY_MULTIPLIER;
          continue;
        }
        if (nextGameTime >= contract.endsAt) {
          completedContracts += 1;
          contractSatisfaction += contract.completionReward;
          continue;
        }
        nextContracts.push({ ...contract, breachSeconds, totalPaid });
      }
      const contracts = nextContracts;
      const totalContractRevenue = s.totalContractRevenue + contractIncome;

      let contractOffers = s.contractOffers.filter((offer) => !isContractOfferExpired(offer, nextGameTime));
      let nextContractOfferAt = s.nextContractOfferAt;
      if (nextGameTime >= nextContractOfferAt) {
        if (canSpawnContractOffer(contractOffers, contracts)) {
          const offer = createContractOffer(nextGameTime, s.totalEarnedCompute);
          if (offer) contractOffers = [...contractOffers, offer];
        }
        nextContractOfferAt = calcNextContractOfferAt(nextGameTime);
      }

      const contractState = {
        contracts,
        contractOffers,
        nextContractOfferAt,
        completedContracts,
        breachedContracts,
        totalContractRevenue,
      };

      const satisfaction = clampNumber(
        s.satisfaction + recovery + deliveredCount * PROCUREMENT_SATISFACTION_ON_DELIVERY + contractSatisfaction - pendingPenalty - capacityPenalty - shutdownPenalty - auditPenalty,
        INITIAL_STATE.satisfaction,
        0,
        100
      );

      if (s.isShutdown) {
        return withAchievementUnlocks({ hardware, procurementRequests, auditEvents, nextAuditAt, failedAudits, satisfaction, metrics, gameTime: nextGameTime, ...contractState });
      }

      // Free-power buffer after emergency restart
      if (s.shutdownBuffer > 0) {
        const grossGain = metrics.totalCPS * dt + contractIncome;
        return withAchievementUnlocks({
          compute: s.compute + grossGain,
          totalEarnedCompute: s.totalEarnedCompute + grossGain,
          hardware,
          procurementRequests,
          auditEvents,
          nextAuditAt,
          failedAudits,
          satisfaction,
          metrics,
          gameTime: nextGameTime,
          shutdownBuffer: Math.max(0, s.shutdownBuffer - dt),
          ...contractState,
        });
      }

      const newCompute = s.compute + metrics.netCPS * dt + contractIncome;

      if (newCompute < 0) {
        return withAchievementUnlocks({
          compute: 0,
          isShutdown: true,
          emergencyClicks: 0,
          totalEarnedCompute: s.totalEarnedCompute + contractIncome,
          hardware,
          procurementRequests,
          auditEvents,
          nextAuditAt,
          failedAudits,
          satisfaction,
          metrics,
          gameTime: nextGameTime,
          ...contractState,
        });
      }

      const earned = (metrics.netCPS > 0 ? metrics.netCPS * dt : 0) + contractIncome;
      return withAchievementUnlocks({
        compute: newCompute,
        totalEarnedCompute: s.totalEarnedCompute + earned,
        hardware,
        procurementRequests,
        auditEvents,
        nextAuditAt,
        failedAudits,
        satisfaction,
        metrics,
        gameTime: nextGameTime,
        ...contractState,
      });
    });
  },

  saveGame: () => {
    const s = get();
    saveToStorage({
      version: GAME_VERSION,
      compute: s.compute,
      totalEarnedCompute: s.totalEarnedCompute,
      hardware: s.hardware,
      procurementRequests: s.procurementRequests,
      auditEvents: s.auditEvents,
      nextAuditAt: s.nextAuditAt,
      resolvedAudits: s.resolvedAudits,
      failedAudits: s.failedAudits,
      contracts: s.contracts,
      contractOffers: s.contractOffers,
      nextContractOfferAt: s.nextContractOfferAt,
      completedContracts: s.completedContracts,
      breachedContracts: s.breachedContracts,
      totalContractsSigned: s.totalContractsSigned,
      totalContractRevenue: s.totalContractRevenue,
      rackCapacity: s.rackCapacity,
      facilityRegions: s.facilityRegions,
      pueLevel: s.pueLevel,
      isShutdown: s.isShutdown,
      emergencyClicks: s.emergencyClicks,
      satisfaction: s.satisfaction,
      reputation: s.reputation,
      totalEarnedReputation: s.totalEarnedReputation,
      influence: s.influence,
      prestigeCount: s.prestigeCount,
      lastSaveTime: Date.now(),
      gameTime: s.gameTime,
      unlockedAchievements: s.unlockedAchievements,
      techNodes: s.techNodes,
    });
  },

  loadGame: () => {
    const raw = loadFromStorage();
    if (!raw) return;
    const data = migrateSave(raw);

    const hardware = normalizeHardware(data.hardware ?? {});
    const procurementRequests = normalizeProcurementRequests(data.procurementRequests);
    const auditEvents = normalizeAuditEvents(data.auditEvents);
    const contracts = normalizeContracts(data.contracts);
    const contractOffers = normalizeContractOffers(data.contractOffers);
    const pueLevel = clampInteger(data.pueLevel, INITIAL_STATE.pueLevel, 0, MAX_PUE_LEVEL_V02);
    const facilityRegions = normalizeFacilityRegions(data.facilityRegions, data.rackCapacity);
    const techNodeIds = Array.isArray(data.techNodes) ? data.techNodes : [];
    const rackCapacity = calcEffectiveRackCapacity(facilityRegions, techNodeIds);
    const reputation = clampNumber(data.reputation, INITIAL_STATE.reputation, 0, Number.MAX_SAFE_INTEGER);
    const totalEarnedReputation = clampNumber(data.totalEarnedReputation, reputation, 0, Number.MAX_SAFE_INTEGER);
    const techEffects = calcTechEffects(techNodeIds);
    const influence = clampNumber(data.influence, INITIAL_STATE.influence, 0, Number.MAX_SAFE_INTEGER);
    const cpsMultiplier = calcGlobalCpsMultiplier(facilityRegions, reputation, influence, techNodeIds);
    const lastSaveTime = clampNumber(data.lastSaveTime, Date.now(), 0, Date.now());
    const report = calcOfflineEarnings(hardware, pueLevel, lastSaveTime, Boolean(data.isShutdown), cpsMultiplier, techEffects.powerCostMultiplier);
    const newCompute = clampNumber(data.compute, INITIAL_STATE.compute, 0, Number.MAX_SAFE_INTEGER) + report.earnings;

    const metrics = computeTickMetrics(hardware, pueLevel, cpsMultiplier, techEffects.powerCostMultiplier);

    set({
      compute: newCompute,
      totalEarnedCompute: clampNumber(data.totalEarnedCompute, INITIAL_STATE.totalEarnedCompute, 0, Number.MAX_SAFE_INTEGER) + report.earnings,
      hardware,
      procurementRequests,
      auditEvents,
      rackCapacity,
      facilityRegions,
      pueLevel,
      isShutdown: Boolean(data.isShutdown),
      emergencyClicks: clampInteger(data.emergencyClicks, 0, 0, 10),
      shutdownBuffer: 0,
      satisfaction: clampNumber(data.satisfaction, INITIAL_STATE.satisfaction, 0, 100),
      reputation,
      totalEarnedReputation,
      influence,
      prestigeCount: clampInteger(data.prestigeCount, INITIAL_STATE.prestigeCount, 0, Number.MAX_SAFE_INTEGER),
      nextAuditAt: clampNumber(data.nextAuditAt, calcInitialAuditAt(data.gameTime ?? 0), 0, Number.MAX_SAFE_INTEGER),
      resolvedAudits: clampInteger(data.resolvedAudits, 0, 0, Number.MAX_SAFE_INTEGER),
      failedAudits: clampInteger(data.failedAudits, 0, 0, Number.MAX_SAFE_INTEGER),
      contracts,
      contractOffers,
      nextContractOfferAt: clampNumber(data.nextContractOfferAt, calcInitialContractOfferAt(data.gameTime ?? 0), 0, Number.MAX_SAFE_INTEGER),
      completedContracts: clampInteger(data.completedContracts, 0, 0, Number.MAX_SAFE_INTEGER),
      breachedContracts: clampInteger(data.breachedContracts, 0, 0, Number.MAX_SAFE_INTEGER),
      totalContractsSigned: clampInteger(data.totalContractsSigned, 0, 0, Number.MAX_SAFE_INTEGER),
      totalContractRevenue: clampNumber(data.totalContractRevenue, 0, 0, Number.MAX_SAFE_INTEGER),
      lastSaveTime,
      gameTime: clampNumber(data.gameTime, INITIAL_STATE.gameTime, 0, Number.MAX_SAFE_INTEGER),
      unlockedAchievements: normalizeAchievementIds(data.unlockedAchievements),
      recentAchievementIds: [],
      techNodes: techNodeIds,
      metrics,
      offlineReport: report.elapsed > 5 ? report : null,
    });
  },

  newGame: () => {
    const hardware = defaultHardware();
    const facilityRegions = createDefaultFacilityRegions();
    set({
      ...INITIAL_STATE,
      hardware,
      procurementRequests: [],
      facilityRegions,
      rackCapacity: calcEffectiveRackCapacity(facilityRegions, INITIAL_STATE.techNodes),
      lastSaveTime: Date.now(),
      metrics: emptyMetrics,
      offlineReport: null,
      emergencyClicks: 0,
      shutdownBuffer: 0,
      auditEvents: [],
      nextAuditAt: calcInitialAuditAt(0),
      resolvedAudits: 0,
      failedAudits: 0,
      contracts: [],
      contractOffers: [],
      nextContractOfferAt: calcInitialContractOfferAt(0),
      completedContracts: 0,
      breachedContracts: 0,
      totalContractsSigned: 0,
      totalContractRevenue: 0,
      recentAchievementIds: [],
    });
  },

  dismissOfflineReport: () => set({ offlineReport: null }),
}));
