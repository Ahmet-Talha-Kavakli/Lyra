import express from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { supabase } from '../lib/supabase.js';
import { validateAuthInput } from '../lib/validators.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET environment variable is not set. Server cannot start safely.');
    process.exit(1);
}
const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: IS_PROD,        // HTTPS zorunlu (prod)
    sameSite: IS_PROD ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
    path: '/',
};

const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 10,
    message: { error: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
});

function signToken(userId, email) {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

// ─── SIGNUP ──────────────────────────────────────────────────────────────────
router.post('/v1/v1/signup', authRateLimit, validateAuthInput, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email ve şifre gerekli' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
        }

        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        const userId = data.user.id;

        await supabase.from('psychological_profiles').insert({
            user_id: userId,
            session_count: 0,
            attachment_style: null,
            triggers: [],
            life_schemas: [],
            unconscious_patterns: [],
            defense_mechanisms: [],
            strengths: [],
        });

        const token = signToken(userId, email);

        res.cookie('lyra_token', token, COOKIE_OPTIONS);
        res.json({ success: true, message: 'Kayıt başarılı', token, userId, email });
    } catch (err) {
        console.error('[/auth/signup] Hata:', err.message);
        res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
    }
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────
router.post('/v1/v1/login', authRateLimit, validateAuthInput, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email ve şifre gerekli' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error || !data?.user) {
            return res.status(401).json({ error: 'Email veya şifre yanlış' });
        }

        const userId = data.user.id;
        const token = signToken(userId, data.user.email);

        res.cookie('lyra_token', token, COOKIE_OPTIONS);
        res.json({ success: true, message: 'Giriş başarılı', token, userId, email: data.user.email });
    } catch (err) {
        console.error('[/auth/login] Hata:', err.message);
        res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
    }
});

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
router.post('/v1/v1/logout', async (_req, res) => {
    try {
        res.clearCookie('lyra_token', { ...COOKIE_OPTIONS, maxAge: 0 });
        res.json({ success: true, message: 'Çıkış başarılı' });
    } catch (err) {
        console.error('[/auth/logout] Hata:', err.message);
        res.status(500).json({ error: 'Çıkış sırasında hata oluştu' });
    }
});

// ─── REFRESH TOKEN ───────────────────────────────────────────────────────────
router.post('/v1/v1/refresh', async (req, res) => {
    try {
        // Cookie veya header'dan token al
        const oldToken = req.cookies?.lyra_token
            || req.headers.authorization?.split(' ')[1];

        if (!oldToken) {
            return res.status(401).json({ error: 'Token gerekli' });
        }

        let decoded;
        try {
            // ignoreExpiration: süresi yeni dolmuş token'ları da yenile
            decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });
        } catch {
            return res.status(401).json({ error: 'Token geçersiz' });
        }

        // Süresi 7 günden fazla önce dolmuşsa reddet (güvenlik penceresi)
        const expiredAgo = Math.floor(Date.now() / 1000) - decoded.exp;
        if (expiredAgo > 7 * 24 * 60 * 60) {
            return res.status(401).json({ error: 'Token çok eski, yeniden giriş yapın' });
        }

        // Kullanıcının hala aktif olduğunu kontrol et
        const { data: user, error } = await supabase.auth.admin.getUserById(decoded.userId);
        if (error || !user?.user) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }

        const newToken = signToken(decoded.userId, decoded.email);

        res.cookie('lyra_token', newToken, COOKIE_OPTIONS);
        res.json({ success: true, token: newToken });
    } catch (err) {
        console.error('[/auth/refresh] Hata:', err.message);
        res.status(500).json({ error: 'Token yenileme sırasında hata oluştu' });
    }
});

// ─── VERIFY TOKEN ────────────────────────────────────────────────────────────
router.post('/v1/v1/verify', async (req, res) => {
    try {
        const token = req.cookies?.lyra_token
            || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Token gerekli' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        res.json({ success: true, userId: decoded.userId, email: decoded.email });
    } catch (err) {
        console.error('[/auth/verify] Hata:', err.message);
        res.status(401).json({ error: 'Token geçersiz veya süresi dolmuş' });
    }
});

// ─── E-POSTA VARLIK KONTROLÜ ─────────────────────────────────────────────────
router.post('/v1/v1/check-email', async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email required' });
    }
    try {
        // Supabase admin API'sinde getUserByEmail yok — listUsers + filter kullanıyoruz
        const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (error) {
            return res.status(500).json({ error: 'lookup failed' });
        }
        const normalized = email.trim().toLowerCase();
        const exists = (data?.users ?? []).some(u => u.email?.toLowerCase() === normalized);
        return res.json({ exists });
    } catch (err) {
        return res.status(500).json({ error: 'lookup failed' });
    }
});

export default router;
