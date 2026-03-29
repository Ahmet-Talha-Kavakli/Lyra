// [AUDIT LOGGER — COMPLIANCE & SECURITY MONITORING]
// Tracks all authentication, authorization, and admin actions.
// Required for 100K+ users: GDPR compliance, security incident investigation.
// For production: ship to centralized logging (Datadog, ELK, Splunk)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_LOG_DIR = path.join(__dirname, '../logs');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'audit.jsonl');

// Ensure logs directory exists
if (!fs.existsSync(AUDIT_LOG_DIR)) {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
}

/**
 * Audit log event types
 */
const EVENT_TYPES = {
    // Authentication
    AUTH_SIGNUP: 'auth.signup',
    AUTH_LOGIN: 'auth.login',
    AUTH_LOGOUT: 'auth.logout',
    AUTH_TOKEN_REFRESH: 'auth.token_refresh',
    AUTH_FAILED_LOGIN: 'auth.failed_login',
    AUTH_PASSWORD_CHANGE: 'auth.password_change',
    AUTH_ACCOUNT_DELETION: 'auth.account_deletion',

    // Authorization
    RBAC_ROLE_CHANGE: 'rbac.role_change',
    RBAC_PERMISSION_CHANGE: 'rbac.permission_change',

    // Admin Actions
    ADMIN_USER_CREATE: 'admin.user_create',
    ADMIN_USER_UPDATE: 'admin.user_update',
    ADMIN_USER_DELETE: 'admin.user_delete',
    ADMIN_USER_BAN: 'admin.user_ban',
    ADMIN_CONFIG_CHANGE: 'admin.config_change',

    // Security
    SECURITY_SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
    SECURITY_API_KEY_ROTATED: 'security.api_key_rotated',
    SECURITY_RATE_LIMIT_TRIGGERED: 'security.rate_limit_triggered',
    SECURITY_MALFORMED_REQUEST: 'security.malformed_request',

    // User Actions
    USER_DATA_ACCESS: 'user.data_access',
    USER_DATA_EXPORT: 'user.data_export',
    USER_DATA_DELETE_REQUEST: 'user.data_delete_request',
};

// Export for use in routes
export { EVENT_TYPES };

/**
 * Log an audit event
 * @param {string} eventType - One of EVENT_TYPES
 * @param {object} data - Event details
 */
export function auditLog(eventType, data = {}) {
    try {
        const entry = {
            timestamp: new Date().toISOString(),
            eventType,
            userId: data.userId || 'system',
            userEmail: data.userEmail || null,
            ipAddress: data.ipAddress || null,
            userAgent: data.userAgent || null,
            action: data.action || null,
            targetUserId: data.targetUserId || null,
            status: data.status || 'success',
            details: data.details || {},
            errorMessage: data.errorMessage || null,
        };

        // Write to file (JSONL format for streaming)
        if (config.IS_PROD) {
            const line = JSON.stringify(entry) + '\n';
            fs.appendFileSync(AUDIT_LOG_FILE, line, { encoding: 'utf8' });
        }

        // Also log to main logger
        const level = data.status === 'success' ? 'info' : 'warn';
        logger[level](`[AUDIT] ${eventType}`, {
            userId: data.userId,
            status: data.status,
            details: data.details,
        });

        return entry;
    } catch (err) {
        logger.error('[auditLog] Failed to write audit log', {
            error: err.message,
            eventType,
        });
    }
}

/**
 * Middleware: Extract audit context from request
 * Attaches req.auditContext with IP, userAgent, userId
 */
export function auditContextMiddleware(req, res, next) {
    req.auditContext = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent') || 'unknown',
        userId: req.userId || null,
        userEmail: req.userEmail || null,
    };

    next();
}

/**
 * Log authentication event
 */
export function logAuthEvent(eventType, userId, email, status = 'success', details = {}, ip = null, userAgent = null) {
    auditLog(eventType, {
        userId,
        userEmail: email,
        ipAddress: ip,
        userAgent,
        status,
        details,
    });
}

/**
 * Log failed login attempt
 */
export function logFailedLogin(email, reason = 'invalid_credentials', ip = null, userAgent = null) {
    auditLog(EVENT_TYPES.AUTH_FAILED_LOGIN, {
        userEmail: email,
        ipAddress: ip,
        userAgent,
        status: 'failed',
        details: { reason },
    });
}

/**
 * Log suspicious activity (potential attack)
 */
export function logSuspiciousActivity(description, userId = null, details = {}, ip = null) {
    auditLog(EVENT_TYPES.SECURITY_SUSPICIOUS_ACTIVITY, {
        userId,
        ipAddress: ip,
        status: 'detected',
        details: { description, ...details },
    });
}

/**
 * Log rate limit triggered
 */
export function logRateLimitTriggered(userId, endpoint, ip = null) {
    auditLog(EVENT_TYPES.SECURITY_RATE_LIMIT_TRIGGERED, {
        userId,
        ipAddress: ip,
        status: 'triggered',
        details: { endpoint },
    });
}

/**
 * Log malformed request
 */
export function logMalformedRequest(reason, userId = null, ip = null, details = {}) {
    auditLog(EVENT_TYPES.SECURITY_MALFORMED_REQUEST, {
        userId,
        ipAddress: ip,
        status: 'detected',
        details: { reason, ...details },
    });
}

/**
 * Log admin action
 */
export function logAdminAction(actionType, adminUserId, targetUserId, details = {}, ip = null) {
    const eventTypeMap = {
        create: EVENT_TYPES.ADMIN_USER_CREATE,
        update: EVENT_TYPES.ADMIN_USER_UPDATE,
        delete: EVENT_TYPES.ADMIN_USER_DELETE,
        ban: EVENT_TYPES.ADMIN_USER_BAN,
    };

    auditLog(eventTypeMap[actionType] || 'admin.action', {
        userId: adminUserId,
        targetUserId,
        ipAddress: ip,
        status: 'success',
        details,
    });
}

/**
 * Get audit log stats (for /health endpoint)
 */
export function getAuditStats() {
    try {
        const stats = fs.statSync(AUDIT_LOG_FILE);
        return {
            logFile: AUDIT_LOG_FILE,
            sizeBytes: stats.size,
            sizeMB: Math.round(stats.size / 1024 / 1024),
            lastModified: stats.mtime.toISOString(),
        };
    } catch {
        return {
            logFile: AUDIT_LOG_FILE,
            sizeBytes: 0,
            status: 'not_found',
        };
    }
}

/**
 * Query audit logs (production: use Datadog, not this)
 * For small systems: read last N lines
 */
export function queryAuditLogs(filters = {}, limit = 100) {
    try {
        const content = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);

        let entries = lines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(Boolean);

        // Apply filters
        if (filters.userId) {
            entries = entries.filter(e => e.userId === filters.userId);
        }
        if (filters.eventType) {
            entries = entries.filter(e => e.eventType === filters.eventType);
        }
        if (filters.status) {
            entries = entries.filter(e => e.status === filters.status);
        }

        // Return last N entries
        return entries.slice(-limit);
    } catch (err) {
        logger.error('[queryAuditLogs] Failed to read audit logs', { error: err.message });
        return [];
    }
}

/**
 * Rotate audit logs (daily, keep 30 days)
 */
export function rotateAuditLogs() {
    try {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const rotatedFile = path.join(AUDIT_LOG_DIR, `audit.${date}.jsonl`);

        if (fs.existsSync(AUDIT_LOG_FILE)) {
            fs.renameSync(AUDIT_LOG_FILE, rotatedFile);
            logger.info('[auditLogger] Rotated audit log', { rotatedFile });
        }

        // Clean up logs older than 30 days
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const files = fs.readdirSync(AUDIT_LOG_DIR);

        for (const file of files) {
            if (file.startsWith('audit.') && file.endsWith('.jsonl')) {
                const filePath = path.join(AUDIT_LOG_DIR, file);
                const stat = fs.statSync(filePath);
                if (stat.mtime < thirtyDaysAgo) {
                    fs.unlinkSync(filePath);
                    logger.info('[auditLogger] Deleted old audit log', { file });
                }
            }
        }
    } catch (err) {
        logger.error('[rotateAuditLogs] Failed to rotate audit logs', { error: err.message });
    }
}

// Rotate logs daily at midnight
if (config.IS_PROD) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
        rotateAuditLogs();
        setInterval(() => {
            rotateAuditLogs();
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
}
