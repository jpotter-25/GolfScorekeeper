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

  // Auto-join room when connection becomes ready
  useEffect(() => {
    console.log('🔍 Checking auto-join conditions:', {
      connectionState,
      gameRoomId: multiplayerGameState?.gameRoomId,
      waitingForPlayers: multiplayerGameState?.waitingForPlayers,
      hasUserInConnectedPlayers: !!multiplayerGameState?.connectedPlayers[userId],
      userId,
      connectedPlayersCount: Object.keys(multiplayerGameState?.connectedPlayers || {}).length
    });
    
    if (connectionState === 'connected' && multiplayerGameState?.gameRoomId && multiplayerGameState.waitingForPlayers && !multiplayerGameState.connectedPlayers[userId]) {
      console.log('✅ Auto-join conditions met! Sending delayed join room message for:', multiplayerGameState.gameRoomId);
      wsJoinGameRoom(multiplayerGameState.gameRoomId);
    }
  }, [connectionState, multiplayerGameState?.gameRoomId, multiplayerGameState?.waitingForPlayers, multiplayerGameState?.connectedPlayers, userId, wsJoinGameRoom]);

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
      case 'start_game':
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
    console.log('Room joined message received:', message);
    toast({
      title: "Room Joined",
      description: `Successfully joined game room ${message.gameRoomId}`,
    });

    // Update the multiplayer game state with the room information
    setMultiplayerGameState({
      ...message.gameState,
      gameRoomId: message.gameRoomId,
      hostId: message.gameState.hostId,
      isHost: message.gameState.isHost,
      connectedPlayers: message.gameState.connectedPlayers || {},
      waitingForPlayers: message.gameState.waitingForPlayers || true,
      allPlayersReady: message.gameState.allPlayersReady || false,
      // Initialize basic game state structure
      currentPlayer: 0,
      currentRound: 1,
      gamePhase: 'setup',
      players: [],
      deck: [],
      discardPile: [],
      roundScores: [],
      totalScores: [],
      gameEnded: false,
      winner: null
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
      title: "Match Starting...",
      description: "All players are ready! Loading game...",
      duration: 3000,
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
    console.log('joinGameRoom called with roomId:', roomId, 'connectionState:', connectionState);
    
    // Only send join message if we're properly connected and authenticated
    if (connectionState === 'connected') {
      console.log('Sending join room message immediately');
      wsJoinGameRoom(roomId);
    } else {
      console.log('Waiting for connection before joining room');
      // We'll send the join message when connection becomes ready
    }
    
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
  }, [wsJoinGameRoom, syncedGameLogic.gameState, connectionState]);

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

  const startMultiplayerGame = useCallback((settings: GameSettings, isAutoStart = false) => {
    // For auto-start (when room status changes to active), all players initialize locally
    if (isAutoStart) {
      console.log('🎮 Auto-starting game for player');
      syncedGameLogic.startGame(settings);
      
      // Immediately set the multiplayer state - don't wait
      const initialGameState = syncedGameLogic.gameState;
      if (!initialGameState) {
        console.error('Failed to initialize game state');
        return;
      }
      
      setMultiplayerGameState(prev => {
        console.log('Setting multiplayer game state from auto-start', { prev, initialGameState });
        return {
          ...initialGameState,
          gameRoomId: gameRoomId,
          hostId: prev?.hostId || '',
          isHost: prev?.isHost || false,
          connectedPlayers: prev?.connectedPlayers || {},
          waitingForPlayers: false,
          allPlayersReady: true
        };
      });
      return;
    }
    
    // Manual start by host
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
  }, [sendMessage, multiplayerGameState, toast, syncedGameLogic, gameRoomId]);

  // Sync local game state changes to multiplayer state
  useEffect(() => {
    // Only sync if we have both states and the game has started (not waiting for players)
    if (syncedGameLogic.gameState && multiplayerGameState && !multiplayerGameState.waitingForPlayers) {
      setMultiplayerGameState(prev => {
        if (!prev || prev.waitingForPlayers) return prev;
        return {
          ...prev,
          ...syncedGameLogic.gameState,
          // Preserve multiplayer-specific fields
          gameRoomId: prev.gameRoomId,
          hostId: prev.hostId,
          isHost: prev.isHost,
          connectedPlayers: prev.connectedPlayers,
          waitingForPlayers: prev.waitingForPlayers,
          allPlayersReady: prev.allPlayersReady
        };
      });
    }
  }, [syncedGameLogic.gameState, multiplayerGameState?.gameRoomId, multiplayerGameState?.waitingForPlayers]);

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