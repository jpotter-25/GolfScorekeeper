import { useQuery } from '@tanstack/react-query';
import { getCosmeticAsset } from '@/utils/cosmeticAssets';

interface CosmeticWithDetails {
  id: string;
  cosmeticId: string;
  name: string;
  type: string;
  equipped: boolean;
  imageUrl?: string;
}

export function useCosmetics() {
  const { data: userCosmetics = [], isLoading, error } = useQuery<CosmeticWithDetails[]>({
    queryKey: ["/api/user/cosmetics"],
    retry: 2,
  });



  const getEquippedCosmetic = (type: 'card_back' | 'avatar' | 'table_theme') => {
    return userCosmetics.find(cosmetic => 
      cosmetic.type === type && cosmetic.equipped
    );
  };

  const equippedCardBack = getEquippedCosmetic('card_back');
  const equippedAvatar = getEquippedCosmetic('avatar');
  const equippedTableTheme = getEquippedCosmetic('table_theme');

  const getCardBackStyle = () => {
    const cardBack = equippedCardBack;
    const cosmeticId = cardBack?.cosmeticId || 'classic_blue';
    
    switch (cosmeticId) {
      case 'royal_red':
        return {
          cosmeticId,
          background: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)',
          border: '2px solid #B91C1C',
          pattern: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)'
        };
      case 'midnight_black':
        return {
          cosmeticId,
          background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
          border: '2px solid #374151',
          pattern: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1) 0%, transparent 50%)'
        };
      default: // classic_blue
        return {
          cosmeticId,
          background: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
          border: '2px solid #3B82F6',
          pattern: 'none'
        };
    }
  };

  const getTableThemeStyle = () => {
    const tableTheme = equippedTableTheme;
    const cosmeticId = tableTheme?.cosmeticId || 'green_felt';
    
    switch (cosmeticId) {
      case 'wood_mahogany':
        return {
          cosmeticId,
          background: 'linear-gradient(135deg, #8B4513 0%, #654321 100%)',
          texture: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
        };
      default: // green_felt
        return {
          cosmeticId,
          background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
          texture: 'none'
        };
    }
  };

  const getAvatarUrl = () => {
    if (equippedAvatar) {
      const assetUrl = getCosmeticAsset(equippedAvatar.cosmeticId);
      if (assetUrl) {
        return assetUrl;
      }
    }
    return null; // Return null if no equipped avatar or asset found
  };

  return {
    userCosmetics,
    isLoading,
    equippedCardBack,
    equippedAvatar,
    equippedTableTheme,
    getCardBackStyle,
    getTableThemeStyle,
    getAvatarUrl
  };
}