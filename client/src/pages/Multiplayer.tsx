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
          {/* New Consolidated Lobby Browser */}
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <i className="fas fa-users text-game-gold"></i>
                  Game Lobbies
                </h3>
                <p className="text-slate-300 text-sm mt-1">
                  Browse all active lobbies, filter by stakes, or create your own room
                </p>
              </div>
              
              {/* Create Room Button */}
              <Button 
                className="bg-game-gold hover:bg-game-gold/90 text-black font-semibold px-6"
                onClick={() => setShowCreateRoom(true)}
                data-testid="button-create-room"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Room
              </Button>
            </div>

            {/* Stake Filters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-semibold">Filter by Stakes:</h4>
                {stakeFilters.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={clearFilters}
                  >
                    Clear All
                  </Button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {[0, 10, 50, 100, 500, 1000].map((stake) => {
                  const isActive = stakeFilters.includes(stake);
                  const colors = {
                    0: "bg-green-600 border-green-500 text-white",
                    10: "bg-blue-600 border-blue-500 text-white", 
                    50: "bg-yellow-600 border-yellow-500 text-white",
                    100: "bg-orange-600 border-orange-500 text-white",
                    500: "bg-red-600 border-red-500 text-white",
                    1000: "bg-purple-600 border-purple-500 text-white"
                  };
                  const labels = {
                    0: "FREE",
                    10: "10 coins",
                    50: "50 coins", 
                    100: "100 coins",
                    500: "500 coins",
                    1000: "1,000 coins"
                  };
                  
                  return (
                    <Button
                      key={stake}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={isActive 
                        ? colors[stake as keyof typeof colors]
                        : "border-slate-600 text-slate-300 hover:bg-slate-700"
                      }
                      onClick={() => toggleStakeFilter(stake)}
                      data-testid={`filter-stake-${stake}`}
                    >
                      {labels[stake as keyof typeof labels]}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Lobbies Section */}
            <div className="space-y-4">
              {lobbiesLoading ? (
                <div className="text-center py-12">
                  <i className="fas fa-spinner fa-spin text-slate-400 text-3xl mb-4"></i>
                  <p className="text-slate-400">Loading lobbies...</p>
                </div>
              ) : sortedLobbies.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="text-center py-12">
                    <i className="fas fa-inbox text-slate-400 text-4xl mb-4"></i>
                    <h5 className="text-white font-semibold text-lg mb-2">
                      {stakeFilters.length > 0 ? "No lobbies match your filters" : "No active lobbies"}
                    </h5>
                    <p className="text-slate-400 mb-6">
                      {stakeFilters.length > 0 
                        ? "Try adjusting your stake filters or create a new lobby" 
                        : "Be the first to create a lobby!"
                      }
                    </p>
                    <Button 
                      className="bg-game-gold hover:bg-game-gold/90 text-black"
                      onClick={() => setShowCreateRoom(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Lobby
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Horizontal Scrolling Lobby Cards */}
                  <div className="relative">
                    <div 
                      className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      {sortedLobbies.map((lobby: any) => {
                        const userCoins = user?.currency || 0;
                        const canJoin = userCoins >= lobby.betAmount && lobby.playerCount < lobby.maxPlayers;
                        
                        const stakeColors = {
                          0: "border-green-500/50 hover:border-green-400",
                          10: "border-blue-500/50 hover:border-blue-400",
                          50: "border-yellow-500/50 hover:border-yellow-400", 
                          100: "border-orange-500/50 hover:border-orange-400",
                          500: "border-red-500/50 hover:border-red-400",
                          1000: "border-purple-500/50 hover:border-purple-400"
                        };
                        
                        return (
                          <Card 
                            key={lobby.code} 
                            className={`bg-slate-800/80 backdrop-blur-sm border-2 shadow-xl transition-all duration-200 min-w-[320px] snap-start ${
                              stakeColors[lobby.betAmount as keyof typeof stakeColors] || "border-slate-700 hover:border-slate-600"
                            }`}
                            data-testid={`lobby-card-${lobby.code}`}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-game-gold/20 rounded-full flex items-center justify-center">
                                    <i className="fas fa-crown text-game-gold"></i>
                                  </div>
                                  <div>
                                    <CardTitle className="text-white text-lg">{lobby.crownHolderName}</CardTitle>
                                    <CardDescription className="text-slate-400 text-sm">
                                      Room: {lobby.code}
                                    </CardDescription>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-white font-bold text-lg">
                                    {lobby.playerCount}/{lobby.maxPlayers}
                                  </div>
                                  <div className="text-slate-400 text-xs">players</div>
                                </div>
                              </div>
                            </CardHeader>
                            
                            <CardContent>
                              <div className="space-y-3 mb-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-300">Entry:</span>
                                  <Badge className={`${
                                    lobby.betAmount === 0 ? "bg-green-600" :
                                    lobby.betAmount <= 50 ? "bg-blue-600" :
                                    lobby.betAmount <= 100 ? "bg-orange-600" :
                                    lobby.betAmount <= 500 ? "bg-red-600" : "bg-purple-600"
                                  } text-white font-semibold`}>
                                    {lobby.betAmount === 0 ? 'FREE' : `${lobby.betAmount} coins`}
                                  </Badge>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-300">Rounds:</span>
                                  <span className="text-white">{lobby.rounds}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-300">Prize Pool:</span>
                                  <span className="text-game-gold font-semibold">
                                    {lobby.prizePool || (lobby.betAmount * 4)} coins
                                  </span>
                                </div>
                              </div>
                              
                              <Button 
                                className={`w-full ${
                                  canJoin 
                                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                    : "bg-slate-600 text-slate-400 cursor-not-allowed"
                                }`}
                                onClick={() => canJoin && handleJoinLobby(lobby.code, lobby.betAmount)}
                                disabled={!canJoin}
                                data-testid={`join-lobby-${lobby.code}`}
                              >
                                {lobby.playerCount >= lobby.maxPlayers ? (
                                  <><i className="fas fa-lock mr-2"></i>Lobby Full</>
                                ) : userCoins < lobby.betAmount ? (
                                  <><i className="fas fa-coins mr-2"></i>Need {lobby.betAmount} coins</>
                                ) : (
                                  <><i className="fas fa-sign-in-alt mr-2"></i>Join Lobby</>
                                )}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    
                    {/* Scroll Indicators */}
                    {sortedLobbies.length > 2 && (
                      <div className="absolute top-1/2 transform -translate-y-1/2 left-2 right-2 flex justify-between pointer-events-none">
                        <div className="bg-slate-900/80 text-slate-400 px-2 py-1 rounded text-xs">
                          ← Swipe for more
                        </div>
                        <div className="bg-slate-900/80 text-slate-400 px-2 py-1 rounded text-xs">
                          Swipe →
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