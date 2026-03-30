/**
 * Vercel Serverless Function Handler
 * Exports Express app for Vercel deployment
 *
 * NOTE: WebSocket routes handled separately via /api/ws
 * IMPORTANT: Sentry must initialize FIRST (before other code)
 */

// ─── SENTRY INITIALIZATION (MUST BE FIRST) ────────────────────────────────
import { initializeSentry, sentryErrorMiddleware, setUserContext, clearUserContext } from '../lib/infrastructure/errorMonitoring.js';
initializeSentry();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';

// CONFIG
import { config } from '../lib/infrastructure/config.js';
import { logger } from '../lib/infrastructure/logger.js';

// MIDDLEWARE
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { chatLimiter, apiGeneralLimiter, publicLimiter } from '../middleware/rateLimiters.js';
import { auditContextMiddleware } from '../lib/infrastructure/auditLogger.js';
import { securityHeadersMiddleware } from '../lib/infrastructure/securityHeaders.js';
import { cspHeadersMiddleware, cspViolationHandler } from '../lib/infrastructure/cspHeaders.js';
import { scalingMiddleware, scalingMonitor, getScalingRecommendations } from '../lib/infrastructure/scalingConfig.js';

// ROUTES
import authRouter from '../routes/auth.js';
import userRouter from '../routes/user.js';
import sessionRouter from '../routes/session.js';
import chatRouter from '../routes/chat.js';
import knowledgeRouter from '../routes/knowledge.js';
import analysisRouter from '../routes/analysis.js';
import therapyRouter from '../routes/therapy.js';
import characterRouter from '../routes/character.js';
import adminRouter from '../routes/admin.js';
import streamRouter from '../routes/stream.js';

// QUEUE & WEBHOOKS
import { handleQStashWebhook } from '../lib/infrastructure/queueManager.js';

const app = express();

// ─── SECURITY ─────────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    'http://localhost:3001',
    'http://localhost:5173',
    ...(config.FRONTEND_URL ? [config.FRONTEND_URL] : []),
    ...(config.FRONTEND_URL_PREVIEW ? [config.FRONTEND_URL_PREVIEW] : []),
    ...(config.VERCEL_FRONTEND_URL ? [config.VERCEL_FRONTEND_URL] : []),
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            if (config.IS_PROD) {
                return callback(new Error('CORS: Origin header required'));
            }
            return callback(null, true);
        }
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('CORS: Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────
app.use(scalingMiddleware); // Track performance metrics FIRST
app.use(securityHeadersMiddleware);
app.use(cspHeadersMiddleware); // Content Security Policy
app.use(auditContextMiddleware);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        env: config.NODE_ENV,
        version: '1.0.0',
        scaling: scalingMonitor.getMetrics(),
        recommendations: getScalingRecommendations()
    });
});

// ─── ROOT ─────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
    res.json({
        name: 'Lyra Brain API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            docs: '/docs.json',
            auth: '/auth',
            chat: '/chat',
            sessions: '/sessions'
        }
    });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────
// CSP Violation Reporter
app.post('/csp-violation', cspViolationHandler);

// ─── WEBHOOKS (QStash) ─────────────────────────────────────────────────────
// Background job callback endpoint
app.post('/api/webhooks/qstash', handleQStashWebhook);

app.use('/auth', authRouter);
app.use('/', userRouter);
app.use('/', sessionRouter);
app.use('/', chatRouter);
app.use('/', knowledgeRouter);
app.use('/', analysisRouter);
app.use('/', therapyRouter);
app.use('/', characterRouter);
app.use('/admin', adminRouter);
app.use('/stream', streamRouter);

// ─── 404 HANDLER ──────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ─── SENTRY ERROR HANDLER (must be after all other middleware/routes) ─────
app.use(sentryErrorMiddleware);

// ─── ERROR HANDLER (Express default) ──────────────────────────────────────
app.use((err, req, res, next) => {
    logger.error('[API Error]', {
        message: err.message,
        path: req.path,
        method: req.method,
        sentryEventId: err.sentryEventId
    });

    res.status(err.status || 500).json({
        error: config.IS_PROD ? 'Internal server error' : err.message,
        requestId: err.sentryEventId // Include for debugging
    });
});

export default app;
