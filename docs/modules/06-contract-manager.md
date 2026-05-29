# 06 — ContractManager 合約管理

## 模組職責

ContractManager 管理客戶合約的完整生命週期：RFP 接收、投標決策、合約履行、SLA 追蹤、到期/續約、客戶流失。它是遊戲主要的**收入來源管理員**，負責將月費入帳通知 FinanceEngine，並計算 SLA 違約賠償。

**單一職責**：合約與客戶關係管理。不計算服務容量（由 FacilityManager/HardwareCatalog），不計算滿意度（由 ReputationEngine）。

---

## 公開介面（Public API）

```typescript
interface IContractManager extends IGameModule {
  readonly moduleId: 'ContractManager';

  /** 取得所有活躍合約。 */
  getActiveContracts(): Contract[];

  /** 取得特定合約。 */
  getContract(contractId: EntityId): Contract | null;

  /** 取得待處理的 RFP 列表。 */
  getPendingRFPs(): RFP[];

  /** 取得特定 RFP。 */
  getRFP(rfpId: EntityId): RFP | null;

  /** 投標 RFP。回傳競標結果（通常在 1 個月後）。 */
  submitBid(rfpId: EntityId, bid: BidParams): BidSubmission;

  /** 放棄 RFP。 */
  declineRFP(rfpId: EntityId): void;

  /** 接受合約續約。 */
  renewContract(contractId: EntityId, params: RenewalParams): Contract;

  /** 拒絕合約續約（讓合約到期）。 */
  declineRenewal(contractId: EntityId): void;

  /** 取得當月預估總收入。 */
  getMonthlyRevenueEstimate(): Money;

  /** 取得 SLA 達成率儀表板資料。 */
  getSLADashboard(): SLADashboard;

  /** 取得所有合約的歷史（含已流失/到期）。 */
  getContractHistory(limit?: number): Contract[];

  /** 取得活躍合約數量（用於里程碑條件）。 */
  getActiveContractCount(): number;
}
```

---

## 核心資料結構

```typescript
interface RFP {
  id: EntityId;
  clientId: EntityId;
  clientName: string;
  clientTier: CustomerTier;
  serviceType: ServiceType;
  budgetRange: { min: Money; max: Money };
  contractDurationMonths: number;       // 1–60
  slaRequirement: number;               // 99.5 / 99.9 / 99.95 / 99.99
  specialRequirements: SpecialRequirement[];
  expiresAt: GameDate;                  // RFP 有效期（通常 1 個月）
  estimatedFeasibility: FeasibilityReport;
  competitorPresence: boolean;          // 是否有競爭對手也在投標
  generatedDate: GameDate;
}

interface SpecialRequirement {
  type: 'iso27001' | 'three_shift' | 'geo_redundancy' | 'gpu_nodes' | 'custom';
  description: string;
  isMet: boolean;                       // 由系統即時評估
}

interface FeasibilityReport {
  spaceOk: boolean;
  techStackOk: boolean;
  staffOk: boolean;
  slaAchievable: boolean;
  missingRequirements: string[];
}

interface BidParams {
  monthlyFeeNTD: Money;
  slaLevel: number;                     // 可低於 RFP 要求（降級投標）
  contractDurationMonths: number;
  breachPenaltyMultiplier: number;      // 違約金條款（1.0–5.0）
  specialServices: ServiceType[];       // 加值服務附加
}

interface BidSubmission {
  rfpId: EntityId;
  bid: BidParams;
  submittedAt: GameDate;
  resultExpectedAt: GameDate;           // 1 個月後
  winProbability: number;               // 0–1，供 UI 顯示參考
}

interface Contract {
  id: EntityId;
  clientId: EntityId;
  clientName: string;
  clientTier: CustomerTier;
  serviceType: ServiceType;
  status: ContractStatus;
  monthlyFeeNTD: Money;
  slaLevel: number;                     // 99.5 / 99.9 / 99.95 / 99.99
  startDate: GameDate;
  endDate: GameDate;
  renewalNoticeMonths: number;          // 到期前幾個月發出續約通知（預設 1）
  breachPenaltyMultiplier: number;
  specialServices: ServiceType[];
  slaRecord: SLAMonthRecord[];          // 每月 SLA 達成記錄
  clientSatisfaction: number;           // 0–100，本合約的滿意度
  totalRevenue: Money;                  // 累計收入
  totalPenaltiesPaid: Money;            // 累計賠償
}

interface SLAMonthRecord {
  date: GameDate;
  uptimePercent: number;
  slaBreached: boolean;
  penaltyAmount: Money;
  incidentIds: EntityId[];
}

interface RenewalParams {
  newMonthlyFeeNTD: Money;
  newDurationMonths: number;
  newSlaLevel?: number;
}

interface SLADashboard {
  overallSLARate: number;               // 全合約平均達成率
  atRiskContracts: Array<{
    contractId: EntityId;
    clientName: string;
    monthlyFee: Money;
    slaRate: number;
  }>;
  monthlySLASummary: Array<{
    date: GameDate;
    breachCount: number;
    totalPenalties: Money;
  }>;
}
```

---

## 內部狀態結構

```typescript
interface ContractManagerState {
  contracts: Contract[];
  pendingRFPs: RFP[];
  pendingBids: BidSubmission[];         // 等待結果的投標
  clientDatabase: ClientRecord[];       // 已知客戶記錄（滿意度、歷史）
  rfpGenerationCooldown: number;        // 距離下次 RFP 生成的月數
  rfpFrequencyMod: number;              // RFP 頻率修正（歷史事件影響）
  serviceCapacity: ServiceCapacityState; // 即時服務容量快照（從各模組彙整）
  geoRedundancyBonus: number;           // FacilityManager 提供的 SLA 違約風險係數
}

interface ClientRecord {
  id: EntityId;
  name: string;
  tier: CustomerTier;
  industryType: string;
  satisfactionHistory: Array<{ date: GameDate; score: number }>;
  contractCount: number;
  churned: boolean;
  churnReason?: string;
}

interface ServiceCapacityState {
  availableUnits: number;               // 可用機架 U 數
  totalVPSCapacity: number;             // 可服務的 VPS 客戶數
  hasMSPStaff: boolean;                 // 工程師數 ≥ 5
  hasISO27001: boolean;                 // ISO 27001 認證
  hasGPUNodes: boolean;                 // 擁有 GPU 節點
  hasGeoRedundancy: boolean;            // 異地備援啟用
  staffCoverageRatio: number;           // 人力覆蓋率
}
```

---

## RFP 生成邏輯

```
每月結算後，根據以下條件生成 0–3 個 RFP：

baseRFPsPerMonth = 1.5
× rfpFrequencyMod（歷史事件調整，0.5–3.0）
× creditRatingBonus（AAA = ×1.3，B = ×0.5）
× satisfactionBonus（整體滿意度 > 80 → ×1.2）

RFP 客戶等級分布（依遊戲年份逐漸解鎖更高層級）：
  2000–2004: 80% 個人/SMB，20% 企業
  2005–2009: 50% SMB，35% 企業，15% 政府
  2010+:     40% 企業，30% 政府，30% 跨國（需 ISO 27001）
```

---

## SLA 違約計算

```
月度 SLA 達成率 = (720 - 中斷時間(hr)) / 720 × 100

若達成率 < slaLevel：
  breachHours = 中斷時間 - 可容許中斷時間
  penaltyMultiplier（依 slaLevel 和事件嚴重度）：
    99.5% + P2 超時   → × 0.10
    99.9% + P1 超時   → × 0.50
    99.95% + P1       → × 1.00
    99.99% + P1       → × 2.00
    99.99% + 資料外洩 → × 5.00

月賠償 = contract.monthlyFeeNTD × penaltyMultiplier
月賠償上限 = 當月總合約收入 × 3.0（破產保護上限）
```

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 月費入帳、SLA 計算、到期/續約檢查、RFP 生成 |
| `security.incident_triggered` | SecurityEngine | 更新受影響合約的停機時間 |
| `security.incident_resolved` | SecurityEngine | 停機結束，計算 SLA 損失 |
| `facility.geo_redundancy_changed` | FacilityManager | 更新 SLA 違約風險係數 |
| `staff.coverage_changed` | StaffManager | 更新服務容量快照 |
| `hardware.installed` | HardwareCatalog | 更新服務容量快照 |
| `techtree.research_completed` | TechTree | 解鎖新服務類型（如 DRaaS、MSSP）|
| `reputation.satisfaction_changed` | ReputationEngine | 更新客戶滿意度，影響續約/流失機率 |
| `finance.credit_rating_changed` | FinanceEngine | 更新 RFP 頻率係數 |
| `timeline.rfp_boost` | EventTimeline | 歷史事件觸發 RFP 暴增（如 Y2K、911、COVID）|

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `contract.rfp_received` | `RFP` | 新 RFP 到達（強制暫停）|
| `contract.bid_won` | `{ rfpId, contract }` | 投標成功，合約簽署 |
| `contract.bid_lost` | `{ rfpId, reason }` | 投標失敗 |
| `contract.signed` | `Contract` | 新合約生效 |
| `contract.revenue_collected` | `{ contractId, amount, date }` | 月費入帳 |
| `contract.sla_breach_penalty` | `{ contractId, amount, reason }` | SLA 賠償 |
| `contract.expiry_warning` | `{ contractId, monthsUntilExpiry }` | 到期前 1 個月 |
| `contract.renewal_decision` | `{ contractId }` | 需要續約決策（強制暫停）|
| `contract.renewed` | `Contract` | 合約續約成功 |
| `contract.terminated` | `{ contractId, reason, clientId }` | 合約提前終止 |
| `contract.expired` | `{ contractId, clientId }` | 合約到期（未續約）|

---

## ContractConfig 平衡參數

```typescript
interface ContractConfig {
  rfpResponseWindowMonths: number;      // 1
  renewalNoticeMonths: number;          // 1
  baseRFPsPerMonth: number;             // 1.5
  slaBreachPenaltyMultipliers: Record<string, number>;
  maxMonthlyPenaltyCap: number;         // 3.0（月收入 ×3 上限）
  churnProbabilities: {
    dataBreachAndLate: number;          // 0.70
    consecutiveSLABreach: number;       // 0.50
    p1Over24Hours: number;              // 0.40
    lowSatisfactionProlonged: number;   // 0.30
    competitorOffer: number;            // 0.20
  };
  clientTierSLARequirements: Record<CustomerTier, number>;
  rfpFrequencyModByEvent: Record<string, number>;
}
```

---

## 與其他模組的交互

```
ContractManager
  ├── 接收 time.month_end → 月費入帳、SLA 結算、RFP 生成
  ├── 接收 security.incident → 計算停機時間 → SLA 違約賠償
  ├── 接收 reputation.satisfaction_changed → 合約流失/續約機率調整
  ├── 發布 contract.revenue_collected → FinanceEngine 入帳
  ├── 發布 contract.sla_breach_penalty → FinanceEngine 扣款
  ├── 發布 contract.rfp_received → TimeEngine 強制暫停
  ├── 發布 contract.renewal_decision → TimeEngine 強制暫停
  └── 發布 contract.terminated → ReputationEngine（口碑影響）
```

---

## 未來擴展點

- **多輪談判**：RFP 投標後客戶可以反還價，玩家決定是否接受。
- **合約修改**：活躍合約中途談判修改 SLA 或月費條款。
- **白名單客戶**：長期高滿意度客戶優先推送 RFP，形成忠誠關係。
