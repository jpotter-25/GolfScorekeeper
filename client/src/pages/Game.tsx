import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useGameLogic } from '@/hooks/useGameLogic';
import { GameSettings } from '@/types/game';
import GameHeader from '@/components/Game/GameHeader';
import GameTable from '@/components/Game/GameTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { calculatePlayerScore } from '@/utils/gameLogic';
import { cn } from '@/lib/utils';

export default function Game() {
  const [, setLocation] = useLocation();
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [showGameResults, setShowGameResults] = useState(false);
  const {
    gameState,
    isProcessing,
    startGame,
    drawCard,
    selectGridPosition,
    keepDrawnCard,
    keepRevealedCard,
    peekCard,
    endTurn,
    processAITurn,
    resetGame
  } = useGameLogic();

  // Initialize game from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') as 'solo' | 'pass-play' | 'online' || 'solo';
    const players = parseInt(params.get('players') || '2') as 2 | 3 | 4;
    const rounds = parseInt(params.get('rounds') || '5') as 5 | 9;

    const settings: GameSettings = { mode, playerCount: players, rounds };
    startGame(settings);
  }, [startGame]);

  // Handle AI turns
  useEffect(() => {
    if (!gameState || isProcessing) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    if (currentPlayer.isAI && gameState.gamePhase !== 'game-end') {
      const timer = setTimeout(() => {
        processAITurn(currentPlayer);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [gameState, isProcessing, processAITurn]);

  // Update scores and check for round/game end
  useEffect(() => {
    if (!gameState) return;

    // Update round scores
    gameState.players.forEach(player => {
      player.roundScore = calculatePlayerScore(player.grid);
    });

    // Check for round end
    if (gameState.roundEndTriggered && gameState.currentRound < gameState.totalRounds) {
      // End round, start next
      setTimeout(() => {
        gameState.players.forEach(player => {
          player.totalScore += player.roundScore;
          player.roundScore = 0;
        });
        // TODO: Start next round
      }, 2000);
    } else if (gameState.roundEndTriggered && gameState.currentRound >= gameState.totalRounds) {
      // Game end
      setTimeout(() => {
        setShowGameResults(true);
      }, 2000);
    }
  }, [gameState]);

  const handlePeekCard = (position: number) => {
    if (!gameState) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const revealedCount = currentPlayer.grid.filter(card => card.isRevealed).length;
    
    if (revealedCount < 2) {
      peekCard(position);
      
      // Check if peek phase is complete
      if (revealedCount === 1) {
        setTimeout(() => {
          endTurn();
        }, 500);
      }
    }
  };

  const handleCardAction = (action: 'keep-drawn' | 'keep-revealed') => {
    if (action === 'keep-drawn') {
      keepDrawnCard();
    } else {
      keepRevealedCard();
    }
    
    setTimeout(() => {
      endTurn();
    }, 1000);
  };

  const backToMenu = () => {
    resetGame();
    setLocation('/');
  };

  const playAgain = () => {
    setShowGameResults(false);
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') as 'solo' | 'pass-play' | 'online' || 'solo';
    const players = parseInt(params.get('players') || '2') as 2 | 3 | 4;
    const rounds = parseInt(params.get('rounds') || '5') as 5 | 9;

    const settings: GameSettings = { mode, playerCount: players, rounds };
    startGame(settings);
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  const sortedPlayers = [...gameState.players].sort((a, b) => a.totalScore - b.totalScore);
  const winner = sortedPlayers[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt">
      <GameHeader 
        gameState={gameState} 
        onPause={() => setShowPauseMenu(true)} 
      />

      <div className="flex-1 p-4 overflow-hidden">
        <GameTable
          gameState={gameState}
          onDrawCard={drawCard}
          onSelectGridPosition={selectGridPosition}
          onKeepDrawnCard={() => handleCardAction('keep-drawn')}
          onKeepRevealedCard={() => handleCardAction('keep-revealed')}
          onPeekCard={handlePeekCard}
        />
      </div>

      {/* Pause Menu */}
      <Dialog open={showPauseMenu} onOpenChange={setShowPauseMenu}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Game Paused</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button 
              onClick={() => setShowPauseMenu(false)} 
              className="w-full"
              data-testid="button-resume"
            >
              Resume Game
            </Button>
            <Button 
              onClick={backToMenu} 
              variant="outline" 
              className="w-full"
              data-testid="button-quit"
            >
              Quit to Menu
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Game Results */}
      <Dialog open={showGameResults} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg">
          <div className="p-8 text-center">
            <div className="mb-6">
              <i className="fas fa-crown text-game-gold text-6xl mb-4"></i>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Game Over!</h2>
              <p className="text-gray-600">Final Results</p>
            </div>

            {/* Results Table */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="space-y-3">
                {sortedPlayers.map((player, index) => (
                  <div 
                    key={player.id}
                    className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex items-center space-x-3">
                      {index === 0 && <i className="fas fa-crown text-game-gold"></i>}
                      <span className={index === 0 ? 'font-semibold' : ''}>{player.name}</span>
                    </div>
                    <span className={cn(
                      'text-xl font-bold',
                      index === 0 ? 'text-green-600' : 'text-gray-700'
                    )}>
                      {player.totalScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rewards */}
            {winner.id === 'player-0' && (
              <div className="bg-game-gold bg-opacity-10 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Rewards Earned</h3>
                <div className="flex justify-center space-x-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-game-gold">+150</div>
                    <div className="text-sm text-gray-600">XP</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-game-gold">+25</div>
                    <div className="text-sm text-gray-600">Coins</div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button 
                onClick={playAgain}
                className="w-full bg-game-gold hover:bg-yellow-500"
                data-testid="button-play-again"
              >
                Play Again
              </Button>
              <Button 
                onClick={backToMenu}
                variant="outline"
                className="w-full"
                data-testid="button-back-to-menu"
              >
                Back to Menu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
