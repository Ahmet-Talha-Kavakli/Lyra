/**
 * Configuration
 * Centralized environment and configuration management
 */

import dotenv from 'dotenv';

dotenv.config();

const config = {
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_PROD: process.env.NODE_ENV === 'production',

    // Server
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || 'localhost',

    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

    // Database (PostgreSQL)
    DATABASE_URL: process.env.DATABASE_URL,
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || 5432,
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'password',
    DB_NAME: process.env.DB_NAME || 'lyra',

    // Connection Pool Settings
    DB_POOL_SIZE: parseInt(process.env.DB_POOL_SIZE || '20'),
    DB_IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 30 seconds
    DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'), // 5 seconds
    DB_STATEMENT_TIMEOUT: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'), // 30 seconds

    // Redis
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    // Supabase (fallback for existing auth)
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_EXPIRY: process.env.JWT_EXPIRY || '7d',

    // Frontend URLs
    FRONTEND_URL: process.env.FRONTEND_URL,
    FRONTEND_URL_PREVIEW: process.env.FRONTEND_URL_PREVIEW,

    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // Feature Flags
    ENABLE_TELEMETRY: process.env.ENABLE_TELEMETRY === 'true',
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS === 'true'
};

// Validate critical settings
const requiredInProduction = [
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'JWT_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'REDIS_HOST',
    'REDIS_PORT'
];

const requiredInAll = ['JWT_SECRET', 'OPENAI_API_KEY'];

// Always validate core keys
for (const key of requiredInAll) {
    if (!config[key]) {
        const msg = `CRITICAL: Missing ${key} — application cannot run`;
        console.error(msg);
        throw new Error(msg);
    }
}

// Production strict validation
if (config.IS_PROD) {
    const missing = [];
    for (const key of requiredInProduction) {
        if (!config[key]) {
            missing.push(key);
        }
    }
    if (missing.length > 0) {
        const msg = `PRODUCTION DEPLOYMENT BLOCKED: Missing required env vars: ${missing.join(', ')}`;
        console.error(msg);
        throw new Error(msg);
    }

    // Warn about weak secrets
    if (config.JWT_SECRET === 'your-secret-key') {
        throw new Error('CRITICAL: Default JWT_SECRET detected in production. Set JWT_SECRET env var.');
    }
}

export default config;
