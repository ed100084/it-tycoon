# IT-Tycoon

> 一個台灣 IDC/MSP 新創的擴張模擬——從一台老機器出發，應付採購簽呈、ISO 稽核、董事會 KPI、雲端競爭壓力，逐步建立跨城市的資料中心帝國。

**核心張力：高科技擴張感 ↔ 官僚日常摩擦**

---

## 玩法簡介

IT-Tycoon 是一款以時間軸驅動的台灣 IDC/MSP 管理模擬遊戲。起始年份 2000 年，你從一間小型機房出發，透過 22 個獨立系統管理硬體、人力、合約、資安、合規與財務，並在公有雲競爭、法規要求與董事會壓力下逐年成長。

---

## 技術棧

| 項目 | 技術 |
|------|------|
| UI 框架 | React 19 + TypeScript |
| 打包工具 | Vite 8 |
| 狀態管理 | Zustand |
| 遊戲核心 | 自製 EventBus + IGameModule 架構 |
| 樣式 | Pure CSS（CRT terminal style） |
| 資料持久化 | localStorage（版本化存檔 + 遷移鏈） |
| 測試 | Vitest — 45 個測試檔，647 個測試全通過 |

---

## 快速開始

```bash
npm install
npm run dev      # 開發伺服器 http://localhost:5173
npm run build    # 生產打包
npm test         # 執行單元測試
```

---

## 遊戲系統（v4.0 — 22 個模組）

### Phase 1：核心引擎
| 模組 | 功能 |
|------|------|
| **TimeEngine** | 遊戲時鐘，速度控制（0/1x/2x/4x/8x），月/季/年事件觸發 |
| **FinanceEngine** | 現金流、P&L、貸款、信用評等（AAA→Insolvent）、稅務 |
| **FacilityManager** | 北/中/南區機房，機櫃容量，冷卻升級（PUE 2.0→1.05），維護 |
| **HardwareCatalog** | 硬體資產生命週期，EOL 警告，折舊，採購流程 |
| **SoftwareCatalog** | 軟體授權，EOS 追蹤，合規分數影響 |
| **ContractManager** | RFP 投標，合約 SLA 追蹤，違約罰款，客戶流失機率 |

### Phase 2：人員與資安
| 模組 | 功能 |
|------|------|
| **StaffManager** | 7 個員工職級（E1→E5 CISO），薪資，值班模式，認證，績效 |
| **SecurityEngine** | 13 種資安事件，P1-P4 等級，DR 演練，合規分數 |
| **EventTimeline** | 台灣歷史科技事件，經濟週期，隨機事件決策，事件鏈 |
| **TechTree** | 科技樹 DAG，20+ 節點，解鎖設備/服務/效率加成 |
| **ReputationEngine** | 客戶滿意度，聲譽分數，影響 RFP 頻率與續約率 |

### Phase 3：商業深度
| 模組 | 功能 |
|------|------|
| **CustomerEngine** | 20 個具名客戶（台灣模板），忠誠度，推薦機制，年度滿意度調查 |
| **VendorEngine** | 6 家廠商（Dell/HPE/Cisco/Fortinet/Microsoft/VMware），銅→鉑金層級 |
| **BoardEngine** | 每季 KPI 審查，年度董事會，連續兩年失敗→遊戲結束 |
| **StrategyEngine** | 政府/新創/企業三路線，路線分數，RFP 加成 |
| **TechDebtEngine** | 技術債追蹤（0-100 點），EOL 債務，重構投資 |
| **ComplianceEngine** | ISO 27001/SOC2/HIPAA/PCI-DSS/ISO 20000/CSA STAR 認證生命週期 |
| **ExpansionEngine** | 3 個 IDC 收購目標，6 個月整合，第二機房（2010 解鎖） |
| **EnergyEngine** | 電力採購策略（現貨/固定），太陽能（2015），儲能（2018），碳稅，ESG 分數 |

### Phase 4：營運深度（v4.0 新增）
| 模組 | 功能 |
|------|------|
| **NetworkEngine** | 頻寬等級（100M→100G），ISP 選擇，冗餘模式，TWIX IX 對等互連（2005） |
| **ChangeManagementEngine** | ITIL 變更管理（Standard/Normal/Emergency），CAB 會議，ITIL 成熟度（0-5），影子變更風險 |
| **CloudStrategyEngine** | 雲端策略（純地端/混合雲/MSP），公有雲競爭壓力（2010+），資料主權機會（2018+） |
| **RegulatoryEngine** | 台灣法規時間線（金管會/個資法/GDPR/資安管理法/數位經濟法），合規稽核，罰款 |
| **InsuranceEngine** | 4 種保險（資安/營運中斷/D&O/E&O），保費浮動，理賠自動處理 |
| **CapacityPlanningEngine** | 機櫃/頻寬/電力/人力 4 維容量追蹤，6 個月趨勢預測，自動警示與採購建議 |

---

## 測試覆蓋

```
Test Files  45 passed (45)
Tests       647 passed (647)
```

每個模組均有 10-14 個 Vitest 單元測試，覆蓋：初始狀態、狀態轉換、事件發佈、序列化/反序列化。

---

## 專案結構

```
src/
├── game/
│   ├── core/
│   │   ├── types.ts          # 所有型別、介面、列舉、GameConfig
│   │   ├── EventBus.ts       # 事件匯流排實作
│   │   └── GameEngine.ts     # 模組編排、RAF 迴圈、存讀檔
│   ├── config/
│   │   └── default.config.ts # 所有平衡數值
│   └── modules/              # 22 個 IGameModule 實作 + *.test.ts
├── store/
│   └── uiStore.ts            # Zustand 橋接（React ↔ GameEngine）
├── components/
│   ├── hud/                  # TimeBar、ResourceBar
│   ├── panels/               # 22 個面板元件
│   └── ui/                   # Toast、Modal、Tutorial overlays
├── styles/
│   ├── global.css
│   └── crt.css               # CRT 終端機風格 + 所有元件樣式
└── utils/
    └── gameDate.ts           # addMonths, monthsBetween, formatGameDate
docs/
└── modules/                  # 各子系統設計規格
```

---

## 遊戲年份里程碑

| 年份 | 里程碑 |
|------|--------|
| 2000 | 起始：NT$5M 天使輪，北區 100U 機房 |
| 2001 | E3 資安工程師解鎖 |
| 2003 | 1G 頻寬解鎖 |
| 2004 | CISO（E5）解鎖 |
| 2005 | TWIX IX 對等互連解鎖；金管會資安管理法規生效 |
| 2008 | 企業收購解鎖；10G 頻寬解鎖 |
| 2010 | 第二機房解鎖；公有雲競爭壓力開始；E4 雲端架構師解鎖 |
| 2012 | 個資法生效 |
| 2015 | 太陽能板解鎖；100G 頻寬解鎖 |
| 2018 | 儲能設備解鎖；GDPR 生效；資料主權回流機會 |
| 2020 | 碳稅啟動；資安管理法生效 |
| 2023 | 數位經濟法草案生效 |

---

## 開發版本歷程

- [x] **v1.0–v1.3** — 基礎 idle 遊戲核心（算力、硬體、電費、合約、員工）
- [x] **v3.0** — 完整 management sim 重寫（EventBus、TimeEngine、FinanceEngine + 10 模組）
- [x] **v3.1** — 人才培育、DR 演練、聲譽系統擴展
- [x] **v3.5** — 客戶引擎、廠商引擎、董事會、策略路線（+6 模組）
- [x] **v3.6** — 技術債、合規認證、IDC 擴張、能源策略、事件鏈、On-Call（+6 深度系統）
- [x] **v4.0** — 網路拓撲、ITIL 變更管理、雲端策略、法規遵循、保險管理、容量規劃（+6 新系統）

---

## License

MIT
