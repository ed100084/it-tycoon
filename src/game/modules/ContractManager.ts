import { addMonths, monthsBetween, gameDateLte } from '../../utils/gameDate';
import {
  ContractStatus,
  CustomerTier,
  ServiceType,
} from '../core/types';
import type {
  BidParams,
  BidSubmission,
  Contract,
  ContractModuleConfig,
  EntityId,
  FeasibilityReport,
  GameConfig,
  GameDate,
  IEventBus,
  IGameModule,
  Money,
  RFP,
  SLADashboard,
  SLAMonthRecord,
  SpecialRequirement,
} from '../core/types';

// ─── Default config fallback ──────────────────────────────────────────────────

const DEFAULT_CONTRACT_CONFIG: ContractModuleConfig = {
  rfpResponseWindowMonths: 1,
  renewalNoticeMonths: 1,
  baseRFPsPerMonth: 1.5,
  maxMonthlyPenaltyCap: 3.0,
  churnProbabilities: {
    dataBreachAndLate: 0.70,
    consecutiveSLABreach: 0.50,
    p1Over24Hours: 0.40,
    lowSatisfactionProlonged: 0.30,
    competitorOffer: 0.20,
  },
};

// ─── Client name pools ────────────────────────────────────────────────────────

const SMB_NAMES = [
  '大安資訊', '松山科技', '信義軟體', '中山網路', '文山商貿',
  '南港電商', '士林IT', '萬華數位', '北投雲端', '木柵系統',
];
const ENTERPRISE_NAMES = [
  '台灣金融控股', '中華製造集團', '聯合科技公司', '亞太資產管理',
  '遠東醫療系統', '兆豐資訊服務', '富邦數位科技', '國泰智慧雲',
];
const GOVERNMENT_NAMES = [
  '台北市政府資訊局', '財政部資訊中心', '衛生福利部', '國防部資訊署',
  '教育部數位化', '行政院資訊服務', '勞動部資訊處',
];

function pickRandom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// ─── Internal state ───────────────────────────────────────────────────────────

interface ContractManagerState {
  contracts: Contract[];
  pendingRFPs: RFP[];
  pendingBids: BidSubmission[];
  rfpFrequencyMod: number;
  creditRatingBonus: number;
  satisfactionBonus: number;
  availableUnits: number;
  geoRedundancyActive: boolean;
  rfpSeed: number;
}

// ─── ContractManager ─────────────────────────────────────────────────────────

export class ContractManager implements IGameModule {
  readonly moduleId = 'ContractManager';

  private bus!: IEventBus;
  private cfg!: ContractModuleConfig;
  private currentDate!: GameDate;

  private state: ContractManagerState = {
    contracts: [],
    pendingRFPs: [],
    pendingBids: [],
    rfpFrequencyMod: 1.0,
    creditRatingBonus: 1.0,
    satisfactionBonus: 1.0,
    availableUnits: 0,
    geoRedundancyActive: false,
    rfpSeed: 42,
  };

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.contract ?? DEFAULT_CONTRACT_CONFIG;
    this.currentDate = { ...config.time.startDate };

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
      this.onMonthEnd();
    }, this.moduleId);

    bus.subscribe('facility.geo_redundancy_changed', (e) => {
      const p = e.payload as { active: boolean };
      this.state.geoRedundancyActive = p.active;
    }, this.moduleId);

    bus.subscribe('finance.credit_rating_changed', (e) => {
      const p = e.payload as { rating: string };
      const bonusMap: Record<string, number> = {
        AAA: 1.3, AA: 1.2, A: 1.1, BBB: 1.0, BB: 0.8, B: 0.5, INSOLVENT: 0.1,
      };
      this.state.creditRatingBonus = bonusMap[p.rating] ?? 1.0;
    }, this.moduleId);

    bus.subscribe('hardware.installed', () => {
      this.state.availableUnits++;
    }, this.moduleId);

    bus.subscribe('hardware.removed', () => {
      this.state.availableUnits = Math.max(0, this.state.availableUnits - 1);
    }, this.moduleId);
  }

  tick(_deltaMs: number): void {}

  // ── Private helpers ───────────────────────────────────────────────

  private onMonthEnd(): void {
    this.processMonthlyRevenue();
    this.processBidResults();
    this.checkContractExpiryWarnings();
    this.checkContractExpirations();
    this.expireOldRFPs();
    this.generateRFPs();
  }

  private processMonthlyRevenue(): void {
    let totalRevenue = 0;
    for (const contract of this.state.contracts) {
      if (contract.status !== ContractStatus.Active) continue;
      const amount = contract.monthlyFeeNTD;
      contract.totalRevenue += amount;
      totalRevenue += amount;

      const slaRecord: SLAMonthRecord = {
        date: this.currentDate,
        uptimePercent: 100,
        slaBreached: false,
        penaltyAmount: 0,
        incidentIds: [],
      };
      contract.slaRecord.push(slaRecord);

      this.bus.publish({
        type: 'contract.revenue_collected',
        payload: { contractId: contract.id, amount, date: this.currentDate },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
      this.bus.publish({
        type: 'finance.income_recorded',
        payload: {
          type: contract.serviceType,
          contractId: contract.id,
          amount,
          date: this.currentDate,
          description: `Monthly fee — ${contract.clientName}`,
        },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }

    this.bus.publish({
      type: 'finance.monthly_settlement',
      payload: { totalRevenue },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  private processBidResults(): void {
    const resolved = this.state.pendingBids.filter(b =>
      gameDateLte(b.resultExpectedAt, this.currentDate),
    );
    for (const bid of resolved) {
      this.state.pendingBids = this.state.pendingBids.filter(b => b.rfpId !== bid.rfpId);
      const rfp = this.state.pendingRFPs.find(r => r.id === bid.rfpId);
      if (!rfp) continue;
      this.state.pendingRFPs = this.state.pendingRFPs.filter(r => r.id !== bid.rfpId);

      const won = Math.random() < bid.winProbability;
      if (won) {
        const contract = this.createContract(rfp, bid.bid);
        this.state.contracts.push(contract);
        this.bus.publish({
          type: 'contract.bid_won',
          payload: { rfpId: bid.rfpId, contract },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
        this.bus.publish({
          type: 'contract.signed',
          payload: contract,
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      } else {
        this.bus.publish({
          type: 'contract.bid_lost',
          payload: { rfpId: bid.rfpId, reason: 'Outbid by competitor' },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }
  }

  private createContract(rfp: RFP, bid: BidParams): Contract {
    const startDate = this.currentDate;
    const endDate = addMonths(startDate, bid.contractDurationMonths);
    return {
      id: crypto.randomUUID() as EntityId,
      clientId: rfp.clientId,
      clientName: rfp.clientName,
      clientTier: rfp.clientTier,
      serviceType: rfp.serviceType,
      status: ContractStatus.Active,
      monthlyFeeNTD: bid.monthlyFeeNTD,
      slaLevel: bid.slaLevel,
      startDate,
      endDate,
      renewalNoticeMonths: this.cfg.renewalNoticeMonths,
      breachPenaltyMultiplier: bid.breachPenaltyMultiplier,
      specialServices: bid.specialServices,
      slaRecord: [],
      clientSatisfaction: 80,
      totalRevenue: 0,
      totalPenaltiesPaid: 0,
    };
  }

  private checkContractExpiryWarnings(): void {
    for (const contract of this.state.contracts) {
      if (contract.status !== ContractStatus.Active) continue;
      const months = monthsBetween(this.currentDate, contract.endDate);
      if (months === this.cfg.renewalNoticeMonths) {
        this.bus.publish({
          type: 'contract.expiry_warning',
          payload: { contractId: contract.id, monthsUntilExpiry: months },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
        this.bus.publish({
          type: 'contract.renewal_decision',
          payload: { contractId: contract.id },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }
  }

  private checkContractExpirations(): void {
    for (const contract of this.state.contracts) {
      if (contract.status !== ContractStatus.Active) continue;
      if (gameDateLte(contract.endDate, this.currentDate)) {
        contract.status = ContractStatus.Expired;
        this.bus.publish({
          type: 'contract.expired',
          payload: { contractId: contract.id, clientId: contract.clientId },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }
  }

  private expireOldRFPs(): void {
    this.state.pendingRFPs = this.state.pendingRFPs.filter(rfp => {
      const expired = gameDateLte(rfp.expiresAt, this.currentDate);
      return !expired;
    });
  }

  private generateRFPs(): void {
    const rate =
      this.cfg.baseRFPsPerMonth *
      this.state.rfpFrequencyMod *
      this.state.creditRatingBonus *
      this.state.satisfactionBonus;

    const count = Math.random() < (rate % 1) ? Math.ceil(rate) : Math.floor(rate);
    for (let i = 0; i < count; i++) {
      const rfp = this.buildRFP(i);
      this.state.pendingRFPs.push(rfp);
      this.bus.publish({
        type: 'contract.rfp_received',
        payload: rfp,
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private buildRFP(idx: number): RFP {
    const seed = ++this.state.rfpSeed + idx;
    const year = this.currentDate.year;

    // Tier distribution by era
    let tier: CustomerTier;
    const r = seed % 100;
    if (year >= 2010) {
      tier = r < 40 ? CustomerTier.Enterprise : r < 70 ? CustomerTier.Government : CustomerTier.SMB;
    } else if (year >= 2005) {
      tier = r < 50 ? CustomerTier.SMB : r < 85 ? CustomerTier.Enterprise : CustomerTier.Government;
    } else {
      tier = r < 80 ? CustomerTier.SMB : CustomerTier.Enterprise;
    }

    const tierNames = {
      [CustomerTier.SMB]: SMB_NAMES,
      [CustomerTier.Enterprise]: ENTERPRISE_NAMES,
      [CustomerTier.Government]: GOVERNMENT_NAMES,
      [CustomerTier.Individual]: SMB_NAMES,
      [CustomerTier.Multinational]: ENTERPRISE_NAMES,
    };
    const clientName = pickRandom(tierNames[tier], seed);

    const serviceTypes = [ServiceType.Colocation, ServiceType.VPS, ServiceType.Bandwidth];
    const serviceType = pickRandom(serviceTypes, seed + 3);

    const slaRequirement = r < 60 ? 99.5 : r < 85 ? 99.9 : 99.95;
    const durationMonths = pickRandom([12, 24, 36], seed + 7);

    const baseMin = tier === CustomerTier.Enterprise ? 100_000
      : tier === CustomerTier.Government ? 200_000
      : 30_000;
    const budgetMin = baseMin * (1 + (seed % 3) * 0.5);
    const budgetMax = budgetMin * 2;

    const specialReqs: SpecialRequirement[] = [];
    if (tier === CustomerTier.Government || tier === CustomerTier.Enterprise) {
      specialReqs.push({
        type: 'iso27001',
        description: 'ISO 27001 認證要求',
        isMet: false,
      });
    }

    const feasibility: FeasibilityReport = {
      spaceOk: this.state.availableUnits > 0,
      techStackOk: true,
      staffOk: true,
      slaAchievable: slaRequirement <= 99.9,
      missingRequirements: [],
    };

    return {
      id: crypto.randomUUID() as EntityId,
      clientId: crypto.randomUUID() as EntityId,
      clientName,
      clientTier: tier,
      serviceType,
      budgetRange: { min: Math.round(budgetMin), max: Math.round(budgetMax) },
      contractDurationMonths: durationMonths,
      slaRequirement,
      specialRequirements: specialReqs,
      expiresAt: addMonths(this.currentDate, this.cfg.rfpResponseWindowMonths),
      estimatedFeasibility: feasibility,
      competitorPresence: seed % 3 === 0,
      generatedDate: this.currentDate,
    };
  }

  private calcWinProbability(rfp: RFP, bid: BidParams): number {
    let prob = 0.6;
    // Price competitiveness
    if (bid.monthlyFeeNTD <= rfp.budgetRange.min) prob += 0.15;
    else if (bid.monthlyFeeNTD > rfp.budgetRange.max) prob -= 0.3;
    // SLA match
    if (bid.slaLevel >= rfp.slaRequirement) prob += 0.10;
    else prob -= 0.20;
    // Competitor
    if (rfp.competitorPresence) prob -= 0.15;
    // Geo redundancy bonus
    if (this.state.geoRedundancyActive) prob += 0.10;
    return Math.max(0.05, Math.min(0.95, prob));
  }

  // ── Public API ────────────────────────────────────────────────────

  getActiveContracts(): Contract[] {
    return this.state.contracts.filter(c => c.status === ContractStatus.Active);
  }

  getContract(contractId: EntityId): Contract | null {
    return this.state.contracts.find(c => c.id === contractId) ?? null;
  }

  getPendingRFPs(): RFP[] {
    return this.state.pendingRFPs;
  }

  getRFP(rfpId: EntityId): RFP | null {
    return this.state.pendingRFPs.find(r => r.id === rfpId) ?? null;
  }

  submitBid(rfpId: EntityId, bid: BidParams): BidSubmission {
    const rfp = this.state.pendingRFPs.find(r => r.id === rfpId);
    if (!rfp) throw new Error(`RFP not found: ${rfpId}`);

    const submission: BidSubmission = {
      rfpId,
      bid,
      submittedAt: this.currentDate,
      resultExpectedAt: addMonths(this.currentDate, this.cfg.rfpResponseWindowMonths),
      winProbability: this.calcWinProbability(rfp, bid),
    };
    this.state.pendingBids.push(submission);
    return submission;
  }

  declineRFP(rfpId: EntityId): void {
    this.state.pendingRFPs = this.state.pendingRFPs.filter(r => r.id !== rfpId);
  }

  renewContract(contractId: EntityId, params: { newMonthlyFeeNTD: Money; newDurationMonths: number; newSlaLevel?: number }): Contract {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (!contract) throw new Error(`Contract not found: ${contractId}`);
    contract.monthlyFeeNTD = params.newMonthlyFeeNTD;
    contract.endDate = addMonths(this.currentDate, params.newDurationMonths);
    if (params.newSlaLevel !== undefined) contract.slaLevel = params.newSlaLevel;
    contract.status = ContractStatus.Active;
    this.bus.publish({
      type: 'contract.renewed',
      payload: contract,
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    return contract;
  }

  declineRenewal(contractId: EntityId): void {
    const contract = this.state.contracts.find(c => c.id === contractId);
    if (contract) {
      contract.status = ContractStatus.Expired;
      this.bus.publish({
        type: 'contract.expired',
        payload: { contractId: contract.id, clientId: contract.clientId },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  getMonthlyRevenueEstimate(): Money {
    return this.state.contracts
      .filter(c => c.status === ContractStatus.Active)
      .reduce((sum, c) => sum + c.monthlyFeeNTD, 0);
  }

  getSLADashboard(): SLADashboard {
    const active = this.getActiveContracts();
    let totalUptime = 0;
    let contractCount = 0;

    const atRiskContracts = [];
    for (const c of active) {
      if (c.slaRecord.length === 0) continue;
      const recent = c.slaRecord.slice(-3);
      const avgUptime = recent.reduce((s, r) => s + r.uptimePercent, 0) / recent.length;
      totalUptime += avgUptime;
      contractCount++;
      if (avgUptime < c.slaLevel) {
        atRiskContracts.push({
          contractId: c.id,
          clientName: c.clientName,
          monthlyFee: c.monthlyFeeNTD,
          slaRate: avgUptime,
        });
      }
    }

    return {
      overallSLARate: contractCount > 0 ? totalUptime / contractCount : 100,
      atRiskContracts,
      monthlySLASummary: [],
    };
  }

  getContractHistory(limit = 50): Contract[] {
    return this.state.contracts.slice(-limit);
  }

  getActiveContractCount(): number {
    return this.state.contracts.filter(c => c.status === ContractStatus.Active).length;
  }

  // ── IGameModule ───────────────────────────────────────────────────

  serialize(): Record<string, unknown> {
    return {
      contracts: this.state.contracts,
      pendingRFPs: this.state.pendingRFPs,
      pendingBids: this.state.pendingBids,
      rfpFrequencyMod: this.state.rfpFrequencyMod,
      creditRatingBonus: this.state.creditRatingBonus,
      satisfactionBonus: this.state.satisfactionBonus,
      availableUnits: this.state.availableUnits,
      geoRedundancyActive: this.state.geoRedundancyActive,
      rfpSeed: this.state.rfpSeed,
      currentDate: this.currentDate,
    };
  }

  deserialize(raw: Record<string, unknown>): void {
    const s = raw as unknown as ContractManagerState & { currentDate: GameDate };
    this.state = {
      contracts: s.contracts,
      pendingRFPs: s.pendingRFPs,
      pendingBids: s.pendingBids,
      rfpFrequencyMod: s.rfpFrequencyMod,
      creditRatingBonus: s.creditRatingBonus,
      satisfactionBonus: s.satisfactionBonus,
      availableUnits: s.availableUnits,
      geoRedundancyActive: s.geoRedundancyActive,
      rfpSeed: s.rfpSeed,
    };
    if (s.currentDate) this.currentDate = s.currentDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this.state });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }
}
