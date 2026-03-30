import { logger } from '../../lib/infrastructure/logger.js';
import { createAuthenticatedSupabaseClient } from '../../lib/shared/supabaseAuth.js';
import { chatCompletionSchema } from '../../lib/infrastructure/validationSchemas.js';
import { Redis } from '@upstash/redis';
import { waitUntil } from '../../lib/infrastructure/backgroundJobs.js';
import { IntakeAgent } from '../../src/application/agents/IntakeAgent.js';
import { TherapistAgent } from '../../src/application/agents/TherapistAgent.js';

const redis = Redis.fromEnv();

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

/**
 * LLM RETRY STRATEGY with Exponential Backoff
 *
 * CRITICAL FOR 100K CONCURRENT USERS:
 * When OpenAI/Anthropic returns 429 (rate limited) or 503 (overloaded),
 * we retry with exponential backoff instead of failing immediately.
 *
 * This prevents:
 * - Cascading failures when LLM API is temporarily overloaded
 * - User-visible errors during peak traffic periods
 * - Lost conversations due to transient API issues
 *
 * Max retry delay caps out at 10 seconds (Vercel Edge limit)
 */
interface LLMRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const defaultRetryConfig: LLMRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,      // Start with 500ms
  maxDelayMs: 10000,     // Cap at 10 seconds
  backoffMultiplier: 2,  // Double each retry
};

/**
 * Exponential backoff calculator
 * retry 1: 500ms
 * retry 2: 1000ms
 * retry 3: 2000ms (capped at maxDelayMs)
 */
function getBackoffDelay(retryCount: number, config: LLMRetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, retryCount - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Determine if an error is retryable
 *
 * Retryable errors:
 * - 429: Rate Limited (temporary quota issue)
 * - 503: Service Unavailable (temporary outage)
 * - 504: Gateway Timeout (transient network issue)
 * - Network errors (timeout, connection reset)
 *
 * Non-retryable:
 * - 400: Bad Request (client error, won't fix on retry)
 * - 401: Unauthorized (auth failure, won't fix on retry)
 * - 403: Forbidden (permission denied)
 * - 404: Not Found
 */
function isRetryableError(error: any): boolean {
  const status = error?.status;

  if (typeof status === 'number') {
    return status === 429 || status === 503 || status === 504;
  }

  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('socket hang up')
  );
}

/**
 * Retry LLM API call with exponential backoff
 *
 * Generic retry wrapper for any async LLM operation
 * Usage:
 *   const response = await retryWithBackoff(
 *     () => agent.generateResponse(clinicalData),
 *     defaultRetryConfig
 *   );
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: LLMRetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry if out of attempts
      if (attempt === config.maxRetries) {
        throw error;
      }

      // Calculate backoff and wait
      const delayMs = getBackoffDelay(attempt + 1, config);
      logger.warn('[LLM] Request failed, retrying with backoff', {
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        delayMs,
        status: error.status,
        message: error.message,
      });

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Helper: Check if first session (cached in Redis)
 */
async function isFirstSession(userId: string, supabaseClient: any): Promise<boolean> {
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
    logger.warn('[CHAT] First session check failed', { error: err.message });
    return true; // Assume first session on error (safer fallback)
  }
}

/**
 * Helper: Increment session count
 */
async function incrementSessionCount(userId: string, supabaseClient: any): Promise<void> {
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
        last_session_date: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;
    await redis.del(`lyra:user:${userId}:is_first_session`);
  } catch (err: any) {
    logger.warn('[CHAT] Session increment failed', { error: err.message });
    // Non-critical, don't throw
  }
}

/**
 * Build clinical data object from request
 * Includes somatic markers, object context, physical harm indicators
 */
function buildClinicalData(validatedData: any, somaticTelemetry?: any): any {
  const transcript = validatedData.messages[validatedData.messages.length - 1]?.content || '';

  return {
    transcript,
    somaticMarkers: somaticTelemetry?.somaticMarkers || {
      facialExpression: null,
      breathingPattern: null,
      voiceQuality: null,
      bodyTemperature: null,
      muscleTension: null,
    },
    objectContext: somaticTelemetry?.objectContext || {
      dangerousObjects: [],
      threat_level: 'none',
      safety_assessment: 'safe',
    },
    physicalHarmContext: somaticTelemetry?.physicalHarmContext || {
      indicators: [],
      self_harm_signs: false,
      trauma_visible: false,
    },
    congruenceAnalysis: somaticTelemetry?.congruenceAnalysis || {},
    temporalPatterns: somaticTelemetry?.temporalPatterns || {},
    emotionalState: somaticTelemetry?.emotionalState || {},
    autonomicState: somaticTelemetry?.autonomicState || {},
    recommendations: somaticTelemetry?.recommendations || [],
    baselineDeviation: somaticTelemetry?.baselineDeviation || {},
  };
}

/**
 * MAIN EDGE HANDLER: Therapy Chat Completions with Retry/Fallback
 *
 * ARCHITECTURE:
 * 1. Validate JWT token (done in middleware)
 * 2. Validate request schema (Zod)
 * 3. Determine agent type (first session = Intake, else = Therapist)
 * 4. Generate LLM response with RETRY/FALLBACK on 429, 503, 504
 * 5. Stream response as SSE with clinical data
 * 6. Queue async background jobs on completion
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // ======================================================================
    // STEP 1: Extract & validate token
    // ======================================================================
    const cookieHeader = req.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/lyra_access_token=([^;]+)/);
    const accessToken = tokenMatch ? tokenMatch[1] : null;

    if (!accessToken) {
      logger.warn('[CHAT] Missing access token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create authenticated Supabase client (enforces RLS)
    // Pass token directly via Authorization header
    const authHeaders = new Headers(req.headers);
    authHeaders.set('Authorization', `Bearer ${accessToken}`);

    const supabaseAuthResult = await createAuthenticatedSupabaseClient({
      headers: authHeaders,
    } as any);

    if (!supabaseAuthResult.client || !supabaseAuthResult.userId) {
      logger.warn('[CHAT] Token validation failed');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = supabaseAuthResult.userId;
    const supabaseClient = supabaseAuthResult.client;

    // ======================================================================
    // STEP 2: Parse & validate request body
    // ======================================================================
    let body: any;
    try {
      body = await req.json();
    } catch (err: any) {
      logger.error('[CHAT] JSON parse failed', { error: err.message });
      return new Response(
        JSON.stringify({ error: 'Invalid request: malformed JSON' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validationResult = chatCompletionSchema.safeParse(body);
    if (!validationResult.success) {
      logger.warn('[CHAT] Validation failed', { userId, errors: validationResult.error.errors.length });
      return new Response(
        JSON.stringify({ error: 'Invalid request: schema validation failed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { messages, call, somaticTelemetry } = validationResult.data;
    const sessionId = call?.metadata?.sessionId || `session_${Date.now()}`;

    logger.info('[CHAT] Stream request validated', {
      userId,
      sessionId,
      messageCount: messages.length,
    });

    // ======================================================================
    // STEP 3: Determine agent type
    // ======================================================================
    const firstSession = await isFirstSession(userId, supabaseClient);
    const agentType = firstSession ? 'intake' : 'therapist';

    // Build clinical data from request
    const clinicalData = buildClinicalData(validationResult.data, somaticTelemetry);

    logger.info('[CHAT] Agent selection', {
      userId,
      sessionId,
      agentType,
      firstSession,
    });

    // ======================================================================
    // STEP 4: Stream LLM response with RETRY/FALLBACK mechanism
    // ======================================================================
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        let hasEmittedData = false;

        try {
          // Initialize appropriate agent
          const agent = firstSession
            ? new IntakeAgent({ userId, sessionId })
            : new TherapistAgent({ userId, sessionId });

          logger.info('[CHAT] Agent instantiated', {
            userId,
            sessionId,
            agentType,
          });

          // ========================================================================
          // CRITICAL: Wrap agent.generateResponse() with retry logic
          // If 429/503/504 errors occur at the API call level, retry with backoff
          // ========================================================================
          const agentGenerator = await retryWithBackoff(
            async () => {
              logger.debug('[CHAT] Starting agent.generateResponse()', { agentType });
              return agent.generateResponse(clinicalData);
            },
            {
              maxRetries: 3,
              baseDelayMs: 500,
              maxDelayMs: 10000,
              backoffMultiplier: 2,
            }
          );

          // Stream all events from agent
          for await (const event of agentGenerator) {
            if (event.type === 'token') {
              // Stream individual tokens as SSE
              const sseChunk = {
                id: `chatcmpl-${Date.now()}-${Math.random()}`,
                object: 'text_completion.chunk',
                model: agentType,
                choices: [{ delta: { content: event.content } }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk)}\n\n`));
              hasEmittedData = true;
            } else if (event.type === 'complete') {
              // Stream completion metadata
              const completionChunk = {
                id: `chatcmpl-${Date.now()}`,
                object: 'text_completion',
                model: agentType,
                choices: [{
                  delta: { content: '' },
                  finish_reason: 'stop',
                  index: 0,
                }],
                usage: event.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                clinicalContext: event.context || {},
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(completionChunk)}\n\n`));
              hasEmittedData = true;

              // ====================================================================
              // STEP 5: Queue background jobs (non-blocking) on completion
              // Only increment session count (synthesis happens asynchronously)
              // ====================================================================
              waitUntil(
                incrementSessionCount(userId, supabaseClient).catch((e: any) =>
                  logger.error('[CHAT] Session increment failed', { error: e.message })
                )
              );

              break; // Exit loop after complete event
            } else if (event.type === 'error') {
              logger.error('[CHAT] Agent error', { error: event.error });
              const errorChunk = {
                id: `chatcmpl-${Date.now()}`,
                object: 'error',
                error: {
                  message: event.error || 'Unknown error during processing',
                  type: 'agent_error',
                  code: 'agent_stream_failed',
                },
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
              hasEmittedData = true;
              break;
            }
          }

          // Send stream terminator
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));

          if (!hasEmittedData) {
            logger.warn('[CHAT] No data emitted from agent', { userId, sessionId });
          }

          controller.close();
        } catch (streamErr: any) {
          logger.error('[CHAT] Stream error', {
            error: streamErr.message,
            userId,
            sessionId,
            agentType,
          });

          // Send error to client as SSE
          const encoder = new TextEncoder();
          if (!hasEmittedData) {
            const errorChunk = {
              id: `chatcmpl-${Date.now()}`,
              object: 'error',
              error: {
                message: streamErr.message || 'Internal server error during streaming',
                type: 'stream_error',
                code: 'stream_failed',
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
            );
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    // Return SSE stream
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering in proxies
      },
    });
  } catch (error: any) {
    logger.error('[CHAT] Handler error', { error: error.message });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
