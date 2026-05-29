# 07 — StaffManager 人力資源管理

## 模組職責

StaffManager 管理所有員工的完整生命週期：招募、到職、培訓、晉升、薪資、排班、離職。它計算人力覆蓋率，提供事件處理能力，並在人力不足時發布 debuff 給相關系統。

**單一職責**：人力資源的狀態管理與薪資計算。不直接處理資安事件或 SLA 計算。

---

## 公開介面（Public API）

```typescript
interface IStaffManager extends IGameModule {
  readonly moduleId: 'StaffManager';

  /** 取得所有員工列表。 */
  getStaff(): StaffMember[];

  /** 取得特定員工。 */
  getStaffMember(staffId: EntityId): StaffMember | null;

  /** 取得當前覆蓋率（員工總管理能力 / 已部署設備 U 數）。 */
  getCoverageRatio(): number;

  /** 取得總管理能力（U）。 */
  getTotalManagementCapacity(): number;

  /** 取得事件處理能力（incidents per hour）。 */
  getIncidentHandlingCapacity(): IncidentHandlingCapacity;

  /** 發布招募職缺。 */
  postJobOpening(role: StaffRole): JobOpening;

  /** 進行面試（選擇題回答決定員工素質）。 */
  conductInterview(openingId: EntityId, answers: boolean[]): InterviewResult;

  /** 錄取員工（面試通過後）。 */
  hire(openingId: EntityId): StaffMember;

  /** 裁員（支付資遣費）。 */
  layoff(staffId: EntityId): LayoffResult;

  /** 啟動升職流程（支付升職費用）。 */
  promoteStaff(staffId: EntityId): boolean;

  /** 設定全公司排班模式。 */
  setShiftMode(mode: ShiftMode): void;

  /** 取得當前排班模式。 */
  getShiftMode(): ShiftMode;

  /** 計算本月薪資總額（含法定福利）。 */
  calculateMonthlyPayroll(): Money;

  /** 取得可用於事件處理的工程師列表（依處理力排序）。 */
  getAvailableEngineers(): StaffMember[];

  /** 標記工程師正在處理特定事件（影響其他事件的回應能力）。 */
  assignToIncident(staffId: EntityId, incidentId: EntityId): void;

  /** 釋放工程師（事件處理完畢）。 */
  releaseFromIncident(staffId: EntityId, incidentId: EntityId): void;
}
```

---

## 核心資料結構

```typescript
interface StaffMember {
  id: EntityId;
  name: string;                         // 隨機生成台灣姓名
  role: StaffRole;
  level: 1 | 2 | 3 | 4 | 5;            // E1–E5
  monthlySalaryNTD: Money;
  hireDate: GameDate;
  monthsInService: number;
  qualityScore: number;                 // 0.9–1.1（面試表現）
  status: StaffStatus;
  promotionEligibleDate: GameDate;      // 達到升職在職時間後
  promotionCostNTD: Money;
  managementCapacityU: number;          // 可管理的 U 數
  handlingPower: number;               // 事件處理力（E1=0.5, E2=1.0, E3=2.0, E4=4.0, E5=8.0）
  isSecuritySpecialist: boolean;       // E3 資安分析師 / E5 CISO，資安事件處理力 ×2
  assignedIncidentIds: EntityId[];     // 目前佔用中的事件
  assignedRegion: FacilityRegion | null; // 駐點區域
  trainingCompletionDate: GameDate | null; // 培訓/進修完成日
  satisfactionScore: number;           // 0–100，影響離職率
}

enum StaffStatus {
  InRecruitment = 'IN_RECRUITMENT',    // 招募中（等待招募時間）
  InTraining    = 'IN_TRAINING',       // 新人訓練中（到職後 2 週）
  Active        = 'ACTIVE',            // 正常工作中
  OnLeave       = 'ON_LEAVE',          // 請假（SARS 等事件）
  Assigned      = 'ASSIGNED',          // 指派至事件處理
  ResignPending = 'RESIGN_PENDING',    // 即將離職（1 個月通知期）
}

enum ShiftMode {
  DayOnly     = 'DAY_ONLY',           // 08:00–17:00，夜間無支援
  TwoShift    = 'TWO_SHIFT',          // 08:00–24:00，需 +40% 人力
  ThreeShift  = 'THREE_SHIFT',        // 全天候 24hr，需 +80% 人力
  AIOps       = 'AIOPS',              // 科技樹解鎖後，全天候且人力需求 -30%
}

interface JobOpening {
  id: EntityId;
  role: StaffRole;
  postedDate: GameDate;
  recruitmentDurationMonths: number;   // 依職等而定（E1=0.5, E2=1, E3=1.5, E4=2, E5=3）
  availableDate: GameDate;             // 預計到職日
  status: 'recruiting' | 'interview_ready' | 'filled' | 'cancelled';
  candidateName: string;
}

interface InterviewResult {
  openingId: EntityId;
  score: number;                        // 答對題數
  qualityBonus: number;                 // −0.1 到 +0.1，加在基礎 qualityScore 上
}

interface LayoffResult {
  staffId: EntityId;
  severancePay: Money;                  // 資遣費（月薪 × 在職年數）
  date: GameDate;
}

interface IncidentHandlingCapacity {
  totalHandlingPower: number;           // Σ handlingPower（可用工程師）
  availableForIncidents: number;        // 未被佔用的處理力
  securityHandlingPower: number;        // 資安事件專用處理力
  estimatedResolutionMultiplier: number; // 1 + Σ(工程師處理力) 用於事件處理公式
}
```

---

## 內部狀態結構

```typescript
interface StaffManagerState {
  staff: StaffMember[];
  jobOpenings: JobOpening[];
  shiftMode: ShiftMode;
  coverageRatio: number;               // 快取值，每月更新
  requiredCapacityU: number;           // 由 FacilityManager 提供的已部署 U 數
  annualInflationRate: number;          // 薪資通膨率（每年調整）
  talentWarActive: boolean;            // 人才搶奪戰事件中
  recruitmentCostMod: number;          // 招募成本倍率（1.0–2.0）
  resignationRateMod: number;          // 離職率倍率（1.0–3.0）
  techTreeBonuses: StaffTechBonus;
}

interface StaffTechBonus {
  aiopsEnabled: boolean;               // AIOps 科技樹解鎖
  trainingProgramEnabled: boolean;     // 人才培育計畫
  automationEnabled: boolean;          // 自動化運維
  managementCapacityBonus: number;     // 每位工程師管理容量 +% 加成
  promotionTimeReduction: number;      // 升職時間 -% 加成
  resignationRateReduction: number;    // 離職率 -% 加成
}
```

---

## 覆蓋率計算

```
requiredCapacityU = FacilityManager.getTotalUsedUnits()（各區合計）

totalManagementCapacity = Σ(staff.managementCapacityU)
                        × (1 + techTreeBonuses.managementCapacityBonus)

coverageRatio = totalManagementCapacity / requiredCapacityU

shiftMode 人力需求乘數：
  DayOnly    → 要求 coverageRatio 達 1.0（但夜間缺席有懲罰）
  TwoShift   → 建議實際員工數 ×1.4
  ThreeShift → 建議實際員工數 ×1.8
  AIOps      → 等效 ThreeShift，但人力成本 ×0.7
```

---

## 離職機率計算

```
每月 roll（per 員工）：
  baseRate = config.baseAnnualResignationRate / 12  (10% / 12 ≈ 0.833%/月)
  × resignationRateMod                              (事件、公司狀態）
  × talentWarMod                                    (人才搶奪戰 ×3)
  × salaryFreezeMod                                 (薪資 2 年未調 ×1.5)
  × companyLossMod                                  (連虧 3 月 ×2)
  × trainingProgramMod                              (人才培育計畫 ×0.7)
```

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 薪資計算、在職月數更新、離職 roll、升職資格檢查 |
| `time.year_end` | TimeEngine | 薪資通膨調整 |
| `hardware.installed` | HardwareCatalog | 更新 requiredCapacityU |
| `hardware.removed` | HardwareCatalog | 更新 requiredCapacityU |
| `techtree.research_completed` | TechTree | 更新 techTreeBonuses |
| `timeline.talent_war` | EventTimeline | 啟動 talentWarActive 與修正係數 |
| `timeline.pandemic` | EventTimeline | 員工效率降低（SARS、COVID）|
| `finance.consecutive_loss` | FinanceEngine | 觸發 companyLossMod |

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `staff.hired` | `StaffMember` | 新員工到職 |
| `staff.resigned` | `{ staffId, role, name }` | 員工離職 |
| `staff.laid_off` | `{ staffId, severancePay }` | 員工裁員 |
| `staff.promoted` | `{ staffId, fromRole, toRole }` | 員工晉升 |
| `staff.salary_due` | `{ totalAmount, breakdown[] }` | 月薪帳單 |
| `staff.coverage_changed` | `{ ratio, mode }` | 覆蓋率或排班變動 |
| `staff.insufficient_coverage` | `{ ratio, debuffs[] }` | 人力不足警告 |
| `staff.job_opening_created` | `JobOpening` | 職缺發布 |

---

## StaffConfig 平衡參數

```typescript
interface StaffConfig {
  roles: Record<StaffRole, {
    baseSalaryNTD: Money;
    managementCapacityU: number;
    handlingPower: number;
    recruitmentMonths: number;
    promotionRequirements: { minMonths: number; cost: Money };
    unlockYear: number;
    unlockCondition?: string;
  }>;
  benefitMultiplier: number;            // 1.3（法定福利）
  baseAnnualResignationRate: number;    // 0.10（10%）
  salaryInflationRate: number;          // 0.025（每年 2.5%）
  coverageRatioThresholds: {
    optimal: number;                    // 1.0
    warning: number;                    // 0.7
    critical: number;                   // 0.5
    severe: number;                     // < 0.5
  };
  interviewQuestionCount: number;       // 3
  severanceMonthsPerYear: number;       // 1（每在職年資遣 1 個月薪水）
}
```

---

## 與其他模組的交互

```
StaffManager
  ├── 接收 time.month_end → 計算薪資，更新在職時間，觸發離職 roll
  ├── 接收 hardware.installed → 更新 requiredCapacityU → 重算覆蓋率
  ├── 接收 techtree.research_completed → 更新管理容量加成
  ├── 發布 staff.salary_due → FinanceEngine 扣款
  ├── 發布 staff.coverage_changed → SecurityEngine（影響事件處理速度）
  ├── 發布 staff.coverage_changed → ContractManager（服務容量快照更新）
  ├── 發布 staff.insufficient_coverage → ReputationEngine（滿意度 -2/月）
  └── 接收 security.incident → assignToIncident / releaseFromIncident
```

---

## 未來擴展點

- **外包服務**：人力不足時可聘用臨時外包（高成本，低效率），避免立即 SLA 違約。
- **員工培訓課程**：主動發送員工參加培訓提升技能（消耗時間但提升能力）。
- **工會事件**：大型企業後期可能出現工會談判事件。
