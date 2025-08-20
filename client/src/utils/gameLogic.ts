import { Card, GridCard, Player, GameState, GameSettings } from '@/types/game';

// Card deck generation
export function createDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values: Card['value'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];

  // Create two standard decks for Golf 9
  for (let deckNum = 0; deckNum < 2; deckNum++) {
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          suit,
          value,
          id: `${suit}-${value}-${deckNum}`
        });
      }
    }
  }

  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Card value calculation
export function getCardValue(card: Card): number {
  switch (card.value) {
    case 'A': return 1;
    case '2': case '3': case '4': case '6': case '7': case '8': case '9': case '10':
      return parseInt(card.value);
    case '5': return -5;
    case 'J': case 'Q': return 10;
    case 'K': return 0;
    default: return 0;
  }
}

// Initialize player grid
export function createPlayerGrid(): GridCard[] {
  return Array.from({ length: 9 }, (_, index) => ({
    card: null,
    isRevealed: false,
    position: index
  }));
}

// Create initial game state
export function initializeGame(settings: GameSettings): GameState {
  const deck = createDeck();
  const players: Player[] = [];

  // Create players based on settings
  for (let i = 0; i < settings.playerCount; i++) {
    const isAI = settings.mode === 'solo' && i > 0;
    players.push({
      id: `player-${i}`,
      name: i === 0 ? 'You' : isAI ? `AI Player ${i}` : `Player ${i + 1}`,
      isAI,
      grid: createPlayerGrid(),
      roundScore: 0,
      totalScore: 0,
      isActive: i === 0,
      avatar: i === 0 ? 'P1' : 'AI'
    });
  }

  // Deal cards to players (9 cards each)
  let deckIndex = 0;
  for (const player of players) {
    for (let i = 0; i < 9; i++) {
      player.grid[i].card = deck[deckIndex++];
    }
  }

  // Set up draw and discard piles
  const drawPile = deck.slice(deckIndex + 1);
  const discardPile = [deck[deckIndex]];

  return {
    players,
    currentPlayerIndex: 0,
    currentRound: 1,
    totalRounds: settings.rounds,
    drawPile,
    discardPile,
    gamePhase: 'peek',
    drawnCard: null,
    selectedGridPosition: null,
    gameMode: settings.mode,
    roundEndTriggered: false,
    extraTurn: false
  };
}

// Check for three of a kind in columns
export function checkThreeOfAKind(grid: GridCard[]): number[] {
  const columns = [
    [0, 3, 6], // Column 1
    [1, 4, 7], // Column 2
    [2, 5, 8]  // Column 3
  ];

  const threeOfAKindColumns: number[] = [];

  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    const columnPositions = columns[colIndex];
    const revealedCards = columnPositions
      .filter(pos => grid[pos].isRevealed && grid[pos].card)
      .map(pos => grid[pos].card!);

    if (revealedCards.length === 3) {
      const values = revealedCards.map(card => card.value);
      if (values[0] === values[1] && values[1] === values[2]) {
        threeOfAKindColumns.push(colIndex);
      }
    }
  }

  return threeOfAKindColumns;
}

// Calculate player score
export function calculatePlayerScore(grid: GridCard[]): number {
  const threeOfAKindColumns = checkThreeOfAKind(grid);
  let score = 0;

  const columns = [
    [0, 3, 6], // Column 1
    [1, 4, 7], // Column 2
    [2, 5, 8]  // Column 3
  ];

  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    if (threeOfAKindColumns.includes(colIndex)) {
      // Three of a kind column = 0 points
      continue;
    }

    const columnPositions = columns[colIndex];
    for (const pos of columnPositions) {
      if (grid[pos].isRevealed && grid[pos].card) {
        score += getCardValue(grid[pos].card);
      }
    }
  }

  return score;
}

// Check if round should end
export function shouldEndRound(players: Player[]): boolean {
  return players.some(player => 
    player.grid.every(gridCard => gridCard.isRevealed)
  );
}

// Auto-reshuffle when draw pile is empty
export function reshuffleIfNeeded(gameState: GameState): GameState {
  if (gameState.drawPile.length === 0 && gameState.discardPile.length > 1) {
    const topDiscard = gameState.discardPile[gameState.discardPile.length - 1];
    const newDrawPile = shuffleDeck(gameState.discardPile.slice(0, -1));
    
    return {
      ...gameState,
      drawPile: newDrawPile,
      discardPile: [topDiscard]
    };
  }
  
  return gameState;
}

// Get display name for card
export function getCardDisplayValue(card: Card): string {
  return card.value === '10' ? '10' : card.value;
}

// Check if all players have peeked their cards
export function hasPlayerFinishedPeeking(player: Player): boolean {
  return player.grid.filter(gridCard => gridCard.isRevealed).length >= 2;
}

// Get next player index
export function getNextPlayerIndex(currentIndex: number, playerCount: number): number {
  return (currentIndex + 1) % playerCount;
}
