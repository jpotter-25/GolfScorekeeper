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
  const [selectedBetAmount, setSelectedBetAmount] = useState<number | null>(null);

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

  // Join betting room mutation
  const joinBettingRoomMutation = useMutation({
    mutationFn: async (betAmount: number) => {
      const res = await apiRequest('POST', '/api/game-rooms/join-betting', { betAmount });
      return res.json();
    },
    onSuccess: (data: any) => {
      const betAmount = data.room?.betAmount || 0;
      toast({
        title: "Joining Game",
        description: `Bet placed! Joining ${betAmount === 0 ? 'free' : `${betAmount} coin`} game...`,
      });
      
      // Navigate to the game room
      setLocation(`/multiplayer/game?room=${data.code}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join game",
        variant: "destructive",
      });
    },
  });

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

  const handleJoinBettingRoom = (betAmount: number) => {
    // Check if user has enough coins (coins are stored in user.currency)
    const userCoins = user?.currency || 0;
    if (betAmount > 0 && userCoins < betAmount) {
      toast({
        title: "Insufficient Coins",
        description: `You need ${betAmount} coins to join this game. You have ${userCoins} coins.`,
        variant: "destructive",
      });
      return;
    }

    joinBettingRoomMutation.mutate(betAmount);
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

    addFriendMutation.mutate(friendCode.toUpperCase());
  };

  // Calculate user display data
  const displayName = user?.firstName 
    ? `${user.firstName}${user?.lastName ? ` ${user.lastName}` : ''}`
    : user?.email?.split('@')[0] 
    ? user.email.split('@')[0] 
    : 'Player';

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt" data-testid="multiplayer-page">
      <div className="container mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-transparent bg-gradient-to-r from-game-gold to-blue-300 bg-clip-text mb-4 flex items-center justify-center gap-4">
            <div className="w-16 h-16 bg-game-gold/20 rounded-full flex items-center justify-center">
              <i className="fas fa-wifi text-game-gold text-2xl"></i>
            </div>
            Multiplayer Hub
          </h1>
          <p className="text-game-cream opacity-90 text-lg">Connect with friends and compete online</p>
        </div>

        {/* User Profile Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center p-3 sm:p-6 bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/30 shadow-2xl rounded-lg space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center border-2 border-blue-500 overflow-hidden">
              {(() => {
                const equippedAvatar = userCosmetics.find((cosmetic: any) => 
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
                if (user?.profileImageUrl) {
                  return (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  );
                }
                return <i className="fas fa-user text-white text-lg sm:text-xl"></i>;
              })()}
            </div>
            <div className="text-white">
              <div className="font-semibold text-sm sm:text-base">{displayName}</div>
              <div className="text-xs sm:text-sm opacity-80">Level 1 • 0 XP</div>
              <div className="text-xs sm:text-sm text-yellow-300 font-medium">{user?.currency || 0} coins</div>
            </div>
          </div>
          
          <div className="flex gap-1 sm:gap-2 md:gap-3 w-full sm:w-auto justify-center sm:justify-end">
            <Button
              onClick={() => setLocation("/")}
              className="bg-slate-800/80 hover:bg-slate-700/80 border-2 border-game-gold/30 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm flex-1 sm:flex-none"
              data-testid="button-home"
            >
              <Home className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            <Button 
              onClick={() => setLocation('/cosmetics')}
              className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/50 text-game-gold hover:bg-slate-700 hover:border-game-gold hover:shadow-lg hover:shadow-game-gold/20 transition-all duration-200 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm flex-1 sm:flex-none"
              data-testid="button-cosmetics"
            >
              <i className="fas fa-palette text-xs sm:text-sm sm:mr-2"></i>
              <span className="hidden sm:inline">Cosmetics</span>
            </Button>
            <Button 
              onClick={() => setLocation('/settings?return=/multiplayer')}
              className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/50 text-game-gold hover:bg-slate-700 hover:border-game-gold hover:shadow-lg hover:shadow-game-gold/20 transition-all duration-200 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm flex-1 sm:flex-none"
              data-testid="button-settings"
            >
              <i className="fas fa-cog text-xs sm:text-sm sm:mr-2"></i>
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </header>

      <Tabs defaultValue="rooms" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/90 backdrop-blur-sm border-2 border-game-gold/30">
          <TabsTrigger value="rooms" className="text-white data-[state=active]:text-game-gold data-[state=active]:bg-slate-700/50" data-testid="tab-rooms">
            <GamepadIcon className="w-4 h-4 mr-2" />
            Betting Games
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

          {/* Betting Brackets */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <i className="fas fa-trophy text-game-gold"></i>
              Choose Your Stake
            </h3>
            <p className="text-slate-300 mb-6">Select your bet amount to join or create a game. Winner takes 70%, second place gets 30%.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Free Games */}
              <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-green-500/30 shadow-2xl hover:border-green-400 transition-all duration-200 cursor-pointer" 
                    onClick={() => handleJoinBettingRoom(0)}
                    data-testid="card-bet-free">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-green-600 text-white">FREE</Badge>
                    <i className="fas fa-heart text-green-400 text-lg"></i>
                  </div>
                  <CardTitle className="text-white text-xl">Free Game</CardTitle>
                  <CardDescription className="text-slate-200">
                    Practice without risk
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Entry:</span>
                      <span className="text-green-400 font-semibold">FREE</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">1st Place:</span>
                      <span className="text-white">1 coin</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">2nd Place:</span>
                      <span className="text-white">0 coins</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
                    disabled={joinBettingRoomMutation.isPending}
                  >
                    Join Free Game
                  </Button>
                </CardContent>
              </Card>

              {/* Low Stakes */}
              <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-blue-500/30 shadow-2xl hover:border-blue-400 transition-all duration-200 cursor-pointer" 
                    onClick={() => handleJoinBettingRoom(10)}
                    data-testid="card-bet-10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-blue-600 text-white">LOW</Badge>
                    <i className="fas fa-seedling text-blue-400 text-lg"></i>
                  </div>
                  <CardTitle className="text-white text-xl">Starter Stakes</CardTitle>
                  <CardDescription className="text-slate-200">
                    Perfect for beginners
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Entry:</span>
                      <span className="text-blue-400 font-semibold">10 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">1st Place:</span>
                      <span className="text-white">28 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">2nd Place:</span>
                      <span className="text-white">12 coins</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={joinBettingRoomMutation.isPending || (user?.currency || 0) < 10}
                  >
                    {(user?.currency || 0) < 10 ? "Need 10 coins" : "Bet 10 Coins"}
                  </Button>
                </CardContent>
              </Card>

              {/* Medium Stakes */}
              <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-yellow-500/30 shadow-2xl hover:border-yellow-400 transition-all duration-200 cursor-pointer" 
                    onClick={() => handleJoinBettingRoom(50)}
                    data-testid="card-bet-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-yellow-600 text-white">MEDIUM</Badge>
                    <i className="fas fa-fire text-yellow-400 text-lg"></i>
                  </div>
                  <CardTitle className="text-white text-xl">Rising Stakes</CardTitle>
                  <CardDescription className="text-slate-200">
                    For confident players
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Entry:</span>
                      <span className="text-yellow-400 font-semibold">50 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">1st Place:</span>
                      <span className="text-white">140 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">2nd Place:</span>
                      <span className="text-white">60 coins</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-white"
                    disabled={joinBettingRoomMutation.isPending || (user?.currency || 0) < 50}
                  >
                    {(user?.currency || 0) < 50 ? "Need 50 coins" : "Bet 50 Coins"}
                  </Button>
                </CardContent>
              </Card>

              {/* High Stakes */}
              <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-orange-500/30 shadow-2xl hover:border-orange-400 transition-all duration-200 cursor-pointer" 
                    onClick={() => handleJoinBettingRoom(100)}
                    data-testid="card-bet-100">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-orange-600 text-white">HIGH</Badge>
                    <i className="fas fa-lightning text-orange-400 text-lg"></i>
                  </div>
                  <CardTitle className="text-white text-xl">High Roller</CardTitle>
                  <CardDescription className="text-slate-200">
                    Serious competition
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Entry:</span>
                      <span className="text-orange-400 font-semibold">100 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">1st Place:</span>
                      <span className="text-white">280 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">2nd Place:</span>
                      <span className="text-white">120 coins</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white"
                    disabled={joinBettingRoomMutation.isPending || (user?.currency || 0) < 100}
                  >
                    {(user?.currency || 0) < 100 ? "Need 100 coins" : "Bet 100 Coins"}
                  </Button>
                </CardContent>
              </Card>

              {/* Elite Stakes */}
              <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-red-500/30 shadow-2xl hover:border-red-400 transition-all duration-200 cursor-pointer" 
                    onClick={() => handleJoinBettingRoom(500)}
                    data-testid="card-bet-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-red-600 text-white">ELITE</Badge>
                    <i className="fas fa-crown text-red-400 text-lg"></i>
                  </div>
                  <CardTitle className="text-white text-xl">Elite Stakes</CardTitle>
                  <CardDescription className="text-slate-200">
                    For champions only
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Entry:</span>
                      <span className="text-red-400 font-semibold">500 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">1st Place:</span>
                      <span className="text-white">1,400 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">2nd Place:</span>
                      <span className="text-white">600 coins</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white"
                    disabled={joinBettingRoomMutation.isPending || (user?.currency || 0) < 500}
                  >
                    {(user?.currency || 0) < 500 ? "Need 500 coins" : "Bet 500 Coins"}
                  </Button>
                </CardContent>
              </Card>

              {/* Legendary Stakes */}
              <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-purple-500/30 shadow-2xl hover:border-purple-400 transition-all duration-200 cursor-pointer" 
                    onClick={() => handleJoinBettingRoom(1000)}
                    data-testid="card-bet-1000">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-purple-600 text-white">LEGEND</Badge>
                    <i className="fas fa-star text-purple-400 text-lg"></i>
                  </div>
                  <CardTitle className="text-white text-xl">Legendary</CardTitle>
                  <CardDescription className="text-slate-200">
                    Ultimate stakes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Entry:</span>
                      <span className="text-purple-400 font-semibold">1,000 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">1st Place:</span>
                      <span className="text-white">2,800 coins</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">2nd Place:</span>
                      <span className="text-white">1,200 coins</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={joinBettingRoomMutation.isPending || (user?.currency || 0) < 1000}
                  >
                    {(user?.currency || 0) < 1000 ? "Need 1,000 coins" : "Bet 1,000 Coins"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="friends" className="space-y-6">
          {/* Add Friend Card */}
          <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-blue-500/30 shadow-2xl" data-testid="card-add-friend">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Add Friend
              </CardTitle>
              <CardDescription className="text-slate-200">
                Enter a friend's 6-character friend code to send them a request
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Enter friend code..."
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="bg-slate-700/70 border-slate-500 text-white placeholder:text-slate-300 focus:border-blue-400 focus:bg-slate-700/90 font-mono text-center tracking-wider text-lg"
                data-testid="input-friend-code"
              />
              <Button 
                onClick={handleAddFriend}
                disabled={addFriendMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                data-testid="button-add-friend"
              >
                {addFriendMutation.isPending ? "Sending..." : "Send Friend Request"}
              </Button>
              <div className="mt-4 p-4 bg-gradient-to-r from-game-gold/10 to-blue-500/10 rounded-lg border-2 border-game-gold/40">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-id-card text-game-gold"></i>
                  <p className="text-lg font-semibold text-white">Your Friend Code</p>
                </div>
                <p className="font-mono text-game-gold text-2xl font-bold tracking-wider text-center bg-slate-800/70 py-3 px-6 rounded-lg border-2 border-game-gold/50 shadow-inner">
                  {user?.friendCode || "Loading..."}
                </p>
                <p className="text-xs text-slate-400 text-center mt-2">Share this code with friends to connect!</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/30 shadow-2xl" data-testid="card-friends">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-game-gold" />
                Your Friends
              </CardTitle>
              <CardDescription className="text-slate-200">
                {friends.length === 0 
                  ? "No friends yet. Start playing to meet other players!"
                  : `You have ${friends.length} friend${friends.length === 1 ? '' : 's'}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <div className="text-center py-8 text-slate-300">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-60 text-game-gold" />
                  <p className="text-lg">Your friends list is empty</p>
                  <p className="text-sm text-slate-400">Play some games to meet other players!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                      data-testid={`friend-${friend.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {friend.firstName?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {friend.firstName} {friend.lastName}
                          </p>
                          <p className="text-sm text-slate-300">
                            Level {friend.level}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={friend.isOnline ? "default" : "secondary"}>
                          {friend.isOnline ? "Online" : "Offline"}
                        </Badge>
                        <Button size="sm" variant="outline" data-testid={`button-challenge-${friend.id}`}>
                          Challenge
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tournaments" className="space-y-6">
          <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/30 shadow-2xl" data-testid="card-tournaments">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-game-gold" />
                Active Tournaments
              </CardTitle>
              <CardDescription className="text-slate-200">
                Compete in organized competitions for prizes and glory
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tournaments.length === 0 ? (
                <div className="text-center py-8 text-slate-300">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-60 text-game-gold" />
                  <p className="text-lg">No active tournaments</p>
                  <p className="text-sm text-slate-400">Check back later for competitive events!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tournaments.map((tournament) => (
                    <div
                      key={tournament.id}
                      className="border rounded-lg p-4"
                      data-testid={`tournament-${tournament.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{tournament.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {tournament.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span>
                              {tournament.currentParticipants}/{tournament.maxParticipants} players
                            </span>
                            {tournament.prizePool > 0 && (
                              <span className="text-green-600 font-medium">
                                {tournament.prizePool} coins prize pool
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge variant="outline">{tournament.status}</Badge>
                          <Button size="sm" data-testid={`button-join-tournament-${tournament.id}`}>
                            Join
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      </div>
    </div>
  );
}