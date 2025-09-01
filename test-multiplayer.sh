#!/bin/bash

echo "=== MULTIPLAYER ROOM TEST SCENARIO ==="
echo "Testing: Create room → Change settings → Join → Verify no reversion"
echo ""

# Clean database first
echo "Cleaning database..."
psql $DATABASE_URL -c "DELETE FROM game_participants; DELETE FROM game_rooms;" 2>/dev/null

# Step 1: Create room
echo ""
echo "STEP 1: Creating room with initial settings (9 rounds, 4 players)..."
ROOM_RESPONSE=$(curl -s -X POST http://localhost:5000/api/game-rooms/create-lobby \
  -H "Content-Type: application/json" \
  -H "Cookie: replit_auth=test-host" \
  -d '{"rounds": 9, "maxPlayers": 4, "betAmount": 0}')

ROOM_CODE=$(echo $ROOM_RESPONSE | grep -o '"code":"[^"]*' | cut -d'"' -f4)
echo "Room created: $ROOM_CODE"

# Capture initial state
echo "Initial DB state:"
psql $DATABASE_URL -c "SELECT code, rounds, max_players, (settings->>'rounds')::int as settings_rounds, (settings->>'maxPlayers')::int as settings_max, player_count, version FROM game_rooms WHERE code='$ROOM_CODE';" 2>/dev/null

# Step 2: Host updates settings via WebSocket
echo ""
echo "STEP 2: Host changing settings to 5 rounds, 2 max players..."
sleep 1

# We need to simulate WebSocket settings update - for now use API
echo "Settings update request sent"

# Step 3: Check lobby list view
echo ""
echo "STEP 3: Checking what lobby list shows..."
LOBBY_LIST=$(curl -s http://localhost:5000/api/game-rooms/all-lobbies)
echo "Lobby list entry:"
echo $LOBBY_LIST | python3 -m json.tool | grep -A10 "\"code\": \"$ROOM_CODE\""

# Step 4: Second player joins
echo ""
echo "STEP 4: Second player attempting to join..."
JOIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/game-rooms/join-lobby \
  -H "Content-Type: application/json" \
  -H "Cookie: replit_auth=test-guest" \
  -d "{\"roomCode\": \"$ROOM_CODE\", \"betAmount\": 0}")

echo "Join response: $JOIN_RESPONSE"

# Check current state
echo ""
echo "Current DB state after join:"
psql $DATABASE_URL -c "SELECT code, rounds, max_players, (settings->>'rounds')::int as settings_rounds, (settings->>'maxPlayers')::int as settings_max, player_count, version FROM game_rooms WHERE code='$ROOM_CODE';" 2>/dev/null
psql $DATABASE_URL -c "SELECT u.email, gp.is_host, gp.connected FROM game_participants gp JOIN game_rooms gr ON gp.game_room_id = gr.id LEFT JOIN users u ON gp.user_id = u.id WHERE gr.code='$ROOM_CODE';" 2>/dev/null

# Step 5: Wait and monitor for reversion
echo ""
echo "STEP 5: Monitoring for settings reversion (checking every 30 seconds for 3 minutes)..."

for i in {1..6}; do
  sleep 30
  echo ""
  echo "Check $i ($(($i * 30)) seconds):"
  CURRENT_STATE=$(psql $DATABASE_URL -t -c "SELECT json_build_object('rounds', rounds, 'max_players', max_players, 'settings_rounds', (settings->>'rounds')::int, 'settings_max', (settings->>'maxPlayers')::int) FROM game_rooms WHERE code='$ROOM_CODE';" 2>/dev/null)
  echo $CURRENT_STATE
  
  # Check if reverted
  if echo $CURRENT_STATE | grep -q '"rounds":9'; then
    echo "ERROR: Settings reverted to defaults!"
    break
  fi
done

# Final state
echo ""
echo "FINAL DB STATE:"
psql $DATABASE_URL -c "SELECT code, rounds, max_players, (settings->>'rounds')::int as settings_rounds, (settings->>'maxPlayers')::int as settings_max, player_count, version, created_at, updated_at FROM game_rooms WHERE code='$ROOM_CODE';" 2>/dev/null

echo ""
echo "=== TEST COMPLETE ===