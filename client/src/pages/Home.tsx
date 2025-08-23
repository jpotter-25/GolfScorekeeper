import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserStats } from '@/hooks/useUserProgression';
import HowToPlay from '@/components/Game/HowToPlay';
import { getCosmeticAsset } from '@/utils/cosmeticAssets';
interface CosmeticWithDetails {
  id: string;
  cosmeticId: string;
  name: string;
  type: string;
  equipped: boolean;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  const { user } = useAuth();
  const { data: userStats } = useUserStats();
  
  const { data: userCosmetics = [] } = useQuery<CosmeticWithDetails[]>({
    queryKey: ["/api/user/cosmetics"],
  });

  const selectMode = (mode: 'solo' | 'pass-play' | 'online') => {
    setLocation(`/setup?mode=${mode}`);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  // Function to render cosmetic preview images
  const getPreviewImage = (cosmetic: CosmeticWithDetails) => {
    // Use the cosmetic ID (classic_blue, green_felt, etc.) instead of the database row ID
    const assetUrl = getCosmeticAsset(cosmetic.cosmeticId);
    
    if (assetUrl) {
      return (
        <div className="w-12 h-12 rounded-lg border border-game-gold/50 overflow-hidden shadow-lg bg-slate-700/30">
          <img 
            src={assetUrl} 
            alt={cosmetic.name}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    
    // Fallback with type-specific icons only when no asset is available
    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'card_back': return 'fas fa-clone';
        case 'table_theme': return 'fas fa-table';
        case 'avatar': return 'fas fa-user';
        default: return 'fas fa-palette';
      }
    };
    
    return (
      <div className="w-12 h-12 bg-gradient-to-br from-slate-600/50 to-slate-700/50 rounded-lg border border-game-gold/50 flex items-center justify-center shadow-lg">
        <i className={`${getTypeIcon(cosmetic.type)} text-game-gold text-lg`}></i>
      </div>
    );
  };

  // Show loading state until user data is available
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Calculate user display data
  const displayName = user.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user.email?.split('@')[0] 
    ? user.email.split('@')[0] 
    : 'Player';

  const winRate = userStats?.gamesPlayed 
    ? Math.round(((userStats.gamesWon || 0) / userStats.gamesPlayed) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt">
      {/* Header */}
      <header className="flex justify-between items-center p-6">
        <button 
          onClick={() => setShowProfile(true)}
          className="flex items-center space-x-4 hover:bg-white hover:bg-opacity-10 rounded-lg p-2 transition-all"
          data-testid="button-profile"
        >
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center border-2 border-blue-500 overflow-hidden">
            {(() => {
              const equippedAvatar = userCosmetics.find(cosmetic => 
                cosmetic.type === 'avatar' && cosmetic.equipped
              );
              if (equippedAvatar) {
                const assetUrl = getCosmeticAsset(equippedAvatar.cosmeticId);
                if (assetUrl) {
                  return (
                    <img 
                      src={assetUrl} 
                      alt={equippedAvatar.name}
                      className="w-full h-full object-cover"
                    />
                  );
                }
              }
              // Fallback to Replit profile image or generic icon
              if (user.profileImageUrl) {
                return (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                );
              }
              return <i className="fas fa-user text-white text-xl"></i>;
            })()}
          </div>
          <div className="text-white">
            <div className="font-semibold">{displayName}</div>
            <div className="text-sm opacity-80">Level {user.level || 1} • {(user.experience || 0).toLocaleString()} XP</div>
            <div className="text-sm text-yellow-300 font-medium">{user.currency || 0} coins</div>
          </div>
        </button>
        
        <div className="flex gap-3">
          <Button 
            onClick={() => setLocation('/cosmetics')}
            className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/50 text-game-gold hover:bg-slate-700 hover:border-game-gold hover:shadow-lg hover:shadow-game-gold/20 transition-all duration-200"
            data-testid="button-cosmetics"
          >
            <i className="fas fa-palette mr-2"></i>
            Cosmetics
          </Button>
          <Button 
            onClick={() => setLocation('/settings')}
            className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/50 text-game-gold hover:bg-slate-700 hover:border-game-gold hover:shadow-lg hover:shadow-game-gold/20 transition-all duration-200"
            data-testid="button-settings"
          >
            <i className="fas fa-cog mr-2"></i>
            Settings
          </Button>
          <button 
            onClick={handleLogout}
            className="bg-slate-800/80 backdrop-blur-sm border-2 border-red-400/50 text-red-400 hover:bg-red-900/30 hover:border-red-400 hover:shadow-lg hover:shadow-red-400/20 transition-all duration-200 px-4 py-2 rounded-lg" 
            data-testid="button-logout"
          >
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </header>

      {/* Game Logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-4">Golf 9</h1>
          <p className="text-xl text-game-cream opacity-90">The Card Game</p>
        </div>

        {/* Mode Selection */}
        <div className="w-full max-w-md space-y-4">
          <Button 
            onClick={() => selectMode('solo')}
            className="w-full bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 text-white py-4 px-6 rounded-xl border border-white border-opacity-20 transition-all duration-200 flex items-center justify-between h-auto"
            data-testid="button-solo-mode"
          >
            <div className="flex items-center space-x-4">
              <i className="fas fa-robot text-blue-400 text-xl"></i>
              <span className="font-semibold">Solo vs AI</span>
            </div>
            <i className="fas fa-chevron-right opacity-60"></i>
          </Button>

          <Button 
            onClick={() => selectMode('pass-play')}
            className="w-full bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 text-white py-4 px-6 rounded-xl border border-white border-opacity-20 transition-all duration-200 flex items-center justify-between h-auto"
            data-testid="button-pass-play-mode"
          >
            <div className="flex items-center space-x-4">
              <i className="fas fa-users text-blue-400 text-xl"></i>
              <span className="font-semibold">Pass & Play</span>
            </div>
            <i className="fas fa-chevron-right opacity-60"></i>
          </Button>

          <Button 
            onClick={() => setLocation('/multiplayer')}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 px-6 rounded-xl border border-white border-opacity-20 transition-all duration-200 flex items-center justify-between h-auto shadow-lg hover:shadow-xl"
            data-testid="button-online-mode"
          >
            <div className="flex items-center space-x-4">
              <i className="fas fa-wifi text-blue-200 text-xl"></i>
              <span className="font-semibold">Online Multiplayer</span>
            </div>
            <i className="fas fa-chevron-right"></i>
          </Button>

          <Button 
            onClick={() => setShowHowToPlay(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200"
            data-testid="button-how-to-play"
          >
            <i className="fas fa-question-circle mr-2"></i>
            How to Play
          </Button>
        </div>
      </div>

      <HowToPlay 
        isOpen={showHowToPlay} 
        onClose={() => setShowHowToPlay(false)} 
      />
      
      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-game-gold/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-game-gold to-yellow-300 bg-clip-text text-transparent">Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center justify-between py-4 px-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-game-gold/20 rounded-full flex items-center justify-center">
                  <i className="fas fa-volume-up text-game-gold"></i>
                </div>
                <span className="text-slate-200 font-medium">Sound Effects</span>
              </div>
              <div className="w-14 h-7 bg-game-gold rounded-full relative cursor-pointer shadow-inner">
                <div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-200"></div>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-4 px-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-600/50 rounded-full flex items-center justify-center">
                  <i className="fas fa-mobile-alt text-slate-400"></i>
                </div>
                <span className="text-slate-200 font-medium">Vibration</span>
              </div>
              <div className="w-14 h-7 bg-slate-600 rounded-full relative cursor-pointer shadow-inner">
                <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-200"></div>
              </div>
            </div>
            
            <Button 
              onClick={handleLogout}
              className="w-full mt-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
              data-testid="button-logout"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>
              Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Profile Dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-lg bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-game-gold/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-game-gold to-yellow-300 bg-clip-text text-transparent">Player Profile</DialogTitle>
            <DialogDescription className="text-slate-300">
              View your stats, progress, and equipped cosmetics
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="text-center">
              <div className="w-20 h-20 bg-game-gold rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                {(() => {
                  const equippedAvatar = userCosmetics.find(cosmetic => 
                    cosmetic.type === 'avatar' && cosmetic.equipped
                  );
                  if (equippedAvatar) {
                    const assetUrl = getCosmeticAsset(equippedAvatar.cosmeticId);
                    if (assetUrl) {
                      return (
                        <img 
                          src={assetUrl} 
                          alt={equippedAvatar.name}
                          className="w-full h-full object-cover"
                        />
                      );
                    }
                  }
                  return <i className="fas fa-user text-white text-3xl"></i>;
                })()}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/50 text-game-gold hover:bg-slate-700 hover:border-game-gold hover:shadow-lg hover:shadow-game-gold/20 transition-all duration-200"
                onClick={() => {
                  setShowProfile(false);
                  setLocation('/cosmetics');
                }}
                data-testid="button-change-avatar"
              >
                <i className="fas fa-edit mr-2"></i>
                Change Avatar
              </Button>
            </div>
            
            <Separator />
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-4 rounded-xl text-center border border-slate-600/30">
                <div className="text-2xl font-bold text-game-gold">{user.level || 1}</div>
                <div className="text-sm text-slate-300">Level</div>
              </div>
              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-4 rounded-xl text-center border border-slate-600/30">
                <div className="text-2xl font-bold text-yellow-400">{user.currency || 0}</div>
                <div className="text-sm text-slate-300">Coins</div>
              </div>
              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-4 rounded-xl text-center border border-slate-600/30">
                <div className="text-2xl font-bold text-blue-400">{userStats?.gamesPlayed || 0}</div>
                <div className="text-sm text-slate-300">Games Played</div>
              </div>
              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-4 rounded-xl text-center border border-slate-600/30">
                <div className="text-2xl font-bold text-green-400">{winRate}%</div>
                <div className="text-sm text-slate-300">Win Rate</div>
              </div>
            </div>
            
            {/* Experience Progress */}
            <div className="bg-gradient-to-r from-slate-700/30 to-slate-800/30 p-4 rounded-xl border border-slate-600/30">
              <div className="flex justify-between text-sm text-slate-300 mb-3">
                <span className="font-medium">Experience</span>
                <span>{(user.experience || 0).toLocaleString()} / {((user.level || 1) * 100).toLocaleString()} XP</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-4 shadow-inner">
                <div className="bg-gradient-to-r from-game-gold to-yellow-400 h-4 rounded-full shadow-lg transition-all duration-500" style={{ width: `${((user.experience || 0) / ((user.level || 1) * 100)) * 100}%` }}></div>
              </div>
            </div>
            
            {/* Equipped Cosmetics Section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-white">Equipped Items</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/50 text-game-gold hover:bg-slate-700 hover:border-game-gold hover:shadow-lg hover:shadow-game-gold/20 transition-all duration-200"
                  onClick={() => {
                    setShowProfile(false);
                    setLocation('/cosmetics');
                  }}
                  data-testid="button-manage-cosmetics"
                >
                  <i className="fas fa-palette mr-2"></i>
                  Manage
                </Button>
              </div>
              
              {userCosmetics.length > 0 ? (
                <div className="space-y-2">
                  {userCosmetics
                    .filter(cosmetic => cosmetic.equipped)
                    .map(cosmetic => (
                      <div key={cosmetic.id} className="flex items-center justify-between p-4 border border-game-gold/30 rounded-lg bg-gradient-to-r from-slate-700/30 to-slate-800/30">
                        <div className="flex items-center space-x-4">
                          {getPreviewImage(cosmetic)}
                          <div>
                            <div className="font-medium text-white">{cosmetic.name}</div>
                            <div className="text-xs text-slate-400 capitalize">{cosmetic.type?.replace('_', ' ')}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs border-game-gold text-game-gold bg-game-gold/10">
                          <i className="fas fa-check mr-1"></i>
                          Equipped
                        </Badge>
                      </div>
                    ))}
                  
                  {userCosmetics.filter(c => c.equipped).length === 0 && (
                    <div className="text-center py-4 text-slate-400">
                      <i className="fas fa-palette text-2xl mb-2 opacity-50 text-game-gold"></i>
                      <p className="text-sm text-white">No cosmetics equipped</p>
                      <p className="text-xs">Visit the Cosmetics store to equip items</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400">
                  <i className="fas fa-shopping-bag text-2xl mb-2 opacity-50 text-game-gold"></i>
                  <p className="text-sm text-white">No cosmetics owned</p>
                  <p className="text-xs">Visit the Cosmetics store to purchase items</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
