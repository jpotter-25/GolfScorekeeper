import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface WebSocketMessage {
  type: string;
  timestamp?: number;
  [key: string]: any;
}

export interface WebSocketHook {
  socket: WebSocket | null;
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (message: WebSocketMessage) => void;
  createRoom: (rounds: number, maxPlayers: number, betAmount: number, isPrivate: boolean, password?: string) => void;
  joinGameRoom: (gameRoomId: string, password?: string) => void;
  leaveGameRoom: (gameRoomId: string) => void;
  sendChatMessage: (content: string, gameRoomId?: string) => void;
  sendGameAction: (action: string, data: any) => void;
  toggleReady: (isReady: boolean) => void;
  startGame: () => void;
  updateRoomSettings: (settings: any) => void;
  transferCrown: (targetUserId: string) => void;
  rejoinRoom: (roomCode: string) => void;
  lastMessage: WebSocketMessage | null;
  messages: WebSocketMessage[];
  clearMessages: () => void;
}

export function useWebSocket(): WebSocketHook {
  const { user } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<WebSocketMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = useRef(1000);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastMessage(null);
  }, []);

  const connect = useCallback(() => {
    if (!user?.id || socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionState('connecting');
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const newSocket = new WebSocket(wsUrl);
      
      newSocket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionState('connecting'); // Still connecting until authenticated
        reconnectAttempts.current = 0;
        reconnectDelay.current = 1000;
        
        // Add small delay to ensure connection is stable before authenticating
        setTimeout(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            console.log('🔐 Sending authentication for user:', user.id);
            newSocket.send(JSON.stringify({
              type: 'authenticate',
              userId: user.id
            }));
          } else {
            console.warn('⚠️ WebSocket not ready for authentication');
          }
        }, 200);
      };

      newSocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          setMessages(prev => [...prev.slice(-49), message]); // Keep last 50 messages
          
          // Handle authentication response
          if (message.type === 'authenticated') {
            console.log('✅ WebSocket authenticated successfully!', message);
            setIsAuthenticated(true);
            setConnectionState('connected');
            
            // Send any pending messages that were queued while authenticating
            if (pendingMessages.length > 0) {
              console.log('📤 Sending', pendingMessages.length, 'pending messages:', pendingMessages);
              pendingMessages.forEach(pendingMsg => {
                console.log('📨 Sending queued message:', pendingMsg);
                newSocket.send(JSON.stringify(pendingMsg));
              });
              setPendingMessages([]);
            } else {
              console.log('✨ No pending messages to send');
            }
          } else if (message.type === 'auth_error') {
            console.error('❌ WebSocket authentication failed:', message.message);
            setConnectionState('error');
          } else if (message.type === 'lobby_update') {
            // Handle real-time lobby updates
            console.log('🏠 Received lobby update:', message.lobbies);
            // Trigger React Query invalidation for lobby data
            const queryClient = (window as any).__reactQueryClient__;
            if (queryClient) {
              queryClient.invalidateQueries({ queryKey: ['/api/game-rooms/all-lobbies'] });
              queryClient.setQueryData(['/api/game-rooms/all-lobbies'], message.lobbies);
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      newSocket.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason, 'wasAuthenticated:', isAuthenticated);
        setIsConnected(false);
        setIsAuthenticated(false);
        setConnectionState('disconnected');
        setSocket(null);
        
        // Don't clear pending messages - keep them for retry
        
        // Attempt to reconnect unless it was a clean close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          // Shorter delay for faster reconnection
          reconnectDelay.current = Math.min(reconnectDelay.current * 1.2, 5000);
          
          console.log(`🔄 Attempting to reconnect in ${reconnectDelay.current}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay.current);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('❌ Max reconnect attempts reached');
          setConnectionState('error');
          setPendingMessages([]); // Clear only after max attempts
        }
      };

      newSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionState('error');
      };

      setSocket(newSocket);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionState('error');
    }
  }, [user?.id, socket?.readyState]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (socket) {
      socket.close(1000, 'User initiated disconnect');
      setSocket(null);
    }
    
    setIsConnected(false);
    setIsAuthenticated(false);
    setConnectionState('disconnected');
    setPendingMessages([]);
    reconnectAttempts.current = 0;
  }, [socket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    console.log('🚀 sendMessage called with:', message, {
      socketReady: socket?.readyState === WebSocket.OPEN,
      isAuthenticated,
      connectionState
    });
    
    if (socket?.readyState === WebSocket.OPEN && isAuthenticated) {
      console.log('✅ Sending message immediately:', message);
      socket.send(JSON.stringify(message));
    } else if (socket?.readyState === WebSocket.OPEN && !isAuthenticated) {
      // Queue message until authenticated
      console.log('⏳ Queueing message until authenticated:', message);
      setPendingMessages(prev => {
        const newQueue = [...prev, message];
        console.log('📝 Message queue now has:', newQueue.length, 'messages');
        return newQueue;
      });
    } else {
      console.warn('❌ WebSocket is not connected. Message not sent:', message);
    }
  }, [socket, isAuthenticated, connectionState]);

  const createRoom = useCallback((rounds: number, maxPlayers: number, betAmount: number, isPrivate: boolean, password?: string) => {
    console.log('🏠 createRoom called with:', { rounds, maxPlayers, betAmount, isPrivate });
    sendMessage({
      type: 'create_room',
      rounds,
      maxPlayers,
      betAmount,
      isPrivate,
      password
    });
  }, [sendMessage]);

  const joinGameRoom = useCallback((gameRoomId: string, password?: string) => {
    console.log('🎯 joinGameRoom called with:', gameRoomId, {
      socketReady: socket?.readyState === WebSocket.OPEN,
      isAuthenticated,
      connectionState,
      pendingMessagesCount: pendingMessages.length
    });
    sendMessage({
      type: 'join_room',
      roomCode: gameRoomId,
      password
    });
  }, [sendMessage, socket?.readyState, isAuthenticated, connectionState, pendingMessages.length]);

  const leaveGameRoom = useCallback((gameRoomId: string) => {
    sendMessage({
      type: 'leave_room',
      gameRoomId
    });
  }, [sendMessage]);

  const sendChatMessage = useCallback((content: string, gameRoomId?: string) => {
    sendMessage({
      type: 'chat_message',
      content,
      gameRoomId
    });
  }, [sendMessage]);

  const sendGameAction = useCallback((action: string, data: any) => {
    sendMessage({
      type: 'game_action',
      action,
      actionData: data
    });
  }, [sendMessage]);

  const toggleReady = useCallback((isReady: boolean) => {
    console.log('✅ toggleReady called:', isReady);
    sendMessage({
      type: 'ready_toggle',
      isReady
    });
  }, [sendMessage]);

  const startGame = useCallback(() => {
    console.log('🚀 startGame called');
    sendMessage({
      type: 'start_game'
    });
  }, [sendMessage]);

  const updateRoomSettings = useCallback((settings: any) => {
    console.log('⚙️ updateRoomSettings called:', settings);
    sendMessage({
      type: 'update_room_settings',
      ...settings
    });
  }, [sendMessage]);

  const transferCrown = useCallback((targetUserId: string) => {
    console.log('👑 transferCrown called:', targetUserId);
    sendMessage({
      type: 'transfer_crown',
      targetUserId
    });
  }, [sendMessage]);

  const rejoinRoom = useCallback((roomCode: string) => {
    console.log('🔄 rejoinRoom called:', roomCode);
    sendMessage({
      type: 'rejoin_room',
      roomCode
    });
  }, [sendMessage]);

  // Connect when user is available
  useEffect(() => {
    if (user?.id && !socket) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect, socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    connectionState,
    sendMessage,
    createRoom,
    joinGameRoom,
    leaveGameRoom,
    sendChatMessage,
    sendGameAction,
    toggleReady,
    startGame,
    updateRoomSettings,
    transferCrown,
    rejoinRoom,
    lastMessage,
    messages,
    clearMessages
  };
}