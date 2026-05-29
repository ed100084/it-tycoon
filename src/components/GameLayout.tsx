import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { ResourceBar } from './hud/ResourceBar';
import { ComputePanel } from './panels/ComputePanel';
import { HardwarePanel } from './panels/HardwarePanel';
import { UpgradesPanel } from './panels/UpgradesPanel';
import { TICK_DELTA, AUTO_SAVE_INTERVAL_MS, SAVE_KEY } from '../game/config/game.config';
import { formatTime } from '../utils/format';

export const GameLayout: React.FC = () => {
  const { tick, saveGame } = useGameStore();
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<HTMLSpanElement>(null);

  // Game loop
  useEffect(() => {
    tickRef.current = setInterval(() => {
      tick(TICK_DELTA);
    }, 100);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [tick]);

  // Auto-save
  useEffect(() => {
    saveRef.current = setInterval(() => {
      saveGame();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (saveRef.current) clearInterval(saveRef.current);
    };
  }, [saveGame]);

  // Live clock (DOM update to avoid re-renders)
  useEffect(() => {
    const clockInterval = setInterval(() => {
      if (clockRef.current) {
        clockRef.current.textContent = formatTime(Date.now());
      }
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Save on page unload
  useEffect(() => {
    const handleUnload = () => saveGame();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [saveGame]);

  const handleSave = () => {
    saveGame();
    // Flash the save button
  };

  const handleNewGame = () => {
    if (confirm('⚠ Start a new game? All progress will be lost.')) {
      useGameStore.getState().newGame();
      localStorage.removeItem(SAVE_KEY);
    }
  };

  return (
    <div className="game-layout crt-content">
      {/* Header */}
      <header className="game-header">
        <div className="header-left">
          <span className="game-title">IT-TYCOON</span>
          <span className="game-version">v1.0</span>
        </div>
        <div className="header-center">
          <span className="header-tagline">
            ▸ 雲端服務商擴張模擬 · 官僚現實版 ◂
          </span>
        </div>
        <div className="header-right">
          <span ref={clockRef} className="header-clock">
            {formatTime(Date.now())}
          </span>
          <button className="crt-btn btn-save" onClick={handleSave}>
            [ 💾 SAVE ]
          </button>
          <button className="crt-btn btn-new-game" onClick={handleNewGame}>
            [ NEW ]
          </button>
        </div>
      </header>

      {/* Resource bar */}
      <ResourceBar />

      {/* Main content - 3 column layout */}
      <main className="game-main">
        <HardwarePanel />
        <ComputePanel />
        <UpgradesPanel />
      </main>

      {/* Footer */}
      <footer className="game-footer">
        <span className="footer-text">
          IT-TYCOON v1.0 · React 19 + TypeScript + Zustand ·
          Auto-save every 30s · Data persisted in localStorage
        </span>
        <span className="footer-warn">
          ⚠ Remember: All T4+ purchases require a signed 採購申請書
        </span>
      </footer>
    </div>
  );
};
