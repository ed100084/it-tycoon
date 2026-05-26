# IT-Tycoon

> 一個雲端服務提供商的擴張模擬，但你還是要寫簽呈、應付稽核、處理跨院區協調的官僚現實。

**核心張力：高科技擴張感 ↔ 官僚日常摩擦**

---

## 玩法簡介

IT-Tycoon 是一款放置類（idle/incremental）網頁遊戲。從一台老舊的 Tower PC 開始，靠著點擊產生算力，逐步建設成跨區域的雲端資料中心帝國。

但別忘了：每台伺服器都要付電費，T4 以上設備需要跑採購簽呈，ISO 27001 稽核隨時可能上門，而你的老闆永遠覺得成本太高。

### 核心系統（v0.2）

- **算力（Compute）**：主貨幣，用於購買一切
- **硬體商店**：T0 Tower PC → T5 Regional DC（成本每購買 ×1.15）
- **電費系統**：每台設備實時耗電，餘額不足全部停機
- **PUE 冷卻升級**：從 2.0 降至 1.6（v0.2），最終可達 1.05
- **硬體升級**：Lv1→Lv3（v0.2），最高 Lv5（×100 CPS）
- **存檔 / 讀檔**：自動存 localStorage，支援離線收益
- **CRT 終端機視覺風格**：scanline、phosphor glow、flicker 效果

---

## 技術棧

| 項目 | 技術 |
|------|------|
| UI 框架 | React 18 + TypeScript |
| 打包工具 | Vite 8 |
| 狀態管理 | Zustand |
| 樣式 | Pure CSS（CRT terminal style） |
| 資料持久化 | localStorage |

---

## 快速開始

```bash
# 安裝依賴
npm install

# 開發伺服器 (http://localhost:5173)
npm run dev

# 生產打包
npm run build
```

---

## 專案結構

```
src/
├── game/
│   ├── config/          # 數值配置（硬體表、PUE 表、遊戲常數）
│   ├── models/          # TypeScript 型別定義
│   └── systems/         # 子系統邏輯（hardware、power、save）
├── store/
│   └── gameStore.ts     # Zustand 全域狀態
├── components/
│   ├── BootSequence.tsx # 開機動畫
│   ├── GameLayout.tsx   # 主佈局 + 遊戲迴圈
│   ├── hud/             # ResourceBar
│   └── panels/          # ComputePanel、HardwarePanel、UpgradesPanel
├── styles/
│   ├── global.css       # 基礎樣式 + CSS 變數
│   └── crt.css          # CRT 效果 + 所有元件樣式
└── utils/
    └── format.ts        # 數字格式化（K/M/B/T...）
docs/
└── spec-v1.0.md         # 完整設計規格書
```

---

## 遊戲數值（v0.2）

### 硬體效能（PUE 2.0）

| Tier | CPS | 電費/s | 淨 CPS |
|------|-----|--------|--------|
| T0 Tower PC | +0.10 | −0.07 | **+0.03** |
| T1 Rack Server | +2.00 | −0.30 | **+1.70** |
| T2 Blade Server | +20.00 | −0.70 | **+19.30** |
| T3 Server Farm | +200.00 | −2.40 | **+197.60** |
| T4 Mini DC | +2,000 | −8.00 | **+1,992** |
| T5 Regional DC | +20,000 | −30.00 | **+19,970** |

### PUE 升級（v0.2 開放前 3 級）

| PUE | 成本 | 相較 2.0 省電 |
|-----|------|--------------|
| 2.00 | — | — |
| 1.80 | 5,000 CF | −10% |
| 1.60 | 50,000 CF | −20% |

---

## 開發路線圖

- [x] **v0.2** — 核心機制：點擊、硬體、電費、PUE、存檔、離線、boot 動畫
- [ ] **v0.3** — 機房空間（北區 100U）
- [ ] **v0.4** — 中南區 + 跨區 buff (+25%)
- [ ] **v0.5** — 採購簽呈系統 + 滿意度
- [ ] **v0.6** — 稽核事件（ISO/衛福部/客戶突襲）
- [ ] **v0.7** — Prestige Tier 1 + Reputation
- [ ] **v0.8** — 科技樹（DAG，20 節點）
- [ ] **v0.9** — 成就系統（30 個）
- [ ] **v1.0** — T6/T7 + Prestige Tier 2 + Influence

完整設計規格見 [docs/spec-v1.0.md](docs/spec-v1.0.md)

---

## License

MIT
