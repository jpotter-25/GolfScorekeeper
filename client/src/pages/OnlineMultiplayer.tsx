import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  
  // Create Room Dialog state
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [playerCount, setPlayerCount] = useState("4");
  const [roundCount, setRoundCount] = useState("9");

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
    mutationFn: async (params: { maxPlayers: number; rounds: number }) => {
      const res = await apiRequest("POST", "/api/rooms/create", { 
        stakeBracket: selectedStake,
        rounds: params.rounds,
        maxPlayers: params.maxPlayers
      });
      return await res.json();
    },
    onSuccess: (response: any) => {
      if (response.success && response.gameSnapshot) {
        console.log("Room created, navigating to game:", response.gameSnapshot.code);
        toast({
          title: "Game Starting!",
          description: `Joining table...`,
          duration: 2000
        });
        setCreateRoomOpen(false);
        // Navigate directly to Game View with the game snapshot
        setTimeout(() => {
          navigate(`/game?room=${response.gameSnapshot.code}`);
        }, 100);
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
  
  const handleCreateRoom = () => {
    createRoomMutation.mutate({
      maxPlayers: parseInt(playerCount),
      rounds: parseInt(roundCount)
    });
  };

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
                  onClick={() => setCreateRoomOpen(true)}
                >
                  Create Room
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
                    onClick={() => setCreateRoomOpen(true)}
                  >
                    Create Room
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
                          onClick={() => {
                            // Navigate to Room View - joining will happen there
                            navigate(`/room/${room.code}`);
                          }}
                          data-testid={`button-join-${room.code}`}
                        >
                          Join
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
        
        {/* Create Room Dialog */}
        <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
          <DialogContent className="bg-gray-900 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle>Create New Game Room</DialogTitle>
              <DialogDescription className="text-gray-400">
                Configure your game settings and start playing
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Player Count Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Number of Players</Label>
                <RadioGroup value={playerCount} onValueChange={setPlayerCount}>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="2" id="players-2" />
                      <Label htmlFor="players-2" className="cursor-pointer">2 Players</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="3" id="players-3" />
                      <Label htmlFor="players-3" className="cursor-pointer">3 Players</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="4" id="players-4" />
                      <Label htmlFor="players-4" className="cursor-pointer">4 Players</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              
              {/* Rounds Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Number of Rounds</Label>
                <RadioGroup value={roundCount} onValueChange={setRoundCount}>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="5" id="rounds-5" />
                      <Label htmlFor="rounds-5" className="cursor-pointer">5 Rounds (Quick)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="9" id="rounds-9" />
                      <Label htmlFor="rounds-9" className="cursor-pointer">9 Rounds (Standard)</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
              
              {/* Stake Information */}
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Stake Level:</span>
                  <Badge className="bg-green-600 text-white">
                    {STAKE_OPTIONS.find(s => s.value === selectedStake)?.label}
                  </Badge>
                </div>
                {selectedStake !== "free" && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-400">Entry Fee:</span>
                    <span className="text-yellow-400 font-semibold">
                      {STAKE_OPTIONS.find(s => s.value === selectedStake)?.coins} coins
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateRoomOpen(false)}
                className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRoom}
                disabled={createRoomMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {createRoomMutation.isPending ? "Creating Game..." : "Start Game"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}