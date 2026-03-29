// routes/chat-simple.js
// Lyra Chat Endpoint with Psychology Integration
// AŞAMA 5: Psychology modules integrated
// - Dynamically select psychology modules based on conversation
// - Build enhanced system prompts using therapeutic approaches
// - Queue background analysis with psychology context

import express from 'express';
import { logger } from '../lib/logger.js';
import { openai } from '../lib/openai.js';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import {
    getUserEmotion, setUserEmotion,
    getSessionTranscript, setSessionTranscript
} from '../src/services/cache/redisService.js';
import {
    queueProfileUpdate, queueSessionAnalysis, queueHomeworkGeneration
} from '../src/services/queue/analysisJobs.js';
import {
    selectPsychologyModules,
    buildEnhancedSystemPrompt,
    extractPsychologyInsights,
    formatPsychologyContext
} from '../src/services/psychology/psychologyIntegration.js';

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
 * Vapi Custom LLM endpoint with Psychology Integration
 *
 * Flow:
 * 1. Accept messages array
 * 2. Select relevant psychology modules based on conversation
 * 3. Build enhanced system prompt using therapeutic approaches
 * 4. Call OpenAI with psychology-informed context
 * 5. Stream response via SSE
 * 6. Queue background analysis jobs with psychology insights
 */
router.post('/v1/api/chat/completions', chatRateLimit, async (req, res) => {
    try {
        const { messages, model, call } = req.body;

        if (!messages || messages.length === 0) {
            return res.status(400).json({ error: 'No messages provided' });
        }

        // Get userId from call metadata or request
        const userId = call?.metadata?.userId || call?.assistantOverrides?.variableValues?.userId;

        logger.info('[CHAT] Request received', {
            userId,
            messageCount: messages.length,
            model: model || 'gpt-4o-mini'
        });

        // AŞAMA 5: Select psychology modules based on conversation context
        const selectedModules = selectPsychologyModules(messages);
        logger.info('[PSYCHOLOGY] Modules selected', {
            userId,
            modules: selectedModules
        });

        // Build enhanced system prompt using selected psychology modules
        const systemPrompt = buildEnhancedSystemPrompt(selectedModules);

        // Call OpenAI with psychology-informed context
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const openaiResponse = await openai.chat.completions.create({
            model: model || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages
            ],
            max_tokens: 1000,
            temperature: 0.7,
            stream: false // Buffer full response, then send as single SSE chunk
        });

        const content = openaiResponse.choices[0]?.message?.content || '';

        // Extract psychology insights from response for job tracking
        const psychologyInsights = extractPsychologyInsights(content, selectedModules);

        // Send as SSE
        const chunk = {
            id: `chatcmpl-${Date.now()}`,
            object: 'text_completion.chunk',
            created: Date.now(),
            model: openaiResponse.model,
            choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }]
        };

        const finishChunk = {
            ...chunk,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
        };

        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        res.write(`data: ${JSON.stringify(finishChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();

        logger.info('[CHAT] Response sent', {
            userId,
            contentLength: content.length,
            psychologyInsights: psychologyInsights.intervention_type
        });

        // Queue background jobs with psychology context (fire and forget)
        if (userId) {
            const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n');
            const sessionId = `${userId}_${Date.now()}`;
            const psychologyContext = formatPsychologyContext(selectedModules, psychologyInsights);

            // These run in background, don't block response
            setImmediate(() => {
                try {
                    queueProfileUpdate(userId, transcript, psychologyContext, null, null);
                    queueSessionAnalysis(userId, sessionId, transcript, psychologyContext, null, null, null, null, null);
                    queueHomeworkGeneration(userId, sessionId, transcript, psychologyContext, 'belirsiz', null);
                    logger.info('[QUEUE] Background jobs queued with psychology context', {
                        userId,
                        modules: selectedModules
                    });
                } catch (qErr) {
                    logger.warn('[QUEUE] Error queueing jobs', { error: qErr.message });
                }
            });
        }

    } catch (error) {
        logger.error('[CHAT] Error', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /v1/queue-status
 * Monitor job queue
 */
router.get('/v1/queue-status', async (req, res) => {
    try {
        // Dynamic import for queue status (ESM compatible)
        const { getQueueStatus } = await import('../src/services/queue/analysisJobs.js');
        const status = getQueueStatus();
        res.json(status);
    } catch (err) {
        logger.error('[QUEUE STATUS] Error', { error: err.message });
        res.status(500).json({ error: 'Queue status unavailable' });
    }
});

export default router;
