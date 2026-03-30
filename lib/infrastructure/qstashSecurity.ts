/**
 * QStash Webhook Signature Verification
 *
 * CRITICAL SECURITY:
 * - Verifies webhook came from Upstash (not attacker)
 * - Uses QSTASH_CURRENT_SIGNING_KEY from environment
 * - Prevents unauthorized background job triggering
 * - HIPAA: ensures audit trail authenticity
 */

import { Receiver } from '@upstash/qstash';
import { VercelRequest } from '@vercel/node';
import { logger } from './logger';

let receiver: Receiver | null = null;

/**
 * Initialize QStash Receiver with signing key
 */
function getReceiver(): Receiver {
  if (receiver) return receiver;

  const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;

  if (!signingKey) {
    throw new Error('QSTASH_CURRENT_SIGNING_KEY environment variable not set');
  }

  receiver = new Receiver({
    baseUrl: process.env.API_URL || 'http://localhost:3000',
    currentSigningKey: signingKey
  });

  return receiver;
}

/**
 * Verify QStash webhook signature
 *
 * Checks:
 * 1. Signature header present
 * 2. Signature matches webhook body
 * 3. No replay attacks (timestamp verification)
 * 4. Request is actually from Upstash
 *
 * @param req Vercel request object
 * @param body Raw request body (MUST be raw, not parsed)
 * @returns { verified: true, body: parsed } or { verified: false, error }
 */
export async function verifyQStashSignature(
  req: VercelRequest,
  body: string | Buffer
): Promise<{
  verified: boolean;
  body?: Record<string, any>;
  error?: string;
}> {
  try {
    const signature = req.headers['upstash-signature'];

    if (!signature || typeof signature !== 'string') {
      logger.warn('[QStash] Missing signature header', {
        headers: Object.keys(req.headers)
      });
      return {
        verified: false,
        error: 'Missing Upstash-Signature header'
      };
    }

    const receiver = getReceiver();

    // Verify signature (throws if invalid)
    let parsedBody: Record<string, any>;
    try {
      parsedBody = await receiver.verify({
        signature,
        body: typeof body === 'string' ? body : body.toString()
      });
    } catch (error: any) {
      logger.warn('[QStash] Signature verification failed', {
        error: error.message,
        signature: signature.slice(0, 20) + '...'
      });
      return {
        verified: false,
        error: 'Invalid signature'
      };
    }

    logger.info('[QStash] Signature verified', {
      jobType: parsedBody.jobType,
      messageId: parsedBody.messageId
    });

    return {
      verified: true,
      body: parsedBody
    };
  } catch (error: any) {
    logger.error('[QStash] Verification error', { error: error.message });
    return {
      verified: false,
      error: 'Verification failed'
    };
  }
}

/**
 * Middleware for QStash webhook handlers
 *
 * Usage in handler:
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   // Get raw body (MUST verify before parsing!)
 *   const rawBody = req.rawBody || JSON.stringify(req.body);
 *
 *   const verification = await verifyQStashSignature(req, rawBody);
 *   if (!verification.verified) {
 *     return res.status(401).json({ error: verification.error });
 *   }
 *
 *   const job = verification.body;
 *   // Process job safely...
 * }
 * ```
 */
export function createQStashVerificationMiddleware() {
  return async (req: VercelRequest, res: any, next: Function) => {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const verification = await verifyQStashSignature(req, rawBody);

    if (!verification.verified) {
      logger.warn('[QStash] Request rejected - signature invalid');
      return res.status(401).json({
        error: 'Unauthorized',
        message: verification.error
      });
    }

    // Attach verified body to request
    (req as any).qstashBody = verification.body;
    next();
  };
}

export default {
  verifyQStashSignature,
  createQStashVerificationMiddleware,
  getReceiver
};
