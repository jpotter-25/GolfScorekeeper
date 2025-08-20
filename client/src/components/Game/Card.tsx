import { Card as CardType } from '@/types/game';
import { getCardDisplayValue } from '@/utils/gameLogic';
import { cn } from '@/lib/utils';

interface CardProps {
  card?: CardType | null;
  isRevealed?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  highlightColor?: 'blue' | 'green';
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  className?: string;
  'data-testid'?: string;
}

export default function Card({ 
  card, 
  isRevealed = false, 
  isSelected = false,
  isHighlighted = false,
  highlightColor = 'blue',
  size = 'medium',
  onClick,
  className,
  'data-testid': testId
}: CardProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-12 h-16 text-xs';
      case 'large':
        return 'w-20 h-28 text-lg';
      default:
        return 'w-16 h-24 text-sm';
    }
  };

  const getHighlightClasses = () => {
    if (isSelected) {
      return 'border-highlight-blue border-2';
    }
    if (isHighlighted) {
      return highlightColor === 'green' 
        ? 'border-highlight-green border-2 shadow-lg' 
        : 'border-highlight-blue border-2';
    }
    return 'border-white border-opacity-20 border-2';
  };

  const getCardColor = (card: CardType) => {
    return card.suit === 'hearts' || card.suit === 'diamonds' ? 'text-red-600' : 'text-black';
  };

  if (!isRevealed || !card) {
    return (
      <div
        className={cn(
          'bg-card-back rounded-xl flex items-center justify-center text-white cursor-pointer hover:border-highlight-blue transition-all',
          getSizeClasses(),
          getHighlightClasses(),
          onClick && 'hover:scale-105',
          className
        )}
        onClick={onClick}
        data-testid={testId}
      >
        <div className="text-xs opacity-80">?</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl flex items-center justify-center font-bold transition-all',
        getSizeClasses(),
        getHighlightClasses(),
        getCardColor(card),
        onClick && 'cursor-pointer hover:scale-105',
        className
      )}
      onClick={onClick}
      data-testid={testId}
    >
      {getCardDisplayValue(card)}
    </div>
  );
}
