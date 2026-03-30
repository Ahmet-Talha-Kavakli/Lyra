/**
 * Message Queue for Therapy Chat
 * Decouples real-time chat from background processing
 *
 * Handles:
 * - Chat message processing
 * - Safety checks
 * - Session persistence
 * - Async LLM calls
 */

import Queue from 'bull';
import { config } from './config.js';
import { logger } from './logging/logger.js';

// Redis-backed queue for scalability
const messageQueue = new Queue('therapy-messages', {
    redis: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    }
});

// Process chat messages
messageQueue.process(async (job) => {
    try {
        const { userId, sessionId, message, selectedModules } = job.data;

        logger.info('[MessageQueue] Processing', {
            jobId: job.id,
            userId,
            sessionId
        });

        // TODO: Integrate with TherapistAgent for actual response generation
        // For now: placeholder

        return {
            success: true,
            processedAt: new Date()
        };
    } catch (error) {
        logger.error('[MessageQueue] Job failed', {
            jobId: job.id,
            error: error.message
        });
        throw error;
    }
});

// Event handlers
messageQueue.on('completed', (job) => {
    logger.info('[MessageQueue] Job completed', {
        jobId: job.id,
        duration: job.progress()
    });
});

messageQueue.on('failed', (job, err) => {
    logger.error('[MessageQueue] Job permanently failed', {
        jobId: job.id,
        attempts: job.attemptsMade,
        error: err.message
    });
});

// Queue stats
export function getQueueStats() {
    return Promise.all([
        messageQueue.getActiveCount(),
        messageQueue.getDelayedCount(),
        messageQueue.getWaitingCount(),
        messageQueue.getFailedCount()
    ]).then(([active, delayed, waiting, failed]) => ({
        active,
        delayed,
        waiting,
        failed,
        total: active + delayed + waiting + failed
    }));
}

export { messageQueue };
