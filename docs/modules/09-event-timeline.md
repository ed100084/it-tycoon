# 09 — EventTimeline 歷史事件引擎

## 模組職責

EventTimeline 管理遊戲中**固定時間軸的歷史事件**（Y2K、金融海嘯、COVID 等）以及週期性觸發的**隨機國際事件**（晶片短缺、海運塞港等）。它套用效果到各模組的修正係數上，並在重大事件發生時強制暫停並呈現決策選項。

**單一職責**：歷史事件的觸發、效果套用、玩家決策分支管理。不直接修改任何業務狀態，只透過事件通知其他模組更新係數。

---

## 公開介面（Public API）

```typescript
interface IEventTimeline extends IGameModule {
  readonly moduleId: 'EventTimeline';

  /** 取得已觸發的歷史事件列表。 */
  getTriggeredEvents(): HistoricalEvent[];

  /** 取得即將到來的已知事件（可預覽）。 */
  getUpcomingEvents(withinMonths?: number): HistoricalEvent[];

  /** 取得當前活躍的全局修正係數。 */
  getActiveModifiers(): GlobalModifier[];

  /** 取得等待玩家決策的事件。 */
  getPendingDecisions(): EventDecision[];

  /** 玩家選擇決策選項。 */
  makeDecision(decisionId: EntityId, optionIndex: number): DecisionOutcome;

  /** 取得隨機事件的冷卻狀態。 */
  getRandomEventCooldown(): number;  // 距離下次隨機事件的月數

  /** 取得景氣循環狀態。 */
  getEconomicCycle(): EconomicCycleState;

  /** 取得匯率修正係數（影響進口採購）。 */
  getExchangeRateMod(): number;

  /** 取得歷史事件倒計時（下一個固定事件）。 */
  getNextHistoricalEvent(): { event: HistoricalEvent; monthsAway: number } | null;
}
```

---

## 核心資料結構

```typescript
interface HistoricalEvent {
  id: string;                          // 如 'DOTCOM_BUBBLE_PEAK'
  name: string;                        // '那斯達克泡沫頂峰'
  year: number;
  month: number;
  description: string;                 // 詳細說明（全螢幕事件卡片）
  isForced: boolean;                   // true = 無論如何觸發（WannaCry 等）
  durationMonths: number;              // 效果持續月數（0 = 永久）
  effects: EventEffect[];              // 套用的修正效果
  decisions?: EventDecisionTemplate[]; // 若有決策選項
  status: 'pending' | 'triggered' | 'expired';
  triggeredAt: GameDate | null;
  playerDecision: number | null;       // 玩家選擇的 optionIndex
  isAchievementRelated: boolean;       // 是否關聯成就（WannaCry 倖存者等）
}

interface EventEffect {
  targetModule: string;               // 接收效果的模組 ID
  effectType: EventEffectType;
  value: number;                      // 倍率（× value）或加法（+ value）
  isMultiplier: boolean;
  description: string;
}

enum EventEffectType {
  // FinanceEngine
  BaseInterestRate      = 'BASE_INTEREST_RATE',
  EconomicCycle         = 'ECONOMIC_CYCLE',
  // FacilityManager
  ElectricityRate       = 'ELECTRICITY_RATE',
  ElectricityMod        = 'ELECTRICITY_MOD',
  // HardwareCatalog
  HardwareCostMod       = 'HARDWARE_COST_MOD',
  DeliveryDelayMonths   = 'DELIVERY_DELAY',
  // SoftwareCatalog
  SoftwarePriceChange   = 'SOFTWARE_PRICE_CHANGE',
  ForcedEOS             = 'FORCED_EOS',
  // ContractManager
  RFPFrequencyMod       = 'RFP_FREQUENCY_MOD',
  ContractValueMod      = 'CONTRACT_VALUE_MOD',
  ClientBudgetMod       = 'CLIENT_BUDGET_MOD',
  // SecurityEngine
  ThreatLevelMod        = 'THREAT_LEVEL_MOD',
  SpecificThreatMod     = 'SPECIFIC_THREAT_MOD',  // 特定事件類型
  // StaffManager
  StaffEfficiencyMod    = 'STAFF_EFFICIENCY_MOD',
  RecruitmentCostMod    = 'RECRUITMENT_COST_MOD',
  ResignationRateMod    = 'RESIGNATION_RATE_MOD',
  // General
  ExchangeRateMod       = 'EXCHANGE_RATE_MOD',
  InflationRateMod      = 'INFLATION_RATE_MOD',
}

interface EventDecisionTemplate {
  prompt: string;
  options: Array<{
    label: string;
    description: string;
    effects: EventEffect[];             // 選此選項觸發的額外效果
    achievementHint?: string;
  }>;
  defaultOptionIndex: number;           // 若未決策則自動選此選項
  decisionWindowMonths: number;         // 決策有效期
}

interface EventDecision {
  id: EntityId;
  eventId: string;
  template: EventDecisionTemplate;
  triggeredAt: GameDate;
  expiresAt: GameDate;
  isExpired: boolean;
}

interface DecisionOutcome {
  decisionId: EntityId;
  optionIndex: number;
  effectsApplied: EventEffect[];
  description: string;
}

interface GlobalModifier {
  id: string;
  sourceEventId: string;
  effectType: EventEffectType;
  value: number;
  isMultiplier: boolean;
  startDate: GameDate;
  endDate: GameDate | null;            // null = 永久
  description: string;
}

interface EconomicCycleState {
  current: EconomicCycle;
  monthsInCurrentPhase: number;
  phaseDurationMonths: number;        // 本階段計劃持續月數（8–15）
  modifiers: {
    hardwareCostMod: number;
    electricityMod: number;
    clientBudgetMod: number;
    recruitmentCostMod: number;
  };
}
```

---

## 內部狀態結構

```typescript
interface EventTimelineState {
  historicalEvents: HistoricalEvent[];    // 全部歷史事件（靜態定義 + 運行狀態）
  activeModifiers: GlobalModifier[];
  pendingDecisions: EventDecision[];
  economicCycle: EconomicCycleState;
  randomEventCooldown: number;            // 距下次隨機事件的月數
  inflationRate: number;                  // 當年通膨率（%）
  exchangeRate: number;                   // TWD/USD 當前匯率
  baseExchangeRate: number;               // 30.0 基準
  exchangeRateMod: number;                // 當前匯率修正係數
}
```

---

## 歷史事件時間表（固定觸發）

```
2000/01  Y2K 後續修補浪潮        → RFP +30%, 6 個月
2000/03  那斯達克泡沫頂峰         → VPS 需求 +50%, 違約率 +20%
2001/03  網路泡沫破裂             → VPS 合約流失 +40%, 景氣 → 衰退
2001/09  911 事件                → 資安需求 +100%, DRaaS 詢問暴增（決策）
2003/03  SARS                   → 工程師效率 -20%, 醫療客戶 +50%（決策）
2004/08  SOX 法案稽核強化         → ISO 27001 要求開始（永久）
2008/09  雷曼破產                → IT 預算削減 25-40%, 景氣 → 蕭條（決策）
2010/01  AWS 規模化              → VPS 月費上限 -20%（永久遞增）
2011/03  311 大地震              → 硬體 ×1.4, DRaaS +80%
2013/06  Snowden 事件            → 本地 Colo +40%, 36 個月
2017/05  WannaCry               → EOS Windows 強制觸發 P1（強制）
2020/03  COVID 全球封鎖           → VPN 需求 +200%, VPS +40%（決策）
2021/01  晶片短缺                → 伺服器 ×2.0, GPU ×3.0, +3 個月延遲
2022/02  俄烏戰爭                → 電費 ×1.4, APT ×2（決策）
2023/01  ChatGPT 爆發            → AI 合約 +300%, GPU ×5（永久增長）
2023/03  Broadcom 收 VMware      → VMware 授權 ×2.5（強制，永久）
```

---

## 隨機事件觸發邏輯

```
每月 roll：
  if randomEventCooldown > 0:
    randomEventCooldown -= 1
    return

  // 從隨機事件池選取（依當前年份過濾）
  candidate = weightedRandom(randomEventPool)
  trigger(candidate)
  randomEventCooldown = random(2, 6)  // 下次觸發冷卻 2–6 個月
```

---

## 景氣循環狀態機

```
Boom → Normal → Recession → Depression → Recession → Normal → Boom

每次循環：
  phaseDurationMonths = random(8, 15)
  monthsInCurrentPhase 遞增
  到期後 → 轉至下一階段

歷史事件可強制跳至特定景氣（如雷曼 → 蕭條）
```

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 檢查歷史事件觸發，景氣循環推進，隨機事件 roll |
| `time.year_end` | TimeEngine | 通膨率調整，匯率年度基準更新 |
| `techtree.research_completed` | TechTree | 某些科技樹降低事件影響（如「在地化採購」降低匯率衝擊）|
| `hardware.purchased` | HardwareCatalog | 晶片短缺期間的特殊互動 |

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `timeline.historical_event` | `HistoricalEvent` | 歷史事件觸發（強制暫停）|
| `timeline.decision_required` | `EventDecision` | 玩家決策請求（強制暫停）|
| `timeline.decision_made` | `DecisionOutcome` | 玩家決策完成 |
| `timeline.economic_cycle_changed` | `EconomicCycleState` | 景氣循環切換 |
| `timeline.economic_modifier_changed` | `{ modifiers }` | 更新各模組的修正係數 |
| `timeline.electricity_rate_changed` | `{ rate, mod }` | 電費單價/倍率變動 |
| `timeline.rfp_boost` | `{ mod, durationMonths }` | RFP 頻率暴增（事件觸發）|
| `timeline.talent_war` | `{ durationMonths }` | 人才搶奪戰事件 |
| `timeline.chip_shortage` | `{ costMod, delayMonths }` | 晶片短缺 |
| `timeline.supply_chain_disruption` | `{ delayMonths }` | 海運塞港 |
| `timeline.software_price_change` | `{ productId, newAnnualCost }` | 軟體漲價事件 |
| `timeline.forced_eos` | `{ productId, eosDate }` | 強制 EOS 事件 |
| `timeline.climate_event` | `{ region, type, durationMonths }` | 氣候事件（颱風/停電）|

---

## EventTimelineConfig 平衡參數

```typescript
interface EventTimelineConfig {
  historicalEvents: HistoricalEventDefinition[];  // 靜態時間表
  randomEvents: RandomEventDefinition[];           // 隨機事件池
  economicCycleDurationRange: [number, number];   // [8, 15] 個月
  randomEventCooldownRange: [number, number];     // [2, 6] 個月
  baseInflationRate: number;                       // 0.02（2%）
  inflationVolatility: number;                    // ±0.5%/年
  baseExchangeRate: number;                        // 30.0 TWD/USD
  exchangeRateMonthlyVolatility: number;           // ±0.3%/月
  inLocalizationPurchaseExchangeReduction: number; // 0.40（科技樹效果）
}
```

---

## 與其他模組的交互

```
EventTimeline
  ├── 接收 time.month_end → 觸發歷史事件，roll 隨機事件，推進景氣循環
  ├── 發布 timeline.historical_event → TimeEngine（強制暫停）
  ├── 發布 timeline.economic_modifier_changed → FinanceEngine, HardwareCatalog, StaffManager
  ├── 發布 timeline.electricity_rate_changed → FacilityManager
  ├── 發布 timeline.rfp_boost → ContractManager
  ├── 發布 timeline.chip_shortage → HardwareCatalog
  ├── 發布 timeline.software_price_change → SoftwareCatalog
  └── 發布 timeline.historical_event（WannaCry）→ SecurityEngine（強制 P1 事件）
```

---

## 未來擴展點

- **玩家創造歷史**：玩家的決策可改變後續事件的觸發機率或效果強度（蝴蝶效應系統）。
- **事件回放**：新局開始後可選擇「隨機化歷史事件時間」，提升重玩性。
- **2025 年後內容**：Blackwell GPU 架構、後 ChatGPT 監管法規等可擴展為新事件包。
