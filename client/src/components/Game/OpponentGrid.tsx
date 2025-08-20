import { Player } from '@/types/game';
import { checkThreeOfAKind } from '@/utils/gameLogic';
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

  return (
    <div className={cn('opponent-grid', className)} data-testid={`opponent-grid-${player.id}`}>
      <div className="text-center mb-3">
        <div className="flex items-center justify-center space-x-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold',
            player.isAI ? 'bg-red-500' : 'bg-blue-500'
          )}>
            {player.avatar}
          </div>
          <div className="text-white font-medium">{player.name}</div>
          {isCurrentPlayer && (
            <div className="bg-game-gold bg-opacity-80 text-white px-2 py-1 rounded-full text-xs">
              Playing
            </div>
          )}
        </div>
        <div className="text-game-cream text-sm">
          Score: <span className="font-semibold" data-testid={`text-opponent-score-${player.id}`}>
            {player.roundScore}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-1 w-24">
        {player.grid.map((gridCard, index) => (
          <Card
            key={index}
            card={gridCard.card}
            isRevealed={gridCard.isRevealed}
            isHighlighted={isPositionInThreeOfAKind(index)}
            highlightColor="green"
            size="small"
            isDisabled={gridCard.isDisabled}
            data-testid={`card-opponent-${player.id}-${index}`}
          />
        ))}
      </div>
    </div>
  );
}
