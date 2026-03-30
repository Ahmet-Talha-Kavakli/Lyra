// routes/chat-simple.js
// Lyra Chat Endpoint with Psychology Integration
// AŞAMA 5: Psychology modules integrated
// - Dynamically select psychology modules based on conversation
// - Build enhanced system prompts using therapeutic approaches
// - Queue background analysis with psychology context

import express from 'express';
import { logger } from '../lib/infrastructure/logger.js';
import { supabase } from '../lib/shared/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import { validateRequest, chatCompletionSchema } from '../lib/infrastructure/validationSchemas.js';
import {
    getUserEmotion, setUserEmotion,
    getSessionTranscript, setSessionTranscript
} from '../src/services/cache/redisService.js';
import { TherapistAgent } from '../src/application/agents/TherapistAgent.js';

const router = express.Router();

const chatRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.userId || req.ip,
    handler: (req, res) => {
        logger.warn('Rate limit exceeded', { userId: req.userId });
        res.status(429).json({ error: 'Too many requests' });
    }
});

/**
 * POST /v1/api/chat/completions
 * Lyra's Omni-Modal Chat Endpoint
 *
 * Flow:
 * 1. Accept user message + optional somatic telemetry (facial + vocal)
 * 2. Retrieve patient's episodic memory (RAG)
 * 3. Use TherapistAgent (Claude 3.5 Sonnet) with full context
 * 4. Stream response via SSE
 */
router.post('/v1/api/chat/completions', chatRateLimit, validateRequest(chatCompletionSchema), async (req, res) => {
    try {
        // ✅ Request already validated by middleware
        const { messages, model, call } = req.validated;

        // Get userId and sessionId from request
        const userId = call?.metadata?.userId || call?.assistantOverrides?.variableValues?.userId;
        const sessionId = call?.metadata?.sessionId || `session_${Date.now()}`;

        // Optional: Somatic telemetry from frontend (facial + vocal)
        const somaticTelemetry = req.body.somaticTelemetry || null;

        logger.info('[CHAT] Omni-modal request received', {
            userId,
            sessionId,
            messageCount: messages.length,
            hasSomaticData: !!somaticTelemetry
        });

        // Initialize TherapistAgent with patient context
        const therapistAgent = new TherapistAgent({
            userId,
            sessionId,
            model: 'claude-3-5-sonnet-20241022'
        });

        // Get the last user message
        const userMessage = messages[messages.length - 1]?.content || '';

        // Prepare clinical data for TherapistAgent
        const clinicalData = {
            transcript: userMessage,
            somaticMarkers: somaticTelemetry?.somaticMarkers || {},
            congruenceAnalysis: somaticTelemetry?.congruenceAnalysis || {},
            temporalPatterns: somaticTelemetry?.temporalPatterns || {},
            emotionalState: somaticTelemetry?.emotionalState || {},
            autonomicState: somaticTelemetry?.autonomicState || {},
            recommendations: somaticTelemetry?.recommendations || {},
            baselineDeviation: somaticTelemetry?.baselineDeviation || {}
        };

        // Generate response with RAG + somatic context
        const therapistResponse = await therapistAgent.generateResponse(clinicalData);

        // Stream response via SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            // Send response in chunks
            const responseText = therapistResponse.response;
            const chunkSize = 20;

            for (let i = 0; i < responseText.length; i += chunkSize) {
                const chunk = responseText.substring(i, i + chunkSize);
                const sseChunk = {
                    id: `chatcmpl-${Date.now()}`,
                    object: 'text_completion.chunk',
                    created: Date.now(),
                    model: 'claude-3-5-sonnet-20241022',
                    choices: [{
                        index: 0,
                        delta: { content: chunk },
                        finish_reason: i + chunkSize >= responseText.length ? 'stop' : null
                    }]
                };

                res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
            }

            // Send finish message
            res.write(`data: [DONE]\n\n`);
            res.end();

            logger.info('[CHAT] Response streamed', {
                userId,
                sessionId,
                responseLength: responseText.length,
                similarMoments: therapistResponse.context.similarMoments,
                themes: therapistResponse.context.relevantThemes
            });
        } catch (streamErr) {
            logger.error('[CHAT] Stream error', { error: streamErr.message });
            res.write(`data: ${JSON.stringify({ error: streamErr.message })}\n\n`);
            res.end();
        }

    } catch (error) {
        logger.error('[CHAT] Error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
