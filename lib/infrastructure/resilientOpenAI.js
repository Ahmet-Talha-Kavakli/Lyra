/**
 * Resilient OpenAI Client Wrapper
 * Implements:
 * - Circuit breaker protection
 * - Automatic retry with exponential backoff
 * - Timeout handling
 * - Cost monitoring
 */

import { OpenAI } from 'openai';
import { circuitBreakers } from './circuitBreaker.js';
import { logger } from './logging/logger.js';
import { config } from './config.js';

class ResilientOpenAI {
    constructor() {
        this.client = new OpenAI({
            apiKey: config.OPENAI_API_KEY,
            defaultHeaders: {
                'User-Agent': 'Lyra/1.0'
            }
        });

        this.tokenUsage = {
            total: 0,
            prompt: 0,
            completion: 0,
            costUSD: 0
        };
    }

    /**
     * Pricing (as of March 2026 — update as needed)
     * gpt-4o-mini: $0.15/1M input, $0.60/1M output
     */
    calculateCost(usage) {
        const inputCost = (usage.prompt_tokens / 1_000_000) * 0.00015;
        const outputCost = (usage.completion_tokens / 1_000_000) * 0.00060;
        return inputCost + outputCost;
    }

    /**
     * Create chat completion with resilience
     */
    async createChatCompletion(messages, options = {}) {
        const maxRetries = 3;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Execute with circuit breaker
                return await circuitBreakers.openai.execute(async () => {
                    const response = await this.client.chat.completions.create({
                        model: config.OPENAI_MODEL,
                        messages,
                        temperature: options.temperature || 0.7,
                        max_tokens: options.maxTokens || 500,
                        timeout: 30000, // 30s timeout
                        ...options
                    });

                    // Track token usage
                    if (response.usage) {
                        const cost = this.calculateCost(response.usage);
                        this.tokenUsage.total += response.usage.total_tokens;
                        this.tokenUsage.prompt += response.usage.prompt_tokens;
                        this.tokenUsage.completion += response.usage.completion_tokens;
                        this.tokenUsage.costUSD += cost;

                        logger.debug('[OpenAI] Tokens used', {
                            tokens: response.usage.total_tokens,
                            cost: cost.toFixed(4),
                            totalCost: this.tokenUsage.costUSD.toFixed(2)
                        });
                    }

                    return response;
                });
            } catch (error) {
                lastError = error;

                // Exponential backoff: 1s, 2s, 4s
                const backoffMs = Math.pow(2, attempt - 1) * 1000;

                if (attempt < maxRetries) {
                    logger.warn('[OpenAI] Request failed, retrying...', {
                        attempt,
                        maxRetries,
                        error: error.message,
                        backoffMs
                    });

                    // Don't retry on certain errors
                    if (error.code === 'invalid_request_error' || error.code === 'authentication_error') {
                        throw error;
                    }

                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                } else {
                    logger.error('[OpenAI] Request failed after retries', {
                        maxRetries,
                        error: error.message
                    });
                }
            }
        }

        throw lastError;
    }

    /**
     * Stream chat completion (for real-time responses)
     */
    async streamChatCompletion(messages, options = {}) {
        return circuitBreakers.openai.execute(async () => {
            return this.client.chat.completions.create({
                model: config.OPENAI_MODEL,
                messages,
                stream: true,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 500,
                ...options
            });
        });
    }

    /**
     * Get usage statistics
     */
    getStats() {
        return {
            ...this.tokenUsage,
            averageCostPerRequest: this.tokenUsage.costUSD / Math.max(1, Math.ceil(this.tokenUsage.total / 100))
        };
    }

    /**
     * Reset usage (daily/monthly)
     */
    resetStats() {
        this.tokenUsage = {
            total: 0,
            prompt: 0,
            completion: 0,
            costUSD: 0
        };
    }
}

export const openaiClient = new ResilientOpenAI();
