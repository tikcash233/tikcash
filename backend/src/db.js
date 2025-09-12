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
export const pool = new Pool({
  connectionString,
  max: process.env.NODE_ENV === 'production' ? 5 : 10, // Fewer connections in production
  min: 1, // Keep at least 1 connection warm
  idleTimeoutMillis: process.env.NODE_ENV === 'production' ? 60000 : 30000, // Longer idle timeout in production
  connectionTimeoutMillis: 10000,
  acquireTimeoutMillis: 8000, // Timeout for acquiring connection from pool
  allowExitOnIdle: true, // Allow process to exit when all connections are idle
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
  // Check circuit breaker
  if (!checkCircuitBreaker()) {
    const error = new Error('DATABASE_CIRCUIT_OPEN');
    error.isNetworkError = true;
    throw error;
  }

  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Record success for circuit breaker
    recordSuccess();
    
    if (process.env.NODE_ENV !== 'production') {
      // basic log in dev
      // console.log('executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    // Check if this is a network-related error
    if (isNetworkError(err)) {
      recordFailure();
      const networkError = new Error('DATABASE_OFFLINE');
      networkError.isNetworkError = true;
      networkError.originalError = err;
      throw networkError;
    }
    
    // For other errors, don't trigger circuit breaker
    throw err;
  }
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
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

// Graceful pool shutdown
export async function closePool() {
  await pool.end();
}
