import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useUserStats } from '@/hooks/useUserProgression';
import HowToPlay from '@/components/Game/HowToPlay';

export default function Home() {
  const [, setLocation] = useLocation();
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  const { user } = useAuth();
  const { data: userStats } = useUserStats();

  const selectMode = (mode: 'solo' | 'pass-play' | 'online') => {
    setLocation(`/setup?mode=${mode}`);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
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
    ? Math.round((userStats.gamesWon / userStats.gamesPlayed) * 100) 
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
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center border-2 border-blue-500">
            {user.profileImageUrl ? (
              <img 
                src={user.profileImageUrl} 
                alt="Profile" 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <i className="fas fa-user text-white text-xl"></i>
            )}
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
            variant="outline"
            className="text-white border-white hover:bg-white hover:text-black"
            data-testid="button-cosmetics"
          >
            <i className="fas fa-palette mr-2"></i>
            Cosmetics
          </Button>
          <Button 
            onClick={() => setLocation('/settings')}
            variant="outline"
            className="text-white border-white hover:bg-white hover:text-black"
            data-testid="button-settings"
          >
            <i className="fas fa-cog mr-2"></i>
            Settings
          </Button>
          <button 
            onClick={handleLogout}
            className="text-white text-2xl hover:text-red-500 transition-colors" 
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
            onClick={() => selectMode('online')}
            className="w-full bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 text-white py-4 px-6 rounded-xl border border-white border-opacity-20 transition-all duration-200 flex items-center justify-between h-auto"
            data-testid="button-online-mode"
            disabled
          >
            <div className="flex items-center space-x-4">
              <i className="fas fa-wifi text-blue-400 text-xl"></i>
              <span className="font-semibold">Online Multiplayer</span>
            </div>
            <i className="fas fa-chevron-right opacity-60"></i>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center space-x-3">
                <i className="fas fa-volume-up text-gray-600"></i>
                <span className="text-gray-700">Sound Effects</span>
              </div>
              <div className="w-12 h-6 bg-game-gold rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center space-x-3">
                <i className="fas fa-mobile-alt text-gray-600"></i>
                <span className="text-gray-700">Vibration</span>
              </div>
              <div className="w-12 h-6 bg-gray-300 rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
            <Separator />
            <Button 
              onClick={handleLogout}
              variant="destructive" 
              className="w-full mt-6"
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Player Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="text-center">
              <div className="w-20 h-20 bg-game-gold rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-user text-white text-3xl"></i>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-change-avatar"
              >
                <i className="fas fa-edit mr-2"></i>
                Change Avatar
              </Button>
            </div>
            
            <Separator />
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900">{user.level || 1}</div>
                <div className="text-sm text-gray-600">Level</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{user.currency || 0}</div>
                <div className="text-sm text-gray-600">Coins</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900">{userStats?.gamesPlayed || 0}</div>
                <div className="text-sm text-gray-600">Games Played</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{winRate}%</div>
                <div className="text-sm text-gray-600">Win Rate</div>
              </div>
            </div>
            
            {/* Experience Progress */}
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Experience</span>
                <span>{(user.experience || 0).toLocaleString()} / {((user.level || 1) * 100).toLocaleString()} XP</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${((user.experience || 0) / ((user.level || 1) * 100)) * 100}%` }}></div>
              </div>
            </div>
            
            {/* Cosmetics Section */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Cosmetic Items</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="border-2 border-game-gold bg-game-gold bg-opacity-10 p-3 rounded-lg text-center">
                  <i className="fas fa-palette text-game-gold text-xl mb-1"></i>
                  <div className="text-xs text-gray-600">Default Deck</div>
                </div>
                <div className="border-2 border-gray-300 bg-gray-50 p-3 rounded-lg text-center opacity-50">
                  <i className="fas fa-lock text-gray-400 text-xl mb-1"></i>
                  <div className="text-xs text-gray-400">Royal Deck</div>
                </div>
                <div className="border-2 border-gray-300 bg-gray-50 p-3 rounded-lg text-center opacity-50">
                  <i className="fas fa-lock text-gray-400 text-xl mb-1"></i>
                  <div className="text-xs text-gray-400">Neon Deck</div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
