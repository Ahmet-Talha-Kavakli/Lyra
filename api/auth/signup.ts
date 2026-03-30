/**
 * POST /api/auth/signup
 * Vercel Serverless Handler - Stateless
 *
 * No Express dependency. Pure Node.js + Vercel runtime.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/shared/supabase';
import { logger } from '../../lib/infrastructure/logger';
import { validateUserRegistration } from '../../lib/infrastructure/validationSchemas';
import { config } from '../../lib/infrastructure/config';

// Rate limiting state moved to @upstash/redis (see lib/shared/upstashRedis.ts)
import { rateLimit } from '../../lib/shared/rateLimitRedis';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Rate limit check (Upstash Redis - stateless, shared across all instances)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const limiterKey = `auth-signup:${ip}`;
    const allowed = await rateLimit(limiterKey, 5, 3600); // 5 requests per hour per IP

    if (!allowed) {
      logger.warn('Signup rate limit exceeded', { ip });
      return res.status(429).json({ error: 'Too many signup attempts. Try again later.' });
    }

    // Validate request body
    const validation = validateUserRegistration(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors
      });
    }

    const { email, password, firstName, lastName } = validation.data;

    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email verification
      user_metadata: { firstName, lastName }
    });

    if (authError || !authData.user) {
      logger.error('Auth user creation failed', { email, error: authError?.message });

      // Check if user already exists
      if (authError?.message?.includes('already exists')) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      return res.status(500).json({ error: 'Failed to create account' });
    }

    const userId = authData.user.id;

    // 2. Create user_profile record in database
    // Use Supabase REST client (stateless HTTP, no connection pooling needed)
    const { error: profileError } = await supabase
      .from('user_profile')
      .insert({
        user_id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        created_at: new Date().toISOString(),
        session_count: 0,
        is_first_session: true,
        psychological_profile: null
      });

    if (profileError) {
      logger.error('Profile creation failed', { userId, error: profileError.message });

      // Attempt to delete the auth user (cleanup)
      await supabase.auth.admin.deleteUser(userId);

      return res.status(500).json({ error: 'Failed to create profile' });
    }

    // 3. Generate JWT tokens
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession(userId);

    if (sessionError || !sessionData.session) {
      logger.error('Session creation failed', { userId, error: sessionError?.message });
      return res.status(500).json({ error: 'Failed to create session' });
    }

    logger.info('User signup successful', { userId, email });

    // SET SECURE HTTP-ONLY COOKIES
    const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
    res.setHeader('Set-Cookie', [
      `lyra_access_token=${sessionData.session.access_token}; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=${sessionData.session.expires_in}`,
      `lyra_refresh_token=${sessionData.session.refresh_token}; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=2592000`
    ]);

    // Return user info
    return res.status(201).json({
      user: {
        id: userId,
        email,
        firstName,
        lastName
      },
      session: {
        expiresIn: sessionData.session.expires_in,
        expiresAt: sessionData.session.expires_at
      }
    });

  } catch (error: any) {
    logger.error('Signup handler error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
