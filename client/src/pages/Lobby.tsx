import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Settings, Copy, Check, Timer, User } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Home } from 'lucide-react';
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
  const [selectedRounds, setSelectedRounds] = useState(9);
  const [selectedPlayers, setSelectedPlayers] = useState(4);
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
  const { data: initialRoom, isLoading, refetch } = useQuery<GameRoom>({
    queryKey: [`/api/game-rooms/${roomCode}`],
    enabled: !!roomCode,
    refetchInterval: 2000 // Poll every 2 seconds to keep data fresh
  });

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (!roomCode || !user) return;

    // Use wss:// for HTTPS, ws:// for HTTP
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws-rooms`);
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
        
        // Handle ping/pong for heartbeat
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        
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
        
      case 'reconnected':
        // Successfully reconnected to room
        console.log('[Lobby] Reconnected to room');
        toast({
          title: "Reconnected",
          description: "Successfully reconnected to the room",
        });
        break;
        
      case 'player:reconnected':
        // Another player reconnected
        if (message.userId !== user?.id) {
          toast({
            title: "Player Reconnected",
            description: "A player reconnected to the room",
          });
        }
        break;
        
      case 'player:disconnected':
        // Another player disconnected temporarily
        if (message.userId !== user?.id) {
          toast({
            title: "Player Disconnected",
            description: "A player lost connection (may reconnect)",
            variant: "default",
          });
        }
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
        console.log('[Lobby] Received player:ready message:', message);
        // Update room data with participant info
        if (message.room) {
          setRoomData(message.room);
          // Also update the ready status for the current user
          const currentParticipant = message.room.participants?.find((p: any) => p.userId === user?.id);
          if (currentParticipant) {
            console.log('[Lobby] Updating ready status for current user:', currentParticipant.isReady);
            setIsReady(currentParticipant.isReady);
          }
        }
        // Refresh room data to ensure consistency
        queryClient.invalidateQueries({ queryKey: [`/api/game-rooms/${roomCode}`] });
        break;
      
      case 'room:settings:updated':
        console.log('[Lobby] Received settings update:', message);
        // Update local settings and room data
        if (message.settings) {
          // Use server settings directly, don't fall back to local
          setLocalSettings({ 
            rounds: message.settings.rounds, 
            maxPlayers: message.settings.maxPlayers 
          });
        }
        if (message.room) {
          setRoomData(message.room);
        }
        // Refresh room data to ensure consistency
        queryClient.invalidateQueries({ queryKey: [`/api/game-rooms/${roomCode}`] });
        // Also refresh Active Lobbies list
        queryClient.invalidateQueries({ queryKey: ['/api/game-rooms/all-lobbies'] });
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
    
    // Send ready status to server
    wsRef.current.send(JSON.stringify({
      type: 'room:ready:set',
      code: roomCode,
      ready: newReadyState
    }));
    
    // Don't update local state immediately - wait for server response
    // This ensures we're always in sync with the server
  };

  const handleUpdateSettings = (field: 'rounds' | 'maxPlayers', value: number) => {
    if (!wsRef.current || !user || !isHost) return;
    
    if (field === 'rounds') {
      setSelectedRounds(value);
    } else {
      setSelectedPlayers(value);
    }
    
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);
    
    wsRef.current.send(JSON.stringify({
      type: 'room:settings:update',
      code: roomCode,
      settings: newSettings  // Send all settings to ensure proper sync
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
  // Find current user's participant data to check if they're ready
  const currentUserParticipant = participants.find(p => p.userId === user?.id);
  const userIsReady = currentUserParticipant?.isReady || false;
  
  // Update local ready state when participant data changes
  useEffect(() => {
    if (currentUserParticipant) {
      setIsReady(currentUserParticipant.isReady);
    }
  }, [currentUserParticipant?.isReady]);
  
  const readyCount = participants.filter(p => p.isReady).length;
  const allReady = participants.length >= 2 && readyCount === participants.length;

  useEffect(() => {
    if (room) {
      setLocalSettings({
        rounds: room.settings.rounds,
        maxPlayers: room.maxPlayers
      });
      setSelectedRounds(room.settings.rounds);
      setSelectedPlayers(room.maxPlayers);
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
    <div className="min-h-screen" style={{ backgroundColor: '#2a3f5f' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={handleLeaveRoom}
            className="text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors px-3 py-2"
            data-testid="button-leave-lobby"
          >
            <Home className="w-5 h-5 mr-2" />
            <span>Leave Lobby</span>
          </Button>
          
          <div>
            <h1 className="text-xl font-semibold text-white">Game Lobby</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-lg text-yellow-400">{roomCode}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyCode}
                className="text-gray-400 hover:text-white p-1"
                data-testid="button-copy-code"
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">
                {room.betAmount === 0 ? 'Free Play' : `${room.betAmount} Coins`}
              </Badge>
            </div>
          </div>
        </div>
        
        {autoStartCountdown !== null && (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30 animate-pulse">
            <Timer className="h-4 w-4 mr-1" />
            Starting in {autoStartCountdown}s
          </Badge>
        )}
      </header>

      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Players Section */}
          <div className="lg:col-span-2 bg-gray-800/50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                Players ({participants.length}/{room.maxPlayers})
              </h2>
            </div>
            
            <div className="space-y-3">
              {participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/50"
                  data-testid={`player-${participant.userId}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-400" />
                    </div>
                    <span className="font-medium text-white">{participant.username}</span>
                    {participant.userId === room.crownHolderId && (
                      <Crown className="h-5 w-5 text-yellow-400" />
                    )}
                  </div>
                  <Badge 
                    className={participant.isReady 
                      ? "bg-green-600/20 text-green-400 border-green-600/30" 
                      : "bg-gray-700/50 text-gray-400 border-gray-600"
                    }
                  >
                    {participant.isReady ? "Ready" : "Not Ready"}
                  </Badge>
                </div>
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: room.maxPlayers - participants.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center justify-between p-4 border-2 border-dashed border-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border-2 border-dashed border-gray-600 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                    <span className="text-gray-500">Waiting for player...</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <Button
                onClick={handleReady}
                className={isReady 
                  ? "flex-1 bg-gray-700 hover:bg-gray-600 text-white" 
                  : "flex-1 bg-green-600 hover:bg-green-700 text-white"
                }
                data-testid="button-ready"
              >
                {isReady ? "Unready" : "Ready"}
              </Button>
              
              {isHost && (
                <Button
                  onClick={handleStartGame}
                  disabled={participants.length !== localSettings.maxPlayers || !participants.every((p: any) => p.isReady) || room.settingsLocked}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700 disabled:text-gray-500"
                  data-testid="button-start-game"
                >
                  Start Game
                </Button>
              )}
            </div>
          </div>

          {/* Settings Section */}
          <div className="bg-gray-800/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5" />
              Game Settings
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {isHost ? "Configure your game" : "Set by host"}
            </p>

            <div className="space-y-6">
              {/* Rounds Selection */}
              <div>
                <Label className="text-white mb-3 block">Rounds</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleUpdateSettings('rounds', 5)}
                    disabled={!isHost || room.settingsLocked}
                    className={selectedRounds === 5 
                      ? "bg-blue-600 text-white hover:bg-blue-700" 
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }
                    data-testid="button-rounds-5"
                  >
                    5 Rounds
                  </Button>
                  <Button
                    onClick={() => handleUpdateSettings('rounds', 9)}
                    disabled={!isHost || room.settingsLocked}
                    className={selectedRounds === 9 
                      ? "bg-blue-600 text-white hover:bg-blue-700" 
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }
                    data-testid="button-rounds-9"
                  >
                    9 Rounds
                  </Button>
                </div>
              </div>

              {/* Players Selection */}
              <div>
                <Label className="text-white mb-3 block">Max Players</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => handleUpdateSettings('maxPlayers', 2)}
                    disabled={!isHost || room.settingsLocked || participants.length > 2}
                    className={selectedPlayers === 2 
                      ? "bg-blue-600 text-white hover:bg-blue-700" 
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600"
                    }
                    data-testid="button-players-2"
                  >
                    2
                  </Button>
                  <Button
                    onClick={() => handleUpdateSettings('maxPlayers', 3)}
                    disabled={!isHost || room.settingsLocked || participants.length > 3}
                    className={selectedPlayers === 3 
                      ? "bg-blue-600 text-white hover:bg-blue-700" 
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600"
                    }
                    data-testid="button-players-3"
                  >
                    3
                  </Button>
                  <Button
                    onClick={() => handleUpdateSettings('maxPlayers', 4)}
                    disabled={!isHost || room.settingsLocked || participants.length > 4}
                    className={selectedPlayers === 4 
                      ? "bg-blue-600 text-white hover:bg-blue-700" 
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600"
                    }
                    data-testid="button-players-4"
                  >
                    4
                  </Button>
                </div>
              </div>

              {/* Game Info */}
              <div className="pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400 space-y-2">
                  <p className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    {selectedRounds} rounds to play
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    {selectedPlayers} players maximum
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    {room.betAmount === 0 ? 'Free play' : `${room.betAmount} coins stake`}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    Prize pool: {room.betAmount * participants.length} coins
                  </p>
                </div>
              </div>

              {allReady && (
                <div className="p-3 bg-green-600/10 border border-green-600/20 rounded-lg">
                  <p className="text-sm text-green-400 font-medium">
                    All players ready! Game will start soon...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}