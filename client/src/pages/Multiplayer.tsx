import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, GamepadIcon, Trophy, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");

  // Fetch friends
  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ['/api/friends'],
    retry: false,
  });

  // Fetch tournaments
  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ['/api/tournaments'],
    retry: false,
  });

  // Create game room mutation
  const createRoomMutation = useMutation({
    mutationFn: async (roomData: { name: string; maxPlayers: number; isPrivate: boolean }) => {
      return await apiRequest('/api/game-rooms', 'POST', roomData);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Room Created",
        description: `Game room "${data.name}" created with code: ${data.code}`,
      });
      setRoomName("");
      queryClient.invalidateQueries({ queryKey: ['/api/game-rooms'] });
      
      // Navigate to the game room
      setLocation(`/multiplayer/game?room=${data.code}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create game room",
        variant: "destructive",
      });
    },
  });

  // Join room by code mutation
  const joinRoomMutation = useMutation({
    mutationFn: async (code: string) => {
      return await apiRequest(`/api/game-rooms/${code}`, 'GET');
    },
    onSuccess: (data: any) => {
      toast({
        title: "Room Found",
        description: `Joining "${data.name}"...`,
      });
      
      // Navigate to the game room
      setLocation(`/multiplayer/game?room=${data.code}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Room not found or you don't have access",
        variant: "destructive",
      });
    },
  });

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room name",
        variant: "destructive",
      });
      return;
    }

    createRoomMutation.mutate({
      name: roomName,
      maxPlayers: 4,
      isPrivate: false,
    });
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room code",
        variant: "destructive",
      });
      return;
    }

    joinRoomMutation.mutate(roomCode.toUpperCase());
  };

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

      <Tabs defaultValue="rooms" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800/90 backdrop-blur-sm border-2 border-game-gold/30">
          <TabsTrigger value="rooms" className="text-white data-[state=active]:text-game-gold data-[state=active]:bg-slate-700/50" data-testid="tab-rooms">
            <GamepadIcon className="w-4 h-4 mr-2" />
            Game Rooms
          </TabsTrigger>
          <TabsTrigger value="friends" className="text-white data-[state=active]:text-game-gold data-[state=active]:bg-slate-700/50" data-testid="tab-friends">
            <Users className="w-4 h-4 mr-2" />
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="tournaments" className="text-white data-[state=active]:text-game-gold data-[state=active]:bg-slate-700/50" data-testid="tab-tournaments">
            <Trophy className="w-4 h-4 mr-2" />
            Tournaments
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-white data-[state=active]:text-game-gold data-[state=active]:bg-slate-700/50" data-testid="tab-chat">
            <MessageCircle className="w-4 h-4 mr-2" />
            Global Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Room */}
            <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/30 shadow-2xl" data-testid="card-create-room">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Plus className="w-5 h-5 text-game-gold" />
                  Create Room
                </CardTitle>
                <CardDescription className="text-slate-200">
                  Start a new multiplayer game session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Enter room name..."
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="bg-slate-700/70 border-slate-500 text-white placeholder:text-slate-300 focus:border-game-gold focus:bg-slate-700/90"
                  data-testid="input-room-name"
                />
                <Button 
                  onClick={handleCreateRoom}
                  disabled={createRoomMutation.isPending}
                  className="w-full bg-game-gold hover:bg-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  data-testid="button-create-room"
                >
                  {createRoomMutation.isPending ? "Creating..." : "Create Room"}
                </Button>
              </CardContent>
            </Card>

            {/* Join Room */}
            <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/30 shadow-2xl" data-testid="card-join-room">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <GamepadIcon className="w-5 h-5 text-game-gold" />
                  Join Room
                </CardTitle>
                <CardDescription className="text-slate-200">
                  Enter a room code to join an existing game
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Enter room code..."
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="bg-slate-700/70 border-slate-500 text-white placeholder:text-slate-300 focus:border-game-gold focus:bg-slate-700/90 font-mono text-center tracking-wider"
                  data-testid="input-room-code"
                />
                <Button 
                  onClick={handleJoinRoom}
                  disabled={joinRoomMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  data-testid="button-join-room"
                >
                  {joinRoomMutation.isPending ? "Joining..." : "Join Room"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Match */}
          <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-purple-500/30 shadow-2xl" data-testid="card-quick-match">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <i className="fas fa-bolt text-purple-400"></i>
                Quick Match
              </CardTitle>
              <CardDescription className="text-slate-200">
                Find and join a random public game instantly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200" data-testid="button-quick-match">
                <i className="fas fa-search mr-2"></i>
                Find Match
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="friends" className="space-y-6">
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

        <TabsContent value="chat">
          <Card className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/30 shadow-2xl" data-testid="card-global-chat">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-game-gold" />
                Global Chat
              </CardTitle>
              <CardDescription className="text-slate-200">
                Chat with players from around the world
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 border border-slate-600/50 rounded-lg p-4 bg-slate-700/30">
                <div className="text-center text-slate-300 py-20">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-60 text-game-gold" />
                  <p className="text-lg">Global chat coming soon!</p>
                  <p className="text-sm text-slate-400">Connect with players worldwide</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}