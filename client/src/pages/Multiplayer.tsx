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
        window.location.href = `/multiplayer/game?room=${data.code}`;
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
        window.location.href = `/multiplayer/game?room=${data.code}`;
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
      <header className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700/50 p-4">
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
              className="bg-slate-800/80 backdrop-blur-sm border border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500 hover:text-white transition-all duration-200 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm flex-1 sm:flex-none"
              data-testid="button-settings"
            >
              <i className="fas fa-cog text-xs sm:text-sm sm:mr-2"></i>
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Separator space */}
      <div className="h-6"></div>

      <Tabs defaultValue="rooms" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-lg p-1 gap-1">
          <TabsTrigger 
            value="rooms" 
            className="relative text-slate-300 font-semibold transition-all duration-300 px-3 py-2.5 rounded-lg hover:bg-slate-700/50 hover:text-white data-[state=active]:text-black data-[state=active]:bg-gradient-to-r data-[state=active]:from-game-gold data-[state=active]:to-yellow-500 data-[state=active]:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-game-gold/50 focus-visible:ring-inset" 
            data-testid="tab-rooms"
          >
            <GamepadIcon className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Game Lobbies</span>
            <span className="sm:hidden truncate">Lobbies</span>
          </TabsTrigger>
          <TabsTrigger 
            value="friends" 
            className="relative text-slate-300 font-semibold transition-all duration-300 px-3 py-2.5 rounded-lg hover:bg-slate-700/50 hover:text-white data-[state=active]:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-inset" 
            data-testid="tab-friends"
          >
            <Users className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Friends ({friends.length})</span>
            <span className="sm:hidden truncate">Friends</span>
          </TabsTrigger>
          <TabsTrigger 
            value="tournaments" 
            className="relative text-slate-300 font-semibold transition-all duration-300 px-3 py-2.5 rounded-lg hover:bg-slate-700/50 hover:text-white data-[state=active]:text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-inset" 
            data-testid="tab-tournaments"
          >
            <Trophy className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Tournaments</span>
            <span className="sm:hidden truncate">Tournaments</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-6">
          {/* Streamlined Lobby Browser */}
          <div className="space-y-6">
            {/* Simple Header with Action */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-700/50">
              <div>
                <h3 className="text-2xl font-bold text-white">Game Lobbies</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Join active games or create your own room
                </p>
              </div>
              
              <Button 
                className="bg-game-gold hover:bg-game-gold/90 text-black font-semibold px-6 py-2 transition-all"
                onClick={() => setShowCreateRoom(true)}
                data-testid="button-create-room"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Room
              </Button>
            </div>

            {/* Compact Stake Filters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-white">Filter by Stakes</h4>
                {stakeFilters.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={clearFilters}
                  >
                    Clear ({stakeFilters.length})
                  </Button>
                )}
              </div>
              
              {/* Enhanced Filter Buttons */}
              <div className="flex flex-wrap gap-3">
                {[
                  { 
                    stake: 0, 
                    label: "FREE", 
                    icon: "fas fa-heart",
                    activeColor: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25",
                    inactiveColor: "bg-green-500/10 border-green-500/40 text-green-400 hover:bg-green-500/20 hover:border-green-500/60 hover:text-green-300"
                  },
                  { 
                    stake: 10, 
                    label: "10 coins", 
                    icon: "fas fa-coins",
                    activeColor: "bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/25",
                    inactiveColor: "bg-blue-500/10 border-blue-500/40 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/60 hover:text-blue-300"
                  },
                  { 
                    stake: 50, 
                    label: "50 coins", 
                    icon: "fas fa-fire",
                    activeColor: "bg-gradient-to-r from-yellow-500 to-amber-600 text-black shadow-lg shadow-yellow-500/25",
                    inactiveColor: "bg-yellow-500/10 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500/60 hover:text-yellow-300"
                  },
                  { 
                    stake: 100, 
                    label: "100 coins", 
                    icon: "fas fa-lightning",
                    activeColor: "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25",
                    inactiveColor: "bg-orange-500/10 border-orange-500/40 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/60 hover:text-orange-300"
                  },
                  { 
                    stake: 500, 
                    label: "500 coins", 
                    icon: "fas fa-crown",
                    activeColor: "bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg shadow-red-500/25",
                    inactiveColor: "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-300"
                  },
                  { 
                    stake: 1000, 
                    label: "1K coins", 
                    icon: "fas fa-star",
                    activeColor: "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25",
                    inactiveColor: "bg-purple-500/10 border-purple-500/40 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/60 hover:text-purple-300"
                  }
                ].map(({ stake, label, icon, activeColor, inactiveColor }) => {
                  const isActive = stakeFilters.includes(stake);
                  
                  return (
                    <Button
                      key={stake}
                      variant="outline"
                      size="sm"
                      className={`relative overflow-hidden border transition-all duration-300 font-semibold px-4 py-2 ${
                        isActive ? activeColor : inactiveColor
                      }`}
                      onClick={() => toggleStakeFilter(stake)}
                      data-testid={`filter-stake-${stake}`}
                    >
                      <i className={`${icon} mr-2 text-sm`}></i>
                      {label}
                      {isActive && (
                        <div className="absolute inset-0 bg-white/10 rounded animate-pulse"></div>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Streamlined Lobbies Section */}
            <div className="space-y-4">
              {/* Simple section header */}
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-white">
                  Active Lobbies {!lobbiesLoading && `(${sortedLobbies.length})`}
                </h4>
                {!lobbiesLoading && sortedLobbies.length > 0 && (
                  <div className="text-slate-400 text-sm">Live</div>
                )}
              </div>

              {lobbiesLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-game-gold text-2xl mb-3"></i>
                  <p className="text-slate-400">Loading lobbies...</p>
                </div>
              ) : sortedLobbies.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <i className="fas fa-inbox text-slate-400 text-3xl mb-4"></i>
                  <h5 className="text-white font-semibold mb-2">
                    {stakeFilters.length > 0 ? "No lobbies match your filters" : "No active lobbies"}
                  </h5>
                  <p className="text-slate-400 mb-6">
                    {stakeFilters.length > 0 
                      ? "Try different stake filters or create a new lobby" 
                      : "Be the first to create a lobby!"
                    }
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      className="bg-game-gold hover:bg-game-gold/90 text-black font-semibold"
                      onClick={() => setShowCreateRoom(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Lobby
                    </Button>
                    {stakeFilters.length > 0 && (
                      <Button 
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={clearFilters}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Clean Lobby List */}
                  <div className="grid gap-4">
                    {sortedLobbies.map((lobby: any) => {
                      const userCoins = user?.currency || 0;
                      const canJoin = userCoins >= lobby.betAmount && lobby.playerCount < lobby.maxPlayers;
                      
                      const stakeColors = {
                        0: "border-l-green-500 bg-green-500/5",
                        10: "border-l-blue-500 bg-blue-500/5",
                        50: "border-l-yellow-500 bg-yellow-500/5",
                        100: "border-l-orange-500 bg-orange-500/5",
                        500: "border-l-red-500 bg-red-500/5",
                        1000: "border-l-purple-500 bg-purple-500/5"
                      };
                      
                      const badgeColors = {
                        0: "bg-green-600",
                        10: "bg-blue-600",
                        50: "bg-yellow-600",
                        100: "bg-orange-600",
                        500: "bg-red-600",
                        1000: "bg-purple-600"
                      };
                      
                      return (
                        <Card 
                          key={lobby.code} 
                          className={`bg-slate-800/80 border border-slate-700 border-l-4 hover:bg-slate-800 transition-colors ${
                            stakeColors[lobby.betAmount as keyof typeof stakeColors] || "border-l-slate-600 bg-slate-800/5"
                          }`}
                          data-testid={`lobby-card-${lobby.code}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              {/* Lobby Info */}
                              <div className="flex items-center gap-4 flex-1">
                                <div className="w-10 h-10 bg-game-gold/20 rounded-lg flex items-center justify-center">
                                  <i className="fas fa-crown text-game-gold text-sm"></i>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-1">
                                    <h5 className="text-white font-semibold">{lobby.crownHolderName}</h5>
                                    <Badge className={`${
                                      badgeColors[lobby.betAmount as keyof typeof badgeColors] || "bg-slate-600"
                                    } text-white text-xs px-2 py-1`}>
                                      {lobby.betAmount === 0 ? 'FREE' : `${lobby.betAmount} coins`}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-slate-400">
                                    <span>Room: {lobby.code}</span>
                                    <span>•</span>
                                    <span>{lobby.playerCount}/{lobby.maxPlayers} players</span>
                                    <span>•</span>
                                    <span>{lobby.rounds} rounds</span>
                                    <span>•</span>
                                    <span className="text-game-gold">
                                      {lobby.prizePool || (lobby.betAmount * 4)} coins prize
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Join Button */}
                              <Button 
                                className={`ml-4 ${
                                  canJoin 
                                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                    : "bg-slate-600 text-slate-400 cursor-not-allowed"
                                }`}
                                onClick={() => canJoin && handleJoinLobby(lobby.code, lobby.betAmount)}
                                disabled={!canJoin}
                                data-testid={`join-lobby-${lobby.code}`}
                              >
                                {lobby.playerCount >= lobby.maxPlayers ? (
                                  <>Lobby Full</>
                                ) : userCoins < lobby.betAmount ? (
                                  <>Need {lobby.betAmount}</>
                                ) : (
                                  <>Join</>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Simplified Create Room Modal */}
          {showCreateRoom && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <Card className="bg-slate-800 border-slate-700 w-full max-w-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-xl">Create New Room</CardTitle>
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
                    Select stake level for your lobby
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { stake: 0, label: "FREE", description: "Practice game", color: "bg-green-600 hover:bg-green-700" },
                      { stake: 10, label: "10 coins", description: "Low stakes", color: "bg-blue-600 hover:bg-blue-700" },
                      { stake: 50, label: "50 coins", description: "Medium stakes", color: "bg-yellow-600 hover:bg-yellow-700" },
                      { stake: 100, label: "100 coins", description: "High stakes", color: "bg-orange-600 hover:bg-orange-700" },
                      { stake: 500, label: "500 coins", description: "Elite stakes", color: "bg-red-600 hover:bg-red-700" },
                      { stake: 1000, label: "1,000 coins", description: "Legendary stakes", color: "bg-purple-600 hover:bg-purple-700" }
                    ].map(({ stake, label, description, color }) => {
                      const userCoins = user?.currency || 0;
                      const canAfford = stake === 0 || userCoins >= stake;
                      
                      return (
                        <Button
                          key={stake}
                          variant="outline"
                          className={`justify-between h-12 ${
                            canAfford 
                              ? "border-slate-600 text-white hover:bg-slate-700 hover:border-slate-500"
                              : "border-slate-700 text-slate-500 cursor-not-allowed"
                          }`}
                          onClick={() => canAfford && handleCreateRoom(stake)}
                          disabled={!canAfford}
                          data-testid={`create-room-${stake}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              stake === 0 ? "bg-green-500" :
                              stake <= 50 ? "bg-blue-500" :
                              stake <= 100 ? "bg-orange-500" :
                              stake <= 500 ? "bg-red-500" : "bg-purple-500"
                            }`}></div>
                            <div className="text-left">
                              <div className="font-semibold">{label}</div>
                              <div className="text-xs text-slate-400">{description}</div>
                            </div>
                          </div>
                          {!canAfford && stake > 0 ? (
                            <span className="text-xs text-slate-500">Need {stake}</span>
                          ) : (
                            <i className="fas fa-arrow-right text-slate-400"></i>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <div className="text-sm text-slate-400 bg-slate-900/50 p-3 rounded border border-slate-700/50">
                    <i className="fas fa-crown mr-2 text-game-gold"></i>
                    You'll become the crown holder and control lobby settings
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