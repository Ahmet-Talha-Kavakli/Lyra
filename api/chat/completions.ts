import { logger } from '../../../lib/infrastructure/logger.js';
import { createAuthenticatedSupabaseClient } from '../../../lib/shared/supabaseAuth.js';
import { chatCompletionSchema } from '../../../lib/infrastructure/validationSchemas.js';
import { ZodError } from 'zod';
import { Redis } from '@upstash/redis';
import { TherapistAgent } from '../../../src/application/agents/TherapistAgent.js';
import { IntakeAgent } from '../../../src/application/agents/IntakeAgent.js';
import { queueJob, waitUntil } from '../../../lib/infrastructure/backgroundJobs.js';

// Serverless Upstash Redis Client
const redis = Redis.fromEnv();

// EDGE RUNTIME CONFIGURATION: Bypasses maximum duration limits
export const config = {
  runtime: 'edge', 
};

/**
 * PROFESYONEL MÜDAHALE: Veritabanı Darboğazı Çözümü
 */
async function isFirstSession(userId: string, supabaseClient: any) {
    try {
        const cacheKey = `lyra:user:${userId}:is_first_session`;
        const cached = await redis.get(cacheKey);

        if (cached !== null) {
            return cached === true || String(cached) === 'true';
        }

        const { data: result, error } = await supabaseClient
            .from('user_profile')
            .select('session_count, is_first_session')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        const isFirst = !result ? true : (result.session_count === 0 || result.is_first_session === true);
        await redis.set(cacheKey, isFirst, { ex: 3600 });
        return isFirst;
    } catch (err: any) {
        logger.warn('[CHAT] First session check failed:', err.message);
        return true;
    }
}

async function incrementSessionCount(userId: string, supabaseClient: any) {
    try {
        const { data: result, error: readError } = await supabaseClient
            .from('user_profile')
            .select('session_count')
            .eq('user_id', userId)
            .single();

        if (readError && readError.code !== 'PGRST116') throw readError;
        const newCount = (result?.session_count || 0) + 1;

        const { error: updateError } = await supabaseClient
            .from('user_profile')
            .update({
                session_count: newCount,
                is_first_session: false,
                last_session_date: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (updateError) throw updateError;
        await redis.del(`lyra:user:${userId}:is_first_session`);
    } catch (err: any) {
        logger.warn('[CHAT] Session increment failed:', err.message);
    }
}

async function getObjectContext(userId: string) {
    try {
        const objectData = await redis.get(`object_tracker:${userId}:current`);
        if (!objectData) return {};
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

async function getPhysicalHarmContext(userId: string) {
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

// Edge API Handler 
export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        // -------------------------------------------------------------------------------- //
        // CRITICAL SECURITY SHIELD: Extract & Validate HttpOnly Cookie
        // -------------------------------------------------------------------------------- //
        const cookieHeader = req.headers.get('cookie') || '';
        const tokenMatch = cookieHeader.match(/lyra_access_token=([^;]+)/);
        const accessToken = tokenMatch ? tokenMatch[1] : null;

        if (!accessToken) {
            logger.warn('[AUTH] Missing access token in chat endpoint');
            return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authentication Token' }), { status: 401 });
        }

        // Create authenticated Supabase client (enforces RLS)
        const supabaseAuthResult = await createAuthenticatedSupabaseClient({
            headers: req.headers,
            cookies: {
                get: (key: string) => {
                    const match = cookieHeader.match(new RegExp(`${key}=([^;]+)`));
                    return match ? { value: match[1] } : undefined;
                }
            }
        } as any);

        if (!supabaseAuthResult.client || !supabaseAuthResult.userId) {
            logger.warn('[AUTH] Invalid or expired access token');
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Token' }), { status: 401 });
        }

        // SECURE SOURCE: The userId is strictly determined by token verification
        const userId = supabaseAuthResult.userId;
        const supabaseClient = supabaseAuthResult.client;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CRITICAL SECURITY: Payload Validation Before Parsing
        // Prevents: OOM attacks, invalid data, unhandled payloads
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        let body: any;
        try {
          body = await req.json();
        } catch (parseError: any) {
          logger.error('[CHAT] JSON parse failed - malformed payload', {
            error: parseError.message
          });
          return new Response(
            JSON.stringify({
              error: 'Invalid request: malformed JSON',
              code: 'INVALID_JSON'
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // STRICT SCHEMA VALIDATION: safeParse() doesn't throw, returns result
        const validationResult = chatCompletionSchema.safeParse(body);

        if (!validationResult.success) {
          // Log validation errors (one per field)
          const errorDetails = validationResult.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }));

          logger.warn('[CHAT] Validation failed', {
            userId,
            fieldCount: errorDetails.length,
            firstError: errorDetails[0]
          });

          return new Response(
            JSON.stringify({
              error: 'Invalid request: schema validation failed',
              code: 'VALIDATION_ERROR',
              details: errorDetails.slice(0, 3) // Send first 3 errors only
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // SAFE EXTRACTION: Use validated data
        const { messages, call, somaticTelemetry } = validationResult.data;
        const sessionId = call?.metadata?.sessionId || `session_${Date.now()}`;
        const userMessage = messages[messages.length - 1]?.content || '';

        logger.info('[CHAT] Stream request validated & authorized', {
          userId,
          sessionId,
          messageCount: messages.length,
          hasSomaticData: !!somaticTelemetry
        });

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

        const firstSession = await isFirstSession(userId, supabaseClient);
        let agent;

        if (firstSession) {
            agent = new IntakeAgent({ userId, sessionId, model: 'gpt-4o-mini' });
        } else {
            agent = new TherapistAgent({ userId, sessionId, model: 'gpt-4o-mini' });
        }

        let tokenCount = 0;

        // Create Readable Stream for Edge Runtime
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                const write = (text: string) => controller.enqueue(encoder.encode(text));

                try {
                    for await (const event of agent.generateResponse(clinicalData)) {
                        if (event.type === 'token') {
                            tokenCount++;
                            const sseChunk = {
                                id: `chatcmpl-${Date.now()}-${tokenCount}`,
                                object: 'text_completion.chunk',
                                model: 'gpt-4o-mini',
                                choices: [{ delta: { content: event.content } }]
                            };
                            write(`data: ${JSON.stringify(sseChunk)}\n\n`);
                        }

                        if (event.type === 'complete') {
                            write(`data: [DONE]\n\n`);

                            if (firstSession && event.isIntakeComplete) {
                                // Background heavy processing (QStash)
                                waitUntil(
                                    Promise.all([
                                        queueJob('profile-synthesis', {
                                            userId,
                                            sessionId,
                                            intakeSummary: agent.getIntakeSummary ? agent.getIntakeSummary() : {}
                                        }).catch((e: any) => logger.error('[CHAT] Failed to queue', e)),
                                        incrementSessionCount(userId, supabaseClient).catch((e: any) => logger.error(e))
                                    ])
                                );
                            }
                        }
                    }
                    controller.close();
                } catch (streamErr: any) {
                    logger.error('[CHAT] Stream error:', streamErr);
                    write(`data: {"error": "${streamErr.message}"}\n\n`);
                    controller.close();
                }
            }
        });

        // SSE HEADERS FOR EDGE
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
            }
        });

    } catch (error: any) {
        logger.error('[CHAT] Request error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
