/**
 * Circuit Breaker Tests
 * Unit tests for resilience pattern
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../../lib/infrastructure/circuitBreaker.js';

describe('CircuitBreaker', () => {
    let breaker;

    beforeEach(() => {
        breaker = new CircuitBreaker({
            name: 'test-breaker',
            failureThreshold: 3,
            timeout: 1000
        });
    });

    describe('CLOSED state (normal operation)', () => {
        it('should execute requests successfully', async () => {
            const fn = vi.fn().mockResolvedValue('success');
            const result = await breaker.execute(fn);

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalled();
        });

        it('should track failures', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('fail'));

            for (let i = 0; i < 2; i++) {
                try {
                    await breaker.execute(fn);
                } catch (e) {
                    // Expected
                }
            }

            expect(breaker.failureCount).toBe(2);
            expect(breaker.state).toBe('CLOSED');
        });

        it('should transition to OPEN after threshold', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('fail'));

            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute(fn);
                } catch (e) {
                    // Expected
                }
            }

            expect(breaker.state).toBe('OPEN');
        });
    });

    describe('OPEN state (circuit broken)', () => {
        beforeEach(async () => {
            const fn = vi.fn().mockRejectedValue(new Error('fail'));
            for (let i = 0; i < 3; i++) {
                try {
                    await breaker.execute(fn);
                } catch (e) {}
            }
            // Now in OPEN state
        });

        it('should reject requests immediately', async () => {
            const fn = vi.fn();

            try {
                await breaker.execute(fn);
                expect.fail('should have thrown');
            } catch (e) {
                expect(e.message).toContain('circuit breaker is OPEN');
                expect(fn).not.toHaveBeenCalled();
            }
        });

        it('should use fallback if provided', async () => {
            breaker = new CircuitBreaker({
                name: 'test',
                failureThreshold: 1,
                timeout: 1000,
                fallback: () => 'fallback-response'
            });

            // Open circuit
            try {
                await breaker.execute(() => Promise.reject(new Error('fail')));
            } catch (e) {}

            const result = await breaker.execute(() => Promise.reject(new Error('fail')));
            expect(result).toBe('fallback-response');
        });
    });

    describe('HALF_OPEN state (recovery testing)', () => {
        it('should transition to HALF_OPEN after timeout', async () => {
            // Open circuit first
            try {
                await breaker.execute(() => Promise.reject(new Error('fail')));
            } catch (e) {}

            expect(breaker.state).toBe('OPEN');

            // Wait for timeout (1s)
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Next execution should transition to HALF_OPEN
            const fn = vi.fn().mockResolvedValue('success');

            const result = await breaker.execute(fn);

            expect(breaker.state).toBe('CLOSED');
            expect(result).toBe('success');
        });
    });

    describe('Fallback behavior', () => {
        it('should call fallback when circuit OPEN', async () => {
            const fallback = vi.fn().mockReturnValue('fallback');
            breaker = new CircuitBreaker({
                name: 'test',
                failureThreshold: 1,
                fallback
            });

            // Open circuit
            try {
                await breaker.execute(() => Promise.reject(new Error('fail')));
            } catch (e) {}

            expect(breaker.state).toBe('OPEN');

            // Execute with circuit OPEN
            const result = await breaker.execute(() => {
                throw new Error('should not execute');
            });

            expect(result).toBe('fallback');
            expect(fallback).toHaveBeenCalled();
        });
    });

    describe('Metrics', () => {
        it('should track metrics correctly', () => {
            breaker.recordFailure(new Error('test'));

            const status = breaker.getStatus();

            expect(status.name).toBe('test-breaker');
            expect(status.failureCount).toBe(1);
            expect(status.state).toBe('CLOSED');
        });
    });
});
