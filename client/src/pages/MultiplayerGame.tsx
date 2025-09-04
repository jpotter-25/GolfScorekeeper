import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import GameHeader from '@/components/Game/GameHeader';
import GameTable from '@/components/Game/GameTable';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Timer, Trophy } from 'lucide-react';
import { GameState } from '@/types/game';

interface RoomSnapshot {
  code: string;
  id: string;
  maxPlayers: number;
  playersSeated: number;
  seatsOpen: number;
  rounds: number;
  stakeBracket: string;
  status: 'inGame_waiting' | 'inGame_active' | 'completed';
  gameState?: GameState;
  players: Array<{
    userId: string;
    username: string;
    seatIndex: number;
    connected: boolean;
    roundScore?: number;
    totalScore?: number;
  }>;
  version: number;
  currentRound?: number;
  currentPlayerIndex?: number;
}

export default function MultiplayerGame() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [showGameResults, setShowGameResults] = useState(false);
  const [roomSnapshot, setRoomSnapshot] = useState<RoomSnapshot | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastVersionRef = useRef<number>(0);

  // Extract room code from URL
  const roomCode = new URLSearchParams(window.location.search).get('room');
  
  // Query for initial room state
  const { data: initialRoom, isLoading } = useQuery({
    queryKey: [`/api/rooms/${roomCode}`],
    enabled: !!roomCode,
    refetchOnWindowFocus: false,
  });

  // Handle cleanup when component unmounts or user navigates away
  useEffect(() => {
    if (!roomCode) return;

    // Handle browser/tab close
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      // Call leave endpoint synchronously (best effort)
      navigator.sendBeacon(`/api/rooms/${roomCode}/leave`, JSON.stringify({}));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // When component unmounts (navigation), leave the room
      if (roomCode) {
        // Use sendBeacon for reliable delivery even during page unload
        navigator.sendBeacon(`/api/rooms/${roomCode}/leave`, JSON.stringify({}));
      }
    };
  }, [roomCode]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!roomCode || !initialRoom) return;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log('[MultiplayerGame] Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[MultiplayerGame] WebSocket connected, subscribing to room:', roomCode);
        // Subscribe to specific room updates
        ws.send(JSON.stringify({ 
          type: 'subscribe_room', 
          roomId: roomCode 
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[MultiplayerGame] Received message:', message.type, message);
          
          if (message.type === 'room_snapshot' && message.snapshot) {
            // Convert version to number for comparison
            const newVersion = parseInt(message.snapshot.version || '0');
            const currentVersion = lastVersionRef.current;
            
            // Apply snapshot if version is newer or same (for real-time sync)
            if (newVersion >= currentVersion) {
              console.log('[MultiplayerGame] Applying snapshot v' + newVersion);
              lastVersionRef.current = newVersion;
              setRoomSnapshot(message.snapshot);
              
              // Check if game has ended
              if (message.snapshot.status === 'completed') {
                setShowGameResults(true);
              }
            } else {
              console.log('[MultiplayerGame] Ignoring stale snapshot v' + newVersion + ' (current: ' + currentVersion + ')');
            }
          } else if (message.type === 'room_deleted') {
            toast({
              title: "Room Closed",
              description: "The game room has been closed.",
              variant: "destructive"
            });
            setLocation('/online-multiplayer');
          } else if (message.type === 'error') {
            toast({
              title: "Error",
              description: message.message || "An error occurred",
              variant: "destructive"
            });
          }
        } catch (err) {
          console.error('[MultiplayerGame] Error parsing message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[MultiplayerGame] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[MultiplayerGame] WebSocket disconnected, will reconnect...');
        wsRef.current = null;
        
        // Reconnect after 2 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (roomCode) {
            connectWebSocket();
          }
        }, 2000);
      };
    };

    // Initial connection
    connectWebSocket();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomCode, initialRoom, toast, setLocation]);

  // Set initial snapshot from query
  useEffect(() => {
    if (initialRoom && !roomSnapshot) {
      console.log('[MultiplayerGame] Setting initial snapshot from query');
      const snapshot = initialRoom as RoomSnapshot;
      setRoomSnapshot(snapshot);
      // Parse version as number
      lastVersionRef.current = parseInt(snapshot.version?.toString() || '0');
    }
  }, [initialRoom, roomSnapshot]);

  // Server-authoritative game actions
  const sendGameAction = async (action: string, data?: any) => {
    if (!roomCode) return;
    
    try {
      const response = await apiRequest('POST', `/api/rooms/${roomCode}/action`, {
        action,
        ...data
      });
      const result = await response.json();
      
      if (!result.success) {
        toast({
          title: "Action Failed",
          description: result.message || "Could not perform action",
          variant: "destructive"
        });
      }
      // The new state will come through WebSocket
    } catch (error) {
      console.error('[MultiplayerGame] Action error:', error);
      toast({
        title: "Error",
        description: "Failed to perform action",
        variant: "destructive"
      });
    }
  };

  const handleDrawCard = () => sendGameAction('draw_card');
  const handleSelectGridPosition = (position: number) => sendGameAction('select_grid_position', { position });
  const handleKeepDrawnCard = () => sendGameAction('keep_drawn_card');
  const handleKeepRevealedCard = () => sendGameAction('keep_revealed_card');
  const handlePeekCard = (index: number) => sendGameAction('peek_card', { index });
  const handleEndTurn = () => sendGameAction('end_turn');
  
  const handleLeaveRoom = async () => {
    if (!roomCode) return;
    
    try {
      await apiRequest('POST', `/api/rooms/${roomCode}/leave`);
      setLocation('/online-multiplayer');
    } catch (error) {
      console.error('[MultiplayerGame] Leave error:', error);
      toast({
        title: "Error",
        description: "Failed to leave room",
        variant: "destructive"
      });
    }
  };

  const handlePlayAgain = () => {
    setShowGameResults(false);
    setLocation('/online-multiplayer');
  };

  // Loading state
  if (isLoading || !roomSnapshot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 flex items-center justify-center">
        <Card className="p-8 bg-black/20 backdrop-blur border-white/10">
          <div className="text-white text-xl text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            Loading game room...
          </div>
        </Card>
      </div>
    );
  }

  // Waiting for players state
  if (roomSnapshot.status === 'inGame_waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-black/30 backdrop-blur border-white/20">
            <div className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white mb-4">Waiting for Players</h1>
                <Badge className="text-lg px-4 py-2">
                  Room Code: {roomSnapshot.code}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
                {Array.from({ length: roomSnapshot.maxPlayers }).map((_, index) => {
                  const player = roomSnapshot.players?.find(p => p.seatIndex === index);
                  return (
                    <Card 
                      key={index} 
                      className={`p-4 ${player ? 'bg-green-900/50' : 'bg-gray-800/50'} border-white/20`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          player ? 'bg-green-600' : 'bg-gray-600'
                        }`}>
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {player ? player.username : `Waiting...`}
                          </p>
                          <p className="text-gray-400 text-sm">
                            Seat {index + 1}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="text-center">
                <div className="text-white mb-4">
                  <Timer className="inline w-5 h-5 mr-2" />
                  {roomSnapshot.playersSeated} of {roomSnapshot.maxPlayers} players joined
                </div>
                <Button 
                  onClick={handleLeaveRoom}
                  variant="outline"
                  className="bg-red-600/20 border-red-500 text-red-500 hover:bg-red-600/30"
                >
                  Leave Room
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Active game state - render server's authoritative game state
  if (roomSnapshot.status === 'inGame_active' && roomSnapshot.gameState) {
    const serverState = roomSnapshot.gameState as any;
    
    // Transform server game state to match client's expected format
    // IMPORTANT: Include ALL table slots to show correct number of seats (2, 3, or 4 players)
    const transformedGameState: any = {
      players: (serverState.tableSlots || [])
        .map((slot: any, index: number) => {
          if (slot.isEmpty) {
            // Show empty seat as a placeholder player
            return {
              id: `empty_${index}`,
              name: 'Empty Seat',
              isAI: false,
              isEmpty: true,
              grid: Array(9).fill({ suit: '', rank: '', isRevealed: false }),
              roundScore: 0,
              totalScore: 0,
              roundScores: []
            };
          } else {
            // Active player
            return {
              id: slot.playerId,
              name: slot.playerName || `Player ${index + 1}`,
              isAI: false,
              isEmpty: false,
              grid: slot.cards || [],
              roundScore: slot.score || 0,
              totalScore: slot.totalScore || 0,
              roundScores: slot.roundScores || []
            };
          }
        }),
      currentPlayerIndex: serverState.currentPlayerIndex || 0,
      gamePhase: serverState.gamePhase || 'playing',
      drawnCard: serverState.drawnCard || null,
      discardPile: serverState.discardPile || [],
      deck: serverState.deck || [],
      selectedGridPosition: serverState.selectedPosition,
      currentRound: roomSnapshot.currentRound || 0,
      totalRounds: (roomSnapshot.rounds || 9) as (5 | 9),
      gameMode: 'online' as const,
      maxPlayers: roomSnapshot.maxPlayers || 4,
      roundEndTriggered: false,
      hasRevealedCardThisTurn: false
    };
    
    console.log('[MultiplayerGame] Rendering game state:', {
      phase: transformedGameState.gamePhase,
      currentPlayer: transformedGameState.currentPlayerIndex,
      totalSeats: transformedGameState.players.length,
      activePlayers: transformedGameState.players.filter((p: any) => !p.isEmpty).length,
      maxPlayers: transformedGameState.maxPlayers,
      deck: transformedGameState.deck.length,
      discardPile: transformedGameState.discardPile.length
    });
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt">
        <GameHeader 
          gameState={transformedGameState} 
          onPause={() => setShowPauseMenu(true)} 
        />

        <div className="flex-1 p-4 overflow-hidden">
          <GameTable
            gameState={transformedGameState}
            onDrawCard={handleDrawCard}
            onSelectGridPosition={handleSelectGridPosition}
            onKeepDrawnCard={handleKeepDrawnCard}
            onKeepRevealedCard={handleKeepRevealedCard}
            onPeekCard={handlePeekCard}
            onEndTurn={handleEndTurn}
            onTurnStart={() => {}}
          />
        </div>

        {/* Pause Menu */}
        <Dialog open={showPauseMenu} onOpenChange={setShowPauseMenu}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Game Paused</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Button 
                onClick={() => setShowPauseMenu(false)} 
                className="w-full"
              >
                Resume Game
              </Button>
              <Button 
                onClick={handleLeaveRoom} 
                variant="outline" 
                className="w-full"
              >
                Leave Game
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Game Results */}
        <Dialog open={showGameResults} onOpenChange={() => {}}>
          <DialogContent className="max-w-lg">
            <div className="p-8 text-center">
              <div className="mb-6">
                <Trophy className="w-16 h-16 text-game-gold mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Game Over!</h2>
                <p className="text-gray-600">Final Results</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="space-y-3">
                  {roomSnapshot.players
                    ?.sort((a, b) => (a.totalScore || 0) - (b.totalScore || 0))
                    .map((player, index) => (
                      <div 
                        key={player.userId}
                        className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl ${index === 0 ? 'text-game-gold' : 'text-gray-400'}`}>
                            {index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                          </span>
                          <span className="font-medium text-gray-900">
                            {player.username}
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">
                          {player.totalScore || 0} pts
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handlePlayAgain} className="flex-1">
                  Find New Game
                </Button>
                <Button onClick={() => setLocation('/')} variant="outline" className="flex-1">
                  Main Menu
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Fallback for completed or unknown states
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 flex items-center justify-center">
      <Card className="p-8 bg-black/20 backdrop-blur border-white/10">
        <div className="text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Game Status: {roomSnapshot.status}</h2>
          <Button onClick={() => setLocation('/online-multiplayer')}>
            Back to Lobby
          </Button>
        </div>
      </Card>
    </div>
  );
}