import { useState, useEffect } from 'react';
import { wsManager } from '@/lib/websocket';
import { Card } from '@/components/ui/card';

interface DebugInfo {
  roomState: string | null;
  playerCount: number;
  maxPlayers: number;
  readyCount: number;
  hostId: string | null;
  protocolVersion: string;
  currentTurnId: string | null;
  msRemaining: number | null;
  connectionId: string | null;
  isAuthenticated: boolean;
  ackedEvents: string[];
  lastError: string | null;
}

export function DebugHUD() {
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const [isVisible, setIsVisible] = useState(true);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    roomState: null,
    playerCount: 0,
    maxPlayers: 0,
    readyCount: 0,
    hostId: null,
    protocolVersion: '1.0.0',
    currentTurnId: null,
    msRemaining: null,
    connectionId: null,
    isAuthenticated: false,
    ackedEvents: [],
    lastError: null
  });
  
  useEffect(() => {
    // Listen to WebSocket events for debug info
    const handlers: Record<string, (message: any) => void> = {
      'connected': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          connectionId: msg.connectionId,
          protocolVersion: msg.protocolVersion || '1.0.0'
        }));
      },
      'authenticated': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          isAuthenticated: true
        }));
      },
      'room:created': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          roomState: 'waiting',
          playerCount: 1,
          maxPlayers: msg.room.maxPlayers,
          hostId: msg.room.hostName
        }));
      },
      'player:joined': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          playerCount: prev.playerCount + 1
        }));
      },
      'player:left': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          playerCount: Math.max(0, prev.playerCount - 1)
        }));
      },
      'player:ready': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          readyCount: msg.ready ? prev.readyCount + 1 : prev.readyCount - 1
        }));
      },
      'game:started': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          roomState: 'active',
          currentTurnId: msg.currentTurnId,
          msRemaining: 30000 // Default turn time
        }));
        
        // Send ACK for critical event
        if (msg.requiresAck && msg.eventId) {
          wsManager.send({
            type: 'ack',
            eventId: msg.eventId
          });
          setDebugInfo(prev => ({
            ...prev,
            ackedEvents: [...prev.ackedEvents, 'game:started']
          }));
        }
      },
      'host:changed': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          hostId: msg.hostId
        }));
        
        // Send ACK for critical event
        if (msg.requiresAck && msg.eventId) {
          wsManager.send({
            type: 'ack',
            eventId: msg.eventId
          });
          setDebugInfo(prev => ({
            ...prev,
            ackedEvents: [...prev.ackedEvents, 'host:changed']
          }));
        }
      },
      'room:deleted': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          roomState: null,
          playerCount: 0,
          readyCount: 0
        }));
        
        // Send ACK for critical event
        if (msg.requiresAck && msg.eventId) {
          wsManager.send({
            type: 'ack',
            eventId: msg.eventId
          });
          setDebugInfo(prev => ({
            ...prev,
            ackedEvents: [...prev.ackedEvents, 'room:deleted']
          }));
        }
      },
      'error': (msg) => {
        setDebugInfo(prev => ({
          ...prev,
          lastError: msg.message
        }));
      },
      'session:pong': (msg) => {
        const latency = Date.now() - msg.clientTs;
        console.log(`[Debug] Ping latency: ${latency}ms`);
      }
    };
    
    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      wsManager.on(event as any, handler);
    });
    
    // Timer for remaining time
    const timer = setInterval(() => {
      setDebugInfo(prev => {
        if (prev.msRemaining && prev.msRemaining > 0) {
          return { ...prev, msRemaining: prev.msRemaining - 100 };
        }
        return prev;
      });
    }, 100);
    
    // Handle reconnection
    const handleReconnect = () => {
      console.log('[Debug] Reconnecting - requesting full state snapshot');
      if (wsManager.isConnected) {
        wsManager.send({
          type: 'state:request',
          fullSnapshot: true
        });
      }
    };
    
    // Check connection status periodically
    const connectionCheck = setInterval(() => {
      const wasConnected = debugInfo.isAuthenticated;
      const isConnected = wsManager.isReady;
      
      if (!wasConnected && isConnected) {
        handleReconnect();
      }
    }, 1000);
    
    // Cleanup
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        wsManager.off(event as any, handler);
      });
      clearInterval(timer);
      clearInterval(connectionCheck);
    };
  }, []);
  
  // Toggle visibility with keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  if (!isVisible) {
    return (
      <div className="fixed top-2 right-2 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-50 hover:opacity-100"
        >
          Debug
        </button>
      </div>
    );
  }
  
  return (
    <Card className="fixed top-2 right-2 z-50 bg-gray-900/95 text-white p-3 rounded-lg shadow-lg max-w-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-bold text-yellow-400">Debug HUD</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-1 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-gray-400">Connection:</span>
          <span className={wsManager.isConnected ? 'text-green-400' : 'text-red-400'}>
            {wsManager.isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Auth:</span>
          <span className={debugInfo.isAuthenticated ? 'text-green-400' : 'text-yellow-400'}>
            {debugInfo.isAuthenticated ? 'Yes' : 'No'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Protocol:</span>
          <span>{debugInfo.protocolVersion}</span>
        </div>
        
        {debugInfo.connectionId && (
          <div className="flex justify-between">
            <span className="text-gray-400">ConnID:</span>
            <span className="text-xs">{debugInfo.connectionId.slice(0, 8)}...</span>
          </div>
        )}
        
        {debugInfo.roomState && (
          <>
            <div className="border-t border-gray-700 my-1"></div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Room State:</span>
              <span className={
                debugInfo.roomState === 'active' ? 'text-green-400' : 
                debugInfo.roomState === 'waiting' ? 'text-yellow-400' : 
                'text-gray-400'
              }>
                {debugInfo.roomState}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Players:</span>
              <span>{debugInfo.playerCount}/{debugInfo.maxPlayers}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Ready:</span>
              <span>{debugInfo.readyCount}</span>
            </div>
            
            {debugInfo.hostId && (
              <div className="flex justify-between">
                <span className="text-gray-400">Host:</span>
                <span className="text-xs">{debugInfo.hostId.slice(0, 8)}...</span>
              </div>
            )}
            
            {debugInfo.currentTurnId && (
              <div className="flex justify-between">
                <span className="text-gray-400">Turn:</span>
                <span className="text-xs">{debugInfo.currentTurnId.slice(0, 8)}...</span>
              </div>
            )}
            
            {debugInfo.msRemaining !== null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Time:</span>
                <span className={debugInfo.msRemaining < 5000 ? 'text-red-400' : ''}>
                  {Math.ceil(debugInfo.msRemaining / 1000)}s
                </span>
              </div>
            )}
          </>
        )}
        
        {debugInfo.ackedEvents.length > 0 && (
          <>
            <div className="border-t border-gray-700 my-1"></div>
            <div className="text-gray-400">ACKed Events:</div>
            <div className="text-xs text-green-400">
              {debugInfo.ackedEvents.slice(-3).join(', ')}
            </div>
          </>
        )}
        
        {debugInfo.lastError && (
          <>
            <div className="border-t border-gray-700 my-1"></div>
            <div className="text-red-400 text-xs">
              Error: {debugInfo.lastError}
            </div>
          </>
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        Press Ctrl+Shift+D to toggle
      </div>
    </Card>
  );
}