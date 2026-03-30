/**
 * Vercel Cron Job Security
 *
 * CRITICAL SECURITY:
 * - Verifies cron request came from Vercel (not attacker)
 * - Uses CRON_SECRET from Vercel env (auto-generated)
 * - Prevents unauthorized cron execution
 * - HIPAA: ensures background job authenticity
 *
 * How to use:
 * 1. In Vercel dashboard, generate CRON_SECRET
 * 2. Add to environment: CRON_SECRET=xxx
 * 3. Call verifyCronSecret(req) in cron endpoints
 */

import { VercelRequest } from '@vercel/node';
import { logger } from './logger';

/**
 * Verify this request is a legitimate Vercel cron invocation
 *
 * Vercel adds:
 * - X-Vercel-Cron: 'true' header (for identification only)
 * - Authorization: 'Bearer <CRON_SECRET>' header (for verification)
 *
 * We verify the Authorization header token matches CRON_SECRET
 *
 * @param req Vercel request object
 * @returns true if verified, false otherwise
 */
export function verifyCronSecret(req: VercelRequest): boolean {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error('[Cron] CRON_SECRET not configured - cron jobs will fail');
      return false;
    }

    // Check Vercel cron header (for identification)
    const isCronRequest = req.headers['x-vercel-cron'] === 'true';

    if (!isCronRequest) {
      logger.warn('[Cron] Request missing x-vercel-cron header');
      return false;
    }

    // Extract and verify Bearer token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('[Cron] Missing or invalid Authorization header');
      return false;
    }

    const token = authHeader.slice(7);

    // Use timing-safe comparison to prevent timing attacks
    const isValid = timingSafeCompare(token, cronSecret);

    if (!isValid) {
      logger.warn('[Cron] Invalid CRON_SECRET token');
      return false;
    }

    logger.debug('[Cron] Secret verified');
    return true;

  } catch (error: any) {
    logger.error('[Cron] Verification error', { error: error.message });
    return false;
  }
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks that leak secret length/content
 */
function timingSafeCompare(provided: string, secret: string): boolean {
  if (provided.length !== secret.length) {
    // Still compare to avoid timing leaks
    const minLen = Math.min(provided.length, secret.length);
    let mismatch = provided.length !== secret.length;

    for (let i = 0; i < minLen; i++) {
      if (provided.charCodeAt(i) !== secret.charCodeAt(i)) {
        mismatch = true;
      }
    }

    return false;
  }

  let mismatch = false;
  for (let i = 0; i < secret.length; i++) {
    if (provided.charCodeAt(i) !== secret.charCodeAt(i)) {
      mismatch = true;
    }
  }

  return !mismatch;
}

/**
 * Middleware: Verify cron secret and reject if invalid
 *
 * Usage:
 * ```typescript
 * export default async function handler(req, res) {
 *   if (!verifyCronSecret(req)) {
 *     return res.status(401).json({ error: 'Unauthorized' });
 *   }
 *   // ... proceed with cron job
 * }
 * ```
 */
export default {
  verifyCronSecret,
  timingSafeCompare
};
