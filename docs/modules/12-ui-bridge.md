# 12 — UIBridge UI 橋接層

## 模組職責

UIBridge 是所有遊戲模組與 UI 層之間的**唯一橋樑**。它訂閱所有模組的狀態變化事件，將各模組的內部狀態聚合為 UI 層可直接消費的 ViewModel，消除 UI 元件直接存取遊戲邏輯的需要。

**單一職責**：模組狀態 → ViewModel 的轉換與彙整。不包含 React 元件、不包含業務邏輯、不修改遊戲狀態。

---

## 設計原則

```
Game Modules ──[subscribe]──▶ UIBridge ──[ViewModel]──▶ React UI

規則：
  ✅ UI 元件只讀取 UIBridge 提供的 ViewModel
  ✅ UI 元件透過 UIBridge 的 action 函式觸發遊戲行為（轉發給模組）
  ❌ UI 元件不直接呼叫 GameModule 的方法
  ❌ UIBridge 不包含 React hooks 或元件邏輯
```

---

## 公開介面（Public API）

```typescript
interface IUIBridge extends IGameModule {
  readonly moduleId: 'UIBridge';

  /** 訂閱 ViewModel 的變化（供 React useSyncExternalStore 使用）。 */
  subscribe(listener: () => void): () => void;

  /** 取得目前完整的 ViewModel 快照。 */
  getSnapshot(): GameViewModel;

  /** 取得特定子 ViewModel（避免全量訂閱）。 */
  getHUDViewModel(): HUDViewModel;
  getFinanceViewModel(): FinanceViewModel;
  getFacilityViewModel(): FacilityViewModel;
  getContractViewModel(): ContractViewModel;
  getStaffViewModel(): StaffViewModel;
  getSecurityViewModel(): SecurityViewModel;
  getTechTreeViewModel(): TechTreeViewModel;
  getEventViewModel(): EventViewModel;

  // ── 玩家 Action（UIBridge 轉發到對應模組）──

  setGameSpeed(speed: GameSpeed): void;
  pauseGame(): void;
  resumeGame(): void;

  purchaseHardware(modelId: string, qty: number, region: FacilityRegion, method: PurchasePaymentMethod): void;
  disposeHardware(assetId: EntityId): void;
  upgradeCooling(region: FacilityRegion, level: CoolingLevel): void;
  expandFacility(region: FacilityRegion): void;

  purchaseSoftware(productId: string): void;
  cancelSoftware(licenseId: EntityId): void;

  submitBid(rfpId: EntityId, bid: BidParams): void;
  declineRFP(rfpId: EntityId): void;
  renewContract(contractId: EntityId, params: RenewalParams): void;

  postJobOpening(role: StaffRole): void;
  conductInterview(openingId: EntityId, answers: boolean[]): void;
  hireStaff(openingId: EntityId): void;
  layoffStaff(staffId: EntityId): void;
  setShiftMode(mode: ShiftMode): void;

  startResearch(nodeId: string): void;
  cancelResearch(nodeId: string): void;

  respondToIncident(incidentId: EntityId, response: IncidentResponse): void;
  executeSecurityMaintenance(type: SecurityMaintenanceType): void;

  applyForLoan(amount: Money, termMonths: number): void;
  repayLoan(loanId: EntityId): void;

  makeEventDecision(decisionId: EntityId, optionIndex: number): void;
}
```

---

## ViewModel 結構

### 頂層 GameViewModel

```typescript
interface GameViewModel {
  hud: HUDViewModel;
  finance: FinanceViewModel;
  facility: FacilityViewModel;
  contracts: ContractViewModel;
  staff: StaffViewModel;
  security: SecurityViewModel;
  techTree: TechTreeViewModel;
  events: EventViewModel;
  notifications: NotificationViewModel[];
  isLoading: boolean;
}
```

### HUDViewModel（頂部資訊欄）

```typescript
interface HUDViewModel {
  currentDate: GameDate;               // '2008/11'
  speed: GameSpeed;
  isPaused: boolean;
  cash: Money;                         // NT$23,400,000
  cashDisplay: string;                 // 'NT$2,340 萬'
  monthlyNetProfit: Money;
  monthlyNetProfitDisplay: string;     // '+NT$23 萬' 或 '-NT$5 萬'
  creditRating: CreditRating;
  overallSatisfaction: number;         // 78
  activeContractCount: number;         // 14
  activeIncidentCount: number;         // P1 件數（角標）
  timeControlState: TimeControlState;
  pauseReason: PauseReason | null;
  alerts: HUDAlert[];                  // 重要警示（紅色/黃色）
}

interface TimeControlState {
  canPause: boolean;
  canResume: boolean;
  canSetSpeed: boolean;
  availableSpeeds: GameSpeed[];
  quarterProgress: number;             // 0–1，當前季度進度
}

interface HUDAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  actionLabel?: string;
  actionModuleTarget?: string;
}
```

### FinanceViewModel（財務報表）

```typescript
interface FinanceViewModel {
  currentMonth: PLStatement;
  lastMonth: PLStatement | null;
  plHistory: PLSummary[];              // 最近 12 個月摘要
  balanceSheet: BalanceSheet;
  cashFlowStatement: CashFlowStatement;
  creditRating: CreditRating;
  creditScore: number;
  creditRatingFactors: CreditRatingFactor[];
  activeLoans: LoanViewModel[];
  loanCapacity: LoanCapacityInfo;
  kpiSummary: FinanceKPI;
}

interface PLSummary {
  date: GameDate;
  totalRevenue: Money;
  totalExpenses: Money;
  netProfit: Money;
  isProfit: boolean;
}

interface LoanViewModel {
  id: EntityId;
  principalDisplay: string;
  remainingDisplay: string;
  monthlyPaymentDisplay: string;
  annualRate: number;
  endDate: GameDate;
  isOverdue: boolean;
}

interface LoanCapacityInfo {
  currentRating: CreditRating;
  maxLoanAmount: Money;
  currentAvailable: Money;
  annualRate: number;
}

interface FinanceKPI {
  grossMargin: number;                 // %
  ebitdaDisplay: string;              // NT$ 金額
  cashConversionRate: number;          // %
  monthsOfRunway: number;              // 按月支出計算的剩餘月數
}
```

### FacilityViewModel（機房管理）

```typescript
interface FacilityViewModel {
  regions: FacilityRegionViewModel[];
  globalPUE: number;
  totalMonthlyElectricity: Money;
  totalMonthlyRent: Money;
  geoRedundancyActive: boolean;
}

interface FacilityRegionViewModel {
  region: FacilityRegion;
  regionName: string;                  // '北區'
  isUnlocked: boolean;
  totalUnits: number;
  usedUnits: number;
  utilizationPercent: number;          // 0–100
  utilizationBarColor: 'green' | 'yellow' | 'red';
  pue: number;
  coolingLevel: CoolingLevel;
  coolingLevelName: string;            // '熱通道封閉'
  monthlyElectricity: Money;
  monthlyRent: Money;
  canExpandCapacity: boolean;
  expansionCost: Money;
  availableCoolingUpgrades: CoolingUpgradeOption[];
  hardwareAssets: HardwareAssetSummary[];
  assignedStaff: StaffSummary[];
}

interface HardwareAssetSummary {
  id: EntityId;
  modelName: string;
  status: AssetStatus;
  eolStatus: 'ok' | 'warning' | 'expired';
  eolCountdown: string;                // '2 個月後 EOL'
  bookValue: string;                   // 'NT$12 萬'
  failureRate: number;
  maintenanceType: MaintenanceType;
}
```

### ContractViewModel（合約管理）

```typescript
interface ContractViewModel {
  activeContracts: ContractSummary[];
  pendingRFPs: RFPSummary[];
  pendingBids: BidSummary[];
  totalMonthlyRevenue: Money;
  slaBoard: SLADashboard;
  atRiskContracts: ContractSummary[];
}

interface ContractSummary {
  id: EntityId;
  clientName: string;
  clientTier: CustomerTier;
  serviceType: ServiceType;
  monthlyFeeDisplay: string;
  slaLevel: number;
  status: ContractStatus;
  endDate: GameDate;
  satisfaction: number;
  isRenewalWarning: boolean;           // 到期前 1 個月
  slaComplianceStatus: 'ok' | 'warning' | 'breach';
}

interface RFPSummary {
  id: EntityId;
  clientName: string;
  clientTier: CustomerTier;
  budgetDisplay: string;
  daysRemaining: number;
  feasibility: FeasibilityReport;
  isFeasible: boolean;
}
```

### SecurityViewModel（資安面板）

```typescript
interface SecurityViewModel {
  activeIncidents: IncidentSummary[];
  complianceScore: number;
  complianceStatus: 'safe' | 'warning' | 'critical';
  securityPostureScore: number;
  threatAssessment: ThreatAssessment;
  eosRiskLicenses: { licenseId: EntityId; productName: string; monthsOverEOS: number }[];
  eolRiskAssets: { assetId: EntityId; modelName: string; monthsOverEOL: number }[];
  maintenanceHistory: MaintenanceResult[];
  pendingDataBreachReport: DataBreachState | null;
}

interface IncidentSummary {
  id: EntityId;
  type: IncidentType;
  severity: IncidentSeverity;
  severityLabel: string;               // 'P1 緊急'
  statusLabel: string;                 // '處理中'
  elapsedHours: number;
  deadlineHours: number;
  isBreached: boolean;
  progressPercent: number;
  affectedContractCount: number;
  responseOptions: IncidentResponseOption[];
}

interface IncidentResponseOption {
  action: ResponseAction;
  label: string;
  costDisplay: string;
  estimatedResolutionHours: number;
  isRecommended: boolean;
}
```

### EventViewModel（事件通知）

```typescript
interface EventViewModel {
  pendingDecisions: EventDecisionSummary[];
  recentEvents: EventLogEntry[];
  upcomingHistoricalEvents: UpcomingEvent[];
  currentEconomicCycle: EconomicCycle;
  economicCycleDescription: string;    // '景氣衰退：IT 預算普遍削減 15%'
}

interface EventDecisionSummary {
  id: EntityId;
  eventName: string;
  description: string;
  options: Array<{ index: number; label: string; description: string }>;
  daysUntilExpiry: number;
  isUrgent: boolean;
}

interface UpcomingEvent {
  eventId: string;
  name: string;
  monthsAway: number;
  previewDescription: string;         // '3 個月後：晶片短缺預警，建議提前備料'
}

interface EventLogEntry {
  id: EntityId;
  date: GameDate;
  category: 'security' | 'finance' | 'contract' | 'staff' | 'hardware' | 'event';
  severity: 'critical' | 'warning' | 'info' | 'success';
  message: string;
  financialImpact?: Money;
}
```

### NotificationViewModel（即時通知）

```typescript
interface NotificationViewModel {
  id: EntityId;
  type: 'p1_incident' | 'p2_incident' | 'rfp' | 'contract_expiry' | 'eol_warning'
      | 'cash_warning' | 'major_event' | 'month_end' | 'tech_complete';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  body: string;
  actionRequired: boolean;
  autoFocusTab?: string;               // 自動切換到哪個 Tab
  timestamp: GameDate;
}
```

---

## 內部實作要點

```typescript
interface UIBridgeState {
  viewModel: GameViewModel;
  dirtyFlags: Set<string>;             // 哪些子 ViewModel 需要重建
  listeners: Set<() => void>;          // React 訂閱者
}
```

### 更新策略

- UIBridge 訂閱所有模組事件
- 收到事件後，標記對應的 dirty flag（不立即重建）
- 在每個 `tick()` 的末尾，批量重建所有 dirty 的子 ViewModel
- 呼叫所有 listeners（觸發 React re-render）
- 此策略避免同一 tick 多次重建 ViewModel

---

## 接收的事件（訂閱所有模組）

UIBridge 訂閱所有模組發出的事件，以下列出主要觸發 ViewModel 更新的事件：

| 訂閱事件 | 更新的 ViewModel |
|---------|-----------------|
| `time.*` | hud |
| `finance.*` | hud, finance |
| `facility.*` | facility, hud |
| `hardware.*` | facility |
| `software.*` | security |
| `contract.*` | contracts, hud |
| `staff.*` | staff, hud |
| `security.*` | security, hud |
| `techtree.*` | techTree |
| `timeline.*` | events, hud |
| `reputation.*` | hud, contracts |

---

## UIBridge 不做的事

- **不包含 React hooks**：`subscribe/getSnapshot` 是 vanilla JS API，供外部 `useSyncExternalStore` 包裝。
- **不包含業務邏輯**：ViewModel 的計算只做展示轉換（格式化金額、計算百分比）。
- **不做授權檢查**：Action 的可用性（如按鈕 disabled 狀態）由 ViewModel 中的布林欄位表示。

---

## 未來擴展點

- **多語系支援**：ViewModel 的 display 字串可透過 i18n 函式生成。
- **離線模式快取**：ViewModel 可序列化為 localStorage cache，提升初次載入速度。
- **Debug ViewModel**：開發者模式下，額外暴露每個模組的 raw state 供除錯。
