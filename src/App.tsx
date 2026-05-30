import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BootSequence } from './components/BootSequence';
import { GameLayout } from './components/GameLayout';
import { GameEngine } from './game/core/GameEngine';
import { TimeEngine } from './game/modules/TimeEngine';
import { FinanceEngine } from './game/modules/FinanceEngine';
import { FacilityManager } from './game/modules/FacilityManager';
import { HardwareCatalog } from './game/modules/HardwareCatalog';
import { SoftwareCatalog } from './game/modules/SoftwareCatalog';
import { ContractManager } from './game/modules/ContractManager';
import { StaffManager } from './game/modules/StaffManager';
import { SecurityEngine } from './game/modules/SecurityEngine';
import { EventTimeline } from './game/modules/EventTimeline';
import { TechTree } from './game/modules/TechTree';
import { ReputationEngine } from './game/modules/ReputationEngine';
import { DEFAULT_CONFIG } from './game/config/default.config';
import { useUIStore } from './store/uiStore';

type Phase = 'boot' | 'game';

// Engine is created once outside React's render cycle
const engine = new GameEngine(DEFAULT_CONFIG);
engine
  .register(new TimeEngine())
  .register(new FinanceEngine())
  .register(new FacilityManager())
  .register(new HardwareCatalog())
  .register(new SoftwareCatalog())
  .register(new ContractManager())
  .register(new StaffManager())
  .register(new SecurityEngine())
  .register(new EventTimeline())
  .register(new TechTree())
  .register(new ReputationEngine());

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('boot');
  const engineStarted = useRef(false);

  const handleBootComplete = useCallback(() => {
    if (!engineStarted.current) {
      engineStarted.current = true;
      engine.load(); // load save if available (before start so modules deserialize first)
      engine.start();
      useUIStore.getState()._connectEngine(engine);

      // Auto-save every 30s
      const saveInterval = setInterval(() => engine.save(), 30_000);
      // Save on unload
      const handleUnload = () => engine.save();
      window.addEventListener('beforeunload', handleUnload);

      // Cleanup is intentionally not registered because the engine lives for
      // the lifetime of the browser tab (no unmount in practice).
      void saveInterval; // suppress lint; intentional
      void handleUnload;
    }
    setPhase('game');
  }, []);

  // Keyboard shortcut: Space = resume/pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        const store = useUIStore.getState();
        if (store.isPaused) store.resume();
        else store.setSpeed(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="crt">
      {phase === 'boot' && <BootSequence onComplete={handleBootComplete} />}
      {phase === 'game' && <GameLayout />}
    </div>
  );
};

export default App;
