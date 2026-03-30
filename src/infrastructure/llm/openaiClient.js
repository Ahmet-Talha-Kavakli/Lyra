/**
 * OpenAI Client Wrapper
 * Centralized LLM access with error handling and logging
 */

import OpenAI from 'openai';
import { config } from '../config/config.js';
import { logger } from '../logging/logger.js';

class OpenAIClient {
    constructor() {
        this.client = new OpenAI({
            apiKey: config.OPENAI_API_KEY
        });
    }

    /**
     * Create chat completion (supports streaming)
     */
    async chat() {
        return this.client.chat.completions;
    }

    /**
     * Wrapper for error handling and logging
     */
    async createChatCompletion(params) {
        try {
            logger.debug('[OpenAI] Creating completion', {
                model: params.model,
                messages: params.messages?.length || 0
            });

            const response = await this.client.chat.completions.create(params);
            return response;
        } catch (error) {
            logger.error('[OpenAI] Completion failed', {
                error: error.message,
                status: error.status
            });
            throw error;
        }
    }
}

export const openai = new OpenAIClient();

export default OpenAIClient;
