import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  Trophy, 
  Clock, 
  Copy, 
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RoomData {
  id: string;
  code: string;
  hostId: string;
  players: any[];
  maxPlayers: number;
  stakeBracket: string;
  settings: {
    rounds: number;
    timeLimit: number | null;
    allowSpectators: boolean;
  };
  status: string;
  playerCount: number;
  version: number;
  isActive: boolean;
  createdAt: string;
}

const STAKE_LABELS: Record<string, { label: string; coins: number; color: string }> = {
  free: { label: "Free Play", coins: 0, color: "bg-green-500" },
  low: { label: "Low Stakes", coins: 10, color: "bg-blue-500" },
  medium: { label: "Medium Stakes", coins: 50, color: "bg-purple-500" },
  high: { label: "High Stakes", coins: 100, color: "bg-orange-500" },
  vip: { label: "VIP Stakes", coins: 500, color: "bg-red-500" }
};

export default function RoomView() {
  const { code } = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [codeCopied, setCodeCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showEditSettings, setShowEditSettings] = useState(false);
  const [editForm, setEditForm] = useState({
    rounds: 9,
    maxPlayers: 4,
    stakeBracket: "free"
  });

  // Fetch room details
  const { data: room, isLoading, error } = useQuery<RoomData>({
    queryKey: [`/api/rooms/${code}`],
    refetchInterval: 2000, // Poll for updates
    enabled: !!code
  });

  // Update settings mutation - must be before any conditional returns
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: typeof editForm) => {
      const res = await apiRequest("PATCH", `/api/rooms/${code}/settings`, settings);
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Settings Updated",
          description: "Room settings have been updated successfully"
        });
        setShowEditSettings(false);
        // Invalidate and refetch room data
        queryClient.invalidateQueries({ queryKey: [`/api/rooms/${code}`] });
      } else {
        toast({
          title: "Update Failed",
          description: data.message || "Failed to update room settings",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error("Failed to update settings:", error);
      toast({
        title: "Error",
        description: "Failed to update room settings",
        variant: "destructive"
      });
    }
  });

  // Leave room mutation
  const leaveRoomMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rooms/${code}/leave`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to leave room");
      }
      return data;
    },
    onSuccess: (data: any) => {
      if (data.roomDeleted) {
        toast({
          title: "Room closed",
          description: "The room was deleted as you were the last player",
          duration: 2000
        });
      } else {
        toast({
          title: "Left room",
          description: data.newHost ? "Host transferred to another player" : "You have left the room",
          duration: 2000
        });
      }
      // Navigate back to multiplayer lobby
      navigate("/online-multiplayer");
    },
    onError: (error) => {
      console.error("Failed to leave room:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to leave room",
        variant: "destructive"
      });
    }
  });

  // Initialize edit form when room data changes - must be before any conditional returns
  useEffect(() => {
    if (room) {
      setEditForm({
        rounds: room.settings.rounds || 9,
        maxPlayers: room.maxPlayers || 4,
        stakeBracket: room.stakeBracket || "free"
      });
    }
  }, [room]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!code) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Room View WebSocket connected");
      setIsConnected(true);
      // Subscribe to this specific room
      ws.send(JSON.stringify({ 
        type: "subscribe_room", 
        roomCode: code 
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "room_update" && data.room?.code === code) {
        // Room update received - the query will refetch automatically
        console.log("Room update received:", data.room);
      }
    };

    ws.onclose = () => {
      console.log("Room View WebSocket disconnected");
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [code]);

  const handleCopyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      setCodeCopied(true);
      toast({
        title: "Room code copied!",
        description: `Share code ${room.code} with other players`,
      });
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleStartGame = () => {
    // TODO: Implement game start logic
    toast({
      title: "Starting game...",
      description: "Preparing the game room",
    });
  };

  const handleLeaveRoom = () => {
    leaveRoomMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 p-4 flex items-center justify-center">
        <Card className="bg-black/40 backdrop-blur border-white/20">
          <CardContent className="p-8 flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-white animate-spin mb-4" />
            <p className="text-white">Loading room details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 p-4 flex items-center justify-center">
        <Card className="bg-black/40 backdrop-blur border-white/20">
          <CardContent className="p-8">
            <p className="text-red-400 mb-4">Room not found or error loading room</p>
            <Button 
              onClick={() => navigate("/online-multiplayer")}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stake = STAKE_LABELS[room.stakeBracket] || STAKE_LABELS.free;
  const isHost = user?.id === room.hostId;
  const canEditSettings = isHost && room.status === "room";

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <Card className="bg-black/40 backdrop-blur border-white/20">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl text-white mb-2">
                  Room {room.code}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={`${stake.color} text-white`}>
                    {stake.label}
                  </Badge>
                  {stake.coins > 0 && (
                    <Badge variant="outline" className="text-white border-white/20">
                      {stake.coins} coins entry
                    </Badge>
                  )}
                  {isConnected && (
                    <Badge className="bg-green-600 text-white">
                      Live
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                onClick={handleLeaveRoom}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                disabled={leaveRoomMutation.isPending}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {leaveRoomMutation.isPending ? "Leaving..." : "Leave Room"}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Room Info */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Game Settings */}
          <Card className="bg-black/40 backdrop-blur border-white/20">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-white">Game Settings</CardTitle>
                {canEditSettings && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    onClick={() => setShowEditSettings(true)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span>Rounds</span>
                </div>
                <span className="font-semibold">{room.settings.rounds}</span>
              </div>
              
              <Separator className="bg-white/10" />
              
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>Time Limit</span>
                </div>
                <span className="font-semibold">
                  {room.settings.timeLimit ? `${room.settings.timeLimit}s` : "None"}
                </span>
              </div>
              
              <Separator className="bg-white/10" />
              
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
                  <span>Max Players</span>
                </div>
                <span className="font-semibold">{room.maxPlayers}</span>
              </div>
            </CardContent>
          </Card>

          {/* Room Code Share */}
          <Card className="bg-black/40 backdrop-blur border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Invite Players</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/70 text-sm mb-4">
                Share this code with friends to join your room
              </p>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-3">
                  <p className="text-2xl font-bold text-white tracking-wider text-center">
                    {room.code}
                  </p>
                </div>
                <Button
                  onClick={handleCopyCode}
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  {codeCopied ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Players */}
        <Card className="bg-black/40 backdrop-blur border-white/20">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">
                Players ({room.playerCount}/{room.maxPlayers})
              </CardTitle>
              {room.status === "room" && (
                <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                  Waiting for players...
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {room.players.map((player: any, index: number) => (
                <div 
                  key={player.id || index}
                  className="flex items-center justify-between p-3 bg-white/10 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {player.name || player.email || "Player"}
                      </p>
                      {player.id === room.hostId && (
                        <Badge className="bg-yellow-600 text-white text-xs">
                          Host
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400">
                    Ready
                  </Badge>
                </div>
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: room.maxPlayers - room.playerCount }).map((_, index) => (
                <div 
                  key={`empty-${index}`}
                  className="flex items-center p-3 bg-white/5 rounded-lg border border-white/10 border-dashed"
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mr-3">
                    <Users className="w-5 h-5 text-white/40" />
                  </div>
                  <p className="text-white/40">Waiting for player...</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {isHost && room.status === "room" && (
          <Card className="bg-black/40 backdrop-blur border-white/20">
            <CardContent className="p-4">
              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleStartGame}
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                  disabled={room.playerCount < 2}
                >
                  {room.playerCount < 2 ? "Waiting for players..." : "Start Game"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Settings Dialog */}
      <Dialog open={showEditSettings} onOpenChange={setShowEditSettings}>
        <DialogContent className="bg-black/95 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Edit Room Settings</DialogTitle>
            <DialogDescription className="text-white/70">
              Update the room settings. Changes will apply immediately.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rounds" className="text-right text-white">
                Rounds
              </Label>
              <Select
                value={editForm.rounds.toString()}
                onValueChange={(value) => setEditForm({ ...editForm, rounds: parseInt(value) })}
              >
                <SelectTrigger className="col-span-3 bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Rounds</SelectItem>
                  <SelectItem value="9">9 Rounds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="maxPlayers" className="text-right text-white">
                Max Players
              </Label>
              <Select
                value={editForm.maxPlayers.toString()}
                onValueChange={(value) => setEditForm({ ...editForm, maxPlayers: parseInt(value) })}
                disabled={room.playerCount > 2}
              >
                <SelectTrigger className="col-span-3 bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2" disabled={room.playerCount > 2}>2 Players</SelectItem>
                  <SelectItem value="3" disabled={room.playerCount > 3}>3 Players</SelectItem>
                  <SelectItem value="4">4 Players</SelectItem>
                </SelectContent>
              </Select>
              {editForm.maxPlayers < room.playerCount && (
                <p className="col-span-4 text-sm text-red-400">
                  Cannot set max players below current player count ({room.playerCount})
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="stakeBracket" className="text-right text-white">
                Stake Level
              </Label>
              <Select
                value={editForm.stakeBracket}
                onValueChange={(value) => setEditForm({ ...editForm, stakeBracket: value })}
              >
                <SelectTrigger className="col-span-3 bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free Play</SelectItem>
                  <SelectItem value="low">Low Stakes (10 coins)</SelectItem>
                  <SelectItem value="medium">Medium Stakes (50 coins)</SelectItem>
                  <SelectItem value="high">High Stakes (100 coins)</SelectItem>
                  <SelectItem value="premium">Premium Stakes (500 coins)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditSettings(false)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              disabled={updateSettingsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateSettingsMutation.mutate(editForm)}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={updateSettingsMutation.isPending || editForm.maxPlayers < room.playerCount}
            >
              {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}