import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useMultiplayerGameLogic } from '@/hooks/useMultiplayerGameLogic';
import { GameSettings, Player } from '@/types/game';

interface MultiplayerPlayer extends Player {
  isReady?: boolean;
}
import GameHeader from '@/components/Game/GameHeader';
import GameTable from '@/components/Game/GameTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Crown, Wifi, WifiOff, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MultiplayerGame() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [gameRoomId, setGameRoomId] = useState<string>('');
  const [showLobby, setShowLobby] = useState(true);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    playerCount: 4,
    rounds: 9,
    mode: 'online'
  });

  const {
    gameState,
    isProcessing,
    connectionState,
    drawCard,
    selectGridPosition,
    keepDrawnCard,
    keepRevealedCard,
    peekCard,
    endTurn,
    joinGameRoom,
    leaveGameRoom,
    setPlayerReady,
    startMultiplayerGame
  } = useMultiplayerGameLogic(gameRoomId, user?.id || '');

  // Get room ID from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    
    if (roomId) {
      setGameRoomId(roomId);
      joinGameRoom(roomId);
    } else {
      // Redirect back to multiplayer hub if no room specified
      setLocation('/multiplayer');
    }
  }, [joinGameRoom, setLocation]);

  // Hide lobby when game starts
  useEffect(() => {
    if (gameState && !gameState.waitingForPlayers && gameState.gamePhase !== 'setup') {
      setShowLobby(false);
    }
  }, [gameState]);

  const handleLeaveRoom = () => {
    leaveGameRoom();
    setLocation('/multiplayer');
  };

  const handleStartGame = () => {
    startMultiplayerGame(gameSettings);
  };

  const handlePlayerReady = () => {
    setPlayerReady(true);
  };

  const getConnectionStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        return <Badge className="bg-green-600"><Wifi className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'connecting':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Connecting...</Badge>;
      case 'disconnected':
        return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" />Disconnected</Badge>;
      case 'error':
        return <Badge variant="destructive"><WifiOff className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return null;
    }
  };

  const connectedPlayersList: MultiplayerPlayer[] = gameState ? Object.values(gameState.connectedPlayers) : [];
  const isHost = gameState?.isHost || false;

  if (showLobby) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="container mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-white mb-2">Game Lobby</h1>
            <p className="text-slate-300">Room Code: <span className="font-mono text-game-gold text-xl">{gameRoomId}</span></p>
            <div className="flex justify-center">{getConnectionStatusBadge()}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Players */}
            <Card className="bg-slate-800/50 border-slate-700" data-testid="card-players">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Users className="w-5 h-5" />
                  Players ({connectedPlayersList.length}/{gameSettings.playerCount})
                </CardTitle>
                <CardDescription>
                  Waiting for players to join and ready up
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {connectedPlayersList.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30"
                    data-testid={`player-${player.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {player.name[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-white flex items-center gap-2">
                          {player.name}
                          {isHost && player.id === user?.id && (
                            <Crown className="w-4 h-4 text-game-gold" />
                          )}
                        </p>
                        <p className="text-sm text-slate-400">Level {user?.level || 1}</p>
                      </div>
                    </div>
                    <Badge variant={player.isReady ? "default" : "secondary"}>
                      {player.isReady ? "Ready" : "Not Ready"}
                    </Badge>
                  </div>
                ))}
                
                {/* Empty slots */}
                {Array.from({ length: gameSettings.playerCount - connectedPlayersList.length }).map((_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="flex items-center gap-3 p-3 bg-slate-700/10 rounded-lg border border-slate-600/20 border-dashed"
                  >
                    <div className="w-10 h-10 bg-slate-600/30 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-slate-500" />
                    </div>
                    <p className="text-slate-500">Waiting for player...</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Game Settings & Actions */}
            <Card className="bg-slate-800/50 border-slate-700" data-testid="card-settings">
              <CardHeader>
                <CardTitle className="text-white">Game Settings</CardTitle>
                <CardDescription>
                  Configure the game before starting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Players</label>
                  <div className="flex gap-2">
                    {[2, 3, 4].map((count) => (
                      <Button
                        key={count}
                        variant={gameSettings.playerCount === count ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGameSettings(prev => ({ ...prev, playerCount: count as 2 | 3 | 4 }))}
                        disabled={!isHost}
                        data-testid={`button-players-${count}`}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Rounds</label>
                  <div className="flex gap-2">
                    {[5, 9].map((rounds) => (
                      <Button
                        key={rounds}
                        variant={gameSettings.rounds === rounds ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGameSettings(prev => ({ ...prev, rounds: rounds as 5 | 9 }))}
                        disabled={!isHost}
                        data-testid={`button-rounds-${rounds}`}
                      >
                        {rounds}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <Button
                    onClick={handlePlayerReady}
                    className="w-full"
                    disabled={connectionState !== 'connected'}
                    data-testid="button-ready"
                  >
                    Ready Up!
                  </Button>
                  
                  {isHost && gameState?.allPlayersReady && (
                    <Button
                      onClick={handleStartGame}
                      className="w-full bg-green-600 hover:bg-green-700"
                      data-testid="button-start-game"
                    >
                      Start Game
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleLeaveRoom}
                    variant="outline"
                    className="w-full"
                    data-testid="button-leave-room"
                  >
                    Leave Room
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Game view (when game is active)
  if (!gameState || gameState.waitingForPlayers) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-game-gold mx-auto"></div>
          <p className="text-white text-lg">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" data-testid="multiplayer-game">
      <GameHeader 
        gameState={gameState} 
        onPause={() => {}}
      />
      
      <GameTable
        gameState={gameState}
        onDrawCard={drawCard}
        onSelectGridPosition={selectGridPosition}
        onKeepDrawnCard={keepDrawnCard}
        onKeepRevealedCard={keepRevealedCard}
        onPeekCard={peekCard}
        onEndTurn={endTurn}
      />

      {/* Connection status overlay */}
      {connectionState !== 'connected' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-80 bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <WifiOff className="w-5 h-5" />
                Connection Issue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300">
                {connectionState === 'disconnected' && "Lost connection to game server"}
                {connectionState === 'error' && "Failed to connect to game server"}
                {connectionState === 'connecting' && "Reconnecting to game server..."}
              </p>
              <Button
                onClick={handleLeaveRoom}
                variant="outline"
                className="w-full"
                data-testid="button-leave-on-disconnect"
              >
                Return to Lobby
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}