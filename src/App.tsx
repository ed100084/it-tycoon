import React, { useCallback, useEffect, useState } from 'react';
import { BootSequence } from './components/BootSequence';
import { GameLayout } from './components/GameLayout';
import { useGameStore } from './store/gameStore';

type Phase = 'boot' | 'game';

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('boot');
  const { loadGame } = useGameStore();

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const handleBootComplete = useCallback(() => {
    setPhase('game');
  }, []);

  return (
    <div className="crt">
      {phase === 'boot' && <BootSequence onComplete={handleBootComplete} />}
      {phase === 'game' && <GameLayout />}
    </div>
  );
};

export default App;
