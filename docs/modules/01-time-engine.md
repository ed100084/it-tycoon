# 01 — TimeEngine 時間引擎

## 模組職責

TimeEngine 是遊戲的**唯一時鐘**。它將現實毫秒轉換為遊戲月份，控制速度倍率，在跨越月/季/年邊界時發布對應事件，並在重大事件時強制暫停遊戲。

**單一職責**：管理遊戲時間的推進與速度。不處理財務、事件後果或 UI 顯示。

---

## 公開介面（Public API）

```typescript
interface ITimeEngine extends IGameModule {
  readonly moduleId: 'TimeEngine';

  /** 當前遊戲日期。 */
  getCurrentDate(): GameDate;

  /** 當前速度（0 = 暫停）。 */
  getSpeed(): GameSpeed;

  /** 設定速度。若 speed = 0 視為暫停。 */
  setSpeed(speed: GameSpeed): void;

  /** 暫停遊戲（等同 setSpeed(0)），可附帶原因說明。 */
  pause(reason: PauseReason): void;

  /** 繼續遊戲，恢復到暫停前的速度。 */
  resume(): void;

  /** 當前是否暫停中。 */
  isPaused(): boolean;

  /** 玩家是否允許跳過月結算彈窗（可在設定中切換）。 */
  setSkipMonthSummary(skip: boolean): void;

  /** 強制跳至指定日期（僅限沙盒模式）。 */
  jumpToDate(date: GameDate): void;
}

type PauseReason =
  | 'user'              // 玩家手動暫停
  | 'p1_incident'       // P1 事件觸發
  | 'p2_incident'       // P2 事件觸發
  | 'rfp_received'      // RFP 收到
  | 'month_end'         // 月結算完成（若未設定 skipMonthSummary）
  | 'major_event'       // 重大歷史事件
  | 'cash_warning'      // 現金低於警戒線
  | 'eol_warning'       // EOL/EOS 到期通知
  | 'contract_expiry';  // 合約到期提醒
```

---

## 內部狀態結構

```typescript
interface TimeEngineState {
  currentDate: GameDate;          // 當前遊戲日期
  speed: GameSpeed;               // 當前速度
  isPaused: boolean;
  pauseReason: PauseReason | null;
  speedBeforePause: GameSpeed;    // 暫停前的速度（用於 resume）
  accumulatedMs: number;          // 當前月份已累積的毫秒數
  msPerGameMonth: number;         // 1x 速度下，1 個遊戲月 = 60,000ms
  skipMonthSummary: boolean;
  totalMonthsElapsed: number;     // 從起始日期算起的累計月數
}
```

### 時間推進算法

```
每次 tick(deltaMs):
  if isPaused: return

  effectiveDeltaMs = deltaMs × speed
  accumulatedMs += effectiveDeltaMs

  while accumulatedMs >= msPerGameMonth:
    accumulatedMs -= msPerGameMonth
    advanceOneMonth()

advanceOneMonth():
  prevDate = currentDate
  currentDate = addMonths(currentDate, 1)
  totalMonthsElapsed++

  publish('time.month_end', { prevDate, newDate: currentDate })

  if isQuarterEnd(currentDate):
    publish('time.quarter_end', { date: currentDate })

  if currentDate.month === 1:
    publish('time.year_end', { year: prevDate.year })

  if !skipMonthSummary:
    pause('month_end')
```

---

## 接收的事件（Subscribed Events）

| 事件 type | 來源 | 說明 |
|-----------|------|------|
| `game.pause_requested` | 任何模組 | 接收外部暫停請求，記錄 reason |
| `game.resume_requested` | UIBridge | 玩家點擊繼續 |
| `game.speed_changed` | UIBridge | 玩家調整速度 |

---

## 發出的事件（Emitted Events）

| 事件 type | Payload | 說明 |
|-----------|---------|------|
| `time.month_end` | `TimeMonthEndPayload` | 每月結算觸發點 |
| `time.quarter_end` | `TimeQuarterEndPayload` | 每季末（3/6/9/12 月）|
| `time.year_end` | `TimeYearEndPayload` | 每年底（12→1 月跨越時）|
| `time.paused` | `TimePausedPayload` | 遊戲暫停 |
| `time.resumed` | `TimeResumedPayload` | 遊戲繼續 |
| `time.speed_changed` | `TimeSpeedChangedPayload` | 速度改變 |

```typescript
interface TimeMonthEndPayload {
  prevDate: GameDate;
  newDate: GameDate;
  totalMonthsElapsed: number;
}

interface TimeQuarterEndPayload {
  date: GameDate;
  quarter: 1 | 2 | 3 | 4;
}

interface TimeYearEndPayload {
  year: number;
}

interface TimePausedPayload {
  reason: PauseReason;
  speed: GameSpeed;    // 暫停前速度
}

interface TimeSpeedChangedPayload {
  from: GameSpeed;
  to: GameSpeed;
}
```

---

## 依賴的共用型別

- `GameDate`, `GameSpeed`, `EntityId`（來自 `00-shared-protocols`）
- `IGameModule`, `IEventBus`, `GameConfig.time`

---

## TimeConfig 平衡參數

```typescript
interface TimeConfig {
  msPerGameMonthAt1x: number;   // default: 60_000（60 秒 = 1 遊戲月）
  startDate: GameDate;          // default: { year: 2000, month: 1 }
  autoPauseOnP1: boolean;       // default: true
  autoPauseOnP2: boolean;       // default: true
  autoPauseOnRFP: boolean;      // default: true
  autoPauseOnMajorEvent: boolean; // default: true
  autoPauseOnMonthEnd: boolean; // default: true（玩家可關閉）
  autoPauseOnCashWarning: boolean; // default: true
  autoPauseOnEOLWarning: boolean;  // default: false（僅通知）
  autoPauseOnContractExpiry: boolean; // default: true（到期前 1 個月）
}
```

---

## 與其他模組的交互

```
TimeEngine
  ├── 發布 time.month_end  ────▶  FinanceEngine（月結算）
  │                         ────▶  ContractManager（SLA 計算、到期檢查）
  │                         ────▶  StaffManager（薪資扣款、升級計算）
  │                         ────▶  HardwareCatalog（EOL 倒計時推進）
  │                         ────▶  SoftwareCatalog（EOS 倒計時推進）
  │                         ────▶  SecurityEngine（事件機率 roll）
  │                         ────▶  EventTimeline（歷史事件檢查）
  │                         ────▶  TechTree（研究進度推進）
  │                         ────▶  ReputationEngine（滿意度自然回復）
  │
  ├── 發布 time.year_end   ────▶  FinanceEngine（年度稅務結算）
  │                         ────▶  StaffManager（薪資通膨調整）
  │
  └── 接收 game.pause_requested ◀─ 任何模組（P1 事件、RFP 等）
```

---

## 未來擴展點

- **存檔自動觸發**：在 `time.month_end` 後自動存檔（由外部 SaveManager 訂閱，TimeEngine 不直接處理）。
- **加速追趕（Fast-forward）**：讀取存檔時，可設定 `suppressEvents = true` 高速追趕至存檔日期。
- **時間回溯（Undo）**：沙盒模式可考慮，需要 snapshot 機制（在 serialize/deserialize 基礎上實作）。
