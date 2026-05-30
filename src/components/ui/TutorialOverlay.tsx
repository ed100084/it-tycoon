import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { TUTORIAL_STEPS } from '../../game/modules/TutorialEngine';

export const TutorialOverlay: React.FC = () => {
  const { tutorialStep, nextTutorialStep, skipTutorial } = useUIStore();

  if (!tutorialStep) return null;

  const stepCount = TUTORIAL_STEPS.length;
  const current = tutorialStep.index + 1;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        <div className="tutorial-header">
          <span className="tutorial-badge">教學 {current}/{stepCount}</span>
          <button className="tutorial-skip-btn" onClick={skipTutorial}>
            跳過教學
          </button>
        </div>

        <h3 className="tutorial-title">{tutorialStep.title}</h3>

        <p className="tutorial-message">
          {tutorialStep.message.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < tutorialStep.message.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>

        <div className="tutorial-progress">
          {TUTORIAL_STEPS.map((_, i) => (
            <div
              key={i}
              className={`tutorial-dot ${i < current ? 'done' : i === current - 1 ? 'active' : ''}`}
            />
          ))}
        </div>

        <button className="crt-btn tutorial-next-btn" onClick={nextTutorialStep}>
          {current < stepCount ? '下一步 →' : '完成教學 ✓'}
        </button>
      </div>
    </div>
  );
};
