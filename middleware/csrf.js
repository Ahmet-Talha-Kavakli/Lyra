/**
 * CSRF Protection Middleware
 * Validates CSRF tokens for state-changing operations
 * SameSite cookies for additional protection
 */

import { randomBytes } from 'crypto';
import { logger } from '../lib/infrastructure/logger.js';

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Generate CSRF token for client
 */
export function generateCSRFToken() {
    return randomBytes(32).toString('hex');
}

/**
 * CSRF token validation middleware
 * Require for POST, PUT, DELETE, PATCH
 */
export function csrfMiddleware(req, res, next) {
    // Store CSRF token in session for later validation
    if (!req.session) {
        req.session = {};
    }

    // Generate token if doesn't exist
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCSRFToken();
    }

    // Provide token to client (set in header for responses)
    res.set('X-CSRF-Token', req.session.csrfToken);

    // Skip validation for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Validate CSRF token for state-changing operations
    const clientToken = req.headers['x-csrf-token'] || req.body?.csrfToken;

    if (!clientToken) {
        logger.warn('[CSRF] Missing token', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        return res.status(403).json({ error: 'CSRF token missing' });
    }

    if (clientToken !== req.session.csrfToken) {
        logger.error('[CSRF] Token mismatch — possible CSRF attack', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        return res.status(403).json({ error: 'CSRF validation failed' });
    }

    // Token valid — regenerate for next request
    req.session.csrfToken = generateCSRFToken();

    next();
}

/**
 * SameSite cookie configuration
 * Prevents CSRF by restricting cookie sending on cross-site requests
 */
export const sameSiteCookieConfig = {
    httpOnly: true,
    secure: IS_PROD,              // HTTPS only in production
    sameSite: IS_PROD ? 'strict' : 'lax',  // Strict in prod, lax in dev
    path: '/',
    maxAge: 24 * 60 * 60 * 1000   // 24 hours
};
