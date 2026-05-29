import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import { ACHIEVEMENT_DEFS } from '../../../game/config/achievement.config';
import type { AchievementCategory } from '../../../game/models/types';

const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  milestone: 'Milestone',
  hardware: 'Hardware',
  audit: 'Audit',
  efficiency: 'Efficiency',
  expansion: 'Expansion',
  bureaucracy: 'Bureaucracy',
  prestige: 'Prestige',
  technology: 'Technology',
  contract: 'Contract',
  staff: 'Staff',
};

export const AchievementsSection: React.FC = () => {
  const { unlockedAchievements, recentAchievementIds } = useGameStore();
  const achievementUnlockSet = new Set(unlockedAchievements);
  const recentAchievementSet = new Set(recentAchievementIds);

  return (
    <div className="upgrade-section">
      <div className="upgrade-section-title">─── ACHIEVEMENTS ───</div>

      <div className="achievement-summary">
        <span>Unlocked <span className="glow-yellow">{unlockedAchievements.length}/{ACHIEVEMENT_DEFS.length}</span></span>
        <span>{Math.floor((unlockedAchievements.length / ACHIEVEMENT_DEFS.length) * 100)}%</span>
      </div>

      {recentAchievementIds.length > 0 && (
        <div className="achievement-recent">
          {recentAchievementIds.map((achievementId) => {
            const achievement = ACHIEVEMENT_DEFS.find((def) => def.id === achievementId);
            if (!achievement) return null;
            return <span key={achievement.id}>NEW: {achievement.name}</span>;
          })}
        </div>
      )}

      <div className="achievement-list">
        {ACHIEVEMENT_DEFS.map((achievement) => {
          const unlocked = achievementUnlockSet.has(achievement.id);
          const recent = recentAchievementSet.has(achievement.id);
          return (
            <div key={achievement.id} className={`achievement-card ${unlocked ? 'unlocked' : 'locked'} ${recent ? 'recent' : ''}`}>
              <div className="achievement-card-top">
                <span className="achievement-name">{achievement.name}</span>
                <span className={unlocked ? 'glow-yellow' : 'glow-green-dim'}>
                  {unlocked ? 'DONE' : 'LOCKED'}
                </span>
              </div>
              <div className="achievement-category">{ACHIEVEMENT_CATEGORY_LABELS[achievement.category]}</div>
              <div className="achievement-desc">{unlocked ? achievement.description : achievement.requirement}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
