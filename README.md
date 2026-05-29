# IT-Tycoon

> 一個雲端服務提供商的擴張模擬，但你還是要寫簽呈、應付稽核、處理跨院區協調的官僚現實。

**核心張力：高科技擴張感 ↔ 官僚日常摩擦**

---

## 玩法簡介

IT-Tycoon 是一款放置類（idle/incremental）網頁遊戲。從一台老舊的 Tower PC 開始，靠著點擊產生算力，逐步建設成跨區域的雲端資料中心帝國。

但別忘了：每台伺服器都要付電費，T4 以上設備需要跑採購簽呈，ISO 27001 稽核隨時可能上門，而你的老闆永遠覺得成本太高。

### 核心系統（v1.0）

- **算力（Compute）**：主貨幣，用於購買一切
- **硬體商店**：T0 Tower PC → T5 Regional DC（成本每購買 ×1.15）
- **電費系統**：每台設備實時耗電，餘額不足全部停機
- **PUE 冷卻升級**：從 2.0 降至 1.6（v0.2），最終可達 1.05
- **硬體升級**：Lv1→Lv3（v0.2），最高 Lv5（×100 CPS）
- **機房空間**：北區 100U 容量限制，支援擴建、中區/南區解鎖
- **跨區營運**：解鎖 2 個以上區域後啟用 +25% CPS buff
- **採購簽呈**：T4+ 硬體改為送簽流程，核准後自動交付安裝
- **客戶合約**：接受合約佔用機櫃 U、產生持續性 CF 收入；停機會觸發 SLA 違約扣滿意度，逾時未復原則提前解約，到期完成回饋滿意度
- **滿意度**：停機、容量壓力、簽呈堆積、合約違約會降低滿意度，穩定營運會回升
- **稽核事件**：ISO 27001、衛福部、客戶 SLA 與 DR 演練會隨機觸發，逾期會扣滿意度
- **Prestige Tier 1**：雲端轉型可重置本輪進度換取永久 Reputation CPS 加成
- **Prestige Tier 2 / Influence**：累積 Reputation 可 IPO 轉換成永久 Influence，全域 CPS 每點 +5%
- **T6/T7 Endgame 硬體**：Mega Datacenter 與 Quantum Node 進入可解鎖、採購與成就流程
- **科技樹**：20 節點 DAG，用 Reputation 解鎖長期 CPS、電力、機櫃、採購、稽核、滿意度與 Prestige 加成
- **成就系統**：39 個自動解鎖成就，覆蓋算力、硬體、機房、效率、採購、稽核、Prestige、Influence、科技樹與合約
- **存檔 / 讀檔**：自動存 localStorage，支援離線收益
- **CRT 終端機視覺風格**：scanline、phosphor glow、flicker 效果

---

## 技術棧

| 項目 | 技術 |
|------|------|
| UI 框架 | React 19 + TypeScript |
| 打包工具 | Vite 8 |
| 狀態管理 | Zustand |
| 樣式 | Pure CSS（CRT terminal style） |
| 資料持久化 | localStorage（版本化存檔 + 遷移鏈） |
| 測試 | Vitest（核心系統純函式單元測試） |

---

## 快速開始

```bash
# 安裝依賴
npm install

# 開發伺服器 (http://localhost:5173)
npm run dev

# 生產打包
npm run build

# 執行單元測試
npm test
```

---

## 專案結構

```
src/
├── game/
│   ├── config/          # 數值配置（硬體表、PUE 表、科技樹、成就、遊戲常數）
│   ├── models/          # TypeScript 型別定義
│   └── systems/         # 子系統純函式 + *.test.ts 單元測試
│                        #   hardware / facility / procurement / audit
│                        #   prestige / tech / achievements / save
├── store/
│   └── gameStore.ts     # Zustand 全域狀態 + 遊戲迴圈邏輯
├── components/
│   ├── BootSequence.tsx # 開機動畫
│   ├── GameLayout.tsx   # 主佈局 + 遊戲迴圈（real-elapsed dt）
│   ├── hud/             # ResourceBar
│   └── panels/          # ComputePanel、HardwarePanel、UpgradesPanel
│       └── upgrades/    # UpgradesPanel 拆分出的各區塊子元件
├── styles/
│   ├── global.css       # 基礎樣式 + CSS 變數
│   └── crt.css          # CRT 效果 + 所有元件樣式
└── utils/
    └── format.ts        # 數字格式化（K/M/B/T...）
docs/
├── spec-v1.0.md         # 完整設計規格書（另有 v2.0 / v3.0 設計探索）
└── modules/             # 各子系統的模組化規格
```

---

## 遊戲數值（v1.0）

### 硬體效能（PUE 2.0）

| Tier | CPS | 電費/s | 淨 CPS |
|------|-----|--------|--------|
| T0 Tower PC | +0.10 | −0.07 | **+0.03** |
| T1 Rack Server | +2.00 | −0.30 | **+1.70** |
| T2 Blade Server | +20.00 | −0.70 | **+19.30** |
| T3 Server Farm | +200.00 | −2.40 | **+197.60** |
| T4 Mini DC | +2,000 | -8.00 | **+1,992** |
| T5 Regional DC | +20,000 | -30.00 | **+19,970** |
| T6 Mega Datacenter | +200,000 | -160.00 | **+199,840** |
| T7 Quantum Node | +10,000,000 | -600.00 | **+9,999,400** |

### PUE 升級（v0.2 開放前 3 級）

| PUE | 成本 | 相較 2.0 省電 |
|-----|------|--------------|
| 2.00 | — | — |
| 1.80 | 5,000 CF | −10% |
| 1.60 | 50,000 CF | −20% |

---

## 開發路線圖

- [x] **v0.2** — 核心機制：點擊、硬體、電費、PUE、存檔、離線、boot 動畫
- [x] **v0.3** — 機房空間（北區 100U）
- [x] **v0.4** — 中南區 + 跨區 buff (+25%)
- [x] **v0.5** — 採購簽呈系統 + 滿意度
- [x] **v0.6** — 稽核事件（ISO/衛福部/客戶突襲）
- [x] **v0.7** — Prestige Tier 1 + Reputation
- [x] **v0.8** — 科技樹（DAG，20 節點）
- [x] **v0.9** — 成就系統（現為 39 個）
- [x] **v1.0** — T6/T7 + Prestige Tier 2 + Influence
- [x] **v1.1** — 穩定化：死碼清除、real-time 遊戲迴圈、版本化存檔遷移、單元測試、UI 拆分、endgame 解鎖門檻修正
- [x] **v1.2** — 客戶合約系統（佔用機櫃 U、持續性 CF 收入、SLA 違約壓力、合約成就）

完整設計規格見 [docs/spec-v1.0.md](docs/spec-v1.0.md)

---

## Claude Handoff: Recommended Next Work

Current implemented milestone: **v1.2** (v1.1 stabilization + v1.2 contract system shipped).

The project has accumulated the main gameplay systems from v0.3 through v1.0:

- Facility/rack capacity and regional expansion
- Procurement workflow for T4+ hardware
- Satisfaction pressure from shutdowns, capacity, and pending PRs
- Audit events
- Prestige Tier 1 with Reputation
- Tech tree
- Achievements
- Prestige Tier 2 with Influence
- T6/T7 endgame hardware

### v1.1: Stabilization and Polish

Stabilization work already landed:

- [x] **Removed dead code** — unused `Achievement` / `TechNode` / `ZoneState`
      interfaces deleted from `models/types.ts`.
- [x] **Game loop uses real elapsed time** — `GameLayout` advances the
      simulation by wall-clock dt (capped by `MAX_TICK_DELTA`) so background-tab
      throttling no longer slows progress.
- [x] **Formalized save migration** — `migrateSave` is now a version-aware
      migration chain (`SAVE_MIGRATIONS`); legacy pre-versioned saves are
      accepted and upgraded instead of discarded.
- [x] **Unit tests** — Vitest coverage for hardware, facility, prestige,
      achievements, and save/migration pure functions (`npm test`).
- [x] **UI refactor** — the 500-line `UpgradesPanel` was split into focused
      section components under `components/panels/upgrades/`.
- [x] **Reachable endgame** — T6/T7 unlock gates were retuned (own 50x T5 / 100x
      T6 → 12x / 8x) so the Mega Datacenter and Quantum Node are actually
      attainable in a single run. A `hardware.balance.test.ts` invariant now
      guards that every unlock gate is reachable in both rack space and cost
      before the first prestige.

Still open for v1.1:

1. **Finish balancing the progression curve**
   - T6/T7 unlock gates are fixed; still re-check T0–T5 cost/CPS/power/rack pacing.
   - Verify Prestige Tier 1 does not arrive too early or too late (note the
     first prestige currently grants only +2% CPS, though the reputation also
     buys tech-tree nodes).
   - Verify Prestige Tier 2 Influence does not explode CPS too quickly.
   - Check interaction between cross-region bonus, Reputation, Influence, tech tree, PUE, and procurement speed.

2. **Visual QA**
   - Verify the three-column UI at desktop and smaller widths.
   - Check Achievements, Tech Tree, Prestige, Procurement, Audit, and Hardware panels for overflow.
   - Confirm long text does not overlap or push buttons out of bounds.

### Recommended Feature Roadmap After v1.1

- **v1.2: Contract / Customer System** — ✅ shipped
  - Customer contracts reserve rack U and generate recurring CF income.
  - Offers arrive periodically (scaled to progress); accepting reserves capacity
    and pays a signing bonus, then steady CF/s while online.
  - SLA pressure ties to uptime: shutdowns accrue downtime and satisfaction
    penalties, and a contract that stays down past the breach cap terminates
    early; completing a contract returns a satisfaction reward.
  - Possible follow-ups: per-contract reputation, renewal offers, contract-type
    tech unlocks, and dedicated SLA/uptime tooling.

- **v1.3: Staff / Engineer Management**
  - Add engineers who manage rack capacity or reduce incident/audit/procurement friction.
  - Introduce operating cost and staffing coverage pressure.

- **v1.4: Security Incidents**
  - Add ransomware, DDoS, APT, and emergency response events.
  - Tie incident response to satisfaction, audits, tech tree, and future staff.

- **v1.5: Achievement Rewards and Stats Page**
  - Achievements currently unlock as milestones only.
  - Add small rewards or passive bonuses.
  - Add a dedicated stats/history page for total compute, uptime, audits, prestige runs, and unlocked systems.

### Suggested First Task for Claude

The v1.1 stabilization groundwork (dead-code cleanup, real-time game loop,
versioned save migration, unit tests, UI refactor) is done. The best next step
is **balancing the T0–T7 progression curve and prestige pacing**, backed by the
new test suite, before starting the v1.2 contract system.

---

## License

MIT
