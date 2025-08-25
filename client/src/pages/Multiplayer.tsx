import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, GamepadIcon, Trophy, MessageCircle, UserPlus, ArrowLeft, Home } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getCosmeticAsset } from "@/utils/cosmeticAssets";
import type { GameStats } from "@shared/schema";

interface GameRoom {
  id: string;
  code: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  currentPlayers: number;
  isPrivate: boolean;
  status: string;
  createdAt: string;
}

interface Tournament {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  status: string;
  prizePool: number;
  tournamentStart: string;
}

interface Friend {
  id: string;
  firstName: string;
  lastName: string;
  level: number;
  isOnline: boolean;
}

export default function Multiplayer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [friendCode, setFriendCode] = useState("");

  // State for new consolidated lobby browsing
  const [stakeFilters, setStakeFilters] = useState<number[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);

  // Fetch friends
  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['/api/friends'],
    retry: false,
  });

  // Fetch user stats to get coin balance
  const { data: userStats } = useQuery<GameStats>({
    queryKey: ['/api/user/stats'],
    retry: false,
  });

  // Fetch user cosmetics for avatar display
  const { data: userCosmetics = [] } = useQuery<any[]>({
    queryKey: ['/api/user/cosmetics'],
    retry: false,
  });

  // Fetch tournaments
  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ['/api/tournaments'],
    retry: false,
  });

  // Fetch ALL available lobbies
  const { data: allLobbiesData = [], isLoading: lobbiesLoading } = useQuery({
    queryKey: ['/api/game-rooms/all-lobbies'],
    queryFn: () => fetch('/api/game-rooms/all-lobbies').then(r => r.json()),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Filter lobbies based on selected stake filters
  const filteredLobbies = stakeFilters.length === 0 
    ? allLobbiesData 
    : allLobbiesData.filter((lobby: any) => stakeFilters.includes(lobby.betAmount));

  // Sort lobbies by stake amount (cheapest first)
  const sortedLobbies = [...filteredLobbies].sort((a: any, b: any) => a.betAmount - b.betAmount);

  // Toggle stake filter
  const toggleStakeFilter = (stake: number) => {
    setStakeFilters(prev => 
      prev.includes(stake) 
        ? prev.filter(s => s !== stake)
        : [...prev, stake]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setStakeFilters([]);
  };

  // Handle creating a new room
  const handleCreateRoom = (betAmount: number) => {
    const userCoins = user?.currency || 0;
    if (betAmount > 0 && userCoins < betAmount) {
      toast({
        title: "Insufficient Coins",
        description: `You need ${betAmount} coins to create this room. You have ${userCoins} coins.`,
        variant: "destructive",
      });
      return;
    }
    handleCreateLobby(betAmount);
    setShowCreateRoom(false);
  };

  const handleCreateLobby = (betAmount: number) => {
    // Create new crown-managed lobby
    const createData = { betAmount, maxPlayers: 4, rounds: 9, isPrivate: false };
    
    fetch('/api/game-rooms/create-lobby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createData)
    })
    .then(r => r.json())
    .then(data => {
      if (data.code) {
        window.location.href = `/multiplayer/lobby/${data.code}`;
      }
    })
    .catch(error => {
      toast({
        title: "Error", 
        description: "Failed to create lobby",
        variant: "destructive",
      });
    });
  };

  const handleJoinLobby = (lobbyCode: string, betAmount: number) => {
    // Join specific lobby
    const joinData = { roomCode: lobbyCode, betAmount };
    
    fetch('/api/game-rooms/join-lobby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(joinData)
    })
    .then(r => r.json())
    .then(data => {
      if (data.code) {
        window.location.href = `/multiplayer/lobby/${data.code}`;
      }
    })
    .catch(error => {
      toast({
        title: "Error",
        description: "Failed to join lobby",
        variant: "destructive",
      });
    });
  };

  const handleAddFriend = () => {
    if (!friendCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a friend code",
        variant: "destructive",
      });
      return;
    }
    addFriendMutation.mutate(friendCode);
  };

  // Add friend mutation
  const addFriendMutation = useMutation({
    mutationFn: async (friendCode: string) => {
      return await apiRequest("POST", "/api/friends/request", { friendCode });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Friend request sent!",
      });
      setFriendCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send friend request",
        variant: "destructive",
      });
    },
  });

  // Get equipped avatar for display
  const equippedAvatar = userCosmetics.find(c => c.type === 'avatar' && c.isEquipped);
  const avatarAsset = equippedAvatar ? getCosmeticAsset(equippedAvatar.id) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800/90 backdrop-blur-sm border-b-2 border-game-gold/30 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm"
              data-testid="button-home"
            >
              <Home className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            
            <div className="flex items-center gap-3">
              {avatarAsset && (
                <img 
                  src={avatarAsset} 
                  alt="Avatar" 
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-game-gold/50"
                />
              )}
              <div className="text-left">
                <h1 className="text-lg sm:text-xl font-bold text-white">Multiplayer Lobbies</h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  {user?.currency || 0} coins • Level {user?.level || 1}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setLocation("/settings")}
              className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/50 text-game-gold hover:bg-slate-700 hover:border-game-gold hover:shadow-lg hover:shadow-game-gold/20 transition-all duration-200 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm flex-1 sm:flex-none"
              data-testid="button-settings"
            >
              <i className="fas fa-cog text-xs sm:text-sm sm:mr-2"></i>
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="rooms" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/90 backdrop-blur-sm border-2 border-game-gold/30">
          <TabsTrigger value="rooms" className="text-white data-[state=active]:text-game-gold data-[state=active]:bg-slate-700/50" data-testid="tab-rooms">
            <GamepadIcon className="w-4 h-4 mr-2" />
            Game Lobbies
          </TabsTrigger>
          <TabsTrigger value="friends" className="text-white data-[state=active]:text-game-gold data-[state=active]:bg-slate-700/50" data-testid="tab-friends">
            <Users className="w-4 h-4 mr-2" />
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="text-white data-[state=active]:text-game-gold data-[state=active]:bg-slate-700/50" data-testid="tab-tournaments">
            <Trophy className="w-4 h-4 mr-2" />
            Tournaments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-6">
          {/* Enhanced Lobby Browser */}
          <div className="space-y-8">
            {/* Hero Header Section */}
            <div className="relative bg-gradient-to-r from-slate-800/90 via-slate-700/90 to-slate-800/90 rounded-2xl border border-game-gold/20 p-6 overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-gradient-to-br from-game-gold/20 to-transparent"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-game-gold/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
              </div>
              
              <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-game-gold to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                      <i className="fas fa-users text-black text-xl"></i>
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-white">Game Lobbies</h3>
                      <p className="text-game-gold/90 font-medium">Multiplayer Gaming Hub</p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-lg leading-relaxed">
                    Join competitive lobbies, filter by stake levels, or create your own room to challenge players worldwide
                  </p>
                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <i className="fas fa-clock text-sm"></i>
                      <span className="text-sm">Live updates every 5s</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <i className="fas fa-trophy text-sm"></i>
                      <span className="text-sm">Crown holder system</span>
                    </div>
                  </div>
                </div>
                
                {/* Enhanced Create Room Button */}
                <div className="flex flex-col items-end gap-3">
                  <Button 
                    className="bg-gradient-to-r from-game-gold to-yellow-500 hover:from-game-gold/90 hover:to-yellow-500/90 text-black font-bold px-8 py-3 text-lg shadow-xl hover:shadow-game-gold/25 transform hover:scale-105 transition-all duration-200"
                    onClick={() => setShowCreateRoom(true)}
                    data-testid="button-create-room"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Room
                  </Button>
                  <p className="text-slate-400 text-sm">Become crown holder</p>
                </div>
              </div>
            </div>

            {/* Enhanced Stake Filters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fas fa-filter text-game-gold"></i>
                    Filter by Stakes
                  </h4>
                  <p className="text-slate-400 text-sm mt-1">Choose your preferred betting level</p>
                </div>
                {stakeFilters.length > 0 && (
                  <Button 
                    variant="outline" 
                    className="border-slate-500 text-slate-300 hover:bg-slate-700 hover:border-slate-400 transition-all"
                    onClick={clearFilters}
                  >
                    <i className="fas fa-times mr-2"></i>
                    Clear All ({stakeFilters.length})
                  </Button>
                )}
              </div>
              
              {/* Premium Stake Filter Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { stake: 0, label: "FREE", icon: "fas fa-heart", color: "green", gradient: "from-green-500 to-emerald-600" },
                  { stake: 10, label: "10", icon: "fas fa-seedling", color: "blue", gradient: "from-blue-500 to-cyan-600" },
                  { stake: 50, label: "50", icon: "fas fa-fire", color: "yellow", gradient: "from-yellow-500 to-amber-600" },
                  { stake: 100, label: "100", icon: "fas fa-lightning", color: "orange", gradient: "from-orange-500 to-red-500" },
                  { stake: 500, label: "500", icon: "fas fa-crown", color: "red", gradient: "from-red-500 to-pink-600" },
                  { stake: 1000, label: "1K", icon: "fas fa-star", color: "purple", gradient: "from-purple-500 to-indigo-600" }
                ].map(({ stake, label, icon, color, gradient }) => {
                  const isActive = stakeFilters.includes(stake);
                  
                  return (
                    <div
                      key={stake}
                      className={`relative group cursor-pointer transition-all duration-300 ${
                        isActive ? 'scale-105' : 'hover:scale-102'
                      }`}
                      onClick={() => toggleStakeFilter(stake)}
                      data-testid={`filter-stake-${stake}`}
                    >
                      <div className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
                        isActive 
                          ? `bg-gradient-to-r ${gradient} border-white/30 shadow-lg shadow-${color}-500/20`
                          : `bg-slate-800/80 border-slate-600 hover:border-slate-500 hover:bg-slate-700/80`
                      }`}>
                        {/* Background glow effect for active state */}
                        {isActive && (
                          <div className={`absolute inset-0 bg-gradient-to-r ${gradient} rounded-xl blur-sm opacity-20 -z-10`}></div>
                        )}
                        
                        <div className="text-center">
                          <div className={`w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                            isActive ? 'bg-white/20' : `bg-${color}-500/20`
                          }`}>
                            <i className={`${icon} text-sm ${isActive ? 'text-white' : `text-${color}-400`}`}></i>
                          </div>
                          <div className={`font-bold text-sm ${isActive ? 'text-white' : 'text-slate-300'}`}>
                            {label}
                          </div>
                          <div className={`text-xs ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                            {stake === 0 ? 'coins' : 'coins'}
                          </div>
                        </div>
                        
                        {/* Active indicator */}
                        {isActive && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                            <i className="fas fa-check text-xs text-green-600"></i>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Filter Summary */}
              {stakeFilters.length > 0 && (
                <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-center gap-2 text-sm">
                    <i className="fas fa-info-circle text-blue-400"></i>
                    <span className="text-slate-300">
                      Showing lobbies for: 
                      <span className="text-white font-semibold ml-1">
                        {stakeFilters.map(s => s === 0 ? 'FREE' : `${s} coins`).join(', ')}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Lobbies Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-bold text-white flex items-center gap-2">
                  <i className="fas fa-gamepad text-game-gold"></i>
                  Active Lobbies 
                  {!lobbiesLoading && (
                    <span className="bg-slate-700/80 text-slate-300 px-3 py-1 rounded-full text-sm font-normal ml-2">
                      {sortedLobbies.length} available
                    </span>
                  )}
                </h4>
                {!lobbiesLoading && sortedLobbies.length > 0 && (
                  <div className="text-slate-400 text-sm">
                    <i className="fas fa-sync-alt mr-1"></i>
                    Auto-refresh active
                  </div>
                )}
              </div>

              {lobbiesLoading ? (
                <div className="relative">
                  <div className="bg-gradient-to-r from-slate-800/90 via-slate-700/90 to-slate-800/90 rounded-2xl border border-slate-600/50 p-12">
                    <div className="text-center">
                      <div className="relative mb-6">
                        <div className="w-16 h-16 mx-auto bg-game-gold/20 rounded-full flex items-center justify-center">
                          <i className="fas fa-spinner fa-spin text-game-gold text-2xl"></i>
                        </div>
                        <div className="absolute inset-0 bg-game-gold/10 rounded-full animate-ping"></div>
                      </div>
                      <h5 className="text-white font-semibold text-lg mb-2">Loading Lobbies</h5>
                      <p className="text-slate-400">Searching for active games...</p>
                    </div>
                  </div>
                </div>
              ) : sortedLobbies.length === 0 ? (
                <div className="relative">
                  <div className="bg-gradient-to-br from-slate-800/90 via-slate-700/90 to-slate-800/90 rounded-2xl border border-slate-600/50 p-12 overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute inset-0 opacity-5">
                      <div className="absolute top-4 left-4 w-20 h-20 border-2 border-game-gold rounded-lg rotate-12"></div>
                      <div className="absolute bottom-4 right-4 w-16 h-16 border-2 border-blue-500 rounded-full"></div>
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-purple-500 rounded-full opacity-50"></div>
                    </div>
                    
                    <div className="text-center relative">
                      <div className="w-24 h-24 mx-auto bg-gradient-to-r from-slate-600 to-slate-700 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
                        <i className={`fas ${stakeFilters.length > 0 ? 'fa-search-minus' : 'fa-inbox'} text-slate-300 text-3xl`}></i>
                      </div>
                      
                      <h5 className="text-white font-bold text-xl mb-3">
                        {stakeFilters.length > 0 ? "No Matches Found" : "No Active Lobbies"}
                      </h5>
                      <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-md mx-auto">
                        {stakeFilters.length > 0 
                          ? "No lobbies match your selected stake filters. Try adjusting your preferences or create a new lobby."
                          : "The lobby is empty right now. Be the pioneer and create the first game for others to join!"
                        }
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button 
                          className="bg-gradient-to-r from-game-gold to-yellow-500 hover:from-game-gold/90 hover:to-yellow-500/90 text-black font-bold px-6 py-3 shadow-lg hover:shadow-game-gold/20 transform hover:scale-105 transition-all"
                          onClick={() => setShowCreateRoom(true)}
                        >
                          <Plus className="w-5 h-5 mr-2" />
                          Create First Lobby
                        </Button>
                        {stakeFilters.length > 0 && (
                          <Button 
                            variant="outline"
                            className="border-slate-500 text-slate-300 hover:bg-slate-700 hover:border-slate-400 px-6 py-3"
                            onClick={clearFilters}
                          >
                            <i className="fas fa-times mr-2"></i>
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Enhanced Horizontal Scrolling Lobby Cards */}
                  <div className="relative">
                    <div 
                      className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      {sortedLobbies.map((lobby: any) => {
                        const userCoins = user?.currency || 0;
                        const canJoin = userCoins >= lobby.betAmount && lobby.playerCount < lobby.maxPlayers;
                        
                        const stakeConfig = {
                          0: { 
                            color: "border-green-500/60 hover:border-green-400 shadow-green-500/10",
                            badge: "bg-gradient-to-r from-green-500 to-emerald-600",
                            glow: "shadow-green-500/20"
                          },
                          10: { 
                            color: "border-blue-500/60 hover:border-blue-400 shadow-blue-500/10", 
                            badge: "bg-gradient-to-r from-blue-500 to-cyan-600",
                            glow: "shadow-blue-500/20"
                          },
                          50: { 
                            color: "border-yellow-500/60 hover:border-yellow-400 shadow-yellow-500/10",
                            badge: "bg-gradient-to-r from-yellow-500 to-amber-600",
                            glow: "shadow-yellow-500/20"
                          },
                          100: { 
                            color: "border-orange-500/60 hover:border-orange-400 shadow-orange-500/10",
                            badge: "bg-gradient-to-r from-orange-500 to-red-500", 
                            glow: "shadow-orange-500/20"
                          },
                          500: { 
                            color: "border-red-500/60 hover:border-red-400 shadow-red-500/10",
                            badge: "bg-gradient-to-r from-red-500 to-pink-600",
                            glow: "shadow-red-500/20"
                          },
                          1000: { 
                            color: "border-purple-500/60 hover:border-purple-400 shadow-purple-500/10",
                            badge: "bg-gradient-to-r from-purple-500 to-indigo-600",
                            glow: "shadow-purple-500/20"
                          }
                        };
                        
                        const config = stakeConfig[lobby.betAmount as keyof typeof stakeConfig] || {
                          color: "border-slate-600 hover:border-slate-500",
                          badge: "bg-slate-600",
                          glow: "shadow-slate-500/10"
                        };
                        
                        return (
                          <Card 
                            key={lobby.code} 
                            className={`bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border-2 shadow-xl transition-all duration-300 min-w-[340px] snap-start hover:transform hover:scale-102 ${config.color}`}
                            data-testid={`lobby-card-${lobby.code}`}
                          >
                            <CardHeader className="pb-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-gradient-to-r from-game-gold/30 to-yellow-500/30 rounded-xl flex items-center justify-center shadow-lg border border-game-gold/20">
                                    <i className="fas fa-crown text-game-gold text-lg"></i>
                                  </div>
                                  <div>
                                    <CardTitle className="text-white text-lg font-bold">{lobby.crownHolderName}</CardTitle>
                                    <CardDescription className="text-slate-400 text-sm font-medium">
                                      Room • {lobby.code}
                                    </CardDescription>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white font-bold text-xl">
                                    {lobby.playerCount}<span className="text-slate-400 text-base">/{lobby.maxPlayers}</span>
                                  </div>
                                  <div className="text-slate-400 text-xs uppercase tracking-wider">players</div>
                                </div>
                              </div>
                            </CardHeader>
                            
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
                                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Entry Fee</div>
                                  <Badge className={`${config.badge} text-white font-bold text-sm px-3 py-1`}>
                                    {lobby.betAmount === 0 ? 'FREE' : `${lobby.betAmount} coins`}
                                  </Badge>
                                </div>
                                <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
                                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Prize Pool</div>
                                  <div className="text-game-gold font-bold text-sm">
                                    {lobby.prizePool || (lobby.betAmount * 4)} coins
                                  </div>
                                </div>
                              </div>
                              
                              <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400 text-sm">Rounds:</span>
                                  <span className="text-white font-semibold">{lobby.rounds}</span>
                                </div>
                              </div>
                              
                              <Button 
                                className={`w-full py-3 font-bold text-sm transition-all duration-200 ${
                                  canJoin 
                                    ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-blue-500/20 transform hover:scale-105" 
                                    : "bg-slate-700 text-slate-400 cursor-not-allowed"
                                }`}
                                onClick={() => canJoin && handleJoinLobby(lobby.code, lobby.betAmount)}
                                disabled={!canJoin}
                                data-testid={`join-lobby-${lobby.code}`}
                              >
                                {lobby.playerCount >= lobby.maxPlayers ? (
                                  <>
                                    <i className="fas fa-lock mr-2"></i>
                                    Lobby Full
                                  </>
                                ) : userCoins < lobby.betAmount ? (
                                  <>
                                    <i className="fas fa-coins mr-2"></i>
                                    Need {lobby.betAmount} coins
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-sign-in-alt mr-2"></i>
                                    Join Lobby
                                  </>
                                )}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    
                    {/* Enhanced Scroll Indicators */}
                    {sortedLobbies.length > 1 && (
                      <div className="absolute top-1/2 transform -translate-y-1/2 left-4 right-4 flex justify-between pointer-events-none">
                        <div className="bg-slate-900/90 backdrop-blur-sm text-slate-400 px-3 py-2 rounded-lg text-sm shadow-lg border border-slate-700/50">
                          <i className="fas fa-chevron-left mr-1"></i>
                          Scroll for more
                        </div>
                        <div className="bg-slate-900/90 backdrop-blur-sm text-slate-400 px-3 py-2 rounded-lg text-sm shadow-lg border border-slate-700/50">
                          More lobbies
                          <i className="fas fa-chevron-right ml-1"></i>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Create Room Modal */}
          {showCreateRoom && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <Card className="bg-slate-800 border-slate-700 w-full max-w-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Create New Room</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowCreateRoom(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      ×
                    </Button>
                  </div>
                  <CardDescription className="text-slate-300">
                    Choose your stake amount to create a new lobby
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { stake: 0, label: "FREE", color: "bg-green-600 hover:bg-green-700 border-green-500" },
                      { stake: 10, label: "10 coins", color: "bg-blue-600 hover:bg-blue-700 border-blue-500" },
                      { stake: 50, label: "50 coins", color: "bg-yellow-600 hover:bg-yellow-700 border-yellow-500" },
                      { stake: 100, label: "100 coins", color: "bg-orange-600 hover:bg-orange-700 border-orange-500" },
                      { stake: 500, label: "500 coins", color: "bg-red-600 hover:bg-red-700 border-red-500" },
                      { stake: 1000, label: "1,000 coins", color: "bg-purple-600 hover:bg-purple-700 border-purple-500" }
                    ].map(({ stake, label, color }) => {
                      const userCoins = user?.currency || 0;
                      const canAfford = stake === 0 || userCoins >= stake;
                      
                      return (
                        <Button
                          key={stake}
                          className={`${color} text-white border ${
                            !canAfford ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          onClick={() => canAfford && handleCreateRoom(stake)}
                          disabled={!canAfford}
                          data-testid={`create-room-${stake}`}
                        >
                          {label}
                          {!canAfford && stake > 0 && (
                            <div className="text-xs opacity-75 mt-1">Need {stake}</div>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <div className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded">
                    <i className="fas fa-info-circle mr-1"></i>
                    As room creator, you'll be the crown holder and can control lobby settings.
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="friends" className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-game-gold" />
              Friends
            </h3>

            {/* Add Friend */}
            <Card className="bg-slate-800/80 backdrop-blur-sm border-slate-700 shadow-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-400" />
                  Add Friend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter friend code"
                    value={friendCode}
                    onChange={(e) => setFriendCode(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    data-testid="input-friend-code"
                  />
                  <Button 
                    onClick={handleAddFriend}
                    disabled={addFriendMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-add-friend"
                  >
                    {addFriendMutation.isPending ? (
                      <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Friends List */}
            {friends.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h5 className="text-white font-semibold mb-2">No friends yet</h5>
                  <p className="text-slate-400">Add friends to play together!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {friends.map((friend) => (
                  <Card key={friend.id} className="bg-slate-800/80 backdrop-blur-sm border-slate-700 shadow-xl hover:border-game-gold/30 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${friend.isOnline ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                          <div>
                            <p className="text-white font-semibold">{friend.firstName} {friend.lastName}</p>
                            <p className="text-slate-400 text-sm">Level {friend.level}</p>
                          </div>
                        </div>
                        {friend.isOnline && (
                          <Button size="sm" className="bg-game-gold hover:bg-game-gold/90 text-black">
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Invite
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tournaments" className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-game-gold" />
              Tournaments
            </h3>

            {tournaments.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="text-center py-8">
                  <Trophy className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h5 className="text-white font-semibold mb-2">No tournaments available</h5>
                  <p className="text-slate-400">Check back later for exciting tournaments!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {tournaments.map((tournament) => (
                  <Card key={tournament.id} className="bg-slate-800/80 backdrop-blur-sm border-slate-700 shadow-xl hover:border-game-gold/30 transition-all">
                    <CardHeader>
                      <CardTitle className="text-white">{tournament.name}</CardTitle>
                      <CardDescription className="text-slate-300">{tournament.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-slate-300">Prize Pool: <span className="text-game-gold font-semibold">{tournament.prizePool} coins</span></p>
                          <p className="text-slate-300">Participants: <span className="text-white">{tournament.currentParticipants}/{tournament.maxParticipants}</span></p>
                        </div>
                        <Button className="bg-game-gold hover:bg-game-gold/90 text-black">
                          Join Tournament
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}