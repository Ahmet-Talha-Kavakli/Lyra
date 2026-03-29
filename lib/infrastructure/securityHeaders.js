// [SECURITY HEADERS — COMPREHENSIVE HTTP HARDENING]
// OWASP Security Headers for 100K+ production systems
// Protects against: XSS, clickjacking, MIME type sniffing, etc.

import { logger } from './logger.js';

/**
 * All security headers for production
 * Organized by threat model
 */
export const SECURITY_HEADERS = {
    // ─── XSS PROTECTION ──────────────────────────────────────────────────────
    'X-Content-Type-Options': 'nosniff', // Prevent MIME sniffing
    'X-XSS-Protection': '1; mode=block', // Legacy XSS filter (modern: CSP)
    'X-Frame-Options': 'SAMEORIGIN', // Clickjacking protection

    // ─── CONTENT SECURITY POLICY ─────────────────────────────────────────────
    // Restrict resource loading to prevent inline scripts
    // NOTE: React apps use CSS-in-JS (styled-components, etc.) which requires nonce, not unsafe-inline
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' https://cdn.jsdelivr.net", // NO unsafe-inline, NO unsafe-eval
        "style-src 'self' https://fonts.googleapis.com", // NO unsafe-inline (use CSS modules or nonce)
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https:",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'", // No flash, no plugins
        "upgrade-insecure-requests", // Force HTTPS
    ].join('; '),

    // ─── REFERRER POLICY ─────────────────────────────────────────────────────
    'Referrer-Policy': 'strict-origin-when-cross-origin', // No referrer on cross-origin

    // ─── PERMISSION POLICY (formerly Feature-Policy) ────────────────────────
    'Permissions-Policy': [
        'geolocation=()',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
    ].join(', '),

    // ─── STRICT TRANSPORT SECURITY ───────────────────────────────────────────
    // Force HTTPS (only in production)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

    // ─── CORS & INTERACTION ──────────────────────────────────────────────────
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Embedder-Policy': 'require-corp',

    // ─── CACHE CONTROL ───────────────────────────────────────────────────────
    'Cache-Control': 'public, max-age=0, must-revalidate', // No caching by default
};

/**
 * Development headers (relaxed CSP for hot reloading, etc.)
 */
export const DEV_SECURITY_HEADERS = {
    ...SECURITY_HEADERS,
    'Content-Security-Policy': [
        "default-src 'self' http: ws:", // Allow localhost dev server
        "script-src 'self' http: ws: 'nonce-dev-only'", // Nonce for dev, NO unsafe-eval
        "style-src 'self' http: 'nonce-dev-only'", // Use nonce instead of unsafe-inline
        "font-src 'self' data: http:",
        "img-src 'self' data: http: https:",
        "connect-src 'self' http: ws: https:",
    ].join('; '),
    'Strict-Transport-Security': 'max-age=0', // No HTTPS enforcement in dev
};

/**
 * Middleware: Apply security headers
 */
export function securityHeadersMiddleware(req, res, next) {
    const headers = process.env.NODE_ENV === 'production' ? SECURITY_HEADERS : DEV_SECURITY_HEADERS;

    for (const [header, value] of Object.entries(headers)) {
        res.setHeader(header, value);
    }

    // Additional runtime headers
    res.setHeader('X-Request-ID', `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    res.setHeader('X-Powered-By', ''); // Remove server fingerprint

    next();
}

/**
 * Middleware: HSTS preload check (for compliance scanning)
 */
export function hstsPreloadMiddleware(_req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    next();
}

/**
 * API security response headers
 * Applied to API endpoints only
 */
export const API_SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
};

/**
 * Middleware: API security headers
 */
export function apiSecurityHeadersMiddleware(req, res, next) {
    for (const [header, value] of Object.entries(API_SECURITY_HEADERS)) {
        res.setHeader(header, value);
    }

    next();
}

/**
 * Security header validation (for /health endpoint)
 */
export function validateSecurityHeaders(headers) {
    const required = [
        'x-content-type-options',
        'x-frame-options',
        'content-security-policy',
    ];

    const missing = required.filter(h => !headers[h]);

    return {
        status: missing.length === 0 ? 'compliant' : 'non-compliant',
        missing,
        headers: Object.keys(headers).filter(h => h.startsWith('x-') || h === 'content-security-policy'),
    };
}

/**
 * Security headers documentation
 */
export const SECURITY_HEADERS_DOCS = {
    'X-Content-Type-Options': 'Prevents MIME type sniffing (e.g., serving .js as .html)',
    'X-Frame-Options': 'Clickjacking protection: prevents embedding in iframes',
    'Content-Security-Policy': 'Restricts where scripts/styles can load from (XSS prevention)',
    'Referrer-Policy': 'Controls what referrer info is sent to other sites',
    'Permissions-Policy': 'Blocks access to device features (geolocation, camera, microphone)',
    'Strict-Transport-Security': 'Forces HTTPS for future connections',
    'Cross-Origin-Resource-Policy': 'Controls resource sharing across origins',
    'Cache-Control': 'Prevents caching of sensitive data',
};

/**
 * Log security header violations (for monitoring)
 */
export function logSecurityHeaderViolation(violation) {
    logger.warn('[SecurityHeaders] Violation detected', {
        type: violation.type,
        source: violation.source,
        timestamp: new Date().toISOString(),
    });
}
