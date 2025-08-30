import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Settings, Copy, Check, Timer, User } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from '@/hooks/useAuth';

interface RoomParticipant {
  userId: string;
  username: string;
  isHost: boolean;
  isReady: boolean;
  joinOrder: number;
  joinedAt: string;
}

interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  crownHolderId: string;
  betAmount: number;
  maxPlayers: number;
  currentPlayers: number;
  settings: {
    rounds: number;
    mode: string;
  };
  status: string;
  settingsLocked: boolean;
  participants?: RoomParticipant[];
}

export default function Lobby() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [roomCode, setRoomCode] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [localSettings, setLocalSettings] = useState({ rounds: 9, maxPlayers: 4 });
  const [isReady, setIsReady] = useState(false);
  const [autoStartCountdown, setAutoStartCountdown] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [roomData, setRoomData] = useState<GameRoom | null>(null);

  // Extract room code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (!code) {
      toast({
        title: "Error",
        description: "No room code provided",
        variant: "destructive"
      });
      setLocation('/multiplayer');
      return;
    }
    setRoomCode(code.toUpperCase());
  }, [setLocation]);

  // Fetch initial room data
  const { data: initialRoom, isLoading } = useQuery<GameRoom>({
    queryKey: [`/api/game-rooms/${roomCode}`],
    enabled: !!roomCode,
    refetchInterval: false // We'll use WebSocket for updates
  });

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (!roomCode || !user) return;

    const ws = new WebSocket(`ws://${window.location.host}/ws-rooms`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send authentication first
      ws.send(JSON.stringify({
        type: 'authenticate',
        userId: user.id
      }));
      
      // Then join the room after authentication
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'room:join',
          code: roomCode
        }));
      }, 100);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Lost connection to game server",
        variant: "destructive"
      });
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'room:leave',
          code: roomCode
        }));
      }
      ws.close();
    };
  }, [roomCode, user]);

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'room:joined':
        // Successfully joined room
        if (message.room) setRoomData(message.room);
        break;
        
      case 'room:update':
        setRoomData(message.room);
        break;
      
      case 'player:joined':
        toast({
          title: "Player Joined",
          description: `A player joined the room`,
        });
        if (message.room) setRoomData(message.room);
        break;
      
      case 'player:left':
        toast({
          title: "Player Left",
          description: `A player left the room`,
        });
        if (message.room) setRoomData(message.room);
        break;
      
      case 'player:ready':
        if (message.room) setRoomData(message.room);
        // Refresh room data
        queryClient.invalidateQueries({ queryKey: [`/api/game-rooms/${roomCode}`] });
        break;
      
      case 'room:settings:updated':
        setLocalSettings({ 
          rounds: message.settings?.rounds || localSettings.rounds, 
          maxPlayers: message.settings?.maxPlayers || localSettings.maxPlayers 
        });
        if (message.room) setRoomData(message.room);
        break;
      
      case 'game:auto_start:countdown':
        setAutoStartCountdown(message.seconds);
        break;
      
      case 'room:started':
      case 'game:started':
        // Navigate to game with all settings
        const gameUrl = `/game?mode=online&room=${roomCode}&rounds=${message.settings?.rounds || 9}`;
        setLocation(gameUrl);
        break;
      
      case 'room:host:changed':
        toast({
          title: "Host Changed",
          description: message.reason || "Crown has been transferred",
        });
        if (message.room) setRoomData(message.room);
        break;
      
      case 'error':
        toast({
          title: "Error",
          description: message.message,
          variant: "destructive"
        });
        break;
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setIsCopied(true);
    toast({
      title: "Room Code Copied",
      description: `Share this code: ${roomCode}`,
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleReady = () => {
    if (!wsRef.current || !user) return;
    
    const newReadyState = !isReady;
    setIsReady(newReadyState);
    
    wsRef.current.send(JSON.stringify({
      type: 'room:ready:set',
      code: roomCode,
      ready: newReadyState
    }));
  };

  const handleUpdateSettings = (field: 'rounds' | 'maxPlayers', value: number) => {
    if (!wsRef.current || !user || !isHost) return;
    
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);
    
    wsRef.current.send(JSON.stringify({
      type: 'room:settings:update',
      code: roomCode,
      settings: field === 'rounds' ? { rounds: value } : { maxPlayers: value }
    }));
  };

  const handleStartGame = () => {
    if (!wsRef.current || !user || !isHost) return;
    
    wsRef.current.send(JSON.stringify({
      type: 'room:start',
      code: roomCode
    }));
  };

  const handleLeaveRoom = () => {
    if (wsRef.current && user) {
      wsRef.current.send(JSON.stringify({
        type: 'room:leave',
        code: roomCode
      }));
    }
    setLocation('/multiplayer');
  };

  // Use WebSocket room data if available, otherwise use initial query data
  const room = roomData || initialRoom;
  const isHost = room?.crownHolderId === user?.id;
  const participants = room?.participants || [];
  const readyCount = participants.filter(p => p.isReady).length;
  const allReady = participants.length >= 2 && readyCount === participants.length;

  useEffect(() => {
    if (room) {
      setLocalSettings({
        rounds: room.settings.rounds,
        maxPlayers: room.maxPlayers
      });
    }
  }, [room]);

  if (isLoading || !room) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={handleLeaveRoom}
          data-testid="button-leave-lobby"
        >
          ← Leave Lobby
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Game Lobby</CardTitle>
              <Badge variant={room.betAmount === 0 ? "secondary" : "default"}>
                {room.betAmount === 0 ? 'Free Play' : `${room.betAmount} Coins`}
              </Badge>
            </div>
            <CardDescription>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-lg">{roomCode}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                  data-testid="button-copy-code"
                >
                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Players List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Players ({participants.length}/{room.maxPlayers})
                </h3>
                {autoStartCountdown !== null && (
                  <Badge variant="default" className="animate-pulse">
                    <Timer className="h-4 w-4 mr-1" />
                    Starting in {autoStartCountdown}s
                  </Badge>
                )}
              </div>
              
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg"
                    data-testid={`player-${participant.userId}`}
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5" />
                      <span className="font-medium">{participant.username}</span>
                      {participant.userId === room.crownHolderId && (
                        <Crown className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <Badge variant={participant.isReady ? "default" : "outline"}>
                      {participant.isReady ? "Ready" : "Not Ready"}
                    </Badge>
                  </div>
                ))}
                
                {/* Empty slots */}
                {Array.from({ length: room.maxPlayers - participants.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center justify-between p-3 border-2 border-dashed rounded-lg opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5" />
                      <span className="text-muted-foreground">Waiting for player...</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <Button
                variant={isReady ? "secondary" : "default"}
                onClick={handleReady}
                className="flex-1"
                data-testid="button-ready"
              >
                {isReady ? "Not Ready" : "Ready"}
              </Button>
              
              {isHost && (
                <Button
                  onClick={handleStartGame}
                  disabled={participants.length < 2 || room.settingsLocked}
                  className="flex-1"
                  data-testid="button-start-game"
                >
                  Start Game
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Game Settings
            </CardTitle>
            <CardDescription>
              {isHost ? "Configure your game" : "Set by host"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="rounds">
                Rounds: {localSettings.rounds}
              </Label>
              <Slider
                id="rounds"
                min={5}
                max={9}
                step={4}
                value={[localSettings.rounds]}
                onValueChange={([value]) => handleUpdateSettings('rounds', value)}
                disabled={!isHost || room.settingsLocked}
                className="w-full"
                data-testid="slider-rounds"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPlayers">
                Max Players: {localSettings.maxPlayers}
              </Label>
              <Slider
                id="maxPlayers"
                min={2}
                max={4}
                step={1}
                value={[localSettings.maxPlayers]}
                onValueChange={([value]) => handleUpdateSettings('maxPlayers', value)}
                disabled={!isHost || room.settingsLocked || participants.length > 1}
                className="w-full"
                data-testid="slider-max-players"
              />
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• {localSettings.rounds} rounds to play</p>
                <p>• {localSettings.maxPlayers} players maximum</p>
                <p>• {room.betAmount === 0 ? 'Free play' : `${room.betAmount} coins stake`}</p>
                <p>• Prize pool: {room.betAmount * participants.length} coins</p>
              </div>
            </div>

            {allReady && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  All players ready! Game will start soon...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}