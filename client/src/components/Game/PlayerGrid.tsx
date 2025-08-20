import { Player } from '@/types/game';
import { checkThreeOfAKind } from '@/utils/gameLogic';
import Card from './Card';
import { cn } from '@/lib/utils';

interface PlayerGridProps {
  player: Player;
  isCurrentPlayer?: boolean;
  selectedPosition?: number | null;
  onCardClick?: (position: number) => void;
  className?: string;
  idleTimeRemaining?: number;
  isIdle?: boolean;
  showIdleTimer?: boolean;
}

export default function PlayerGrid({ 
  player, 
  isCurrentPlayer = false, 
  selectedPosition, 
  onCardClick,
  className,
  idleTimeRemaining = 25,
  isIdle = false,
  showIdleTimer = false
}: PlayerGridProps) {
  const threeOfAKindColumns = checkThreeOfAKind(player.grid);
  
  const getColumnForPosition = (position: number): number => {
    return position % 3;
  };

  const isPositionInThreeOfAKind = (position: number): boolean => {
    const column = getColumnForPosition(position);
    return threeOfAKindColumns.includes(column);
  };

  return (
    <div className={cn('text-center', className)}>
      {/* Player Info */}
      <div className="mb-4">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <div className="relative">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold',
              player.isAI ? 'bg-red-500' : 'bg-game-gold'
            )}>
              {player.avatar}
            </div>
            {/* Idle Timer Ring */}
            {showIdleTimer && isCurrentPlayer && (
              <div className="absolute inset-0">
                <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    className="stroke-current text-gray-300"
                    strokeWidth="2"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    className={cn(
                      'stroke-current transition-all duration-1000',
                      idleTimeRemaining > 10 ? 'text-green-500' :
                      idleTimeRemaining > 5 ? 'text-yellow-500' : 'text-red-500'
                    )}
                    strokeWidth="2"
                    strokeDasharray={`${((25 - idleTimeRemaining) / 25) * 100.48} 100.48`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="text-white font-semibold">{player.name}</div>
          {isCurrentPlayer && !isIdle && (
            <div className="bg-white bg-opacity-20 text-white px-3 py-1 rounded-full text-sm">
              Your Turn
            </div>
          )}
          {isIdle && (
            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm">
              Idle: Autoplay
            </div>
          )}
        </div>
        <div className="text-game-cream text-sm">
          Round Score: <span className="font-semibold" data-testid={`text-round-score-${player.id}`}>
            {player.roundScore}
          </span> | Total: <span className="font-semibold" data-testid={`text-total-score-${player.id}`}>
            {player.totalScore}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-3 w-fit mx-auto" data-testid={`grid-${player.id}`}>
        {player.grid.map((gridCard, index) => (
          <Card
            key={index}
            card={gridCard.card}
            isRevealed={gridCard.isRevealed}
            isSelected={selectedPosition === index}
            isHighlighted={isPositionInThreeOfAKind(index)}
            highlightColor="green"
            size="large"
            onClick={onCardClick ? () => onCardClick(index) : undefined}
            data-testid={`card-${player.id}-${index}`}
          />
        ))}
      </div>

      {/* Special Rule Indicator */}
      {threeOfAKindColumns.length > 0 && (
        <div className="mt-4 bg-highlight-green bg-opacity-20 text-highlight-green px-4 py-2 rounded-lg inline-block" data-testid="indicator-three-of-kind">
          <i className="fas fa-star mr-2"></i>
          Three of a Kind! Column Zeroed - Extra Turn
        </div>
      )}
    </div>
  );
}
