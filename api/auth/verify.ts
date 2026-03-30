/**
 * GET /api/auth/verify
 * Vercel Serverless Handler - Stateful Cookie Check
 * 
 * Verifies the HttpOnly cookie and returns the user payload.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../lib/infrastructure/logger';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Try to get securely from HttpOnly Cookie
    let token = '';
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';');
      const lyraTokenCookie = cookies.find(c => c.trim().startsWith('lyra_access_token='));
      if (lyraTokenCookie) {
        token = lyraTokenCookie.split('=')[1];
      }
    }

    // 2. Fallback to Authorization header
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Create Supabase client for token verification
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    return res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.user_metadata?.first_name || data.user.user_metadata?.firstName || ''
      }
    });

  } catch (error: any) {
    logger.error('Verify handler error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
