import { useState, useCallback } from 'react';
import { GameState, GameSettings, Player, Card, GameAction } from '@/types/game';
import { 
  initializeGame, 
  reshuffleIfNeeded, 
  checkThreeOfAKind, 
  calculatePlayerScore,
  shouldEndRound,
  getNextPlayerIndex,
  hasPlayerFinishedPeeking
} from '@/utils/gameLogic';
import { 
  makeAIDecision, 
  makeAIPlacementDecision, 
  selectAIPeekCards,
  selectAIGridPosition
} from '@/utils/aiLogic';

export function useGameLogic() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const startGame = useCallback((settings: GameSettings) => {
    const newGameState = initializeGame(settings);
    setGameState(newGameState);
  }, []);

  const drawCard = useCallback((source: 'draw' | 'discard') => {
    if (!gameState || gameState.drawnCard) return;

    setGameState(prevState => {
      if (!prevState) return prevState;

      let newState = { ...prevState };
      
      if (source === 'draw') {
        if (newState.drawPile.length === 0) {
          newState = reshuffleIfNeeded(newState);
        }
        if (newState.drawPile.length > 0) {
          newState.drawnCard = newState.drawPile[0];
          newState.drawPile = newState.drawPile.slice(1);
        }
      } else {
        if (newState.discardPile.length > 0) {
          newState.drawnCard = newState.discardPile[newState.discardPile.length - 1];
          newState.discardPile = newState.discardPile.slice(0, -1);
        }
      }

      return newState;
    });
  }, [gameState]);

  const selectGridPosition = useCallback((position: number) => {
    setGameState(prevState => {
      if (!prevState) return prevState;
      return {
        ...prevState,
        selectedGridPosition: position
      };
    });
  }, []);

  const keepDrawnCard = useCallback(() => {
    if (!gameState || !gameState.drawnCard || gameState.selectedGridPosition === null) return;

    setGameState(prevState => {
      if (!prevState || !prevState.drawnCard || prevState.selectedGridPosition === null) return prevState;

      const newState = { ...prevState };
      const currentPlayer = newState.players[newState.currentPlayerIndex];
      const gridPosition = prevState.selectedGridPosition;
      
      // If card at position was revealed, add it to discard pile
      if (currentPlayer.grid[gridPosition].isRevealed && currentPlayer.grid[gridPosition].card) {
        newState.discardPile = [...newState.discardPile, currentPlayer.grid[gridPosition].card!];
      }

      // Place drawn card in grid
      currentPlayer.grid[gridPosition] = {
        card: prevState.drawnCard,
        isRevealed: true,
        position: gridPosition
      };

      // Check for three of a kind
      const threeOfAKindColumns = checkThreeOfAKind(currentPlayer.grid);
      if (threeOfAKindColumns.length > 0) {
        newState.extraTurn = true;
      }

      // Clear drawn card and selection
      newState.drawnCard = null;
      newState.selectedGridPosition = null;

      return newState;
    });
  }, [gameState]);

  const keepRevealedCard = useCallback(() => {
    if (!gameState || !gameState.drawnCard || gameState.selectedGridPosition === null) return;

    setGameState(prevState => {
      if (!prevState || !prevState.drawnCard || prevState.selectedGridPosition === null) return prevState;

      const newState = { ...prevState };
      const currentPlayer = newState.players[newState.currentPlayerIndex];
      const gridPosition = prevState.selectedGridPosition;

      // Discard the drawn card
      newState.discardPile = [...newState.discardPile, prevState.drawnCard];

      // Reveal the grid card if it wasn't already
      if (!currentPlayer.grid[gridPosition].isRevealed) {
        currentPlayer.grid[gridPosition].isRevealed = true;
      }

      // Check for three of a kind
      const threeOfAKindColumns = checkThreeOfAKind(currentPlayer.grid);
      if (threeOfAKindColumns.length > 0) {
        newState.extraTurn = true;
      }

      // Clear drawn card and selection
      newState.drawnCard = null;
      newState.selectedGridPosition = null;

      return newState;
    });
  }, [gameState]);

  const peekCard = useCallback((position: number, playerIndex?: number) => {
    if (!gameState || gameState.gamePhase !== 'peek') return;

    setGameState(prevState => {
      if (!prevState) return prevState;

      const newState = { ...prevState };
      const targetPlayerIndex = playerIndex !== undefined ? playerIndex : newState.currentPlayerIndex;
      const targetPlayer = newState.players[targetPlayerIndex];
      
      // Reveal the card
      targetPlayer.grid[position].isRevealed = true;

      return newState;
    });
  }, [gameState]);

  const endTurn = useCallback(() => {
    if (!gameState) return;

    setGameState(prevState => {
      if (!prevState) return prevState;

      let newState = { ...prevState };
      
      // Check if we need to transition from peek to playing phase
      if (newState.gamePhase === 'peek') {
        const allPlayersFinishedPeeking = newState.players.every(player => 
          hasPlayerFinishedPeeking(player)
        );
        
        if (allPlayersFinishedPeeking) {
          newState.gamePhase = 'playing';
          newState.currentPlayerIndex = 0; // Start with player 0
          return newState;
        }
      }
      
      // Check if round should end (only in playing phase)
      if (newState.gamePhase === 'playing' && shouldEndRound(newState.players)) {
        newState.roundEndTriggered = true;
      }

      // If extra turn, don't advance player
      if (newState.extraTurn) {
        newState.extraTurn = false;
        return newState;
      }

      // Advance to next player
      newState.currentPlayerIndex = getNextPlayerIndex(
        newState.currentPlayerIndex, 
        newState.players.length
      );

      return newState;
    });
  }, [gameState]);

  const processAITurn = useCallback(async (aiPlayer: Player) => {
    if (!gameState || isProcessing) return;

    setIsProcessing(true);

    // Simulate thinking time
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (gameState.gamePhase === 'peek') {
      // AI peek phase - find the AI player's index
      const aiPlayerIndex = gameState.players.findIndex(p => p.id === aiPlayer.id);
      const currentRevealedCount = aiPlayer.grid.filter(card => card.isRevealed).length;
      
      // Only peek cards if the AI hasn't finished peeking yet
      if (currentRevealedCount < 2) {
        const peekPositions = selectAIPeekCards(aiPlayer).slice(0, 2 - currentRevealedCount);
        
        for (const position of peekPositions) {
          peekCard(position, aiPlayerIndex);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else if (gameState.gamePhase === 'playing') {
      // AI playing phase
      const decision = makeAIDecision(gameState, aiPlayer);
      
      // Draw card
      drawCard(decision.action === 'draw-from-discard' ? 'discard' : 'draw');
      await new Promise(resolve => setTimeout(resolve, 800));

      // Select grid position
      const drawnCard = gameState.drawnCard;
      if (drawnCard) {
        const gridPosition = decision.gridPosition ?? selectAIGridPosition(aiPlayer, drawnCard);
        selectGridPosition(gridPosition);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Make placement decision
        const shouldKeepDrawn = makeAIPlacementDecision(gameState, aiPlayer, drawnCard, gridPosition);
        if (shouldKeepDrawn) {
          keepDrawnCard();
        } else {
          keepRevealedCard();
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      endTurn();
    }

    setIsProcessing(false);
  }, [gameState, isProcessing, peekCard, drawCard, selectGridPosition, keepDrawnCard, keepRevealedCard, endTurn]);

  const resetGame = useCallback(() => {
    setGameState(null);
  }, []);

  return {
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
  };
}
