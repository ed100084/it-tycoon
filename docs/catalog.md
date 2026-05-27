# IT-Tycoon 採購目錄索引

> 本文件為採購目錄索引。詳細內容已拆分為兩個附錄，方便個別維護。

---

## 附錄

| 附錄 | 說明 | 連結 |
|------|------|------|
| 附錄 A：硬體目錄 | 運算、儲存、網路、機房設施、機櫃（5 個時代 × 10 類別）| [appendix-hardware-catalog.md](appendix-hardware-catalog.md) |
| 附錄 B：軟體目錄 | 備份/DR、虛擬化/雲平台、作業系統、資料庫、資安（含特殊事件）| [appendix-software-catalog.md](appendix-software-catalog.md) |

---

## 快速參考：各時代代表型號

### Era 1（2000–2004）前虛擬化時代

| 類別 | 代表型號 | 採購價(NT$) | 遊戲 CPS/月 |
|------|---------|-----------|-----------|
| 1U 伺服器 | Dell PowerEdge 2650 | 156,000 | 2,000 |
| 2U 伺服器 | HP ProLiant DL380 G2 | 144,000 | 1,800 |
| SAN 儲存 | EMC Clariion CX200 | 1,050,000 | 效能 ×1.3 |
| NAS 入門 | NetApp FAS270c | 660,000 | 效能 ×1.2 |
| 核心交換 | Cisco Catalyst 3550-48 | 165,000 | 網路 +10% |
| 防火牆 | Cisco PIX 515E | 135,000 | 資安 Lv1 |
| UPS | APC Smart-UPS RT 5000VA | 120,000 | 電力 Lv1 |
| 機櫃 | APC NetShelter SX 42U | 54,000 | 42U 容量 |
| 備份 | Veritas NetBackup 4.5 | 150,000/yr | 備份 +30% |
| 作業系統 | Windows Server 2003 | 29,970/授權 | ⚠️ EOS 2015 |

### Era 2（2005–2009）虛擬化萌芽

| 類別 | 代表型號 | 採購價(NT$) | 遊戲 CPS/月 |
|------|---------|-----------|-----------|
| 1U 伺服器 | Dell PowerEdge 1950 | 121,600 | 8,000 |
| 2U 伺服器 | HP ProLiant DL380 G5 | 176,000 | 9,500 |
| 刀鋒機箱 | Dell PowerEdge M1000e | 256,000 | 依刀鋒 |
| iSCSI SAN | Dell EqualLogic PS6000 | 800,000 | 效能 ×1.3 |
| DC 交換 | Juniper EX3200-24T | 192,000 | 網路 +15% |
| UTM | Fortinet FortiGate 300A | 128,000 | 資安 Lv2 |
| UPS | APC Symmetra PX 20kVA | 576,000 | 電力 Lv2 |
| 虛擬化 | VMware vSphere 4 | 144,000/CPU | 密度 ×3 |
| 備份 | Veeam B&R 1.0 | 48,000/yr | 備份 +50% |
| 作業系統 | RHEL 5 | 28,800/yr | 穩定 Linux |

### Era 3（2010–2014）雲端崛起

| 類別 | 代表型號 | 採購價(NT$) | 遊戲 CPS/月 |
|------|---------|-----------|-----------|
| 2U 伺服器 | HP ProLiant DL380 G7 | 176,000 | 35,000 |
| 刀鋒 | Cisco UCS B200 M2 | 176,000 | 40,000 |
| All-Flash SAN | Pure Storage FlashArray //m10 | 3,840,000 | 效能 ×3 |
| 10GbE 交換 | Arista 7050SX-64 | 704,000 | 網路 +25% |
| NGFW | Palo Alto PA-3020 | 512,000 | 資安 Lv3 |
| UPS | APC Symmetra PX 80kVA | 1,440,000 | 電力 Lv3 |
| 精密空調 | APC InRow RC 10kW | 384,000 | PUE −0.15 |
| 虛擬化 | VMware vSphere 5.5 | 176,000/CPU | 密度 ×4 |
| 備份 | CommVault Simpana 10 | 480,000/yr | 備份 +60% |

### Era 4（2015–2019）超融合與容器

| 類別 | 代表型號 | 採購價(NT$) | 遊戲 CPS/月 |
|------|---------|-----------|-----------|
| 2U 伺服器 | Dell PowerEdge R730 | 185,600 | 150,000 |
| HCI 節點 | Nutanix NX-3000 | 1,600,000 | 400,000 |
| All-Flash | Pure Storage //X50 | 8,960,000 | 效能 ×5 |
| 100GbE 交換 | Arista 7060CX-32S | 704,000 | 網路 +40% |
| 企業 NGFW | Palo Alto PA-5220 | 1,760,000 | 資安 Lv4 |
| 液冷空調 | Vertiv Liebert DM 100kW | 2,560,000 | PUE −0.25 |
| 容器 | Kubernetes + OpenShift 4 | 448,000/yr | 密度 ×6 |
| SIEM | Splunk Enterprise Security | 1,120,000/yr | 偵測 +30% |

### Era 5（2020–2025）AI 基礎設施競賽

| 類別 | 代表型號 | 採購價(NT$) | 遊戲 CPS/月 |
|------|---------|-----------|-----------|
| 2U AI 伺服器 | Dell PowerEdge R750 | 225,000 | 600,000 |
| GPU 節點 | NVIDIA DGX H100 | 9,000,000 | 5,000,000 |
| AI 儲存 | VAST Data Universal Storage | 4,500,000 | AI CPS ×1.5 |
| InfiniBand | NVIDIA SN5600 NDR400 | 3,600,000 | AI 網路 +60% |
| 浸沒冷卻 | GRC ICEraQ Micro40 | 1,800,000 | PUE −0.40 |
| NGFW | Palo Alto PA-5445 | 2,100,000 | 資安 Lv5 |
| K8s 平台 | Red Hat OpenShift 4 | 480,000/yr | 密度 ×8 |
| EDR/XDR | CrowdStrike Falcon Insight XDR | 5,400/端點/yr | 威脅 −50% |

---

## 特殊事件快速查閱

| 事件 | 觸發時間 | 效果 | 詳見 |
|------|---------|------|------|
| Halon 1301 強制汰換 | 2005/01 | 強制換 FM-200，NT$540,000/區域 | 附錄 A Era 1 消防 |
| Windows Server 2003 EOS | 2015/07 | complianceMod ×1.5 | 附錄 B OS |
| WannaCry 勒索軟體 | 2017/05 | SLA 賠償 ×3（未修補）| 附錄 B 資安事件 |
| CentOS 8 提前 EOL | 2021/01 | 12 個月內遷移，complianceMod ×2.0 | 附錄 B OS |
| MySQL 5.7 EOS | 2023/10 | complianceMod ×1.5 | 附錄 B 資料庫 |
| VMware Broadcom 漲價 | 2023/10 | 授權費 ×2.5 | 附錄 B 虛擬化 |
| NVIDIA H100 缺貨 | 2023/06 | 等待 +300s，溢價 ×4 | 附錄 A Era 5 GPU |
| Log4Shell | 2021/12 | 未修補 complianceMod ×3.0 | 附錄 B 資安事件 |
