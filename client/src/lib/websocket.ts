// WebSocket connection manager for multiplayer functionality
export type WSMessageType = 
  | 'connected' | 'authenticated' | 'error' | 'auth'
  | 'room:created' | 'room:joined' | 'room:left' | 'room:deleted'
  | 'room:create' | 'room:join' | 'room:leave'
  | 'room:list:snapshot' | 'room:list:diff' | 'room:list:subscribe' | 'room:list:unsubscribe'
  | 'player:joined' | 'player:left' | 'player:ready' | 'player:disconnected' | 'player:reconnected'
  | 'host:changed' | 'settings:updated' | 'room:settings:update'
  | 'game:started' | 'game:state' | 'game:move' | 'game:ended' | 'game:start'
  | 'room:ready:set' | 'move:submit'
  | 'session:pong' | 'session:ping';

export interface WSMessage {
  type: WSMessageType;
  [key: string]: any;
}

export interface RoomCard {
  code: string;
  name: string;
  visibility: 'public' | 'private';
  isLocked: boolean;
  hostName: string;
  hostHasCrown: boolean;
  playerCount: number;
  maxPlayers: number;
  rounds: number;
  betCoins: number;
  state: 'waiting' | 'active' | 'finished';
}

type WSEventCallback = (message: WSMessage) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<WSMessageType, Set<WSEventCallback>> = new Map();
  private messageQueue: WSMessage[] = [];
  private isConnecting = false;
  private isAuthenticated = false;
  private connectionId: string | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private userId: string | null = null;

  constructor() {
    // Determine WebSocket URL based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = `${protocol}//${host}/ws-rooms`;
  }

  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // Wait for current connection attempt
        const checkConnection = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          } else if (!this.isConnecting) {
            clearInterval(checkConnection);
            reject(new Error('Connection failed'));
          }
        }, 100);
        return;
      }

      this.isConnecting = true;
      this.userId = userId;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          
          // Start ping interval
          this.startPingInterval();
          
          // Authenticate immediately
          this.send({ type: 'auth', userId });
          
          // Process queued messages
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
              this.send(message);
            }
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WSMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnecting = false;
          this.isAuthenticated = false;
          this.connectionId = null;
          this.stopPingInterval();
          
          // Attempt reconnection if not manually closed
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
            setTimeout(() => {
              if (this.userId) {
                this.connect(this.userId).catch(console.error);
              }
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isAuthenticated = false;
    this.connectionId = null;
    this.listeners.clear();
    this.messageQueue = [];
  }

  private handleMessage(message: WSMessage) {
    // Handle special messages
    switch (message.type) {
      case 'connected':
        this.connectionId = message.connectionId;
        break;
      case 'authenticated':
        this.isAuthenticated = true;
        break;
      case 'session:pong':
        // Pong received, connection is healthy
        break;
    }

    // Notify listeners
    const callbacks = this.listeners.get(message.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in WebSocket listener:', error);
        }
      });
    }
  }

  on(type: WSMessageType, callback: WSEventCallback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  off(type: WSMessageType, callback: WSEventCallback) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  send(message: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message if not connected
      this.messageQueue.push(message);
    }
  }

  // Room management methods
  createRoom(options: {
    name?: string;
    visibility?: 'public' | 'private';
    password?: string;
    maxPlayers?: number;
    rounds?: number;
    betCoins?: number;
  }) {
    this.send({
      type: 'room:create',
      ...options
    });
  }

  joinRoom(code: string, password?: string) {
    this.send({
      type: 'room:join',
      code,
      password
    });
  }

  leaveRoom(code: string) {
    this.send({
      type: 'room:leave',
      code
    });
  }

  subscribeToRoomList() {
    this.send({
      type: 'room:list:subscribe'
    });
  }

  unsubscribeFromRoomList() {
    this.send({
      type: 'room:list:unsubscribe'
    });
  }

  updateRoomSettings(code: string, settings: {
    name?: string;
    visibility?: 'public' | 'private';
    password?: string;
    maxPlayers?: number;
    rounds?: number;
    betCoins?: number;
  }) {
    this.send({
      type: 'room:settings:update',
      code,
      ...settings
    });
  }

  setReady(code: string, ready: boolean) {
    this.send({
      type: 'room:ready:set',
      code,
      ready
    });
  }

  startGame(code: string) {
    this.send({
      type: 'game:start',
      code
    });
  }

  submitMove(code: string, move: any) {
    this.send({
      type: 'move:submit',
      code,
      move
    });
  }

  private startPingInterval() {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'session:ping',
          ts: Date.now()
        });
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Getters
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isReady(): boolean {
    return this.isConnected && this.isAuthenticated;
  }

  get connection(): { id: string | null; authenticated: boolean } {
    return {
      id: this.connectionId,
      authenticated: this.isAuthenticated
    };
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager();