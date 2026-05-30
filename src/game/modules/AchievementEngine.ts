import type {
  Achievement,
  GameConfig,
  GameDate,
  IEventBus,
  IGameModule,
} from '../core/types';
import { HardwareCategory, IncidentSeverity, StaffRole } from '../core/types';

// ─── Achievement definitions ──────────────────────────────────────────────────

const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlockedAt'>[] = [
  {
    id: 'first_million',
    name: '第一桶金',
    description: '月營收突破 NT$100 萬',
    icon: '💰',
    rewardReputation: 3,
  },
  {
    id: 'stable_ops',
    name: '穩定營運',
    description: '連續 6 個月正現金流',
    icon: '📈',
    rewardReputation: 5,
  },
  {
    id: 'iron_man',
    name: '鐵人',
    description: '連續 12 個月零資安事件',
    icon: '🛡️',
    rewardReputation: 10,
  },
  {
    id: 'dinosaur_hunter',
    name: '恐龍獵人',
    description: '汰換掉第一台 EOL 設備',
    icon: '🦕',
    rewardReputation: 2,
  },
  {
    id: 'talent_rich',
    name: '人才濟濟',
    description: '員工達 10 人',
    icon: '👥',
    rewardReputation: 3,
  },
  {
    id: 'five_star',
    name: '五星服務',
    description: '聲譽達 90 分',
    icon: '⭐',
    rewardCash: 500_000,
  },
  {
    id: 'tech_pioneer',
    name: '科技先驅',
    description: '解鎖 10 個科技節點',
    icon: '🔬',
    rewardReputation: 5,
  },
  {
    id: 'big_client',
    name: '大客戶',
    description: '簽下第一張大型合約（月收 > NT$50 萬）',
    icon: '🏢',
    rewardReputation: 5,
  },
  {
    id: 'crisis_manager',
    name: '危機管理',
    description: '成功處理 P1 資安事件且零客戶流失',
    icon: '🚨',
    rewardReputation: 8,
  },
  {
    id: 'era2',
    name: '時代跨越',
    description: '遊戲進入 2005 年（Era 2）',
    icon: '📅',
    rewardReputation: 5,
  },
  {
    id: 'cloud_transform',
    name: '雲端轉型',
    description: '遊戲進入 2010 年',
    icon: '☁️',
    rewardReputation: 5,
  },
  {
    id: 'ai_pioneer',
    name: 'AI 先鋒',
    description: '購買第一台 GPU 伺服器',
    icon: '🤖',
    rewardReputation: 8,
  },
  {
    id: 'financial_freedom',
    name: '財務自由',
    description: '現金餘額突破 NT$1 億',
    icon: '🏦',
    rewardCash: 1_000_000,
  },
  {
    id: 'full_team',
    name: '全員到齊',
    description: '7 種職位各至少 1 人',
    icon: '🎯',
    rewardReputation: 5,
  },
  {
    id: 'compliance_master',
    name: '合規達人',
    description: '合規分數達 95 分',
    icon: '📜',
    rewardReputation: 5,
  },
];

// ─── Internal state ───────────────────────────────────────────────────────────

interface AchievementState {
  achievements: Achievement[];
  consecutiveProfitableMonths: number;
  consecutiveSecureMonths: number;
  p1ResolvedThisSession: boolean;
  contractLostAfterP1Resolve: boolean;
}

// ─── AchievementEngine ────────────────────────────────────────────────────────

export class AchievementEngine implements IGameModule {
  readonly moduleId = 'AchievementEngine';

  private bus!: IEventBus;
  private currentDate: GameDate = { year: 2000, month: 1 };

  private state: AchievementState = {
    achievements: ACHIEVEMENT_DEFS.map(d => ({ ...d, unlockedAt: null })),
    consecutiveProfitableMonths: 0,
    consecutiveSecureMonths: 0,
    p1ResolvedThisSession: false,
    contractLostAfterP1Resolve: false,
  };

  // Shadow tracking
  private staffRoleCount = new Map<StaffRole, number>();
  private staffRoleById = new Map<string, StaffRole>();
  private techCompletedCount = 0;
  private hadP1ThisMonth = false;

  // ── Public API ───────────────────────────────────────────────────────────

  getAchievements(): Achievement[] {
    return [...this.state.achievements];
  }

  getUnlockedCount(): number {
    return this.state.achievements.filter(a => a.unlockedAt !== null).length;
  }

  isUnlocked(id: string): boolean {
    return this.state.achievements.find(a => a.id === id)?.unlockedAt !== null;
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.currentDate = { ...config.time.startDate };

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = { ...p.newDate };
      this.onMonthEnd();
    }, this.moduleId);

    bus.subscribe('finance.monthly_settlement', (e) => {
      const pl = e.payload as { income: { total: number }; netProfit: number; expenses: { total: number } };
      this.onSettlement(pl);
    }, this.moduleId);

    bus.subscribe('security.incident_triggered', (e) => {
      const p = e.payload as { severity: IncidentSeverity };
      if (p.severity === IncidentSeverity.P1) {
        this.hadP1ThisMonth = true;
        this.state.consecutiveSecureMonths = 0;
        this.state.p1ResolvedThisSession = false;
        this.state.contractLostAfterP1Resolve = false;
      }
    }, this.moduleId);

    bus.subscribe('security.incident_resolved', (e) => {
      const p = e.payload as { severity: IncidentSeverity };
      if (p.severity === IncidentSeverity.P1) {
        this.state.p1ResolvedThisSession = true;
      }
    }, this.moduleId);

    bus.subscribe('contract.terminated', () => {
      if (this.state.p1ResolvedThisSession) {
        this.state.contractLostAfterP1Resolve = true;
      }
    }, this.moduleId);

    bus.subscribe('contract.signed', (e) => {
      const p = e.payload as { monthlyFeeNTD?: number };
      if ((p.monthlyFeeNTD ?? 0) >= 500_000) {
        this.unlock('big_client');
      }
    }, this.moduleId);

    bus.subscribe('hardware.disposed', (e) => {
      const p = e.payload as { wasEOL?: boolean };
      if (p.wasEOL) {
        this.unlock('dinosaur_hunter');
      }
    }, this.moduleId);

    bus.subscribe('hardware.purchased', (e) => {
      const p = e.payload as { category?: HardwareCategory };
      if (p.category === HardwareCategory.GPU) {
        this.unlock('ai_pioneer');
      }
    }, this.moduleId);

    bus.subscribe('staff.hired', (e) => {
      const member = e.payload as { id: string; role: StaffRole };
      this.staffRoleById.set(member.id, member.role);
      this.staffRoleCount.set(member.role, (this.staffRoleCount.get(member.role) ?? 0) + 1);
      this.checkStaffAchievements();
    }, this.moduleId);

    bus.subscribe('staff.resigned', (e) => {
      const p = e.payload as { staffId?: string; role?: StaffRole };
      if (p.staffId) {
        const role = this.staffRoleById.get(p.staffId);
        if (role) {
          this.staffRoleById.delete(p.staffId);
          const prev = this.staffRoleCount.get(role) ?? 0;
          if (prev > 0) this.staffRoleCount.set(role, prev - 1);
        }
      }
    }, this.moduleId);

    bus.subscribe('staff.laid_off', (e) => {
      const p = e.payload as { staffId: string };
      const role = this.staffRoleById.get(p.staffId);
      if (role) {
        this.staffRoleById.delete(p.staffId);
        const prev = this.staffRoleCount.get(role) ?? 0;
        if (prev > 0) this.staffRoleCount.set(role, prev - 1);
      }
    }, this.moduleId);

    bus.subscribe('techtree.research_completed', () => {
      this.techCompletedCount++;
      if (this.techCompletedCount >= 10) {
        this.unlock('tech_pioneer');
      }
    }, this.moduleId);

    bus.subscribe('reputation.satisfaction_changed', (e) => {
      const p = e.payload as { score: number };
      if (p.score >= 90) {
        this.unlock('five_star');
      }
    }, this.moduleId);

    bus.subscribe('software.compliance_changed', (e) => {
      const p = e.payload as { score: number };
      if (p.score >= 95) {
        this.unlock('compliance_master');
      }
    }, this.moduleId);
  }

  tick(_deltaMs: number): void {}

  serialize(): Record<string, unknown> {
    return {
      ...this.state,
      currentDate: this.currentDate,
      techCompletedCount: this.techCompletedCount,
      staffRoleCount: Object.fromEntries(this.staffRoleCount),
      staffRoleById: Object.fromEntries(this.staffRoleById),
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    if (Array.isArray(saved.achievements)) {
      // Merge unlocked state into fresh definitions (preserves new achievements added after save)
      const savedMap = new Map(
        (saved.achievements as Achievement[]).map(a => [a.id, a.unlockedAt]),
      );
      for (const ach of this.state.achievements) {
        const savedUnlock = savedMap.get(ach.id);
        if (savedUnlock !== undefined) ach.unlockedAt = savedUnlock;
      }
    }
    this.state.consecutiveProfitableMonths = (saved.consecutiveProfitableMonths as number) ?? 0;
    this.state.consecutiveSecureMonths = (saved.consecutiveSecureMonths as number) ?? 0;
    this.techCompletedCount = (saved.techCompletedCount as number) ?? 0;
    if (saved.staffRoleCount) {
      this.staffRoleCount = new Map(Object.entries(saved.staffRoleCount as Record<string, number>) as [StaffRole, number][]);
    }
    if (saved.staffRoleById) {
      this.staffRoleById = new Map(Object.entries(saved.staffRoleById as Record<string, StaffRole>));
    }
    if (saved.currentDate) {
      this.currentDate = saved.currentDate as GameDate;
    }
  }

  getState(): Readonly<Record<string, unknown>> {
    return {
      achievements: this.state.achievements,
      unlockedCount: this.getUnlockedCount(),
      total: this.state.achievements.length,
    };
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private onMonthEnd(): void {
    // Era transitions
    if (this.currentDate.year >= 2005) this.unlock('era2');
    if (this.currentDate.year >= 2010) this.unlock('cloud_transform');

    // Consecutive secure months (reset if P1 happened this month)
    if (!this.hadP1ThisMonth) {
      this.state.consecutiveSecureMonths++;
      if (this.state.consecutiveSecureMonths >= 12) {
        this.unlock('iron_man');
      }
    }
    this.hadP1ThisMonth = false;

    // Crisis management: P1 resolved and no contracts lost
    if (this.state.p1ResolvedThisSession && !this.state.contractLostAfterP1Resolve) {
      this.unlock('crisis_manager');
    }
  }

  private onSettlement(pl: { income: { total: number }; netProfit: number; expenses: { total: number } }): void {
    // Revenue milestone
    if (pl.income.total >= 1_000_000) {
      this.unlock('first_million');
    }

    // Consecutive profit
    if (pl.netProfit > 0) {
      this.state.consecutiveProfitableMonths++;
      if (this.state.consecutiveProfitableMonths >= 6) {
        this.unlock('stable_ops');
      }
    } else {
      this.state.consecutiveProfitableMonths = 0;
    }
  }

  private checkStaffAchievements(): void {
    // Total headcount
    const total = Array.from(this.staffRoleCount.values()).reduce((s, c) => s + c, 0);
    if (total >= 10) this.unlock('talent_rich');

    // All 7 roles covered
    const allRoles = Object.values(StaffRole) as StaffRole[];
    const allCovered = allRoles.every(r => (this.staffRoleCount.get(r) ?? 0) >= 1);
    if (allCovered) this.unlock('full_team');
  }

  private unlock(id: string): void {
    const ach = this.state.achievements.find(a => a.id === id);
    if (!ach || ach.unlockedAt !== null) return;

    ach.unlockedAt = { ...this.currentDate };

    this.bus.publish({
      type: 'achievement.unlocked',
      payload: {
        id: ach.id,
        name: ach.name,
        icon: ach.icon,
        description: ach.description,
        rewardReputation: ach.rewardReputation,
        rewardCash: ach.rewardCash,
      },
      source: this.moduleId,
      gameDate: this.currentDate,
    });

    // Apply cash reward immediately via finance event
    if (ach.rewardCash && ach.rewardCash > 0) {
      this.bus.publish({
        type: 'achievement.cash_reward',
        payload: { amount: ach.rewardCash, reason: `成就獎勵：${ach.name}` },
        source: this.moduleId,
        gameDate: this.currentDate,
      });
    }
  }
}
