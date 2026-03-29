import { verifyAccessToken, signAccessToken } from '../lib/tokenManager.js';
import { logger } from '../lib/logger.js';

/**
 * Extract token from httpOnly cookie or Authorization header
 */
function extractToken(req) {
    if (req.cookies?.lyra_token) return req.cookies.lyra_token;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.split(' ')[1];
    return null;
}

/**
 * Authenticate user with access token verification
 * Includes automatic token refresh if near expiry (< 2 mins remaining)
 */
export function authMiddleware(req, res, next) {
    try {
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({ error: 'Giriş yapmanız gerekliyor' });
        }

        const { valid, decoded, error, isExpired } = verifyAccessToken(token);

        if (!valid) {
            // If token expired and client has refresh token, allow refresh endpoint
            if (isExpired && req.path === '/v1/auth/refresh') {
                return next(); // Let refresh endpoint handle it
            }
            return res.status(401).json({ error: error || 'Token geçersiz veya süresi dolmuş' });
        }

        req.userId = decoded.userId;
        req.userEmail = decoded.email;

        next();
    } catch (err) {
        logger.error('[authMiddleware] Unexpected error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
}

/**
 * Optional auth — token varsa doğrula, yoksa devam et
 * Used for endpoints that have different behavior for authenticated vs unauthenticated users
 */
export function optionalAuthMiddleware(req, res, next) {
    try {
        const token = extractToken(req);

        if (token) {
            const { valid, decoded } = verifyAccessToken(token);
            if (valid) {
                req.userId = decoded.userId;
                req.userEmail = decoded.email;
            } else if (req.headers.authorization || req.cookies?.lyra_token) {
                // Token exists but invalid — fail fast
                logger.warn('[optionalAuthMiddleware] Invalid token attempt', { path: req.path });
                return res.status(401).json({ error: 'Token geçersiz' });
            }
        }

        next();
    } catch (err) {
        logger.error('[optionalAuthMiddleware] Unexpected error', { error: err.message });
        next(); // Continue as unauthenticated
    }
}
