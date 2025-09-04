import React from 'react';
import { GameState } from '@/types/game';
import { getCardDisplayValue } from '@/utils/gameLogic';
import PlayerGrid from './PlayerGrid';
import OpponentGrid from './OpponentGrid';
import Card from './Card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCosmetics } from '@/hooks/useCosmetics';
import { getCosmeticAsset } from '@/utils/cosmeticAssets';

interface GameTableProps {
  gameState: GameState;
  onDrawCard: (source: 'draw' | 'discard') => void;
  onSelectGridPosition: (position: number) => void;
  onKeepDrawnCard: () => void;
  onKeepRevealedCard: () => void;
  onPeekCard: (position: number) => void;
  onEndTurn: () => void;
  onTurnStart?: () => void;
}

export default function GameTable({
  gameState,
  onDrawCard,
  onSelectGridPosition,
  onKeepDrawnCard,
  onKeepRevealedCard,
  onPeekCard,
  onEndTurn,
  onTurnStart
}: GameTableProps) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const { getTableThemeStyle } = useCosmetics();
  
  // Handle different game modes
  let humanPlayer, aiPlayers, isPlayerTurn;
  
  if (gameState.gameMode === 'pass-play') {
    // In pass-and-play mode, the current player is always the "human" player in main grid
    humanPlayer = currentPlayer;
    aiPlayers = gameState.players.filter((_, index) => index !== gameState.currentPlayerIndex);
    isPlayerTurn = true; // Always true in pass-and-play since current player is always active
  } else if (gameState.gameMode === 'online') {
    // Online multiplayer mode: Show all players including empty seats
    // For now, assume player 0 is the current user (this should be improved to use actual user ID)
    humanPlayer = gameState.players[0];
    // Show all other players/seats (including empty ones)
    aiPlayers = gameState.players.filter((_, index) => index !== 0);
    
    // Check if it's the human player's turn (only considering active players)
    const activePlayers = gameState.players.filter((p: any) => !p.isEmpty);
    const currentActivePlayer = activePlayers[gameState.currentPlayerIndex];
    isPlayerTurn = currentActivePlayer && currentActivePlayer.id === humanPlayer.id;
  } else {
    // Solo mode: Player 0 is human, others are AI
    humanPlayer = gameState.players[0];
    aiPlayers = gameState.players.filter((_, index) => index !== 0);
    isPlayerTurn = gameState.currentPlayerIndex === 0;
  }

  const getOpponentPlayerLayout = () => {
    const opponentCount = aiPlayers.length;
    switch (opponentCount) {
      case 0:
        return 'hidden'; // No opponents to show
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

  const canDrawCard = gameState.gamePhase === 'playing' && isPlayerTurn && !gameState.drawnCard && !gameState.roundEndTriggered;
  const canDrawFromDiscard = canDrawCard && !gameState.extraTurn; // Can't draw from discard during extra turn
  
  // Debug logging
  React.useEffect(() => {
    if (gameState.extraTurn) {
      console.log('EXTRA TURN ACTIVE - Discard pile should be disabled');
      console.log('canDrawFromDiscard:', canDrawFromDiscard);
      console.log('gameState.extraTurn:', gameState.extraTurn);
    }
  }, [gameState.extraTurn, canDrawFromDiscard]);
  const canMakeChoice = gameState.drawnCard && gameState.selectedGridPosition !== null && !gameState.roundEndTriggered;
  
  // Special rule: if player has only one face-down card left at start of turn, they can discard directly
  const humanPlayerFaceDownCount = humanPlayer.grid.filter(card => !card.isRevealed && !card.isDisabled).length;
  // Only show direct discard if: has drawn card, has 1 face-down card, no position selected yet, and round hasn't ended
  const canDiscardDirectly = gameState.drawnCard && humanPlayerFaceDownCount === 1 && isPlayerTurn && gameState.selectedGridPosition === null && !gameState.roundEndTriggered;

  const tableThemeStyle = getTableThemeStyle();
  const tableAsset = getCosmeticAsset(tableThemeStyle.cosmeticId || 'green_felt');
  

  
  return (
    <div 
      className="h-full max-w-6xl mx-auto relative rounded-lg overflow-hidden"
      style={tableAsset ? {
        backgroundImage: `url(${tableAsset})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      } : {
        background: tableThemeStyle.background,
        backgroundImage: tableThemeStyle.texture !== 'none' ? tableThemeStyle.texture : undefined
      }}
    >
      {/* Opponent Player Grids - Other players in pass-and-play or AI players in solo */}
      <div className={cn('mb-6', getOpponentPlayerLayout())} data-testid="opponent-grids">
        {aiPlayers.map((aiPlayer, index) => (
          <OpponentGrid
            key={aiPlayer.id}
            player={aiPlayer}
            isCurrentPlayer={gameState.players[gameState.currentPlayerIndex].id === aiPlayer.id}
            className=""
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
              isDisabled={!canDrawFromDiscard || gameState.extraTurn}
              className={cn(
                canDrawFromDiscard && !gameState.extraTurn && 'cursor-pointer hover:border-highlight-blue',
                (!canDrawFromDiscard || gameState.extraTurn) && 'opacity-30 cursor-not-allowed'
              )}
              data-testid="button-discard-pile"
            />
          </div>
        </div>
      </div>

      {/* Human Player's Grid - Always visible */}
      <PlayerGrid
        player={humanPlayer}
        isCurrentPlayer={isPlayerTurn}
        selectedPosition={gameState.selectedGridPosition}
        onCardClick={gameState.gamePhase === 'peek' ? onPeekCard : 
                    (gameState.gamePhase === 'playing' && gameState.drawnCard && !gameState.roundEndTriggered ? onSelectGridPosition : undefined)}
      />

      {/* Game Actions - Fixed Height Container */}
      <div className="bg-game-felt border-t border-white border-opacity-10 p-4 mt-6 min-h-[140px]">
        <div className="max-w-2xl mx-auto h-full flex flex-col justify-center">
          {gameState.gamePhase === 'playing' && gameState.drawnCard && (
            <>
              <div className="text-center text-white mb-3">
                <div className="text-sm opacity-80">
                  {gameState.roundEndTriggered
                    ? 'Round ended! All players get one final turn.'
                    : canDiscardDirectly
                      ? 'With only 1 face-down card left, you can discard directly or place the card'
                      : gameState.selectedGridPosition !== null 
                        ? 'Choose to keep the drawn card or the revealed card'
                        : 'Select a card slot to place your drawn card (you can only reveal one card per turn)'
                  }
                </div>
              </div>
              <div className="flex justify-center space-x-4">
                {canDiscardDirectly && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      // Directly discard the drawn card without revealing anything
                      const event = new CustomEvent('directDiscard');
                      window.dispatchEvent(event);
                    }}
                    data-testid="button-direct-discard"
                  >
                    <i className="fas fa-trash mr-2"></i>
                    Discard Card
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={onKeepRevealedCard}
                  disabled={!canMakeChoice}
                  data-testid="button-keep-revealed"
                >
                  <i className="fas fa-times mr-2"></i>
                  {canMakeChoice ? 'Discard Drawn' : 'Discard Drawn'}
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
          
          {gameState.gamePhase === 'playing' && gameState.gameMode === 'pass-play' && !gameState.drawnCard && (
            <div className="text-center">
              <Button
                onClick={onEndTurn}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                data-testid="button-end-turn"
              >
                End Turn & Pass Device
              </Button>
            </div>
          )}

          {gameState.gamePhase === 'peek' && (
            <div className="text-center text-white">
              <div className="text-sm opacity-80">
                Click on 2 cards to reveal them before the game begins
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
