/**
 * POST /api/auth/login
 * Vercel Serverless Handler - Stateless
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/shared/supabase';
import { logger } from '../../lib/infrastructure/logger';
import { validateEmail } from '../../lib/infrastructure/validationSchemas';
import { rateLimit } from '../../lib/shared/rateLimitRedis';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Rate limit
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const allowed = await rateLimit(`auth-login:${ip}`, 10, 3600);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many login attempts' });
    }

    // Validate
    const validation = validateEmail(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const { email, password } = validation.data;

    // Authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.session) {
      logger.warn('Login failed', { email, error: error?.message });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info('Login successful', { userId: data.user.id, email });

    return res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.user_metadata?.firstName || ''
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at
      }
    });

  } catch (error: any) {
    logger.error('Login handler error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
