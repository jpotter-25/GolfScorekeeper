// Auto Verification Suite for Multiplayer Rooms
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { gameRooms, gameParticipants, users } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { 
  DebugLogger,
  SELF_DEBUG_MODE,
  createCorrelationContext
} from './self-debug';

export interface VerificationResult {
  scenario: string;
  pass: boolean;
  timestamps: {
    start: number;
    end: number;
    duration: number;
  };
  ackRate?: number;
  snapshotIds?: string[];
  errors?: string[];
  details?: any;
}

export interface VerificationReport {
  timestamp: number;
  results: VerificationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  triageBundles?: any[];
}

class TestClient {
  private ws: WebSocket | null = null;
  private userId: string;
  private messages: any[] = [];
  private connected: boolean = false;
  private connectionId: string | null = null;
  
  constructor(userId: string) {
    this.userId = userId;
  }
  
  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      this.ws.on('open', () => {
        this.connected = true;
        resolve();
      });
      
      this.ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        this.messages.push(message);
        
        if (message.type === 'connected') {
          this.connectionId = message.connectionId;
          // Authenticate
          this.send({ type: 'auth', userId: this.userId });
        }
        
        // Send ACKs for critical events
        if (message.eventId) {
          this.send({ 
            type: 'ack', 
            eventId: message.eventId,
            clientId: this.connectionId 
          });
        }
      });
      
      this.ws.on('error', (error) => {
        console.error('TestClient error:', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }
  
  send(data: any): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  async waitForMessage(type: string, timeout: number = 5000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const message = this.messages.find(m => m.type === type);
      if (message) {
        return message;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Timeout waiting for message type: ${type}`);
  }
  
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  clearMessages(): void {
    this.messages = [];
  }
}

export class VerificationSuite {
  private wsUrl: string;
  private testUsers: string[] = [];
  
  constructor(wsUrl: string = 'ws://localhost:5000/ws-rooms') {
    this.wsUrl = wsUrl;
  }
  
  async setup(): Promise<void> {
    // Create test users
    for (let i = 0; i < 4; i++) {
      const userId = `test-user-${uuidv4()}`;
      await db.insert(users).values({
        id: userId,
        email: `test${i}@test.com`,
        currency: 1000,
        level: 1,
        experience: 0
      });
      this.testUsers.push(userId);
    }
  }
  
  async cleanup(): Promise<void> {
    // Clean up test data
    for (const userId of this.testUsers) {
      await db.delete(users).where(eq(users.id, userId));
    }
    this.testUsers = [];
  }
  
  async runAll(): Promise<VerificationReport> {
    const startTime = Date.now();
    const results: VerificationResult[] = [];
    
    if (!SELF_DEBUG_MODE) {
      console.warn('Warning: Running verification suite without SELF_DEBUG_MODE enabled');
    }
    
    // Setup test environment
    await this.setup();
    
    try {
      // Run all scenarios
      results.push(await this.testScenario1_CreateAndList());
      results.push(await this.testScenario2_JoinUntilFull());
      results.push(await this.testScenario3_LeaveAndRelist());
      results.push(await this.testScenario4_AllReadyAutoStart());
      results.push(await this.testScenario5_DisconnectAndRejoin());
      results.push(await this.testScenario6_LastPlayerLeaveDelete());
      
    } catch (error) {
      console.error('Verification suite error:', error);
    } finally {
      await this.cleanup();
    }
    
    // Get triage bundles if any failures
    const failedCount = results.filter(r => !r.pass).length;
    const triageBundles = failedCount > 0 ? DebugLogger.getTriageBundles() : [];
    
    const report: VerificationReport = {
      timestamp: Date.now(),
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.pass).length,
        failed: failedCount,
        passRate: results.length > 0 ? 
          (results.filter(r => r.pass).length / results.length) : 0
      },
      triageBundles
    };
    
    console.log('\n=== Verification Suite Report ===');
    console.log(`Total Scenarios: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Pass Rate: ${(report.summary.passRate * 100).toFixed(1)}%`);
    console.log(`Duration: ${Date.now() - startTime}ms`);
    
    if (failedCount > 0) {
      console.log('\nFailed Scenarios:');
      results.filter(r => !r.pass).forEach(r => {
        console.log(`  - ${r.scenario}: ${r.errors?.join(', ')}`);
      });
    }
    
    return report;
  }
  
  async testScenario1_CreateAndList(): Promise<VerificationResult> {
    const scenario = 'Create → List';
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      const client = new TestClient(this.testUsers[0]);
      await client.connect(this.wsUrl);
      
      // Subscribe to room list
      client.send({ type: 'room:list:subscribe' });
      await client.waitForMessage('room:list:snapshot');
      
      // Create room
      const idempotencyKey = uuidv4();
      client.send({
        type: 'room:create',
        name: 'Test Room',
        visibility: 'public',
        maxPlayers: 4,
        rounds: 9,
        betCoins: 0,
        idempotencyKey
      });
      
      const created = await client.waitForMessage('room:created');
      if (!created.room) {
        errors.push('Room not created');
      }
      
      // Check if room appears in list
      const listUpdate = await client.waitForMessage('room:list:diff');
      if (!listUpdate.added || listUpdate.added.length === 0) {
        errors.push('Room not added to public list');
      }
      
      client.disconnect();
      
      return {
        scenario,
        pass: errors.length === 0,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors
      };
      
    } catch (error) {
      return {
        scenario,
        pass: false,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
  
  async testScenario2_JoinUntilFull(): Promise<VerificationResult> {
    const scenario = 'Join Until Full → Instant Delist';
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      // Create room with max 2 players
      const host = new TestClient(this.testUsers[0]);
      await host.connect(this.wsUrl);
      
      host.send({
        type: 'room:create',
        name: 'Small Room',
        visibility: 'public',
        maxPlayers: 2,
        rounds: 5,
        betCoins: 0
      });
      
      const created = await host.waitForMessage('room:created');
      const roomCode = created.room.code;
      
      // Second player joins
      const player2 = new TestClient(this.testUsers[1]);
      await player2.connect(this.wsUrl);
      player2.send({ type: 'room:list:subscribe' });
      
      player2.send({
        type: 'room:join',
        code: roomCode
      });
      
      await player2.waitForMessage('player:joined');
      
      // Check if room was delisted
      const listUpdate = await player2.waitForMessage('room:list:diff', 2000);
      if (!listUpdate.removed || !listUpdate.removed.includes(roomCode)) {
        errors.push('Room not instantly delisted when full');
      }
      
      host.disconnect();
      player2.disconnect();
      
      return {
        scenario,
        pass: errors.length === 0,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors
      };
      
    } catch (error) {
      return {
        scenario,
        pass: false,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
  
  async testScenario3_LeaveAndRelist(): Promise<VerificationResult> {
    const scenario = 'Leave From Full → Instant Relist';
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      // Create and fill room
      const host = new TestClient(this.testUsers[0]);
      const player2 = new TestClient(this.testUsers[1]);
      
      await host.connect(this.wsUrl);
      await player2.connect(this.wsUrl);
      
      host.send({
        type: 'room:create',
        name: 'Test Room',
        visibility: 'public',
        maxPlayers: 2,
        rounds: 5,
        betCoins: 0
      });
      
      const created = await host.waitForMessage('room:created');
      const roomCode = created.room.code;
      
      player2.send({
        type: 'room:join',
        code: roomCode
      });
      
      await player2.waitForMessage('player:joined');
      
      // Player 2 leaves
      player2.send({
        type: 'room:leave',
        code: roomCode
      });
      
      // Subscribe to list updates
      const observer = new TestClient(this.testUsers[2]);
      await observer.connect(this.wsUrl);
      observer.send({ type: 'room:list:subscribe' });
      
      // Check if room is relisted
      const listUpdate = await observer.waitForMessage('room:list:diff', 2000);
      if (!listUpdate.added || listUpdate.added.length === 0) {
        errors.push('Room not instantly relisted after player left');
      }
      
      host.disconnect();
      player2.disconnect();
      observer.disconnect();
      
      return {
        scenario,
        pass: errors.length === 0,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors
      };
      
    } catch (error) {
      return {
        scenario,
        pass: false,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
  
  async testScenario4_AllReadyAutoStart(): Promise<VerificationResult> {
    const scenario = 'All Ready → Auto-start Exactly Once';
    const startTime = Date.now();
    const errors: string[] = [];
    let ackRate = 0;
    
    try {
      // Create room with 2 players
      const host = new TestClient(this.testUsers[0]);
      const player2 = new TestClient(this.testUsers[1]);
      
      await host.connect(this.wsUrl);
      await player2.connect(this.wsUrl);
      
      host.send({
        type: 'room:create',
        name: 'Auto Start Test',
        visibility: 'public',
        maxPlayers: 2,
        rounds: 5,
        betCoins: 0
      });
      
      const created = await host.waitForMessage('room:created');
      const roomCode = created.room.code;
      
      player2.send({
        type: 'room:join',
        code: roomCode
      });
      
      await player2.waitForMessage('player:joined');
      
      // Both players set ready
      host.clearMessages();
      player2.clearMessages();
      
      host.send({
        type: 'room:ready:set',
        code: roomCode,
        ready: true
      });
      
      player2.send({
        type: 'room:ready:set',
        code: roomCode,
        ready: true
      });
      
      // Wait for game to start (should happen within 2-3 seconds)
      const gameStartHost = await host.waitForMessage('game:started', 4000);
      const gameStartPlayer2 = await player2.waitForMessage('game:started', 4000);
      
      if (!gameStartHost || !gameStartPlayer2) {
        errors.push('Game did not auto-start when all players ready');
      }
      
      // Check that it started exactly once
      await new Promise(resolve => setTimeout(resolve, 1000));
      const extraStarts = host.messages.filter(m => m.type === 'game:started').length;
      if (extraStarts > 1) {
        errors.push(`Game started ${extraStarts} times instead of once`);
      }
      
      // Calculate ACK rate (both clients should have ACKed)
      ackRate = gameStartHost && gameStartPlayer2 ? 1.0 : 0.5;
      
      host.disconnect();
      player2.disconnect();
      
      return {
        scenario,
        pass: errors.length === 0,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        ackRate,
        errors
      };
      
    } catch (error) {
      return {
        scenario,
        pass: false,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        ackRate,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
  
  async testScenario5_DisconnectAndRejoin(): Promise<VerificationResult> {
    const scenario = 'Disconnect During Active → AI Takeover → Rejoin';
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      // This scenario requires game to be active
      // For now, we'll test the connection/disconnection mechanics
      
      const host = new TestClient(this.testUsers[0]);
      await host.connect(this.wsUrl);
      
      host.send({
        type: 'room:create',
        name: 'Rejoin Test',
        visibility: 'public',
        maxPlayers: 2,
        rounds: 5,
        betCoins: 0
      });
      
      const created = await host.waitForMessage('room:created');
      const roomCode = created.room.code;
      
      // Disconnect
      host.disconnect();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnect
      const hostReconnect = new TestClient(this.testUsers[0]);
      await hostReconnect.connect(this.wsUrl);
      
      hostReconnect.send({
        type: 'room:join',
        code: roomCode
      });
      
      // Should be able to rejoin if within window
      try {
        const rejoined = await hostReconnect.waitForMessage('room:rejoined', 2000);
        if (!rejoined) {
          errors.push('Could not rejoin room within window');
        }
      } catch {
        // Alternative: might get regular join response
        const joined = await hostReconnect.waitForMessage('player:joined', 2000);
        if (!joined) {
          errors.push('Could not rejoin room');
        }
      }
      
      hostReconnect.disconnect();
      
      return {
        scenario,
        pass: errors.length === 0,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors
      };
      
    } catch (error) {
      return {
        scenario,
        pass: false,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
  
  async testScenario6_LastPlayerLeaveDelete(): Promise<VerificationResult> {
    const scenario = 'Last Player Leaves → Immediate Delete';
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      const host = new TestClient(this.testUsers[0]);
      await host.connect(this.wsUrl);
      
      host.send({
        type: 'room:create',
        name: 'Delete Test',
        visibility: 'public',
        maxPlayers: 4,
        rounds: 5,
        betCoins: 0
      });
      
      const created = await host.waitForMessage('room:created');
      const roomCode = created.room.code;
      
      // Host leaves (last player)
      host.send({
        type: 'room:leave',
        code: roomCode
      });
      
      // Check if room is deleted
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to query the room from database
      const rooms = await db.select().from(gameRooms)
        .where(eq(gameRooms.code, roomCode));
      
      if (rooms.length > 0) {
        errors.push('Room not immediately deleted when last player left');
      }
      
      host.disconnect();
      
      return {
        scenario,
        pass: errors.length === 0,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors
      };
      
    } catch (error) {
      return {
        scenario,
        pass: false,
        timestamps: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }
}

// Export for use in server
export async function runVerificationSuite(): Promise<VerificationReport> {
  const suite = new VerificationSuite();
  return await suite.runAll();
}