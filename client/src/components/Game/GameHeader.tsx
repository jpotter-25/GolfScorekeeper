import { GameState } from '@/types/game';
import { Button } from '@/components/ui/button';

interface GameHeaderProps {
  gameState: GameState;
  onPause: () => void;
}

export default function GameHeader({ gameState, onPause }: GameHeaderProps) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="bg-game-felt border-b border-white border-opacity-10 px-4 py-3">
      <div className="flex justify-between items-center">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onPause}
          className="text-white hover:text-game-gold"
          data-testid="button-pause"
        >
          <i className="fas fa-pause text-xl"></i>
        </Button>
        
        <div className="text-center text-white">
          <div className="font-semibold">
            Round <span data-testid="text-current-round">{gameState.currentRound}</span> / <span data-testid="text-total-rounds">{gameState.totalRounds}</span>
          </div>
          <div className="text-sm opacity-80">
            Current Player: <span data-testid="text-current-player">{currentPlayer.name}</span>
          </div>
        </div>

        <div className="text-white text-right">
          <div className="font-semibold">Score</div>
          <div className="text-lg" data-testid="text-current-player-score">
            {currentPlayer.totalScore}
          </div>
        </div>
      </div>
    </div>
  );
}
