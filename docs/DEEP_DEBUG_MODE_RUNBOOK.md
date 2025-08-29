# Deep Debug Mode Runbook

## Overview
Deep Debug Mode provides comprehensive logging and observability for the Online Multiplayer Rooms system, helping diagnose issues with room creation, player joining, game starts, and state synchronization.

## Enabling Deep Debug Mode

### Method 1: Environment Variable (Recommended)
Set the environment variable before starting the server:
```bash
DEEP_DEBUG_MODE=true npm run dev
```

### Method 2: Automatic in Development
Deep Debug Mode is automatically enabled when `NODE_ENV=development` (default for `npm run dev`).

### Method 3: Production Environment
In production, add to your environment configuration:
```
DEEP_DEBUG_MODE=true
```

## Disabling Deep Debug Mode

### Development
```bash
DEEP_DEBUG_MODE=false npm run dev
```

### Production
Remove or set to false:
```
DEEP_DEBUG_MODE=false
```

## Log Locations in Replit

### Server Logs
- **Console Output**: Visible in the Replit Console tab
- **Structured Logs**: In development, logs are pretty-printed to console
- **Production Logs**: JSON formatted, single line per event

### Client Debug HUD
- **Location**: Top-right corner of the screen (development only)
- **Toggle**: Press `Ctrl+Shift+D` to show/hide
- **Contents**: Connection status, room state, player count, ACKed events

## Log Event Types

### Entry/Exit Logs
- `handler_entry_*` - Handler function start
- `handler_exit_*` - Handler function completion

### Transaction Logs
- `transaction_start_*` - Database transaction begin
- `transaction_commit_*` - Successful commit
- `transaction_rollback_*` - Transaction failed/rolled back

### Validation Logs
- `validation_*` - Input validation results

### Decision Logs
- `decision_listing_invariant` - Room listing decisions
- `decision_auto_start` - Auto-start evaluation
- `decision_room_purge` - Room deletion decision

### State Snapshots
- `snapshot_room_creation` - After room created
- `snapshot_auto_start` - When game auto-starts
- `snapshot_state_transition` - State changes

### Emit/Broadcast Logs
- `emit_*` - Messages sent to clients
- `broadcast_*` - Room-wide broadcasts

### ACK Tracking
- `ack_received_*` - Client acknowledgment received
- `ack_quorum_*` - Quorum status for critical events

### Invariant Assertions
- `invariant_player_count_valid` - Player count check
- `invariant_room_state_valid` - State validation

## Critical Events Requiring ACKs
1. `room:deleted` - Room deletion notification
2. `game:started` - Game initialization
3. `host:changed` - Host migration
4. `room:list:diff` - Room list updates

## Common Debug Scenarios

### Room Creation Fails
Look for:
- `room_create_handler_entry`
- `validation_room_create`
- `room_code_collision` (if code generation fails)
- `transaction_rollback_room_create`

### Game Doesn't Start When All Ready
Look for:
- `ready_set_handler_entry`
- `ready_state_evaluation`
- `decision_auto_start`
- `game_auto_started` or error logs

### Player Can't Join Room
Look for:
- `room_join_handler_entry`
- `validation_room_join`
- Error messages about room state, capacity, or password

### Host Migration Issues
Look for:
- `host_migration_starting`
- `transaction_start_host_migration`
- `host_migration_complete` or errors

## Protocol Version Checking
- Current version: `1.0.0`
- Mismatches logged as `protocol_version_mismatch`
- Clients with wrong version receive upgrade message

## Performance Considerations
- Deep Debug Mode adds ~5-10ms overhead per operation
- State snapshots are redacted (no PII/secrets)
- ACK timeouts are 5 seconds
- Heartbeat interval is 30 seconds

## Troubleshooting

### No Logs Appearing
1. Verify `DEEP_DEBUG_MODE=true` is set
2. Check console for startup message: "Instrumented WebSocket server initialized"
3. Ensure client is connecting to `/ws-rooms` path

### Client Not Showing Debug HUD
1. Verify `NODE_ENV=development`
2. Press `Ctrl+Shift+D` to toggle visibility
3. Check browser console for errors

### ACK Warnings
- Warning logs show which clients didn't acknowledge
- Quorum is 50% of connected clients
- Check client connectivity if ACKs consistently fail

## Log Filtering

### Grep for Specific Room
```bash
npm run dev 2>&1 | grep "roomCode: 'ABC123'"
```

### Filter by Log Level
```bash
npm run dev 2>&1 | grep "\[ERROR\]"
npm run dev 2>&1 | grep "\[WARN\]"
```

### Track Specific User
```bash
npm run dev 2>&1 | grep "userId: 'user_123'"
```

## Disabling Specific Logs
To reduce noise, you can disable specific log categories:
- Set `DEEP_DEBUG_MODE=false` to disable debug-level logs
- Production mode automatically reduces verbosity
- Client HUD can be hidden with `Ctrl+Shift+D`