import React from 'react';
import { useToastStore } from '../../store/toastStore';
import { useUIStore } from '../../store/uiStore';

export const EventModal: React.FC = () => {
  const { modal, dismissModal } = useToastStore();
  const makeTimelineDecision = useUIStore((s) => s.makeTimelineDecision);
  const resume = useUIStore((s) => s.resume);

  if (!modal) return null;

  const handleDecision = (index: number) => {
    if (modal.decisionId) {
      makeTimelineDecision(modal.decisionId, index);
    }
    dismissModal();
    resume();
  };

  const handleDismiss = () => {
    if (!modal.decisions?.length) {
      resume();
    }
    dismissModal();
  };

  return (
    <div className="event-modal-overlay" onClick={handleDismiss}>
      <div
        className={`event-modal-card event-modal-${modal.severity ?? 'info'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="event-modal-header">
          <span className="event-modal-severity-icon">
            {modal.severity === 'critical' && '🚨'}
            {modal.severity === 'warning'  && '⚠️'}
            {(!modal.severity || modal.severity === 'info') && '📋'}
          </span>
          <h2 className="event-modal-title">{modal.title}</h2>
        </div>

        <p className="event-modal-body">{modal.body}</p>

        <div className="event-modal-actions">
          {modal.decisions && modal.decisions.length > 0
            ? modal.decisions.map((d) => (
                <button
                  key={d.index}
                  className="crt-btn event-modal-decision-btn"
                  onClick={() => handleDecision(d.index)}
                >
                  {d.label}
                </button>
              ))
            : (
                <button className="crt-btn event-modal-close-btn" onClick={handleDismiss}>
                  確認
                </button>
              )}
        </div>
      </div>
    </div>
  );
};
