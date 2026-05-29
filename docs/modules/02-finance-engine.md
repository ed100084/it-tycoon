# 02 — FinanceEngine 財務引擎

## 模組職責

FinanceEngine 是遊戲的**財務總帳**。它負責：

- 維護損益表（P&L）、資產負債表、現金流量表
- 月結算：收入入帳、支出扣款、折舊攤提、稅務計算
- 銀行貸款管理：申請、利息計算、還款追蹤
- 信用評等計算（每季更新）
- 監控失敗條件（現金斷流、破產風險）
- 歷史財報快照（12 個月滾動）

**單一職責**：財務計算與帳務記錄。不決定採購、不管理人員。

---

## 公開介面（Public API）

```typescript
interface IFinanceEngine extends IGameModule {
  readonly moduleId: 'FinanceEngine';

  /** 當前現金餘額（NTD 分）。 */
  getCash(): Money;

  /** 月度 P&L 預覽（當月至今的預估）。 */
  getMonthlyPLPreview(): PLStatement;

  /** 上個月的完整 P&L 報表。 */
  getLastMonthPL(): PLStatement | null;

  /** 最近 N 個月的 P&L 列表（含當月）。 */
  getPLHistory(months?: number): PLStatement[];

  /** 當前資產負債表。 */
  getBalanceSheet(): BalanceSheet;

  /** 當前現金流量表（本月）。 */
  getCashFlowStatement(): CashFlowStatement;

  /** 信用評等。 */
  getCreditRating(): CreditRating;

  /** 信用評等分數（內部分數，用於計算等級）。 */
  getCreditScore(): number;

  /** 取得當前有效的貸款列表。 */
  getActiveLoans(): Loan[];

  /** 申請貸款（若信用評等允許）。回傳貸款 ID 或 null（不符資格）。 */
  applyForLoan(amount: Money, termMonths: number): EntityId | null;

  /** 提前還款（全額清償特定貸款）。 */
  repayLoan(loanId: EntityId): boolean;

  /** 登記收入（合約月費入帳時由 ContractManager 呼叫）。
   *  建議透過事件觸發，避免直接呼叫。 */
  recordIncome(entry: IncomeEntry): void;

  /** 登記支出（硬體採購、薪資等）。
   *  建議透過事件觸發，避免直接呼叫。 */
  recordExpense(entry: ExpenseEntry): void;

  /** 計算指定月份的預估稅後利潤。 */
  estimateNetProfit(date: GameDate): Money;

  /** 取得當前基準利率（受歷史事件調整）。 */
  getCurrentBaseInterestRate(): number;

  /** 信用評等升降的影響因素明細（用於 UI 顯示）。 */
  getCreditRatingFactors(): CreditRatingFactor[];
}
```

---

## 核心資料結構

```typescript
interface PLStatement {
  date: GameDate;

  // 收入
  income: {
    colocation: Money;
    vps: Money;
    saas: Money;
    bandwidth: Money;
    msp: Money;
    draas: Money;
    mssp: Money;
    aiCompute: Money;
    profServices: Money;
    training: Money;
    total: Money;
  };

  // 支出
  expenses: {
    hardwareDepreciation: Money;  // 月攤提
    softwareLicense: Money;
    electricity: Money;
    bandwidth: Money;
    staffSalary: Money;           // 含法定福利 ×1.3
    facilityRent: Money;
    maintenanceContracts: Money;
    insurance: Money;
    compliance: Money;
    slaBreachPenalty: Money;
    loanInterest: Money;
    other: Money;
    total: Money;
  };

  preTaxProfit: Money;
  taxAmount: Money;               // preTaxProfit × corporateTaxRate
  netProfit: Money;
}

interface BalanceSheet {
  date: GameDate;
  assets: {
    cash: Money;
    hardwareBookValue: Money;     // 帳面值（原值 - 累計折舊）
    accountsReceivable: Money;    // 應收帳款
    totalAssets: Money;
  };
  liabilities: {
    loanBalance: Money;           // 未還本金
    accountsPayable: Money;       // 應付帳款
    totalLiabilities: Money;
  };
  equity: Money;                  // totalAssets - totalLiabilities
}

interface CashFlowStatement {
  date: GameDate;
  operating: {
    customerReceipts: Money;
    cashExpenses: Money;          // 不含折舊（非現金）
    taxPayment: Money;
    net: Money;
  };
  investing: {
    hardwarePurchases: Money;     // 負值（現金流出）
    facilityExpansion: Money;
    assetDisposals: Money;        // 舊設備賣出收入（正值）
    net: Money;
  };
  financing: {
    loanProceeds: Money;          // 借款收入（正值）
    loanRepayments: Money;        // 還款（負值）
    interestPaid: Money;
    net: Money;
  };
  netChange: Money;
  closingCash: Money;
}

interface Loan {
  id: EntityId;
  principal: Money;               // 本金
  remainingBalance: Money;        // 未還餘額
  annualRate: number;             // 年化利率（固定於核貸時）
  monthlyPayment: Money;          // 等額月付（本金+利息）
  startDate: GameDate;
  endDate: GameDate;
  isOverdue: boolean;
}

interface IncomeEntry {
  date: GameDate;
  type: ServiceType;
  contractId?: EntityId;
  amount: Money;
  description: string;
}

interface ExpenseEntry {
  date: GameDate;
  category: ExpenseCategory;
  referenceId?: EntityId;        // 關聯的資產/員工/合約 ID
  amount: Money;
  isCashExpense: boolean;        // false = 折舊（非現金）
  description: string;
}

enum ExpenseCategory {
  HardwareDepreciation = 'HARDWARE_DEPRECIATION',
  SoftwareLicense      = 'SOFTWARE_LICENSE',
  Electricity          = 'ELECTRICITY',
  Bandwidth            = 'BANDWIDTH',
  StaffSalary          = 'STAFF_SALARY',
  FacilityRent         = 'FACILITY_RENT',
  Maintenance          = 'MAINTENANCE',
  Insurance            = 'INSURANCE',
  Compliance           = 'COMPLIANCE',
  SLABreach            = 'SLA_BREACH',
  LoanInterest         = 'LOAN_INTEREST',
  HardwarePurchase     = 'HARDWARE_PURCHASE',
  TechTreeInvestment   = 'TECH_TREE_INVESTMENT',
  SecurityMaintenance  = 'SECURITY_MAINTENANCE',
  Other                = 'OTHER',
}

interface CreditRatingFactor {
  factor: string;
  deltaScore: number;            // 正/負分值
  description: string;
}
```

---

## 內部狀態結構

```typescript
interface FinanceEngineState {
  cash: Money;
  currentMonthIncome: IncomeEntry[];   // 本月收入流水
  currentMonthExpense: ExpenseEntry[]; // 本月支出流水
  plHistory: PLStatement[];            // 最多 36 個月
  loans: Loan[];
  creditScore: number;                 // 0–100，超過閾值升等
  creditRating: CreditRating;
  consecutiveProfitMonths: number;     // 連續獲利月數
  consecutiveLossMonths: number;       // 連續虧損月數（失敗條件）
  lastCreditUpdateDate: GameDate | null;
  baseInterestRate: number;            // 當前央行基準利率（受歷史事件調整）
  inflationRate: number;               // 當年通膨率（受 EconomyEngine 調整）
  exchangeRateMod: number;             // 當前匯率修正係數（受歷史事件調整）
  econHardwareMod: number;             // 硬體採購成本修正（景氣 + 事件）
}
```

---

## 月結算流程

```
收到 time.month_end 事件:
  1. 計算本月稅前淨利
     = Σ income - Σ expenses（含折舊、SLA 賠償）
  2. 計算稅款（preTaxProfit > 0 時適用）
     = preTaxProfit × corporateTaxRate（預繳，季末調整）
  3. 扣款：現金 -= 所有現金支出（排除折舊）
  4. 入帳：現金 += 所有現金收入
  5. 貸款月付：現金 -= Σ monthlyPayment（處理逾期）
  6. 快照：將本月 PL 加入 plHistory
  7. 更新 consecutiveProfitMonths / consecutiveLossMonths
  8. 檢查失敗條件：
     - 連續 3 個月虧損且信用 < B → publish('finance.bankruptcy_risk')
     - 現金 < 0 → publish('finance.cash_depleted')
  9. 檢查現金警戒：
     - 現金 < monthlyExpenses × cashWarningMultiplier → publish('finance.cash_warning')
  10. publish('finance.monthly_settlement', PLStatement)

收到 time.quarter_end 事件:
  11. 更新信用評等（若距上次更新 ≥ 3 個月）
  12. publish('finance.credit_rating_changed') 若有變化

收到 time.year_end 事件:
  13. 年度稅務調整（預繳 vs 實際差額）
  14. 薪資通膨：publish('finance.inflation_adjustment', { rate })
```

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 觸發月結算 |
| `time.quarter_end` | TimeEngine | 觸發信用評等更新 |
| `time.year_end` | TimeEngine | 觸發年度稅務調整 |
| `hardware.purchased` | HardwareCatalog | 登記硬體採購現金支出 |
| `hardware.disposed` | HardwareCatalog | 登記舊設備處置收入 |
| `contract.revenue_collected` | ContractManager | 月費入帳 |
| `contract.sla_breach_penalty` | ContractManager | SLA 賠償扣款 |
| `staff.salary_due` | StaffManager | 薪資支出 |
| `facility.rent_due` | FacilityManager | 租金支出 |
| `facility.electricity_due` | FacilityManager | 電費支出 |
| `software.license_fee_due` | SoftwareCatalog | 軟體授權費 |
| `techtree.investment_made` | TechTree | 科技樹投資支出 |
| `timeline.economic_modifier_changed` | EventTimeline | 更新匯率/成本修正係數 |
| `security.penalty_incurred` | SecurityEngine | 合規罰款 |

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `finance.monthly_settlement` | `PLStatement` | 月結算完成 |
| `finance.credit_rating_changed` | `{ from, to, score }` | 信用評等變動 |
| `finance.cash_warning` | `{ cash, monthlyExpenses }` | 現金警戒 |
| `finance.bankruptcy_risk` | `{ consecutiveLossMonths }` | 破產風險 |
| `finance.cash_depleted` | `{}` | 現金歸零 |
| `finance.loan_approved` | `Loan` | 貸款核准 |
| `finance.loan_repaid` | `{ loanId }` | 貸款清償 |
| `finance.loan_overdue` | `{ loanId }` | 貸款逾期 |
| `finance.inflation_adjustment` | `{ rate, year }` | 通膨調整通知 |

---

## FinanceConfig 平衡參數

```typescript
interface FinanceConfig {
  corporateTaxRate: number;                      // 0.17
  staffBenefitMultiplier: number;                // 1.3（法定福利）
  creditRatingUpdateIntervalMonths: number;       // 3
  bankruptcyConsecutiveLossMonths: number;        // 3
  cashWarningMultiplier: number;                  // 2
  slaBreachPayoutCap: number;                     // 3.0
  depreciation: {
    server: number;     // 60 個月（5 年）
    networking: number; // 84 個月（7 年）
    storage: number;    // 60 個月（5 年）
    ups: number;        // 120 個月（10 年）
    facility: number;   // 240 個月（20 年）
    residualRate: number; // 0.10（殘值 10%）
  };
  loanTerms: Record<CreditRating, LoanTermConfig>;
  centralBankRateHistory: Array<{
    fromYear: number;
    rate: number;
  }>;
}
```

---

## 與其他模組的交互

```
FinanceEngine
  ├── 接收 time.month_end → 執行月結算
  ├── 接收來自 8 個模組的支出/收入事件 → 記錄流水帳
  ├── 發布 finance.monthly_settlement → UIBridge 更新財報面板
  ├── 發布 finance.cash_warning → TimeEngine 觸發暫停
  ├── 發布 finance.bankruptcy_risk → TimeEngine 觸發暫停 + UIBridge 警告
  └── 發布 finance.credit_rating_changed → ContractManager（影響 RFP 出現率）
                                         → StaffManager（影響員工信心）
```

---

## 未來擴展點

- **股東分紅系統**：達到特定獲利後可選擇分紅 vs 再投資。
- **外部投資人**：里程碑後可引入 VC 注資，換取股份稀釋。
- **多幣種**：若支援海外分支，需加入 USD/JPY 帳戶管理。
- **EBITDA 報表**：目前基礎 P&L 足夠，後期可加入 EBITDA 分析。
