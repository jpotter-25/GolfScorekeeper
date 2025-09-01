#!/usr/bin/env tsx
/**
 * Comprehensive Room System Test
 * This test will reproduce the exact bug scenario and prove the fixes work
 */

import WebSocket from 'ws';
import { clearEventLog, generateTestReport } from './room-instrumentation';

const HOST_USER = 'host-test-user';
const GUEST_USER = 'guest-test-user';
const SERVER_URL = 'ws://localhost:5000/ws-rooms';

interface TestClient {
  ws: WebSocket;
  userId: string;
  roomCode?: string;
  messages: any[];
  connected: boolean;
}

function createClient(userId: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const client: TestClient = {
      ws: new WebSocket(SERVER_URL),
      userId,
      messages: [],
      connected: false
    };
    
    client.ws.on('open', () => {
      console.log(`[TEST] Client ${userId} connected`);
      client.connected = true;
      
      // Authenticate
      client.ws.send(JSON.stringify({
        type: 'auth',
        token: userId // Mock token
      }));
      
      setTimeout(() => resolve(client), 100);
    });
    
    client.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      client.messages.push(msg);
      console.log(`[TEST] ${userId} received:`, msg.type, msg);
      
      if (msg.type === 'room:created') {
        client.roomCode = msg.room.code;
      }
    });
    
    client.ws.on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureDBState(label: string): Promise<void> {
  const response = await fetch('http://localhost:5000/api/test/db-state');
  const state = await response.json();
  console.log(`\n=== DB STATE: ${label} ===`);
  console.log(JSON.stringify(state, null, 2));
}

async function runTest() {
  console.log('\n=== STARTING COMPREHENSIVE ROOM TEST ===\n');
  
  // Clear previous event log
  clearEventLog();
  
  try {
    // Step 1: Create host client and room
    console.log('\n--- STEP 1: Creating room ---');
    const host = await createClient(HOST_USER);
    
    host.ws.send(JSON.stringify({
      type: 'room:create',
      settings: {
        name: 'Test Room',
        maxPlayers: 4,
        rounds: 9,
        betCoins: 0
      }
    }));
    
    await sleep(500);
    await captureDBState('After room creation');
    
    const roomCode = host.roomCode;
    if (!roomCode) {
      throw new Error('Room not created');
    }
    console.log(`Room created with code: ${roomCode}`);
    
    // Step 2: Update settings
    console.log('\n--- STEP 2: Updating settings (rounds: 9→5, maxPlayers: 4→2) ---');
    host.ws.send(JSON.stringify({
      type: 'room:settings:update',
      code: roomCode,
      settings: {
        rounds: 5,
        maxPlayers: 2
      }
    }));
    
    await sleep(500);
    await captureDBState('After settings update');
    
    // Step 3: Create second client on lobby list
    console.log('\n--- STEP 3: Second client subscribes to lobby list ---');
    const guest = await createClient(GUEST_USER);
    
    guest.ws.send(JSON.stringify({
      type: 'room:list:subscribe'
    }));
    
    await sleep(500);
    
    // Check what the lobby list shows
    const listMessages = guest.messages.filter(m => m.type === 'room:list:snapshot' || m.type === 'room:list:diff');
    console.log('Guest sees in lobby list:', listMessages);
    
    // Step 4: Attempt to join
    console.log('\n--- STEP 4: Guest attempts to join ---');
    guest.ws.send(JSON.stringify({
      type: 'room:join',
      code: roomCode
    }));
    
    await sleep(500);
    await captureDBState('After guest join attempt');
    
    // Check join results
    const hostJoinMessages = host.messages.filter(m => m.type === 'room:player:joined');
    const guestJoinMessages = guest.messages.filter(m => m.type === 'room:joined' || m.type === 'error');
    
    console.log('Host sees:', hostJoinMessages);
    console.log('Guest sees:', guestJoinMessages);
    
    // Step 5: Guest leaves
    console.log('\n--- STEP 5: Guest leaves room ---');
    guest.ws.send(JSON.stringify({
      type: 'room:leave',
      code: roomCode
    }));
    
    await sleep(500);
    await captureDBState('After guest leave');
    
    // Step 6: Wait 5 minutes to check for reversion
    console.log('\n--- STEP 6: Waiting 5 minutes to check for settings reversion ---');
    console.log('Checking every 30 seconds...');
    
    for (let i = 0; i < 10; i++) {
      await sleep(30000); // 30 seconds
      await captureDBState(`After ${(i + 1) * 30} seconds`);
      
      // Check if settings reverted
      const response = await fetch(`http://localhost:5000/api/game-rooms/${roomCode}`);
      const room = await response.json();
      
      if (room.settings.rounds !== 5 || room.settings.maxPlayers !== 2) {
        console.error('SETTINGS REVERTED!', room.settings);
        break;
      }
    }
    
    // Generate final report
    console.log('\n' + generateTestReport());
    
    // Cleanup
    host.ws.close();
    guest.ws.close();
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
runTest().catch(console.error);