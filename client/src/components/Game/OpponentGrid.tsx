import { Player } from '@/types/game';
import { checkThreeOfAKind, calculatePlayerScore } from '@/utils/gameLogic';
import Card from './Card';
import { cn } from '@/lib/utils';

interface OpponentGridProps {
  player: Player;
  isCurrentPlayer?: boolean;
  className?: string;
}

export default function OpponentGrid({ player, isCurrentPlayer = false, className }: OpponentGridProps) {
  const threeOfAKindColumns = checkThreeOfAKind(player.grid);
  
  const getColumnForPosition = (position: number): number => {
    return position % 3;
  };

  const isPositionInThreeOfAKind = (position: number): boolean => {
    const column = getColumnForPosition(position);
    return threeOfAKindColumns.includes(column);
  };

  // Calculate current round score based on revealed cards
  const currentRoundScore = calculatePlayerScore(player.grid);

  return (
    <div className={cn('opponent-grid', className)} data-testid={`opponent-grid-${player.id}`}>
      <div className="text-center mb-3">
        {/* Playing indicator with reserved space to avoid layout shift */}
        <div className="h-4 flex items-center justify-center mb-1">
          {isCurrentPlayer && (
            <div className="bg-game-gold bg-opacity-90 text-white px-2 py-0.5 rounded-full text-xs font-medium">
              Playing
            </div>
          )}
        </div>
        <div className="flex items-center justify-center space-x-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold',
            player.isAI ? 'bg-red-500' : 'bg-blue-500'
          )}>
            {player.avatar}
          </div>
          <div className="text-white font-medium">{player.name}</div>
        </div>
        <div className="text-game-cream text-sm">
          <div>Round: <span className="font-semibold" data-testid={`text-opponent-round-score-${player.id}`}>
            {currentRoundScore}
          </span></div>
          <div>Total: <span className="font-semibold" data-testid={`text-opponent-total-score-${player.id}`}>
            {player.totalScore}
          </span></div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 w-36">
        {player.grid.map((gridCard, index) => (
          <Card
            key={index}
            card={gridCard.card}
            isRevealed={gridCard.isRevealed}
            isHighlighted={isPositionInThreeOfAKind(index)}
            highlightColor="green"
            size="medium"
            isDisabled={gridCard.isDisabled}
            data-testid={`card-opponent-${player.id}-${index}`}
          />
        ))}
      </div>
    </div>
  );
}
