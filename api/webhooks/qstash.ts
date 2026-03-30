/**
 * POST /api/webhooks/qstash
 * Receives background job completions from Upstash QStash
 *
 * QStash publishes:
 * { jobType, data, timestamp, retryCount, messageId }
 *
 * This endpoint dispatches to job handlers
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../../lib/infrastructure/logger';
import { backgroundJobs } from '../../lib/infrastructure/backgroundJobs';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobType, data, messageId, retryCount } = req.body;

    if (!jobType || !data) {
      logger.warn('[QStash] Invalid job payload', { body: req.body });
      return res.status(400).json({ error: 'Missing jobType or data' });
    }

    logger.info('[QStash] Job received', {
      jobType,
      messageId,
      retryCount,
      attempt: retryCount ? retryCount + 1 : 1
    });

    // Dispatch to appropriate handler
    let result;
    switch (jobType) {
      case 'profile-synthesis':
        result = await backgroundJobs.profileSynthesis(data);
        break;

      case 'session-sync':
        result = await backgroundJobs.sessionSync(data);
        break;

      case 'safety-check':
        result = await backgroundJobs.safetyCheck(data);
        break;

      case 'data-export':
        result = await backgroundJobs.dataExport(data);
        break;

      default:
        logger.warn('[QStash] Unknown job type', { jobType, messageId });
        return res.status(400).json({ error: `Unknown job type: ${jobType}` });
    }

    logger.info('[QStash] Job completed', {
      jobType,
      messageId,
      result: JSON.stringify(result).slice(0, 100) // First 100 chars
    });

    // Return 200 so QStash marks job as successful
    return res.status(200).json({
      success: true,
      jobType,
      messageId,
      result
    });

  } catch (error: any) {
    logger.error('[QStash] Job failed', {
      error: error.message,
      body: JSON.stringify(req.body).slice(0, 200)
    });

    // Return 200 anyway - QStash will retry automatically
    // If we return 500, QStash will retry with exponential backoff
    return res.status(200).json({
      success: false,
      error: error.message,
      willRetry: true
    });

  }
}
