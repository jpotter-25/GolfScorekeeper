import { GameState } from '@/types/game';
import { getCardDisplayValue } from '@/utils/gameLogic';
import PlayerGrid from './PlayerGrid';
import OpponentGrid from './OpponentGrid';
import Card from './Card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GameTableProps {
  gameState: GameState;
  onDrawCard: (source: 'draw' | 'discard') => void;
  onSelectGridPosition: (position: number) => void;
  onKeepDrawnCard: () => void;
  onKeepRevealedCard: () => void;
  onPeekCard: (position: number) => void;
}

export default function GameTable({
  gameState,
  onDrawCard,
  onSelectGridPosition,
  onKeepDrawnCard,
  onKeepRevealedCard,
  onPeekCard
}: GameTableProps) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const humanPlayer = gameState.players[0];
  const aiPlayers = gameState.players.filter((_, index) => index !== 0);
  const isPlayerTurn = gameState.currentPlayerIndex === 0;

  const getAIPlayerLayout = () => {
    switch (aiPlayers.length) {
      case 1:
        return 'flex justify-center';
      case 2:
        return 'flex justify-between px-8';
      case 3:
        return 'grid grid-cols-3 gap-4 justify-items-center';
      default:
        return 'flex justify-center';
    }
  };

  const canDrawCard = gameState.gamePhase === 'playing' && isPlayerTurn && !gameState.drawnCard;
  const canDrawFromDiscard = canDrawCard && !gameState.extraTurn; // Can't draw from discard during extra turn
  const canMakeChoice = gameState.drawnCard && gameState.selectedGridPosition !== null;

  return (
    <div className="h-full max-w-6xl mx-auto">
      {/* AI Player Grids - Always visible */}
      <div className={cn('mb-6', getAIPlayerLayout())} data-testid="opponent-grids">
        {aiPlayers.map((aiPlayer, index) => (
          <OpponentGrid
            key={aiPlayer.id}
            player={aiPlayer}
            isCurrentPlayer={gameState.players[gameState.currentPlayerIndex].id === aiPlayer.id}
            className="transform scale-75 md:scale-90"
          />
        ))}
      </div>

      {/* Center Area: Draw & Discard Piles */}
      <div className="flex justify-center items-center mb-6">
        <div className="flex items-center space-x-8">
          {/* Draw Pile */}
          <div className="text-center">
            <div className="text-white text-sm mb-2">Draw Pile</div>
            <div className="relative">
              <div 
                className={cn(
                  'card-pile w-16 h-24 bg-card-back rounded-lg border-2 border-white border-opacity-30 cursor-pointer transition-colors',
                  canDrawCard && 'hover:border-highlight-blue',
                  !canDrawCard && 'opacity-50 cursor-not-allowed'
                )}
                onClick={canDrawCard ? () => onDrawCard('draw') : undefined}
                data-testid="button-draw-pile"
              >
                <div className="absolute inset-0 bg-black bg-opacity-20 rounded-lg"></div>
                <div className="absolute inset-0 bg-black bg-opacity-10 rounded-lg transform translate-x-0.5 translate-y-0.5"></div>
              </div>
              
              {/* Active drawn card overlay */}
              {gameState.drawnCard && (
                <div className="absolute inset-0 bg-white rounded-lg border-2 border-highlight-blue flex items-center justify-center text-black font-bold text-lg" data-testid="card-drawn">
                  {getCardDisplayValue(gameState.drawnCard)}
                </div>
              )}
            </div>
          </div>

          {/* Discard Pile */}
          <div className="text-center">
            <div className="text-white text-sm mb-2">Discard Pile</div>
            <Card
              card={gameState.discardPile[gameState.discardPile.length - 1]}
              isRevealed={true}
              size="medium"
              onClick={canDrawFromDiscard ? () => onDrawCard('discard') : undefined}
              className={cn(
                canDrawFromDiscard && 'cursor-pointer hover:border-highlight-blue',
                !canDrawFromDiscard && 'opacity-50 cursor-not-allowed',
                gameState.extraTurn && 'opacity-30' // Extra visual indication during extra turn
              )}
              data-testid="button-discard-pile"
            />
            {gameState.extraTurn && (
              <div className="text-xs text-yellow-400 mt-1 font-medium">
                Extra Turn: Draw Pile Only
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Human Player's Grid - Always visible */}
      <PlayerGrid
        player={humanPlayer}
        isCurrentPlayer={isPlayerTurn}
        selectedPosition={gameState.selectedGridPosition}
        onCardClick={gameState.gamePhase === 'peek' ? onPeekCard : 
                    (gameState.drawnCard ? onSelectGridPosition : undefined)}
      />

      {/* Game Actions */}
      {gameState.gamePhase === 'playing' && (
        <div className="bg-game-felt border-t border-white border-opacity-10 p-4 mt-6">
          <div className="max-w-2xl mx-auto">
            {gameState.drawnCard && (
              <>
                <div className="text-center text-white mb-3">
                  <div className="text-sm opacity-80">
                    {gameState.selectedGridPosition !== null 
                      ? 'Choose to keep the drawn card or the revealed card'
                      : 'Select a card slot to place your drawn card'
                    }
                  </div>
                </div>
                <div className="flex justify-center space-x-4">
                  <Button
                    variant="destructive"
                    onClick={onKeepRevealedCard}
                    disabled={!canMakeChoice}
                    data-testid="button-keep-revealed"
                  >
                    <i className="fas fa-times mr-2"></i>
                    Discard Drawn
                  </Button>
                  <Button
                    className="bg-game-gold hover:bg-yellow-500"
                    onClick={onKeepDrawnCard}
                    disabled={!canMakeChoice}
                    data-testid="button-keep-drawn"
                  >
                    <i className="fas fa-check mr-2"></i>
                    Keep Drawn
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Peek Phase Instructions */}
      {gameState.gamePhase === 'peek' && (
        <div className="bg-game-felt border-t border-white border-opacity-10 p-4 mt-6">
          <div className="text-center text-white">
            <div className="text-sm opacity-80">
              Click on 2 cards to reveal them before the game begins
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
