# 10 — TechTree 科技樹

## 模組職責

TechTree 管理玩家的**管理能力投資**：40 個科技節點的解鎖條件、前置需求、投資費用、導入進度與效果套用。它代表公司的長期能力建設（ISO 認證、ITSM、自動化平台等），效果永久生效。

**單一職責**：科技節點的狀態管理與效果廣播。不直接修改其他模組狀態，只透過事件通知各模組套用加成。

---

## 公開介面（Public API）

```typescript
interface ITechTree extends IGameModule {
  readonly moduleId: 'TechTree';

  /** 取得所有科技節點狀態。 */
  getNodes(): TechNode[];

  /** 取得特定節點。 */
  getNode(nodeId: string): TechNode | null;

  /** 取得可以立即開始研究的節點（前置已完成，年份符合，尚未開始）。 */
  getAvailableNodes(currentDate: GameDate): TechNode[];

  /** 取得正在進行中的研究節點。 */
  getInProgressNodes(): TechNode[];

  /** 取得已完成的節點。 */
  getCompletedNodes(): TechNode[];

  /** 開始研究指定節點（支付費用，進入倒計時）。
   *  回傳 false 若條件不符（資金不足/前置未完成/年份不到）。 */
  startResearch(nodeId: string): boolean;

  /** 取消正在進行的研究（退回 50% 費用）。 */
  cancelResearch(nodeId: string): boolean;

  /** 取得節點效果的摘要（已完成節點對遊戲的全局影響）。 */
  getActiveEffects(): TechTreeEffect[];

  /** 是否已解鎖特定節點（用於條件判斷）。 */
  isNodeCompleted(nodeId: string): boolean;

  /** 取得特定互斥組的節點（選一則另一鎖定）。 */
  getMutuallyExclusiveGroup(groupId: string): TechNode[];

  /** 取得目前已完成節點數（用於里程碑條件）。 */
  getCompletedNodeCount(): number;
}
```

---

## 核心資料結構

```typescript
interface TechNode {
  id: string;                          // 如 'VIRTUALIZATION'
  name: string;                        // '虛擬化導入'
  category: TechCategory;
  description: string;
  effects: TechNodeEffect[];
  prerequisites: string[];             // 前置節點 ID 列表
  mutuallyExclusiveWith?: string[];    // 互斥節點 ID
  mutuallyExclusiveGroupId?: string;   // 互斥組 ID
  investmentCostNTD: Money;            // 前期費用（一次性）
  implementationMonths: number;        // 導入所需月數（1–6）
  unlockYear: number;                  // 可開始的最早年份
  status: TechNodeStatus;
  progressMonths: number;              // 已完成的導入月數
  startedAt: GameDate | null;
  completedAt: GameDate | null;
}

enum TechCategory {
  Infrastructure  = 'INFRASTRUCTURE',
  Performance     = 'PERFORMANCE',
  CostControl     = 'COST_CONTROL',
  SpaceInnovation = 'SPACE_INNOVATION',
  Management      = 'MANAGEMENT',
  ScaleEconomy    = 'SCALE_ECONOMY',
  HRManagement    = 'HR_MANAGEMENT',
  SecurityDefense = 'SECURITY_DEFENSE',
  SupplyChain     = 'SUPPLY_CHAIN',
  RiskControl     = 'RISK_CONTROL',
  CloudCompete    = 'CLOUD_COMPETE',
  AIInfra         = 'AI_INFRA',
}

interface TechNodeEffect {
  type: TechEffectType;
  value: number;                       // 倍率或百分比值
  description: string;
}

enum TechEffectType {
  // FacilityManager
  PUEReduction            = 'PUE_REDUCTION',
  CapacityBonus           = 'CAPACITY_BONUS',
  ExpansionCostReduction  = 'EXPANSION_COST_REDUCTION',
  // HardwareCatalog
  HardwareCostReduction   = 'HARDWARE_COST_REDUCTION',
  ChipShortageReduction   = 'CHIP_SHORTAGE_REDUCTION',
  ExchangeRateReduction   = 'EXCHANGE_RATE_REDUCTION',
  // SoftwareCatalog / SecurityEngine
  ComplianceBonus         = 'COMPLIANCE_BONUS',
  SecurityEventReduction  = 'SECURITY_EVENT_REDUCTION',
  RansomwareImmunity      = 'RANSOMWARE_IMMUNITY',  // 備份架構升級
  DDoSReduction           = 'DDOS_REDUCTION',
  APTDetectionBonus       = 'APT_DETECTION_BONUS',
  SocialEngReduction      = 'SOCIAL_ENG_REDUCTION',
  // ContractManager
  SLABreachRateReduction  = 'SLA_BREACH_REDUCTION',
  ServiceUnlock           = 'SERVICE_UNLOCK',        // 解鎖新服務類型
  // StaffManager
  ManagementCapacityBonus = 'MGMT_CAPACITY_BONUS',
  PromotionTimeReduction  = 'PROMOTION_TIME_REDUCTION',
  ResignationRateReduction = 'RESIGNATION_REDUCTION',
  // FinanceEngine
  CreditRatingBonus       = 'CREDIT_RATING_BONUS',
  InsuranceCostReduction  = 'INSURANCE_COST_REDUCTION',
  // TimeEngine / General
  PurchaseDelayReduction  = 'PURCHASE_DELAY_REDUCTION',
  IncidentResponseBonus   = 'INCIDENT_RESPONSE_BONUS',
  AuditPassRateBonus      = 'AUDIT_PASS_RATE_BONUS',
  // AI
  AIServiceRevenueBonus   = 'AI_SERVICE_REVENUE_BONUS',
  AICapacityBonus         = 'AI_CAPACITY_BONUS',
}

interface TechTreeEffect {
  nodeId: string;
  nodeName: string;
  type: TechEffectType;
  value: number;
  description: string;
}
```

---

## 內部狀態結構

```typescript
interface TechTreeState {
  nodes: TechNode[];
  completedNodeIds: Set<string>;       // 快速查詢
  inProgressNodeIds: Set<string>;      // 快速查詢
  lockedNodeIds: Set<string>;          // 互斥鎖定
  totalInvestmentNTD: Money;           // 累計投資總額
}
```

---

## 完整節點清單

依類別列出（共 40 節點）：

### 基礎設施（Infrastructure）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `VIRTUALIZATION` | 虛擬化導入 | 2001 | 300,000 | 2 | — |
| `STORAGE_VIRT` | 儲存虛擬化 | 2005 | 600,000 | 3 | VIRTUALIZATION |
| `CONTAINERIZATION` | 容器化架構 | 2013 | 1,000,000 | 4 | VIRTUALIZATION |
| `K8S_ORCHESTRATION` | K8s 自動調度 | 2015 | 2,000,000 | 6 | CONTAINERIZATION |

### 效能優化（Performance）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `NVME_CACHE` | NVMe 快取 | 2012 | 500,000 | 1 | — |
| `GPU_ACCELERATION` | GPU 加速 | 2016 | 1,200,000 | 2 | NVME_CACHE |
| `AI_INFERENCE_OPT` | AI 推論最佳化 | 2020 | 2,000,000 | 3 | GPU_ACCELERATION |

### 成本控管（Cost Control）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `POWER_FUTURES` | 電力期貨合約 | 2003 | 500,000 | 1 | — |
| `ENERGY_CERT` | 節能認證 | 2008 | 1,000,000 | 2 | POWER_FUTURES |
| `GREEN_ENERGY` | 綠能發電 | 2013 | 1,500,000 | 4 | ENERGY_CERT |

### 空間革新（Space Innovation）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `HIGH_DENSITY_RACK` | 高密度機架 | 2006 | 800,000 | 2 | — |
| `MODULAR_EXPANSION` | 模組化擴建 | 2010 | 1,500,000 | 3 | HIGH_DENSITY_RACK |

### 管理升級（Management）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `PROCESS_AUTOMATION` | 流程自動化 | 2002 | 500,000 | 2 | — |
| `AUDIT_READINESS` | 稽核準備系統 | 2005 | 1,000,000 | 2 | PROCESS_AUTOMATION |
| `ITSM_PLATFORM` | ITSM 平台 | 2008 | 1,200,000 | 3 | PROCESS_AUTOMATION |
| `ISO27001` | ISO 27001 認證 | 2004 | 2,000,000 | 6 | ITSM_PLATFORM |

### 規模經濟（Scale Economy）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `BULK_PURCHASE` | 批量採購協議 | 2003 | 800,000 | 1 | — |

### 人力管理（HR Management）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `AUTOMATION_OPS` | 自動化運維 | 2008 | 1,200,000 | 3 | PROCESS_AUTOMATION |
| `AIOPS_MONITORING` | AIOps 智能監控 | 2016 | 2,000,000 | 4 | AUTOMATION_OPS |
| `TALENT_PROGRAM` | 人才培育計畫 | 2005 | 800,000 | 2 | — |

### 資安防禦（Security Defense）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `SEC_AWARENESS` | 資安意識訓練 | 2001 | 500,000 | 1 | — |
| `SOC_CENTER` | SOC 監控中心 | 2010 | 1,500,000 | 4 | SEC_AWARENESS |
| `BACKUP_ARCH` | 備份架構升級 | 2004 | 800,000 | 2 | — |
| `DDOS_PROTECTION` | DDoS 防護平台 | 2013 | 1,200,000 | 2 | SOC_CENTER |
| `ZERO_TRUST` | 零信任架構 | 2017 | 2,500,000 | 6 | SOC_CENTER + BACKUP_ARCH |
| `VULN_SCAN_AUTO` | 弱點掃描自動化 | 2006 | 1,000,000 | 2 | SEC_AWARENESS |
| `SIEM_INTEGRATION` | SIEM 整合 | 2015 | 1,800,000 | 3 | SOC_CENTER |

### 供應鏈管理（Supply Chain）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `INVENTORY_STRATEGY` | 庫存備料策略 | 2008 | 1,000,000 | 2 | BULK_PURCHASE |
| `MULTI_VENDOR` | 多元供應商 | 2012 | 1,500,000 | 3 | INVENTORY_STRATEGY |
| `LOCAL_PROCUREMENT` | 在地化採購 | 2015 | 1,200,000 | 2 | MULTI_VENDOR |

### 風險管控（Risk Control）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `BCP` | 營運持續計畫 | 2007 | 1,200,000 | 3 | BACKUP_ARCH |
| `INSURANCE_OPT` | 保險精算優化 | 2003 | 1,000,000 | 2 | — |

### 雲端競爭（Cloud Compete）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `HYBRID_CLOUD` | 混合雲架構 | 2010 | 1,500,000 | 4 | VIRTUALIZATION |
| `CLOUD_COST_OPT` | 雲端成本優化 | 2014 | 1,200,000 | 2 | HYBRID_CLOUD |
| `PRIVATE_CLOUD` | 私有雲平台 | 2018 | 2,200,000 | 6 | HYBRID_CLOUD + K8S |

### AI 基礎設施（AI Infra）

| 節點 ID | 名稱 | 解鎖年 | 成本(NT$) | 導入月 | 前置 |
|---------|------|--------|---------|--------|------|
| `AI_TRAINING` | AI 訓練叢集 | 2019 | 2,500,000 | 4 | GPU_ACCELERATION |
| `INFERENCE_PLATFORM` | 推論服務平台 | 2021 | 2,000,000 | 3 | AI_TRAINING |
| `LLM_HOSTING` | LLM 服務代管 | 2023 | 3,000,000 | 6 | INFERENCE_PLATFORM |

### 互斥節點組

| 組 ID | 節點 A | 節點 B | 說明 |
|-------|--------|--------|------|
| `inventory_strategy` | INVENTORY_STRATEGY | `JUST_IN_TIME` | 備料策略 vs 即時庫存 |
| `ops_automation` | AIOPS_MONITORING | `PEOPLE_SURGE` | AIOps vs 人海戰術 |
| `security_policy` | ZERO_TRUST | `CONVENIENCE_FIRST` | 零信任 vs 便利優先 |
| `cloud_strategy` | PRIVATE_CLOUD | `FULL_CLOUD_MIGRATION` | 私有雲 vs 全雲端遷移 |

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 推進所有 in-progress 節點的導入進度 |
| `finance.monthly_settlement` | FinanceEngine | 確認資金是否足夠開始研究（回應 startResearch 呼叫）|

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `techtree.research_started` | `{ nodeId, cost, completionDate }` | 研究開始 |
| `techtree.research_completed` | `{ nodeId, effects[] }` | 研究完成，效果生效 |
| `techtree.research_cancelled` | `{ nodeId, refund }` | 研究取消 |
| `techtree.investment_made` | `{ nodeId, amount }` | 投資支出（給 FinanceEngine）|
| `techtree.node_unlocked` | `{ nodeId }` | 節點達到可研究狀態（可選通知）|
| `techtree.service_unlocked` | `{ serviceType }` | 解鎖新服務類型（給 ContractManager）|

---

## TechTreeConfig 平衡參數

```typescript
interface TechTreeConfig {
  nodes: TechNodeDefinition[];          // 全部 40 節點定義
  cancelRefundRate: number;             // 0.50（取消研究退回 50%）
  milestoneRequiredNodes: number;       // 20（里程碑「技術領先」需求）
}
```

---

## 與其他模組的交互

```
TechTree
  ├── 接收 time.month_end → 推進導入進度
  ├── 發布 techtree.investment_made → FinanceEngine（扣費）
  ├── 發布 techtree.research_completed → FacilityManager（PUE、容量加成）
  ├── 發布 techtree.research_completed → HardwareCatalog（採購折扣、延遲降低）
  ├── 發布 techtree.research_completed → StaffManager（管理容量、離職率加成）
  ├── 發布 techtree.research_completed → SecurityEngine（防禦加成）
  ├── 發布 techtree.research_completed → ContractManager（SLA 達成率改善）
  └── 發布 techtree.service_unlocked → ContractManager（解鎖 MSP/MSSP/DRaaS/AI 服務）
```

---

## 未來擴展點

- **節點升級**：部分節點可多次升級（如 ISO 27001 → ISO 22301 → SOC 2）。
- **研究加速**：分配特定員工（如 E4 雲端架構師）可加速特定類型研究。
- **研究失敗事件**：低機率研究失敗（員工技能不足），需重新投資。
