import React from 'react';
import { useUIStore } from '../../store/uiStore';
import type { GameSpeed } from '../../game/core/types';
import { formatGameDate } from '../../utils/gameDate';

const SPEEDS: { label: string; value: GameSpeed }[] = [
  { label: '⏸', value: 0 },
  { label: '▶ 1×', value: 1 },
  { label: '▶▶ 2×', value: 2 },
  { label: '▶▶▶ 4×', value: 4 },
  { label: '▶▶▶▶ 8×', value: 8 },
];

export const TimeBar: React.FC = () => {
  const { currentDate, speed, isPaused, pauseReason, setSpeed, resume } = useUIStore();

  const effectiveSpeed = isPaused ? 0 : speed;

  const handleSpeedClick = (v: GameSpeed) => {
    if (v === 0) {
      setSpeed(0);
    } else {
      if (isPaused) resume();
      setSpeed(v);
    }
  };

  return (
    <div className="time-bar">
      <div className="time-date">
        <span className="time-label">DATE</span>
        <span className="time-value">{formatGameDate(currentDate)}</span>
      </div>

      <div className="time-controls">
        {SPEEDS.map(({ label, value }) => (
          <button
            key={value}
            className={`crt-btn speed-btn${effectiveSpeed === value ? ' active' : ''}`}
            onClick={() => handleSpeedClick(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {isPaused && pauseReason && pauseReason !== 'user' && (
        <div className="pause-reason">
          <span className="tm-yellow">⏸ PAUSED</span>
          <span className="pause-reason-text">{PAUSE_REASON_LABELS[pauseReason] ?? pauseReason}</span>
          <button className="crt-btn btn-resume" onClick={resume}>[ CONTINUE ]</button>
        </div>
      )}
    </div>
  );
};

const PAUSE_REASON_LABELS: Record<string, string> = {
  month_end:       '月結算完成',
  p1_incident:     'P1 緊急事件',
  p2_incident:     'P2 事件',
  rfp_received:    'RFP 收到',
  major_event:     '重大歷史事件',
  cash_warning:    '現金警戒',
  eol_warning:     'EOL/EOS 到期',
  contract_expiry: '合約到期提醒',
};
