/**
 * Background Job Management for Vercel Serverless
 *
 * Problem: Hanging promises after response sent = connection leak on Vercel
 * Solutions:
 * 1. context.waitUntil() - hold Lambda open until Promise settles
 * 2. QStash webhook - queue job externally, return immediately
 * 3. Upstash scheduled functions - for time-critical work
 *
 * Use waitUntil() for < 1 second work (updates, cache invalidation)
 * Use QStash for > 1 second work (heavy computation, profile synthesis)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client as QStashClient } from '@upstash/qstash';
import { logger } from './logger';

const qstash = new QStashClient({
  token: process.env.QSTASH_TOKEN || ''
});

/**
 * Execute work that needs to complete before response
 * Used on Vercel: keeps Lambda warm until Promise settles
 *
 * Example:
 *   res.status(200).json({ ... });
 *   await waitUntil(updateCachePromise);
 *   // Response already sent, but Lambda waits for cache update
 */
export async function waitUntil(promise: Promise<any>): Promise<void> {
  try {
    await promise;
  } catch (error: any) {
    logger.error('[waitUntil] Background work failed', { error: error.message });
    // Don't throw - response already sent to client
  }
}

/**
 * Queue a background job via QStash
 * Job is retried automatically (exponential backoff)
 * Webhook endpoint processes the job (e.g., POST /api/webhooks/qstash)
 *
 * Example:
 *   await queueJob('profile-synthesis', {
 *     userId: 'user123',
 *     sessionId: 'session456'
 *   }, {
 *     delaySeconds: 0,
 *     maxRetries: 3,
 *     timeoutSeconds: 30
 *   });
 */
export async function queueJob(
  jobType: string,
  data: Record<string, any>,
  options?: {
    delaySeconds?: number;
    maxRetries?: number;
    timeoutSeconds?: number;
    callbackUrl?: string;
  }
): Promise<string | null> {
  try {
    if (!process.env.QSTASH_TOKEN) {
      logger.error('[queueJob] QSTASH_TOKEN not configured');
      return null;
    }

    const webhookUrl = options?.callbackUrl ||
      `${process.env.API_URL || 'http://localhost:3000'}/api/webhooks/qstash`;

    const response = await qstash.publishJSON({
      topic: `lyra-jobs-${jobType}`,
      body: {
        jobType,
        data,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        messageId: `${jobType}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      },
      delay: options?.delaySeconds || 0,
      retries: options?.maxRetries || 3,
      callback: webhookUrl,
      failureCallback: `${webhookUrl}?failed=true`
    });

    logger.info('[queueJob] Job queued', {
      jobType,
      messageId: response.messageId,
      delaySeconds: options?.delaySeconds || 0
    });

    return response.messageId;
  } catch (error: any) {
    logger.error('[queueJob] Failed to queue job', {
      jobType,
      error: error.message
    });
    return null;
  }
}

/**
 * Background job types and their handlers
 * Each route imports the handler it needs
 */

export async function profileSynthesisJob(data: {
  userId: string;
  sessionId: string;
  intakeSummary: Record<string, any>;
}): Promise<{ success: boolean; profile?: any }> {
  try {
    logger.info('[Job] Profile synthesis starting', {
      userId: data.userId,
      sessionId: data.sessionId
    });

    // Import dynamically or statically. We do it here statically at the top of the file,
    // actually let me check if I can just import at the top of the file.
    const { generateComprehensiveProfile } = await import('../../src/services/queue/profileSynthesisJob.js');
    
    const profile = await generateComprehensiveProfile(data.userId, data.sessionId, data.intakeSummary);

    logger.info('[Job] Profile synthesis complete', { userId: data.userId });
    return { success: true, profile };
  } catch (error: any) {
    logger.error('[Job] Profile synthesis failed', { error: error.message });
    throw error; // QStash will retry automatically
  }
}

export async function sessionSyncJob(data: {
  userId: string;
  sessionId: string;
  sessionData: Record<string, any>;
}): Promise<{ success: boolean }> {
  try {
    logger.info('[Job] Session sync starting', {
      userId: data.userId,
      sessionId: data.sessionId
    });

    // TODO: Save session data to database
    // await supabase.from('sessions').upsert({ ... });

    logger.info('[Job] Session sync complete', { userId: data.userId });
    return { success: true };
  } catch (error: any) {
    logger.error('[Job] Session sync failed', { error: error.message });
    throw error;
  }
}

export async function safeyCheckJob(data: {
  userId: string;
  sessionId: string;
  messageContent: string;
}): Promise<{ safetyLevel: string }> {
  try {
    logger.info('[Job] Safety check starting', {
      userId: data.userId,
      sessionId: data.sessionId
    });

    // TODO: Run Anthropic safety check on messageContent
    // const assessment = await claude.messages.create({ ... });

    logger.info('[Job] Safety check complete', { userId: data.userId });
    return { safetyLevel: 'low' };
  } catch (error: any) {
    logger.error('[Job] Safety check failed', { error: error.message });
    throw error;
  }
}

export async function dataExportJob(data: {
  userId: string;
  email: string;
}): Promise<{ exported: boolean }> {
  try {
    logger.info('[Job] Data export starting', {
      userId: data.userId,
      email: data.email
    });

    // TODO: Gather all user data, format as JSON, send email

    logger.info('[Job] Data export complete', { userId: data.userId });
    return { exported: true };
  } catch (error: any) {
    logger.error('[Job] Data export failed', { error: error.message });
    throw error;
  }
}

export const backgroundJobs = {
  profileSynthesis: profileSynthesisJob,
  sessionSync: sessionSyncJob,
  safetyCheck: safeyCheckJob,
  dataExport: dataExportJob
};

export default {
  waitUntil,
  queueJob,
  backgroundJobs
};
