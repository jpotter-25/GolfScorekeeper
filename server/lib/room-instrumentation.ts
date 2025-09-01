import { db } from '../db';
import { gameRooms } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Global monotonic version counter for room state changes
let globalVersion = Date.now();

export function getNextVersion(): number {
  return ++globalVersion;
}

export interface RoomEvent {
  event: 'create' | 'update_settings' | 'join' | 'leave' | 'list_projection' | 'broadcast' | 'client_render' | 'heartbeat' | 'cleanup' | 'db_read' | 'db_write';
  roomId: string;
  roomCode?: string;
  version: number;
  playersCount: number;
  maxPlayers: number;
  rounds: number;
  status: 'waiting' | 'playing' | 'ended';
  source: 'server' | 'lobby-view-client' | 'list-view-client' | 'websocket' | 'api' | 'db';
  result: 'ok' | 'error';
  errorCode?: string;
  userId?: string;
  details?: any;
  timestamp: string;
  stack?: string;
}

// Ordered event log
const eventLog: RoomEvent[] = [];

export function logRoomEvent(event: Partial<RoomEvent> & { event: RoomEvent['event'] }) {
  const timestamp = new Date().toISOString();
  const fullEvent: RoomEvent = {
    version: 0,
    playersCount: 0,
    maxPlayers: 0,
    rounds: 0,
    status: 'waiting',
    source: 'server',
    result: 'ok',
    timestamp,
    ...event
  };
  
  // Get stack trace if this is an error or suspicious event
  if (fullEvent.result === 'error' || fullEvent.event === 'cleanup' || fullEvent.event === 'heartbeat') {
    fullEvent.stack = new Error().stack;
  }
  
  eventLog.push(fullEvent);
  
  // Print to console with clear formatting
  const logLine = `[ROOM-EVENT] ${timestamp} | ${fullEvent.event} | room:${fullEvent.roomCode || fullEvent.roomId} | v:${fullEvent.version} | players:${fullEvent.playersCount}/${fullEvent.maxPlayers} | rounds:${fullEvent.rounds} | status:${fullEvent.status} | source:${fullEvent.source} | result:${fullEvent.result}${fullEvent.errorCode ? ` | error:${fullEvent.errorCode}` : ''}${fullEvent.details ? ` | ${JSON.stringify(fullEvent.details)}` : ''}`;
  
  console.log(logLine);
  
  return fullEvent;
}

export function getEventLog(): RoomEvent[] {
  return eventLog;
}

export function clearEventLog(): void {
  eventLog.length = 0;
}

// Consistency check functions
export async function checkRoomConsistency(roomId: string, expectedVersion: number): Promise<boolean> {
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId));
  if (!room) {
    logRoomEvent({
      event: 'db_read',
      roomId,
      result: 'error',
      errorCode: 'ROOM_NOT_FOUND',
      details: { expectedVersion }
    });
    return false;
  }
  
  const settings = room.settings as any || {};
  const actualVersion = (room as any).version || 0;
  
  if (actualVersion < expectedVersion) {
    logRoomEvent({
      event: 'db_read',
      roomId,
      roomCode: room.code,
      version: actualVersion,
      playersCount: room.playerCount || 0,
      maxPlayers: settings.maxPlayers || room.maxPlayers || 4,
      rounds: settings.rounds || room.rounds || 9,
      status: room.status as any,
      result: 'error',
      errorCode: 'STALE_VERSION',
      details: { expectedVersion, actualVersion }
    });
    return false;
  }
  
  return true;
}

// Guard against unauthorized settings mutations
export function guardSettingsMutation(source: string, isHost: boolean, roomStatus: string): void {
  const allowedSources = ['create', 'host_update'];
  
  if (!isHost && source !== 'create') {
    const error = new Error(`INVARIANT VIOLATION: Non-host attempted settings mutation from ${source}`);
    logRoomEvent({
      event: 'update_settings',
      source: source as any,
      result: 'error',
      errorCode: 'NON_HOST_MUTATION',
      details: { stack: error.stack }
    });
    throw error;
  }
  
  if (roomStatus !== 'waiting' && source !== 'create') {
    const error = new Error(`INVARIANT VIOLATION: Settings mutation attempted after game started from ${source}`);
    logRoomEvent({
      event: 'update_settings',
      source: source as any,
      result: 'error',
      errorCode: 'GAME_STARTED_MUTATION',
      details: { roomStatus, stack: error.stack }
    });
    throw error;
  }
}

// Track all DB writes to room settings
export function trackSettingsWrite(roomId: string, roomCode: string, settings: any, source: string): void {
  const version = getNextVersion();
  logRoomEvent({
    event: 'db_write',
    roomId,
    roomCode,
    version,
    maxPlayers: settings.maxPlayers || 4,
    rounds: settings.rounds || 9,
    playersCount: 0,
    status: 'waiting',
    source: source as any,
    result: 'ok',
    details: { settings }
  });
}

// Verify broadcast completeness
export function verifyBroadcast(roomId: string, broadcastType: string, recipients: string[]): void {
  if (recipients.length === 0) {
    const error = new Error(`INVARIANT VIOLATION: Broadcast to 0 recipients for ${broadcastType}`);
    logRoomEvent({
      event: 'broadcast',
      roomId,
      result: 'error',
      errorCode: 'NO_RECIPIENTS',
      details: { broadcastType, stack: error.stack }
    });
    throw error;
  }
  
  logRoomEvent({
    event: 'broadcast',
    roomId,
    version: getNextVersion(),
    playersCount: 0,
    maxPlayers: 0,
    rounds: 0,
    status: 'waiting',
    source: 'websocket',
    result: 'ok',
    details: { broadcastType, recipientCount: recipients.length }
  });
}

// Check for stale client renders
export function checkClientRender(clientId: string, roomId: string, renderedVersion: number, latestVersion: number): void {
  if (renderedVersion < latestVersion) {
    logRoomEvent({
      event: 'client_render',
      roomId,
      version: renderedVersion,
      playersCount: 0,
      maxPlayers: 0,
      rounds: 0,
      status: 'waiting',
      source: 'lobby-view-client',
      result: 'error',
      errorCode: 'STALE_RENDER',
      details: { clientId, renderedVersion, latestVersion }
    });
  }
}

// Export test report
export function generateTestReport(): string {
  const report = ['=== ROOM INSTRUMENTATION REPORT ===\n'];
  
  // Group events by room
  const roomEvents = new Map<string, RoomEvent[]>();
  for (const event of eventLog) {
    const key = event.roomCode || event.roomId || 'unknown';
    if (!roomEvents.has(key)) {
      roomEvents.set(key, []);
    }
    roomEvents.get(key)!.push(event);
  }
  
  // Report per room
  for (const [roomKey, events] of roomEvents.entries()) {
    report.push(`\nRoom: ${roomKey}`);
    report.push('=' .repeat(40));
    
    for (const event of events) {
      report.push(
        `${event.timestamp} | ${event.event.padEnd(15)} | v:${String(event.version).padEnd(10)} | ${event.playersCount}/${event.maxPlayers} players | ${event.rounds} rounds | ${event.status.padEnd(8)} | ${event.source.padEnd(15)} | ${event.result}${event.errorCode ? ` (${event.errorCode})` : ''}`
      );
      if (event.details) {
        report.push(`  Details: ${JSON.stringify(event.details)}`);
      }
    }
  }
  
  // Check for violations
  report.push('\n\n=== VIOLATIONS DETECTED ===');
  const violations = eventLog.filter(e => e.result === 'error');
  if (violations.length === 0) {
    report.push('None');
  } else {
    for (const v of violations) {
      report.push(`${v.timestamp} | ${v.event} | ${v.errorCode} | ${JSON.stringify(v.details)}`);
    }
  }
  
  return report.join('\n');
}