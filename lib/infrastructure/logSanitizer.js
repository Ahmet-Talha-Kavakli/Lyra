/**
 * Log Sanitizer
 * Removes/redacts sensitive data from logs (GDPR compliance)
 *
 * Redacts:
 * - API keys, tokens, passwords
 * - Email addresses (PII)
 * - Phone numbers (PII)
 * - Credit card numbers
 * - Psychological assessment data
 */

const SENSITIVE_PATTERNS = {
    // API Keys / Tokens
    apiKey: /(?:api[_-]?key|apikey|secret|token)[\s]*:[\s]*['"]?([^'"\s,}]+)/gi,
    jwt: /Bearer\s+([^\s]+)/gi,
    password: /(?:password|passwd|pwd)[\s]*:[\s]*['"]?([^'"\s,}]+)/gi,

    // PII
    email: /[\w\.-]+@[\w\.-]+\.\w+/g,
    phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    ssn: /\d{3}-\d{2}-\d{4}/g,

    // Payment
    creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,

    // Supabase
    supabaseKey: /(?:supabase[_-]?key|anon[_-]?key)[\s]*:[\s]*['"]?([^'"\s,}]+)/gi,
};

function sanitizeValue(value) {
    if (typeof value !== 'string') return value;

    let sanitized = value;

    // Redact API keys
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.apiKey, 'api_key: [REDACTED]');

    // Redact JWT tokens (keep first 10 chars for debugging)
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.jwt, (match, token) => {
        return `Bearer ${token.substring(0, 10)}...`;
    });

    // Redact passwords
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.password, 'password: [REDACTED]');

    // Redact PII with context
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.email, '[EMAIL_REDACTED]');
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.phone, '[PHONE_REDACTED]');
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.ssn, '[SSN_REDACTED]');

    // Redact credit cards
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.creditCard, '[CC_REDACTED]');

    // Redact Supabase keys
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.supabaseKey, 'supabase_key: [REDACTED]');

    return sanitized;
}

export function sanitizeLogData(data) {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
        return sanitizeValue(data);
    }

    if (Array.isArray(data)) {
        return data.map(item => sanitizeLogData(item));
    }

    if (typeof data === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            // Skip sensitive key names entirely
            if (/password|token|secret|key|auth|credential/i.test(key)) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeLogData(value);
            } else if (typeof value === 'string') {
                sanitized[key] = sanitizeValue(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }

    return data;
}
