/**
 * POST /api/auth/logout
 * Vercel Serverless Handler - Stateless
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/shared/supabase';
import { logger } from '../../lib/infrastructure/logger';
import { verifyAuth } from '../../lib/infrastructure/authMiddleware';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const auth = await verifyAuth(req);
    if (!auth.success) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId;

    // Invalidate session in Supabase Auth
    const { error } = await supabase.auth.admin.signOut(userId);

    if (error) {
      logger.error('Logout failed', { userId, error: error.message });
      // Don't fail the request, just log it
    }

    logger.info('Logout successful', { userId });

    return res.status(200).json({ message: 'Logged out successfully' });

  } catch (error: any) {
    logger.error('Logout handler error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
