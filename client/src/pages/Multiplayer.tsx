import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
      // Here we would navigate to the game room component
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
    <div className="container mx-auto p-6 space-y-6" data-testid="multiplayer-page">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Multiplayer Hub</h1>
        <p className="text-muted-foreground">Connect with friends and compete online</p>
      </div>

      <Tabs defaultValue="rooms" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rooms" data-testid="tab-rooms">
            <GamepadIcon className="w-4 h-4 mr-2" />
            Game Rooms
          </TabsTrigger>
          <TabsTrigger value="friends" data-testid="tab-friends">
            <Users className="w-4 h-4 mr-2" />
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="tournaments" data-testid="tab-tournaments">
            <Trophy className="w-4 h-4 mr-2" />
            Tournaments
          </TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-chat">
            <MessageCircle className="w-4 h-4 mr-2" />
            Global Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Room */}
            <Card data-testid="card-create-room">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Room
                </CardTitle>
                <CardDescription>
                  Start a new multiplayer game session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Enter room name..."
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  data-testid="input-room-name"
                />
                <Button 
                  onClick={handleCreateRoom}
                  disabled={createRoomMutation.isPending}
                  className="w-full"
                  data-testid="button-create-room"
                >
                  {createRoomMutation.isPending ? "Creating..." : "Create Room"}
                </Button>
              </CardContent>
            </Card>

            {/* Join Room */}
            <Card data-testid="card-join-room">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GamepadIcon className="w-5 h-5" />
                  Join Room
                </CardTitle>
                <CardDescription>
                  Enter a room code to join an existing game
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Enter room code..."
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  data-testid="input-room-code"
                />
                <Button 
                  onClick={handleJoinRoom}
                  disabled={joinRoomMutation.isPending}
                  className="w-full"
                  data-testid="button-join-room"
                >
                  {joinRoomMutation.isPending ? "Joining..." : "Join Room"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Match */}
          <Card data-testid="card-quick-match">
            <CardHeader>
              <CardTitle>Quick Match</CardTitle>
              <CardDescription>
                Find and join a random public game instantly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="w-full" data-testid="button-quick-match">
                Find Match
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="friends" className="space-y-6">
          <Card data-testid="card-friends">
            <CardHeader>
              <CardTitle>Your Friends</CardTitle>
              <CardDescription>
                {friends.length === 0 
                  ? "No friends yet. Start playing to meet other players!"
                  : `You have ${friends.length} friend${friends.length === 1 ? '' : 's'}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Your friends list is empty</p>
                  <p className="text-sm">Play some games to meet other players!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`friend-${friend.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {friend.firstName?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-medium">
                            {friend.firstName} {friend.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
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
          <Card data-testid="card-tournaments">
            <CardHeader>
              <CardTitle>Active Tournaments</CardTitle>
              <CardDescription>
                Compete in organized competitions for prizes and glory
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tournaments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No active tournaments</p>
                  <p className="text-sm">Check back later for competitive events!</p>
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
          <Card data-testid="card-global-chat">
            <CardHeader>
              <CardTitle>Global Chat</CardTitle>
              <CardDescription>
                Chat with players from around the world
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 border rounded-lg p-4 bg-muted/30">
                <div className="text-center text-muted-foreground py-20">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Global chat coming soon!</p>
                  <p className="text-sm">Connect with players worldwide</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}