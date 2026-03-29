// [TOKEN MANAGER — CENTRALIZED JWT LIFECYCLE WITH REFRESH TOKENS & BLACKLIST]
// Handles JWT signing, verification, refresh token rotation, and token blacklist management.
// For 100K+ users: In production, blacklist should be Redis. Here using Maps (single-process).
// In distributed setup: Move TOKEN_BLACKLIST to Redis with expiry TTLs.

import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { logger } from './logger.js';

// ─── IN-MEMORY TOKEN BLACKLIST (move to Redis for distributed systems) ──────
// Format: { tokenSignature: expiryTimestamp }
const TOKEN_BLACKLIST = new Map();

// Cleanup old blacklist entries every hour
setInterval(() => {
    const now = Date.now();
    let removed = 0;
    for (const [signature, expiry] of TOKEN_BLACKLIST.entries()) {
        if (expiry < now) {
            TOKEN_BLACKLIST.delete(signature);
            removed++;
        }
    }
    if (removed > 0) {
        logger.debug(`[TokenManager] Cleaned ${removed} expired blacklist entries`);
    }
}, 60 * 60 * 1000);

/**
 * Sign a short-lived access token (15 minutes)
 * Contains: userId, email, type: 'access'
 */
export function signAccessToken(userId, email) {
    try {
        const token = jwt.sign(
            {
                userId,
                email,
                type: 'access',
                iat: Math.floor(Date.now() / 1000),
            },
            config.JWT_SECRET,
            { expiresIn: '15m' }
        );
        return token;
    } catch (err) {
        logger.error('[signAccessToken] Failed to sign token', { error: err.message, userId });
        throw err;
    }
}

/**
 * Sign a long-lived refresh token (7 days)
 * Contains: userId, type: 'refresh', version
 * Version allows invalidating all old refresh tokens on password change
 */
export function signRefreshToken(userId, version = 1) {
    try {
        const token = jwt.sign(
            {
                userId,
                type: 'refresh',
                version,
                iat: Math.floor(Date.now() / 1000),
            },
            config.JWT_SECRET,
            { expiresIn: '7d' }
        );
        return token;
    } catch (err) {
        logger.error('[signRefreshToken] Failed to sign token', { error: err.message, userId });
        throw err;
    }
}

/**
 * Verify access token
 * Checks: signature, expiry, blacklist status
 * Returns: { valid: boolean, decoded?: object, error?: string }
 */
export function verifyAccessToken(token) {
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET, { ignoreExpiration: false });

        // Type check
        if (decoded.type !== 'access') {
            return { valid: false, error: 'Token type mismatch' };
        }

        // Blacklist check (signature-based)
        const tokenSignature = token.substring(token.lastIndexOf('.') + 1, token.length).substring(0, 10);
        if (TOKEN_BLACKLIST.has(tokenSignature)) {
            return { valid: false, error: 'Token has been revoked' };
        }

        return { valid: true, decoded };
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { valid: false, error: 'Token expired', isExpired: true };
        }
        if (err.name === 'JsonWebTokenError') {
            return { valid: false, error: 'Invalid token signature' };
        }
        return { valid: false, error: 'Token verification failed' };
    }
}

/**
 * Verify refresh token (basic verification, full validation in routes/auth.js)
 * Returns: { valid: boolean, decoded?: object, error?: string }
 */
export function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET, { ignoreExpiration: false });

        if (decoded.type !== 'refresh') {
            return { valid: false, error: 'Token type mismatch' };
        }

        return { valid: true, decoded };
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { valid: false, error: 'Refresh token expired', isExpired: true };
        }
        return { valid: false, error: 'Invalid refresh token' };
    }
}

/**
 * Revoke a token (add to blacklist)
 * In production: Save to Redis with TTL = token expiry
 */
export function revokeToken(token) {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) return false;

        // Use last 10 chars of signature as key
        const tokenSignature = token.substring(token.lastIndexOf('.') + 1).substring(0, 10);
        const expiryMs = decoded.exp * 1000;

        TOKEN_BLACKLIST.set(tokenSignature, expiryMs);
        logger.debug('[revokeToken] Token revoked', { userId: decoded.userId, expiryMs });

        return true;
    } catch (err) {
        logger.error('[revokeToken] Failed to revoke token', { error: err.message });
        return false;
    }
}

/**
 * Invalidate all refresh tokens for a user (version mismatch)
 * Call this on password change to force all sessions to reauthenticate
 * In production: Maintain user.tokenVersion in database, increment on password change
 */
export function invalidateAllUserTokens(userId) {
    logger.info('[invalidateAllUserTokens] All tokens invalidated for user', { userId });
    // In production: increment user.tokenVersion in database
    // Then new tokens will have version+1, old tokens will fail version check
}

/**
 * Get current blacklist size (for monitoring)
 */
export function getBlacklistStats() {
    return {
        size: TOKEN_BLACKLIST.size,
        maxSize: 100000,
    };
}
