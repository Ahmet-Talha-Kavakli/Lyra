import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';

// ─── CONFIG & LOGGER (en önce yükle — kritik key kontrol) ─────────────────────
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';

// ─── ROUTES ───────────────────────────────────────────────────────────────────
import authRouter      from './routes/auth.js';
import userRouter      from './routes/user.js';
import sessionRouter   from './routes/session.js';
import chatRouter      from './routes/chat.js';
import knowledgeRouter from './routes/knowledge.js';
import analysisRouter  from './routes/analysis.js';
import therapyRouter   from './routes/therapy.js';
import characterRouter from './routes/character.js';
import adminRouter     from './routes/admin.js';

// ─── CRON JOB FUNCTIONS ───────────────────────────────────────────────────────
import { supabase } from './lib/supabase.js';
import {
    autonomousSourceDiscovery,
    assessKnowledgeQuality,
    detectKnowledgeGaps,
    verifySourceCredibility
} from './lib/cronJobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = config.PORT;

// ─── GÜVENLİK BAŞLIKLARI ─────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'http://localhost:3001',
    'http://localhost:5173',
    ...(config.FRONTEND_URL ? [config.FRONTEND_URL] : []),
    ...(config.FRONTEND_URL_PREVIEW ? [config.FRONTEND_URL_PREVIEW] : []),
];

app.use(cors({
    origin: (origin, callback) => {
        // null/undefined origin: server-to-server veya mobile — production'da reddet
        if (!origin) {
            if (config.IS_PROD) {
                return callback(new Error('CORS: Origin header zorunlu'));
            }
            return callback(null, true); // dev: izin ver
        }
        if (/\.vercel\.app$/.test(origin)) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('CORS: Origin izinli değil'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
    const checks = {};
    let status = 'healthy';

    // Database ping
    try {
        const { error } = await supabase.from('psychological_profiles').select('count').limit(1);
        checks.database = error ? 'unhealthy' : 'healthy';
        if (error) status = 'degraded';
    } catch {
        checks.database = 'unhealthy';
        status = 'degraded';
    }

    // Memory
    const mem = process.memoryUsage();
    const heapPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
    checks.memory = heapPct < 85 ? 'healthy' : 'warning';
    if (heapPct > 95) status = 'unhealthy';

    // Uptime
    checks.uptime = Math.round(process.uptime()) + 's';

    res.status(status === 'unhealthy' ? 503 : 200).json({
        status,
        timestamp: new Date().toISOString(),
        env: config.NODE_ENV,
        checks,
    });
});

// ─── ROOT ──────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
    res.send('<h1>Lyra Brain is Running</h1><p>Visit <a href="/health">/health</a> to check status.</p>');
});

// ─── ROUTE MOUNTS ─────────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/', userRouter);
app.use('/', sessionRouter);
app.use('/', chatRouter);
app.use('/', knowledgeRouter);
app.use('/', analysisRouter);
app.use('/', therapyRouter);
app.use('/', characterRouter);
app.use('/', adminRouter);

// ─── CRON ZAMANLANDIRMASı ────────────────────────────────────────────────────
// Duplicate protection: only primary pod runs cron jobs (HOSTNAME-based)
const IS_PRIMARY_POD = !process.env.HOSTNAME || process.env.HOSTNAME.endsWith('-0') || process.env.HOSTNAME.endsWith('primary');
const SHOULD_RUN_CRON = IS_PRIMARY_POD && process.env.VERCEL !== '1';

if (SHOULD_RUN_CRON) {
    try {
        cron.schedule('0 2 * * *', autonomousSourceDiscovery);
        logger.info('[CRON] Günlük kaynak keşfi zamanlandı (02:00)');

        cron.schedule('0 3 * * 1', assessKnowledgeQuality);
        logger.info('[CRON] Haftalık kalite kontrolü zamanlandı (Pazartesi 03:00)');

        cron.schedule('0 2 * * 5', detectKnowledgeGaps);
        logger.info('[CRON] Bilgi boşluğu tespiti zamanlandı (Cuma 02:00)');

        cron.schedule('0 4 1 * *', verifySourceCredibility);
        logger.info('[CRON] Aylık güvenilirlik doğrulaması zamanlandı');
    } catch (err) {
        logger.error('[CRON] Zamanlandırma hatası', { error: err.message });
    }
} else {
    logger.info('[CRON] SKIPPED — secondary pod or Vercel env', { isPrimary: IS_PRIMARY_POD, isVercel: process.env.VERCEL === '1' });
}

// ─── SUNUCU BAŞLAT ────────────────────────────────────────────────────────────
let server;
if (process.env.VERCEL !== '1') {
    server = app.listen(port, () => {
        logger.info('Lyra Brain başlatıldı', { port, env: config.NODE_ENV });
    });
}

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
let isShuttingDown = false;

function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`${signal} alındı — güvenli kapatma başlıyor`);

    if (!server) {
        process.exit(0);
    }

    // Yeni bağlantı kabul etmeyi durdur
    server.close(() => {
        logger.info('Tüm bağlantılar kapatıldı — çıkılıyor');
        process.exit(0);
    });

    // 15 saniye içinde kapanmazsa zorla kapat
    setTimeout(() => {
        logger.error('Graceful shutdown zaman aşımı — zorla kapatılıyor');
        process.exit(1);
    }, 15_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ─── BEKLENMEYEN HATA YAKALAMA ────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
    logger.error('uncaughtException — kritik hata', { error: err.message, stack: err.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', { reason: String(reason) });
    // Crash etmiyoruz — sadece log, uygulama devam ediyor
});

export default app;
