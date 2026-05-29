# 08 — SecurityEngine 資安引擎

## 模組職責

SecurityEngine 是遊戲的**威脅生成與防禦評估**核心。它根據合規分數、EOL/EOS 狀態、時代背景與科技樹解鎖程度，在每月 roll 中生成資安與異常事件，追蹤事件處理進度，並計算對 SLA 與客戶滿意度的影響。

**單一職責**：安全威脅生成、防禦評估、事件處理流程管理。不計算財務損失（通知 FinanceEngine）、不直接修改滿意度（通知 ReputationEngine）。

---

## 公開介面（Public API）

```typescript
interface ISecurityEngine extends IGameModule {
  readonly moduleId: 'SecurityEngine';

  /** 取得所有活躍事件（尚未解決）。 */
  getActiveIncidents(): Incident[];

  /** 取得特定事件詳情。 */
  getIncident(incidentId: EntityId): Incident | null;

  /** 取得事件歷史（已解決/超時）。 */
  getIncidentHistory(limit?: number): Incident[];

  /** 取得當前整體安全態勢分數（0–100）。 */
  getSecurityPostureScore(): number;

  /** 取得合規分數（由 SoftwareCatalog 提供基礎，SecurityEngine 加上稽核/維護效果）。 */
  getComplianceScore(): number;

  /** 玩家選擇事件應對措施。 */
  respondToIncident(incidentId: EntityId, response: IncidentResponse): void;

  /** 執行定期安全維護（弱點掃描、滲透測試等）。 */
  executeSecurityMaintenance(type: MaintenanceType, scope?: 'partial' | 'full'): MaintenanceResult;

  /** 取得本月的威脅評估報告（各類事件的觸發機率）。 */
  getThreatAssessment(): ThreatAssessment;

  /** 取得所有已解鎖的防禦能力列表（科技樹加成）。 */
  getDefenseCapabilities(): DefenseCapability[];

  /** 取得 P1 事件的剩餘處理時限（小時，遊戲時間）。 */
  getIncidentDeadlineHours(incidentId: EntityId): number;
}

enum SecurityMaintenanceType {
  VulnerabilityScan    = 'VULN_SCAN',
  PenetrationTest      = 'PEN_TEST',
  SecurityAwareness    = 'SEC_AWARENESS',
  FullSecurityAwareness = 'FULL_SEC_AWARENESS',
}
```

---

## 核心資料結構

```typescript
interface Incident {
  id: EntityId;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  triggeredAt: GameDate;
  triggeredAtHour: number;             // 遊戲小時（0–23），影響班別響應
  resolvedAt: GameDate | null;
  deadlineHours: number;               // 處理時限（遊戲小時）：P1=4, P2=8, P3=24, P4=48
  elapsedHours: number;                // 已過小時
  isBreached: boolean;                 // 超過時限未解決
  region: FacilityRegion | null;       // 影響的機房區域
  affectedContractIds: EntityId[];     // 受影響的合約
  assignedStaffIds: EntityId[];        // 指派處理的工程師
  responses: IncidentResponseRecord[];
  resolutionMethod: string | null;
  financialImpact: Money;              // 實際損失（事件解決後計算）
  downtimeHours: number;               // 服務中斷小時數（影響 SLA）
}

enum IncidentType {
  // 異常事件
  HardwareFailure      = 'HARDWARE_FAILURE',
  NetworkOutage        = 'NETWORK_OUTAGE',
  CapacityAlarm        = 'CAPACITY_ALARM',
  PowerAnomaly         = 'POWER_ANOMALY',
  CoolingFailure       = 'COOLING_FAILURE',
  // 資安事件
  Ransomware           = 'RANSOMWARE',
  DataBreach           = 'DATA_BREACH',
  SocialEngineering    = 'SOCIAL_ENGINEERING',
  APTAttack            = 'APT_ATTACK',
  DDoS                 = 'DDOS',
  ComplianceGap        = 'COMPLIANCE_GAP',
  InsiderThreat        = 'INSIDER_THREAT',
  SupplyChainAttack    = 'SUPPLY_CHAIN_ATTACK',
}

enum IncidentStatus {
  Active        = 'ACTIVE',         // 活躍中，等待處理
  Investigating = 'INVESTIGATING',  // 調查中（APT、資料外洩）
  Mitigating    = 'MITIGATING',     // 緩解中
  Resolved      = 'RESOLVED',
  TimedOut      = 'TIMED_OUT',      // 超過時限未解決
}

interface IncidentResponse {
  incidentId: EntityId;
  action: ResponseAction;
  params?: Record<string, unknown>;   // 依事件類型而定（如勒索軟體贖金金額）
}

enum ResponseAction {
  // 勒索軟體
  PayRansom         = 'PAY_RANSOM',
  RestoreFromBackup = 'RESTORE_BACKUP',
  WaitOut           = 'WAIT_OUT',
  // 資料外洩
  StartInvestigation = 'START_INVESTIGATION',
  ReportToAuthority  = 'REPORT_AUTHORITY',
  // 硬體故障
  WarrantyRepair     = 'WARRANTY_REPAIR',
  ThirdPartyRepair   = 'THIRD_PARTY_REPAIR',
  ReplaceSame        = 'REPLACE_SAME',
  ReplaceUpgrade     = 'REPLACE_UPGRADE',
  RunRequisition     = 'RUN_REQUISITION',
  // 通用
  AssignEngineer     = 'ASSIGN_ENGINEER',
  EscalateToManager  = 'ESCALATE',
}

interface IncidentResponseRecord {
  action: ResponseAction;
  timestamp: GameDate;
  staffId?: EntityId;
  cost?: Money;
  result: string;
}

interface MaintenanceResult {
  type: SecurityMaintenanceType;
  cost: Money;
  complianceScoreDelta: number;
  vulnerabilitiesFound?: number;
  effectDurationMonths: number;
}

interface ThreatAssessment {
  date: GameDate;
  baseRates: Record<IncidentType, number>;    // 各事件基礎月觸發率（%）
  modifiedRates: Record<IncidentType, number>; // 乘上所有修正後的實際率
  topThreats: IncidentType[];
  eosRiskContribution: number;                // EOS 設備對風險的貢獻
  complianceScore: number;
}

interface DefenseCapability {
  id: string;
  name: string;
  effect: string;
  source: 'tech_tree' | 'hardware' | 'software' | 'maintenance';
  incidentTypeReductions: Partial<Record<IncidentType, number>>;
}
```

---

## 內部狀態結構

```typescript
interface SecurityEngineState {
  activeIncidents: Incident[];
  incidentHistory: Incident[];          // 最近 50 筆
  complianceScore: number;              // 0–100（綜合計算）
  securityPostureScore: number;         // 0–100（防禦評估）
  eosRiskMultiplier: number;            // 來自 SoftwareCatalog
  eolHardwareRiskContribution: number;  // 來自 HardwareCatalog
  defenseModifiers: DefenseModifier[];  // 科技樹、維護等效果
  maintenanceEffects: MaintenanceEffect[]; // 有時效的維護效果
  dataBreach: DataBreachState | null;   // 資料外洩通報追蹤
}

interface DefenseModifier {
  sourceId: string;
  incidentTypeReductions: Partial<Record<IncidentType, number>>;
  expiresAt?: GameDate;
}

interface MaintenanceEffect {
  type: SecurityMaintenanceType;
  completedAt: GameDate;
  expiresAt: GameDate;
  complianceBonus: number;
  threatReduction: Partial<Record<IncidentType, number>>;
}

interface DataBreachState {
  incidentId: EntityId;
  discoveredAt: GameDate;
  investigationStartedAt: GameDate | null;
  reportDeadline: GameDate;             // discoveredAt + 3 遊戲天
  reportedAt: GameDate | null;
  isOverdue: boolean;
}
```

---

## 事件觸發邏輯

```
每月 roll（time.month_end 時）：
  for each IncidentType:
    rate = baseRate[type]
           × eosMultiplier
           × eolMultiplier
           × (1 - defenseReduction[type])
           × historyEventMod              // 歷史事件修正（如 APT × 2）
           × complianceMod                // 低合規分數提高觸發率

    if random() < rate:
      generateIncident(type)

APT / 內部威脅為「隱匿事件」：
  生成後不立即通知玩家
  需靠 SIEM / SOC 科技樹偵測
  若未偵測到：潛伏到 dataBreach 觸發
```

---

## 事件處理時間計算

```
resolutionTime(hours) = baseTime / (1 + Σ(assignedStaff.handlingPower))

修正：
  SOC 監控中心  → × 0.7
  ITSM 平台    → × 0.85
  資安分析師/CISO 處理資安類事件 → handlingPower × 2

若超過 deadlineHours：
  isBreached = true
  每小時額外損失 = monthly_revenue × hoursLostRate[severity]
    P1: 月收入 × 5% / 小時
    P2: 月收入 × 2% / 小時
    P3: 月收入 × 0.5% / 小時
    P4: 月收入 × 0.1% / 小時
```

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 每月威脅 roll，推進事件計時 |
| `hardware.eol_expired` | HardwareCatalog | 更新 eolHardwareRiskContribution |
| `hardware.failure` | HardwareCatalog | 直接注入硬體故障事件 |
| `software.eos_security_modifier` | SoftwareCatalog | 更新 eosRiskMultiplier |
| `software.compliance_changed` | SoftwareCatalog | 更新 complianceScore 基礎 |
| `techtree.research_completed` | TechTree | 更新 defenseModifiers |
| `timeline.historical_event` | EventTimeline | 套用歷史事件的威脅修正（WannaCry、俄烏 APT 等）|
| `facility.power_failure` | FacilityManager | 注入電力異常事件 |
| `staff.coverage_changed` | StaffManager | 更新事件處理能力 |

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `security.incident_triggered` | `Incident` | 事件觸發（P1/P2 強制暫停）|
| `security.incident_resolved` | `{ incidentId, downtimeHours, method }` | 事件解決 |
| `security.incident_timed_out` | `{ incidentId, extraLoss }` | 事件超時 |
| `security.compliance_changed` | `{ score, delta }` | 合規分數變動 |
| `security.penalty_incurred` | `{ amount, reason }` | 合規罰款 |
| `security.data_breach_report_due` | `{ deadline }` | 資料外洩通報時限警告 |
| `security.hardware_compromised` | `{ assetId }` | 硬體被攻擊/加密 |
| `security.apt_detected` | `{ incidentId }` | APT 被偵測到（SIEM 觸發）|

---

## SecurityConfig 平衡參數

```typescript
interface SecurityConfig {
  baseIncidentRates: Record<IncidentType, number>;   // 每月基礎觸發率（%）
  incidentSeverity: Record<IncidentType, IncidentSeverity>;
  baseResolutionHours: Record<IncidentType, number>;
  deadlineHours: Record<IncidentSeverity, number>;   // P1=4, P2=8, P3=24, P4=48
  hourlyLossRate: Record<IncidentSeverity, number>;  // per hour as % of monthly revenue
  complianceScoreThresholds: {
    bonus: number;     // 合規分數 > 80 → 所有事件率 × 0.8
    neutral: number;   // 60–80 → 無影響
    penalty1: number;  // 40–60 → × 1.3
    penalty2: number;  // < 40  → × 2.0
  };
  maintenanceCosts: Record<SecurityMaintenanceType, {
    partial?: Money;
    full?: Money;
  }>;
  maintenanceEffectDurations: Record<SecurityMaintenanceType, number>;  // 月數
  ransomPaymentRate: number;             // 0.20（當月收入 ×20%）
  dataBreachReportWindowHours: number;   // 72（3 遊戲天）
}
```

---

## 與其他模組的交互

```
SecurityEngine
  ├── 接收 hardware.eol_expired → 提高硬體故障事件率
  ├── 接收 software.eos_security_modifier → 提高資安事件率
  ├── 接收 techtree.research_completed → 加入 defenseModifiers
  ├── 接收 timeline.historical_event → 套用 WannaCry/APT 等特殊修正
  ├── 發布 security.incident_triggered → TimeEngine（P1/P2 強制暫停）
  ├── 發布 security.incident_triggered → ContractManager（計算停機 SLA 損失）
  ├── 發布 security.incident_resolved → ContractManager（停機結束）
  ├── 發布 security.penalty_incurred → FinanceEngine（罰款）
  └── 發布 security.incident_resolved → ReputationEngine（滿意度影響）
```

---

## 未來擴展點

- **資安演練模式**：玩家可主動發起資安桌遊演練，提升防禦評分。
- **威脅情報訂閱**：購買威脅情報服務（月費）可提前知道哪類事件本月高風險。
- **APT 追蹤視覺化**：APT 攻擊的 kill chain 步驟可視化，增加緊張感。
