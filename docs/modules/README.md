# IT-Tycoon 模組架構總覽

本目錄包含所有遊戲模組的規格書與共通協定定義。

---

## 文件索引

| 文件 | 模組 | 說明 |
|------|------|------|
| [00-shared-protocols.md](00-shared-protocols.md) | 共通協定 | Event Bus、型別定義、Module Interface、Config 注入 |
| [01-time-engine.md](01-time-engine.md) | TimeEngine | 時間推進、速度控制、月/季/年結算觸發 |
| [02-finance-engine.md](02-finance-engine.md) | FinanceEngine | P&L、現金流、貸款、信用評等 |
| [03-facility-manager.md](03-facility-manager.md) | FacilityManager | 機房空間、電力、PUE、區域管理 |
| [04-hardware-catalog.md](04-hardware-catalog.md) | HardwareCatalog | 硬體型號、採購、EOL 生命週期 |
| [05-software-catalog.md](05-software-catalog.md) | SoftwareCatalog | 軟體授權、EOS、合規分數 |
| [06-contract-manager.md](06-contract-manager.md) | ContractManager | RFP 投標、合約履行、SLA 追蹤 |
| [07-staff-manager.md](07-staff-manager.md) | StaffManager | 招募、薪資、覆蓋率、班表 |
| [08-security-engine.md](08-security-engine.md) | SecurityEngine | 威脅生成、事件處理、合規 |
| [09-event-timeline.md](09-event-timeline.md) | EventTimeline | 歷史事件、景氣循環、隨機事件 |
| [10-tech-tree.md](10-tech-tree.md) | TechTree | 40 科技節點、投資、效果套用 |
| [11-reputation-engine.md](11-reputation-engine.md) | ReputationEngine | 客戶滿意度、口碑、續約影響 |
| [12-ui-bridge.md](12-ui-bridge.md) | UIBridge | ViewModel 聚合、玩家 Action 轉發 |

---

## 模組事件流向圖

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EVENT BUS（中央事件匯流排）                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ 所有模組透過 Bus 通訊
                                │
           ┌────────────────────┼──────────────────────┐
           │                   │                       │
    ┌──────▼──────┐     ┌───────▼───────┐     ┌────────▼────────┐
    │ TimeEngine  │     │ EventTimeline │     │  UIBridge       │
    │ ▶ 時間驅動   │     │ ▶ 歷史事件觸發 │     │ ▶ ViewModel 聚合│
    └──────┬──────┘     └───────┬───────┘     └────────▲────────┘
           │ time.*             │ timeline.*            │
           │ (每月觸發)          │ (修正係數)             │ (訂閱所有事件)
     ┌─────┴────────────────────┴──────────────────┐    │
     │                訂閱 time.month_end 的模組     │    │
     │  ┌──────────────────────────────────────┐   │    │
     │  │ FinanceEngine   → finance.*          │───┼────┘
     │  │ FacilityManager → facility.*         │───┤
     │  │ HardwareCatalog → hardware.*         │───┤
     │  │ SoftwareCatalog → software.*         │───┤
     │  │ ContractManager → contract.*         │───┤
     │  │ StaffManager    → staff.*            │───┤
     │  │ SecurityEngine  → security.*         │───┤
     │  │ TechTree        → techtree.*         │───┤
     │  │ ReputationEngine→ reputation.*       │───┤
     │  └──────────────────────────────────────┘   │
     └────────────────────────────────────────────-┘
```

---

## 詳細事件流（關鍵路徑）

### 路徑 1：月結算主流程

```
TimeEngine ──[time.month_end]──▶
  ├── FinanceEngine          → 計算 P&L，扣薪資/電費/授權費，發 finance.monthly_settlement
  ├── HardwareCatalog        → 推進 EOL 計時，計算折舊，發 hardware.monthly_depreciation
  ├── SoftwareCatalog        → 推進 EOS 計時，計算授權費，發 software.license_fee_due
  ├── FacilityManager        → 計算電費/租金，發 facility.electricity_due / rent_due
  ├── ContractManager        → 月費入帳，SLA 結算，RFP 生成，到期檢查
  ├── StaffManager           → 薪資計算，離職 roll，升職資格更新
  ├── SecurityEngine         → 威脅 roll，推進事件計時
  ├── TechTree               → 研究進度推進
  ├── EventTimeline          → 歷史事件檢查，景氣循環推進，隨機事件 roll
  └── ReputationEngine       → 自然回復，套用持續 modifier
```

### 路徑 2：EOL 連鎖崩潰

```
HardwareCatalog → hardware.eol_expired
  ├──▶ SecurityEngine（提高故障/資安事件率）
  └──▶ hardware.failure（每月 roll 增加）
         └──▶ SecurityEngine（注入事件）
                └──▶ security.incident_triggered（P2/P1）
                       ├──▶ TimeEngine（強制暫停）
                       └──▶ ContractManager（計算停機 SLA）
                              └──▶ contract.sla_breach_penalty
                                     └──▶ FinanceEngine（扣款）
                                            └──▶ ReputationEngine（滿意度 -10）
                                                   └──▶ ContractManager（合約流失機率 ↑）
```

### 路徑 3：AI 時代轉型

```
EventTimeline → timeline.historical_event（ChatGPT 爆發 2023/01）
  ├──▶ ContractManager（AI 合約 RFP 大量湧入）
  ├──▶ HardwareCatalog（GPU 採購成本 ×5）
  └──▶ ContractManager（無 GPU 節點 → 失去 AI 合約競標資格）

TechTree → techtree.service_unlocked（AI_COMPUTE 服務解鎖）
  └──▶ ContractManager（可接受 AI/ML 合約 RFP）
```

### 路徑 4：現金流危機

```
FinanceEngine → finance.cash_warning
  └──▶ TimeEngine（強制暫停，顯示警告）
         └──▶ 玩家決策：申請貸款 / 裁員 / 汰換硬體
                └──▶ FinanceEngine（applyForLoan）
                       └──▶ finance.loan_approved / rejected
```

---

## 模組依賴關係圖

```
（箭頭代表「A 需要 B 的資料/事件」，非程式碼 import）

               EventTimeline
                    │ 修正係數
                    ▼
TimeEngine ──▶ [所有模組]
                    │
         ┌──────────┼──────────────────┐
         ▼          ▼                  ▼
  FinanceEngine  HardwareCatalog    SoftwareCatalog
       │              │                  │
       │         FacilityManager         │ EOS 風險
       │              │                  ▼
       │              └────────▶ SecurityEngine ◀── StaffManager
       │                              │
       └──────── ContractManager ◀───-┘
                      │
                 ReputationEngine
                      │
                  TechTree ──────────────▶ [各模組加成]
                      │
                  UIBridge ◀──────────────── [所有模組]
```

---

## 實作優先順序

### Phase 1 — 核心引擎（MVP）

> 目標：能夠推進時間、做採購、看 P&L、達成月收支平衡

| # | 模組 | 關鍵功能 |
|---|------|---------|
| 1 | **TimeEngine** | 時間推進、暫停、month_end 事件 |
| 2 | **FinanceEngine** | 現金、P&L、折舊（基礎版）|
| 3 | **FacilityManager** | 北區機房、電費、租金 |
| 4 | **HardwareCatalog** | Era 1 型號、採購、EOL 基礎 |
| 5 | **UIBridge（基礎版）** | HUD + 財務 + 機房 ViewModel |

對應開發里程碑：**v0.1 – v0.3**

---

### Phase 2 — 收入引擎

> 目標：RFP 投標、合約履行、SLA 追蹤、月費入帳

| # | 模組 | 關鍵功能 |
|---|------|---------|
| 6 | **ContractManager** | RFP、投標、SLA 計算 |
| 7 | **StaffManager** | 招募、薪資、覆蓋率 |
| 8 | **SoftwareCatalog** | 授權費、EOS 基礎 |
| 9 | **ReputationEngine** | 滿意度基礎 |
| 10 | **UIBridge（完整版）** | 全部 ViewModel |

對應開發里程碑：**v0.4 – v0.6**

---

### Phase 3 — 壓力與深度

> 目標：資安事件、歷史事件、科技樹、完整 EOL/EOS 連鎖

| # | 模組 | 關鍵功能 |
|---|------|---------|
| 11 | **SecurityEngine** | 事件生成、處理、合規 |
| 12 | **EventTimeline** | 歷史事件、景氣循環 |
| 13 | **TechTree** | 40 節點、效果套用 |
| 14 | **FacilityManager 擴建** | 中/南區解鎖、冷卻升級 |

對應開發里程碑：**v0.7 – v1.0**

---

## 設計原則摘要

| 原則 | 實作方式 |
|------|---------|
| **低耦合** | 模組間只透過 Event Bus 通訊，不直接呼叫對方方法 |
| **高內聚** | 每個模組單一職責，業務邏輯不跨模組洩漏 |
| **可測試性** | 每個模組可 mock EventBus 獨立單元測試 |
| **可存檔** | 每個模組實作 serialize/deserialize，狀態為純 JSON |
| **平衡外部化** | 所有數值參數在 GameConfig 中定義，模組只讀 config |
| **型別安全** | 所有事件 payload 有 TypeScript interface，事件 type string 有 PayloadMap |

---

## 模組類型分類

```
核心驅動模組（必須優先實作）：
  TimeEngine, FinanceEngine, FacilityManager, HardwareCatalog

收入/管理模組（Phase 2）：
  ContractManager, StaffManager, SoftwareCatalog, ReputationEngine

壓力/深度模組（Phase 3）：
  SecurityEngine, EventTimeline, TechTree

整合模組（貫穿全程）：
  UIBridge（基礎版 Phase 1，完整版 Phase 2）
```
