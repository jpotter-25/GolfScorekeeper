import { Card as CardType } from '@/types/game';
import { getCardDisplayValue } from '@/utils/gameLogic';
import { cn } from '@/lib/utils';
import { useCosmetics } from '@/hooks/useCosmetics';
import { getCosmeticAsset } from '@/utils/cosmeticAssets';

interface CardProps {
  card?: CardType | null;
  isRevealed?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  highlightColor?: 'blue' | 'green';
  size?: 'small' | 'medium' | 'large';
  isDisabled?: boolean;
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
  isDisabled = false,
  onClick,
  className,
  'data-testid': testId
}: CardProps) {
  const { getCardBackStyle } = useCosmetics();
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

  // Handle disabled state (permanently cleared from three-of-a-kind)
  if (isDisabled) {
    return (
      <div
        className={cn(
          'bg-gray-200 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 cursor-not-allowed',
          getSizeClasses(),
          'border-gray-300 dark:border-gray-600 border-2',
          className
        )}
        data-testid={testId}
      >
        <div className="text-lg font-bold opacity-60">×</div>
      </div>
    );
  }

  if (!isRevealed || !card) {
    const cardBackStyle = getCardBackStyle();
    const cardBackAsset = getCosmeticAsset(cardBackStyle.cosmeticId || 'classic_blue');
    
    return (
      <div
        className={cn(
          'rounded-xl flex items-center justify-center text-white cursor-pointer transition-all relative overflow-hidden',
          getSizeClasses(),
          getHighlightClasses(),
          onClick && !isDisabled && 'hover:scale-105',
          className
        )}
        onClick={!isDisabled ? onClick : undefined}
        data-testid={testId}
      >
        {cardBackAsset ? (
          <img 
            src={cardBackAsset} 
            alt="Card back"
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          <>
            {/* Fallback pattern */}
            <div 
              className="absolute inset-0"
              style={{
                background: cardBackStyle.background,
                border: cardBackStyle.border
              }}
            />
            {cardBackStyle.pattern !== 'none' && (
              <div 
                className="absolute inset-0"
                style={{ background: cardBackStyle.pattern }}
              />
            )}
            
            {/* Card back design */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="text-lg font-bold mb-1">♠</div>
              <div className="text-xs font-semibold opacity-80">Golf 9</div>
            </div>
          </>
        )}
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
        onClick && !isDisabled && 'cursor-pointer hover:scale-105',
        className
      )}
      onClick={!isDisabled ? onClick : undefined}
      data-testid={testId}
    >
      {getCardDisplayValue(card)}
    </div>
  );
}
