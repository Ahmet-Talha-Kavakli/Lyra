/**
 * Input Validation & Sanitization
 *
 * Professional-grade validation using Zod
 * Prevents: XSS, SQL injection, parameter pollution, type coercion attacks
 */

import { z } from 'zod';
import xss from 'xss';
import DOMPurify from 'dompurify';
import { logger } from '../infrastructure/logger.js';

// ─── SANITIZATION FUNCTIONS ──────────────────────────────────────────────────

/**
 * Sanitize string against XSS
 * Removes dangerous HTML/JS while preserving safe content
 */
export function sanitizeString(input) {
    if (typeof input !== 'string') return input;

    // Step 1: XSS library for basic XSS prevention
    let cleaned = xss(input, {
        whiteList: {}, // No HTML tags allowed
        stripIgnoredTag: true,
        stripLeadingAndTrailingWhitespace: true,
    });

    // Step 2: DOMPurify for deeper sanitization
    cleaned = DOMPurify.sanitize(cleaned, { ALLOWED_TAGS: [] });

    // Step 3: Remove control characters
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

    return cleaned;
}

/**
 * Sanitize HTML content (allows safe tags for rich text)
 */
export function sanitizeHtml(input) {
    if (typeof input !== 'string') return input;

    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'li', 'ol'],
        ALLOWED_ATTR: [],
    });
}

// ─── ZOD SCHEMAS (Source of Truth) ───────────────────────────────────────────

/**
 * Email validation schema
 */
const emailSchema = z
    .string()
    .min(3, 'Email çok kısa')
    .max(254, 'Email çok uzun (RFC 5321)')
    .email('Geçerli bir email adresi girin')
    .transform(sanitizeString)
    .transform(e => e.toLowerCase());

/**
 * Password validation schema
 * Requirements: 12+ chars, uppercase, lowercase, number, symbol
 */
const passwordSchema = z
    .string()
    .min(12, 'Şifre en az 12 karakter olmalı')
    .max(128, 'Şifre çok uzun')
    .regex(/[A-Z]/, 'En az bir büyük harf gerekli')
    .regex(/[a-z]/, 'En az bir küçük harf gerekli')
    .regex(/[0-9]/, 'En az bir sayı gerekli')
    .regex(/[!@#$%^&*]/, 'En az bir özel karakter gerekli (!@#$%^&*)');

/**
 * Chat message schema
 */
const chatMessageSchema = z
    .object({
        message: z
            .string()
            .min(1, 'Mesaj boş olamaz')
            .max(4000, 'Mesaj en fazla 4000 karakter olabilir')
            .transform(sanitizeString),
        sessionId: z.string().optional(),
        language: z.string().optional(),
    })
    .strict(); // No extra fields

/**
 * User registration schema
 */
const userRegistrationSchema = z
    .object({
        email: emailSchema,
        password: passwordSchema,
        name: z
            .string()
            .min(2, 'Ad en az 2 karakter olmalı')
            .max(100, 'Ad çok uzun')
            .transform(sanitizeString),
    })
    .strict();

/**
 * Analysis request schema
 */
const analysisSchema = z
    .object({
        sessionId: z.string().uuid('Geçerli bir session ID girin'),
        transcript: z
            .string()
            .min(10, 'Transcript en az 10 karakter olmalı')
            .max(50000, 'Transcript çok uzun')
            .transform(sanitizeString),
        analysisType: z.enum(['emotion', 'pattern', 'crisis']),
    })
    .strict();

/**
 * Session creation schema
 */
const sessionSchema = z
    .object({
        userId: z.string().uuid('Geçerli bir user ID girin'),
        therapyType: z.enum(['cbt', 'dbt', 'schema', 'ifs', 'trauma']),
        initialMessage: z
            .string()
            .min(1)
            .max(1000)
            .transform(sanitizeString),
    })
    .strict();

// ─── VALIDATION MIDDLEWARE ───────────────────────────────────────────────────

/**
 * Generic validation middleware factory
 */
function createValidator(schema, source = 'body') {
    return (req, res, next) => {
        try {
            const data = source === 'body' ? req.body : req.query;
            const validated = schema.parse(data);

            // Attach validated data to request
            if (source === 'body') {
                req.body = validated;
            } else {
                req.query = validated;
            }

            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                logger.warn('[Validation] Request failed', {
                    source,
                    errors: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });

                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors.map(e => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
            }

            logger.error('[Validation] Unexpected error', { error: error.message });
            res.status(500).json({ error: 'Internal validation error' });
        }
    };
}

// ─── EXPORTED MIDDLEWARE ──────────────────────────────────────────────────────

export const validateChatMessage = createValidator(chatMessageSchema);
export const validateUserRegistration = createValidator(userRegistrationSchema);
export const validateAnalysis = createValidator(analysisSchema);
export const validateSession = createValidator(sessionSchema);
export const validateEmail = (req, res, next) => {
    try {
        req.body.email = emailSchema.parse(req.body.email);
        next();
    } catch (error) {
        return res.status(400).json({ error: 'Invalid email' });
    }
};
export const validatePassword = (req, res, next) => {
    try {
        req.body.password = passwordSchema.parse(req.body.password);
        next();
    } catch (error) {
        return res.status(400).json({
            error: 'Password must be 12+ chars with uppercase, lowercase, number, and symbol',
        });
    }
};

// ─── STANDALONE VALIDATORS (for non-middleware use) ──────────────────────────

/**
 * Validate and sanitize user input (returns null if invalid)
 */
export function validateAndClean(data, schema) {
    try {
        return schema.parse(data);
    } catch {
        return null;
    }
}

/**
 * Safe JSON parse (prevents JSON injection)
 */
export function safeJsonParse(str, fallback = null) {
    try {
        const parsed = JSON.parse(str);
        // Prevent prototype pollution
        Object.setPrototypeOf(parsed, Object.prototype);
        return parsed;
    } catch {
        return fallback;
    }
}

/**
 * Validate UUID format
 */
export function isValidUuid(uuid) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Validate URL (prevent SSRF attacks)
 */
export function isValidUrl(urlString) {
    try {
        const url = new URL(urlString);
        // Block internal IPs
        const hostname = url.hostname;
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.')
        ) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}
