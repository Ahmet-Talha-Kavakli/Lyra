/**
 * POST /api/auth/refresh
 * Vercel Serverless Handler - Refresh JWT tokens
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/shared/supabase';
import { logger } from '../../lib/infrastructure/logger';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Refresh tokens using Supabase Auth
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error || !data.session) {
      logger.warn('Token refresh failed', { error: error?.message });
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    logger.info('Token refreshed', { userId: data.user?.id });

    return res.status(200).json({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at
      }
    });

  } catch (error: any) {
    logger.error('Refresh handler error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
