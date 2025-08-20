import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import HowToPlay from '@/components/Game/HowToPlay';

export default function Home() {
  const [, setLocation] = useLocation();
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const selectMode = (mode: 'solo' | 'pass-play' | 'online') => {
    setLocation(`/setup?mode=${mode}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt">
      {/* Header */}
      <header className="flex justify-between items-center p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-game-gold rounded-full flex items-center justify-center">
            <i className="fas fa-user text-white text-xl"></i>
          </div>
          <div className="text-white">
            <div className="font-semibold">Player</div>
            <div className="text-sm opacity-80">Level 12 • 2,450 XP</div>
          </div>
        </div>
        
        <button className="text-white text-2xl hover:text-game-gold transition-colors" data-testid="button-settings">
          <i className="fas fa-bars"></i>
        </button>
      </header>

      {/* Game Logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-4">Golf 9</h1>
          <p className="text-xl text-game-cream opacity-90">The Card Game</p>
        </div>

        {/* Mode Selection */}
        <div className="w-full max-w-md space-y-4">
          <Button 
            onClick={() => selectMode('solo')}
            className="w-full bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 text-white py-4 px-6 rounded-xl border border-white border-opacity-20 transition-all duration-200 flex items-center justify-between h-auto"
            data-testid="button-solo-mode"
          >
            <div className="flex items-center space-x-4">
              <i className="fas fa-robot text-game-gold text-xl"></i>
              <span className="font-semibold">Solo vs AI</span>
            </div>
            <i className="fas fa-chevron-right opacity-60"></i>
          </Button>

          <Button 
            onClick={() => selectMode('pass-play')}
            className="w-full bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 text-white py-4 px-6 rounded-xl border border-white border-opacity-20 transition-all duration-200 flex items-center justify-between h-auto"
            data-testid="button-pass-play-mode"
          >
            <div className="flex items-center space-x-4">
              <i className="fas fa-users text-game-gold text-xl"></i>
              <span className="font-semibold">Pass & Play</span>
            </div>
            <i className="fas fa-chevron-right opacity-60"></i>
          </Button>

          <Button 
            onClick={() => selectMode('online')}
            className="w-full bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 text-white py-4 px-6 rounded-xl border border-white border-opacity-20 transition-all duration-200 flex items-center justify-between h-auto"
            data-testid="button-online-mode"
            disabled
          >
            <div className="flex items-center space-x-4">
              <i className="fas fa-wifi text-game-gold text-xl"></i>
              <span className="font-semibold">Online Multiplayer</span>
            </div>
            <i className="fas fa-chevron-right opacity-60"></i>
          </Button>

          <Button 
            onClick={() => setShowHowToPlay(true)}
            className="w-full bg-game-gold hover:bg-yellow-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200"
            data-testid="button-how-to-play"
          >
            <i className="fas fa-question-circle mr-2"></i>
            How to Play
          </Button>
        </div>
      </div>

      <HowToPlay 
        isOpen={showHowToPlay} 
        onClose={() => setShowHowToPlay(false)} 
      />
    </div>
  );
}
