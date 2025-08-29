// Deep Debug Mode Logger for Online Multiplayer Rooms
import { v4 as uuidv4 } from 'uuid';

// Protocol version for client-server compatibility
export const PROTOCOL_VERSION = '1.0.0';

// Deep Debug Mode configuration
export const isDeepDebugMode = () => {
  return process.env.DEEP_DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development';
};

// Request tracking
const requestContexts = new Map<string, any>();

export interface LogContext {
  requestId?: string;
  roomOperationId?: string;
  roomId?: string;
  roomCode?: string;
  userId?: string;
  connectionId?: string;
  operation?: string;
  serverTs: number;
  protocolVersion: string;
}

export interface StateSnapshot {
  roomId: string;
  code: string;
  state: string;
  playerCount: number;
  maxPlayers: number;
  visibility: string;
  hostId: string | null;
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
  currentTurnId?: string;
}

export class DebugLogger {
  private static instance: DebugLogger;
  private operationCounter = 0;
  
  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }
  
  generateRequestId(): string {
    return `req_${Date.now()}_${uuidv4().slice(0, 8)}`;
  }
  
  generateOperationId(): string {
    this.operationCounter++;
    return `op_${Date.now()}_${this.operationCounter}`;
  }
  
  createContext(params: Partial<LogContext> = {}): LogContext {
    return {
      requestId: params.requestId || this.generateRequestId(),
      roomOperationId: params.roomOperationId || this.generateOperationId(),
      serverTs: Date.now(),
      protocolVersion: PROTOCOL_VERSION,
      ...params
    };
  }
  
  log(level: 'debug' | 'info' | 'warn' | 'error', event: string, data: any, context?: LogContext) {
    if (!isDeepDebugMode() && level === 'debug') return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      data,
      context: context || this.createContext(),
      stack: level === 'error' ? new Error().stack : undefined
    };
    
    // Structured logging for production
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      // Pretty logging for development
      const color = level === 'error' ? '\x1b[31m' : 
                    level === 'warn' ? '\x1b[33m' : 
                    level === 'info' ? '\x1b[36m' : '\x1b[90m';
      const reset = '\x1b[0m';
      
      console.log(`${color}[${logEntry.timestamp}] [${level.toUpperCase()}] ${event}${reset}`);
      if (Object.keys(data).length > 0) {
        console.log('  Data:', JSON.stringify(data, null, 2));
      }
      if (context) {
        console.log('  Context:', JSON.stringify(context, null, 2));
      }
    }
  }
  
  // Convenience methods
  debug(event: string, data: any = {}, context?: LogContext) {
    this.log('debug', event, data, context);
  }
  
  info(event: string, data: any = {}, context?: LogContext) {
    this.log('info', event, data, context);
  }
  
  warn(event: string, data: any = {}, context?: LogContext) {
    this.log('warn', event, data, context);
  }
  
  error(event: string, error: any, data: any = {}, context?: LogContext) {
    this.log('error', event, { 
      ...data, 
      error: error.message || error,
      stack: error.stack 
    }, context);
  }
  
  // Transaction logging
  transactionStart(operation: string, context: LogContext) {
    this.debug(`transaction_start_${operation}`, {}, context);
  }
  
  transactionCommit(operation: string, context: LogContext) {
    this.debug(`transaction_commit_${operation}`, {}, context);
  }
  
  transactionRollback(operation: string, error: any, context: LogContext) {
    this.warn(`transaction_rollback_${operation}`, { error: error.message }, context);
  }
  
  // Validation logging
  validation(operation: string, inputs: any, valid: boolean, errors?: any, context?: LogContext) {
    const event = `validation_${operation}`;
    if (valid) {
      this.debug(event, { inputs, valid }, context);
    } else {
      this.warn(event, { inputs, valid, errors }, context);
    }
  }
  
  // Emit logging
  emit(event: string, recipients: string[], data: any, context?: LogContext) {
    this.debug(`emit_${event}`, {
      recipientCount: recipients.length,
      recipients: isDeepDebugMode() ? recipients : undefined,
      dataPreview: JSON.stringify(data).slice(0, 200)
    }, context);
  }
  
  // Invariant assertion
  assertInvariant(name: string, condition: boolean, details: any, context?: LogContext) {
    const event = `invariant_${name}`;
    if (condition) {
      this.debug(event, { passed: true, details }, context);
    } else {
      this.error(event, new Error(`Invariant failed: ${name}`), { passed: false, details }, context);
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`Invariant assertion failed: ${name} - ${JSON.stringify(details)}`);
      }
    }
  }
  
  // State snapshot
  snapshot(moment: string, snapshot: StateSnapshot, context?: LogContext) {
    this.info(`snapshot_${moment}`, { snapshot }, context);
  }
  
  // ACK tracking
  ackReceived(event: string, clientId: string, context?: LogContext) {
    this.debug(`ack_received_${event}`, { clientId }, context);
  }
  
  ackQuorum(event: string, expected: number, received: number, clients: string[], context?: LogContext) {
    const quorumMet = received >= Math.ceil(expected * 0.5); // 50% quorum
    const logLevel = quorumMet ? 'info' : 'warn';
    this.log(logLevel, `ack_quorum_${event}`, {
      expected,
      received,
      quorumMet,
      percentage: (received / expected * 100).toFixed(1),
      missingClients: clients
    }, context);
  }
  
  // Decision logging
  decision(type: string, decision: string, reason: string, data: any = {}, context?: LogContext) {
    this.info(`decision_${type}`, {
      decision,
      reason,
      ...data
    }, context);
  }
}

export const logger = DebugLogger.getInstance();