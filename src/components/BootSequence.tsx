import React, { useEffect, useState } from 'react';

const APP_VERSION = 'v3.0';

const BOOT_LINES = [
  { text: `┌─ IT-TYCOON DATACENTER MANAGEMENT SYSTEM ${APP_VERSION} ─────────────┐`, delay: 0,    color: 'var(--tm-blue)', bold: true },
  { text: '│  Management Sim · React 19 · TypeScript · Zustand          │', delay: 80,   color: 'var(--tm-text-dim)' },
  { text: '└────────────────────────────────────────────────────────────┘', delay: 130,  color: 'var(--tm-blue)' },
  { text: '', delay: 160 },
  { text: '  [OK]   EventBus ....................................... READY', delay: 220,  color: 'var(--tm-green)' },
  { text: '  [OK]   TimeEngine (2000/01) .......................... READY', delay: 310,  color: 'var(--tm-green)' },
  { text: '  [OK]   FinanceEngine (NT$5,000,000) .................. READY', delay: 400,  color: 'var(--tm-green)' },
  { text: '  [OK]   Save system ................................... READY', delay: 490,  color: 'var(--tm-green)' },
  { text: '', delay: 540 },
  { text: '  [DC]   North Zone  · 100U capacity .................. ONLINE', delay: 620,  color: 'var(--tm-cyan)' },
  { text: '  [LOCK] Central Zone ................................. OFFLINE', delay: 720,  color: 'var(--tm-red)' },
  { text: '  [LOCK] South Zone ................................... OFFLINE', delay: 820,  color: 'var(--tm-red)' },
  { text: '', delay: 870 },
  { text: '  $ systemctl start time-engine ........................ done', delay: 960,  color: 'var(--tm-text-dim)' },
  { text: '  $ systemctl start finance-engine ..................... done', delay: 1050, color: 'var(--tm-text-dim)' },
  { text: '', delay: 1100 },
  { text: '  ✓ SYSTEM READY — WELCOME, ADMINISTRATOR', delay: 1260, color: 'var(--tm-blue)', bold: true },
  { text: '  # Fiscal year begins: 2000/01. Angel round: NT$5M.', delay: 1400, color: 'var(--tm-purple)' },
  { text: '  # Reminder: All purchases > NT$5M require a signed 採購申請書.', delay: 1550, color: 'var(--tm-yellow)' },
  { text: '', delay: 1630 },
  { text: '  administrator@itdcms:~$ _', delay: 1750, color: 'var(--tm-cyan)', blink: true },
];

interface Props {
  onComplete: () => void;
}

export const BootSequence: React.FC<Props> = ({ onComplete }) => {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_LINES.forEach((line, i) => {
      const t = setTimeout(() => {
        setVisibleLines((v) => v + 1);
        if (i === BOOT_LINES.length - 1) {
          setTimeout(() => {
            setDone(true);
            setTimeout(onComplete, 400);
          }, 600);
        }
      }, line.delay);
      timers.push(t);
    });

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="boot-sequence" onClick={() => { setDone(true); onComplete(); }}>
      <div className="boot-content">
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            className={`boot-line${line.blink ? ' blink' : ''}${done && i === visibleLines - 1 ? ' fade-out' : ''}`}
            style={{
              color: line.color || 'var(--crt-green)',
              fontWeight: line.bold ? 'bold' : 'normal',
            }}
          >
            {line.text || ' '}
          </div>
        ))}
      </div>
      <div className="boot-skip">[ CLICK TO SKIP ]</div>
    </div>
  );
};
