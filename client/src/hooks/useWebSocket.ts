import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface WebSocketHook {
  socket: WebSocket | null;
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (message: WebSocketMessage) => void;
  joinGameRoom: (gameRoomId: string) => void;
  leaveGameRoom: (gameRoomId: string) => void;
  sendChatMessage: (content: string, gameRoomId?: string) => void;
  sendGameAction: (action: string, data: any) => void;
  lastMessage: WebSocketMessage | null;
  messages: WebSocketMessage[];
  clearMessages: () => void;
}

export function useWebSocket(): WebSocketHook {
  const { user } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
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
        setConnectionState('connected');
        reconnectAttempts.current = 0;
        reconnectDelay.current = 1000;
        
        // Authenticate immediately after connection
        newSocket.send(JSON.stringify({
          type: 'authenticate',
          userId: user.id
        }));
      };

      newSocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          setMessages(prev => [...prev.slice(-49), message]); // Keep last 50 messages
          
          // Handle authentication response
          if (message.type === 'authenticated') {
            console.log('WebSocket authenticated successfully', message);
          } else if (message.type === 'auth_error') {
            console.error('WebSocket authentication failed:', message.message);
            setConnectionState('error');
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      newSocket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionState('disconnected');
        setSocket(null);
        
        // Attempt to reconnect unless it was a clean close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, 10000);
          
          console.log(`Attempting to reconnect in ${reconnectDelay.current}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay.current);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('Max reconnect attempts reached');
          setConnectionState('error');
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
    setConnectionState('disconnected');
    reconnectAttempts.current = 0;
  }, [socket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  }, [socket]);

  const joinGameRoom = useCallback((gameRoomId: string) => {
    sendMessage({
      type: 'join_room',
      gameRoomId
    });
  }, [sendMessage]);

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
      data
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
    joinGameRoom,
    leaveGameRoom,
    sendChatMessage,
    sendGameAction,
    lastMessage,
    messages,
    clearMessages
  };
}