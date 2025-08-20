import { Player, GameState, Card, GridCard } from '@/types/game';
import { getCardValue } from './gameLogic';

export interface AIDecision {
  action: 'draw-from-discard' | 'draw-from-pile';
  gridPosition?: number;
  keepDrawn?: boolean;
}

export function makeAIDecision(gameState: GameState, aiPlayer: Player): AIDecision {
  // During extra turn, AI must draw from draw pile only
  if (gameState.extraTurn) {
    return {
      action: 'draw-from-pile'
    };
  }
  
  const discardCard = gameState.discardPile[gameState.discardPile.length - 1];
  const discardValue = getCardValue(discardCard);
  
  // Check if discard card is low value (good card)
  const isDiscardGoodCard = discardValue <= 1 || discardValue === -5; // A, 2-4, 5, K
  
  // Find best position to place a good card
  if (isDiscardGoodCard) {
    const bestPosition = findBestGridPosition(aiPlayer, discardValue);
    if (bestPosition !== -1) {
      return {
        action: 'draw-from-discard',
        gridPosition: bestPosition,
        keepDrawn: true
      };
    }
  }
  
  // Otherwise, draw from pile and make decision based on what we get
  return {
    action: 'draw-from-pile'
  };
}

export function makeAIPlacementDecision(
  gameState: GameState, 
  aiPlayer: Player, 
  drawnCard: Card, 
  selectedPosition: number
): boolean {
  const drawnValue = getCardValue(drawnCard);
  const gridCard = aiPlayer.grid[selectedPosition];
  
  // If position is unrevealed, we need to decide based on card quality
  if (!gridCard.isRevealed) {
    // Keep very good cards (A=1, 5=-5, K=0)
    if (drawnValue === 1 || drawnValue === -5 || drawnValue === 0) {
      return true;
    }
    // Keep decent cards (2, 3, 4) most of the time
    if (drawnValue <= 4) {
      return true;
    }
    // Don't keep bad cards (7, 8, 9, 10, J, Q)
    return false;
  }
  
  // If position is revealed, always choose the better card
  const currentValue = gridCard.card ? getCardValue(gridCard.card) : 10;
  return drawnValue < currentValue;
}

function findBestGridPosition(player: Player, cardValue: number): number {
  let bestPosition = -1;
  let worstValue = cardValue;
  
  // Find the WORST revealed card that's worse than our new card
  for (let i = 0; i < player.grid.length; i++) {
    const gridCard = player.grid[i];
    if (gridCard.isRevealed && gridCard.card) {
      const currentValue = getCardValue(gridCard.card);
      // Only consider replacing if the current card is worse than what we're placing
      if (currentValue > cardValue && currentValue > worstValue) {
        worstValue = currentValue;
        bestPosition = i;
      }
    }
  }
  
  // If no good revealed position and our card is very good, try unrevealed positions
  if (bestPosition === -1 && (cardValue <= 1 || cardValue === -5)) {
    for (let i = 0; i < player.grid.length; i++) {
      if (!player.grid[i].isRevealed) {
        bestPosition = i;
        break;
      }
    }
  }
  
  return bestPosition;
}

export function selectAIPeekCards(player: Player): number[] {
  // AI peeks at random positions that haven't been revealed yet
  const positions = [];
  const availablePositions = Array.from({ length: 9 }, (_, i) => i)
    .filter(pos => !player.grid[pos].isRevealed);
  
  const cardsToReveal = Math.min(2, availablePositions.length);
  
  for (let i = 0; i < cardsToReveal; i++) {
    const randomIndex = Math.floor(Math.random() * availablePositions.length);
    positions.push(availablePositions[randomIndex]);
    availablePositions.splice(randomIndex, 1);
  }
  
  return positions;
}

export function selectAIGridPosition(player: Player, drawnCard: Card): number {
  const drawnValue = getCardValue(drawnCard);
  
  let bestPosition = -1;
  let worstValueFound = drawnValue;
  
  // Find the WORST revealed card that we can improve upon
  for (let i = 0; i < player.grid.length; i++) {
    const gridCard = player.grid[i];
    if (gridCard.isRevealed && gridCard.card) {
      const currentValue = getCardValue(gridCard.card);
      // Only consider positions where we'd improve the score
      if (drawnValue < currentValue && currentValue > worstValueFound) {
        worstValueFound = currentValue;
        bestPosition = i;
      }
    }
  }
  
  // If we found a good position to replace, use it
  if (bestPosition !== -1) {
    return bestPosition;
  }
  
  // If the drawn card is very good (A, 2, 3, 4, 5, K), try unrevealed positions
  if (drawnValue <= 4 || drawnValue === -5 || drawnValue === 0) {
    const unrevealedPositions = player.grid
      .map((gridCard, index) => ({ gridCard, index }))
      .filter(({ gridCard }) => !gridCard.isRevealed)
      .map(({ index }) => index);
    
    if (unrevealedPositions.length > 0) {
      return unrevealedPositions[Math.floor(Math.random() * unrevealedPositions.length)];
    }
  }
  
  // Fallback to random position if we have no better choice
  return Math.floor(Math.random() * 9);
}
