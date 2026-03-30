/**
 * GET /api/cron/autonomousSourceDiscovery
 * Scheduled by: vercel.json crons
 *
 * Runs daily at 02:00 UTC
 * Discovers new knowledge sources via OpenAI analysis
 *
 * Vercel automatically sends X-Vercel-Cron header on scheduled invocations
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminSupabaseClient } from '../../lib/shared/supabaseAdmin';
import { logger } from '../../lib/infrastructure/logger';
import { verifyCronSecret } from '../../lib/infrastructure/authMiddleware';
import { acquireLock, releaseLock } from '../../lib/shared/upstashRedis';
import { autonomousSourceDiscovery } from '../../lib/infrastructure/cronJobs.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only GET allowed (Vercel cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is a legitimate Vercel cron call
  if (!verifyCronSecret(req)) {
    logger.warn('[Cron] Unauthorized cron attempt', {
      headers: Object.keys(req.headers)
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logger.info('[Cron] autonomousSourceDiscovery starting');

    // Create admin client (cron jobs run in system context, not user context)
    const supabase = getAdminSupabaseClient();

    // Acquire distributed lock (prevent multiple instances running simultaneously)
    const lockKey = 'cron:autonomousSourceDiscovery';
    const lockId = await acquireLock(lockKey, 3600); // 1 hour lock

    if (!lockId) {
      logger.info('[Cron] autonomousSourceDiscovery already running, skipping');
      return res.status(200).json({
        message: 'Cron already running on another instance',
        skipped: true
      });
    }

    try {
      // Call the cronJobs.js function
      await autonomousSourceDiscovery();

      // Release lock
      await releaseLock(lockKey, lockId);

      return res.status(200).json({
        success: true,
        message: 'autonomousSourceDiscovery completed',
        timestamp: new Date().toISOString()
      });

    } catch (jobError: any) {
      // Release lock on error
      await releaseLock(lockKey, lockId || '');

      logger.error('[Cron] autonomousSourceDiscovery failed', {
        error: jobError.message
      });

      return res.status(500).json({
        success: false,
        error: jobError.message
      });
    }

  } catch (error: any) {
    logger.error('[Cron] Handler error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
