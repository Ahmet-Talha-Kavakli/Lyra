/**
 * PostgreSQL Connection Pool
 * Uses pg-pool for connection management
 * Replaces synchronous Supabase REST calls with direct pool connections
 */

import pkg from 'pg';
const { Pool } = pkg;
import { config } from '../config/config.js';
import { logger } from '../logging/logger.js';

class DatabasePool {
    constructor() {
        this.pool = null;
        this.isInitialized = false;
    }

    /**
     * Initialize connection pool
     * Connection string format: postgresql://user:password@host:port/database
     */
    async initialize() {
        if (this.isInitialized) {
            return this.pool;
        }

        try {
            // Parse Supabase connection details
            const connectionString = config.DATABASE_URL || this.buildConnectionString();

            this.pool = new Pool({
                connectionString,
                max: config.DB_POOL_SIZE || 20,
                idleTimeoutMillis: config.DB_IDLE_TIMEOUT || 30000,
                connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT || 5000,
                statement_timeout: config.DB_STATEMENT_TIMEOUT || 30000
            });

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();

            this.isInitialized = true;
            logger.info('[Database] Connection pool initialized', {
                poolSize: config.DB_POOL_SIZE || 20,
                host: config.DB_HOST
            });

            return this.pool;
        } catch (error) {
            logger.error('[Database] Pool initialization failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Build connection string from env vars
     */
    buildConnectionString() {
        const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = config;
        return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
    }

    /**
     * Execute query with connection from pool
     */
    async query(sql, params = []) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const result = await this.pool.query(sql, params);
            return result;
        } catch (error) {
            logger.error('[Database] Query failed', {
                error: error.message,
                sql: sql.substring(0, 100)
            });
            throw error;
        }
    }

    /**
     * Get single row
     */
    async queryOne(sql, params = []) {
        const result = await this.query(sql, params);
        return result.rows[0] || null;
    }

    /**
     * Get all rows
     */
    async queryAll(sql, params = []) {
        const result = await this.query(sql, params);
        return result.rows;
    }

    /**
     * Execute transaction
     */
    async transaction(callback) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('[Database] Transaction failed', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return {
            totalConnections: this.pool.totalCount,
            idleConnections: this.pool.idleCount,
            waitingRequests: this.pool.waitingCount
        };
    }

    /**
     * Gracefully shutdown pool
     */
    async shutdown() {
        if (this.pool && this.isInitialized) {
            await this.pool.end();
            this.isInitialized = false;
            logger.info('[Database] Connection pool closed');
        }
    }
}

export const databasePool = new DatabasePool();

export default DatabasePool;
