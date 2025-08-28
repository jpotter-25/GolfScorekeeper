import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, GamepadIcon, Trophy, MessageCircle, UserPlus, ArrowLeft, Home, Settings } from "lucide-react";
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
  const websocket = useWebSocket();
  const [friendCode, setFriendCode] = useState("");
  const [privateRoomCode, setPrivateRoomCode] = useState("");

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

  // Make QueryClient available for WebSocket updates
  useEffect(() => {
    (window as any).__reactQueryClient__ = queryClient;
  }, [queryClient]);

  // Fetch ALL available lobbies (with reduced polling since we have real-time updates)
  const { data: allLobbiesData = [], isLoading: lobbiesLoading } = useQuery({
    queryKey: ['/api/game-rooms/all-lobbies'],
    queryFn: () => fetch('/api/game-rooms/all-lobbies').then(r => r.json()),
    refetchInterval: 30000, // Reduced to 30 seconds since WebSocket provides real-time updates
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

  const handleJoinPrivateRoom = () => {
    if (!privateRoomCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room code",
        variant: "destructive",
      });
      return;
    }
    // Assume private rooms have a default bet amount, or fetch it
    handleJoinLobby(privateRoomCode.toUpperCase(), 0);
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
    <div className="min-h-screen" style={{ backgroundColor: '#2a3f5f' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors px-3 py-2"
            data-testid="button-home"
          >
            <Home className="w-5 h-5 mr-2" />
            <span>Home</span>
          </Button>
          
          <div>
            <h1 className="text-xl font-semibold text-white">Multiplayer Lobbies</h1>
            <p className="text-sm text-gray-400">
              {user?.currency || 990} coins • Level {user?.level || 1}
            </p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          onClick={() => setLocation("/settings")}
          className="text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors px-3 py-2"
          data-testid="button-settings"
        >
          <Settings className="w-5 h-5 mr-2" />
          <span>Settings</span>
        </Button>
      </header>

      <Tabs defaultValue="rooms" className="w-full px-6">
        <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 h-auto gap-2">
          <TabsTrigger 
            value="rooms" 
            className="relative px-4 py-3 text-gray-400 data-[state=active]:text-white data-[state=active]:bg-blue-600 rounded-t-lg transition-colors" 
            style={{
              backgroundColor: 'transparent',
            }}
            data-testid="tab-rooms"
          >
            <span className="flex items-center gap-2">
              <GamepadIcon className="w-4 h-4" />
              Game Lobbies
            </span>
            <div className="absolute bottom-0 left-4 right-4 h-1 bg-yellow-400 rounded-full data-[state=inactive]:hidden" />
          </TabsTrigger>
          <TabsTrigger 
            value="friends" 
            className="relative px-4 py-3 text-gray-400 data-[state=active]:text-white data-[state=active]:bg-blue-600 rounded-t-lg transition-colors"
            data-testid="tab-friends"
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Friends ({friends.length})
            </span>
          </TabsTrigger>
          <TabsTrigger 
            value="tournaments" 
            className="relative px-4 py-3 text-gray-400 data-[state=active]:text-white data-[state=active]:bg-blue-600 rounded-t-lg transition-colors"
            data-testid="tab-tournaments"
          >
            <span className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Tournaments
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="px-6 mt-0">
          <div className="bg-gray-800/50 rounded-lg p-6 space-y-6">
            {/* Header Section */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Game Lobbies</h2>
                <p className="text-gray-400">Join active games or create your own room</p>
              </div>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
                onClick={() => setShowCreateRoom(true)}
                data-testid="button-create-room"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Room
              </Button>
            </div>

            {/* Join Private Room Section */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-600/20 rounded flex items-center justify-center">
                  <i className="fas fa-key text-blue-400 text-sm"></i>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Join Private Room</h3>
                  <p className="text-gray-400 text-sm">Enter a room code to join a private lobby</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="Enter room code (e.g., ABC123)"
                  value={privateRoomCode}
                  onChange={(e) => setPrivateRoomCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-gray-800 border-gray-600 text-white placeholder-gray-500"
                  maxLength={6}
                />
                <Button
                  onClick={handleJoinPrivateRoom}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                  data-testid="button-join-private"
                >
                  Join Room
                </Button>
              </div>
            </div>

            {/* Filter by Stakes */}
            <div>
              <h3 className="text-white font-semibold mb-3">Filter by Stakes</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { stake: 0, label: "FREE", color: "green" },
                  { stake: 10, label: "10 coins", color: "blue" },
                  { stake: 50, label: "50 coins", color: "yellow" },
                  { stake: 100, label: "100 coins", color: "orange" },
                  { stake: 500, label: "500 coins", color: "red" },
                  { stake: 1000, label: "1K coins", color: "purple" }
                ].map(({ stake, label, color }) => {
                  const isActive = stakeFilters.includes(stake);
                  const colorClasses = {
                    green: isActive ? 'bg-green-600 text-white border-green-600' : 'bg-transparent text-green-400 border-green-600',
                    blue: isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-blue-400 border-blue-600',
                    yellow: isActive ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-transparent text-yellow-400 border-yellow-600',
                    orange: isActive ? 'bg-orange-600 text-white border-orange-600' : 'bg-transparent text-orange-400 border-orange-600',
                    red: isActive ? 'bg-red-600 text-white border-red-600' : 'bg-transparent text-red-400 border-red-600',
                    purple: isActive ? 'bg-purple-600 text-white border-purple-600' : 'bg-transparent text-purple-400 border-purple-600'
                  };
                  
                  return (
                    <button
                      key={stake}
                      onClick={() => toggleStakeFilter(stake)}
                      className={`px-4 py-2 rounded-full border-2 transition-colors ${colorClasses[color as keyof typeof colorClasses]}`}
                      data-testid={`filter-stake-${stake}`}
                    >
                      <i className={`fas fa-${stake === 0 ? 'check' : 'coins'} mr-2 text-sm`}></i>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Lobbies Section */}
            <div>
              <h3 className="text-white font-semibold mb-3">
                Active Lobbies ({sortedLobbies.length})
              </h3>

              {lobbiesLoading ? (
                <div className="bg-gray-900/50 rounded-lg p-8">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto bg-blue-600/20 rounded-full flex items-center justify-center mb-4">
                      <i className="fas fa-spinner fa-spin text-blue-400 text-lg"></i>
                    </div>
                    <p className="text-gray-400">Loading lobbies...</p>
                  </div>
                </div>
              ) : sortedLobbies.length === 0 ? (
                <div className="bg-gray-900/50 rounded-lg p-12">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                      <GamepadIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="text-white font-semibold text-lg mb-2">No active lobbies</h4>
                    <p className="text-gray-400 mb-6">Be the first to create a lobby!</p>
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                      onClick={() => setShowCreateRoom(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Lobby
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {sortedLobbies.map((lobby: any) => {
                    const userCoins = user?.currency || 0;
                    const canJoin = userCoins >= lobby.betAmount && lobby.playerCount < lobby.maxPlayers;
                    
                    return (
                      <Card 
                        key={lobby.code} 
                        className="bg-gray-900/50 border-gray-700 hover:border-gray-600 transition-all"
                        data-testid={`lobby-card-${lobby.code}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-white font-semibold">{lobby.crownHolderName}'s Room</h4>
                                <Badge className="bg-gray-700 text-gray-300">{lobby.code}</Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm">
                                <span className="text-gray-400">
                                  <i className="fas fa-users mr-1"></i>
                                  {lobby.playerCount}/{lobby.maxPlayers} players
                                </span>
                                <span className="text-gray-400">
                                  <i className="fas fa-coins mr-1"></i>
                                  {lobby.betAmount === 0 ? 'FREE' : `${lobby.betAmount} coins`}
                                </span>
                                <span className="text-gray-400">
                                  <i className="fas fa-trophy mr-1"></i>
                                  {lobby.rounds} rounds
                                </span>
                              </div>
                            </div>
                            <Button 
                              className={`${
                                canJoin 
                                  ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                  : "bg-gray-700 text-gray-400 cursor-not-allowed"
                              }`}
                              onClick={() => canJoin && handleJoinLobby(lobby.code, lobby.betAmount)}
                              disabled={!canJoin}
                              data-testid={`join-lobby-${lobby.code}`}
                            >
                              {lobby.playerCount >= lobby.maxPlayers ? "Full" : userCoins < lobby.betAmount ? "Insufficient" : "Join"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Create Room Modal */}
          {showCreateRoom && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <Card className="bg-gray-800 border-gray-700 w-full max-w-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Create New Room</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowCreateRoom(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      ×
                    </Button>
                  </div>
                  <CardDescription className="text-gray-400">
                    Choose your stake amount to create a new lobby
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { stake: 0, label: "FREE", color: "bg-green-600 hover:bg-green-700" },
                      { stake: 10, label: "10 coins", color: "bg-blue-600 hover:bg-blue-700" },
                      { stake: 50, label: "50 coins", color: "bg-yellow-600 hover:bg-yellow-700" },
                      { stake: 100, label: "100 coins", color: "bg-orange-600 hover:bg-orange-700" },
                      { stake: 500, label: "500 coins", color: "bg-red-600 hover:bg-red-700" },
                      { stake: 1000, label: "1,000 coins", color: "bg-purple-600 hover:bg-purple-700" }
                    ].map(({ stake, label, color }) => {
                      const userCoins = user?.currency || 0;
                      const canAfford = stake === 0 || userCoins >= stake;
                      
                      return (
                        <Button
                          key={stake}
                          className={`${color} text-white ${
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
                  
                  <div className="text-xs text-gray-400 bg-gray-900/50 p-3 rounded">
                    <i className="fas fa-info-circle mr-1"></i>
                    As room creator, you'll be the crown holder and can control lobby settings.
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="friends" className="px-6 mt-0">
          <div className="bg-gray-800/50 rounded-lg p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Friends</h2>
              <p className="text-gray-400">Connect with friends to play together</p>
            </div>

            {/* Add Friend */}
            <Card className="bg-gray-900/50 border-gray-700">
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
                    className="bg-gray-800 border-gray-600 text-white placeholder-gray-500"
                    data-testid="input-friend-code"
                  />
                  <Button 
                    onClick={handleAddFriend}
                    disabled={addFriendMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
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
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h5 className="text-white font-semibold mb-2">No friends yet</h5>
                  <p className="text-gray-400">Add friends to play together!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {friends.map((friend) => (
                  <Card key={friend.id} className="bg-gray-900/50 border-gray-700 hover:border-gray-600 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${friend.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                          <div>
                            <p className="text-white font-semibold">{friend.firstName} {friend.lastName}</p>
                            <p className="text-gray-400 text-sm">Level {friend.level}</p>
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

        <TabsContent value="tournaments" className="px-6 mt-0">
          <div className="bg-gray-800/50 rounded-lg p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Tournaments</h2>
              <p className="text-gray-400">Compete for prizes in tournament events</p>
            </div>

            {tournaments.length === 0 ? (
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="text-center py-8">
                  <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h5 className="text-white font-semibold mb-2">No tournaments available</h5>
                  <p className="text-gray-400">Check back later for exciting tournaments!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {tournaments.map((tournament) => (
                  <Card key={tournament.id} className="bg-gray-900/50 border-gray-700 hover:border-gray-600 transition-all">
                    <CardHeader>
                      <CardTitle className="text-white">{tournament.name}</CardTitle>
                      <CardDescription className="text-gray-400">{tournament.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-gray-300">Prize Pool: <span className="text-yellow-400 font-semibold">{tournament.prizePool} coins</span></p>
                          <p className="text-gray-300">Participants: <span className="text-white">{tournament.currentParticipants}/{tournament.maxParticipants}</span></p>
                        </div>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
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