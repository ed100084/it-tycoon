import {
  TechNodeStatus,
  TechCategory,
  TechEffectType,
  type TechNode,
  type TechTreeEffect,
  type GameDate,
  type IEventBus,
  type IGameModule,
  type GameConfig,
  type TechTreeConfig,
} from '../core/types';
import { addMonths } from '../../utils/gameDate';

// ─── Node definition helper (internal, pre-status) ───────────────────────────

interface NodeDef {
  id: string;
  name: string;
  category: TechCategory;
  description: string;
  unlockYear: number;
  cost: number;
  months: number;
  prereqs: string[];
  effects: Array<{ type: TechEffectType; value: number; description: string }>;
  mutuallyExclusiveGroupId?: string;
  mutuallyExclusiveWith?: string[];
}

function buildNode(def: NodeDef): TechNode {
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    description: def.description,
    unlockYear: def.unlockYear,
    investmentCostNTD: def.cost,
    implementationMonths: def.months,
    prerequisites: def.prereqs,
    effects: def.effects.map(e => ({
      type: e.type,
      value: e.value,
      description: e.description,
    })),
    mutuallyExclusiveGroupId: def.mutuallyExclusiveGroupId,
    mutuallyExclusiveWith: def.mutuallyExclusiveWith,
    status: TechNodeStatus.Locked,
    progressMonths: 0,
    startedAt: null,
    completedAt: null,
  };
}

// ─── Node catalogue ──────────────────────────────────────────────────────────

const NODE_DEFS: NodeDef[] = [
  // ── Infrastructure ────────────────────────────────────────────────────────
  {
    id: 'VIRTUALIZATION',
    name: '虛擬化導入',
    category: TechCategory.Infrastructure,
    description: '透過伺服器虛擬化技術提升硬體使用率，增加可用容量。',
    unlockYear: 2001,
    cost: 300_000,
    months: 2,
    prereqs: [],
    effects: [{ type: TechEffectType.CapacityBonus, value: 0.2, description: '虛擬化容量加成 +20%' }],
  },
  {
    id: 'STORAGE_VIRT',
    name: '儲存虛擬化',
    category: TechCategory.Infrastructure,
    description: '將異質儲存設備整合為統一資源池，提升可用容量。',
    unlockYear: 2005,
    cost: 600_000,
    months: 3,
    prereqs: ['VIRTUALIZATION'],
    effects: [{ type: TechEffectType.CapacityBonus, value: 0.15, description: '儲存虛擬化容量加成 +15%' }],
  },
  {
    id: 'CONTAINERIZATION',
    name: '容器化架構',
    category: TechCategory.Infrastructure,
    description: '導入容器技術，提升服務部署密度與資源效率。',
    unlockYear: 2013,
    cost: 1_000_000,
    months: 4,
    prereqs: ['VIRTUALIZATION'],
    effects: [{ type: TechEffectType.CapacityBonus, value: 0.25, description: '容器化容量加成 +25%' }],
  },
  {
    id: 'K8S_ORCHESTRATION',
    name: 'K8s自動調度',
    category: TechCategory.Infrastructure,
    description: '以 Kubernetes 自動調度容器工作負載，提升管理容量。',
    unlockYear: 2015,
    cost: 2_000_000,
    months: 6,
    prereqs: ['CONTAINERIZATION'],
    effects: [{ type: TechEffectType.ManagementCapacityBonus, value: 0.3, description: 'K8s管理容量加成 +30%' }],
  },

  // ── Performance ───────────────────────────────────────────────────────────
  {
    id: 'NVME_CACHE',
    name: 'NVMe快取',
    category: TechCategory.Performance,
    description: '部署 NVMe 高速快取層，大幅降低 I/O 延遲，加快事故處理速度。',
    unlockYear: 2012,
    cost: 500_000,
    months: 1,
    prereqs: [],
    effects: [{ type: TechEffectType.IncidentResponseBonus, value: 0.15, description: 'NVMe事故應變加成 +15%' }],
  },
  {
    id: 'GPU_ACCELERATION',
    name: 'GPU加速',
    category: TechCategory.Performance,
    description: '引入 GPU 運算資源，支援 AI 推論與高效能運算工作負載。',
    unlockYear: 2016,
    cost: 1_200_000,
    months: 2,
    prereqs: ['NVME_CACHE'],
    effects: [{ type: TechEffectType.AICapacityBonus, value: 0.5, description: 'GPU加速AI容量加成 +50%' }],
  },
  {
    id: 'AI_INFERENCE_OPT',
    name: 'AI推論最佳化',
    category: TechCategory.Performance,
    description: '針對推論工作負載進行模型壓縮與批次排程最佳化，提升AI服務收益。',
    unlockYear: 2020,
    cost: 2_000_000,
    months: 3,
    prereqs: ['GPU_ACCELERATION'],
    effects: [{ type: TechEffectType.AIServiceRevenueBonus, value: 0.3, description: 'AI推論收益加成 +30%' }],
  },

  // ── Cost Control ──────────────────────────────────────────────────────────
  {
    id: 'POWER_FUTURES',
    name: '電力期貨合約',
    category: TechCategory.CostControl,
    description: '簽訂電力期貨合約鎖定電價，降低能源開銷（PUE 改善）。',
    unlockYear: 2003,
    cost: 500_000,
    months: 1,
    prereqs: [],
    effects: [{ type: TechEffectType.PUEReduction, value: 0.05, description: '電力期貨PUE降低 -0.05' }],
  },
  {
    id: 'ENERGY_CERT',
    name: '節能認證',
    category: TechCategory.CostControl,
    description: '取得節能認證標章，享有政府補貼並改善能源效率。',
    unlockYear: 2008,
    cost: 1_000_000,
    months: 2,
    prereqs: ['POWER_FUTURES'],
    effects: [{ type: TechEffectType.PUEReduction, value: 0.1, description: '節能認證PUE降低 -0.10' }],
  },
  {
    id: 'GREEN_ENERGY',
    name: '綠能發電',
    category: TechCategory.CostControl,
    description: '導入再生能源發電設施，大幅降低電費並改善 PUE 表現。',
    unlockYear: 2013,
    cost: 1_500_000,
    months: 4,
    prereqs: ['ENERGY_CERT'],
    effects: [{ type: TechEffectType.PUEReduction, value: 0.15, description: '綠能發電PUE降低 -0.15' }],
  },

  // ── Space Innovation ──────────────────────────────────────────────────────
  {
    id: 'HIGH_DENSITY_RACK',
    name: '高密度機架',
    category: TechCategory.SpaceInnovation,
    description: '採用高密度機架設計，於相同機房空間容納更多設備。',
    unlockYear: 2006,
    cost: 800_000,
    months: 2,
    prereqs: [],
    effects: [{ type: TechEffectType.CapacityBonus, value: 0.2, description: '高密度機架容量加成 +20%' }],
  },
  {
    id: 'MODULAR_EXPANSION',
    name: '模組化擴建',
    category: TechCategory.SpaceInnovation,
    description: '採用預製模組化機房單元，降低擴建成本與施工時間。',
    unlockYear: 2010,
    cost: 1_500_000,
    months: 3,
    prereqs: ['HIGH_DENSITY_RACK'],
    effects: [{ type: TechEffectType.ExpansionCostReduction, value: 0.2, description: '模組化擴建成本減少 -20%' }],
  },

  // ── Management ────────────────────────────────────────────────────────────
  {
    id: 'PROCESS_AUTOMATION',
    name: '流程自動化',
    category: TechCategory.Management,
    description: '標準化並自動化日常維運流程，降低人為疏失與 SLA 違約率。',
    unlockYear: 2002,
    cost: 500_000,
    months: 2,
    prereqs: [],
    effects: [{ type: TechEffectType.SLABreachRateReduction, value: 0.1, description: '流程自動化SLA違約減少 -10%' }],
  },
  {
    id: 'AUDIT_READINESS',
    name: '稽核準備系統',
    category: TechCategory.Management,
    description: '建立持續稽核準備機制，提升稽核通過率。',
    unlockYear: 2005,
    cost: 1_000_000,
    months: 2,
    prereqs: ['PROCESS_AUTOMATION'],
    effects: [{ type: TechEffectType.AuditPassRateBonus, value: 0.2, description: '稽核準備通過率加成 +20%' }],
  },
  {
    id: 'ITSM_PLATFORM',
    name: 'ITSM平台',
    category: TechCategory.Management,
    description: '導入 ITSM 平台整合工單、變更及事故管理流程，加速事故應變。',
    unlockYear: 2008,
    cost: 1_200_000,
    months: 3,
    prereqs: ['PROCESS_AUTOMATION'],
    effects: [{ type: TechEffectType.IncidentResponseBonus, value: 0.15, description: 'ITSM事故應變加成 +15%' }],
  },
  {
    id: 'ISO27001',
    name: 'ISO 27001認證',
    category: TechCategory.Management,
    description: '取得 ISO 27001 資訊安全管理系統認證，提升合規分數與稽核通過率。',
    unlockYear: 2004,
    cost: 2_000_000,
    months: 6,
    prereqs: ['ITSM_PLATFORM'],
    effects: [
      { type: TechEffectType.ComplianceBonus, value: 20, description: 'ISO27001合規分數 +20' },
      { type: TechEffectType.AuditPassRateBonus, value: 0.3, description: 'ISO27001稽核通過率加成 +30%' },
    ],
  },

  // ── Scale Economy ─────────────────────────────────────────────────────────
  {
    id: 'BULK_PURCHASE',
    name: '批量採購協議',
    category: TechCategory.ScaleEconomy,
    description: '與主要硬體供應商簽訂批量採購協議，享受大量折扣。',
    unlockYear: 2003,
    cost: 800_000,
    months: 1,
    prereqs: [],
    effects: [{ type: TechEffectType.HardwareCostReduction, value: 0.1, description: '批量採購硬體成本減少 -10%' }],
  },

  // ── HR Management ─────────────────────────────────────────────────────────
  {
    id: 'AUTOMATION_OPS',
    name: '自動化運維',
    category: TechCategory.HRManagement,
    description: '建立自動化維運工具鏈，讓少數人員管理更多基礎設施。',
    unlockYear: 2008,
    cost: 1_200_000,
    months: 3,
    prereqs: ['PROCESS_AUTOMATION'],
    effects: [{ type: TechEffectType.ManagementCapacityBonus, value: 0.2, description: '自動化運維管理容量加成 +20%' }],
  },
  {
    id: 'AIOPS_MONITORING',
    name: 'AIOps智能監控',
    category: TechCategory.HRManagement,
    description: '以 AI 驅動的智能監控平台取代大量人工巡檢，大幅提升管理容量並降低離職率。',
    unlockYear: 2016,
    cost: 2_000_000,
    months: 4,
    prereqs: ['AUTOMATION_OPS'],
    effects: [
      { type: TechEffectType.ManagementCapacityBonus, value: 0.5, description: 'AIOps管理容量加成 +50%' },
      { type: TechEffectType.ResignationRateReduction, value: 0.1, description: 'AIOps離職率減少 -10%' },
    ],
    mutuallyExclusiveGroupId: 'ops_automation',
    mutuallyExclusiveWith: ['PEOPLE_SURGE'],
  },
  {
    id: 'TALENT_PROGRAM',
    name: '人才培育計畫',
    category: TechCategory.HRManagement,
    description: '系統化人才培訓與職涯規劃，降低離職率並加速晉升流程。',
    unlockYear: 2005,
    cost: 800_000,
    months: 2,
    prereqs: [],
    effects: [
      { type: TechEffectType.ResignationRateReduction, value: 0.15, description: '人才培育離職率減少 -15%' },
      { type: TechEffectType.PromotionTimeReduction, value: 0.2, description: '人才培育晉升時間縮短 -20%' },
    ],
  },

  // ── Security Defense ──────────────────────────────────────────────────────
  {
    id: 'SEC_AWARENESS',
    name: '資安意識訓練',
    category: TechCategory.SecurityDefense,
    description: '定期員工資安意識訓練，降低社交工程攻擊成功率。',
    unlockYear: 2001,
    cost: 500_000,
    months: 1,
    prereqs: [],
    effects: [{ type: TechEffectType.SocialEngReduction, value: 0.3, description: '資安意識社交工程減少 -30%' }],
  },
  {
    id: 'SOC_CENTER',
    name: 'SOC監控中心',
    category: TechCategory.SecurityDefense,
    description: '建立 24x7 安全維運中心，即時偵測並回應資安威脅。',
    unlockYear: 2010,
    cost: 1_500_000,
    months: 4,
    prereqs: ['SEC_AWARENESS'],
    effects: [
      { type: TechEffectType.SecurityEventReduction, value: 0.2, description: 'SOC安全事件減少 -20%' },
      { type: TechEffectType.APTDetectionBonus, value: 0.5, description: 'SOCAPT偵測加成 +50%' },
    ],
  },
  {
    id: 'BACKUP_ARCH',
    name: '備份架構升級',
    category: TechCategory.SecurityDefense,
    description: '建立離線與異地備份架構，大幅提升勒索軟體免疫能力。',
    unlockYear: 2004,
    cost: 800_000,
    months: 2,
    prereqs: [],
    effects: [{ type: TechEffectType.RansomwareImmunity, value: 0.5, description: '備份架構勒索免疫 +50%' }],
  },
  {
    id: 'DDOS_PROTECTION',
    name: 'DDoS防護平台',
    category: TechCategory.SecurityDefense,
    description: '部署流量清洗中心與 CDN 防護，大幅降低 DDoS 攻擊衝擊。',
    unlockYear: 2013,
    cost: 1_200_000,
    months: 2,
    prereqs: ['SOC_CENTER'],
    effects: [{ type: TechEffectType.DDoSReduction, value: 0.6, description: 'DDoS防護減少 -60%' }],
  },
  {
    id: 'ZERO_TRUST',
    name: '零信任架構',
    category: TechCategory.SecurityDefense,
    description: '實施零信任網路架構，全面驗證每筆存取請求，顯著降低安全事件。',
    unlockYear: 2017,
    cost: 2_500_000,
    months: 6,
    prereqs: ['SOC_CENTER', 'BACKUP_ARCH'],
    effects: [
      { type: TechEffectType.SecurityEventReduction, value: 0.3, description: '零信任安全事件減少 -30%' },
      { type: TechEffectType.ComplianceBonus, value: 10, description: '零信任合規分數 +10' },
    ],
    mutuallyExclusiveGroupId: 'security_policy',
    mutuallyExclusiveWith: ['CONVENIENCE_FIRST'],
  },
  {
    id: 'VULN_SCAN_AUTO',
    name: '弱點掃描自動化',
    category: TechCategory.SecurityDefense,
    description: '導入自動化弱點掃描工具，持續偵測並修補系統漏洞。',
    unlockYear: 2006,
    cost: 1_000_000,
    months: 2,
    prereqs: ['SEC_AWARENESS'],
    effects: [{ type: TechEffectType.SecurityEventReduction, value: 0.15, description: '弱點掃描安全事件減少 -15%' }],
  },
  {
    id: 'SIEM_INTEGRATION',
    name: 'SIEM整合',
    category: TechCategory.SecurityDefense,
    description: '整合 SIEM 平台集中分析安全日誌，提升 APT 偵測率與安全事件回應速度。',
    unlockYear: 2015,
    cost: 1_800_000,
    months: 3,
    prereqs: ['SOC_CENTER'],
    effects: [
      { type: TechEffectType.APTDetectionBonus, value: 0.3, description: 'SIEMAPT偵測加成 +30%' },
      { type: TechEffectType.SecurityEventReduction, value: 0.1, description: 'SIEM安全事件減少 -10%' },
    ],
  },
  {
    id: 'CONVENIENCE_FIRST',
    name: '便利優先政策',
    category: TechCategory.SecurityDefense,
    description: '採取便利優先的安全政策，降低管理摩擦，但與零信任架構互斥。',
    unlockYear: 2001,
    cost: 200_000,
    months: 1,
    prereqs: [],
    effects: [{ type: TechEffectType.ManagementCapacityBonus, value: 0.1, description: '便利政策管理容量加成 +10%' }],
    mutuallyExclusiveGroupId: 'security_policy',
    mutuallyExclusiveWith: ['ZERO_TRUST'],
  },

  // ── Supply Chain ──────────────────────────────────────────────────────────
  {
    id: 'INVENTORY_STRATEGY',
    name: '庫存備料策略',
    category: TechCategory.SupplyChain,
    description: '建立預防性備料庫存策略，大幅縮短採購交期，與即時庫存管理互斥。',
    unlockYear: 2008,
    cost: 1_000_000,
    months: 2,
    prereqs: ['BULK_PURCHASE'],
    effects: [{ type: TechEffectType.PurchaseDelayReduction, value: 0.3, description: '庫存策略採購延遲減少 -30%' }],
    mutuallyExclusiveGroupId: 'inventory_strategy',
    mutuallyExclusiveWith: ['JUST_IN_TIME'],
  },
  {
    id: 'JUST_IN_TIME',
    name: '即時庫存管理',
    category: TechCategory.SupplyChain,
    description: '以即時庫存管理降低持有成本，與庫存備料策略互斥。',
    unlockYear: 2008,
    cost: 800_000,
    months: 2,
    prereqs: ['BULK_PURCHASE'],
    effects: [{ type: TechEffectType.HardwareCostReduction, value: 0.05, description: '即時庫存硬體成本減少 -5%' }],
    mutuallyExclusiveGroupId: 'inventory_strategy',
    mutuallyExclusiveWith: ['INVENTORY_STRATEGY'],
  },
  {
    id: 'MULTI_VENDOR',
    name: '多元供應商',
    category: TechCategory.SupplyChain,
    description: '建立多元供應商體系，降低晶片短缺風險與單一供應商依賴。',
    unlockYear: 2012,
    cost: 1_500_000,
    months: 3,
    prereqs: ['INVENTORY_STRATEGY'],
    effects: [{ type: TechEffectType.ChipShortageReduction, value: 0.4, description: '多元供應商晶片短缺減少 -40%' }],
  },
  {
    id: 'LOCAL_PROCUREMENT',
    name: '在地化採購',
    category: TechCategory.SupplyChain,
    description: '優先採購在地供應商產品，降低匯率波動對採購成本的影響。',
    unlockYear: 2015,
    cost: 1_200_000,
    months: 2,
    prereqs: ['MULTI_VENDOR'],
    effects: [{ type: TechEffectType.ExchangeRateReduction, value: 0.4, description: '在地採購匯率風險減少 -40%' }],
  },

  // ── Risk Control ──────────────────────────────────────────────────────────
  {
    id: 'BCP',
    name: '營運持續計畫',
    category: TechCategory.RiskControl,
    description: '制定並演練營運持續計畫，降低重大事故導致的 SLA 違約，並加速事故應變。',
    unlockYear: 2007,
    cost: 1_200_000,
    months: 3,
    prereqs: ['BACKUP_ARCH'],
    effects: [
      { type: TechEffectType.SLABreachRateReduction, value: 0.2, description: 'BCP SLA違約減少 -20%' },
      { type: TechEffectType.IncidentResponseBonus, value: 0.2, description: 'BCP事故應變加成 +20%' },
    ],
  },
  {
    id: 'INSURANCE_OPT',
    name: '保險精算優化',
    category: TechCategory.RiskControl,
    description: '優化保險方案配置，降低保費支出並提升信用評等。',
    unlockYear: 2003,
    cost: 1_000_000,
    months: 2,
    prereqs: [],
    effects: [
      { type: TechEffectType.InsuranceCostReduction, value: 0.3, description: '保險精算成本減少 -30%' },
      { type: TechEffectType.CreditRatingBonus, value: 1, description: '保險精算信用評等加成 +1' },
    ],
  },

  // ── Cloud Compete ─────────────────────────────────────────────────────────
  {
    id: 'HYBRID_CLOUD',
    name: '混合雲架構',
    category: TechCategory.CloudCompete,
    description: '整合公有雲與私有環境，提供混合雲服務，解鎖新服務類型。',
    unlockYear: 2010,
    cost: 1_500_000,
    months: 4,
    prereqs: ['VIRTUALIZATION'],
    effects: [{ type: TechEffectType.ServiceUnlock, value: 1, description: '混合雲解鎖新服務 +1' }],
  },
  {
    id: 'CLOUD_COST_OPT',
    name: '雲端成本優化',
    category: TechCategory.CloudCompete,
    description: '透過 FinOps 方法論持續最佳化雲端資源使用，降低採購成本。',
    unlockYear: 2014,
    cost: 1_200_000,
    months: 2,
    prereqs: ['HYBRID_CLOUD'],
    effects: [{ type: TechEffectType.HardwareCostReduction, value: 0.08, description: '雲端優化硬體成本減少 -8%' }],
  },
  {
    id: 'PRIVATE_CLOUD',
    name: '私有雲平台',
    category: TechCategory.CloudCompete,
    description: '建立企業級私有雲平台，大幅提升容量並解鎖進階服務，與全雲端遷移互斥。',
    unlockYear: 2018,
    cost: 2_200_000,
    months: 6,
    prereqs: ['HYBRID_CLOUD', 'K8S_ORCHESTRATION'],
    effects: [
      { type: TechEffectType.CapacityBonus, value: 0.4, description: '私有雲容量加成 +40%' },
      { type: TechEffectType.ServiceUnlock, value: 1, description: '私有雲解鎖新服務 +1' },
    ],
    mutuallyExclusiveGroupId: 'cloud_strategy',
    mutuallyExclusiveWith: ['FULL_CLOUD_MIGRATION'],
  },
  {
    id: 'FULL_CLOUD_MIGRATION',
    name: '全雲端遷移',
    category: TechCategory.CloudCompete,
    description: '將所有工作負載遷移至公有雲，大幅降低硬體成本，與私有雲平台互斥。',
    unlockYear: 2018,
    cost: 2_000_000,
    months: 6,
    prereqs: ['HYBRID_CLOUD'],
    effects: [{ type: TechEffectType.HardwareCostReduction, value: 0.2, description: '全雲端遷移硬體成本減少 -20%' }],
    mutuallyExclusiveGroupId: 'cloud_strategy',
    mutuallyExclusiveWith: ['PRIVATE_CLOUD'],
  },

  // ── AI Infra ──────────────────────────────────────────────────────────────
  {
    id: 'AI_TRAINING',
    name: 'AI訓練叢集',
    category: TechCategory.AIInfra,
    description: '建立大規模 AI 訓練叢集，提供高效能 AI 計算能力。',
    unlockYear: 2019,
    cost: 2_500_000,
    months: 4,
    prereqs: ['GPU_ACCELERATION'],
    effects: [{ type: TechEffectType.AICapacityBonus, value: 1.0, description: 'AI訓練容量加成 +100%' }],
  },
  {
    id: 'INFERENCE_PLATFORM',
    name: '推論服務平台',
    category: TechCategory.AIInfra,
    description: '建立專屬 AI 推論服務平台，提供高 SLA 的推論 API，提升 AI 服務收益。',
    unlockYear: 2021,
    cost: 2_000_000,
    months: 3,
    prereqs: ['AI_TRAINING'],
    effects: [{ type: TechEffectType.AIServiceRevenueBonus, value: 0.5, description: '推論平台AI服務收益加成 +50%' }],
  },
  {
    id: 'LLM_HOSTING',
    name: 'LLM服務代管',
    category: TechCategory.AIInfra,
    description: '提供大型語言模型代管服務，解鎖高價值 AI 服務並大幅增加 AI 收益。',
    unlockYear: 2023,
    cost: 3_000_000,
    months: 6,
    prereqs: ['INFERENCE_PLATFORM'],
    effects: [
      { type: TechEffectType.AIServiceRevenueBonus, value: 1.0, description: 'LLM代管AI服務收益加成 +100%' },
      { type: TechEffectType.ServiceUnlock, value: 1, description: 'LLM代管解鎖新服務 +1' },
    ],
  },

  // ── People Surge (HR Management, mutually exclusive with AIOps) ───────────
  {
    id: 'PEOPLE_SURGE',
    name: '人海戰術',
    category: TechCategory.HRManagement,
    description: '大量招聘人員以擴充管理能量，與AIOps智能監控互斥。',
    unlockYear: 2000,
    cost: 500_000,
    months: 1,
    prereqs: [],
    effects: [{ type: TechEffectType.ManagementCapacityBonus, value: 0.3, description: '人海戰術管理容量加成 +30%' }],
    mutuallyExclusiveGroupId: 'ops_automation',
    mutuallyExclusiveWith: ['AIOPS_MONITORING'],
  },
];

// ─── TechTree module ──────────────────────────────────────────────────────────

export class TechTree implements IGameModule {
  readonly moduleId = 'TechTree';

  private bus!: IEventBus;
  private cfg!: TechTreeConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };
  private nodes: TechNode[];
  private completedIds = new Set<string>();
  private lockedIds = new Set<string>();

  constructor() {
    this.nodes = this.buildInitialNodes();
  }

  // ── IGameModule ─────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.techTree ?? { cancelRefundRate: 0.50, milestoneRequiredNodes: 20 };
    this.currentDate = { year: config.meta.startYear, month: config.meta.startMonth };

    // Subscribe to month-end ticks
    bus.subscribe<{ prevDate: GameDate; newDate: GameDate }>(
      'time.month_end',
      event => this.onMonthEnd(event.payload.newDate),
      this.moduleId,
    );

    // Initial availability computation
    this.recomputeStatuses();
  }

  tick(_deltaMs: number): void {
    // Progress is driven by month-end events; no per-tick work needed.
  }

  serialize(): Record<string, unknown> {
    return {
      currentDate: this.currentDate,
      nodes: this.nodes.map(n => ({
        id: n.id,
        status: n.status,
        progressMonths: n.progressMonths,
        startedAt: n.startedAt,
        completedAt: n.completedAt,
      })),
    };
  }

  deserialize(state: Record<string, unknown>): void {
    if (state['currentDate']) {
      this.currentDate = state['currentDate'] as GameDate;
    }

    if (Array.isArray(state['nodes'])) {
      type NodeSnapshot = {
        id: string;
        status: TechNodeStatus;
        progressMonths: number;
        startedAt: GameDate | null;
        completedAt: GameDate | null;
      };
      const snapshots = state['nodes'] as NodeSnapshot[];
      for (const snap of snapshots) {
        const node = this.nodes.find(n => n.id === snap.id);
        if (!node) continue;
        node.status = snap.status;
        node.progressMonths = snap.progressMonths;
        node.startedAt = snap.startedAt;
        node.completedAt = snap.completedAt;
        if (snap.status === TechNodeStatus.Completed) {
          this.completedIds.add(snap.id);
        }
      }
      // Rehydrate lockedIds from mutual-exclusion of completed nodes
      this.recomputeMutualExclusionLocks();
    }
  }

  getState(): Readonly<Record<string, unknown>> {
    return {
      currentDate: this.currentDate,
      nodes: this.nodes,
      completedCount: this.completedIds.size,
    };
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  getNodes(): TechNode[] {
    return [...this.nodes];
  }

  getNode(nodeId: string): TechNode | null {
    return this.nodes.find(n => n.id === nodeId) ?? null;
  }

  getAvailableNodes(currentDate: GameDate): TechNode[] {
    return this.nodes.filter(n => {
      if (n.status !== TechNodeStatus.Available) return false;
      return n.unlockYear <= currentDate.year;
    });
  }

  getInProgressNodes(): TechNode[] {
    return this.nodes.filter(n => n.status === TechNodeStatus.InProgress);
  }

  getCompletedNodes(): TechNode[] {
    return this.nodes.filter(n => n.status === TechNodeStatus.Completed);
  }

  startResearch(nodeId: string): boolean {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    if (node.status !== TechNodeStatus.Available) return false;

    // Emit investment event
    this.bus.publish({
      type: 'techtree.investment_made',
      payload: { nodeId, amount: node.investmentCostNTD },
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    // Start research
    node.status = TechNodeStatus.InProgress;
    node.startedAt = { ...this.currentDate };
    node.progressMonths = 0;

    const completionDate = addMonths(this.currentDate, node.implementationMonths);

    this.bus.publish({
      type: 'techtree.research_started',
      payload: { nodeId, cost: node.investmentCostNTD, completionDate },
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    return true;
  }

  cancelResearch(nodeId: string): boolean {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    if (node.status !== TechNodeStatus.InProgress) return false;

    const refund = Math.floor(node.investmentCostNTD * this.cfg.cancelRefundRate);

    this.bus.publish({
      type: 'techtree.research_cancelled',
      payload: { nodeId, refund },
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    // Reset to Available (prerequisites were already met when we started)
    node.status = TechNodeStatus.Available;
    node.startedAt = null;
    node.progressMonths = 0;

    return true;
  }

  getActiveEffects(): TechTreeEffect[] {
    const effects: TechTreeEffect[] = [];
    for (const node of this.nodes) {
      if (node.status !== TechNodeStatus.Completed) continue;
      for (const effect of node.effects) {
        effects.push({
          nodeId: node.id,
          nodeName: node.name,
          type: effect.type,
          value: effect.value,
          description: effect.description,
        });
      }
    }
    return effects;
  }

  isNodeCompleted(nodeId: string): boolean {
    return this.completedIds.has(nodeId);
  }

  getMutuallyExclusiveGroup(groupId: string): TechNode[] {
    return this.nodes.filter(n => n.mutuallyExclusiveGroupId === groupId);
  }

  getCompletedNodeCount(): number {
    return this.completedIds.size;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private onMonthEnd(newDate: GameDate): void {
    this.currentDate = newDate;

    const justCompleted: TechNode[] = [];

    for (const node of this.nodes) {
      if (node.status !== TechNodeStatus.InProgress) continue;
      node.progressMonths += 1;
      if (node.progressMonths >= node.implementationMonths) {
        this.completeNode(node);
        justCompleted.push(node);
      }
    }

    this.recomputeStatuses();
  }

  private completeNode(node: TechNode): void {
    node.status = TechNodeStatus.Completed;
    node.completedAt = { ...this.currentDate };
    this.completedIds.add(node.id);

    this.bus.publish({
      type: 'techtree.research_completed',
      payload: { nodeId: node.id, effects: node.effects, nodeName: node.name },
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    // Emit service unlock events
    for (const effect of node.effects) {
      if (effect.type === TechEffectType.ServiceUnlock) {
        this.bus.publish({
          type: 'techtree.service_unlocked',
          payload: { nodeId: node.id },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }

    // Lock mutually exclusive nodes
    this.applyMutualExclusionLocks(node);
  }

  private applyMutualExclusionLocks(completedNode: TechNode): void {
    if (!completedNode.mutuallyExclusiveWith?.length) return;
    for (const excludedId of completedNode.mutuallyExclusiveWith) {
      this.lockedIds.add(excludedId);
      const target = this.nodes.find(n => n.id === excludedId);
      if (target && target.status !== TechNodeStatus.Completed && target.status !== TechNodeStatus.InProgress) {
        target.status = TechNodeStatus.Locked;
      }
    }
  }

  private recomputeMutualExclusionLocks(): void {
    this.lockedIds.clear();
    for (const id of this.completedIds) {
      const node = this.nodes.find(n => n.id === id);
      if (!node?.mutuallyExclusiveWith?.length) continue;
      for (const excludedId of node.mutuallyExclusiveWith) {
        this.lockedIds.add(excludedId);
      }
    }
  }

  private recomputeStatuses(): void {
    for (const node of this.nodes) {
      // Never touch completed or in-progress nodes
      if (node.status === TechNodeStatus.Completed || node.status === TechNodeStatus.InProgress) continue;

      if (this.lockedIds.has(node.id)) {
        node.status = TechNodeStatus.Locked;
        continue;
      }

      const prereqsMet = node.prerequisites.every(pid => this.completedIds.has(pid));
      const yearOk = node.unlockYear <= this.currentDate.year;

      if (prereqsMet && yearOk) {
        node.status = TechNodeStatus.Available;
      } else {
        node.status = TechNodeStatus.Locked;
      }
    }
  }

  private buildInitialNodes(): TechNode[] {
    return NODE_DEFS.map(def => buildNode(def));
  }
}
