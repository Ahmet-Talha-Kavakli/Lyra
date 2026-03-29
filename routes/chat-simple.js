// routes/chat-simple.js
// TEMPORARY: Simple chat endpoint that works (replacing broken routes/chat.js)
// TODO: Merge with complex routes/chat.js when syntax error fixed

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
 * Vapi Custom LLM endpoint
 *
 * Quick Implementation:
 * 1. Accept messages array
 * 2. Build simple system prompt
 * 3. Call OpenAI
 * 4. Stream response
 * 5. Queue background jobs
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

        // Simple system prompt
        const systemPrompt = `You are Lyra, a compassionate AI therapist.
Respond warmly, empathetically, and provide actionable psychological support.
Respond in Turkish if the user writes in Turkish.`;

        // Call OpenAI
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

        logger.info('[CHAT] Response sent', { userId, contentLength: content.length });

        // Queue background jobs (fire and forget)
        if (userId) {
            const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n');
            const sessionId = `${userId}_${Date.now()}`;

            // These run in background, don't block response
            setImmediate(() => {
                try {
                    queueProfileUpdate(userId, transcript, null, null, null);
                    queueSessionAnalysis(userId, sessionId, transcript, null, null, null, null, null, null);
                    queueHomeworkGeneration(userId, sessionId, transcript, null, 'belirsiz', null);
                    logger.info('[QUEUE] Background jobs queued', { userId });
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
router.get('/v1/queue-status', (req, res) => {
    const { getQueueStatus } = require('../src/services/queue/analysisJobs.js');
    res.json(getQueueStatus());
});

export default router;
