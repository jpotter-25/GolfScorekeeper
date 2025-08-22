import { useState, useCallback } from 'react';
import { GameState, GameSettings, Player, Card, GameAction } from '@/types/game';
import { 
  initializeGame, 
  reshuffleIfNeeded, 
  checkThreeOfAKind, 
  processThreeOfAKind,
  calculatePlayerScore,
  shouldEndRound,
  getNextPlayerIndex,
  hasPlayerFinishedPeeking,
  getCardValue,
  createPlayerGrid,
  createDeck,
  shuffleDeck
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

  const startNextRound = useCallback(() => {
    if (!gameState) return;

    setGameState(prevState => {
      if (!prevState) return prevState;

      // Calculate and add final scores for the round
      const newState = { ...prevState };
      newState.players.forEach(player => {
        // Reveal all remaining unrevealed cards at round end
        player.grid.forEach(gridCard => {
          if (!gridCard.isRevealed && gridCard.card && !gridCard.isDisabled) {
            gridCard.isRevealed = true;
          }
        });
        
        // Calculate and add round score to total
        player.roundScore = calculatePlayerScore(player.grid);
        player.totalScore += player.roundScore;
      });

      // Reset for next round
      newState.currentRound += 1;
      newState.roundEndTriggered = false;
      newState.roundEndingPlayer = undefined;
      newState.currentPlayerIndex = 0;
      newState.gamePhase = 'peek';
      newState.drawnCard = null;
      newState.selectedGridPosition = null;
      newState.extraTurn = false;
      newState.hasRevealedCardThisTurn = false;

      // Create new deck and deal cards
      const deck = createDeck();
      let deckIndex = 0;

      // Reset all players' grids and scores
      newState.players.forEach(player => {
        player.grid = createPlayerGrid();
        player.roundScore = 0;
        player.isActive = player.id === 'player-0';

        // Deal 9 cards to each player
        for (let i = 0; i < 9; i++) {
          player.grid[i].card = deck[deckIndex++];
        }
      });

      // Set up new draw and discard piles
      newState.drawPile = deck.slice(deckIndex + 1);
      newState.discardPile = [deck[deckIndex]];

      return newState;
    });
  }, [gameState]);

  const drawCard = useCallback((source: 'draw' | 'discard') => {
    if (!gameState || gameState.drawnCard) return;

    // Prevent drawing from discard during extra turn
    if (source === 'discard' && gameState.extraTurn) {
      console.log('BLOCKED: Cannot draw from discard during extra turn');
      return;
    }

    setGameState(prevState => {
      if (!prevState) return prevState;

      // Double-check the extra turn restriction in state update
      if (source === 'discard' && prevState.extraTurn) {
        console.log('BLOCKED: Cannot draw from discard during extra turn (state check)');
        return prevState;
      }

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
      
      const currentPlayer = prevState.players[prevState.currentPlayerIndex];
      
      // Prevent selecting disabled positions
      if (currentPlayer.grid[position].isDisabled) {
        return prevState;
      }
      
      // During playing phase, only allow revelation if:
      // 1. Player has drawn a card
      // 2. No card has been revealed this turn yet
      // 3. The position is not already revealed
      if (prevState.gamePhase === 'playing') {
        if (!prevState.drawnCard) {
          return prevState; // Can't select position without drawing first
        }
        if (prevState.hasRevealedCardThisTurn && !currentPlayer.grid[position].isRevealed) {
          return prevState; // Already revealed a card this turn, can't reveal another
        }
      }
      
      const newState = { ...prevState };
      newState.selectedGridPosition = position;
      
      // During playing phase with a drawn card, reveal the selected card so player can make informed decision
      if (newState.gamePhase === 'playing' && newState.drawnCard) {
        if (!currentPlayer.grid[position].isRevealed) {
          currentPlayer.grid[position].isRevealed = true;
          newState.hasRevealedCardThisTurn = true;
        }
      }
      
      return newState;
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

      // Place drawn card in grid and reveal this position (preserve isDisabled state)
      currentPlayer.grid[gridPosition] = {
        card: prevState.drawnCard,
        isRevealed: true,
        position: gridPosition,
        isDisabled: currentPlayer.grid[gridPosition].isDisabled || false
      };

      // Process three of a kind
      const threeOfAKindResult = processThreeOfAKind(currentPlayer.grid, newState.discardPile);
      if (threeOfAKindResult.hasThreeOfAKind) {
        console.log('THREE OF A KIND DETECTED in keepDrawnCard - Setting extraTurn = true');
        currentPlayer.grid = threeOfAKindResult.updatedGrid;
        newState.discardPile = threeOfAKindResult.updatedDiscardPile;
        newState.extraTurn = true;
      }

      // Check if round should end immediately after placing card
      // BUT if player got three-of-a-kind, they get extra turn even if all cards are revealed
      if (shouldEndRound(newState.players) && !newState.extraTurn) {
        newState.roundEndTriggered = true;
        newState.roundEndingPlayer = newState.currentPlayerIndex;
        
        // Reveal all remaining unrevealed cards when round ends
        newState.players.forEach(player => {
          player.grid.forEach(gridCard => {
            if (!gridCard.isRevealed && gridCard.card && !gridCard.isDisabled) {
              gridCard.isRevealed = true;
            }
          });
        });
      }

      // Clear drawn card and selection
      newState.drawnCard = null;
      newState.selectedGridPosition = null;
      newState.hasRevealedCardThisTurn = false;

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

      // The grid card should already be revealed from selectGridPosition
      // No need to reveal again here

      // Process three of a kind
      const threeOfAKindResult = processThreeOfAKind(currentPlayer.grid, newState.discardPile);
      if (threeOfAKindResult.hasThreeOfAKind) {
        console.log('THREE OF A KIND DETECTED in keepRevealedCard - Setting extraTurn = true');
        currentPlayer.grid = threeOfAKindResult.updatedGrid;
        newState.discardPile = threeOfAKindResult.updatedDiscardPile;
        newState.extraTurn = true;
      }

      // Check if round should end immediately after revealing card
      // BUT if player got three-of-a-kind, they get extra turn even if all cards are revealed
      if (shouldEndRound(newState.players) && !newState.extraTurn) {
        newState.roundEndTriggered = true;
        newState.roundEndingPlayer = newState.currentPlayerIndex;
        
        // Reveal all remaining unrevealed cards when round ends
        newState.players.forEach(player => {
          player.grid.forEach(gridCard => {
            if (!gridCard.isRevealed && gridCard.card && !gridCard.isDisabled) {
              gridCard.isRevealed = true;
            }
          });
        });
      }

      // Clear drawn card and selection
      newState.drawnCard = null;
      newState.selectedGridPosition = null;
      newState.hasRevealedCardThisTurn = false;

      return newState;
    });
  }, [gameState]);

  const directDiscardCard = useCallback(() => {
    if (!gameState || !gameState.drawnCard) return;

    setGameState(prevState => {
      if (!prevState || !prevState.drawnCard) return prevState;

      const newState = { ...prevState };
      
      // Simply discard the drawn card without revealing any grid cards
      newState.discardPile = [...newState.discardPile, prevState.drawnCard];
      
      // Check if round should end immediately (though direct discard shouldn't trigger this)
      if (shouldEndRound(newState.players)) {
        newState.roundEndTriggered = true;
      }
      
      // Clear drawn card and selection
      newState.drawnCard = null;
      newState.selectedGridPosition = null;
      newState.hasRevealedCardThisTurn = false;

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
      // BUT if player got three-of-a-kind, they get extra turn even if all cards are revealed
      if (newState.gamePhase === 'playing' && shouldEndRound(newState.players) && !newState.extraTurn) {
        newState.roundEndTriggered = true;
        newState.roundEndingPlayer = newState.currentPlayerIndex;
        
        // Reveal all remaining unrevealed cards when round ends
        newState.players.forEach(player => {
          player.grid.forEach(gridCard => {
            if (!gridCard.isRevealed && gridCard.card && !gridCard.isDisabled) {
              gridCard.isRevealed = true;
            }
          });
        });
      }

      // If round ended, check if all other players have had their final turn
      if (newState.roundEndTriggered && newState.roundEndingPlayer !== undefined) {
        // Check if we've cycled back to the player who triggered the round end
        // If so, the round is complete
        if (newState.currentPlayerIndex === newState.roundEndingPlayer) {
          // Don't advance further, round should end
          return newState;
        }
      }

      // If extra turn, don't advance player
      if (newState.extraTurn) {
        newState.extraTurn = false;
        return newState;
      }

      // Clear any drawn card and selection when advancing to next player
      newState.drawnCard = null;
      newState.selectedGridPosition = null;
      newState.hasRevealedCardThisTurn = false;

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

    try {
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
        
        // End turn after peeking
        setTimeout(() => endTurn(), 500);
      } else if (gameState.gamePhase === 'playing') {
        // AI playing phase
        const decision = makeAIDecision(gameState, aiPlayer);
        
        // Draw card first
        drawCard(decision.action === 'draw-from-discard' ? 'discard' : 'draw');
        
        // Wait for card to be drawn and state to update, then continue with turn
        setTimeout(() => {
          setGameState(currentState => {
            if (!currentState || !currentState.drawnCard) return currentState;
            
            const drawnCard = currentState.drawnCard;
            const newState = { ...currentState };
            const currentPlayer = newState.players[newState.currentPlayerIndex];
            
            // Check if AI has only one face-down card left
            const faceDownCount = currentPlayer.grid.filter(card => !card.isRevealed).length;
            
            if (faceDownCount === 1) {
              // AI can choose to directly discard if the drawn card is bad
              const drawnValue = getCardValue(drawnCard);
              if (drawnValue >= 7) { // Bad card (7, 8, 9, 10, J, Q), just discard it
                newState.discardPile = [...newState.discardPile, drawnCard];
                newState.drawnCard = null;
                newState.selectedGridPosition = null;
                setTimeout(() => endTurn(), 800);
                return newState;
              }
            }
            
            // Use current player state for grid position selection
            const gridPosition = decision.gridPosition ?? selectAIGridPosition(currentPlayer, drawnCard);
            
            // Store the original card at this position before any changes
            const originalCard = currentPlayer.grid[gridPosition].card;
            const wasRevealed = currentPlayer.grid[gridPosition].isRevealed;
            
            // Reveal the grid card if it's not already revealed
            if (!currentPlayer.grid[gridPosition].isRevealed) {
              currentPlayer.grid[gridPosition].isRevealed = true;
            }
            
            // Make placement decision using the updated current player state
            const shouldKeepDrawn = makeAIPlacementDecision(newState, currentPlayer, drawnCard, gridPosition);
            
            if (shouldKeepDrawn) {
              // Keep drawn card - place it in grid, discard the original grid card if it exists
              if (originalCard && (wasRevealed || currentPlayer.grid[gridPosition].isRevealed)) {
                newState.discardPile = [...newState.discardPile, originalCard];
              }
              currentPlayer.grid[gridPosition] = {
                card: drawnCard,
                isRevealed: true,
                position: gridPosition
              };
            } else {
              // Keep revealed card - discard the drawn card
              newState.discardPile = [...newState.discardPile, drawnCard];
            }
            
            // Process three of a kind
            const threeOfAKindResult = processThreeOfAKind(currentPlayer.grid, newState.discardPile);
            if (threeOfAKindResult.hasThreeOfAKind) {
              currentPlayer.grid = threeOfAKindResult.updatedGrid;
              newState.discardPile = threeOfAKindResult.updatedDiscardPile;
              newState.extraTurn = true;
            }
            
            // Check if round should end immediately after AI action
            // BUT if AI got three-of-a-kind, they get extra turn even if all cards are revealed
            if (shouldEndRound(newState.players) && !newState.extraTurn) {
              newState.roundEndTriggered = true;
              newState.roundEndingPlayer = newState.currentPlayerIndex;
              
              // Reveal all remaining unrevealed cards when round ends
              newState.players.forEach(player => {
                player.grid.forEach(gridCard => {
                  if (!gridCard.isRevealed && gridCard.card && !gridCard.isDisabled) {
                    gridCard.isRevealed = true;
                  }
                });
              });
            }
            
            // Clear drawn card and selection
            newState.drawnCard = null;
            newState.selectedGridPosition = null;
            newState.hasRevealedCardThisTurn = false;
            
            // End turn after a delay
            setTimeout(() => endTurn(), 800);
            
            return newState;
          });
        }, 800);
      }
    } finally {
      // Clear processing flag after a delay to ensure all actions complete
      setTimeout(() => setIsProcessing(false), 3000);
    }
  }, [gameState, isProcessing, peekCard, drawCard, selectGridPosition, keepDrawnCard, keepRevealedCard, endTurn, setGameState]);

  const resetGame = useCallback(() => {
    setGameState(null);
  }, []);

  return {
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
  };
}
