// [JOB QUEUE — In-Memory Event-Driven Task Queue]
// Moves 30+ sequential analyses to background jobs
// Simple, no Redis dependency, suitable for single-instance prod

import { logger } from '../logging/logger.js';

class JobQueue {
    constructor() {
        this.queue = [];
        this.processing = new Set();
        this.maxConcurrent = 5;
    }

    // Add job to queue
    async enqueue(job) {
        this.queue.push(job);
        this.process();
        return job.id;
    }

    // Process jobs concurrently
    async process() {
        while (this.queue.length > 0 && this.processing.size < this.maxConcurrent) {
            const job = this.queue.shift();
            this.processing.add(job.id);

            setImmediate(async () => {
                try {
                    await job.handler();
                    logger.info('[JobQueue] ✅ Job complete', { jobId: job.id, type: job.type });
                } catch (err) {
                    logger.error('[JobQueue] ❌ Job failed', { jobId: job.id, type: job.type, error: err.message });
                }
                this.processing.delete(job.id);
                this.process();
            });
        }
    }

    // Get queue status
    getStatus() {
        return {
            pending: this.queue.length,
            processing: this.processing.size,
            total: this.queue.length + this.processing.size
        };
    }
}

export const jobQueue = new JobQueue();
