// Self-Debugging System for Multiplayer Rooms
// Implements structured logging, state snapshots, invariant assertions, and automatic triage

import { v4 as uuidv4 } from 'uuid';
import { GameRoom, GameParticipant } from '@shared/schema';

// Configuration
export const SELF_DEBUG_MODE = process.env.NODE_ENV !== 'production';
export const PROTOCOL_VERSION = '1.0.0';

// Correlation tracking
export interface CorrelationContext {
  requestId: string;
  roomOpId: string;
  roomCode?: string;
  roomId?: string;
  playerId?: string;
  serverTs: number;
  protocolVersion: string;
  clientTs?: number;
}

// State snapshot structure (redacted, no PII)
export interface StateSnapshot {
  roomId: string;
  code: string;
  state: string;
  playerCount: number;
  maxPlayers: number;
  visibility: string;
  hostId: string;
  players: Array<{
    id: string;
    ready: boolean;
    connected: boolean;
    joinOrder: number;
  }>;
  rounds: number;
  bet: number;
  serverTs: number;
  protocolVersion: string;
  rngSeed?: string;
  turnId?: string;
}

// Triage bundle for debugging
export interface TriageBundle {
  triggerId: string;
  trigger: string;
  classification: TriageClassification;
  logs: string[];
  snapshots: StateSnapshot[];
  ackStatistics: AckStatistics;
  listingDecision?: string;
  failureReason?: string;
  timestamp: number;
}

export type TriageClassification = 
  | 'IDEMPOTENCY_DUPLICATE'
  | 'EMIT_BEFORE_COMMIT'
  | 'AUTOSTART_CONDITION_FALSE'
  | 'STATE_NOT_PERSISTED'
  | 'CLIENT_NOT_SUBSCRIBED'
  | 'RNG_SEED_MISSING'
  | 'INITIAL_STATE_MISSING'
  | 'PROTOCOL_MISMATCH'
  | 'LISTING_INVARIANT_MISMATCH'
  | 'UNKNOWN';

export interface AckStatistics {
  eventType: string;
  expectedClients: number;
  ackedClients: number;
  ackRate: number;
  timeout: boolean;
}

// Logger with structured output
export class DebugLogger {
  private static logs: Map<string, string[]> = new Map();
  private static snapshots: Map<string, StateSnapshot[]> = new Map();
  private static triageBundles: TriageBundle[] = [];

  static log(context: CorrelationContext, event: string, data?: any) {
    if (!SELF_DEBUG_MODE) return;

    const logEntry = JSON.stringify({
      ...context,
      event,
      data,
      timestamp: Date.now()
    });

    console.log(logEntry);

    // Store for triage
    const key = context.roomId || context.requestId;
    if (!this.logs.has(key)) {
      this.logs.set(key, []);
    }
    this.logs.get(key)!.push(logEntry);

    // Keep only last 100 logs per key
    const logs = this.logs.get(key)!;
    if (logs.length > 100) {
      logs.shift();
    }
  }

  static captureSnapshot(room: GameRoom, participants: GameParticipant[]): StateSnapshot {
    const snapshot: StateSnapshot = {
      roomId: room.id,
      code: room.code,
      state: room.state,
      playerCount: room.playerCount,
      maxPlayers: room.maxPlayers,
      visibility: room.visibility,
      hostId: room.hostId,
      players: participants.map(p => ({
        id: p.userId,
        ready: p.isReady || false,
        connected: p.connected,
        joinOrder: p.joinOrder
      })),
      rounds: room.rounds,
      bet: room.betAmount,
      serverTs: Date.now(),
      protocolVersion: PROTOCOL_VERSION
    };

    if (SELF_DEBUG_MODE) {
      const key = room.id;
      if (!this.snapshots.has(key)) {
        this.snapshots.set(key, []);
      }
      this.snapshots.get(key)!.push(snapshot);
      
      // Keep only last 10 snapshots
      const snapshots = this.snapshots.get(key)!;
      if (snapshots.length > 10) {
        snapshots.shift();
      }
    }

    return snapshot;
  }

  static triggerTriage(
    trigger: string,
    classification: TriageClassification,
    roomId?: string,
    additionalData?: any
  ): TriageBundle {
    const bundle: TriageBundle = {
      triggerId: uuidv4(),
      trigger,
      classification,
      logs: roomId ? (this.logs.get(roomId) || []) : [],
      snapshots: roomId ? (this.snapshots.get(roomId) || []) : [],
      ackStatistics: additionalData?.ackStats || { 
        eventType: 'unknown',
        expectedClients: 0,
        ackedClients: 0,
        ackRate: 0,
        timeout: false
      },
      listingDecision: additionalData?.listingDecision,
      failureReason: additionalData?.failureReason,
      timestamp: Date.now()
    };

    this.triageBundles.push(bundle);
    
    // Keep only last 50 bundles
    if (this.triageBundles.length > 50) {
      this.triageBundles.shift();
    }

    console.error('TRIAGE TRIGGERED:', JSON.stringify(bundle, null, 2));
    
    return bundle;
  }

  static getTriageBundles(): TriageBundle[] {
    return [...this.triageBundles];
  }

  static clearLogs(roomId: string) {
    this.logs.delete(roomId);
    this.snapshots.delete(roomId);
  }
}

// Invariant assertions
export class InvariantChecker {
  static checkRoomInvariants(room: GameRoom, participants: GameParticipant[]): void {
    if (!SELF_DEBUG_MODE) return;

    const context: CorrelationContext = {
      requestId: uuidv4(),
      roomOpId: uuidv4(),
      roomId: room.id,
      roomCode: room.code,
      serverTs: Date.now(),
      protocolVersion: PROTOCOL_VERSION
    };

    // Invariant 1: playerCount <= maxPlayers
    if (room.playerCount > room.maxPlayers) {
      DebugLogger.triggerTriage(
        'Player count exceeds max players',
        'LISTING_INVARIANT_MISMATCH',
        room.id,
        { room, participants }
      );
      throw new Error(`Invariant violation: playerCount (${room.playerCount}) > maxPlayers (${room.maxPlayers})`);
    }

    // Invariant 2: state must be valid
    const validStates = ['waiting', 'active', 'finished'];
    if (!validStates.includes(room.state)) {
      DebugLogger.triggerTriage(
        'Invalid room state',
        'LISTING_INVARIANT_MISMATCH',
        room.id,
        { room, state: room.state }
      );
      throw new Error(`Invariant violation: invalid state '${room.state}'`);
    }

    // Invariant 3: Listing rule
    const shouldBeListed = room.visibility === 'public' && 
                          room.state === 'waiting' && 
                          room.playerCount < room.maxPlayers;
    
    const isListed = room.isPublished;
    
    if (shouldBeListed !== isListed) {
      DebugLogger.log(context, 'listing_invariant_mismatch', {
        shouldBeListed,
        isListed,
        visibility: room.visibility,
        state: room.state,
        playerCount: room.playerCount,
        maxPlayers: room.maxPlayers
      });
    }

    // Invariant 4: playerCount should match actual participants
    const activeParticipants = participants.filter(p => !p.leftAt);
    if (room.playerCount !== activeParticipants.length) {
      DebugLogger.triggerTriage(
        'Player count mismatch',
        'LISTING_INVARIANT_MISMATCH',
        room.id,
        { 
          roomPlayerCount: room.playerCount,
          actualCount: activeParticipants.length,
          participants
        }
      );
    }

    // Invariant 5: Must have a host
    if (!room.hostId) {
      DebugLogger.triggerTriage(
        'Room has no host',
        'LISTING_INVARIANT_MISMATCH',
        room.id,
        { room }
      );
    }
  }

  static checkAutoStartConditions(room: GameRoom, participants: GameParticipant[]): boolean {
    const activeParticipants = participants.filter(p => !p.leftAt);
    const allReady = activeParticipants.every(p => p.isReady);
    const hasMinPlayers = activeParticipants.length >= 2;
    
    const canAutoStart = room.state === 'waiting' && allReady && hasMinPlayers;
    
    if (SELF_DEBUG_MODE) {
      const context: CorrelationContext = {
        requestId: uuidv4(),
        roomOpId: uuidv4(),
        roomId: room.id,
        roomCode: room.code,
        serverTs: Date.now(),
        protocolVersion: PROTOCOL_VERSION
      };
      
      DebugLogger.log(context, 'autostart_check', {
        canAutoStart,
        state: room.state,
        allReady,
        hasMinPlayers,
        activeCount: activeParticipants.length,
        readyStates: activeParticipants.map(p => ({ id: p.userId, ready: p.isReady }))
      });
    }
    
    return canAutoStart;
  }
}

// ACK tracking for critical events
export class AckTracker {
  private static pendingAcks: Map<string, {
    eventType: string;
    expectedClients: Set<string>;
    ackedClients: Set<string>;
    timeout: NodeJS.Timeout;
    resolve: (stats: AckStatistics) => void;
  }> = new Map();

  static async waitForAcks(
    eventId: string,
    eventType: string,
    clientIds: string[],
    timeoutMs: number = 2000
  ): Promise<AckStatistics> {
    return new Promise((resolve) => {
      const expectedClients = new Set(clientIds);
      const ackedClients = new Set<string>();

      const timeout = setTimeout(() => {
        const pending = this.pendingAcks.get(eventId);
        if (pending) {
          const stats: AckStatistics = {
            eventType,
            expectedClients: expectedClients.size,
            ackedClients: pending.ackedClients.size,
            ackRate: expectedClients.size > 0 ? pending.ackedClients.size / expectedClients.size : 0,
            timeout: true
          };
          
          this.pendingAcks.delete(eventId);
          resolve(stats);
          
          // Trigger triage if ACK rate is too low
          if (stats.ackRate < 0.6 && SELF_DEBUG_MODE) {
            DebugLogger.triggerTriage(
              'Low ACK rate for critical event',
              'CLIENT_NOT_SUBSCRIBED',
              undefined,
              { ackStats: stats }
            );
          }
        }
      }, timeoutMs);

      this.pendingAcks.set(eventId, {
        eventType,
        expectedClients,
        ackedClients,
        timeout,
        resolve
      });
    });
  }

  static recordAck(eventId: string, clientId: string): void {
    const pending = this.pendingAcks.get(eventId);
    if (pending) {
      pending.ackedClients.add(clientId);
      
      // Check if we have quorum (60%)
      const ackRate = pending.ackedClients.size / pending.expectedClients.size;
      if (ackRate >= 0.6) {
        clearTimeout(pending.timeout);
        const stats: AckStatistics = {
          eventType: pending.eventType,
          expectedClients: pending.expectedClients.size,
          ackedClients: pending.ackedClients.size,
          ackRate,
          timeout: false
        };
        this.pendingAcks.delete(eventId);
        pending.resolve(stats);
      }
    }
  }
}

// Generate correlation context
export function createCorrelationContext(
  roomId?: string,
  roomCode?: string,
  playerId?: string,
  clientTs?: number
): CorrelationContext {
  return {
    requestId: uuidv4(),
    roomOpId: uuidv4(),
    roomId,
    roomCode,
    playerId,
    serverTs: Date.now(),
    protocolVersion: PROTOCOL_VERSION,
    clientTs
  };
}

// Automatic triage detection
export function detectAndClassifyIssue(error: any, context?: any): TriageClassification {
  const errorMessage = error?.message || error?.toString() || '';
  
  if (errorMessage.includes('duplicate key') || errorMessage.includes('already exists')) {
    return 'IDEMPOTENCY_DUPLICATE';
  }
  
  if (errorMessage.includes('emit before commit')) {
    return 'EMIT_BEFORE_COMMIT';
  }
  
  if (errorMessage.includes('state not persisted')) {
    return 'STATE_NOT_PERSISTED';
  }
  
  if (errorMessage.includes('protocol') || errorMessage.includes('version')) {
    return 'PROTOCOL_MISMATCH';
  }
  
  if (errorMessage.includes('seed') || errorMessage.includes('rng')) {
    return 'RNG_SEED_MISSING';
  }
  
  if (errorMessage.includes('initial') || errorMessage.includes('game state')) {
    return 'INITIAL_STATE_MISSING';
  }
  
  if (context?.autostart === false) {
    return 'AUTOSTART_CONDITION_FALSE';
  }
  
  if (context?.ackRate && context.ackRate < 0.6) {
    return 'CLIENT_NOT_SUBSCRIBED';
  }
  
  return 'UNKNOWN';
}