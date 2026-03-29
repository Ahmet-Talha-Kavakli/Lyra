// lib/config.js
// Uygulama başlarken tüm kritik environment variable'ları doğrular.
// Eksik veya güvensiz değer varsa process.exit(1) ile durur.
// Yüklendikten sonra tüm modüller buradan config okur.
//
// Kullanım:
//   import { config } from '../lib/config.js';
//   const secret = config.JWT_SECRET;

import dotenv from 'dotenv';
dotenv.config();

// ─── ZORUNLU KEY'LER ──────────────────────────────────────────────────────────
const REQUIRED = [
    'JWT_SECRET',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
];

const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error('[CONFIG] FATAL: Eksik environment variable\'lar:');
    missing.forEach(k => console.error(`  - ${k}`));
    console.error('[CONFIG] .env dosyanızı kontrol edin (.env.example\'a bakın)');
    process.exit(1);
}

// ─── GÜVENLİK KONTROLÜ ───────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (JWT_SECRET.length < 32) {
    console.error('[CONFIG] FATAL: JWT_SECRET en az 32 karakter olmalı.');
    console.error('[CONFIG] Üretmek için: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
}
if (JWT_SECRET.includes('your-') || JWT_SECRET.includes('secret-here') || JWT_SECRET.includes('change-this')) {
    console.error('[CONFIG] FATAL: JWT_SECRET hâlâ varsayılan/örnek değer içeriyor. Gerçek bir değer üretin.');
    process.exit(1);
}

// ─── CONFIG NESNESI ───────────────────────────────────────────────────────────
export const config = {
    NODE_ENV:             process.env.NODE_ENV || 'development',
    PORT:                 parseInt(process.env.PORT || '3001', 10),
    IS_PROD:              process.env.NODE_ENV === 'production',

    // Auth
    JWT_SECRET:           process.env.JWT_SECRET,
    ADMIN_SECRET:         process.env.ADMIN_SECRET || null,
    VAPI_SECRET:          process.env.VAPI_SECRET || null,
    VAPI_WEBHOOK_SECRET:  process.env.VAPI_WEBHOOK_SECRET || null,
    SUPABASE_JWT_SECRET:  process.env.SUPABASE_JWT_SECRET || null,

    // APIs
    OPENAI_API_KEY:       process.env.OPENAI_API_KEY,
    SUPABASE_URL:         process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    SUPABASE_ANON_KEY:    process.env.SUPABASE_ANON_KEY || null,

    // Frontend
    FRONTEND_URL:         process.env.FRONTEND_URL || null,
    FRONTEND_URL_PREVIEW: process.env.FRONTEND_URL_PREVIEW || null,

    // Logging
    LOG_LEVEL:            process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};
