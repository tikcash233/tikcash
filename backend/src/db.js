import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// First try default .env (cwd). If DATABASE_URL still missing, fallback to backend/.env relative to this file.
dotenv.config();
if (!process.env.DATABASE_URL) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const altPath = path.join(__dirname, '../.env');
    dotenv.config({ path: altPath });
  } catch (_) { /* ignore */ }
}

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
}

const connectionString = (process.env.DATABASE_URL || '').replace(/^['"]|['"]$/g, '');

// Optimized pool configuration for production efficiency
const DEFAULT_POOL_MAX = Number(process.env.DB_POOL_MAX || (process.env.NODE_ENV === 'production' ? 20 : 10));
const DEFAULT_IDLE_MS = Number(process.env.DB_IDLE_TIMEOUT_MS || (process.env.NODE_ENV === 'production' ? 60000 : 30000));

export const pool = new Pool({
  connectionString,
  max: DEFAULT_POOL_MAX,
  // node-postgres doesn't support a `min` option; we warm connections at startup instead
  idleTimeoutMillis: DEFAULT_IDLE_MS,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
  allowExitOnIdle: true,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
});

// Circuit breaker state
let circuitBreakerState = {
  failureCount: 0,
  lastFailureTime: 0,
  state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

// Network error detection
function isNetworkError(err) {
  return err && (
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' ||
    err.code === 'EHOSTUNREACH' ||
    err.code === 'ENETUNREACH' ||
    err.message?.includes('getaddrinfo') ||
    err.message?.includes('connect')
  );
}

// Circuit breaker logic
function checkCircuitBreaker() {
  const now = Date.now();
  
  if (circuitBreakerState.state === 'OPEN') {
    if (now - circuitBreakerState.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
      circuitBreakerState.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  
  return true;
}

function recordSuccess() {
  circuitBreakerState.failureCount = 0;
  circuitBreakerState.state = 'CLOSED';
}

function recordFailure() {
  circuitBreakerState.failureCount++;
  circuitBreakerState.lastFailureTime = Date.now();
  
  if (circuitBreakerState.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreakerState.state = 'OPEN';
    console.log('🔴 Circuit breaker OPEN - database temporarily unavailable');
  }
}

export async function query(text, params) {
  const ENABLE_DB_LOGS = (process.env.ENABLE_DB_LOGS || '').toLowerCase() === 'true';
  // Check circuit breaker
  if (!checkCircuitBreaker()) {
  // Removed noisy DB log
    const error = new Error('DATABASE_CIRCUIT_OPEN');
    error.isNetworkError = true;
    throw error;
  }

  const start = Date.now();
  let retries = 2; // Allow 2 retry attempts for network issues
  
  while (retries >= 0) {
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Record success for circuit breaker
      recordSuccess();
      
      return res;
    } catch (err) {
      // Removed noisy DB logs
      
      // Check if this is a network-related error that can be retried
      if (isNetworkError(err)) {
  // Removed noisy DB log
        
        if (retries > 0) {
          // Removed noisy DB log
          retries--;
          // Wait 1 second before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // All retries exhausted
  // Removed noisy DB log
        recordFailure();
        const networkError = new Error('DATABASE_OFFLINE');
        networkError.isNetworkError = true;
        networkError.originalError = err;
        throw networkError;
      }
      
      // For other errors, don't retry but still log
  // Removed noisy DB log
      throw err;
    }
  }
}

export async function withTransaction(fn) {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
  // Removed noisy DB log
    
    if (client) {
      try {
        await client.query('ROLLBACK');
  // Removed noisy DB log
      } catch (rollbackErr) {
  // Removed noisy DB log
      }
    }
    
    // Re-throw with context
    if (isNetworkError(e)) {
  // Removed noisy DB log
      const networkError = new Error('DATABASE_OFFLINE');
      networkError.isNetworkError = true;
      networkError.originalError = e;
      throw networkError;
    }
    
    throw e;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Pool monitoring for production optimization
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

// Add pool event listeners for debugging (only errors)
if (process.env.NODE_ENV !== 'production') {
  pool.on('error', (err) => {
    console.error('[DB Pool] Pool error:', err.message);
  });
}

// Graceful pool shutdown
export async function closePool() {
  await pool.end();
}
