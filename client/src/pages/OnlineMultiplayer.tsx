import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, Users, Settings, Trophy, Coins, DollarSign, Star, Crown } from "lucide-react";
import { STAKE_BRACKETS, type StakeBracket, type GameRoom } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface StakeOption {
  value: StakeBracket;
  label: string;
  coins: number;
  icon: React.ReactNode;
  color: string;
}

const STAKE_OPTIONS: StakeOption[] = [
  { value: "free", label: STAKE_BRACKETS.free.label, coins: STAKE_BRACKETS.free.entryFee, icon: <Trophy className="w-4 h-4" />, color: "bg-gray-500" },
  { value: "low", label: STAKE_BRACKETS.low.label, coins: STAKE_BRACKETS.low.entryFee, icon: <Coins className="w-4 h-4" />, color: "bg-green-500" },
  { value: "medium", label: STAKE_BRACKETS.medium.label, coins: STAKE_BRACKETS.medium.entryFee, icon: <DollarSign className="w-4 h-4" />, color: "bg-blue-500" },
  { value: "high", label: STAKE_BRACKETS.high.label, coins: STAKE_BRACKETS.high.entryFee, icon: <Star className="w-4 h-4" />, color: "bg-purple-500" },
  { value: "premium", label: STAKE_BRACKETS.premium.label, coins: STAKE_BRACKETS.premium.entryFee, icon: <Crown className="w-4 h-4" />, color: "bg-yellow-500" },
];

export default function OnlineMultiplayer() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedStake, setSelectedStake] = useState<StakeBracket>(() => {
    // Load persisted stake from localStorage
    const saved = localStorage.getItem("selectedStake");
    return (saved as StakeBracket) || "free";
  });
  
  const [activeRooms, setActiveRooms] = useState<GameRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Persist stake selection to localStorage
  useEffect(() => {
    localStorage.setItem("selectedStake", selectedStake);
  }, [selectedStake]);

  // WebSocket connection for real-time room updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const connectWebSocket = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log("WebSocket connected");
        // Subscribe to rooms with the selected stake bracket
        ws.send(JSON.stringify({
          type: 'subscribe_rooms',
          stakeBracket: selectedStake
        }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'rooms_snapshot') {
          // Clear and replace with fresh data when switching stakes
          setActiveRooms(data.rooms || []);
          setRoomsLoading(false);
        }
        
        if (data.type === 'rooms_update') {
          // Update existing rooms list
          setActiveRooms(data.rooms || []);
        }
        
        if (data.type === 'error') {
          console.error('WebSocket error:', data.message);
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setRoomsLoading(false);
      };
      
      ws.onclose = () => {
        console.log("WebSocket connection closed");
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe_rooms' }));
        wsRef.current.close();
      }
    };
  }, [selectedStake]);
  
  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rooms/create", { 
        stakeBracket: selectedStake,
        rounds: 9,
        maxPlayers: 4
      });
      return await res.json();
    },
    onSuccess: (response: any) => {
      if (response.success && response.room) {
        console.log("Room created:", response.room.code);
        toast({
          title: "Room Created!",
          description: `Room code: ${response.room.code}`,
          duration: 2000
        });
        // Navigate to the Room View with the room code
        setTimeout(() => {
          navigate(`/room/${response.room.code}`);
        }, 100); // Small delay to ensure room is in database
      } else {
        toast({
          title: "Failed to create room",
          description: response.message || "Please try again",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error("Failed to create room:", error);
      toast({
        title: "Error creating room",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  });

  // Join room mutation
  const joinRoomMutation = useMutation({
    mutationFn: async (roomCode: string) => {
      const res = await apiRequest("POST", `/api/rooms/${roomCode}/join`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to join room");
      }
      return data;
    },
    onSuccess: (data: any) => {
      console.log("Successfully joined room:", data.room.code);
      toast({
        title: "Joining room...",
        description: `Room code: ${data.room.code}`,
        duration: 2000
      });
      // Navigate to Room View after successful join
      navigate(`/room/${data.room.code}`);
    },
    onError: (error) => {
      console.error("Failed to join room:", error);
      toast({
        title: "Failed to join room",
        description: error instanceof Error ? error.message : "Room may be full or already started",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Online Multiplayer</h1>
          
          {/* Navigation Controls */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20">
              <Users className="w-4 h-4 mr-2" />
              Social
            </Button>
            <Button variant="outline" className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Link href="/">
              <Button variant="outline" className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Main Menu
              </Button>
            </Link>
          </div>
        </div>

        {/* Stake Filter Section */}
        <Card className="mb-6 bg-black/20 backdrop-blur border-white/10">
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Select Stake Level</h2>
            
            <ToggleGroup 
              type="single" 
              value={selectedStake} 
              onValueChange={(value) => value && setSelectedStake(value as StakeBracket)}
              className="flex flex-wrap gap-2"
            >
              {STAKE_OPTIONS.map((stake) => (
                <ToggleGroupItem
                  key={stake.value}
                  value={stake.value}
                  className={`
                    flex flex-col items-center gap-1 p-3 sm:p-4 min-w-[80px] sm:min-w-[100px]
                    bg-white/10 hover:bg-white/20 data-[state=on]:bg-white/30 
                    border border-white/20 data-[state=on]:border-white/40
                    text-white transition-all
                  `}
                  data-testid={`stake-filter-${stake.value}`}
                >
                  <div className={`p-2 rounded-full ${stake.color} bg-opacity-20`}>
                    {stake.icon}
                  </div>
                  <span className="font-semibold text-sm sm:text-base">{stake.label}</span>
                  <span className="text-xs sm:text-sm opacity-80">
                    {stake.coins === 0 ? "Free" : `${stake.coins} coins`}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="mt-4 text-white/70 text-sm">
              <span>Selected: </span>
              <Badge className="ml-2" variant="secondary">
                {STAKE_OPTIONS.find(s => s.value === selectedStake)?.label} Stakes
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Active Rooms Section */}
        <Card className="bg-black/20 backdrop-blur border-white/10">
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-white">Active Rooms</h2>
                <Badge variant="outline" className="text-white border-white/20">
                  {selectedStake === "free" ? "Free Play" : `${STAKE_OPTIONS.find(s => s.value === selectedStake)?.coins} Coins Entry`}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => createRoomMutation.mutate()}
                  disabled={createRoomMutation.isPending}
                >
                  {createRoomMutation.isPending ? "Creating..." : "Create Room"}
                </Button>
                <Button 
                  size="sm"
                  variant="outline" 
                  className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20"
                >
                  Quick Match
                </Button>
              </div>
            </div>

            {roomsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-white/60">Loading rooms...</div>
              </div>
            ) : activeRooms.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-12 text-white/60">
                <Users className="w-16 h-16 mb-4 opacity-40" />
                <p className="text-lg font-medium mb-2">No Active Rooms</p>
                <p className="text-sm text-center max-w-sm">
                  No rooms are currently available at this stake level. 
                  Create a new room or wait for other players to join.
                </p>
                
                <div className="mt-6 flex flex-col sm:flex-row gap-2">
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => createRoomMutation.mutate()}
                    disabled={createRoomMutation.isPending}
                  >
                    {createRoomMutation.isPending ? "Creating..." : "Create Room"}
                  </Button>
                  <Button variant="outline" className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20">
                    Quick Match
                  </Button>
                </div>
              </div>
            ) : (
              /* Room list */
              <div className="space-y-3" data-testid="active-rooms-list">
                {activeRooms.map((room) => {
                  const players = room.players as any[];
                  const maxPlayers = room.maxPlayers || 4;
                  const settings = room.settings as any;
                  const rounds = settings?.rounds || 9;
                  const currentStake = STAKE_BRACKETS[room.stakeBracket as StakeBracket] || STAKE_BRACKETS.free;
                  
                  return (
                    <div 
                      key={room.id} 
                      className="p-4 bg-white/10 rounded-lg border border-white/20 hover:bg-white/15 transition-all"
                      data-testid={`room-${room.code}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-white font-semibold text-lg">Room {room.code}</p>
                            <Badge className="bg-white/20 text-white border-white/30">
                              {currentStake.label}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                            <div className="flex items-center gap-1 text-white/80">
                              <Users className="w-4 h-4" />
                              <span>{players.length} / {maxPlayers} players</span>
                            </div>
                            
                            <div className="flex items-center gap-1 text-white/80">
                              <Trophy className="w-4 h-4" />
                              <span>{rounds} rounds</span>
                            </div>
                            
                            {currentStake.entryFee > 0 && (
                              <div className="flex items-center gap-1 text-yellow-400">
                                <Coins className="w-4 h-4" />
                                <span>{currentStake.entryFee} coins</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Player names preview */}
                          <div className="mt-2 text-white/60 text-xs">
                            {players.slice(0, 3).map((p: any, idx: number) => p.name || `Player ${idx + 1}`).join(", ")}
                            {players.length > 3 && ` +${players.length - 3} more`}
                          </div>
                        </div>
                        
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 text-white ml-4"
                          onClick={() => joinRoomMutation.mutate(room.code)}
                          disabled={joinRoomMutation.isPending}
                          data-testid={`button-join-${room.code}`}
                        >
                          {joinRoomMutation.isPending ? "Joining..." : "Join"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile-friendly bottom navigation */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur border-t border-white/20 p-4">
          <div className="flex justify-around">
            <Button variant="ghost" className="text-white flex-col gap-1 h-auto py-2">
              <Trophy className="w-5 h-5" />
              <span className="text-xs">Rooms</span>
            </Button>
            <Button variant="ghost" className="text-white flex-col gap-1 h-auto py-2">
              <Users className="w-5 h-5" />
              <span className="text-xs">Social</span>
            </Button>
            <Button variant="ghost" className="text-white flex-col gap-1 h-auto py-2">
              <Settings className="w-5 h-5" />
              <span className="text-xs">Settings</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}