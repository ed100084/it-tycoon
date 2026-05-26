import type { PUEDefinition } from '../models/types';

export const ELECTRICITY_PRICE = 0.001; // compute per watt per second

export const PUE_DEFS: PUEDefinition[] = [
  {
    level: 0,
    name: 'Open Frame',
    nameZh: '開放式機架',
    pue: 2.0,
    cost: 0,
    description: '無冷卻基礎設施，機房悶熱，PUE 奇差。',
  },
  {
    level: 1,
    name: 'Basic Air Conditioning',
    nameZh: '基礎空調',
    pue: 1.8,
    cost: 5000,
    description: '安裝基本冷氣設備，改善機房溫度管理。',
  },
  {
    level: 2,
    name: 'Hot Aisle Containment',
    nameZh: '熱通道封閉',
    pue: 1.6,
    cost: 50000,
    description: '熱通道封閉設計，冷熱氣流分離，顯著提升效率。',
  },
  {
    level: 3,
    name: 'Chilled Water System',
    nameZh: '冰水主機',
    pue: 1.4,
    cost: 500000,
    description: '冰水主機冷卻系統，大型資料中心標準配備。',
  },
  {
    level: 4,
    name: 'In-Row Cooling',
    nameZh: 'In-Row 冷卻',
    pue: 1.25,
    cost: 5000000,
    description: '列間精密空調，精準對準熱源，極致冷卻效率。',
  },
  {
    level: 5,
    name: 'Liquid Cooling',
    nameZh: '液冷系統',
    pue: 1.1,
    cost: 50000000,
    description: '直接液冷技術，接近物理極限的 PUE 表現。',
  },
  {
    level: 6,
    name: 'Immersion Cooling',
    nameZh: '浸沒式冷卻',
    pue: 1.05,
    cost: 500000000,
    description: '伺服器浸沒於絕緣液體中，突破傳統散熱極限。',
  },
];

export const MAX_PUE_LEVEL_V02 = 2; // v0.2 implements levels 0-2
