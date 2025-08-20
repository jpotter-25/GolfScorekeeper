import { Player, GameState, Card, GridCard } from '@/types/game';
import { getCardValue } from './gameLogic';

export interface AIDecision {
  action: 'draw-from-discard' | 'draw-from-pile';
  gridPosition?: number;
  keepDrawn?: boolean;
}

export function makeAIDecision(gameState: GameState, aiPlayer: Player): AIDecision {
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
  
  // If position is unrevealed, reveal it and decide
  if (!gridCard.isRevealed) {
    // Generally keep drawn card if it's good (low value)
    return drawnValue <= 4 || drawnValue === -5; // A, 2-4, 5
  }
  
  // If position is revealed, compare values
  const currentValue = gridCard.card ? getCardValue(gridCard.card) : 10;
  return drawnValue < currentValue;
}

function findBestGridPosition(player: Player, cardValue: number): number {
  let bestPosition = -1;
  let highestCurrentValue = cardValue;
  
  // Look for revealed cards with higher values to replace
  for (let i = 0; i < player.grid.length; i++) {
    const gridCard = player.grid[i];
    if (gridCard.isRevealed && gridCard.card) {
      const currentValue = getCardValue(gridCard.card);
      if (currentValue > highestCurrentValue) {
        highestCurrentValue = currentValue;
        bestPosition = i;
      }
    }
  }
  
  // If no good revealed position, look for unrevealed positions
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
  // AI peeks at random positions for now
  // Could be enhanced with strategy later
  const positions = [];
  const availablePositions = Array.from({ length: 9 }, (_, i) => i);
  
  for (let i = 0; i < 2; i++) {
    const randomIndex = Math.floor(Math.random() * availablePositions.length);
    positions.push(availablePositions[randomIndex]);
    availablePositions.splice(randomIndex, 1);
  }
  
  return positions;
}

export function selectAIGridPosition(player: Player, drawnCard: Card): number {
  const drawnValue = getCardValue(drawnCard);
  
  // First, try to replace a revealed card with higher value
  for (let i = 0; i < player.grid.length; i++) {
    const gridCard = player.grid[i];
    if (gridCard.isRevealed && gridCard.card) {
      const currentValue = getCardValue(gridCard.card);
      if (drawnValue < currentValue) {
        return i;
      }
    }
  }
  
  // Otherwise, pick a random unrevealed position
  const unrevealedPositions = player.grid
    .map((gridCard, index) => ({ gridCard, index }))
    .filter(({ gridCard }) => !gridCard.isRevealed)
    .map(({ index }) => index);
  
  if (unrevealedPositions.length > 0) {
    return unrevealedPositions[Math.floor(Math.random() * unrevealedPositions.length)];
  }
  
  // Fallback to random position
  return Math.floor(Math.random() * 9);
}
