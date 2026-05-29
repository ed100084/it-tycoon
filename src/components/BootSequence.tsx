import React, { useEffect, useState } from 'react';

const BOOT_LINES = [
  { text: '┌─ IT-TYCOON DATACENTER MANAGEMENT SYSTEM v1.0 ─────────────┐', delay: 0,    color: 'var(--tm-blue)', bold: true },
  { text: '│  ITDCMS Kernel 2.0 · React 19 · TypeScript · Zustand      │', delay: 80,   color: 'var(--tm-text-dim)' },
  { text: '└────────────────────────────────────────────────────────────┘', delay: 130,  color: 'var(--tm-blue)' },
  { text: '', delay: 160 },
  { text: '  [OK]   BIOS POST self-check ........................ PASS', delay: 220,  color: 'var(--tm-green)' },
  { text: '  [OK]   ECC RAM 65536 MB detected .................. READY', delay: 310,  color: 'var(--tm-green)' },
  { text: '  [OK]   NVMe RAID-10 array ......................... MOUNTED', delay: 400,  color: 'var(--tm-green)' },
  { text: '  [OK]   10GbE uplink ............................... CONNECTED', delay: 490,  color: 'var(--tm-green)' },
  { text: '  [OK]   Out-of-band management (IPMI) .............. READY', delay: 580,  color: 'var(--tm-green)' },
  { text: '', delay: 620 },
  { text: '  [DC]   North Zone  · 100U capacity ............... ONLINE', delay: 710,  color: 'var(--tm-cyan)' },
  { text: '  [LOCK] Central Zone ................................ OFFLINE', delay: 810,  color: 'var(--tm-red)' },
  { text: '  [LOCK] South Zone .................................. OFFLINE', delay: 910,  color: 'var(--tm-red)' },
  { text: '', delay: 960 },
  { text: '  $ modprobe itdcms_kernel .......................... done', delay: 1050, color: 'var(--tm-text-dim)' },
  { text: '  $ systemctl start resource-monitor ............... done', delay: 1140, color: 'var(--tm-text-dim)' },
  { text: '  $ systemctl start hardware-inventory ............. done', delay: 1230, color: 'var(--tm-text-dim)' },
  { text: '  $ systemctl start power-management ............... done', delay: 1320, color: 'var(--tm-text-dim)' },
  { text: '  $ systemctl start auth-service ................... done', delay: 1410, color: 'var(--tm-text-dim)' },
  { text: '', delay: 1460 },
  { text: '  ✓ SYSTEM READY — WELCOME, ADMINISTRATOR', delay: 1620, color: 'var(--tm-blue)', bold: true },
  { text: '  # Current fiscal year: compute budget approved.', delay: 1770, color: 'var(--tm-purple)' },
  { text: '  # Reminder: All T4+ purchases require a signed 採購申請書.', delay: 1920, color: 'var(--tm-yellow)' },
  { text: '', delay: 2000 },
  { text: '  administrator@itdcms:~$ _', delay: 2100, color: 'var(--tm-cyan)', blink: true },
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
