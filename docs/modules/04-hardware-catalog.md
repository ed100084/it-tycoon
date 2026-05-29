# 04 — HardwareCatalog 硬體目錄與採購管理

## 模組職責

HardwareCatalog 管理所有硬體型號的定義（含真實型號、年代解鎖、EOL/EOS 日期）與玩家已持有的硬體資產。它處理採購決策、設備折舊、故障率計算，並在 EOL/EOS 觸發時發出警告。

**單一職責**：硬體型號定義與資產生命週期管理。不直接計算電費（由 FacilityManager）、不計算折舊金額（通知 FinanceEngine 計算）。

---

## 公開介面（Public API）

```typescript
interface IHardwareCatalog extends IGameModule {
  readonly moduleId: 'HardwareCatalog';

  /** 取得當前年份可購買的所有型號（含已鎖定但未來可用的型號）。 */
  getAvailableModels(date: GameDate): HardwareModel[];

  /** 取得特定型號定義。 */
  getModel(modelId: string): HardwareModel | null;

  /** 取得玩家持有的所有硬體資產。 */
  getAssets(): HardwareAsset[];

  /** 取得特定區域的硬體資產。 */
  getAssetsByRegion(region: FacilityRegion): HardwareAsset[];

  /** 取得特定資產詳情。 */
  getAsset(assetId: EntityId): HardwareAsset | null;

  /** 購買硬體（執行採購流程）。回傳採購訂單 ID。 */
  purchase(
    modelId: string,
    quantity: number,
    region: FacilityRegion,
    paymentMethod: PurchasePaymentMethod
  ): PurchaseOrder;

  /** 汰換設備（停止使用並計算殘值收入）。 */
  dispose(assetId: EntityId): DisposalResult;

  /** 計算當前月份所有資產的折舊總額（非現金支出）。 */
  calculateMonthlyDepreciation(): DepreciationSummary;

  /** 取得某設備當前故障率（含 EOL 加成）。 */
  getFailureRate(assetId: EntityId): number;

  /** 取得全部資產的 U 數佔用（by region）。 */
  getTotalUsedUnits(region: FacilityRegion): number;

  /** 取得全部資產的總功耗（by region，單位 W）。 */
  getTotalWatts(region: FacilityRegion): number;

  /** 取得所有 EOL 倒計時 ≤ 3 個月的資產。 */
  getEolWarningAssets(): HardwareAsset[];

  /** 取得所有 EOL 已過期的資產。 */
  getEolExpiredAssets(): HardwareAsset[];
}
```

---

## 核心資料結構

```typescript
/** 硬體型號定義（靜態資料，來自 config）。 */
interface HardwareModel {
  id: string;                    // 型號唯一 ID，如 'DELL_PE2650'
  name: string;                  // 'Dell PowerEdge 2650'
  category: HardwareCategory;
  era: number;                   // 1–5（解鎖年代）
  unlockYear: number;            // 可購買起始年
  eolYear: number;               // EOL 年份
  specs: {
    rackUnits: number;           // 佔用 U 數（UPS/空調等設施設備為 0）
    powerWatts: number;          // 功耗（W）
    serviceCapacity: number;     // VPS 數量或效能倍率
    capacityUnit: CapacityUnit;  // 'vps' | 'colo_clients' | 'storage_multiplier' | 'security_level'
  };
  pricing: {
    basePriceNTD: Money;         // 基礎採購價
    maintenanceRatePerYear: number; // 延保費率（%/年，超出原廠保固後）
    warrantyYears: number;       // 原廠保固年數
  };
  brand: HardwareBrand;
  isEODM: boolean;               // true = ODM 品牌（Supermicro 等），折扣 × 0.75
  isPremium: boolean;            // true = 品牌溢價（IBM/Cisco UCS），× 1.25
  failureRateBase: number;       // 每月基礎故障率（%）
  tags: string[];                // 用於過濾：'gpu', 'ai', 'blade', 'hci', ...
}

enum CapacityUnit {
  VPS            = 'vps',
  ColoClients    = 'colo_clients',
  StorageMult    = 'storage_multiplier',
  SecurityLevel  = 'security_level',
  PowerProtect   = 'power_protect_level',
  PUEReduction   = 'pue_reduction',
  BackupCoverage = 'backup_coverage',
  NetworkPerf    = 'network_perf',
}

enum HardwareBrand {
  Dell       = 'DELL',
  HP_HPE     = 'HP_HPE',
  IBM        = 'IBM',
  Cisco      = 'CISCO',
  Juniper    = 'JUNIPER',
  Arista     = 'ARISTA',
  Fortinet   = 'FORTINET',
  PaloAlto   = 'PALO_ALTO',
  Supermicro = 'SUPERMICRO',
  APC        = 'APC',
  Eaton      = 'EATON',
  Vertiv     = 'VERTIV',
  NetApp     = 'NETAPP',
  PureStorage = 'PURE_STORAGE',
  NVIDIA     = 'NVIDIA',
  Other      = 'OTHER',
}

/** 玩家持有的硬體資產（動態實例）。 */
interface HardwareAsset {
  id: EntityId;
  modelId: string;               // 關聯 HardwareModel.id
  region: FacilityRegion;
  purchaseDate: GameDate;
  purchasePrice: Money;          // 實際採購價（含修正係數）
  bookValue: Money;              // 帳面值（原值 - 累計折舊）
  accumulatedDepreciation: Money;
  status: AssetStatus;
  warrantyExpiry: GameDate;      // 原廠保固到期
  eolDate: GameDate;             // EOL 到期日期
  eolWarningShown: boolean;      // 是否已顯示 EOL 警告
  monthsSinceEOL: number;        // 超過 EOL 的月數（影響故障率）
  maintenanceType: MaintenanceType;
  isEOL: boolean;
  isInstalled: boolean;          // false = 採購中/等待安裝
  installationCompleteDate: GameDate | null;
  purchaseOrderId: EntityId;
}

enum AssetStatus {
  InTransit    = 'IN_TRANSIT',   // 採購中，等待交貨
  Installing   = 'INSTALLING',   // 安裝中
  Active       = 'ACTIVE',       // 正常運行
  Failed       = 'FAILED',       // 故障中
  EOL          = 'EOL',          // EOL 已過期
  Disposed     = 'DISPOSED',     // 已汰換
}

enum MaintenanceType {
  Warranty     = 'WARRANTY',     // 原廠保固內，月費 = 0
  NBD          = 'NBD',          // Next Business Day 延保（× 8%/年）
  FourHour     = 'FOUR_HOUR',    // 4 小時回應延保（× 12%/年）
  ThirdParty   = 'THIRD_PARTY',  // EOL 第三方維護（× 20%/年）
  None         = 'NONE',         // 無維護合約
}

enum PurchasePaymentMethod {
  Cash          = 'CASH',        // 立即全額付款
  Installment   = 'INSTALLMENT', // 分 24 期（含利息）
  RequisitionForm = 'REQUISITION', // 跑簽呈（−25%，等 1 個月）
}

interface PurchaseOrder {
  id: EntityId;
  modelId: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  paymentMethod: PurchasePaymentMethod;
  deliveryDate: GameDate;        // 預計交貨日（含事件延遲）
  status: 'pending' | 'delivered' | 'cancelled';
  installationEngineerRequired: boolean;
}

interface DisposalResult {
  assetId: EntityId;
  salvageValue: Money;           // 回收殘值（帳面值 × 10% 或殘值率）
  date: GameDate;
}

interface DepreciationSummary {
  totalMonthlyDepreciation: Money;
  byAsset: Array<{ assetId: EntityId; amount: Money }>;
}
```

---

## 內部狀態結構

```typescript
interface HardwareCatalogState {
  assets: HardwareAsset[];
  pendingOrders: PurchaseOrder[];
  models: HardwareModel[];       // 從 config 載入，序列化時只存 ID 列表
  econHardwareMod: number;       // 受歷史事件影響（0.7–2.5）
  exchangeRateMod: number;       // 匯率修正
  batchPurchaseDiscount: number; // 科技樹「批量採購協議」解鎖後 = 0.9
  requisitionDiscount: number;   // 跑簽呈折扣 = 0.75
  chipShortageDelay: number;     // 晶片短缺增加的交貨延遲（月數）
  supplyChainDelay: number;      // 海運塞港增加的延遲（月數）
}
```

---

## 故障率計算

```
asset.failureRate = model.failureRateBase × eolMultiplier × maintenanceMultiplier

eolMultiplier:
  monthsSinceEOL = 0    → 1.0（在 EOL 前）
  monthsSinceEOL 1–12   → 1.5
  monthsSinceEOL 13–24  → 2.0
  monthsSinceEOL > 24   → 3.0

maintenanceMultiplier:
  Warranty / NBD / FourHour → 1.0
  ThirdParty               → 1.2
  None                     → 1.5
```

---

## 採購價格計算

```
actualPrice = model.basePriceNTD
            × brandMod        (ODM × 0.75, Premium × 1.25, else × 1.0)
            × econHardwareMod (景氣/短缺影響)
            × exchangeRateMod (進口設備匯率)
            × batchDiscount   (科技樹解鎖後 × 0.90)
            × requisitionDiscount (若選擇跑簽呈 × 0.75)
```

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 推進 EOL 倒計時，計算折舊，檢查到期 |
| `timeline.economic_modifier_changed` | EventTimeline | 更新 econHardwareMod / exchangeRateMod |
| `timeline.chip_shortage` | EventTimeline | 更新 chipShortageDelay 與成本係數 |
| `timeline.supply_chain_disruption` | EventTimeline | 更新 supplyChainDelay |
| `techtree.research_completed` | TechTree | 更新 batchPurchaseDiscount 等採購加成 |
| `security.hardware_compromised` | SecurityEngine | 標記特定資產為故障/受損 |

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `hardware.purchased` | `PurchaseOrder` | 採購訂單建立 |
| `hardware.delivered` | `{ orderId, assetIds[] }` | 設備到貨 |
| `hardware.installed` | `{ assetId, region, watts, units }` | 設備安裝完成 |
| `hardware.removed` | `{ assetId, region, watts, units }` | 設備移除/汰換 |
| `hardware.disposed` | `DisposalResult` | 設備汰換完成（含殘值）|
| `hardware.eol_warning` | `{ assetId, monthsUntilEOL }` | EOL 前 3 個月警告 |
| `hardware.eol_expired` | `{ assetId }` | 硬體 EOL 到期 |
| `hardware.failure` | `HardwareFailureEvent` | 硬體故障觸發事件 |
| `hardware.monthly_depreciation` | `DepreciationSummary` | 月折舊通知給 FinanceEngine |
| `hardware.maintenance_due` | `{ assetId, amount }` | 維護費用通知 |

```typescript
interface HardwareFailureEvent {
  assetId: EntityId;
  modelId: string;
  region: FacilityRegion;
  severity: IncidentSeverity;
  estimatedRepairHours: number;
  isEOL: boolean;
  repairOptions: RepairOption[];
}

interface RepairOption {
  type: 'warranty_repair' | 'third_party_repair' | 'replace_same' | 'replace_upgrade' | 'requisition';
  cost: Money;
  estimatedDowntimeHours: number;
  description: string;
}
```

---

## HardwareConfig 平衡參數

```typescript
interface HardwareConfig {
  models: HardwareModel[];             // 完整型號定義（來自 appendix-hardware-catalog）
  eolWarningMonthsBefore: number;      // 3（提前 3 個月警告）
  eolFailureMultipliers: number[];     // [1.0, 1.5, 2.0, 3.0]（0/1/2/3年後）
  installationDaysPerUnit: number;     // 3（每台需 1 名工程師 3 天）
  largePurchaseThreshold: Money;       // 5_000_000（NT$500 萬，可跑簽呈）
  requisitionDeliveryDelay: number;    // 1（等待 1 個月）
  requisitionDiscount: number;         // 0.75（−25%）
  installmentMonths: number;           // 24
}
```

---

## 與其他模組的交互

```
HardwareCatalog
  ├── 發布 hardware.installed → FacilityManager（更新 usedUnits/totalWatts）
  ├── 發布 hardware.installed → FinanceEngine（資產加入帳面值）
  ├── 發布 hardware.failure → SecurityEngine（可能觸發資安事件）
  ├── 發布 hardware.monthly_depreciation → FinanceEngine（月折舊費用）
  ├── 發布 hardware.eol_warning → TimeEngine（觸發 EOL 提醒暫停）
  ├── 接收 timeline.chip_shortage → 調整採購成本與交貨時間
  └── 接收 techtree.research_completed → 批量採購折扣等加成
```

---

## 未來擴展點

- **硬體租賃（Operating Lease）**：除了買/分期，增加租賃選項（零 CapEx，純 OpEx）。
- **二手市場**：玩家可在二手市場購買較舊的設備（更低成本，但無保固）。
- **零件庫存**：科技樹「庫存備料策略」解鎖後，可維持熱備料以加速故障修復。
