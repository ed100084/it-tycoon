# 03 — FacilityManager 機房設施管理

## 模組職責

FacilityManager 管理實體機房空間：三個地理區域的機架容量、電力系統、冷卻系統與 PUE 等級。它計算每月電費並通知 FinanceEngine，追蹤機房使用率，並控制區域解鎖條件。

**單一職責**：實體基礎設施（空間/電力/冷卻）的管理與費用計算。不管理設備本身的邏輯（由 HardwareCatalog 負責）。

---

## 公開介面（Public API）

```typescript
interface IFacilityManager extends IGameModule {
  readonly moduleId: 'FacilityManager';

  /** 取得所有已解鎖區域的狀態。 */
  getRegions(): FacilityRegionState[];

  /** 取得特定區域狀態。 */
  getRegion(region: FacilityRegion): FacilityRegionState | null;

  /** 取得全域 PUE（加權平均）。 */
  getGlobalPUE(): number;

  /** 嘗試解鎖新區域（達成條件時呼叫）。 */
  unlockRegion(region: FacilityRegion): boolean;

  /** 計算指定區域本月預估電費。 */
  estimateMonthlyElectricity(region: FacilityRegion): Money;

  /** 取得全局每月總電費預估。 */
  getTotalMonthlyElectricity(): Money;

  /** 取得全局每月總租金。 */
  getTotalMonthlyRent(): Money;

  /** 升級指定區域的冷卻等級（需支付投資費用）。 */
  upgradeCooling(region: FacilityRegion, level: CoolingLevel): boolean;

  /** 擴建指定區域容量（成本 = 當前月租 × 24，容量 × 0.5）。 */
  expandCapacity(region: FacilityRegion): boolean;

  /** 指派工程師為某區域駐點（影響該區故障處理速度）。 */
  assignEngineer(region: FacilityRegion, staffId: EntityId): void;

  /** 取得各區域已使用 U 數（由 HardwareCatalog 更新）。 */
  getUsedUnits(region: FacilityRegion): number;

  /** 是否達成異地備援條件（三區各 ≥ 50% 使用率）。 */
  hasGeoRedundancy(): boolean;

  /** 是否啟用了指定 PUE 等級（全域）。 */
  hasCoolingLevel(level: CoolingLevel): boolean;
}
```

---

## 核心資料結構

```typescript
interface FacilityRegionState {
  region: FacilityRegion;
  isUnlocked: boolean;
  totalUnits: number;            // 總機架 U 數
  usedUnits: number;             // 已安裝設備的 U 數（由 Hardware 更新）
  utilizationRate: number;       // usedUnits / totalUnits
  coolingLevel: CoolingLevel;
  pue: number;                   // 當前有效 PUE（冷卻等級決定）
  totalWatts: number;            // 所有設備功耗加總（W）
  monthlyRent: Money;
  assignedStaffIds: EntityId[];
  climateRisk: ClimateRisk;      // 影響隨機停電/颱風事件頻率
  unlockCondition: UnlockCondition;
  expansionCount: number;        // 已擴建次數
}

enum CoolingLevel {
  Open       = 0,   // 開放式機架，PUE 2.00
  BasicAC    = 1,   // 基礎空調，PUE 1.80
  HotAisle   = 2,   // 熱通道封閉，PUE 1.60
  Chiller    = 3,   // 冰水主機，PUE 1.40
  InRow      = 4,   // In-Row 冷卻，PUE 1.25
  Liquid     = 5,   // 液冷系統，PUE 1.10
  Immersion  = 6,   // 浸沒式冷卻，PUE 1.05（AI GPU 必需）
}

enum ClimateRisk {
  Low    = 'LOW',
  Medium = 'MEDIUM',
  High   = 'HIGH',   // 南區：颱風、地震
}

interface UnlockCondition {
  minMonthlyRevenue?: Money;     // 中區：月收入 ≥ NT$100 萬
  minMonthlyRevenueForSouth?: Money; // 南區：月收入 ≥ NT$1,000 萬
}
```

---

## 內部狀態結構

```typescript
interface FacilityManagerState {
  regions: Record<FacilityRegion, FacilityRegionState>;
  globalPUEBonus: number;        // 科技樹「節能認證」加成（−0.05）
  electricityRateHistory: ElectricityRate[];  // 時代電費單價
  currentElectricityRate: number;  // NT$/kWh，受歷史事件修正
  econElecMod: number;           // 電費倍率修正（0.8–2.5，受事件影響）
  geoRedundancyActive: boolean;  // 異地備援加成是否生效
}

interface ElectricityRate {
  fromYear: number;
  ratePerKwh: number;            // NT$/kWh
}
```

---

## 電費計算公式

```
月電費（per region）=
  Σ(設備功耗 W) × 744 小時 × 電費單價(NT$/kWh) × PUE / 1000

全局電費 = Σ 各區電費 × econElecMod

PUE（per region）= coolingLevel.basePUE
                  − techTree.energyCertBonus（若已解鎖）
                  − techTree.greenEnergyBonus（若已解鎖）
                  + climateEvent.puePenalty（颱風/高溫事件時）
```

每月推進時，FacilityManager 計算各區電費與租金，發布 `facility.electricity_due` 和 `facility.rent_due` 給 FinanceEngine 入帳。

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 計算並發布本月電費/租金 |
| `hardware.installed` | HardwareCatalog | 更新區域 usedUnits 與 totalWatts |
| `hardware.removed` | HardwareCatalog | 減少 usedUnits 與 totalWatts |
| `finance.monthly_settlement` | FinanceEngine | 確認月收入，檢查區域解鎖條件 |
| `techtree.research_completed` | TechTree | 應用節能/冷卻科技加成 |
| `timeline.electricity_rate_changed` | EventTimeline | 更新電費單價與 econElecMod |
| `timeline.climate_event` | EventTimeline | 觸發颱風/停電的 PUE 臨時懲罰 |

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `facility.electricity_due` | `{ region, amount, date }` | 電費帳單 |
| `facility.rent_due` | `{ region, amount, date }` | 租金帳單 |
| `facility.capacity_warning` | `{ region, utilizationRate }` | 容量 > 85% 警告 |
| `facility.region_unlocked` | `{ region }` | 新區域解鎖 |
| `facility.expansion_completed` | `{ region, newCapacity }` | 擴建完成 |
| `facility.cooling_upgraded` | `{ region, level, newPUE }` | 冷卻升級完成 |
| `facility.pue_changed` | `{ region, oldPUE, newPUE }` | PUE 變動（科技/事件）|
| `facility.geo_redundancy_changed` | `{ active }` | 異地備援狀態變動 |
| `facility.power_failure` | `{ region, duration }` | 停電事件（觸發 SecurityEngine）|

---

## FacilityConfig 平衡參數

```typescript
interface FacilityConfig {
  regions: Record<FacilityRegion, {
    initialUnits: number;           // 北 100U / 中 500U / 南 2000U
    baseMonthlyRent: Money;         // 北 200,000 / 中 800,000 / 南 2,500,000
    performanceBonus: number;       // 北 1.00 / 中 1.15 / 南 1.30
    climateRisk: ClimateRisk;
    unlockCondition: UnlockCondition;
  }>;
  coolingLevels: Record<CoolingLevel, {
    pue: number;
    investmentCost: Money;
    unlockYear: number;
  }>;
  expansionCostMultiplier: number;  // 24（月租 × 24 = 擴建成本）
  expansionCapacityMultiplier: number; // 0.5（容量 × 0.5 = 擴建增量）
  capacityWarningThreshold: number; // 0.85
  geoRedundancyThreshold: number;   // 0.50（各區 ≥ 50% 使用率）
  geoRedundancySLABonus: number;    // −0.30（SLA 違約風險 −30%）
  electricityRates: ElectricityRate[];
  hoursePerMonth: number;           // 744
}
```

---

## 與其他模組的交互

```
FacilityManager
  ├── 接收 hardware.installed/removed → 更新 usedUnits, totalWatts
  ├── 接收 techtree.research_completed → 更新 PUE 加成
  ├── 接收 timeline.electricity_rate_changed → 更新電費單價
  ├── 發布 facility.electricity_due → FinanceEngine 扣款
  ├── 發布 facility.rent_due → FinanceEngine 扣款
  ├── 發布 facility.capacity_warning → TimeEngine 暫停（P3 提示）
  ├── 發布 facility.geo_redundancy_changed → ContractManager 更新 SLA 違約風險係數
  └── 發布 facility.power_failure → SecurityEngine 觸發電力異常事件
```

---

## 未來擴展點

- **DCIM 整合**：解鎖 Schneider EcoStruxure 後，提供每機架電力監控詳細資料。
- **機房選址決策**：未來版本可讓玩家選擇不同城市（不同電費/租金/風險）。
- **PDU 智能管理**：區域內可細分 PDU 分配，影響備援設計。
