# 11 — ReputationEngine 聲譽系統

## 模組職責

ReputationEngine 維護整體客戶滿意度（0–100）與公司口碑，根據事件結果更新分數，並將滿意度的影響回饋到合約管理（續約率、RFP 頻率）與財務（月費談判空間）。

**單一職責**：客戶滿意度的計算與口碑影響管理。不直接修改合約狀態（通知 ContractManager）。

---

## 公開介面（Public API）

```typescript
interface IReputationEngine extends IGameModule {
  readonly moduleId: 'ReputationEngine';

  /** 取得整體客戶滿意度（0–100）。 */
  getSatisfactionScore(): number;

  /** 取得各客戶等級的平均滿意度。 */
  getSatisfactionByTier(): Record<CustomerTier, number>;

  /** 取得滿意度變化歷史（最近 12 個月）。 */
  getSatisfactionHistory(): SatisfactionSnapshot[];

  /** 取得影響滿意度的當前活躍因素。 */
  getActiveModifiers(): SatisfactionModifier[];

  /** 取得目前的口碑影響（RFP 頻率、續約率、月費談判空間）。 */
  getReputationEffects(): ReputationEffects;

  /** 強制更新指定合約的滿意度（ContractManager 呼叫）。 */
  updateContractSatisfaction(contractId: EntityId, delta: number, reason: string): void;
}
```

---

## 核心資料結構

```typescript
interface SatisfactionSnapshot {
  date: GameDate;
  score: number;
  delta: number;                        // 當月變化量
  topPositiveFactors: string[];
  topNegativeFactors: string[];
}

interface SatisfactionModifier {
  id: string;
  description: string;
  delta: number;                        // 每月持續影響（或一次性）
  isOneTime: boolean;
  source: string;                       // 事件/模組來源
  appliedAt: GameDate;
  expiresAt: GameDate | null;
}

interface ReputationEffects {
  rfpFrequencyMod: number;             // 高滿意度 → RFP 更多
  renewalSuccessRateBonus: number;     // 高滿意度 → 自動續約成功率 +%
  pricingPower: number;                // 高滿意度 → 可要求漲價 5–15%
  contractLossProbabilityMod: number;  // 低滿意度 → 合約流失概率更高
}
```

---

## 內部狀態結構

```typescript
interface ReputationEngineState {
  overallScore: number;                 // 0–100
  scoreByTier: Record<CustomerTier, number>;
  history: SatisfactionSnapshot[];      // 最近 36 個月
  activeModifiers: SatisfactionModifier[];
  naturalRecoveryRate: number;          // 每月自然回復量（若分數 < 80）
}
```

---

## 滿意度變化規則

```
每月結算時，套用所有活躍 modifier：
  newScore = clamp(currentScore + Σ(modifier.delta) + naturalRecovery, 0, 100)

naturalRecovery:
  若 score < 80 且 coverageRatio >= 1.0 → +1/月
  若 coverageRatio < 1.0 → 無自然回復（人力不足壓制）

一次性事件觸發（即時套用）：
  EOL 硬體故障停機      → −5
  EOS 軟體資安事件      → −8
  資料外洩              → −15
  SLA 違約（per 合約）  → −10
  P1 事件超時（per hour）→ −5
  稽核客戶突擊（通過）   → +5
  P1 事件成功處理        → +3
  大型合約續簽           → +5
  大型合約流失           → −10

持續性 modifier（每月）：
  人力覆蓋率 0.7–0.9    → −2/月
  人力覆蓋率 0.5–0.7    → −5/月
  人力覆蓋率 < 0.5      → −10/月
```

---

## 滿意度門檻效果

```
score ≥ 80：
  自動續約成功率 +40%
  RFP 頻率修正 ×1.2
  可在續約時要求漲價 5–15%

score 50–80：
  正常

score < 50：
  合約到期幾乎不續約
  競爭對手挖角合約風險 +30%

score < 40（持續 2 個月）：
  合約提前終止機率 +30%
```

---

## 接收的事件

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `time.month_end` | TimeEngine | 計算月度自然回復，套用持續 modifier，清理過期 modifier |
| `security.incident_resolved` | SecurityEngine | 根據事件類型和結果調整滿意度 |
| `security.incident_timed_out` | SecurityEngine | P1 超時扣分 |
| `contract.terminated` | ContractManager | 大型合約流失扣分 |
| `contract.renewed` | ContractManager | 大型合約續約加分 |
| `security.data_breach` | SecurityEngine | 資料外洩大扣分 |
| `staff.insufficient_coverage` | StaffManager | 人力不足持續扣分 |
| `security.audit_passed` | SecurityEngine | 稽核通過加分 |

---

## 發出的事件

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `reputation.satisfaction_changed` | `{ score, delta, reason }` | 滿意度變動 |
| `reputation.high_satisfaction` | `{ score }` | 進入高滿意度門檻 |
| `reputation.low_satisfaction_warning` | `{ score }` | 滿意度進入危險區間 |

---

## ReputationConfig 平衡參數

```typescript
interface ReputationConfig {
  initialScore: number;                 // 75
  naturalRecoveryPerMonth: number;      // 1
  naturalRecoveryThreshold: number;     // 80（高於此值不自然回復）
  highSatisfactionThreshold: number;    // 80
  lowSatisfactionThreshold: number;     // 50
  criticalSatisfactionThreshold: number; // 40
  renewalBonusAtHighSatisfaction: number; // 0.40（+40%）
  priceIncreaseRange: [number, number]; // [0.05, 0.15]（5–15%）
  modifiers: SatisfactionModifierConfig[];
}

interface SatisfactionModifierConfig {
  trigger: string;
  delta: number;
  isOneTime: boolean;
  durationMonths?: number;
}
```

---

## 與其他模組的交互

```
ReputationEngine
  ├── 接收各模組事件 → 更新滿意度分數
  ├── 發布 reputation.satisfaction_changed → ContractManager（影響續約/RFP）
  └── 發布 reputation.low_satisfaction_warning → TimeEngine（可選暫停提醒）
```

---

## 未來擴展點

- **口碑傳播系統**：高/低滿意度的客戶在業界口耳相傳，影響 RFP 品質。
- **客戶 NPS 調查**：定期隨機客戶調查提供詳細滿意度反饋（提示改善方向）。
- **行業分層口碑**：不同行業（金融、醫療、政府）口碑獨立計算，對應 RFP 的行業分布。
