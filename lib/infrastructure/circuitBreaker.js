/**
 * Circuit Breaker Pattern
 * Prevents cascading failures when external services (OpenAI, Supabase) go down
 *
 * States:
 * - CLOSED: Normal operation (requests pass through)
 * - OPEN: Service failing (requests rejected immediately)
 * - HALF_OPEN: Testing if service recovered (limited requests allowed)
 */

import { logger } from './logging/logger.js';

export class CircuitBreaker {
    constructor(options = {}) {
        this.name = options.name || 'CircuitBreaker';
        this.failureThreshold = options.failureThreshold || 5; // Failures before OPEN
        this.successThreshold = options.successThreshold || 2; // Successes to close from HALF_OPEN
        this.timeout = options.timeout || 60000; // 60s before retry (OPEN → HALF_OPEN)
        this.fallback = options.fallback || null; // Fallback function

        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
    }

    /**
     * Execute request with circuit breaker protection
     */
    async execute(fn) {
        // If OPEN and timeout not elapsed, reject immediately
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttemptTime) {
                logger.warn(`[${this.name}] Circuit OPEN — rejecting request`, {
                    state: this.state,
                    nextAttempt: new Date(this.nextAttemptTime)
                });

                if (this.fallback) {
                    return this.fallback();
                }

                throw new Error(`${this.name} circuit breaker is OPEN`);
            }

            // Timeout elapsed — try HALF_OPEN
            this.state = 'HALF_OPEN';
            this.successCount = 0;
            logger.info(`[${this.name}] Circuit HALF_OPEN — testing recovery`);
        }

        try {
            const result = await fn();

            // Success
            if (this.state === 'HALF_OPEN') {
                this.successCount++;
                logger.debug(`[${this.name}] HALF_OPEN success`, { successCount: this.successCount });

                if (this.successCount >= this.successThreshold) {
                    this.close();
                }
            } else if (this.state === 'CLOSED') {
                this.failureCount = 0; // Reset on success
            }

            return result;
        } catch (error) {
            this.recordFailure(error);

            // If HALF_OPEN failure, go back to OPEN
            if (this.state === 'HALF_OPEN') {
                this.open();
            }

            // Use fallback if available, otherwise propagate error
            if (this.fallback) {
                logger.warn(`[${this.name}] Using fallback`, { error: error.message });
                return this.fallback();
            }

            throw error;
        }
    }

    recordFailure(error) {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        logger.warn(`[${this.name}] Failure recorded`, {
            failureCount: this.failureCount,
            threshold: this.failureThreshold,
            error: error.message
        });

        if (this.failureCount >= this.failureThreshold && this.state === 'CLOSED') {
            this.open();
        }
    }

    open() {
        if (this.state !== 'OPEN') {
            this.state = 'OPEN';
            this.nextAttemptTime = Date.now() + this.timeout;

            logger.error(`[${this.name}] Circuit OPEN — stopping requests`, {
                willRetryAt: new Date(this.nextAttemptTime),
                failureCount: this.failureCount
            });
        }
    }

    close() {
        if (this.state !== 'CLOSED') {
            this.state = 'CLOSED';
            this.failureCount = 0;
            this.successCount = 0;

            logger.info(`[${this.name}] Circuit CLOSED — resuming normal operation`);
        }
    }

    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null
        };
    }
}

/**
 * Global circuit breakers for critical services
 */
export const circuitBreakers = {
    openai: new CircuitBreaker({
        name: 'OpenAI API',
        failureThreshold: 3,
        timeout: 30000, // 30s retry
        fallback: () => ({
            message: 'AI service temporarily unavailable. Please try again in a moment.',
            isCache: true,
            isFallback: true
        })
    }),

    supabase: new CircuitBreaker({
        name: 'Supabase Database',
        failureThreshold: 5,
        timeout: 60000, // 60s retry
        fallback: () => {
            throw new Error('Database service temporarily unavailable');
        }
    }),

    redis: new CircuitBreaker({
        name: 'Redis Cache',
        failureThreshold: 10,
        timeout: 30000,
        fallback: null // Redis failures don't need fallback (graceful degradation)
    })
};
