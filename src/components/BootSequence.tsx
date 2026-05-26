import React, { useEffect, useState } from 'react';

const BOOT_LINES = [
  { text: 'IT-TYCOON MANAGEMENT SYSTEM v0.2', delay: 0, color: 'var(--crt-green)', bold: true },
  { text: '═══════════════════════════════════════════════', delay: 80, color: 'var(--crt-green-dim)' },
  { text: '', delay: 100 },
  { text: '[BIOS] POST self-check ..................... PASS', delay: 150, color: 'var(--crt-green-dim)' },
  { text: '[MEM]  ECC RAM 65536 MB .................... OK', delay: 250, color: 'var(--crt-green-dim)' },
  { text: '[DISK] NVMe RAID-10 array .................. MOUNTED', delay: 350, color: 'var(--crt-green-dim)' },
  { text: '[NET]  10GbE uplink ........................ CONNECTED', delay: 450, color: 'var(--crt-green-dim)' },
  { text: '[IPMI] Out-of-band management .............. READY', delay: 550, color: 'var(--crt-green-dim)' },
  { text: '', delay: 600 },
  { text: '[DC]   North Zone — 100U capacity .......... ONLINE', delay: 700, color: 'var(--crt-yellow)' },
  { text: '[DC]   Central Zone — LOCKED ............... OFFLINE', delay: 800, color: 'var(--crt-red-dim)' },
  { text: '[DC]   South Zone — LOCKED ................. OFFLINE', delay: 900, color: 'var(--crt-red-dim)' },
  { text: '', delay: 950 },
  { text: 'Loading ITDCMS kernel module ............... DONE', delay: 1050, color: 'var(--crt-green-dim)' },
  { text: 'Starting resource monitor .................. DONE', delay: 1150, color: 'var(--crt-green-dim)' },
  { text: 'Initializing hardware inventory ............ DONE', delay: 1250, color: 'var(--crt-green-dim)' },
  { text: 'Starting power management daemon ........... DONE', delay: 1350, color: 'var(--crt-green-dim)' },
  { text: 'Loading administrator credentials .......... DONE', delay: 1450, color: 'var(--crt-green-dim)' },
  { text: '', delay: 1500 },
  { text: '> SYSTEM READY. WELCOME, ADMINISTRATOR.', delay: 1700, color: 'var(--crt-green)', bold: true },
  { text: '> Current fiscal year: compute budget approved.', delay: 1850, color: 'var(--crt-blue)' },
  { text: '> Reminder: All T4+ purchases require a signed 採購申請書.', delay: 2000, color: 'var(--crt-yellow)' },
  { text: '', delay: 2100 },
  { text: '> _', delay: 2200, color: 'var(--crt-green)', blink: true },
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
            {line.text || ' '}
          </div>
        ))}
      </div>
      <div className="boot-skip">[ CLICK TO SKIP ]</div>
    </div>
  );
};
