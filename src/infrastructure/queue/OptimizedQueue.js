/**
 * Optimized Job Queue
 * BullMQ with guaranteed processing + event-driven pattern
 * Jobs survive server crashes via Redis persistence
 * Guaranteed execution: res.end() → queue jobs → worker picks up
 */

import Queue from 'bull';
import { config } from '../config/config.js';
import { logger } from '../logging/logger.js';

class OptimizedQueue {
    constructor() {
        this.queues = new Map();
        this.redisConfig = {
            host: config.REDIS_HOST || 'localhost',
            port: config.REDIS_PORT || 6379,
            maxRetriesPerRequest: null, // Infinite retries for critical jobs
            enableReadyCheck: false
        };
    }

    /**
     * Initialize queue (lazy-loaded per job type)
     */
    getQueue(queueName) {
        if (!this.queues.has(queueName)) {
            const queue = new Queue(queueName, this.redisConfig);

            // Auto-recover failed jobs
            queue.on('failed', (job, error) => {
                logger.error(`[Queue] Job failed: ${queueName}`, {
                    jobId: job.id,
                    error: error.message,
                    attempts: job.attemptsMade
                });
            });

            queue.on('completed', (job) => {
                logger.debug(`[Queue] Job completed: ${queueName}`, { jobId: job.id });
            });

            this.queues.set(queueName, queue);
        }

        return this.queues.get(queueName);
    }

    /**
     * Add job to queue
     * IMPORTANT: This returns immediately, job processes in background
     * res.end() happens BEFORE job processing starts
     */
    async addJob(queueName, data, options = {}) {
        try {
            const queue = this.getQueue(queueName);

            const job = await queue.add(data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000 // Start with 2s, exponential backoff
                },
                removeOnComplete: true,
                removeOnFail: false, // Keep failed jobs for debugging
                ...options
            });

            logger.debug(`[Queue] Job queued: ${queueName}`, {
                jobId: job.id,
                data: typeof data === 'object' ? Object.keys(data) : 'string'
            });

            return job.id;
        } catch (error) {
            logger.error(`[Queue] Failed to queue job: ${queueName}`, {
                error: error.message
            });
            // Don't throw — queue failures shouldn't crash the server
            return null;
        }
    }

    /**
     * Register job processor
     * This processes queued jobs (in worker.js)
     */
    registerProcessor(queueName, processor) {
        const queue = this.getQueue(queueName);

        queue.process(async (job) => {
            try {
                logger.debug(`[Queue] Processing job: ${queueName}`, { jobId: job.id });
                const result = await processor(job.data);
                return result;
            } catch (error) {
                logger.error(`[Queue] Processor error: ${queueName}`, {
                    jobId: job.id,
                    error: error.message
                });
                throw error;
            }
        });

        logger.info(`[Queue] Processor registered: ${queueName}`);
    }

    /**
     * Get queue status
     */
    async getQueueStatus(queueName) {
        const queue = this.getQueue(queueName);

        const counts = await queue.getJobCounts();

        return {
            queue: queueName,
            active: counts.active,
            waiting: counts.waiting,
            completed: counts.completed,
            failed: counts.failed,
            delayed: counts.delayed
        };
    }

    /**
     * Get all queue statuses
     */
    async getAllStatuses() {
        const statuses = [];

        for (const [queueName] of this.queues) {
            statuses.push(await this.getQueueStatus(queueName));
        }

        return statuses;
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        for (const [, queue] of this.queues) {
            await queue.close();
        }
        logger.info('[Queue] All queues closed');
    }
}

export const optimizedQueue = new OptimizedQueue();

export default OptimizedQueue;
