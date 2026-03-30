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

    // SET SECURE HTTP-ONLY COOKIES TO PREVENT XSS
    const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
    res.setHeader('Set-Cookie', [
      `lyra_access_token=${data.session.access_token}; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=${data.session.expires_in}`,
      `lyra_refresh_token=${data.session.refresh_token}; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=2592000`
    ]);

    return res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.user_metadata?.firstName || ''
      },
      // Optionally keeping session in JSON for backward compatibility during transition, 
      // but client MUST stop saving it to localStorage
      session: {
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at
      }
    });

  } catch (error: any) {
    logger.error('Login handler error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
