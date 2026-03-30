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
import { IntakeAgent } from '../src/application/agents/IntakeAgent.js';
import { generateComprehensiveProfile } from '../src/services/queue/profileSynthesisJob.js';

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
 * Helper: Queue profile synthesis job
 * Triggers async generation of comprehensive patient profile
 */
async function queueProfileSynthesis(userId, sessionId, intakeSummary) {
    try {
        // Run profile synthesis in background (non-blocking)
        generateComprehensiveProfile(userId, sessionId, intakeSummary)
            .then(() => {
                logger.info('[QUEUE] Profile synthesis completed', { userId, sessionId });
            })
            .catch(err => {
                logger.error('[QUEUE] Profile synthesis failed:', err.message);
            });

        return true;
    } catch (error) {
        logger.warn('[QUEUE] Profile synthesis queueing failed:', error.message);
        return false;
    }
}

/**
 * Helper: Check if this is user's first session
 * Returns true if session_count === 0 or is_first_session flag is set
 */
async function isFirstSession(userId) {
    try {
        // Check Supabase user_profile table
        const { data, error } = await supabase
            .from('user_profile')
            .select('session_count, is_first_session')
            .eq('user_id', userId)
            .single();

        if (error || !data) return true; // Assume first if no record exists

        // First session if count is 0 or flag is true
        return data.session_count === 0 || data.is_first_session === true;
    } catch (err) {
        logger.warn('[CHAT] First session check failed:', err.message);
        return true; // Default to first session
    }
}

/**
 * Helper: Update session counter in Supabase
 */
async function incrementSessionCount(userId) {
    try {
        const { data } = await supabase
            .from('user_profile')
            .select('session_count')
            .eq('user_id', userId)
            .single();

        const newCount = (data?.session_count || 0) + 1;

        await supabase
            .from('user_profile')
            .update({
                session_count: newCount,
                is_first_session: false,
                last_session_date: new Date().toISOString()
            })
            .eq('user_id', userId);

        logger.info('[CHAT] Session count incremented', { userId, newCount });
    } catch (err) {
        logger.warn('[CHAT] Session increment failed:', err.message);
    }
}

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

        // ── CHECK IF FIRST SESSION ──
        const firstSession = await isFirstSession(userId);
        let agent;

        if (firstSession) {
            // INTAKE SESSION MODE
            logger.info('[CHAT] Starting INTAKE SESSION', { userId, sessionId });
            agent = new IntakeAgent({
                userId,
                sessionId,
                model: 'claude-3-5-sonnet-20241022'
            });
        } else {
            // REGULAR THERAPIST SESSION MODE
            logger.info('[CHAT] Starting THERAPIST SESSION', { userId, sessionId });
            agent = new TherapistAgent({
                userId,
                sessionId,
                model: 'claude-3-5-sonnet-20241022'
            });
        }

        // ── SETUP REAL-TIME SSE STREAM ──
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        try {
            let totalTokens = '';
            let firstTokenTime = null;
            let tokenCount = 0;
            let intakeSummary = null;

            // ── REAL STREAMING: for await...of on async generator ──
            // CRITICAL: BOTH agents get FULL clinicalData context
            // Intake agent also needs somatic + safety data!
            for await (const event of agent.generateResponse(clinicalData)) {

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

                // Trigger profile synthesis when intake complete
                if (firstSession && event.type === 'complete' && event.isIntakeComplete) {
                    intakeSummary = agent.getIntakeSummary();
                    logger.info('[CHAT] INTAKE COMPLETE - Triggering profile synthesis', {
                        userId,
                        sessionId,
                        messageCount: intakeSummary.messageCount
                    });

                    // Queue profile synthesis job (runs in background)
                    // Will be picked up by queue processor and generate comprehensive profile
                    queueProfileSynthesis(userId, sessionId, intakeSummary).catch(err => {
                        logger.warn('[CHAT] Profile synthesis queue failed:', err.message);
                    });

                    // Increment session count after intake complete
                    await incrementSessionCount(userId);
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
