// Auto-start logic for multiplayer rooms
import { db } from '../db';
import { gameRooms, gameParticipants } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { 
  DebugLogger, 
  InvariantChecker,
  createCorrelationContext,
  AckTracker,
  SELF_DEBUG_MODE
} from './self-debug';
import { v4 as uuidv4 } from 'uuid';

export interface AutoStartResult {
  started: boolean;
  reason?: string;
  participants?: any[];
  room?: any;
}

export class AutoStartManager {
  private static pendingStarts: Map<string, NodeJS.Timeout> = new Map();
  
  static async checkAndAutoStart(roomId: string): Promise<AutoStartResult> {
    const context = createCorrelationContext(roomId);
    DebugLogger.log(context, 'autostart.check.start', { roomId });
    
    try {
      // Get room and participants
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId));
      
      if (!room) {
        DebugLogger.log(context, 'autostart.check.room_not_found', { roomId });
        return { started: false, reason: 'Room not found' };
      }
      
      context.roomCode = room.code;
      
      // Get active participants
      const participants = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, roomId),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      // Check auto-start conditions
      const canAutoStart = InvariantChecker.checkAutoStartConditions(room, participants);
      
      if (!canAutoStart) {
        const notReadyCount = participants.filter(p => !p.isReady).length;
        const reason = room.state !== 'waiting' ? 'Room not in waiting state' :
                      participants.length < 2 ? `Not enough players (${participants.length}/2 min)` :
                      notReadyCount > 0 ? `${notReadyCount} player(s) not ready` :
                      'Unknown reason';
        
        DebugLogger.log(context, 'autostart.check.conditions_not_met', {
          roomId,
          state: room.state,
          playerCount: participants.length,
          readyCount: participants.filter(p => p.isReady).length,
          reason
        });
        
        return { started: false, reason, participants, room };
      }
      
      // All conditions met - check if we already have a pending start
      if (this.pendingStarts.has(roomId)) {
        DebugLogger.log(context, 'autostart.check.already_pending', { roomId });
        return { started: false, reason: 'Auto-start already pending' };
      }
      
      // Set a 2-second delay before auto-starting (per spec)
      DebugLogger.log(context, 'autostart.scheduling', { 
        roomId,
        delayMs: 2000,
        playerCount: participants.length 
      });
      
      const timeout = setTimeout(async () => {
        await this.executeAutoStart(roomId, room, participants);
        this.pendingStarts.delete(roomId);
      }, 2000);
      
      this.pendingStarts.set(roomId, timeout);
      
      return { started: true, reason: 'Auto-start scheduled', participants, room };
      
    } catch (error) {
      DebugLogger.log(context, 'autostart.check.error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      DebugLogger.triggerTriage(
        'Auto-start check failed',
        'AUTOSTART_CONDITION_FALSE',
        roomId,
        { error: error instanceof Error ? error.message : String(error) }
      );
      return { started: false, reason: 'Error checking auto-start conditions' };
    }
  }
  
  static async executeAutoStart(roomId: string, room: any, participants: any[]): Promise<void> {
    const context = createCorrelationContext(roomId, room.code);
    DebugLogger.log(context, 'autostart.execute.start', { 
      roomId, 
      playerCount: participants.length 
    });
    
    try {
      // Double-check conditions haven't changed
      const [currentRoom] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId));
      const currentParticipants = await db.select().from(gameParticipants)
        .where(and(
          eq(gameParticipants.gameRoomId, roomId),
          sql`${gameParticipants.leftAt} IS NULL`
        ));
      
      const stillCanStart = InvariantChecker.checkAutoStartConditions(currentRoom, currentParticipants);
      
      if (!stillCanStart) {
        DebugLogger.log(context, 'autostart.execute.conditions_changed', { roomId });
        DebugLogger.triggerTriage(
          'Auto-start conditions changed during delay',
          'AUTOSTART_CONDITION_FALSE',
          roomId,
          { 
            originalPlayerCount: participants.length,
            currentPlayerCount: currentParticipants.length,
            allReady: currentParticipants.every(p => p.isReady)
          }
        );
        return;
      }
      
      // Generate initial game state
      const rngSeed = Math.random().toString(36).substring(7);
      const initialGameState = {
        rngSeed,
        currentTurn: 0,
        currentPlayer: currentParticipants[0].userId,
        roundNumber: 1,
        phase: 'peek',
        startedAt: new Date().toISOString()
      };
      
      DebugLogger.log(context, 'autostart.execute.state_prepared', { 
        roomId,
        rngSeed,
        initialPlayer: currentParticipants[0].userId
      });
      
      // Update room state to active
      await db.update(gameRooms)
        .set({
          state: 'active',
          gameState: initialGameState,
          startedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(gameRooms.id, roomId));
      
      DebugLogger.log(context, 'autostart.execute.state_persisted', { roomId });
      
      // Capture snapshot after state change
      const updatedRoom = { ...currentRoom, state: 'active', gameState: initialGameState };
      const snapshot = DebugLogger.captureSnapshot(updatedRoom, currentParticipants);
      
      DebugLogger.log(context, 'autostart.execute.snapshot_captured', { 
        roomId,
        snapshot 
      });
      
      // Check invariants after state change
      InvariantChecker.checkRoomInvariants(updatedRoom, currentParticipants);
      
      // Emit game:started event (this should be done by the WebSocket manager)
      DebugLogger.log(context, 'autostart.execute.complete', { 
        roomId,
        state: 'active',
        playerCount: currentParticipants.length
      });
      
    } catch (error) {
      DebugLogger.log(context, 'autostart.execute.error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      DebugLogger.triggerTriage(
        'Auto-start execution failed',
        error instanceof Error && error.message.includes('seed') ? 'RNG_SEED_MISSING' : 
        error instanceof Error && error.message.includes('state') ? 'STATE_NOT_PERSISTED' : 
        'UNKNOWN',
        roomId,
        { error: error instanceof Error ? error.message : String(error) }
      );
      
      // Rollback if possible
      try {
        await db.update(gameRooms)
          .set({ state: 'waiting' })
          .where(eq(gameRooms.id, roomId));
      } catch (rollbackError) {
        DebugLogger.log(context, 'autostart.execute.rollback_failed', { 
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError) 
        });
      }
    }
  }
  
  static cancelPendingStart(roomId: string): void {
    if (this.pendingStarts.has(roomId)) {
      const context = createCorrelationContext(roomId);
      DebugLogger.log(context, 'autostart.cancelled', { roomId });
      
      clearTimeout(this.pendingStarts.get(roomId)!);
      this.pendingStarts.delete(roomId);
    }
  }
}