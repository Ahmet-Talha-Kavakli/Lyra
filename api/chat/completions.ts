import { logger } from '../../../lib/infrastructure/logger.js';
import { supabase } from '../../../lib/shared/supabase.js';
import { validateRequest, chatCompletionSchema } from '../../../lib/infrastructure/validationSchemas.js';
// UPSTASH REDIS İLE DEĞİŞTİRİLDİ
import { Redis } from '@upstash/redis';
import { TherapistAgent } from '../../../src/application/agents/TherapistAgent.js';
import { IntakeAgent } from '../../../src/application/agents/IntakeAgent.js';
import { queueJob, waitUntil } from '../../../lib/infrastructure/backgroundJobs.js';

// Serverless Upstash Redis Client
const redis = Redis.fromEnv(); // Vercel Env variables kullanır (UPSTASH_REDIS_REST_URL vs)

// Edge Runtime konfigürasyonu (Vercel'de Timeout yememek için çok önemli!)
export const config = {
  maxDuration: 60, // Maximum execution time in Vercel Pro
};

/**
 * Yardımcı: Kullanıcının ilk seansı mı kontrol et
 */
async function isFirstSession(userId) {
    try {
        const { data: result, error } = await supabase
            .from('user_profile')
            .select('session_count, is_first_session')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (!result) return true;

        return result.session_count === 0 || result.is_first_session === true;
    } catch (err) {
        logger.warn('[CHAT] First session check failed:', err.message);
        return true;
    }
}

/**
 * Yardımcı: Seans sayacını güncelle (Vercel waitUntil içine alınacak)
 */
async function incrementSessionCount(userId) {
    try {
        const { data: result, error: readError } = await supabase
            .from('user_profile')
            .select('session_count')
            .eq('user_id', userId)
            .single();

        if (readError && readError.code !== 'PGRST116') throw readError;
        const newCount = (result?.session_count || 0) + 1;

        const { error: updateError } = await supabase
            .from('user_profile')
            .update({
                session_count: newCount,
                is_first_session: false,
                last_session_date: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (updateError) throw updateError;
        logger.info('[CHAT] Session count incremented', { userId, newCount });
    } catch (err) {
        logger.warn('[CHAT] Session increment failed:', err.message);
    }
}

async function getObjectContext(userId) {
    try {
        const objectData = await redis.get(`object_tracker:${userId}:current`);
        if (!objectData) return {};
        
        // Upstash Redis directly parses JSON if it is a JSON object.
        const parsed = typeof objectData === 'string' ? JSON.parse(objectData) : objectData;
        return {
            detected_objects: parsed.objects || [],
            threat_level: parsed.threat_level || 'low',
            safe: parsed.threat_level === 'low',
            timestamp: parsed.timestamp
        };
    } catch (error) {
        return {};
    }
}

async function getPhysicalHarmContext(userId) {
    try {
        const harmData = await redis.get(`physical_harm:${userId}:current`);
        if (!harmData) return {};

        const parsed = typeof harmData === 'string' ? JSON.parse(harmData) : harmData;
        return {
            indicators: parsed.indicators || [],
            has_prior_harm: parsed.has_prior_harm || false,
            recency: parsed.recency || null,
            severity: parsed.max_severity || 'unknown',
            timestamp: parsed.timestamp
        };
    } catch (error) {
        return {};
    }
}

export default async function handler(req, res) {
    // Sadece POST desteklenir
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Vercel Serverless'ta body otomatik parse edilir
        const body = req.body;
        
        // Validation (Manuel validation middleware yerine kod içi adaptasyon)
        // ... Normalde middleware vardı, burada basitleştirilmiş validasyon uyguluyoruz ...
        const messages = body.messages || [];
        const call = body.call || {};

        const userId = call?.metadata?.userId || call?.assistantOverrides?.variableValues?.userId || 'anonymous';
        const sessionId = call?.metadata?.sessionId || `session_${Date.now()}`;
        const somaticTelemetry = body.somaticTelemetry || null;
        const userMessage = messages[messages.length - 1]?.content || '';

        logger.info('[CHAT] Stream request', { userId, sessionId });

        const objectContext = await getObjectContext(userId);
        const physicalHarmContext = await getPhysicalHarmContext(userId);

        const clinicalData = {
            transcript: userMessage,
            somaticMarkers: somaticTelemetry?.somaticMarkers || {},
            congruenceAnalysis: somaticTelemetry?.congruenceAnalysis || {},
            temporalPatterns: somaticTelemetry?.temporalPatterns || {},
            emotionalState: somaticTelemetry?.emotionalState || {},
            autonomicState: somaticTelemetry?.autonomicState || {},
            recommendations: somaticTelemetry?.recommendations || {},
            baselineDeviation: somaticTelemetry?.baselineDeviation || {},
            objectContext,
            physicalHarmContext
        };

        const firstSession = await isFirstSession(userId);
        let agent;

        if (firstSession) {
            agent = new IntakeAgent({ userId, sessionId, model: 'gpt-4o-mini' });
        } else {
            agent = new TherapistAgent({ userId, sessionId, model: 'gpt-4o-mini' });
        }

        // SSE HEADERS İÇİN VERCEL STANDARTLARI
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        
        let totalTokens = '';
        let firstTokenTime = null;
        let tokenCount = 0;

        try {
            for await (const event of agent.generateResponse(clinicalData)) {
                if (firstTokenTime === null && event.type === 'token') {
                    firstTokenTime = Date.now();
                }

                if (event.type === 'token') {
                    totalTokens += event.content;
                    tokenCount++;

                    const sseChunk = {
                        id: `chatcmpl-${Date.now()}-${tokenCount}`,
                        object: 'text_completion.chunk',
                        model: 'gpt-4o-mini',
                        choices: [{ delta: { content: event.content } }]
                    };
                    res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
                }

                if (event.type === 'complete') {
                    res.write(`data: [DONE]\n\n`);
                    
                    if (firstSession && event.isIntakeComplete) {
                        const intakeSummary = agent.getIntakeSummary();
                        
                        // ÖLÜMCÜL HATA DÜZELTİLDİ: Ağır AI işlemleri webhook ile asenkron yapılmalıdır (QStash).
                        waitUntil(
                            Promise.all([
                                queueJob('profile-synthesis', {
                                    userId,
                                    sessionId,
                                    intakeSummary
                                }).catch((e: any) => logger.error('[CHAT] Failed to queue profile synthesis', e)),
                                incrementSessionCount(userId).catch((e: any) => logger.error(e))
                            ])
                        );
                    }
                }
            }
            res.end();
            return;
        } catch (streamErr) {
            logger.error('[CHAT] Stream error:', streamErr);
            res.write(`data: {"error": "${streamErr.message}"}\n\n`);
            res.end();
            return;
        }

    } catch (error) {
        logger.error('[CHAT] Request error:', error);
        return res.status(500).json({ error: error.message });
    }
}
