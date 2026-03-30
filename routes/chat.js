/**
 * routes/chat.js - Lyra's Omni-Modal Chat Endpoint
 *
 * REAL STREAMING: TherapistAgent yields tokens as they arrive from Claude
 * CONTEXT INJECTION: ObjectTracker + PhysicalHarmTracker data from Redis
 *
 * Flow:
 * 1. Accept user message + somatic telemetry (facial + vocal)
 * 2. Fetch from Redis: Real-time object detection + physical harm indicators
 * 3. Initialize TherapistAgent with full context (somatic + memory + environment + safety)
 * 4. Use async generator to stream tokens as they arrive (REAL TTF=~200ms, not 5s)
 * 5. Send each token via SSE immediately (typewriter effect)
 */

import express from 'express';
import { logger } from '../lib/infrastructure/logger.js';
import { supabase } from '../lib/shared/supabase.js';
import { rateLimit } from 'express-rate-limit';
import { validateRequest, chatCompletionSchema } from '../lib/infrastructure/validationSchemas.js';
import { getRedisClient } from '../lib/shared/redis.js';
import { TherapistAgent } from '../src/application/agents/TherapistAgent.js';

const router = express.Router();
const redis = await getRedisClient();

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
 * Helper: Fetch object context from Redis (ObjectTracker)
 * Checks if dangerous objects are present in patient's environment
 */
async function getObjectContext(userId) {
    try {
        const objectKey = `object_tracker:${userId}:current`;
        const objectData = await redis.get(objectKey);
        if (!objectData) return {};

        const parsed = JSON.parse(objectData);
        return {
            detected_objects: parsed.objects || [],
            threat_level: parsed.threat_level || 'low',
            safe: parsed.threat_level === 'low',
            timestamp: parsed.timestamp
        };
    } catch (error) {
        logger.warn('[CHAT] Object context fetch failed:', error.message);
        return {};
    }
}

/**
 * Helper: Fetch physical harm context from Redis (PhysicalHarmTracker)
 * Checks for visible injuries, bruises, signs of trauma
 */
async function getPhysicalHarmContext(userId) {
    try {
        const harmKey = `physical_harm:${userId}:current`;
        const harmData = await redis.get(harmKey);
        if (!harmData) return {};

        const parsed = JSON.parse(harmData);
        return {
            indicators: parsed.indicators || [],
            has_prior_harm: parsed.has_prior_harm || false,
            recency: parsed.recency || null,
            severity: parsed.max_severity || 'unknown',
            timestamp: parsed.timestamp
        };
    } catch (error) {
        logger.warn('[CHAT] Physical harm context fetch failed:', error.message);
        return {};
    }
}

/**
 * POST /v1/api/chat/completions
 * Real-time streaming therapeutic chat with full environmental context
 */
router.post('/v1/api/chat/completions', chatRateLimit, validateRequest(chatCompletionSchema), async (req, res) => {
    try {
        // ✅ Request validated
        const { messages, model, call } = req.validated;

        // User identification
        const userId = call?.metadata?.userId || call?.assistantOverrides?.variableValues?.userId;
        const sessionId = call?.metadata?.sessionId || `session_${Date.now()}`;

        // Somatic telemetry from frontend
        const somaticTelemetry = req.body.somaticTelemetry || null;

        // Get the latest user message
        const userMessage = messages[messages.length - 1]?.content || '';

        logger.info('[CHAT] Stream request', {
            userId,
            sessionId,
            hasSomaticData: !!somaticTelemetry
        });

        // ── FETCH REAL-TIME SAFETY CONTEXT ──
        const objectContext = await getObjectContext(userId);
        const physicalHarmContext = await getPhysicalHarmContext(userId);

        logger.info('[CHAT] Context fetched', {
            hasObjects: objectContext.detected_objects?.length > 0,
            hasHarmIndicators: physicalHarmContext.indicators?.length > 0,
            threatLevel: objectContext.threat_level
        });

        // ── PREPARE FULL CLINICAL DATA ──
        const clinicalData = {
            transcript: userMessage,
            somaticMarkers: somaticTelemetry?.somaticMarkers || {},
            congruenceAnalysis: somaticTelemetry?.congruenceAnalysis || {},
            temporalPatterns: somaticTelemetry?.temporalPatterns || {},
            emotionalState: somaticTelemetry?.emotionalState || {},
            autonomicState: somaticTelemetry?.autonomicState || {},
            recommendations: somaticTelemetry?.recommendations || {},
            baselineDeviation: somaticTelemetry?.baselineDeviation || {},
            // SAFETY CONTEXT (from Redis)
            objectContext,
            physicalHarmContext
        };

        // ── INITIALIZE THERAPIST AGENT ──
        const therapistAgent = new TherapistAgent({
            userId,
            sessionId,
            model: 'claude-3-5-sonnet-20241022'
        });

        // ── SETUP REAL-TIME SSE STREAM ──
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        try {
            let totalTokens = '';
            let firstTokenTime = null;
            let tokenCount = 0;

            // ── REAL STREAMING: for await...of on async generator ──
            for await (const event of therapistAgent.generateResponse(clinicalData)) {

                // Record first token arrival time (TTFB)
                if (firstTokenTime === null && event.type === 'token') {
                    firstTokenTime = Date.now();
                }

                // Stream individual tokens as they arrive
                if (event.type === 'token') {
                    totalTokens += event.content;
                    tokenCount++;

                    // Send token immediately via SSE
                    const sseChunk = {
                        id: `chatcmpl-${Date.now()}-${tokenCount}`,
                        object: 'text_completion.chunk',
                        created: Date.now(),
                        model: 'claude-3-5-sonnet-20241022',
                        choices: [{
                            index: 0,
                            delta: { content: event.content },
                            finish_reason: null
                        }]
                    };

                    res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
                }

                // Stream final metadata when complete
                if (event.type === 'complete') {
                    const finalChunk = {
                        id: `chatcmpl-${Date.now()}-complete`,
                        object: 'text_completion.chunk',
                        created: Date.now(),
                        model: 'claude-3-5-sonnet-20241022',
                        choices: [{
                            index: 0,
                            delta: {},
                            finish_reason: 'stop'
                        }],
                        _metadata: {
                            totalTokens: tokenCount,
                            ttfbMs: firstTokenTime ? Date.now() - firstTokenTime : 0,
                            context: event.context,
                            usage: event.usage
                        }
                    };

                    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
                }

                // Handle errors
                if (event.type === 'error') {
                    const errorChunk = {
                        id: `error-${Date.now()}`,
                        error: event.error
                    };
                    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
                }
            }

            // Send stream completion marker
            res.write(`data: [DONE]\n\n`);
            res.end();

            logger.info('[CHAT] Stream complete', {
                userId,
                sessionId,
                totalTokens: tokenCount,
                ttfbMs: firstTokenTime ? Date.now() - firstTokenTime : 0,
                contentLength: totalTokens.length
            });

        } catch (streamErr) {
            logger.error('[CHAT] Stream error:', streamErr);
            const errorMsg = {
                error: streamErr.message,
                type: 'stream_error'
            };
            res.write(`data: ${JSON.stringify(errorMsg)}\n\n`);
            res.end();
        }

    } catch (error) {
        logger.error('[CHAT] Request error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
