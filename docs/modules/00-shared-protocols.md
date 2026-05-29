# 00 — Shared Protocols & Interface Contracts

所有模組共用的基礎協定。任何模組在實作前必須先閱讀此文件。

---

## 1. 基礎型別定義

```typescript
// ─── 基本純量型別 ─────────────────────────────────────────────

/** 以 NTD 整數分（或 NTD × 100）表示，避免浮點誤差。
 *  顯示時除以 100，例如 500_000_00 = NT$500,000。
 *  為求可讀性，本文件其他地方的「NT$」數字均為 NTD 元整數。 */
type Money = number;          // 單位：NTD 分（× 100）

/** 遊戲內日期：不追蹤日，以月為最小粒度。 */
interface GameDate {
  year: number;               // 2000–2040
  month: number;              // 1–12
}

/** 所有持久化實體（硬體、合約、員工、事件…）的唯一識別碼。
 *  實作上使用 crypto.randomUUID() 或 nanoid()。 */
type EntityId = string;

/** 遊戲速度倍率。0 = 暫停。 */
type GameSpeed = 0 | 1 | 2 | 4 | 8;
```

---

## 2. 共用列舉（Enums）

```typescript
// ─── 硬體分類 ─────────────────────────────────────────────────
enum HardwareCategory {
  Server        = 'SERVER',
  Storage       = 'STORAGE',
  Networking    = 'NETWORKING',
  UPS           = 'UPS',
  Cooling       = 'COOLING',
  Rack          = 'RACK',
  EnvMonitor    = 'ENV_MONITOR',
  FireSuppress  = 'FIRE_SUPPRESS',
  GPU           = 'GPU',
}

// ─── 軟體分類 ─────────────────────────────────────────────────
enum SoftwareCategory {
  OS              = 'OS',
  Virtualization  = 'VIRTUALIZATION',
  Container       = 'CONTAINER',
  Database        = 'DATABASE',
  Backup          = 'BACKUP',
  Security        = 'SECURITY',
  Monitoring      = 'MONITORING',
  ITSM            = 'ITSM',
}

// ─── 軟體授權類型 ──────────────────────────────────────────────
enum LicenseType {
  PerpetualWithSA = 'PERPETUAL_SA',   // 永久授權 + SA
  AnnualSubscription = 'ANNUAL_SUB',  // 年訂閱
  OpenSource      = 'OPEN_SOURCE',    // 免費開源
  SaaS            = 'SAAS',           // 雲端 SaaS
}

// ─── 合約類型 ─────────────────────────────────────────────────
enum ServiceType {
  Colocation      = 'COLOCATION',
  VPS             = 'VPS',
  SaaS            = 'SAAS',
  Bandwidth       = 'BANDWIDTH',
  MSP             = 'MSP',
  DRaaS           = 'DRAAS',
  MSSP            = 'MSSP',
  AICompute       = 'AI_COMPUTE',
  ProfServices    = 'PROF_SERVICES',
  Training        = 'TRAINING',
}

enum ContractStatus {
  Active     = 'ACTIVE',
  Expired    = 'EXPIRED',
  Terminated = 'TERMINATED',
  Pending    = 'PENDING',   // RFP 已投標，等待結果
}

// ─── 客戶等級 ─────────────────────────────────────────────────
enum CustomerTier {
  Individual   = 'INDIVIDUAL',
  SMB          = 'SMB',
  Enterprise   = 'ENTERPRISE',
  Government   = 'GOVERNMENT',
  Multinational = 'MULTINATIONAL',
}

// ─── 人力職等 ─────────────────────────────────────────────────
enum StaffRole {
  E1_NOC      = 'E1_NOC',
  E2_SysEng   = 'E2_SYS_ENG',
  E3_SecAna   = 'E3_SEC_ANA',
  E3_Senior   = 'E3_SENIOR',
  E4_CloudArch = 'E4_CLOUD_ARCH',
  E4_AIEng    = 'E4_AI_ENG',
  E5_CISO     = 'E5_CISO',
}

// ─── 事件嚴重度 ───────────────────────────────────────────────
enum IncidentSeverity {
  P1 = 'P1',  // 緊急，4hr SLA，強制暫停
  P2 = 'P2',  // 嚴重，8hr SLA，強制暫停
  P3 = 'P3',  // 一般，24hr SLA
  P4 = 'P4',  // 輕微，48hr SLA
}

// ─── 景氣循環 ─────────────────────────────────────────────────
enum EconomicCycle {
  Boom       = 'BOOM',
  Normal     = 'NORMAL',
  Recession  = 'RECESSION',
  Depression = 'DEPRESSION',
}

// ─── 信用評等 ─────────────────────────────────────────────────
enum CreditRating {
  AAA = 'AAA',
  AA  = 'AA',
  A   = 'A',
  BBB = 'BBB',
  BB  = 'BB',
  B   = 'B',
  Insolvent = 'INSOLVENT',
}

// ─── 機房區域 ─────────────────────────────────────────────────
enum FacilityRegion {
  North  = 'NORTH',
  Central = 'CENTRAL',
  South  = 'SOUTH',
}

// ─── 科技樹節點狀態 ───────────────────────────────────────────
enum TechNodeStatus {
  Locked     = 'LOCKED',
  Available  = 'AVAILABLE',
  InProgress = 'IN_PROGRESS',
  Completed  = 'COMPLETED',
}
```

---

## 3. Event Bus 協定

### 3.1 事件格式

```typescript
/** 所有遊戲事件的統一格式。
 *  type 命名規則：「模組名稱.事件名稱」，全小寫加底線。
 *  例：time.month_end, finance.cash_warning, security.incident_triggered */
interface GameEvent<TPayload = unknown> {
  readonly id: EntityId;          // 事件唯一 ID，由 Bus 產生
  readonly type: string;          // 命名空間事件名
  readonly payload: TPayload;     // 事件資料
  readonly gameDate: GameDate;    // 事件發生的遊戲時間
  readonly source: string;        // 發出模組 id（如 'TimeEngine'）
  readonly wallTime: number;      // Date.now()，用於排序同一 tick 的事件
}
```

### 3.2 EventBus 介面

```typescript
type EventHandler<T = unknown> = (event: GameEvent<T>) => void;
type Unsubscribe = () => void;

interface IEventBus {
  /** 發布事件，同步派送給所有訂閱者。 */
  publish<T>(event: Omit<GameEvent<T>, 'id' | 'wallTime'>): void;

  /** 訂閱單一事件類型。回傳取消訂閱函式。 */
  subscribe<T>(type: string, handler: EventHandler<T>): Unsubscribe;

  /** 訂閱多個事件類型（共用同一 handler）。 */
  subscribeMany(types: string[], handler: EventHandler): Unsubscribe;

  /** 取消某模組所有訂閱（模組銷毀時呼叫）。 */
  unsubscribeAll(sourceModuleId: string): void;

  /** 回傳特定類型的最近 N 筆事件（用於除錯 / 回放）。 */
  getHistory(type: string, limit?: number): GameEvent[];
}
```

### 3.3 設計規範

- **同步派送**：`publish()` 同步呼叫所有 handler，保證在同一 tick 內有序執行。
- **無副作用廣播**：handler 不得在 publish 呼叫堆疊內再次 publish（防止無限遞迴）。需要連鎖事件者，應使用 microtask queue（`queueMicrotask`）延後發布。
- **型別安全**：每個事件 type string 應有對應的 payload interface，以 TypeScript module augmentation 擴充：

```typescript
// 擴充事件 payload 型別的方式（各模組在自己的型別檔中宣告）
declare module '@/events' {
  interface GameEventPayloadMap {
    'time.month_end':       TimeMonthEndPayload;
    'finance.cash_warning': FinanceCashWarningPayload;
    // ...
  }
}
```

---

## 4. Module Interface 標準介面

每個遊戲模組**必須**實作此介面：

```typescript
interface IGameModule {
  /** 模組唯一識別，與事件 source 一致，如 'TimeEngine'。 */
  readonly moduleId: string;

  /** 遊戲啟動時呼叫一次，注入 EventBus 與 Config。
   *  模組在此訂閱需要的事件。 */
  init(bus: IEventBus, config: GameConfig): void;

  /** 每個 requestAnimationFrame 呼叫，deltaMs 為距上次 tick 的毫秒數。
   *  模組根據遊戲速度推進內部狀態。 */
  tick(deltaMs: number): void;

  /** 將內部狀態序列化為純 JSON 物件（可直接 JSON.stringify）。 */
  serialize(): Record<string, unknown>;

  /** 從序列化物件還原狀態（讀檔時呼叫）。
   *  必須在 init 之後、首次 tick 之前呼叫。 */
  deserialize(state: Record<string, unknown>): void;

  /** 回傳模組目前的完整狀態（唯讀），UIBridge 使用。
   *  應回傳 immutable 物件（Object.freeze 或 readonly）。 */
  getState(): Readonly<Record<string, unknown>>;

  /** 模組被銷毀或遊戲結束時呼叫，清理訂閱與計時器。 */
  destroy(): void;
}
```

### 4.1 Tick 週期與時間推進

```
requestAnimationFrame
  └── GameLoop.tick(deltaMs)
        ├── TimeEngine.tick(deltaMs)   ← 唯一推進遊戲時間的模組
        │     └── 若跨越月份：publish('time.month_end', ...)
        │     └── 若跨越季度：publish('time.quarter_end', ...)
        │     └── 若跨越年份：publish('time.year_end', ...)
        ├── FinanceEngine.tick(deltaMs)
        ├── FacilityManager.tick(deltaMs)
        ├── ... 其他模組
        └── UIBridge.tick(deltaMs)     ← 最後執行，彙整 ViewModel
```

- 只有 **TimeEngine** 推進遊戲日期，其他模組透過訂閱 `time.*` 事件感知時間流逝。
- 模組的 `tick()` 用於持續性計算（動畫、進度條），不得假設時間推進（應用事件驅動）。

---

## 5. State Management 協定

### 5.1 存檔結構

```typescript
interface SaveFile {
  version: string;                          // 存檔版本，用於遷移
  savedAt: number;                          // Date.now()
  gameDate: GameDate;                       // 儲存時的遊戲日期
  modules: Record<string, Record<string, unknown>>;  // key = moduleId
}

// 存檔範例
const save: SaveFile = {
  version: '1.0.0',
  savedAt: 1716825600000,
  gameDate: { year: 2008, month: 9 },
  modules: {
    TimeEngine:      { speed: 2, accumulatedMs: 0 },
    FinanceEngine:   { cash: 23_400_000_00, ... },
    HardwareCatalog: { assets: [...] },
    // ...
  }
};
```

### 5.2 序列化規範

- 所有 `EntityId`（UUID）序列化為字串。
- `GameDate` 序列化為 `{ year, month }` 物件。
- `Money` 序列化為整數（NTD 分）。
- 不存儲 EventBus 訂閱與 runtime callback，在 `init()` 重新綁定。
- Map/Set 序列化為 `Array<[key, value]>` 格式。

### 5.3 版本遷移

```typescript
interface StateMigration {
  fromVersion: string;
  toVersion: string;
  migrate(state: Record<string, unknown>): Record<string, unknown>;
}
```

每個模組可宣告自己的 migration 鏈，由 GameLoader 在讀檔時自動執行。

---

## 6. Config 注入協定

遊戲平衡參數全部外部化，不 hardcode 在邏輯中。

### 6.1 Config 結構

```typescript
interface GameConfig {
  meta: {
    startYear: number;             // default: 2000
    startMonth: number;            // default: 1
    startCash: Money;              // standard: 500_000_00
    gameMode: 'standard' | 'hard' | 'sandbox';
  };
  time: TimeConfig;
  finance: FinanceConfig;
  facility: FacilityConfig;
  hardware: HardwareConfig;
  software: SoftwareConfig;
  contract: ContractConfig;
  staff: StaffConfig;
  security: SecurityConfig;
  reputation: ReputationConfig;
  techTree: TechTreeConfig;
  eventTimeline: EventTimelineConfig;
  economy: EconomyConfig;
}
```

### 6.2 Config 注入方式

```typescript
// 各模組只宣告自己需要的 slice
interface FinanceConfig {
  corporateTaxRate: number;             // 0.17
  creditRatingUpdateIntervalMonths: number;  // 3
  bankruptcyConsecutiveLossMonths: number;   // 3
  cashWarningMultiplier: number;        // 2（現金 < 月支出 × 2 時警告）
  slaBreachPayoutCap: number;           // 3.0（月收入的 300%）
  loanTerms: Record<CreditRating, LoanTermConfig>;
}

interface LoanTermConfig {
  maxMultiple: number;   // 月收入倍數
  annualRate: number;    // 年化利率（基準，加上央行利率調整）
  maxMonths: number;     // 最長期限（月）
}
```

### 6.3 Config 檔案位置

```
src/
  config/
    default.config.ts      ← 預設平衡值（正式發行版）
    hard.config.ts         ← 困難模式覆蓋值
    sandbox.config.ts      ← 沙盒模式覆蓋值
    balance/
      finance.ts
      hardware.ts
      staff.ts
      security.ts
      ...
```

Config 以 `Object.freeze` 凍結後注入，模組只能讀取不能修改。

---

## 7. 模組間通訊原則

```
┌─────────────┐     publish()      ┌─────────────┐
│  Module A   │ ──────────────────▶│  Event Bus  │
└─────────────┘                    └──────┬──────┘
                                          │ handler()
                                   ┌──────▼──────┐
                                   │  Module B   │
                                   └─────────────┘

禁止：ModuleA.internalMethod()  ← 直接呼叫另一模組的內部方法
允許：ModuleA 透過 Bus 發布事件，ModuleB 訂閱後處理
允許：ModuleA 呼叫 ModuleB.getState()（唯讀查詢，非命令）
```

- **命令（write）** → 必須透過 Event Bus
- **查詢（read）** → 可直接呼叫 `getState()`，但避免直接存取內部 Map/Array
- **循環依賴** → 禁止。若 A 訂閱 B 發的事件，B 不得訂閱 A 發的同一事件鏈

---

## 8. 錯誤處理協定

```typescript
/** 模組內部錯誤不得 throw 到遊戲主迴圈。
 *  應發布 error 事件並降級處理。 */
interface ModuleErrorPayload {
  moduleId: string;
  error: string;
  severity: 'warn' | 'error' | 'fatal';
  context?: Record<string, unknown>;
}
// 事件 type: 'system.module_error'
```

---

## 9. 時間工具函式

```typescript
/** 比較兩個遊戲日期。回傳負數/0/正數（類似 sort comparator）。 */
function compareGameDate(a: GameDate, b: GameDate): number;

/** a 是否早於或等於 b。 */
function gameDateLte(a: GameDate, b: GameDate): boolean;

/** 距離 a → b 的月數差（可為負）。 */
function monthsBetween(a: GameDate, b: GameDate): number;

/** 在 date 基礎上加 n 個月。 */
function addMonths(date: GameDate, n: number): GameDate;

/** 判斷是否為季末（3/6/9/12 月）。 */
function isQuarterEnd(date: GameDate): boolean;
```

這些工具函式位於 `src/utils/gameDate.ts`，所有模組共用，不重複實作。
