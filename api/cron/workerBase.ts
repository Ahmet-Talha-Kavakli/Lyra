/**
 * QStash Worker Base
 * Prevents Retry Storms: HTTP 202 Accepted + waitUntil
 * Tells QStash job succeeded IMMEDIATELY, runs background work safely
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../../lib/infrastructure/logger';

export async function withQStashRetryProtection(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const requestId = req.headers['x-qstash-request-id'] as string || 'unknown';

    try {
      // ✅ Return HTTP 202 Accepted IMMEDIATELY
      // This tells QStash: "Job received and accepted, don't retry"
      res.status(202).json({
        status: 'accepted',
        requestId,
        message: 'Job queued for processing',
      });

      // ✅ Run actual work in background (fire-and-forget)
      // Vercel waitUntil: completes background work before function ends
      const context = req.context || {};
      if (context.waitUntil && typeof context.waitUntil === 'function') {
        context.waitUntil(
          handler(req, res).catch((error) => {
            logger.error('QStash background job failed', {
              requestId,
              error: error.message,
            });
          })
        );
      } else {
        // Fallback: Promise that won't block but logs errors
        handler(req, res).catch((error) => {
          logger.error('QStash background job failed (no waitUntil)', {
            requestId,
            error: error.message,
          });
        });
      }
    } catch (error: any) {
      logger.error('QStash wrapper error', {
        requestId,
        error: error.message,
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
