// lib/logger.js
// Structured logger with GDPR compliance (PII redaction)
// Seviyeler: error > warn > info > debug
// Output: JSON (production) | human-readable (development)
//
// Kullanım:
//   import { logger } from '../lib/logger.js';
//   logger.info('Chat started', { userId, sessionId }); // PII auto-redacted

import { sanitizeLogData } from './logSanitizer.js';

const LOG_LEVEL_ORDER = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const IS_PROD = process.env.NODE_ENV === 'production';

function shouldLog(level) {
    return (LOG_LEVEL_ORDER[level] ?? 3) <= (LOG_LEVEL_ORDER[CURRENT_LEVEL] ?? 2);
}

function formatEntry(level, message, meta = {}) {
    const ts = new Date().toISOString();

    // SECURITY: Redact sensitive data from logs (GDPR compliance)
    const sanitizedMeta = sanitizeLogData(meta);

    if (IS_PROD) {
        // JSON — machine-readable with PII redaction
        return JSON.stringify({
            ts,
            level,
            message: sanitizeLogData(message),
            ...sanitizedMeta
        });
    }
    // Human-readable — development
    const prefix = {
        error: '\x1b[31m[ERROR]\x1b[0m',
        warn:  '\x1b[33m[WARN ]\x1b[0m',
        info:  '\x1b[36m[INFO ]\x1b[0m',
        debug: '\x1b[90m[DEBUG]\x1b[0m',
    }[level] || '[LOG  ]';
    const metaStr = Object.keys(sanitizedMeta).length
        ? ' ' + JSON.stringify(sanitizedMeta)
        : '';
    return `${ts} ${prefix} ${sanitizeLogData(message)}${metaStr}`;
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
