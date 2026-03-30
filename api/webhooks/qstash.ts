/**
 * POST /api/webhooks/qstash
 *
 * Secure QStash webhook receiver
 * - Verifies Upstash signature on every request
 * - Prevents unauthorized job triggering
 * - HIPAA audit trail
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyQStashSignature } from '../../lib/infrastructure/qstashSecurity';
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
    // Get raw body for signature verification
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // Verify QStash signature (CRITICAL SECURITY)
    const verification = await verifyQStashSignature(req, rawBody);

    if (!verification.verified) {
      logger.warn('[QStash] Webhook rejected - invalid signature');
      return res.status(401).json({
        error: 'Unauthorized',
        message: verification.error
      });
    }

    const job = verification.body;

    if (!job || !job.jobType || !job.data) {
      logger.warn('[QStash] Invalid job payload', { job });
      return res.status(400).json({ error: 'Invalid job payload' });
    }

    logger.info('[QStash] Job processing', {
      jobType: job.jobType,
      messageId: job.messageId,
      retryCount: job.retryCount || 0
    });

    // Dispatch to job handler
    let result;
    switch (job.jobType) {
      case 'profile-synthesis':
        result = await backgroundJobs.profileSynthesis(job.data);
        break;

      case 'session-sync':
        result = await backgroundJobs.sessionSync(job.data);
        break;

      case 'safety-check':
        result = await backgroundJobs.safetyCheck(job.data);
        break;

      case 'data-export':
        result = await backgroundJobs.dataExport(job.data);
        break;

      default:
        logger.warn('[QStash] Unknown job type', { jobType: job.jobType });
        return res.status(400).json({
          error: 'Unknown job type',
          jobType: job.jobType
        });
    }

    logger.info('[QStash] Job completed', {
      jobType: job.jobType,
      messageId: job.messageId,
      result: JSON.stringify(result).slice(0, 100)
    });

    return res.status(200).json({
      success: true,
      jobType: job.jobType,
      messageId: job.messageId,
      result
    });

  } catch (error: any) {
    logger.error('[QStash] Job processing failed', {
      error: error.message
    });

    // Return 200 anyway so QStash doesn't retry infinitely
    // (If we return 5xx, QStash retries with backoff)
    return res.status(200).json({
      success: false,
      error: error.message,
      willRetry: false
    });
  }
}
