import type { AuditEventType } from '../models/types';

export interface AuditEventDefinition {
  type: AuditEventType;
  title: string;
  description: string;
  baseCost: number;
  timeLimit: number;
  satisfactionPenalty: number;
  satisfactionReward: number;
  minTotalEarned: number;
}

export const AUDIT_EVENT_DEFS: AuditEventDefinition[] = [
  {
    type: 'iso27001',
    title: 'ISO 27001 Evidence Request',
    description: '稽核員要求資產清冊、權限紀錄與異常處理證明。',
    baseCost: 2500,
    timeLimit: 90,
    satisfactionPenalty: 6,
    satisfactionReward: 2,
    minTotalEarned: 2500,
  },
  {
    type: 'moh',
    title: 'MOH Compliance Spot Check',
    description: '主管機關抽查機房備援、採購流程與服務可用性紀錄。',
    baseCost: 7500,
    timeLimit: 120,
    satisfactionPenalty: 9,
    satisfactionReward: 3,
    minTotalEarned: 15000,
  },
  {
    type: 'client',
    title: 'Client SLA Surprise Review',
    description: '大客戶要求立即提交 SLA 報表與容量擴充計畫。',
    baseCost: 5000,
    timeLimit: 75,
    satisfactionPenalty: 8,
    satisfactionReward: 2.5,
    minTotalEarned: 8000,
  },
  {
    type: 'drill',
    title: 'Disaster Recovery Drill',
    description: '內部演練要求驗證備援切換、通報流程與值班回應。',
    baseCost: 12000,
    timeLimit: 150,
    satisfactionPenalty: 10,
    satisfactionReward: 4,
    minTotalEarned: 35000,
  },
];

export const FIRST_AUDIT_DELAY = 120;
export const AUDIT_INTERVAL_BASE = 180;
export const AUDIT_INTERVAL_VARIANCE = 120;
export const MAX_ACTIVE_AUDITS = 2;
