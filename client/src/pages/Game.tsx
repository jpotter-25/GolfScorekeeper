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
  const [skipNextEndTurn, setSkipNextEndTurn] = useState(false);
  const [showTurnStart, setShowTurnStart] = useState(false);
  const [lastActivePlayer, setLastActivePlayer] = useState<number | null>(null);
  const {
    gameState,
    isProcessing,
    startGame,
    startNextRound,
    drawCard,
    selectGridPosition,
    keepDrawnCard,
    keepRevealedCard,
    directDiscardCard,
    peekCard,
    endTurn,
    processAITurn,
    resetGame
  } = useGameLogic();

  // Initialize game from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    
    // If room parameter exists, this is an online multiplayer game
    const mode = roomCode ? 'online' : 
                 (params.get('mode') as 'solo' | 'pass-play' | 'online' || 'solo');
    const players = parseInt(params.get('players') || '2') as 2 | 3 | 4;
    const rounds = parseInt(params.get('rounds') || '5') as 5 | 9;

    const settings: GameSettings = { mode, playerCount: players, rounds };
    
    // Guard against solo mode when room is present
    if (roomCode && mode !== 'online') {
      console.warn('[GUARD] Room parameter detected but mode is not online, forcing online mode');
      settings.mode = 'online';
    }
    
    startGame(settings);
  }, [startGame]);

  // Handle AI turns (only in solo mode)
  useEffect(() => {
    if (!gameState || isProcessing) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // Only process AI turns in solo mode
    if (gameState.gameMode === 'solo' && currentPlayer.isAI && gameState.gamePhase !== 'game-end') {
      // For peek phase, check if AI hasn't finished peeking yet
      if (gameState.gamePhase === 'peek') {
        const aiRevealedCount = currentPlayer.grid.filter(card => card.isRevealed).length;
        if (aiRevealedCount < 2) {
          const timer = setTimeout(() => {
            processAITurn(currentPlayer);
          }, 1000);
          return () => clearTimeout(timer);
        } else {
          // AI has finished peeking, advance turn
          const timer = setTimeout(() => {
            endTurn();
          }, 500);
          return () => clearTimeout(timer);
        }
      } else if (gameState.gamePhase === 'playing') {
        const timer = setTimeout(() => {
          processAITurn(currentPlayer);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState, isProcessing, processAITurn, endTurn]);

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
        startNextRound();
      }, 2000);
    } else if (gameState.roundEndTriggered && gameState.currentRound >= gameState.totalRounds) {
      // Game end
      setTimeout(() => {
        setShowGameResults(true);
      }, 2000);
    }
  }, [gameState]);

  // Handle direct discard event
  useEffect(() => {
    const handleDirectDiscard = () => {
      directDiscardCard();
      setTimeout(() => endTurn(), 1000);
    };
    
    window.addEventListener('directDiscard', handleDirectDiscard);
    return () => window.removeEventListener('directDiscard', handleDirectDiscard);
  }, [directDiscardCard, endTurn]);

  // Handle skip endTurn event when three-of-a-kind is detected
  useEffect(() => {
    const handleSkipEndTurn = () => {
      console.log('🎯 Received skipEndTurn event - setting flag');
      setSkipNextEndTurn(true);
    };
    
    window.addEventListener('skipEndTurn', handleSkipEndTurn);
    return () => window.removeEventListener('skipEndTurn', handleSkipEndTurn);
  }, []);

  // Handle pass-and-play turn transitions
  useEffect(() => {
    if (!gameState || gameState.gameMode !== 'pass-play') return;
    
    // Check if player changed and show turn start overlay
    if (lastActivePlayer !== null && lastActivePlayer !== gameState.currentPlayerIndex) {
      setShowTurnStart(true);
    }
    
    setLastActivePlayer(gameState.currentPlayerIndex);
  }, [gameState?.currentPlayerIndex, gameState?.gameMode, lastActivePlayer]);

  const handleTurnStart = () => {
    setShowTurnStart(false);
  };

  const handlePeekCard = (position: number) => {
    if (!gameState || gameState.gamePhase !== 'peek') return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const revealedCount = currentPlayer.grid.filter(card => card.isRevealed).length;
    
    // In solo mode, only allow human player (index 0) to peek
    // In pass-and-play mode, allow current player to peek
    if (gameState.gameMode === 'solo' && gameState.currentPlayerIndex !== 0) return;
    
    if (revealedCount < 2 && !currentPlayer.grid[position].isRevealed) {
      peekCard(position);
      
      // Check if player has finished peeking
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
    
    // Check if we should skip the automatic endTurn after the state updates
    setTimeout(() => {
      // Use a function to get the latest state at execution time
      setSkipNextEndTurn(currentSkipFlag => {
        if (currentSkipFlag) {
          console.log('🚫 Skipping endTurn because extraTurn was granted');
          return false; // Reset the flag
        } else {
          console.log('✅ No extra turn, calling endTurn normally');
          endTurn();
          return false; // Keep flag false
        }
      });
    }, 1500);
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
          onEndTurn={endTurn}
          onTurnStart={handleTurnStart}
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

      {/* Pass-and-Play Turn Start Overlay */}
      {showTurnStart && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 cursor-pointer"
          onClick={handleTurnStart}
        >
          <div className="relative">
            {/* Animated background glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-game-gold via-yellow-400 to-game-gold rounded-2xl blur-xl opacity-30 animate-pulse"></div>
            
            {/* Main content card */}
            <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border-2 border-game-gold shadow-2xl p-12 text-center transform transition-all hover:scale-105">
              {/* Crown icon */}
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-game-gold rounded-full flex items-center justify-center">
                  <span className="text-2xl">👑</span>
                </div>
              </div>
              
              {/* Player name with elegant typography */}
              <div className="mb-8">
                <div className="text-4xl font-bold bg-gradient-to-r from-game-gold to-yellow-300 bg-clip-text text-transparent mb-3">
                  {gameState?.players[gameState?.currentPlayerIndex || 0]?.name === 'You' ? 'Your Turn' : `${gameState?.players[gameState?.currentPlayerIndex || 0]?.name}'s Turn`}
                </div>
                <div className="text-slate-300 text-xl font-medium">
                  Round {(gameState?.currentRound || 0) + 1}
                </div>
              </div>
              
              {/* Call to action */}
              <div className="text-slate-400 text-lg font-medium flex items-center justify-center gap-2">
                <span className="animate-bounce">✨</span>
                Tap anywhere to begin
                <span className="animate-bounce">✨</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
