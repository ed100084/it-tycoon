import React, { useEffect, useRef, useState } from 'react';
import type { GameEvent } from '../../game/core/types';
import { formatGameDate } from '../../utils/gameDate';

interface LogEntry {
  id: string;
  date: string;
  text: string;
  color?: string;
}

interface Props {
  maxEntries?: number;
}

// Module-level singleton so logs persist across re-renders
let _entries: LogEntry[] = [];
let _listeners: Array<(entries: LogEntry[]) => void> = [];

export function pushEventLog(event: GameEvent, text: string, color?: string): void {
  const entry: LogEntry = {
    id: event.id,
    date: formatGameDate(event.gameDate),
    text,
    color,
  };
  _entries = [entry, ..._entries].slice(0, 100);
  _listeners.forEach(fn => fn(_entries));
}

export const EventLogPanel: React.FC<Props> = ({ maxEntries = 30 }) => {
  const [entries, setEntries] = useState<LogEntry[]>(_entries);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: LogEntry[]) => setEntries([...e]);
    _listeners.push(handler);
    return () => { _listeners = _listeners.filter(l => l !== handler); };
  }, []);

  return (
    <div className="panel event-log-panel" ref={containerRef}>
      <div className="panel-title">▸ EVENT LOG</div>
      <div className="event-log-entries">
        {entries.slice(0, maxEntries).map(entry => (
          <div key={entry.id} className="log-entry">
            <span className="log-date" style={{ color: 'var(--tm-text-dim)' }}>[{entry.date}]</span>
            <span className="log-text" style={{ color: entry.color }}>{entry.text}</span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="log-entry" style={{ color: 'var(--tm-text-dim)' }}>
            等待第一個事件…
          </div>
        )}
      </div>
    </div>
  );
};
