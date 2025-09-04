import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { GameSettings } from '@/types/game';
import { cn } from '@/lib/utils';

export default function GameSetup() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<GameSettings>({
    playerCount: 2,
    rounds: 5,
    mode: 'solo'
  });

  // Get mode from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') as 'solo' | 'pass-play';
    if (mode) {
      setSettings(prev => ({ ...prev, mode }));
    }
  }, []);

  const setPlayerCount = (count: 2 | 3 | 4) => {
    setSettings(prev => ({ ...prev, playerCount: count }));
  };

  const setRounds = (rounds: 5 | 9) => {
    setSettings(prev => ({ ...prev, rounds }));
  };

  const startGame = () => {
    const params = new URLSearchParams({
      mode: settings.mode,
      players: settings.playerCount.toString(),
      rounds: settings.rounds.toString()
    });
    setLocation(`/game?${params.toString()}`);
  };

  const getModeTitle = () => {
    switch (settings.mode) {
      case 'solo': return 'Solo vs AI';
      case 'pass-play': return 'Pass & Play';
      // Online multiplayer should never go through this component
      default: return 'Game Setup';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt flex flex-col">
      <header className="flex justify-between items-center p-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/')}
          className="text-white text-xl hover:text-blue-400 transition-colors"
          data-testid="button-back"
        >
          <i className="fas fa-arrow-left"></i>
        </Button>
        <h2 className="text-white text-xl font-semibold">{getModeTitle()}</h2>
        <div></div>
      </header>

      <div className="flex-1 px-6 pb-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Player Count */}
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Number of Players</h3>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map((count) => (
                <Button
                  key={count}
                  onClick={() => setPlayerCount(count as 2 | 3 | 4)}
                  className={cn(
                    'py-3 px-4 rounded-lg font-medium transition-all',
                    settings.playerCount === count
                      ? 'bg-blue-600 text-white border-2 border-blue-500'
                      : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                  )}
                  data-testid={`button-players-${count}`}
                >
                  {count}
                </Button>
              ))}
            </div>
          </div>

          {/* Rounds */}
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Number of Rounds</h3>
            <div className="grid grid-cols-2 gap-2">
              {[5, 9].map((rounds) => (
                <Button
                  key={rounds}
                  onClick={() => setRounds(rounds as 5 | 9)}
                  className={cn(
                    'py-3 px-4 rounded-lg font-medium transition-all',
                    settings.rounds === rounds
                      ? 'bg-blue-600 text-white border-2 border-blue-500'
                      : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                  )}
                  data-testid={`button-rounds-${rounds}`}
                >
                  {rounds} Rounds
                </Button>
              ))}
            </div>
          </div>

          {/* Start Game */}
          <Button 
            onClick={startGame}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all duration-200"
            data-testid="button-start-game"
          >
            Start Game
          </Button>
        </div>
      </div>
    </div>
  );
}
