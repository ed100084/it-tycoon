# 05 — SoftwareCatalog 軟體授權管理

## 模組職責

SoftwareCatalog 管理所有軟體產品的定義（作業系統、虛擬化平台、資安工具等）與玩家持有的授權。它追蹤 EOS（End of Support）日期、計算授權費用、評估合規分數，並在 EOS 到期時發出警告與合規懲罰。

**單一職責**：軟體授權生命週期與合規分數管理。不處理資安事件（由 SecurityEngine），不直接呼叫 FinanceEngine（透過事件）。

---

## 公開介面（Public API）

```typescript
interface ISoftwareCatalog extends IGameModule {
  readonly moduleId: 'SoftwareCatalog';

  /** 取得當前年份可購買的軟體產品列表。 */
  getAvailableProducts(date: GameDate): SoftwareProduct[];

  /** 取得特定產品定義。 */
  getProduct(productId: string): SoftwareProduct | null;

  /** 取得玩家持有的授權列表。 */
  getLicenses(): SoftwareLicense[];

  /** 取得特定授權。 */
  getLicense(licenseId: EntityId): SoftwareLicense | null;

  /** 購買/訂閱軟體授權。 */
  purchaseLicense(productId: string, serverId?: EntityId): SoftwareLicense;

  /** 取消訂閱（年訂閱型）。 */
  cancelSubscription(licenseId: EntityId): boolean;

  /** 升級至新版本（永久授權 + SA 或新訂閱）。 */
  upgrade(licenseId: EntityId, targetVersion: string): SoftwareLicense;

  /** 取得整體合規分數（0–100）。 */
  getComplianceScore(): number;

  /** 取得所有 EOS 警告中的授權。 */
  getEosWarningLicenses(): SoftwareLicense[];

  /** 取得所有 EOS 已過期的授權（資安風險源）。 */
  getEosExpiredLicenses(): SoftwareLicense[];

  /** 計算當月所有授權的費用總計。 */
  calculateMonthlyLicenseCost(): Money;

  /** 取得虛擬化密度加成（所有已啟用虛擬化平台的加成合計）。 */
  getVirtualizationDensityBonus(): number;
}
```

---

## 核心資料結構

```typescript
/** 軟體產品定義（靜態資料，來自 config）。 */
interface SoftwareProduct {
  id: string;                    // 如 'VMWARE_VSPHERE_8'
  name: string;                  // 'VMware vSphere 8'
  category: SoftwareCategory;
  licenseType: LicenseType;
  vendor: string;
  unlockYear: number;
  eosYear: number;               // End of Support 年份
  eosMonth?: number;             // 若已知具體月份（如 MySQL 5.7 = 10 月）
  annualCostNTD: Money;          // 年授權費（永久授權則為 SA 年費）
  effects: SoftwareEffect[];     // 解鎖效果
  isFreeOpenSource: boolean;     // true = 零授權費
  upgradePathFrom?: string[];    // 可由哪些舊版本升級
  notes?: string;               // 特殊說明（如 VMware Broadcom 漲價）
}

interface SoftwareEffect {
  type: SoftwareEffectType;
  value: number;                 // 倍率或加成量
}

enum SoftwareEffectType {
  VirtualizationDensity  = 'VIRT_DENSITY',     // 伺服器密度倍率
  StoragePerformance     = 'STORAGE_PERF',      // 儲存效能倍率
  BackupCoverage         = 'BACKUP_COVERAGE',   // 備份覆蓋率
  SecurityDetection      = 'SEC_DETECTION',     // 事件偵測率加成
  IncidentResponseTime   = 'IRT_REDUCTION',     // 處理時間 × (1-value)
  ComplianceScore        = 'COMPLIANCE_SCORE',  // 合規分數加成
}

/** 玩家持有的軟體授權（動態實例）。 */
interface SoftwareLicense {
  id: EntityId;
  productId: string;
  version: string;
  licenseType: LicenseType;
  purchaseDate: GameDate;
  renewalDate: GameDate;         // 下次續費日期
  eosDate: GameDate;             // EOS 到期日期
  eosWarningShown: boolean;
  monthsSinceEOS: number;
  status: LicenseStatus;
  assignedServerIds: EntityId[]; // 部署在哪些伺服器（null = 全局）
  annualCostNTD: Money;          // 當前有效年費（含漲價事件）
  isAutoRenew: boolean;
  complianceRiskLevel: ComplianceRiskLevel;
}

enum LicenseStatus {
  Active       = 'ACTIVE',
  EosWarning   = 'EOS_WARNING',  // EOS 前 3 個月
  EosExpired   = 'EOS_EXPIRED',  // 已超過 EOS
  Cancelled    = 'CANCELLED',
  Upgrading    = 'UPGRADING',    // 升級進行中
}

enum ComplianceRiskLevel {
  None    = 'NONE',    // 完全合規
  Low     = 'LOW',     // EOS 前 3 個月警告中
  Medium  = 'MEDIUM',  // EOS 後第 1 季
  High    = 'HIGH',    // EOS 後第 2 季
  Critical = 'CRITICAL', // EOS 後 6 個月以上
}
```

---

## 內部狀態結構

```typescript
interface SoftwareCatalogState {
  licenses: SoftwareLicense[];
  products: SoftwareProduct[];   // 靜態定義，序列化時只存已購買的 productId
  complianceScore: number;       // 0–100
  complianceModifiers: ComplianceModifier[]; // 各授權對合規分數的貢獻
  eosRiskMultiplier: number;     // 所有 EOS 過期授權造成的資安事件頻率乘數
  activeVMwareCost: Money;       // VMware Broadcom 漲價後的實際年費（特殊處理）
}

interface ComplianceModifier {
  licenseId: EntityId;
  delta: number;                 // 正值 = 加分，負值 = 扣分
  reason: string;
}
```

---

## EOS 效果計算

```
EOS 警告（EOS 前 3 個月）：
  complianceScore += 0（尚無效果，只顯示警告）

EOS 後第 1 季（1–3 個月後）：
  資安事件頻率 × 1.2（+20%）
  complianceScore -= 30

EOS 後第 2 季（4–6 個月後）：
  資安事件頻率 × 1.5（+50%）
  稽核風險 × 1.3
  complianceScore -= 50

EOS 後第 3 季及以後（7 個月後）：
  資安事件頻率 × 2.0（+100%）
  強制合規罰款每季觸發
  complianceScore -= 70
```

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 推進 EOS 倒計時，更新合規分數，計算授權費 |
| `timeline.software_price_change` | EventTimeline | VMware Broadcom 漲價等事件 |
| `timeline.eos_forced` | EventTimeline | 強制 EOS 事件（如 CentOS 8 提前終止）|

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `software.license_purchased` | `SoftwareLicense` | 授權購買完成 |
| `software.eos_warning` | `{ licenseId, monthsUntilEOS }` | EOS 前 3 個月警告 |
| `software.eos_expired` | `{ licenseId, productId }` | EOS 到期 |
| `software.compliance_changed` | `{ score, delta, reason }` | 合規分數變動 |
| `software.license_fee_due` | `{ totalAmount, breakdown[] }` | 月授權費帳單 |
| `software.compliance_penalty` | `{ amount, reason }` | 合規罰款（通知 FinanceEngine）|
| `software.eos_security_modifier` | `{ multiplier }` | 資安事件頻率修正值（通知 SecurityEngine）|
| `software.virtualization_changed` | `{ densityBonus }` | 虛擬化密度加成更新 |

---

## SoftwareConfig 平衡參數

```typescript
interface SoftwareConfig {
  products: SoftwareProduct[];          // 完整軟體產品定義
  eosWarningMonthsBefore: number;       // 3
  eosSecurityMultipliers: {
    quarter1: number;                   // 1.2
    quarter2: number;                   // 1.5
    quarter3plus: number;               // 2.0
  };
  eosComplianceScorePenalty: {
    quarter1: number;                   // -30
    quarter2: number;                   // -50
    quarter3plus: number;               // -70
  };
  compliancePenaltyAmount: Money;       // 每季強制罰款（EOS 後第 3 季）
  vmwareBroadcomPriceMultiplier: number; // 2.5（2023/10 事件）
  centos8ForcedEOSDate: GameDate;       // { year: 2021, month: 12 }
}
```

---

## 與其他模組的交互

```
SoftwareCatalog
  ├── 接收 time.month_end → 計算授權費並發布 software.license_fee_due
  ├── 接收 timeline.software_price_change → 更新 VMware 等授權費用
  ├── 發布 software.license_fee_due → FinanceEngine 扣款
  ├── 發布 software.compliance_penalty → FinanceEngine 扣款
  ├── 發布 software.eos_security_modifier → SecurityEngine 更新事件頻率
  ├── 發布 software.eos_warning → TimeEngine（顯示提醒，可選自動暫停）
  ├── 發布 software.virtualization_changed → ContractManager（服務容量更新）
  └── 發布 software.compliance_changed → SecurityEngine（合規稽核事件觸發率）
```

---

## 未來擴展點

- **授權合規稽核**：未授權使用的軟體（用量超過授權數量）觸發稽核罰款。
- **軟體庫存管理**：追蹤未使用的授權（可退還年訂閱以節省成本）。
- **開源遷移事件**：CentOS → Rocky Linux 的遷移項目化（消耗工程師工時）。
