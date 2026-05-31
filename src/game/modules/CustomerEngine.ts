import type {
  EntityId, GameConfig, GameDate, IEventBus, IGameModule, Money,
  NamedCustomer, CustomerConfig, CustomerIndustry,
} from '../core/types';

const DEFAULT_CUSTOMER_CONFIG: CustomerConfig = {
  referralCheckMonths: 3,
  xlChurnReputationPenalty: 8,
  sChurnReputationPenalty: 2,
  surveyMonth: 12,
  loyaltyRenewalBonus: 0.15,
};

const CUSTOMER_TEMPLATES: Array<Omit<NamedCustomer, 'id' | 'status' | 'contractIds' | 'totalRevenue' | 'lastSurveyScore' | 'acquisitionDate' | 'monthsAsCustomer'>> = [
  { name: '台北市政府', industry: 'government', size: 'XL', loyaltyScore: 50, referralChance: 0.15 },
  { name: '新北市政府', industry: 'government', size: 'L', loyaltyScore: 50, referralChance: 0.10 },
  { name: '國泰金控', industry: 'finance', size: 'XL', loyaltyScore: 55, referralChance: 0.20 },
  { name: '中信銀行', industry: 'finance', size: 'L', loyaltyScore: 55, referralChance: 0.15 },
  { name: '蝦皮科技', industry: 'ecommerce', size: 'XL', loyaltyScore: 45, referralChance: 0.25 },
  { name: 'momo購物網', industry: 'ecommerce', size: 'L', loyaltyScore: 50, referralChance: 0.20 },
  { name: '台積電', industry: 'manufacturing', size: 'XL', loyaltyScore: 60, referralChance: 0.10 },
  { name: '聯發科技', industry: 'tech', size: 'XL', loyaltyScore: 55, referralChance: 0.15 },
  { name: '長庚醫院', industry: 'healthcare', size: 'L', loyaltyScore: 65, referralChance: 0.12 },
  { name: '台大醫院', industry: 'healthcare', size: 'XL', loyaltyScore: 60, referralChance: 0.10 },
  { name: '遠傳電信', industry: 'tech', size: 'L', loyaltyScore: 50, referralChance: 0.18 },
  { name: '台灣大哥大', industry: 'tech', size: 'L', loyaltyScore: 50, referralChance: 0.18 },
  { name: '統一超商', industry: 'ecommerce', size: 'L', loyaltyScore: 55, referralChance: 0.15 },
  { name: '富邦金控', industry: 'finance', size: 'XL', loyaltyScore: 55, referralChance: 0.20 },
  { name: '衛生福利部', industry: 'government', size: 'L', loyaltyScore: 60, referralChance: 0.08 },
  { name: '玉山銀行', industry: 'finance', size: 'M', loyaltyScore: 60, referralChance: 0.20 },
  { name: '奇美醫院', industry: 'healthcare', size: 'M', loyaltyScore: 65, referralChance: 0.12 },
  { name: '緯創資通', industry: 'manufacturing', size: 'L', loyaltyScore: 50, referralChance: 0.12 },
  { name: '台灣新創加速器', industry: 'tech', size: 'S', loyaltyScore: 40, referralChance: 0.30 },
  { name: '網家股份有限公司', industry: 'ecommerce', size: 'M', loyaltyScore: 50, referralChance: 0.20 },
];

let _seq = 0;
function deterministicRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
function seededRand(): number {
  return deterministicRand(_seq++);
}

const INDUSTRY_ICONS: Record<CustomerIndustry, string> = {
  healthcare: '🏥',
  finance: '🏦',
  tech: '💻',
  government: '🏛️',
  ecommerce: '🛒',
  manufacturing: '🏭',
};

export { INDUSTRY_ICONS };

interface CustomerEngineState {
  customers: NamedCustomer[];
  surveyPendingYear: number | null;
  monthsSinceReferralCheck: number;
}

export class CustomerEngine implements IGameModule {
  readonly moduleId = 'CustomerEngine';

  private bus!: IEventBus;
  private cfg!: CustomerConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };

  private state: CustomerEngineState = {
    customers: [],
    surveyPendingYear: null,
    monthsSinceReferralCheck: 0,
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getCustomers(): NamedCustomer[] {
    return [...this.state.customers];
  }

  getActiveCustomers(): NamedCustomer[] {
    return this.state.customers.filter(c => c.status === 'active');
  }

  getCustomerById(id: EntityId): NamedCustomer | null {
    return this.state.customers.find(c => c.id === id) ?? null;
  }

  getCustomerCount(): number {
    return this.state.customers.filter(c => c.status === 'active').length;
  }

  acquireCustomer(templateIndex: number, contractId: EntityId): NamedCustomer | null {
    const tmpl = CUSTOMER_TEMPLATES[templateIndex % CUSTOMER_TEMPLATES.length];
    const existing = this.state.customers.find(c => c.name === tmpl.name && c.status === 'active');
    if (existing) {
      existing.contractIds.push(contractId);
      return existing;
    }
    const customer: NamedCustomer = {
      id: crypto.randomUUID(),
      name: tmpl.name,
      industry: tmpl.industry,
      size: tmpl.size,
      loyaltyScore: tmpl.loyaltyScore,
      monthsAsCustomer: 0,
      referralChance: tmpl.referralChance,
      status: 'active',
      contractIds: [contractId],
      totalRevenue: 0,
      lastSurveyScore: null,
      acquisitionDate: { ...this.currentDate },
    };
    this.state.customers.push(customer);
    this.bus.publish({
      type: 'customer.acquired',
      payload: { customerId: customer.id, name: customer.name, size: customer.size, industry: customer.industry },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
    return customer;
  }

  addRevenue(customerId: EntityId, amount: Money): void {
    const c = this.state.customers.find(c => c.id === customerId);
    if (c) c.totalRevenue += amount;
  }

  churnCustomer(customerId: EntityId): void {
    const c = this.state.customers.find(c => c.id === customerId);
    if (!c || c.status === 'churned') return;
    c.status = 'churned';
    const penalty = c.size === 'XL' ? this.cfg.xlChurnReputationPenalty
      : c.size === 'L' ? 5
      : c.size === 'M' ? 3
      : this.cfg.sChurnReputationPenalty;
    this.bus.publish({
      type: 'customer.churned',
      payload: { customerId: c.id, name: c.name, size: c.size, reputationPenalty: penalty },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  updateLoyalty(customerId: EntityId, delta: number): void {
    const c = this.state.customers.find(c => c.id === customerId);
    if (c) c.loyaltyScore = Math.max(0, Math.min(100, c.loyaltyScore + delta));
  }

  getCustomerTemplates() {
    return CUSTOMER_TEMPLATES;
  }

  getIndustryIcon(industry: CustomerIndustry): string {
    return INDUSTRY_ICONS[industry] ?? '🏢';
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.customer ?? DEFAULT_CUSTOMER_CONFIG;
    this.currentDate = { ...config.time.startDate };

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
      this.onMonthEnd();
    }, this.moduleId);

    bus.subscribe('contract.signed', (e) => {
      const p = e.payload as { contractId?: EntityId; clientName?: string };
      if (p.contractId) this.onContractSigned(p.contractId, p.clientName ?? '');
    }, this.moduleId);

    bus.subscribe('contract.completed', (e) => {
      const p = e.payload as { contractId?: EntityId; clientName?: string };
      if (p.contractId) this.onContractCompleted(p.contractId);
    }, this.moduleId);

    bus.subscribe('contract.churned', (e) => {
      const p = e.payload as { contractId?: EntityId; clientName?: string };
      if (p.contractId) this.onContractLost(p.contractId);
    }, this.moduleId);

    bus.subscribe('reputation.satisfaction_changed', (e) => {
      const p = e.payload as { score?: number; delta?: number };
      if (p.delta && p.delta > 5) {
        // High satisfaction → boost loyalty for all customers
        for (const c of this.state.customers.filter(c2 => c2.status === 'active')) {
          c.loyaltyScore = Math.min(100, c.loyaltyScore + 1);
        }
      }
    }, this.moduleId);
  }

  tick(_deltaMs: number): void { /* month-based logic */ }

  serialize(): Record<string, unknown> {
    return {
      customers: this.state.customers,
      surveyPendingYear: this.state.surveyPendingYear,
      monthsSinceReferralCheck: this.state.monthsSinceReferralCheck,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    if (saved.customers) this.state.customers = saved.customers as NamedCustomer[];
    if (saved.surveyPendingYear !== undefined) this.state.surveyPendingYear = saved.surveyPendingYear as number | null;
    if (typeof saved.monthsSinceReferralCheck === 'number') this.state.monthsSinceReferralCheck = saved.monthsSinceReferralCheck;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      customers: this.state.customers,
      activeCount: this.getCustomerCount(),
    });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private onMonthEnd(): void {
    // Age all active customers
    for (const c of this.state.customers.filter(c => c.status === 'active')) {
      c.monthsAsCustomer++;
    }

    this.state.monthsSinceReferralCheck++;

    // Referral check every N months
    if (this.state.monthsSinceReferralCheck >= this.cfg.referralCheckMonths) {
      this.state.monthsSinceReferralCheck = 0;
      this.checkReferrals();
    }

    // Annual satisfaction survey in December
    if (this.currentDate.month === this.cfg.surveyMonth) {
      this.runSatisfactionSurvey();
    }
  }

  private checkReferrals(): void {
    const longTermCustomers = this.state.customers.filter(
      c => c.status === 'active' && c.monthsAsCustomer >= 12,
    );
    for (const c of longTermCustomers) {
      if (seededRand() < c.referralChance * 0.10) {
        // Pick a template not already active
        const activeNames = new Set(this.state.customers.filter(x => x.status === 'active').map(x => x.name));
        const available = CUSTOMER_TEMPLATES.filter(t => !activeNames.has(t.name));
        if (available.length === 0) continue;
        const idx = Math.floor(seededRand() * available.length);
        const tmpl = available[idx];
        this.bus.publish({
          type: 'customer.referral_available',
          payload: {
            referrerId: c.id,
            referrerName: c.name,
            prospectName: tmpl.name,
            prospectIndustry: tmpl.industry,
            prospectSize: tmpl.size,
          },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }
  }

  private runSatisfactionSurvey(): void {
    const active = this.state.customers.filter(c => c.status === 'active');
    for (const c of active) {
      // Survey score is loyalty-based with some noise
      const noise = (seededRand() - 0.5) * 20;
      const score = Math.max(0, Math.min(100, c.loyaltyScore + noise));
      c.lastSurveyScore = Math.round(score);
      if (score < 40 && c.monthsAsCustomer < 24) {
        // Low satisfaction → churn risk
        if (seededRand() < 0.30) {
          this.churnCustomer(c.id);
        }
      }
    }
    this.bus.publish({
      type: 'customer.survey_completed',
      payload: {
        year: this.currentDate.year,
        surveyedCount: active.length,
        avgScore: active.length > 0
          ? Math.round(active.reduce((s, c) => s + (c.lastSurveyScore ?? c.loyaltyScore), 0) / active.length)
          : 0,
      },
      source: this.moduleId,
      gameDate: this.currentDate,
    });
  }

  private onContractSigned(contractId: EntityId, clientName: string): void {
    // Try to match with a template by name
    const tmplIdx = CUSTOMER_TEMPLATES.findIndex(t => t.name === clientName);
    if (tmplIdx !== -1) {
      this.acquireCustomer(tmplIdx, contractId);
    } else {
      // Generic customer — use rotating template
      const idx = Math.floor(seededRand() * CUSTOMER_TEMPLATES.length);
      this.acquireCustomer(idx, contractId);
    }
  }

  private onContractCompleted(contractId: EntityId): void {
    const c = this.state.customers.find(c => c.contractIds.includes(contractId));
    if (c) {
      c.loyaltyScore = Math.min(100, c.loyaltyScore + 5);
      c.contractIds = c.contractIds.filter(id => id !== contractId);
    }
  }

  private onContractLost(contractId: EntityId): void {
    const c = this.state.customers.find(c => c.contractIds.includes(contractId));
    if (c) {
      c.contractIds = c.contractIds.filter(id => id !== contractId);
      if (c.contractIds.length === 0) {
        this.churnCustomer(c.id);
      }
    }
  }
}
