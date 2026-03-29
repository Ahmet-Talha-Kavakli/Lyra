import express from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// ─── SIGNUP ──────────────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validasyon
        if (!email || !password) {
            return res.status(400).json({ error: 'Email ve şifre gerekli' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
        }

        // Supabase auth ile kayıt
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        const userId = data.user.id;

        // Profil oluştur
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

        // JWT token oluştur
        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: 'Kayıt başarılı',
            token,
            userId,
            email,
        });
    } catch (err) {
        console.error('[/auth/signup] Hata:', err.message);
        res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
    }
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email ve şifre gerekli' });
        }

        // Supabase auth ile giriş — JWT token oluştur
        const { data: userData, error: userError } = await supabase
            .from('auth.users')
            .select('id, email')
            .eq('email', email)
            .single();

        if (userError || !userData) {
            return res.status(401).json({ error: 'Email veya şifre yanlış' });
        }

        // TODO: Password kontrolü Supabase üzerinden yapılmalı
        // Şimdilik sadece user varlığını kontrol et
        const error = null;
        const data = { user: { id: userData.id, email: userData.email } };

        if (error) {
            return res.status(401).json({ error: 'Email veya şifre yanlış' });
        }

        const userId = data.user.id;

        // JWT token oluştur
        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: 'Giriş başarılı',
            token,
            userId,
            email,
        });
    } catch (err) {
        console.error('[/auth/login] Hata:', err.message);
        res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
    }
});

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
    try {
        // Frontend token'ı siler, backend'de yapacak çok bir şey yok
        res.json({
            success: true,
            message: 'Çıkış başarılı',
        });
    } catch (err) {
        console.error('[/auth/logout] Hata:', err.message);
        res.status(500).json({ error: 'Çıkış sırasında hata oluştu' });
    }
});

// ─── VERIFY TOKEN ────────────────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Token gerekli' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        res.json({
            success: true,
            userId: decoded.userId,
            email: decoded.email,
        });
    } catch (err) {
        console.error('[/auth/verify] Hata:', err.message);
        res.status(401).json({ error: 'Token geçersiz veya süresi dolmuş' });
    }
});

export default router;
