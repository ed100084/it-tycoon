import { addMonths } from '../../utils/gameDate';
import { EconomicCycle, EventEffectType, IncidentType } from '../core/types';
import type {
  DecisionOutcome,
  EconomicCycleState,
  EntityId,
  EventDecision,
  EventEffect,
  EventTimelineConfig,
  GameConfig,
  GameDate,
  GlobalModifier,
  HistoricalEvent,
  IEventBus,
  IGameModule,
} from '../core/types';

// ─── Seeded random ─────────────────────────────────────────────────────────────

let _randSeed = 100;
function seededRand(): number {
  const x = Math.sin(_randSeed * 9301 + 49297) * 233280;
  _randSeed++;
  return x - Math.floor(x);
}

// ─── Default config ────────────────────────────────────────────────────────────

const DEFAULT_TIMELINE_CONFIG: EventTimelineConfig = {
  economicCycleDurationRange: [8, 15],
  randomEventCooldownRange: [2, 6],
  baseInflationRate: 0.02,
  inflationVolatility: 0.005,
  baseExchangeRate: 30.0,
  exchangeRateMonthlyVolatility: 0.003,
};

// ─── Economic cycle metadata ───────────────────────────────────────────────────

const CYCLE_ORDER: EconomicCycle[] = [
  EconomicCycle.Boom,
  EconomicCycle.Normal,
  EconomicCycle.Recession,
  EconomicCycle.Depression,
  EconomicCycle.Recession,
  EconomicCycle.Normal,
];

const CYCLE_MODIFIERS: Record<EconomicCycle, EconomicCycleState['modifiers']> = {
  [EconomicCycle.Boom]: {
    hardwareCostMod: 1.1,
    electricityMod: 1.1,
    clientBudgetMod: 1.2,
    recruitmentCostMod: 1.2,
  },
  [EconomicCycle.Normal]: {
    hardwareCostMod: 1.0,
    electricityMod: 1.0,
    clientBudgetMod: 1.0,
    recruitmentCostMod: 1.0,
  },
  [EconomicCycle.Recession]: {
    hardwareCostMod: 1.0,
    electricityMod: 1.0,
    clientBudgetMod: 0.8,
    recruitmentCostMod: 0.9,
  },
  [EconomicCycle.Depression]: {
    hardwareCostMod: 0.9,
    electricityMod: 1.0,
    clientBudgetMod: 0.6,
    recruitmentCostMod: 0.7,
  },
};

// ─── Helper to build EventEffect ──────────────────────────────────────────────

function fx(
  effectType: EventEffectType,
  value: number,
  isMultiplier: boolean,
  description: string,
  targetModule = 'global',
  incidentType?: IncidentType,
): EventEffect {
  const e: EventEffect = { targetModule, effectType, value, isMultiplier, description };
  if (incidentType !== undefined) e.incidentType = incidentType;
  return e;
}

// ─── Historical event definitions ─────────────────────────────────────────────

function buildHistoricalEvents(): HistoricalEvent[] {
  return [
    {
      id: 'Y2K_AFTERMATH',
      name: 'Y2K後續整頓',
      year: 2000,
      month: 1,
      description: '千禧蟲危機過後，各企業加快IT系統整頓採購，RFP頻率上升。',
      isForced: true,
      durationMonths: 6,
      effects: [
        fx(EventEffectType.RFPFrequencyMod, 1.3, true, 'Y2K後RFP需求提升30%'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'DOTCOM_PEAK',
      name: '網路泡沫高峰',
      year: 2000,
      month: 3,
      description: '網路熱潮顛峰，VPS需求暴增，合約金額大幅上揚。',
      isForced: true,
      durationMonths: 12,
      effects: [
        fx(EventEffectType.ContractValueMod, 1.5, true, '網路泡沫高峰：VPS合約金額提升50%'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'DOTCOM_CRASH',
      name: '網路泡沫崩潰',
      year: 2001,
      month: 3,
      description: '網路泡沫破裂，客戶預算大幅縮減，經濟陷入衰退。',
      isForced: true,
      durationMonths: 18,
      effects: [
        fx(EventEffectType.ClientBudgetMod, 0.6, true, '泡沫崩潰：客戶預算下降40%'),
        fx(EventEffectType.EconomicCycle, 0, false, '觸發經濟衰退'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'NINE_ELEVEN',
      name: '911恐怖攻擊',
      year: 2001,
      month: 9,
      description: '九一一事件後，全球資安威脅等級大幅提升，災難復原需求激增。',
      isForced: true,
      durationMonths: 12,
      effects: [
        fx(EventEffectType.ThreatLevelMod, 2.0, true, '911後威脅等級倍增'),
        fx(EventEffectType.RFPFrequencyMod, 1.5, true, '災難復原RFP需求提升50%'),
      ],
      decisions: [
        {
          prompt: '緊急擴充資安防禦預算？',
          options: [
            {
              label: '立即撥款 NT$2M 資安預算',
              description: '立即投入 NT$200萬 強化資安防線，降低威脅影響。',
              effects: [
                fx(EventEffectType.ThreatLevelMod, 0.7, true, '資安投資降低威脅乘數', 'security'),
              ],
            },
            {
              label: '暫緩觀望',
              description: '保留現金，觀望後續局勢發展。',
              effects: [],
            },
          ],
          defaultOptionIndex: 1,
          decisionWindowMonths: 2,
        },
      ],
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'SARS',
      name: 'SARS疫情',
      year: 2003,
      month: 3,
      description: 'SARS疫情爆發，員工效率下降，遠端辦公需求升溫。',
      isForced: true,
      durationMonths: 6,
      effects: [
        fx(EventEffectType.StaffEfficiencyMod, 0.8, true, 'SARS導致員工效率下降20%', 'staff'),
      ],
      decisions: [
        {
          prompt: 'SARS 影響員工效率，是否實施遠端辦公？',
          options: [
            {
              label: '推行遠端辦公',
              description: '導入遠端工作模式，維持員工安全與部分效率。',
              effects: [
                fx(EventEffectType.StaffEfficiencyMod, 1.1, true, '遠端辦公緩解SARS效率損失', 'staff'),
              ],
            },
            {
              label: '維持現況',
              description: '維持現場辦公，接受效率損失。',
              effects: [],
            },
          ],
          defaultOptionIndex: 1,
          decisionWindowMonths: 1,
        },
      ],
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'SOX_AUDIT',
      name: 'SOX法規稽核',
      year: 2004,
      month: 8,
      description: '沙賓法案正式實施，合規要求永久提升一級。',
      isForced: true,
      durationMonths: 0,
      effects: [
        fx(EventEffectType.BaseInterestRate, 1, false, 'SOX法規：合規要求永久+1', 'compliance'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'LEHMAN',
      name: '雷曼兄弟倒閉',
      year: 2008,
      month: 9,
      description: '全球金融海嘯，客戶預算驟降，經濟陷入蕭條。',
      isForced: true,
      durationMonths: 24,
      effects: [
        fx(EventEffectType.ClientBudgetMod, 0.65, true, '金融海嘯：客戶預算下降35%'),
        fx(EventEffectType.EconomicCycle, 0, false, '觸發經濟蕭條'),
      ],
      decisions: [
        {
          prompt: '金融海嘯：縮減IT支出或維持服務品質？',
          options: [
            {
              label: '維持服務，接受虧損',
              description: '維持完整服務品質，承受短期虧損以保住客戶。',
              effects: [],
            },
            {
              label: '縮減30%支出',
              description: '削減30%營運支出，以度過金融危機。',
              effects: [
                fx(EventEffectType.RecruitmentCostMod, 0.7, true, '縮減開支：招聘成本降低30%', 'staff'),
                fx(EventEffectType.StaffEfficiencyMod, 0.85, true, '縮減開支：員工效率略降', 'staff'),
              ],
            },
          ],
          defaultOptionIndex: 0,
          decisionWindowMonths: 2,
        },
      ],
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'AWS_SCALE',
      name: 'AWS大規模擴張',
      year: 2010,
      month: 1,
      description: 'AWS大規模商業化，雲端定價天花板永久壓低VPS合約價值。',
      isForced: true,
      durationMonths: 0,
      effects: [
        fx(EventEffectType.ContractValueMod, 0.8, true, 'AWS競爭：VPS合約價值永久下降20%'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'JAPAN_311',
      name: '日本311大地震',
      year: 2011,
      month: 3,
      description: '東日本大震災引發供應鏈斷鏈，硬體成本上升，DRaaS需求暴增。',
      isForced: true,
      durationMonths: 12,
      effects: [
        fx(EventEffectType.HardwareCostMod, 1.4, true, '311後硬體供應鏈斷鏈成本+40%', 'hardware'),
        fx(EventEffectType.RFPFrequencyMod, 1.8, true, 'DRaaS需求因311提升80%'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'SNOWDEN',
      name: '史諾登事件',
      year: 2013,
      month: 6,
      description: '史諾登揭露美國監控計畫，企業轉向本地機房，RFP頻率提升。',
      isForced: true,
      durationMonths: 36,
      effects: [
        fx(EventEffectType.RFPFrequencyMod, 1.4, true, '史諾登效應：本地機房需求+40%'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'WANNACRY',
      name: 'WannaCry勒索軟體',
      year: 2017,
      month: 5,
      description: 'WannaCry全球蔓延，威脅等級飆升，勒索軟體攻擊頻率暴增五倍。',
      isForced: true,
      durationMonths: 3,
      effects: [
        fx(EventEffectType.ThreatLevelMod, 3.0, true, 'WannaCry：全球威脅等級×3', 'security'),
        fx(EventEffectType.SpecificThreatMod, 5.0, true, 'WannaCry：勒索軟體威脅×5', 'security', IncidentType.Ransomware),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: true,
    },
    {
      id: 'COVID',
      name: 'COVID-19全球封鎖',
      year: 2020,
      month: 3,
      description: 'COVID疫情全球大流行，遠端辦公與雲端需求爆發，招聘成本下降。',
      isForced: true,
      durationMonths: 18,
      effects: [
        fx(EventEffectType.RFPFrequencyMod, 2.0, true, 'COVID遠端需求：RFP頻率倍增'),
        fx(EventEffectType.RecruitmentCostMod, 0.8, true, 'COVID：招聘成本下降20%', 'staff'),
      ],
      decisions: [
        {
          prompt: 'COVID封鎖：全面遠端辦公或維持現場？',
          options: [
            {
              label: '全面遠端',
              description: '全面轉換遠端辦公，確保員工安全，提升品牌形象。',
              effects: [
                fx(EventEffectType.StaffEfficiencyMod, 0.9, true, '全面遠端辦公效率略降', 'staff'),
                fx(EventEffectType.RecruitmentCostMod, 0.7, true, '遠端辦公吸引人才，招聘成本再降', 'staff'),
              ],
            },
            {
              label: '維持現場服務',
              description: '維持現場機房運作，提供穩定的實體服務。',
              effects: [],
            },
          ],
          defaultOptionIndex: 0,
          decisionWindowMonths: 2,
        },
      ],
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'CHIP_SHORTAGE',
      name: '全球晶片短缺',
      year: 2021,
      month: 1,
      description: '疫情引發全球晶片短缺，硬體成本翻倍，交貨延遲嚴重。',
      isForced: true,
      durationMonths: 18,
      effects: [
        fx(EventEffectType.HardwareCostMod, 2.0, true, '晶片荒：硬體成本倍增', 'hardware'),
        fx(EventEffectType.DeliveryDelayMonths, 3, false, '晶片荒：硬體交貨延遲+3個月', 'hardware'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'UKRAINE_WAR',
      name: '俄烏戰爭',
      year: 2022,
      month: 2,
      description: '俄烏戰爭爆發，能源價格暴漲，網路威脅同步升高。',
      isForced: true,
      durationMonths: 12,
      effects: [
        fx(EventEffectType.ElectricityMod, 1.4, true, '俄烏戰爭：電費上漲40%', 'facility'),
        fx(EventEffectType.ThreatLevelMod, 2.0, true, '俄烏戰爭：網路威脅倍增', 'security'),
      ],
      decisions: [
        {
          prompt: '俄烏戰爭導致電費暴漲，是否鎖定電價合約？',
          options: [
            {
              label: '鎖定長約',
              description: '簽訂長期固定電價合約，規避後續漲價風險。',
              effects: [
                fx(EventEffectType.ElectricityMod, 0.85, true, '鎖定電價合約：電費成本降低15%', 'facility'),
              ],
            },
            {
              label: '繼續浮動計費',
              description: '維持浮動電價，若電費下降可受益。',
              effects: [],
            },
          ],
          defaultOptionIndex: 0,
          decisionWindowMonths: 2,
        },
      ],
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'CHATGPT_BOOM',
      name: 'ChatGPT AI熱潮',
      year: 2023,
      month: 1,
      description: 'ChatGPT引爆AI需求浪潮，AI算力合約價值暴漲，GPU採購成本翻倍。',
      isForced: true,
      durationMonths: 0,
      effects: [
        fx(EventEffectType.ContractValueMod, 3.0, true, 'AI熱潮：AI算力合約價值×3'),
        fx(EventEffectType.HardwareCostMod, 2.0, true, 'AI熱潮：GPU硬體成本倍增', 'hardware'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
    {
      id: 'VMWARE_BROADCOM',
      name: 'VMware被Broadcom收購',
      year: 2023,
      month: 3,
      description: 'Broadcom收購VMware後大幅調漲授權費，軟體成本永久上升。',
      isForced: true,
      durationMonths: 0,
      effects: [
        fx(EventEffectType.SoftwarePriceChange, 2.5, true, 'VMware授權費永久上漲×2.5', 'software'),
      ],
      decisions: undefined,
      status: 'pending',
      triggeredAt: null,
      playerDecision: null,
      isAchievementRelated: false,
    },
  ];
}

// ─── Internal state ────────────────────────────────────────────────────────────

interface EventTimelineState {
  historicalEvents: HistoricalEvent[];
  activeModifiers: GlobalModifier[];
  pendingDecisions: EventDecision[];
  economicCycle: EconomicCycleState;
  randomEventCooldown: number;
  inflationRate: number;
  exchangeRate: number;
  baseExchangeRate: number;
  exchangeRateMod: number;
}

// ─── EventTimeline ─────────────────────────────────────────────────────────────

export class EventTimeline implements IGameModule {
  readonly moduleId = 'EventTimeline';

  private bus!: IEventBus;
  private cfg!: EventTimelineConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private unsubscribe: (() => void) | null = null;

  private state: EventTimelineState = {
    historicalEvents: buildHistoricalEvents(),
    activeModifiers: [],
    pendingDecisions: [],
    economicCycle: {
      current: EconomicCycle.Normal,
      monthsInCurrentPhase: 0,
      phaseDurationMonths: 12,
      modifiers: { ...CYCLE_MODIFIERS[EconomicCycle.Normal] },
    },
    randomEventCooldown: 3,
    inflationRate: 0.02,
    exchangeRate: 30.0,
    baseExchangeRate: 30.0,
    exchangeRateMod: 1.0,
  };

  // ─── IGameModule ─────────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.eventTimeline ?? DEFAULT_TIMELINE_CONFIG;
    this.currentDate = { ...config.meta, month: config.meta.startMonth, year: config.meta.startYear };
    this.state.exchangeRate = this.cfg.baseExchangeRate;
    this.state.baseExchangeRate = this.cfg.baseExchangeRate;
    this.state.inflationRate = this.cfg.baseInflationRate;
    this.state.randomEventCooldown = this._rollCooldown();

    this.unsubscribe = bus.subscribe<{ prevDate: GameDate; newDate: GameDate }>(
      'time.month_end',
      (event) => this._onMonthEnd(event.payload.newDate),
      this.moduleId,
    );
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this.state));
  }

  deserialize(raw: Record<string, unknown>): void {
    const s = raw as unknown as EventTimelineState;
    this.state.historicalEvents = s.historicalEvents ?? buildHistoricalEvents();
    this.state.activeModifiers = s.activeModifiers ?? [];
    this.state.pendingDecisions = s.pendingDecisions ?? [];
    this.state.economicCycle = s.economicCycle ?? this.state.economicCycle;
    this.state.randomEventCooldown = s.randomEventCooldown ?? 3;
    this.state.inflationRate = s.inflationRate ?? this.cfg.baseInflationRate;
    this.state.exchangeRate = s.exchangeRate ?? this.cfg.baseExchangeRate;
    this.state.baseExchangeRate = s.baseExchangeRate ?? this.cfg.baseExchangeRate;
    this.state.exchangeRateMod = s.exchangeRateMod ?? 1.0;
  }

  getState(): Readonly<Record<string, unknown>> {
    return this.state as unknown as Record<string, unknown>;
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  getTriggeredEvents(): HistoricalEvent[] {
    return this.state.historicalEvents.filter((e) => e.status === 'triggered');
  }

  getUpcomingEvents(withinMonths = 12): HistoricalEvent[] {
    return this.state.historicalEvents.filter((e) => {
      if (e.status !== 'pending') return false;
      const monthsAway =
        (e.year - this.currentDate.year) * 12 + (e.month - this.currentDate.month);
      return monthsAway >= 0 && monthsAway <= withinMonths;
    });
  }

  getActiveModifiers(): GlobalModifier[] {
    return [...this.state.activeModifiers];
  }

  getPendingDecisions(): EventDecision[] {
    return [...this.state.pendingDecisions];
  }

  makeDecision(decisionId: EntityId, optionIndex: number): DecisionOutcome {
    const idx = this.state.pendingDecisions.findIndex((d) => d.id === decisionId);
    if (idx === -1) {
      return {
        decisionId,
        optionIndex,
        effectsApplied: [],
        description: '決策不存在或已過期',
      };
    }

    const decision = this.state.pendingDecisions[idx];
    const option = decision.template.options[optionIndex];
    const effectsApplied: EventEffect[] = option ? [...option.effects] : [];

    if (option) {
      this._applyEffects(decision.eventId, effectsApplied, null);
    }

    const eventRef = this.state.historicalEvents.find((e) => e.id === decision.eventId);
    if (eventRef) {
      eventRef.playerDecision = optionIndex;
    }

    this.state.pendingDecisions.splice(idx, 1);

    const outcome: DecisionOutcome = {
      decisionId,
      optionIndex,
      effectsApplied,
      description: option?.description ?? '',
    };

    this.bus.publish({
      type: 'timeline.decision_made',
      payload: outcome,
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    return outcome;
  }

  getRandomEventCooldown(): number {
    return this.state.randomEventCooldown;
  }

  getEconomicCycle(): EconomicCycleState {
    return { ...this.state.economicCycle, modifiers: { ...this.state.economicCycle.modifiers } };
  }

  getExchangeRateMod(): number {
    return this.state.exchangeRateMod;
  }

  getNextHistoricalEvent(): { event: HistoricalEvent; monthsAway: number } | null {
    let nearest: { event: HistoricalEvent; monthsAway: number } | null = null;

    for (const e of this.state.historicalEvents) {
      if (e.status !== 'pending') continue;
      const monthsAway =
        (e.year - this.currentDate.year) * 12 + (e.month - this.currentDate.month);
      if (monthsAway < 0) continue;
      if (nearest === null || monthsAway < nearest.monthsAway) {
        nearest = { event: e, monthsAway };
      }
    }

    return nearest;
  }

  // ─── Private: month-end handler ───────────────────────────────────────────────

  private _onMonthEnd(newDate: GameDate): void {
    this.currentDate = newDate;

    this._checkHistoricalEvents();
    this._expireModifiers();
    this._expireDecisions();
    this._advanceEconomicCycle();
    this._updateExchangeRate();
    this._tickRandomEventCooldown();
  }

  private _checkHistoricalEvents(): void {
    for (const event of this.state.historicalEvents) {
      if (event.status !== 'pending') continue;
      if (event.year === this.currentDate.year && event.month === this.currentDate.month) {
        this._triggerEvent(event);
      }
    }
  }

  private _triggerEvent(event: HistoricalEvent): void {
    event.status = 'triggered';
    event.triggeredAt = { ...this.currentDate };

    this._applyEffects(event.id, event.effects, event.durationMonths > 0 ? event.durationMonths : null);

    this.bus.publish({
      type: 'timeline.historical_event',
      payload: event,
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    if (event.decisions && event.decisions.length > 0) {
      const template = event.decisions[0];
      const decision: EventDecision = {
        id: `${event.id}_decision_${this.currentDate.year}_${this.currentDate.month}`,
        eventId: event.id,
        template,
        triggeredAt: { ...this.currentDate },
        expiresAt: addMonths(this.currentDate, template.decisionWindowMonths),
        isExpired: false,
      };
      this.state.pendingDecisions.push(decision);

      this.bus.publish({
        type: 'timeline.decision_required',
        payload: decision,
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }

    this._publishEventSideEffects(event);
  }

  private _publishEventSideEffects(event: HistoricalEvent): void {
    for (const eff of event.effects) {
      switch (eff.effectType) {
        case EventEffectType.ElectricityMod:
          this.bus.publish({
            type: 'timeline.electricity_rate_changed',
            payload: { mod: eff.value },
            gameDate: this.currentDate,
            source: this.moduleId,
          });
          break;
        case EventEffectType.RFPFrequencyMod:
          this.bus.publish({
            type: 'timeline.rfp_boost',
            payload: { mod: eff.value, durationMonths: event.durationMonths },
            gameDate: this.currentDate,
            source: this.moduleId,
          });
          break;
        case EventEffectType.ThreatLevelMod:
          this.bus.publish({
            type: 'timeline.threat_level_changed',
            payload: { mod: eff.value },
            gameDate: this.currentDate,
            source: this.moduleId,
          });
          break;
        case EventEffectType.DeliveryDelayMonths:
          this.bus.publish({
            type: 'timeline.chip_shortage',
            payload: { costMod: 1.0, delayMonths: eff.value },
            gameDate: this.currentDate,
            source: this.moduleId,
          });
          break;
        case EventEffectType.HardwareCostMod:
          if (event.id === 'CHIP_SHORTAGE') {
            this.bus.publish({
              type: 'timeline.chip_shortage',
              payload: { costMod: eff.value, delayMonths: 0 },
              gameDate: this.currentDate,
              source: this.moduleId,
            });
          }
          break;
        case EventEffectType.EconomicCycle:
          if (event.id === 'DOTCOM_CRASH') {
            this._forceEconomicCycle(EconomicCycle.Recession);
          } else if (event.id === 'LEHMAN') {
            this._forceEconomicCycle(EconomicCycle.Depression);
          }
          break;
        default:
          break;
      }
    }
  }

  private _applyEffects(
    sourceEventId: string,
    effects: EventEffect[],
    durationMonths: number | null,
  ): void {
    for (const eff of effects) {
      if (
        eff.effectType === EventEffectType.EconomicCycle ||
        eff.effectType === EventEffectType.DeliveryDelayMonths
      ) {
        continue;
      }

      const endDate = durationMonths && durationMonths > 0
        ? addMonths(this.currentDate, durationMonths)
        : null;

      const modifier: GlobalModifier = {
        id: `${sourceEventId}_${eff.effectType}_${this.currentDate.year}_${this.currentDate.month}`,
        sourceEventId,
        effectType: eff.effectType,
        value: eff.value,
        isMultiplier: eff.isMultiplier,
        startDate: { ...this.currentDate },
        endDate,
        description: eff.description,
      };

      this.state.activeModifiers.push(modifier);
    }

    if (effects.length > 0) {
      this.bus.publish({
        type: 'timeline.economic_modifier_changed',
        payload: { modifiers: this.state.activeModifiers },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private _expireModifiers(): void {
    const before = this.state.activeModifiers.length;
    this.state.activeModifiers = this.state.activeModifiers.filter((m) => {
      if (!m.endDate) return true;
      const isExpired =
        this.currentDate.year > m.endDate.year ||
        (this.currentDate.year === m.endDate.year &&
          this.currentDate.month >= m.endDate.month);
      if (isExpired) {
        const srcEvent = this.state.historicalEvents.find((e) => e.id === m.sourceEventId);
        if (srcEvent && srcEvent.status === 'triggered') {
          srcEvent.status = 'expired';
        }
      }
      return !isExpired;
    });

    if (this.state.activeModifiers.length !== before) {
      this.bus.publish({
        type: 'timeline.economic_modifier_changed',
        payload: { modifiers: this.state.activeModifiers },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private _expireDecisions(): void {
    this.state.pendingDecisions = this.state.pendingDecisions.filter((d) => {
      const isExpired =
        this.currentDate.year > d.expiresAt.year ||
        (this.currentDate.year === d.expiresAt.year &&
          this.currentDate.month > d.expiresAt.month);
      if (isExpired) {
        d.isExpired = true;
        const template = d.template;
        const defaultOption = template.options[template.defaultOptionIndex];
        if (defaultOption) {
          this._applyEffects(d.eventId, defaultOption.effects, null);
        }
      }
      return !isExpired;
    });
  }

  private _advanceEconomicCycle(): void {
    const cycle = this.state.economicCycle;
    cycle.monthsInCurrentPhase += 1;

    if (cycle.monthsInCurrentPhase >= cycle.phaseDurationMonths) {
      const currentIdx = CYCLE_ORDER.indexOf(cycle.current);
      const nextIdx = (currentIdx + 1) % CYCLE_ORDER.length;
      cycle.current = CYCLE_ORDER[nextIdx];
      cycle.monthsInCurrentPhase = 0;
      cycle.phaseDurationMonths = this._rollCycleDuration();
      cycle.modifiers = { ...CYCLE_MODIFIERS[cycle.current] };

      this.bus.publish({
        type: 'timeline.economic_cycle_changed',
        payload: { ...cycle, modifiers: { ...cycle.modifiers } },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private _forceEconomicCycle(phase: EconomicCycle): void {
    const cycle = this.state.economicCycle;
    cycle.current = phase;
    cycle.monthsInCurrentPhase = 0;
    cycle.phaseDurationMonths = this._rollCycleDuration();
    cycle.modifiers = { ...CYCLE_MODIFIERS[phase] };

    this.bus.publish({
      type: 'timeline.economic_cycle_changed',
      payload: { ...cycle, modifiers: { ...cycle.modifiers } },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  private _updateExchangeRate(): void {
    const vol = this.cfg.exchangeRateMonthlyVolatility;
    const delta = (seededRand() * 2 - 1) * vol;
    this.state.exchangeRate = this.state.exchangeRate * (1 + delta);
    this.state.exchangeRateMod = this.state.exchangeRate / this.state.baseExchangeRate;
  }

  private _tickRandomEventCooldown(): void {
    this.state.randomEventCooldown -= 1;
    if (this.state.randomEventCooldown <= 0) {
      this._rollRandomEvents();
      this.state.randomEventCooldown = this._rollCooldown();
    }
  }

  private _rollRandomEvents(): void {
    const roll = seededRand();
    if (roll < 0.3) {
      const durationMonths = 3 + Math.floor(seededRand() * 4);
      this.bus.publish({
        type: 'timeline.rfp_boost',
        payload: { mod: 1.2 + seededRand() * 0.3, durationMonths },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    } else if (roll < 0.5) {
      this.bus.publish({
        type: 'timeline.talent_war',
        payload: { durationMonths: 2 + Math.floor(seededRand() * 3) },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    } else if (roll < 0.65) {
      this.bus.publish({
        type: 'timeline.electricity_rate_changed',
        payload: { mod: 1.1 + seededRand() * 0.2 },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private _rollCooldown(): number {
    const [min, max] = this.cfg.randomEventCooldownRange;
    return min + Math.floor(seededRand() * (max - min + 1));
  }

  private _rollCycleDuration(): number {
    const [min, max] = this.cfg.economicCycleDurationRange;
    return min + Math.floor(seededRand() * (max - min + 1));
  }
}
