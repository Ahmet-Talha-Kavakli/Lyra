// lib/logger.js
// Sıfır bağımlılık — native Node.js structured logger
// Seviyeler: error > warn > info > debug
// Output: JSON (production) | human-readable (development)
//
// Kullanım:
//   import { logger } from '../lib/infrastructure/logger.js';
//   logger.info('Chat başladı', { userId, sessionId });
//   logger.error('OpenAI hatası', { error: err.message, userId });

const LOG_LEVEL_ORDER = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const IS_PROD = process.env.NODE_ENV === 'production';

function shouldLog(level) {
    return (LOG_LEVEL_ORDER[level] ?? 3) <= (LOG_LEVEL_ORDER[CURRENT_LEVEL] ?? 2);
}

function formatEntry(level, message, meta = {}) {
    const ts = new Date().toISOString();
    if (IS_PROD) {
        // JSON — makine tarafından parse edilebilir
        return JSON.stringify({ ts, level, message, ...meta });
    }
    // Human-readable — development
    const prefix = {
        error: '\x1b[31m[ERROR]\x1b[0m',
        warn:  '\x1b[33m[WARN ]\x1b[0m',
        info:  '\x1b[36m[INFO ]\x1b[0m',
        debug: '\x1b[90m[DEBUG]\x1b[0m',
    }[level] || '[LOG  ]';
    const metaStr = Object.keys(meta).length
        ? ' ' + JSON.stringify(meta)
        : '';
    return `${ts} ${prefix} ${message}${metaStr}`;
}

function write(level, message, meta = {}) {
    if (!shouldLog(level)) return;
    const line = formatEntry(level, message, meta);
    if (level === 'error') {
        process.stderr.write(line + '\n');
    } else {
        process.stdout.write(line + '\n');
    }
}

export const logger = {
    error: (message, meta = {}) => write('error', message, meta),
    warn:  (message, meta = {}) => write('warn',  message, meta),
    info:  (message, meta = {}) => write('info',  message, meta),
    debug: (message, meta = {}) => write('debug', message, meta),
};
