import React, { useEffect, useState } from 'react';

const G = 'var(--accent-green)';
const B = 'var(--accent-blue)';
const C = 'var(--accent-cyan)';
const D = 'var(--text-dim)';
const R = 'var(--accent-red)';
const Y = 'var(--accent-yellow)';
const P = 'var(--accent-purple)';
const H = 'var(--text-heading)';

const BOOT_LINES = [
  { text: '╔══════════════════════════════════════════════════════════════╗', delay: 0,    color: B, bold: true },
  { text: '║  IT-TYCOON DATACENTER MANAGEMENT SYSTEM                     ║', delay: 60,   color: H, bold: true },
  { text: '║  Infrastructure Management Division  ·  BIOS POST v3.0      ║', delay: 110,  color: D },
  { text: '╚══════════════════════════════════════════════════════════════╝', delay: 150,  color: B, bold: true },
  { text: '', delay: 180 },
  { text: '  Initializing hardware inventory catalog .............. [DONE]', delay: 260,  color: G },
  { text: '  Loading software license registry ................... [DONE]', delay: 370,  color: G },
  { text: '  Starting finance engine  (NT$5,000,000) ............. [DONE]', delay: 470,  color: G },
  { text: '  Connecting to time engine  (2000/01) ................ [DONE]', delay: 560,  color: G },
  { text: '  Initializing contract management system ............. [DONE]', delay: 650,  color: G },
  { text: '  Loading staff management module ..................... [DONE]', delay: 740,  color: G },
  { text: '  Starting security monitoring engine ................. [DONE]', delay: 830,  color: G },
  { text: '  Building technology research tree ................... [DONE]', delay: 910,  color: G },
  { text: '  Loading reputation & SLA engine ..................... [DONE]', delay: 990,  color: G },
  { text: '', delay: 1020 },
  { text: '  ZONE DISCOVERY:', delay: 1080, color: D },
  { text: '  [ONLINE]  North Zone    ·  100U rack space  ·  PUE 2.0', delay: 1150, color: C },
  { text: '  [LOCKED]  Central Zone  ·  requires expansion unlock',   delay: 1240, color: R },
  { text: '  [LOCKED]  South Zone    ·  requires expansion unlock',   delay: 1330, color: R },
  { text: '', delay: 1370 },
  { text: '  ► ALL SYSTEMS NOMINAL — READY TO OPERATE',              delay: 1480, color: G, bold: true },
  { text: '  ► Fiscal year 2000/01  ·  Angel round: NT$5,000,000',   delay: 1590, color: P },
  { text: '  ► Purchases > NT$5M require signed 採購申請書',          delay: 1700, color: Y },
  { text: '', delay: 1740 },
  { text: '  itdcms@datacenter:~$ _', delay: 1820, color: C, blink: true },
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
            setTimeout(onComplete, 350);
          }, 550);
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
              color: line.color ?? 'var(--text)',
              fontWeight: line.bold ? '700' : '400',
            }}
          >
            {line.text || ' '}
          </div>
        ))}
      </div>
      <div className="boot-skip">[ CLICK TO SKIP ]</div>
    </div>
  );
};
