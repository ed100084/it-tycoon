import React, { useCallback, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { formatNumber, formatDuration, formatCPS } from '../../utils/format';

interface FloatingNum {
  id: number;
  x: number;
  y: number;
}

let floatId = 0;

export const ComputePanel: React.FC = () => {
  const { compute, totalEarnedCompute, metrics, gameTime, click, isShutdown, shutdownBuffer, emergencyClicks, offlineReport, dismissOfflineReport } =
    useGameStore();
  const [floaters, setFloaters] = useState<FloatingNum[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      click();
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = floatId++;
      setFloaters((prev) => [...prev, { id, x, y }]);
      setTimeout(() => setFloaters((prev) => prev.filter((f) => f.id !== id)), 800);
    },
    [click]
  );

  return (
    <div className="panel compute-panel">
      <div className="panel-header">
        <span>▶ COMPUTE CORE</span>
        <span className="panel-uptime">UPTIME: {formatDuration(gameTime)}</span>
      </div>

      {/* Offline report modal */}
      {offlineReport && (
        <div className="offline-report">
          <div className="offline-report-title">◈ OFFLINE EARNINGS REPORT ◈</div>
          <div className="offline-report-body">
            <div>Absence duration: <span className="glow-yellow">{formatDuration(offlineReport.elapsed)}</span></div>
            {offlineReport.wasShutdown ? (
              <div className="glow-red">⚠ System was in SHUTDOWN — no earnings</div>
            ) : (
              <div>Earned: <span className="glow-green">+{formatNumber(offlineReport.earnings)} CF</span></div>
            )}
          </div>
          <button className="crt-btn btn-confirm" onClick={dismissOfflineReport}>
            [ ACKNOWLEDGE ]
          </button>
        </div>
      )}

      {/* Main compute display */}
      <div className="compute-display">
        <div className="compute-amount glow-green">{formatNumber(compute)}</div>
        <div className="compute-unit">compute flops (CF)</div>
        <div className="compute-cps">
          {metrics.totalCPS > 0 ? (
            <>
              <span className="glow-green">▲ {formatCPS(metrics.totalCPS)}</span>
              {' '}
              <span className="glow-red">▼ {formatCPS(metrics.totalPowerCost)}</span>
            </>
          ) : (
            <span className="glow-green-dim">click to generate compute</span>
          )}
        </div>
      </div>

      {/* Click button */}
      <div className="click-area">
        <button
          ref={btnRef}
          className={`compute-btn ${isShutdown ? 'compute-btn-shutdown' : ''}`}
          onClick={handleClick}
          title="Click to generate compute"
        >
          <div className="compute-btn-art">
            {isShutdown ? (
              <>
                <div>╔═══════════════╗</div>
                <div>║ ⚠  SHUTDOWN   ║</div>
                <div>║  EMERGENCY    ║</div>
                <div>║ RESTART {String(emergencyClicks).padStart(2,'0')}/10 ║</div>
                <div>╚═══════════════╝</div>
              </>
            ) : shutdownBuffer > 0 ? (
              <>
                <div>╔═══════════════╗</div>
                <div>║ ✓  RESTARTED  ║</div>
                <div>║ FREE  BUFFER  ║</div>
                <div>║  {shutdownBuffer.toFixed(1).padStart(3,' ')}s REMAIN  ║</div>
                <div>╚═══════════════╝</div>
              </>
            ) : (
              <>
                <div>╔═══════════════╗</div>
                <div>║   COMPUTE     ║</div>
                <div>║   ▓▓▓▓▓▓▓    ║</div>
                <div>║   PROCESS     ║</div>
                <div>╚═══════════════╝</div>
              </>
            )}
          </div>
          {/* Floating +1 indicators */}
          {floaters.map((f) => (
            <span
              key={f.id}
              className="float-num"
              style={{ left: f.x, top: f.y }}
            >
              +1
            </span>
          ))}
        </button>
      </div>

      {/* Stats */}
      <div className="compute-stats">
        <div className="stat-row">
          <span className="stat-label">Total earned</span>
          <span className="stat-value glow-green-dim">{formatNumber(totalEarnedCompute)} CF</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Net CPS</span>
          <span className={`stat-value ${metrics.netCPS >= 0 ? 'glow-green' : 'glow-red'}`}>
            {formatCPS(metrics.netCPS)}
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Gross CPS</span>
          <span className="stat-value glow-green">{formatCPS(metrics.totalCPS)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Power cost</span>
          <span className="stat-value glow-yellow">-{formatCPS(metrics.totalPowerCost)}</span>
        </div>
      </div>

      {isShutdown && (
        <div className="shutdown-banner">
          ⚠ POWER FAILURE — Click {10 - emergencyClicks} more time{10 - emergencyClicks !== 1 ? 's' : ''} to restart<br />
          {metrics.totalPowerCost > 0 && <>Or accumulate {formatNumber(metrics.totalPowerCost * 5)} CF (5s of bills)</>}
        </div>
      )}
      {shutdownBuffer > 0 && (
        <div className="buffer-banner">
          ✓ EMERGENCY RESTART — Free power buffer: {shutdownBuffer.toFixed(1)}s remaining
        </div>
      )}
    </div>
  );
};
