/**
 * Lyra Background Worker
 *
 * Runs scheduled cron jobs and background tasks isolated from API server.
 * This separation ensures heavy background operations don't block API responses.
 *
 * Usage: node worker.js
 * Deploy: Separate container/pod from API (via docker-compose or k8s)
 */

import cron from 'node-cron';
import { config } from './lib/infrastructure/config.js';
import { logger } from './lib/infrastructure/logger.js';
import { cronManager } from './src/services/cron/cronManager.js';

// Import cron job handlers
import {
    autonomousSourceDiscovery,
    assessKnowledgeQuality,
    detectKnowledgeGaps,
    verifySourceCredibility
} from './lib/infrastructure/cronJobs.js';

logger.info('🔄 Lyra Worker started', {
    env: config.NODE_ENV,
    processId: process.pid
});

// Define all cron jobs
const cronJobs = [
    {
        schedule: '0 2 * * *',
        name: 'autonomousSourceDiscovery',
        handler: autonomousSourceDiscovery,
        desc: 'Günlük kaynak keşfi (02:00)'
    },
    {
        schedule: '0 3 * * 1',
        name: 'assessKnowledgeQuality',
        handler: assessKnowledgeQuality,
        desc: 'Haftalık kalite kontrolü (Pazartesi 03:00)'
    },
    {
        schedule: '0 2 * * 5',
        name: 'detectKnowledgeGaps',
        handler: detectKnowledgeGaps,
        desc: 'Bilgi boşluğu tespiti (Cuma 02:00)'
    },
    {
        schedule: '0 4 1 * *',
        name: 'verifySourceCredibility',
        handler: verifySourceCredibility,
        desc: 'Aylık güvenilirlik doğrulaması'
    },
];

// Schedule all cron jobs with Redis lock protection (multi-pod safe)
cronJobs.forEach(job => {
    try {
        cron.schedule(job.schedule, async () => {
            await cronManager.executeWithLock(job.name, job.handler);
        });
        logger.info('[CRON] Zamanlandı (lock protected)', {
            job: job.name,
            schedule: job.schedule,
            desc: job.desc
        });
    } catch (err) {
        logger.error('[CRON] Zamanlandırma hatası', {
            job: job.name,
            error: err.message
        });
    }
});

logger.info('[CRON] Tüm cron işleri Redis lock koruması ile başlatıldı', {
    totalJobs: cronJobs.length
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
    logger.info(`${signal} alındı — worker kapatılıyor`);
    process.exit(0);
}
