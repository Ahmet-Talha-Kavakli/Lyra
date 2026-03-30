/**
 * Content Security Policy (CSP) Headers
 * Prevents XSS, clickjacking, and data injection attacks
 *
 * Policy:
 * - Default: same-origin only
 * - Scripts: self only (no inline)
 * - Styles: self only (no unsafe-inline)
 * - Images: self + https: (for CDN)
 * - API: API domain only
 */

import { config } from './config.js';
import { logger } from './logging/logger.js';

/**
 * Generate CSP header with nonce for inline styles/scripts
 * Nonce is random per request — prevents inline code execution unless nonce matches
 */
function generateNonce() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * CSP Middleware — set security headers
 */
export function cspHeadersMiddleware(req, res, next) {
    const nonce = generateNonce();

    // Store nonce in request for template rendering (if needed)
    req.nonce = nonce;

    // PRODUCTION SECURITY: Strict CSP
    const cspHeader = [
        `default-src 'none'`,
        `script-src 'self' 'nonce-${nonce}'`, // Only allow scripts with matching nonce
        `style-src 'self' 'nonce-${nonce}'`, // Only allow styles with matching nonce
        `img-src 'self' data: https:`, // Allow images from self, data URIs, and HTTPS
        `font-src 'self'`, // Fonts from self only
        `connect-src 'self' ${config.FRONTEND_URL || ''}`, // API calls to self + frontend
        `frame-ancestors 'none'`, // Prevent clickjacking (no framing)
        `base-uri 'self'`, // Base tag only from self
        `form-action 'self'`, // Forms only to self
        `upgrade-insecure-requests`, // Force HTTPS in production
        `block-all-mixed-content`, // Block mixed HTTP/HTTPS
    ];

    // In development: slightly relaxed for HMR
    if (!config.IS_PROD) {
        // Allow HMR for Vite + webpack-dev-server
        cspHeader.push(`script-src 'self' 'nonce-${nonce}' ws: wss: localhost:*`);
        cspHeader.push(`style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`);
    }

    // Set CSP header
    res.setHeader('Content-Security-Policy', cspHeader.join('; '));

    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME type sniffing
    res.setHeader('X-Frame-Options', 'DENY'); // Prevent clickjacking
    res.setHeader('X-XSS-Protection', '1; mode=block'); // Legacy XSS protection
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // Control referrer
    res.setHeader('Permissions-Policy', 'microphone=(), camera=(), geolocation=()'); // Disable unnecessary features

    logger.debug('[CSP] Headers set', { path: req.path });

    next();
}

/**
 * CSP Violation Report Handler
 * Captures CSP violations (for monitoring/debugging)
 *
 * Client-side:
 * ```html
 * <meta http-equiv="Content-Security-Policy" content="...; report-uri /csp-violation">
 * ```
 */
export function cspViolationHandler(req, res) {
    const violation = req.body;

    logger.warn('[CSP Violation] Reported by client', {
        documentUri: violation['document-uri'],
        violatedDirective: violation['violated-directive'],
        blockedUri: violation['blocked-uri'],
        originalPolicy: violation['original-policy'],
        sourceFile: violation['source-file'],
        lineNumber: violation['line-number'],
        columnNumber: violation['column-number']
    });

    // Could send to Sentry or logging service
    // Sentry.captureMessage('CSP Violation', 'warning', { extra: violation });

    res.status(204).send();
}
