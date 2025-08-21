export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
  id: string;
}

export interface GridCard {
  card: Card | null;
  isRevealed: boolean;
  position: number; // 0-8 for 3x3 grid
  isDisabled?: boolean; // True when position is permanently cleared from three-of-a-kind
}

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  grid: GridCard[];
  roundScore: number;
  totalScore: number;
  isActive: boolean;
  avatar: string;
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  currentRound: number;
  totalRounds: 5 | 9;
  drawPile: Card[];
  discardPile: Card[];
  gamePhase: 'setup' | 'peek' | 'playing' | 'round-end' | 'game-end';
  drawnCard: Card | null;
  selectedGridPosition: number | null;
  gameMode: 'solo' | 'pass-play' | 'online';
  roundEndTriggered: boolean;
  roundEndingPlayer?: number; // Index of player who triggered round end
  extraTurn: boolean;
}

export interface GameSettings {
  playerCount: 2 | 3 | 4;
  rounds: 5 | 9;
  mode: 'solo' | 'pass-play' | 'online';
}

export type GameAction = 
  | { type: 'DRAW_CARD'; source: 'draw' | 'discard' }
  | { type: 'SELECT_GRID_POSITION'; position: number }
  | { type: 'KEEP_DRAWN_CARD' }
  | { type: 'KEEP_REVEALED_CARD' }
  | { type: 'PEEK_CARD'; position: number }
  | { type: 'END_TURN' }
  | { type: 'START_ROUND' }
  | { type: 'END_ROUND' }
  | { type: 'RESET_GAME' };
