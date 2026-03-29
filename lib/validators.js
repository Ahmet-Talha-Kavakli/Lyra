// lib/validators.js
// Sıfır bağımlılık — tüm API endpoint'leri için input validation middleware'leri
// Her validator: req.body doğrular, hata varsa 400 döner, yoksa next() çağırır.

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────────────────

/**
 * Temel string temizliği — control character ve leading/trailing boşluk kaldırır
 * @param {string} val
 * @returns {string}
 */
function sanitizeString(val) {
    if (typeof val !== 'string') return val;
    // ASCII control characters (tab ve newline hariç) sil
    return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

/**
 * Email formatı kontrolü
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── CHAT MESAJI ─────────────────────────────────────────────────────────────

/**
 * POST /api/chat — mesaj içeriği kontrolü
 */
export function validateChatMessage(req, res, next) {
    const message = req.body?.message;

    if (message === undefined || message === null) {
        return res.status(400).json({ error: 'message alanı zorunlu' });
    }

    if (typeof message !== 'string') {
        return res.status(400).json({ error: 'message string olmalı' });
    }

    const cleaned = sanitizeString(message);

    if (cleaned.length === 0) {
        return res.status(400).json({ error: 'message boş olamaz' });
    }

    if (cleaned.length > 4000) {
        return res.status(400).json({ error: 'message en fazla 4000 karakter olabilir' });
    }

    // Doğrulanmış değeri req'e yaz — handler buradan okur
    req.body.message = cleaned;
    next();
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

/**
 * POST /auth/login ve /auth/signup — email + password kontrolü
 */
export function validateAuthInput(req, res, next) {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
        return res.status(400).json({ error: 'email ve password zorunlu' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Geçersiz email formatı' });
    }

    if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    if (password.length > 128) {
        return res.status(400).json({ error: 'Şifre en fazla 128 karakter olabilir' });
    }

    req.body.email    = sanitizeString(email).toLowerCase();
    req.body.password = password; // şifreyi trim etme — kasıtlı boşluk olabilir
    next();
}

// ─── OTURUM ───────────────────────────────────────────────────────────────────

/**
 * UUID formatı kontrolü (session_id, user_id gibi parametreler için)
 * @param {string} val
 * @returns {boolean}
 */
export function isValidUUID(val) {
    return typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}
