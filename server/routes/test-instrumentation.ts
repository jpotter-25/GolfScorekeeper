import { Request, Response } from 'express';
import { db } from '../db';
import { gameRooms, gameParticipants } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { generateTestReport, clearEventLog, logRoomEvent, getNextVersion, trackSettingsWrite } from '../lib/room-instrumentation';

export function registerTestRoutes(app: any) {
  // Test endpoint to get current DB state
  app.get('/api/test/db-state', async (req: Request, res: Response) => {
    try {
      const rooms = await db.select({
        code: gameRooms.code,
        rounds: gameRooms.rounds,
        maxPlayers: gameRooms.maxPlayers,
        settings: gameRooms.settings,
        playerCount: gameRooms.playerCount,
        version: sql<number>`COALESCE(version, 0)`
      }).from(gameRooms);
      
      const participants = await db.select({
        roomCode: gameRooms.code,
        userId: gameParticipants.userId,
        isHost: gameParticipants.isHost,
        connected: gameParticipants.connected,
        leftAt: gameParticipants.leftAt
      })
      .from(gameParticipants)
      .leftJoin(gameRooms, eq(gameParticipants.gameRoomId, gameRooms.id));
      
      res.json({ rooms, participants });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Test endpoint to get instrumentation report
  app.get('/api/test/instrumentation-report', (req: Request, res: Response) => {
    const report = generateTestReport();
    res.type('text/plain').send(report);
  });
  
  // Test endpoint to clear instrumentation log
  app.post('/api/test/clear-instrumentation', (req: Request, res: Response) => {
    clearEventLog();
    res.json({ message: 'Instrumentation log cleared' });
  });
  
  // Test endpoint to simulate settings update
  app.post('/api/test/simulate-settings-update', async (req: Request, res: Response) => {
    const { roomCode, rounds, maxPlayers, source } = req.body;
    
    try {
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, roomCode));
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      const version = getNextVersion();
      const settings = {
        ...(room.settings as any || {}),
        rounds,
        maxPlayers
      };
      
      // Track the update
      logRoomEvent({
        event: 'update_settings',
        roomId: room.id,
        roomCode: room.code,
        version,
        playersCount: room.playerCount || 0,
        maxPlayers,
        rounds,
        status: room.status as any,
        source: source || 'test',
        result: 'ok',
        details: { simulatedUpdate: true }
      });
      
      trackSettingsWrite(room.id, room.code, settings, source || 'test');
      
      // Update database with raw SQL for version
      await db.execute(sql`
        UPDATE game_rooms 
        SET settings = ${settings},
            rounds = ${rounds},
            max_players = ${maxPlayers},
            version = ${version},
            updated_at = ${new Date()}
        WHERE id = ${room.id}
      `);
      
      res.json({ success: true, version });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
}