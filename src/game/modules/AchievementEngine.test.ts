import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';
import { AchievementEngine } from './AchievementEngine';
import { DEFAULT_CONFIG } from '../config/default.config';
import { HardwareCategory, IncidentSeverity, StaffRole } from '../core/types';
import type { GameDate } from '../core/types';

function buildModule() {
  const bus = new EventBus();
  const ae = new AchievementEngine();
  ae.init(bus, DEFAULT_CONFIG);
  return { bus, ae };
}

function monthEnd(bus: EventBus, year: number, month: number) {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  bus.publish({
    type: 'time.month_end',
    payload: { prevDate: { year, month }, newDate: next, totalMonthsElapsed: 1 },
    gameDate: next,
    source: 'TimeEngine',
  });
  return next;
}

function settlement(bus: EventBus, date: GameDate, revenue: number, netProfit: number) {
  bus.publish({
    type: 'finance.monthly_settlement',
    payload: { income: { total: revenue }, netProfit, expenses: { total: revenue - netProfit }, date },
    gameDate: date,
    source: 'FinanceEngine',
  });
}

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('AchievementEngine — initial state', () => {
  it('1. starts with 15 achievements all locked', () => {
    const { ae } = buildModule();
    const achs = ae.getAchievements();
    expect(achs).toHaveLength(15);
    expect(achs.every(a => a.unlockedAt === null)).toBe(true);
  });

  it('2. getUnlockedCount() returns 0 initially', () => {
    const { ae } = buildModule();
    expect(ae.getUnlockedCount()).toBe(0);
  });

  it('3. all achievements have icon, name, description', () => {
    const { ae } = buildModule();
    for (const a of ae.getAchievements()) {
      expect(a.icon).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.description).toBeTruthy();
    }
  });
});

// ─── Revenue achievements ──────────────────────────────────────────────────────

describe('AchievementEngine — revenue & profit', () => {
  it('4. first_million unlocked when monthly revenue ≥ 1M', () => {
    const { bus, ae } = buildModule();
    settlement(bus, { year: 2000, month: 2 }, 1_000_000, 100_000);
    expect(ae.isUnlocked('first_million')).toBe(true);
  });

  it('5. first_million not unlocked below 1M', () => {
    const { bus, ae } = buildModule();
    settlement(bus, { year: 2000, month: 2 }, 999_999, 100_000);
    expect(ae.isUnlocked('first_million')).toBe(false);
  });

  it('6. stable_ops unlocked after 6 consecutive profitable months', () => {
    const { bus, ae } = buildModule();
    let date: GameDate = { year: 2000, month: 1 };
    for (let i = 0; i < 6; i++) {
      date = monthEnd(bus, date.year, date.month);
      settlement(bus, date, 500_000, 50_000);
    }
    expect(ae.isUnlocked('stable_ops')).toBe(true);
  });

  it('7. stable_ops resets on a loss month', () => {
    const { bus, ae } = buildModule();
    let date: GameDate = { year: 2000, month: 1 };
    for (let i = 0; i < 5; i++) {
      date = monthEnd(bus, date.year, date.month);
      settlement(bus, date, 500_000, 50_000);
    }
    // loss month
    date = monthEnd(bus, date.year, date.month);
    settlement(bus, date, 200_000, -10_000);
    // one more profitable — still not 6 consecutive
    date = monthEnd(bus, date.year, date.month);
    settlement(bus, date, 500_000, 50_000);
    expect(ae.isUnlocked('stable_ops')).toBe(false);
  });
});

// ─── Security achievements ─────────────────────────────────────────────────────

describe('AchievementEngine — security', () => {
  it('8. iron_man unlocked after 12 months with no P1', () => {
    const { bus, ae } = buildModule();
    let date: GameDate = { year: 2000, month: 1 };
    for (let i = 0; i < 12; i++) {
      date = monthEnd(bus, date.year, date.month);
    }
    expect(ae.isUnlocked('iron_man')).toBe(true);
  });

  it('9. iron_man counter resets on P1 incident', () => {
    const { bus, ae } = buildModule();
    let date: GameDate = { year: 2000, month: 1 };
    for (let i = 0; i < 11; i++) {
      date = monthEnd(bus, date.year, date.month);
    }
    bus.publish({
      type: 'security.incident_triggered',
      payload: { severity: IncidentSeverity.P1, id: 'inc1', type: 'RANSOMWARE' },
      gameDate: date,
      source: 'SecurityEngine',
    });
    date = monthEnd(bus, date.year, date.month);
    expect(ae.isUnlocked('iron_man')).toBe(false);
  });

  it('10. crisis_manager unlocked when P1 resolved with no contract loss', () => {
    const { bus, ae } = buildModule();
    const date: GameDate = { year: 2000, month: 2 };
    bus.publish({
      type: 'security.incident_triggered',
      payload: { severity: IncidentSeverity.P1, id: 'inc1', type: 'RANSOMWARE' },
      gameDate: date,
      source: 'SecurityEngine',
    });
    bus.publish({
      type: 'security.incident_resolved',
      payload: { severity: IncidentSeverity.P1, incidentId: 'inc1', type: 'RANSOMWARE', downtimeHours: 2 },
      gameDate: date,
      source: 'SecurityEngine',
    });
    monthEnd(bus, date.year, date.month);
    expect(ae.isUnlocked('crisis_manager')).toBe(true);
  });
});

// ─── Staff achievements ────────────────────────────────────────────────────────

describe('AchievementEngine — staff', () => {
  it('11. talent_rich unlocked when 10 staff hired', () => {
    const { bus, ae } = buildModule();
    for (let i = 0; i < 10; i++) {
      bus.publish({
        type: 'staff.hired',
        payload: { id: `staff-${i}`, role: StaffRole.E1_NOC, name: `Staff${i}`, monthlySalaryNTD: 50_000 },
        gameDate: { year: 2000, month: 1 },
        source: 'StaffManager',
      });
    }
    expect(ae.isUnlocked('talent_rich')).toBe(true);
  });

  it('12. full_team unlocked when all 7 roles are filled', () => {
    const { bus, ae } = buildModule();
    const roles = Object.values(StaffRole) as StaffRole[];
    roles.forEach((role, i) => {
      bus.publish({
        type: 'staff.hired',
        payload: { id: `s-${i}`, role, name: `Staff${i}`, monthlySalaryNTD: 50_000 },
        gameDate: { year: 2000, month: 1 },
        source: 'StaffManager',
      });
    });
    expect(ae.isUnlocked('full_team')).toBe(true);
  });
});

// ─── Era + tech achievements ───────────────────────────────────────────────────

describe('AchievementEngine — era & tech', () => {
  it('13. era2 unlocked when year reaches 2005', () => {
    const { bus, ae } = buildModule();
    monthEnd(bus, 2005, 1);
    expect(ae.isUnlocked('era2')).toBe(true);
  });

  it('14. tech_pioneer unlocked after 10 research completions', () => {
    const { bus, ae } = buildModule();
    for (let i = 0; i < 10; i++) {
      bus.publish({
        type: 'techtree.research_completed',
        payload: { nodeId: `node-${i}`, nodeName: `Node ${i}` },
        gameDate: { year: 2000, month: 1 },
        source: 'TechTree',
      });
    }
    expect(ae.isUnlocked('tech_pioneer')).toBe(true);
  });

  it('15. ai_pioneer unlocked on GPU hardware purchase event', () => {
    const { bus, ae } = buildModule();
    bus.publish({
      type: 'hardware.purchased',
      payload: { category: HardwareCategory.GPU, modelId: 'gpu-001' },
      gameDate: { year: 2000, month: 1 },
      source: 'HardwareCatalog',
    });
    expect(ae.isUnlocked('ai_pioneer')).toBe(true);
  });
});

// ─── Serialization ─────────────────────────────────────────────────────────────

describe('AchievementEngine — serialize/deserialize', () => {
  it('16. serialized state restores unlocked achievements', () => {
    const { bus, ae } = buildModule();
    settlement(bus, { year: 2000, month: 2 }, 1_000_000, 100_000);
    expect(ae.isUnlocked('first_million')).toBe(true);

    const saved = ae.serialize();
    const bus2 = new EventBus();
    const ae2 = new AchievementEngine();
    ae2.init(bus2, DEFAULT_CONFIG);
    ae2.deserialize(saved);
    expect(ae2.isUnlocked('first_million')).toBe(true);
  });
});
