import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { supabase } from '../lib/shared/supabase.js';
import { validateUserRegistration, validateEmail } from '../lib/shared/validators.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, revokeToken } from '../lib/infrastructure/tokenManager.js';
import { logger } from '../lib/infrastructure/logger.js';
import { setUserContext, clearUserContext } from '../lib/infrastructure/errorMonitoring.js';

const router = express.Router();

const IS_PROD = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: IS_PROD,        // HTTPS mandatory in prod
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
};

const ACCESS_TOKEN_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 minutes
};

const REFRESH_TOKEN_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Rate limiting: 5 attempts per 15 minutes (strict for auth)
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req, _res) => {
        // Per email (slower enumeration attacks) + per IP
        const email = req.body?.email || req.ip;
        return `${email}:${req.ip}`;
    },
    message: { error: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !IS_PROD, // Skip rate limit in dev
});

// ─── SIGNUP ──────────────────────────────────────────────────────────────────
router.post('/v1/signup', authRateLimit, validateUserRegistration, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email ve şifre gerekli' });
        }

        if (password.length < 6 || password.length > 128) {
            return res.status(400).json({ error: 'Şifre 6-128 karakter arasında olmalı' });
        }

        // Check if user exists (prevents user enumeration partially)
        const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1 });
        const exists = (existingUsers?.users ?? []).some(u => u.email?.toLowerCase() === email.toLowerCase());

        if (exists) {
            // Security: don't reveal if email exists
            return res.status(400).json({ error: 'Bu email ile hesap oluşturulamaz. Yeniden deneyin.' });
        }

        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (error) {
            logger.warn('[/v1/signup] User creation failed', { email, error: error.message });
            return res.status(400).json({ error: 'Kayıt başarısız. Lütfen tekrar deneyin.' });
        }

        const userId = data.user.id;

        // Initialize psychological profile
        try {
            const { error: profileError } = await supabase
                .from('psychological_profiles')
                .insert({
                    user_id: userId,
                    session_count: 0,
                    attachment_style: null,
                    triggers: [],
                    life_schemas: [],
                    unconscious_patterns: [],
                    defense_mechanisms: [],
                    strengths: []
                });

            if (profileError) {
                logger.error('[/v1/signup] Profile creation failed', { userId, error: profileError.message });
                // Don't fail the signup, profile can be created later
            }
        } catch (profileErr) {
            logger.error('[/v1/signup] Profile creation failed', { userId, error: profileErr.message });
            // Don't fail the signup, profile can be created later
        }

        // Issue tokens
        const accessToken = signAccessToken(userId, email);
        const refreshToken = signRefreshToken(userId, 1);

        // Set cookies
        res.cookie('lyra_access_token', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
        res.cookie('lyra_refresh_token', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

        // Set user context in error monitoring
        setUserContext(userId, email);

        logger.info('[/v1/signup] User registered', { userId, email });
        res.status(201).json({
            success: true,
            message: 'Kayıt başarılı',
            accessToken,
            refreshToken,
            userId,
            email,
        });
    } catch (err) {
        logger.error('[/v1/signup] Unexpected error', { error: err.message });
        res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
    }
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────
router.post('/v1/login', authRateLimit, validateEmail, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email ve şifre gerekli' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error || !data?.user) {
            logger.warn('[/v1/login] Failed login attempt', { email });
            // Security: generic error (don't reveal if user exists)
            return res.status(401).json({ error: 'Email veya şifre yanlış' });
        }

        const userId = data.user.id;

        // Issue tokens
        const accessToken = signAccessToken(userId, data.user.email);
        const refreshToken = signRefreshToken(userId, 1);

        // Set cookies
        res.cookie('lyra_access_token', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
        res.cookie('lyra_refresh_token', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

        // Set user context in error monitoring
        setUserContext(userId, data.user.email);

        logger.info('[/v1/login] User logged in', { userId, email });
        res.json({
            success: true,
            message: 'Giriş başarılı',
            accessToken,
            refreshToken,
            userId,
            email: data.user.email,
        });
    } catch (err) {
        logger.error('[/v1/login] Unexpected error', { error: err.message });
        res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
    }
});

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
router.post('/v1/logout', async (req, res) => {
    try {
        const accessToken = req.cookies?.lyra_access_token;

        // Revoke both tokens
        if (accessToken) {
            revokeToken(accessToken);
        }

        res.clearCookie('lyra_access_token', COOKIE_OPTIONS);
        res.clearCookie('lyra_refresh_token', COOKIE_OPTIONS);

        // Clear user context in error monitoring
        clearUserContext();

        const userId = req.userId || 'unknown';
        logger.info('[/v1/logout] User logged out', { userId });

        res.json({ success: true, message: 'Çıkış başarılı' });
    } catch (err) {
        logger.error('[/v1/logout] Unexpected error', { error: err.message });
        res.status(500).json({ error: 'Çıkış sırasında hata oluştu' });
    }
});

// ─── REFRESH TOKEN ───────────────────────────────────────────────────────────
router.post('/v1/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies?.lyra_refresh_token
            || req.body?.refreshToken
            || req.headers.authorization?.split(' ')[1];

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token gerekli' });
        }

        const { valid, decoded, error } = verifyRefreshToken(refreshToken);

        if (!valid) {
            logger.warn('[/v1/refresh] Invalid refresh token', { error });
            return res.status(401).json({ error: error || 'Refresh token geçersiz' });
        }

        // Verify user still exists
        try {
            const { data: user, error: userError } = await supabase.auth.admin.getUserById(decoded.userId);
            if (userError || !user?.user) {
                logger.warn('[/v1/refresh] User not found', { userId: decoded.userId });
                return res.status(401).json({ error: 'Kullanıcı bulunamadı. Yeniden giriş yapın.' });
            }

            // Check if user is disabled/deleted
            if (user.user.deleted_at) {
                logger.warn('[/v1/refresh] User deleted', { userId: decoded.userId });
                return res.status(401).json({ error: 'Hesap silinmiş. Yeniden giriş yapın.' });
            }

            // Issue new access token (keep same refresh token unless expired)
            const newAccessToken = signAccessToken(decoded.userId, user.user.email);

            res.cookie('lyra_access_token', newAccessToken, ACCESS_TOKEN_COOKIE_OPTIONS);

            logger.info('[/v1/refresh] Token refreshed', { userId: decoded.userId });
            res.json({
                success: true,
                accessToken: newAccessToken,
                refreshToken, // Return same refresh token (still valid)
            });
        } catch (userCheckErr) {
            logger.error('[/v1/refresh] User verification failed', { error: userCheckErr.message });
            return res.status(500).json({ error: 'Sunucu hatası' });
        }
    } catch (err) {
        logger.error('[/v1/refresh] Unexpected error', { error: err.message });
        res.status(500).json({ error: 'Token yenileme başarısız' });
    }
});

export default router;
