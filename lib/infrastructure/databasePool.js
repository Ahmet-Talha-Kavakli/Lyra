/**
 * PostgreSQL Connection Pool for Vercel Serverless
 *
 * CRITICAL FOR 100K+ USERS:
 * Uses Supabase Pooler with TRANSACTION mode (not Session mode)
 *
 * Why Transaction Pooling?
 * - Each Lambda invocation gets a connection from pool
 * - Connection returned immediately after query (no long-lived connections)
 * - Vercel Serverless functions die after response, so persistent connections don't work
 * - Transaction pooling is perfect for serverless (connection per request)
 *
 * Configuration:
 * - Direct PostgreSQL: db.supabase.co:5432 (no pooling)
 * - Supabase Pooler: pooler.supabase.co:6543 (transaction pooling)
 *
 * Pool Settings for 100K concurrent users:
 * - max_connections: 20 (per Lambda instance)
 * - total across Vercel: 100K users / avg 2.5 users per connection = ~40K connections available
 * - Supabase free tier: 100 max_connections total
 * - Supabase pro tier: 200 max_connections total
 *
 * Connection String:
 * postgresql://postgres:[PASSWORD]@pooler.supabase.co:6543/postgres?sslmode=require
 */

import { logger } from './logging/logger.js';
import { config } from './config.js';
import pkg from 'pg';

const { Pool } = pkg;

class DatabasePool {
    constructor() {
        this.pool = null;
        this.isInitialized = false;
        this.initPromise = null; // Prevent multiple concurrent init attempts
    }

    /**
     * Initialize connection pool
     * Called lazily on first query
     */
    async initialize() {
        // Return existing pool if already initialized
        if (this.isInitialized && this.pool) {
            return this.pool;
        }

        // If already initializing, wait for that promise
        if (this.initPromise) {
            return this.initPromise;
        }

        // Start initialization
        this.initPromise = this.performInitialization();
        return this.initPromise;
    }

    /**
     * Actual initialization logic
     */
    async performInitialization() {
        try {
            // ═══════════════════════════════════════════════════════════
            // STEP 1: Get connection string
            // Must use pooler.supabase.co:6543 for transaction pooling
            // ═══════════════════════════════════════════════════════════
            const connectionString = this.getConnectionString();

            logger.info('[Database] Initializing pool', {
                host: this.extractHost(connectionString),
                poolSize: config.DB_POOL_SIZE || 20
            });

            // ═══════════════════════════════════════════════════════════
            // STEP 2: Create pool with Serverless-optimized settings
            // ═══════════════════════════════════════════════════════════
            this.pool = new Pool({
                connectionString,

                // Pool size: connections available per Lambda instance
                // For Vercel: max 20 per instance (Lambda limits memory/connections)
                max: parseInt(config.DB_POOL_SIZE || '20'),

                // Idle timeout: Release connections after 15s of inactivity
                // Serverless: Functions die after response, so don't need long timeouts
                idleTimeoutMillis: parseInt(config.DB_IDLE_TIMEOUT || '15000'),

                // Connection timeout: Don't wait >5s for connection
                connectionTimeoutMillis: 5000,

                // Query timeout: Queries shouldn't take >30s
                statementTimeoutMillis: 30000,

                // Application name for monitoring
                application_name: 'lyra-serverless',

                // SSL required for Supabase Pooler
                ssl: { rejectUnauthorized: false }
            });

            // ═══════════════════════════════════════════════════════════
            // STEP 3: Test connection
            // ═══════════════════════════════════════════════════════════
            const testClient = await this.pool.connect();
            try {
                await testClient.query('SELECT 1 as test');
                logger.info('[Database] Pool connection test successful');
            } finally {
                testClient.release();
            }

            // ═══════════════════════════════════════════════════════════
            // STEP 4: Setup error handlers
            // ═══════════════════════════════════════════════════════════
            this.pool.on('error', (error) => {
                logger.error('[Database] Unexpected pool error', {
                    error: error.message,
                    code: error.code
                });
            });

            this.isInitialized = true;
            logger.info('[Database] Connection pool initialized successfully', {
                poolSize: config.DB_POOL_SIZE || 20,
                mode: 'Transaction Pooling (Vercel Serverless)'
            });

            return this.pool;
        } catch (error) {
            logger.error('[Database] Pool initialization failed', {
                error: error.message,
                code: error.code,
                host: this.extractHost(this.getConnectionString())
            });
            this.initPromise = null; // Reset so next call will try again
            throw error;
        }
    }

    /**
     * Get connection string from config
     *
     * Priority:
     * 1. DATABASE_POOLER_URL (Supabase pooler, transaction mode)
     * 2. DATABASE_URL (fallback, from Supabase connection string)
     * 3. Build from components (fallback)
     */
    getConnectionString() {
        // Prefer Supabase Pooler (transaction mode)
        if (config.DATABASE_POOLER_URL) {
            return config.DATABASE_POOLER_URL;
        }

        // Fallback to direct connection
        if (config.DATABASE_URL) {
            return config.DATABASE_URL;
        }

        // Build from components
        const {
            DB_HOST = 'pooler.supabase.co',
            DB_PORT = '6543',
            DB_USER = 'postgres',
            DB_PASSWORD,
            DB_NAME = 'postgres'
        } = config;

        if (!DB_PASSWORD) {
            throw new Error('DATABASE_URL or DB_PASSWORD must be set');
        }

        return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require`;
    }

    /**
     * Extract host from connection string for logging
     */
    extractHost(connString) {
        try {
            const match = connString.match(/@([^:/]+)/);
            return match ? match[1] : 'unknown';
        } catch {
            return 'unknown';
        }
    }

    /**
     * Execute query
     * Gets connection from pool, executes, returns connection
     */
    async query(sql, params = []) {
        const pool = await this.initialize();

        try {
            const result = await pool.query(sql, params);
            return result;
        } catch (error) {
            logger.error('[Database] Query failed', {
                error: error.message,
                code: error.code,
                sql: sql.substring(0, 100),
                params: params.length > 0 ? `${params.length} params` : 'no params'
            });
            throw error;
        }
    }

    /**
     * Execute query and return single row
     */
    async queryOne(sql, params = []) {
        const result = await this.query(sql, params);
        return result.rows[0] || null;
    }

    /**
     * Execute query and return all rows
     */
    async queryAll(sql, params = []) {
        const result = await this.query(sql, params);
        return result.rows;
    }

    /**
     * Execute transaction
     *
     * Important for Vercel:
     * - Transaction is confined to single Lambda invocation
     * - Connection is held during transaction, then released
     * - Keep transactions SHORT (< 1 second ideally)
     */
    async transaction(callback) {
        const pool = await this.initialize();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Execute callback with client
            const result = await callback(client);

            await client.query('COMMIT');
            return result;
        } catch (error) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                logger.warn('[Database] Rollback failed', {
                    error: rollbackError.message
                });
            }

            logger.error('[Database] Transaction failed', {
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Batch query execution (for multiple queries in transaction)
     */
    async batch(queries) {
        return this.transaction(async (client) => {
            const results = [];
            for (const { sql, params } of queries) {
                const result = await client.query(sql, params);
                results.push(result);
            }
            return results;
        });
    }

    /**
     * Get pool statistics
     * Used for monitoring/debugging
     */
    getStats() {
        if (!this.pool) {
            return { isInitialized: false };
        }

        return {
            isInitialized: this.isInitialized,
            totalConnections: this.pool.totalCount,
            availableConnections: this.pool.idleCount,
            waitingRequests: this.pool.waitingCount,
            utilizationPercent: Math.round(
                ((this.pool.totalCount - this.pool.idleCount) / this.pool.totalCount) * 100
            )
        };
    }

    /**
     * Graceful shutdown
     * Call this on Lambda termination (won't happen but good practice)
     */
    async shutdown() {
        if (this.pool && this.isInitialized) {
            try {
                await this.pool.end();
                this.isInitialized = false;
                logger.info('[Database] Connection pool closed');
            } catch (error) {
                logger.error('[Database] Error closing pool', {
                    error: error.message
                });
            }
        }
    }
}

// Export singleton instance
export const databasePool = new DatabasePool();

export default databasePool;
