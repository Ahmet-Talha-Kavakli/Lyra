/**
 * POST /api/auth/login
 * Vercel EDGE Handler - Ultra Fast, Zero Cold Start
 * Rate limiting handled by middleware.ts (aggressive: 5/min per IP)
 */

import { logger } from '../../lib/infrastructure/logger';
import { loginSchema, validateData } from '../../lib/infrastructure/validationSchemas';
import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();

    const validation = validateData(loginSchema, body);
    if (!validation.success) {
      logger.warn('[Auth] Login validation failed', { errors: validation.errors });
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 400 });
    }

    const { email, password } = validation.data;
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    // Supabase signIn için anon key kullanılmalı
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

    // Edge ortamı için doğrudan native Fetch ile Supabase iletişimi
    const authResult = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await authResult.json();

    if (!authResult.ok || !data.access_token) {
      // ✅ Increment failed auth counter (tracked by middleware)
      try {
        await redis.incr(`lyra:auth_failed:${clientIp}`);
        await redis.expire(`lyra:auth_failed:${clientIp}`, 300);
      } catch {
        // Redis error = continue anyway (fail-open)
      }

      logger.warn('Login failed', { email, error: data.error_description });
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    // ✅ Clear failed counter on success
    try {
      await redis.del(`lyra:auth_failed:${clientIp}`);
    } catch {
      // Ignore
    }

    logger.info('Login successful', { userId: data.user.id, email });

    const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.append('Set-Cookie', `lyra_access_token=${data.access_token}; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=${data.expires_in}`);
    headers.append('Set-Cookie', `lyra_refresh_token=${data.refresh_token}; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=2592000`);

    return new Response(JSON.stringify({
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.user_metadata?.firstName || ''
      },
      session: {
        expiresIn: data.expires_in,
        expiresAt: Math.floor(Date.now() / 1000) + data.expires_in
      }
    }), { status: 200, headers });

  } catch (error: any) {
    logger.error('Login Edge handler error', { error: error.message });
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
