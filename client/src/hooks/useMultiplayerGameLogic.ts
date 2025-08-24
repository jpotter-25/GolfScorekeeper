import { useEffect, useCallback, useState, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useGameLogic } from './useGameLogic';
import { GameState, GameSettings, GameAction, Player } from '@/types/game';
import { useToast } from './use-toast';

export interface MultiplayerGameState extends GameState {
  gameRoomId: string;
  hostId: string;
  isHost: boolean;
  connectedPlayers: { [playerId: string]: Player };
  waitingForPlayers: boolean;
  allPlayersReady: boolean;
}

export interface MultiplayerGameLogic {
  gameState: MultiplayerGameState | null;
  isProcessing: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // Game actions that sync across all players
  drawCard: (source: 'draw' | 'discard') => void;
  selectGridPosition: (position: number) => void;
  keepDrawnCard: () => void;
  keepRevealedCard: () => void;
  peekCard: (position: number) => void;
  endTurn: () => void;
  
  // Multiplayer specific actions
  joinGameRoom: (gameRoomId: string) => void;
  leaveGameRoom: () => void;
  setPlayerReady: (ready: boolean) => void;
  startMultiplayerGame: (settings: GameSettings) => void;
}

export function useMultiplayerGameLogic(
  gameRoomId: string,
  userId: string
): MultiplayerGameLogic {
  const { toast } = useToast();
  const [multiplayerGameState, setMultiplayerGameState] = useState<MultiplayerGameState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingActions, setPendingActions] = useState<GameAction[]>([]);
  const syncedGameLogic = useGameLogic();
  const gameStateRef = useRef<MultiplayerGameState | null>(null);

  const {
    socket,
    isConnected,
    connectionState,
    sendMessage,
    joinGameRoom: wsJoinGameRoom,
    leaveGameRoom: wsLeaveGameRoom,
    sendGameAction,
    lastMessage,
    clearMessages
  } = useWebSocket();

  // Keep ref in sync
  useEffect(() => {
    gameStateRef.current = multiplayerGameState;
  }, [multiplayerGameState]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'player_joined':
        handlePlayerJoined(lastMessage);
        break;
      case 'player_left':
        handlePlayerLeft(lastMessage);
        break;
      case 'game_action':
        handleGameAction(lastMessage);
        break;
      case 'game_state_sync':
        handleGameStateSync(lastMessage);
        break;
      case 'room_joined':
        handleRoomJoined(lastMessage);
        break;
      case 'player_ready_changed':
        handlePlayerReadyChanged(lastMessage);
        break;
      case 'game_started':
        handleGameStarted(lastMessage);
        break;
      case 'error':
        toast({
          title: "Game Error",
          description: lastMessage.message,
          variant: "destructive"
        });
        break;
    }
  }, [lastMessage]);

  const handlePlayerJoined = useCallback((message: any) => {
    setMultiplayerGameState(prev => {
      if (!prev) return prev;
      
      toast({
        title: "Player Joined",
        description: `${message.playerName} joined the game`,
      });

      return {
        ...prev,
        connectedPlayers: {
          ...prev.connectedPlayers,
          [message.userId]: message.player
        }
      };
    });
  }, [toast]);

  const handlePlayerLeft = useCallback((message: any) => {
    setMultiplayerGameState(prev => {
      if (!prev) return prev;
      
      toast({
        title: "Player Left",
        description: `${message.playerName} left the game`,
      });

      const newConnectedPlayers = { ...prev.connectedPlayers };
      delete newConnectedPlayers[message.userId];

      return {
        ...prev,
        connectedPlayers: newConnectedPlayers
      };
    });
  }, [toast]);

  const handleGameAction = useCallback((message: any) => {
    const { action, data, playerId } = message;
    
    // Only apply actions from other players (not from ourselves)
    if (playerId === userId) return;

    setIsProcessing(true);
    
    // Apply the action to our local game state
    switch (action) {
      case 'DRAW_CARD':
        syncedGameLogic.drawCard(data.source);
        break;
      case 'SELECT_GRID_POSITION':
        syncedGameLogic.selectGridPosition(data.position);
        break;
      case 'KEEP_DRAWN_CARD':
        syncedGameLogic.keepDrawnCard();
        break;
      case 'KEEP_REVEALED_CARD':
        syncedGameLogic.keepRevealedCard();
        break;
      case 'PEEK_CARD':
        syncedGameLogic.peekCard(data.position);
        break;
      case 'END_TURN':
        syncedGameLogic.endTurn();
        break;
    }
    
    setTimeout(() => setIsProcessing(false), 100);
  }, [userId, syncedGameLogic]);

  const handleGameStateSync = useCallback((message: any) => {
    // Sync the complete game state from the server
    setMultiplayerGameState(prev => ({
      ...prev,
      ...message.gameState
    }));
  }, []);

  const handleRoomJoined = useCallback((message: any) => {
    toast({
      title: "Room Joined",
      description: `Successfully joined game room ${message.gameRoomId}`,
    });
  }, [toast]);

  const handlePlayerReadyChanged = useCallback((message: any) => {
    setMultiplayerGameState(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        connectedPlayers: {
          ...prev.connectedPlayers,
          [message.userId]: {
            ...prev.connectedPlayers[message.userId],
            isReady: message.isReady
          }
        },
        allPlayersReady: message.allPlayersReady
      };
    });
  }, []);

  const handleGameStarted = useCallback((message: any) => {
    toast({
      title: "Game Started",
      description: "All players are ready! Starting the game...",
    });
    
    // Initialize the game with the synchronized state
    syncedGameLogic.startGame(message.settings);
    
    setMultiplayerGameState(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        ...syncedGameLogic.gameState!,
        waitingForPlayers: false,
        gameRoomId,
        hostId: message.hostId,
        isHost: message.hostId === userId,
        connectedPlayers: message.players || {},
        allPlayersReady: true
      };
    });
  }, [syncedGameLogic, gameRoomId, userId, toast]);

  // Multiplayer-aware game actions
  const drawCard = useCallback((source: 'draw' | 'discard') => {
    // Execute locally first for immediate feedback
    syncedGameLogic.drawCard(source);
    
    // Send to other players
    sendGameAction('DRAW_CARD', { source });
  }, [syncedGameLogic, sendGameAction]);

  const selectGridPosition = useCallback((position: number) => {
    syncedGameLogic.selectGridPosition(position);
    sendGameAction('SELECT_GRID_POSITION', { position });
  }, [syncedGameLogic, sendGameAction]);

  const keepDrawnCard = useCallback(() => {
    syncedGameLogic.keepDrawnCard();
    sendGameAction('KEEP_DRAWN_CARD', {});
  }, [syncedGameLogic, sendGameAction]);

  const keepRevealedCard = useCallback(() => {
    syncedGameLogic.keepRevealedCard();
    sendGameAction('KEEP_REVEALED_CARD', {});
  }, [syncedGameLogic, sendGameAction]);

  const peekCard = useCallback((position: number) => {
    syncedGameLogic.peekCard(position);
    sendGameAction('PEEK_CARD', { position });
  }, [syncedGameLogic, sendGameAction]);

  const endTurn = useCallback(() => {
    syncedGameLogic.endTurn();
    sendGameAction('END_TURN', {});
  }, [syncedGameLogic, sendGameAction]);

  // Multiplayer specific actions
  const joinGameRoom = useCallback((roomId: string) => {
    wsJoinGameRoom(roomId);
    
    // Initialize basic multiplayer state
    setMultiplayerGameState({
      ...syncedGameLogic.gameState!,
      gameRoomId: roomId,
      hostId: '',
      isHost: false,
      connectedPlayers: {},
      waitingForPlayers: true,
      allPlayersReady: false
    });
  }, [wsJoinGameRoom, syncedGameLogic.gameState]);

  const leaveGameRoom = useCallback(() => {
    if (multiplayerGameState?.gameRoomId) {
      wsLeaveGameRoom(multiplayerGameState.gameRoomId);
    }
    setMultiplayerGameState(null);
    clearMessages();
  }, [wsLeaveGameRoom, multiplayerGameState?.gameRoomId, clearMessages]);

  const setPlayerReady = useCallback((ready: boolean) => {
    sendMessage({
      type: 'ready_toggle',
      gameRoomId: multiplayerGameState?.gameRoomId,
      isReady: ready
    });
  }, [sendMessage, multiplayerGameState?.gameRoomId]);

  const startMultiplayerGame = useCallback((settings: GameSettings) => {
    if (!multiplayerGameState?.isHost) {
      toast({
        title: "Error",
        description: "Only the host can start the game",
        variant: "destructive"
      });
      return;
    }

    sendMessage({
      type: 'start_game',
      gameRoomId: multiplayerGameState.gameRoomId,
      settings
    });
  }, [sendMessage, multiplayerGameState, toast]);

  // Sync local game state changes to multiplayer state
  useEffect(() => {
    if (syncedGameLogic.gameState && multiplayerGameState) {
      setMultiplayerGameState(prev => ({
        ...prev!,
        ...syncedGameLogic.gameState,
        // Preserve multiplayer-specific fields
        gameRoomId: prev!.gameRoomId,
        hostId: prev!.hostId,
        isHost: prev!.isHost,
        connectedPlayers: prev!.connectedPlayers,
        waitingForPlayers: prev!.waitingForPlayers,
        allPlayersReady: prev!.allPlayersReady
      }));
    }
  }, [syncedGameLogic.gameState, multiplayerGameState?.gameRoomId]);

  return {
    gameState: multiplayerGameState,
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
  };
}